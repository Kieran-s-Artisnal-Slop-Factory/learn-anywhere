/**
 * Content collections — the authored, static half of the data model.
 *
 * Course layout: one folder per course, one sub-folder per chapter, and lesson
 * files inside chapter folders (named anything except `test`). `index.md` is
 * the course/chapter main page. The three course collections share one base
 * and are separated by glob depth:
 *
 *   src/content/courses/
 *     study-skills/                      ← course folder
 *       index.md                         ← the COURSE
 *       memory-basics/                   ← chapter folder
 *         index.md                       ← the CHAPTER (may declare a `test`)
 *         what-is-memory.md              ← a LESSON (may declare a `quiz`)
 *
 * Ids are path-scoped (`study-skills/memory-basics/what-is-memory`), so leaf
 * names only need to be unique within their folder.
 *
 * Ordering lives in the parent's frontmatter: a course lists its chapter
 * folder names in `chapters:`, a chapter lists its lesson file names (minus
 * `.md`) in `lessons:` — array order IS the order. These are plain relative
 * leaf names; the bundler (src/lib/content/bundle.ts) resolves them to full
 * ids and fails the build on anything missing or orphaned.
 *
 * A lesson with a `quiz` is an EXERCISE; without one it is a READING page. A
 * chapter with a `test` gets a full-page test at
 * /courses/<course>/<chapter>/test/ that gates chapter completion.
 *
 * The separate `glossary` collection holds one term per file: `term` (display
 * name) + `short` (popup description) in frontmatter, the body is the term's
 * landing page. Reference terms from any markdown body as [[file-name]] or
 * [[file-name|display text]].
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { idFromEntry } from './lib/content/resolve';

const base = './src/content/courses';

const generateId = ({ entry }: { entry: string }) => idFromEntry(entry);

/**
 * The question union, mirrored from src/lib/assessment/types.ts. Quizzes and
 * tests are both plain arrays of these.
 */
const multipleChoice = z
  .object({
    type: z.literal('multiple_choice'),
    prompt: z.string(),
    // Rendered with a–e labels, hence at most five authored options.
    options: z.array(z.string()).min(2).max(5),
    all_of_the_above: z.boolean().optional(),
    none_of_the_above: z.boolean().optional(),
    // Index into options, or the appended 'all' / 'none' choice.
    answer: z.union([z.number().int().nonnegative(), z.literal('all'), z.literal('none')]),
  })
  .superRefine((q, ctx) => {
    if (typeof q.answer === 'number' && q.answer >= q.options.length) {
      ctx.addIssue({ code: 'custom', message: `answer index ${q.answer} is out of range for ${q.options.length} options` });
    }
    if (q.answer === 'all' && !q.all_of_the_above) {
      ctx.addIssue({ code: 'custom', message: `answer 'all' requires all_of_the_above: true` });
    }
    if (q.answer === 'none' && !q.none_of_the_above) {
      ctx.addIssue({ code: 'custom', message: `answer 'none' requires none_of_the_above: true` });
    }
  });

const trueFalse = z.object({
  type: z.literal('true_false'),
  prompt: z.string(),
  answer: z.boolean(),
});

const multiSelect = z
  .object({
    type: z.literal('multi_select'),
    prompt: z.string(),
    options: z.array(z.string()).min(2),
    // The exact set of correct option indices.
    answer: z.array(z.number().int().nonnegative()).min(1),
  })
  .superRefine((q, ctx) => {
    for (const idx of q.answer) {
      if (idx >= q.options.length) {
        ctx.addIssue({ code: 'custom', message: `answer index ${idx} is out of range for ${q.options.length} options` });
      }
    }
    if (new Set(q.answer).size !== q.answer.length) {
      ctx.addIssue({ code: 'custom', message: 'answer contains duplicate indices' });
    }
  });

const shortAnswer = z.object({
  type: z.literal('short_answer'),
  prompt: z.string(),
});

const longAnswer = z.object({
  type: z.literal('long_answer'),
  prompt: z.string(),
});

const question = z.discriminatedUnion('type', [
  multipleChoice,
  trueFalse,
  multiSelect,
  shortAnswer,
  longAnswer,
]);

/**
 * Code-exercise blocks (coding-exams-plan.md). A lesson/chapter declares AT
 * MOST ONE assessment (quiz/test, database, or web); the kind is derived from
 * which block is present, never authored. `code:`/`test_code:` are reserved
 * for the pure-code extension (general-code-exams-plan.md).
 *
 * Whether the named runtime is enabled on this site is validated at build
 * time in lib/content/bundle.ts (schemas can't see astro.config).
 */
