/**
 * BUILD-TIME ONLY (imports node:crypto + astro:content types) — turns content
 * collection entries into the JSON payloads pages embed for the client, each
 * stamped with a stable content_hash so the client cache can detect
 * re-authored content across deploys.
 *
 * This is also where the course→chapter→lesson wiring is resolved: parents
 * list their children as relative leaf names (see content.config.ts), and
 * loadCourseTrees() builds the full path ids, throwing on anything missing or
 * orphaned so broken wiring fails the build.
 */
import { createHash } from 'node:crypto';
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Question } from '../assessment/types';
import { RUNTIMES, runtimeEnabled } from '../runtimes/config';
import { installHint, knownRuntime } from '../runtimes/info';
import { renderMarkdownFragment } from './markdown';
import { resolveTrees } from './resolve';
import type {
  ChapterContent,
  CourseContent,
  DatabaseBlock,
  LessonContent,
  LessonKind,
  WebBlock,
} from './types';

/**
 * Question prompts are markdown too (glossary [[refs]] included), but they
 * live in frontmatter, which Astro's content pipeline leaves as plain
 * strings. Render them at build time; the HTML rides along as `prompt_html`
 * next to the raw prompt (which result-endpoint submissions keep sending as
 * text).
 */
async function withPromptHtml(questions: Question[] | undefined): Promise<Question[] | undefined> {
  if (!questions) return undefined;
  return Promise.all(
    questions.map(async (q) => ({ ...q, prompt_html: await renderMarkdownFragment(q.prompt) }))
  );
}

/** JSON.stringify with recursively sorted object keys, so hashing is stable. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonicalize(v));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Stable hash of one entry's content (frontmatter + body). */
export function contentHash(data: unknown, body: string): string {
  return createHash('sha256')
    .update(canonicalize({ body, data }))
    .digest('hex');
}

/**
 * A fully resolved course: entries for the course, its chapters (in course
 * order), and each chapter's lessons (in chapter order).
 */
export interface CourseEntryTree {
  course: CollectionEntry<'courses'>;
  chapters: {
    chapter: CollectionEntry<'chapters'>;
    lessons: CollectionEntry<'lessons'>[];
  }[];
}

/** A whole course as embeddable content payloads (what pages bake in). */
export interface CourseBundle {
  course: CourseContent;
  chapters: ChapterContent[];
  lessons: LessonContent[];
}

/**
 * The runtime a content file's code-exercise block needs, or null. The web
 * kind has no authored `runtime:` field — it's the singleton 'web' runtime.
 */
function requiredRuntime(data: {
  database?: { runtime: string };
  web?: unknown;
  test_database?: { runtime: string };
  test_web?: unknown;
}): string | null {
  if (data.database) return data.database.runtime;
  if (data.test_database) return data.test_database.runtime;
  if (data.web || data.test_web) return 'web';
  return null;
}

/**
 * Build gate: content may only use runtimes this site enables in
 * astro.config.mjs — same fail-fast philosophy as orphaned lessons and
 * unknown glossary terms. Collects every offender before throwing.
 */
function validateRuntimes(trees: CourseEntryTree[]): void {
  const problems: string[] = [];
  const check = (id: string, entryId: string) => {
    if (!knownRuntime(id)) {
      problems.push(`  "${entryId}" uses unknown runtime "${id}"`);
    } else if (!runtimeEnabled(id)) {
      problems.push(
        `  "${entryId}" needs runtime "${id}" — add it to \`runtimes\` in astro.config.mjs ` +
          `and run: ${installHint(id)}`
      );
    }
  };
  for (const tree of trees) {
    for (const { chapter, lessons } of tree.chapters) {
      const chapterRuntime = requiredRuntime(chapter.data);
      if (chapterRuntime) check(chapterRuntime, chapter.id);
      for (const lesson of lessons) {
        const lessonRuntime = requiredRuntime(lesson.data);
        if (lessonRuntime) check(lessonRuntime, lesson.id);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Content uses code runtimes this site doesn't enable ` +
        `(runtimes: [${RUNTIMES.map((r) => `'${r}'`).join(', ')}]):\n` +
        problems.join('\n')
    );
  }
}

/**
 * Load every course and resolve the relative-leaf child arrays into full
 * path ids. Throws on a listed child that doesn't exist AND on files no
 * parent lists (orphans) — both would otherwise ship broken or invisible
 * content. Also gates code-exercise runtimes against the site config.
 */
export async function loadCourseTrees(): Promise<CourseEntryTree[]> {
  const [courseEntries, chapterEntries, lessonEntries] = await Promise.all([
    getCollection('courses'),
    getCollection('chapters'),
    getCollection('lessons'),
  ]);
  const trees = resolveTrees(courseEntries, chapterEntries, lessonEntries);
  validateRuntimes(trees);
  return trees;
}

export async function toBundle(tree: CourseEntryTree): Promise<CourseBundle> {
  return {
    course: courseContent(tree.course),
    chapters: await Promise.all(tree.chapters.map(({ chapter }) => chapterContent(chapter))),
    lessons: await Promise.all(
      tree.chapters.flatMap(({ lessons }) => lessons.map(lessonContent))
    ),
  };
}

export function courseContent(entry: CollectionEntry<'courses'>): CourseContent {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    chapters: entry.data.chapters.map((leaf) => `${entry.id}/${leaf}`),
  };
}

export async function chapterContent(entry: CollectionEntry<'chapters'>): Promise<ChapterContent> {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    lessons: entry.data.lessons.map((leaf) => `${entry.id}/${leaf}`),
    test: await withPromptHtml(entry.data.test as Question[] | undefined),
    test_database: entry.data.test_database as DatabaseBlock | undefined,
    test_web: entry.data.test_web as WebBlock | undefined,
    result_endpoint: entry.data.result_endpoint,
  };
}

/** Derived, never authored: the (at most one) assessment block sets the kind. */
function lessonKind(data: { quiz?: unknown; database?: unknown; web?: unknown }): LessonKind {
  if (data.quiz) return 'exercise';
  if (data.database) return 'database';
  if (data.web) return 'web';
  return 'reading';
}

export async function lessonContent(entry: CollectionEntry<'lessons'>): Promise<LessonContent> {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    kind: lessonKind(entry.data),
    quiz: await withPromptHtml(entry.data.quiz as Question[] | undefined),
    database: entry.data.database as DatabaseBlock | undefined,
    web: entry.data.web as WebBlock | undefined,
    result_endpoint: entry.data.result_endpoint,
  };
}