const databaseBlock = z.object({
  // Registry id of the database engine ('sqlite' now, 'pglite' later).
  runtime: z.string().default('sqlite'),
  // Seeds a fresh in-memory DB on load/reset.
  initial_sql: z.string(),
  // The embedded solution: run `query` (authors must ORDER BY), compare the
  // rows positionally. Omit ⇒ an explorable sandbox completed by submission.
  desired_state: z
    .object({
      query: z.string(),
      rows: z.array(z.record(z.string(), z.unknown())),
    })
    .optional(),
});

const webBlock = z.object({
  // Script language for the third tab; 'ts' is transpiled in-browser.
  lang: z.enum(['js', 'ts']).default('js'),
  starter: z
    .object({
      html: z.string().default(''),
      css: z.string().default(''),
      js: z.string().default(''),
    })
    .default({}),
});

/**
 * Chapter-test variants extend the lesson blocks with `instructions` —
 * markdown shown above the workspace on the test page. Lessons don't need
 * it (the lesson body IS the instructions), but a test page has no body of
 * its own: the chapter's body belongs to the chapter page.
 */
const testDatabaseBlock = databaseBlock.extend({
  instructions: z.string().optional(),
});
const testWebBlock = webBlock.extend({
  instructions: z.string().optional(),
});

/** "At most one assessment block" — shared by lessons and chapters. */
const atMostOne = (...blocks: unknown[]) => blocks.filter((b) => b !== undefined).length <= 1;

const courses = defineCollection({
  loader: glob({ base, pattern: '*/index.md', generateId }),
  schema: z.object({
    title: z.string(),
    // Chapter FOLDER names (relative to this course's folder), in order.
    chapters: z.array(z.string()),
  }),
});

const chapters = defineCollection({
  loader: glob({ base, pattern: '*/*/index.md', generateId }),
  schema: z.object({
    title: z.string(),
    // Lesson FILE names minus `.md` (relative to this chapter's folder), in order.
    // `test` is reserved for the chapter test route.
    lessons: z.array(z.string()).refine((names) => !names.includes('test'), {
      message: '`test` is a reserved lesson name (it is the chapter-test route)',
    }),
    // Present ⇒ the chapter ends with a full-page test that gates completion.
    test: z.array(question).min(1).optional(),
    // Code-based test variants — the lesson block shapes + `instructions`.
    test_database: testDatabaseBlock.optional(),
    test_web: testWebBlock.optional(),
    // POST target for test submissions (sent for human marking). NOT secure —
    // answers are baked into the page; see the Course Development Guide.
    result_endpoint: z.string().url().optional(),
  })
    .refine((data) => atMostOne(data.test, data.test_database, data.test_web), {
      message: 'a chapter may declare at most one of test / test_database / test_web',
    })
    .refine(
      (data) => !data.result_endpoint || data.test || data.test_database || data.test_web,
      { message: 'result_endpoint requires a test / test_database / test_web to submit' }
    ),
});

const lessons = defineCollection({
  // Every .md exactly one level inside a chapter folder that is not an index.
  loader: glob({ base, pattern: ['*/*/*.md', '!**/index.md'], generateId }),
  schema: z.object({
    title: z.string(),
    // Present ⇒ the lesson is an exercise, completed by submitting the quiz.
    quiz: z.array(question).min(1).optional(),
    // Code-based exercise variants — at most one assessment block per lesson.
    database: databaseBlock.optional(),
    web: webBlock.optional(),
    // POST target for quiz submissions (sent for human marking).
    result_endpoint: z.string().url().optional(),
  })
    .refine((data) => atMostOne(data.quiz, data.database, data.web), {
      message: 'a lesson may declare at most one of quiz / database / web',
    })
    .refine((data) => !data.result_endpoint || data.quiz || data.database || data.web, {
      message: 'result_endpoint requires a quiz, database, or web exercise to submit',
    }),
});

const glossary = defineCollection({
  loader: glob({ base: './src/content/glossary', pattern: '*.md' }),
  schema: z.object({
    // Display name shown in popups and as the default [[link]] text.
    term: z.string(),
    // One-or-two-sentence popup description.
    short: z.string(),
  }),
});

/**
 * Flashcard decks — one file per deck, cards in frontmatter (plain text on
 * both sides), the markdown body is the deck's description. Practice is
 * session-only: cards you miss are re-queued until every card has been
 * answered correctly once.
 */
const flashcards = defineCollection({
  loader: glob({ base: './src/content/flashcards', pattern: '*.md' }),
  schema: z.object({
    title: z.string(),
    cards: z
      .array(
        z.object({
          front: z.string(),
          back: z.string(),
        })
      )
      .min(1),
  }),
});

export const collections = { courses, chapters, lessons, glossary, flashcards };
