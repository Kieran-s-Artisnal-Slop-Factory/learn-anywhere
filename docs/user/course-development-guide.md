# Course Development Guide

How to author courses, quizzes, chapter tests, and glossary terms. For technical details like the system architecture, see the [Development Guide](../dev/development-guide.md).

## Layout

One folder per course, one sub-folder per chapter, lesson files inside:

```
src/content/courses/
  1.learn-anywhere-101/            ← course folder (name = slug = URL segment)
    index.md                       ← the COURSE page
    the-basics/                    ← chapter folder
      index.md                     ← the CHAPTER page (may declare a test)
      welcome.md                   ← a LESSON (may declare a quiz)
src/content/glossary/
  frontmatter.md                   ← one glossary TERM per file
```

Folder/file names become ids and URLs (`/courses/<course>/<chapter>/<lesson>/`),
so rename them only if you accept resetting visitors' progress for that item.
`test` is a **reserved lesson filename** — it's the chapter-test route.

## Wiring and ordering

Parents list their children, and array order IS display order:

```yaml
# course index.md
title: Learn Anywhere 101
chapters:
  - the-basics               # folder names, relative to the course folder
  - creating-content

# chapter index.md
title: The Basics
lessons:
  - welcome                  # file names minus .md
  - lessons-quizzes-and-tests
```

The build fails on a listed child that doesn't exist and on files no parent
lists — broken wiring can't ship. (Only `.md` files are content: images and
other assets can sit beside lessons freely — see [images.md](images.md).)

## What a body can contain

Bodies are standard markdown plus four platform extras: `[[glossary refs]]`
(see below), co-located [images](images.md), `$math$` / `$$math$$` rendered
with KaTeX, and [Mermaid diagrams](diagrams.md) in ```` ```mermaid ````
fenced blocks.

## Lessons: readings and exercises

A lesson's markdown body is the left-hand prose. Its kind is derived:

- **No `quiz`** → a *reading* lesson, completed with "Mark as read".
- **`quiz` present** → an *exercise*, completed by submitting the quiz (any
  score completes it; the score is recorded and shown in the course overview).

## Questions (quizzes and tests share this format)

`quiz:` (lessons) and `test:` (chapter `index.md`) are arrays of questions.
Six types:

```yaml
quiz:
  # Multiple choice: 2–5 options, rendered a–e. `answer` is a 0-based index.
  - type: multiple_choice
    prompt: When does forgetting begin?
    options:
      - Within hours
      - After a week
      - After a month
    answer: 0 # Meaning `Within Hours` is correct

  # All/None of the above are opt-in PER QUESTION and appended after the
  # authored options. `answer: all` / `answer: none` selects them, or keep a
  # numeric answer to use them as distractors.
  - type: multiple_choice
    prompt: Which strategies help?
    options:
      - Breaking material into small pieces
      - Chunking related facts
    all_of_the_above: true
    none_of_the_above: true
    answer: all

  # True / false.
  - type: true_false
    prompt: Forgetting begins within hours.
    answer: true

  # Multi-select: `answer` is the exact set of correct option indices.
  - type: multi_select
    prompt: Which are mnemonic devices?
    options: [An acronym, A vivid image, Re-reading, A story]
    answer: [0, 1, 3]

  # Short answer: one line of free text. Stored on the device (and sent to
  # the result endpoint, if one is set), but NEVER auto-graded — it does not
  # contribute to the score.
  - type: short_answer
    prompt: Explain the forgetting curve in your own words.

  # Long answer: same rules as short_answer but a multi-line textarea, for
  # essay-style responses. Also never auto-graded.
  - type: long_answer
    prompt: Compare spaced repetition and cramming, with examples.

  # Numeric: the learner types the number(s). `answer` is one number,
  # a list (entered comma-separated, ANY order), or tuples (entered like
  # "(10, 15), (12.4, -36.2)" — order inside a tuple matters, list order
  # doesn't). Options: integer (whole numbers only), positive (no negative
  # entries), precision (decimals of tolerance — precision 3 accepts
  # 4.3879 for 4.3875; default is near-exact).
  - type: numeric
    prompt: What is 6 × 7?
    answer: 42
    integer: true
  - type: numeric
    prompt: List every factor of 10.
    answer: [1, 2, 5, 10]
    integer: true
    positive: true
  - type: numeric
    prompt: Give the roots of x² − 25x + 150 as (smaller, larger).
    answer: [[10, 15]]
    precision: 2
```

Answer indices are validated at build time (out-of-range indices, `all`
without `all_of_the_above`, duplicate multi-select indices all fail the
build).

**Prompts are markdown.** A question's `prompt` is rendered through the same
pipeline as lesson bodies, so inline code, emphasis, links, and glossary
references all work:

```yaml
  - type: multiple_choice
    prompt: What is [[frontmatter]]? See `content.config.ts` for the schema.
    options: [An image format, A metadata block]
    answer: 1
```

Two notes: *options* stay plain text (handy when an option needs to show
literal markdown syntax), and result-endpoint submissions send the raw
prompt text, not the rendered HTML. YAML quoting still applies — wrap the
prompt in quotes when it contains `key: value` text or starts with a
reserved character like a backtick or `#`.

Grading: unanswered questions can't be submitted; each gradable question is
right or wrong; the score is `correct/gradable`. Short/long answers are
excluded from `gradable` entirely. Retakes are allowed and overwrite the
stored responses and score.

**Partial marks** (`partial_grades` in `astro.config.mjs`, default `false`):
when enabled site-wide, partially right answers to **multi-select** and
**multi-value numeric** questions earn partial credit — each correct
selection/value is worth `1/total`, each wrong one cancels one out, and a
question never scores below zero. Scores (including `score_correct` in
result-endpoint submissions) may then be fractional, and partially right
questions are labelled `partial:<fraction>` instead of `false` in the
submission. Single-answer questions stay all-or-nothing.

## Sending results for marking (`result_endpoint`)

Add `result_endpoint: <url>` next to a lesson's `quiz:` or a chapter's
`test:` and every submission is also POSTed to that URL, so a person can mark
it later:

```yaml
title: Final Essay Quiz
quiz:
  - type: multiple_choice
    prompt: …
    options: [a, b]
    answer: 0
  - type: long_answer
    prompt: Argue for or against spaced repetition in one paragraph.
result_endpoint: https://example.com/course-results
```

This is how a course author receives test information to evaluate someone
with more nuance than multiple choice allows — the intended pattern is a
quiz/test that mixes auto-graded questions with `short_answer`/`long_answer`
ones, all shipped off together for review.

**Database exercises support it too**: `result_endpoint` next to a lesson's
`database:` or a chapter's `test_database:` POSTs the learner's SQL on every
Check (fields: `kind`, `slug`, `title`, `submitted_at`, `sender_*`,
`passed` (`true`/`false`, or `n/a` for sandboxes), `solution_sql`) with the
same profile gate and `x-sender-*` headers.

> **This is not secure and not for accredited assessment.** The correct
> answers are baked into the page (grading runs in the browser), and the
> sender identity is whatever the visitor typed into their profile — nothing
> is verified. It's meant for environments that aren't accredited but need
> more nuanced feedback than a multiple-choice score: internal training,
> community courses, workshops.

How it behaves:

- Submission is **blocked until the visitor sets a name and email**
  (Settings, or during onboarding). The form is disabled with an error banner
  telling them to set those values first; the receiver gets them as
  `x-sender-name` / `x-sender-email` request headers (and duplicated as
  `sender_name`/`sender_email` form fields).
- Local grading and lesson/chapter completion still happen even if the send
  fails (the app is offline-first); a failed send shows an error with a
  retry button. Retaking re-sends.
- The POST body is standard form data:
  `kind` (`quiz`|`test`), `slug`, `title`, `submitted_at`, `score_correct`,
  `score_gradable`, `sender_name`, `sender_email`, and per question
  `q<N>_type`, `q<N>_prompt`, `q<N>_response` (human-readable text),
  `q<N>_correct` (`true`/`false`/`ungraded`).
- Your endpoint must handle **CORS**: the custom headers make this a
  preflighted request, so answer `OPTIONS` and allow
  `x-sender-name, x-sender-email` from your site's origin.

## Chapter tests

Add `test:` to a chapter's `index.md` to generate a full-page test at
`/courses/<course>/<chapter>/test/`. The chapter's body text is shown on the
chapter page as usual; the test page renders just the questions, full width.

A chapter with a test is only **complete** once every lesson is done *and*
the test has been submitted. The last lesson's "next" button, the chapter
page, and the course overview all link to the test.

Chapters support `result_endpoint:` too (next to `test:`) — see
[Sending results for marking](#sending-results-for-marking-result_endpoint).

**Code-based tests need `instructions`.** A question test explains itself,
but a `test_database:` (or `test_web:`) page is just a workspace — the
chapter's markdown body belongs to the *chapter* page, not the test. Give
the test its task text via the block's `instructions` field (markdown,
glossary references included), shown above the workspace:

```yaml
test_database:
  runtime: sqlite
  initial_sql: |
    CREATE TABLE books (...);
  desired_state:
    query: SELECT name FROM pragma_table_info('reviews') ORDER BY cid;
    rows:
      - { name: id }
  instructions: |
    Create a `reviews` table with an `id` column, then press
    **Check solution**.
```

(Lesson-level `database:`/`web:` blocks don't take `instructions` — a
lesson's body already plays that role.)

## Collecting learner feedback (`contactEndpoint`)

Separately from graded results, the site can collect free-form feedback. Set
`contactEndpoint` in `astro.config.mjs` to a POST endpoint you host, and the
site grows:

- a **"Give us feedback on this lesson"** button at the bottom of every
  lesson and test page, opening a plain-text form whose subject is fixed to
  `Feedback: <lesson name> <url>`;
- a **Contact** link in the navbar to a general form with a custom subject
  and message.

The POST body is form data: `subject`, `message`, plus
`sender_name`/`sender_email` fields and `x-sender-name`/`x-sender-email`
headers *when* the visitor has set a profile (unlike result endpoints, a
profile is not required to send feedback). Leave `contactEndpoint` as an
empty string to disable the whole feature.

## Database exercises

Lessons and chapter tests can be **SQL workspaces** backed by a real SQLite
database in the browser: declare a `database:` block on a lesson (instead of
`quiz:`) or `test_database:` on a chapter (instead of `test:`), seed it with
`initial_sql`, and optionally check the learner's work with a
`desired_state` query compared against the live database.

This has its own full guide — authoring schema, the positional-comparison
and coercion rules, and the introspection recipes that make schema/index/
trigger tasks checkable: **[database-exercises.md](database-exercises.md)**.
Enabling the runtime (one config line + one install) is covered in
**[runtimes.md](runtimes.md)**; a reference course ships
in `src/content/courses/9.sql-demo/`.

## Web exercises

Lessons and chapter tests can also be **web workspaces**: HTML / CSS /
JS-or-TypeScript editor tabs with a live page preview, Emmet, a console
strip, and zip/screenshot exports. Declare `web:` on a lesson or
`test_web:` on a chapter (with `instructions`). There's no auto-grading —
learners build and press *Submit work*; pair with `result_endpoint` to
collect what they built.

Full guide: **[web-exercises.md](web-exercises.md)**;
reference course in `src/content/courses/8.web-demo/`.

## Interface walkthroughs (`interfaceTutorials`)

The repo ships a built-in **Platform walkthrough** course
(`src/content/courses/0.platform-walkthrough/`) with one single-lesson
chapter per interface — standard quizzes, the database workspace, and the
web workspace. It's opt-in per chapter via `interfaceTutorials` in
`astro.config.mjs`:

```js
const interfaceTutorials = {
  web: false,      // web workspace tour (needs the 'web' runtime)
  database: false, // database workspace tour (needs the 'sqlite' runtime)
  quizes: false,   // every question type in one hands-on quiz
};
```

All flags default to `false`; the course only exists on the site when at
least one is `true`, and disabled chapters are left out entirely (pages,
course listing, offline precache, progress). Enabling `web` or `database`
without the matching entry in `runtimes` fails the build with the usual
runtime message.

## Flashcard decks

One file per deck in `src/content/flashcards/`; the file name is the deck's
slug (`/flashcards/<file-name>/`). Cards are plain text, front and back, in
frontmatter; the markdown body is the deck description shown on the deck page
and (first paragraph) in the deck listing:

```yaml
---
title: Learning Science Terms
cards:
  - front: What is active recall?
    back: Retrieving information from memory instead of re-reading it.
  - front: Roughly how many chunks can working memory hold?
    back: About four.
---
Key vocabulary from the Effective Learning course.
```

Practice is **session-only** (nothing is stored): the deck is shuffled, each
card is revealed then marked "Got it" or "Again", and "Again" cards return to
the back of the queue until every card has been answered correctly once. A
round summary reports how many cards needed repeats. Keyboard shortcuts:
Space/Enter flips, `1` = got it, `2` = again.

Notes:

- `front`/`back` are **markdown**, rendered through the same pipeline as
  question prompts — emphasis, inline code, and `[[glossary]]` references all
  work. To show `[[...]]` or other syntax literally on a card, wrap it in
  backticks (code spans are left alone). YAML quoting rules apply as usual.
- A deck must have at least one card (build-enforced).
- Decks are standalone; they aren't tied to a course, so use the description
  to say which course/chapter they accompany.

## Glossary terms

One file per term in `src/content/glossary/`:

```yaml
---
term: Active recall            # display name (popup title, default link text)
short: Deliberately retrieving information from memory instead of re-reading it.
---
The markdown body — the term's landing page at /glossary/<file-name>/.
```

Keep `term` and `short` on a single line each — the remark plugin reads them
with a minimal parser.

Reference terms from any markdown body (courses, chapters, lessons, other
glossary entries):

```
[[active-recall]]                  → links as "Active recall"
[[active-recall|active recall]]    → links with your own display text
```

Readers get a popup with the short description and a "Read more" link to the
landing page. Notes:

- The file name (minus `.md`) is the slug you reference. Unknown slugs fail
  the build.
- The plugin loads the term list when the dev server starts — **restart `npm
  run dev` after adding a term**.
- References inside code blocks and `inline code` are left alone.
- Use the `|display` form for mid-sentence casing (the default display is the
  `term` field verbatim).

## Checklist for a new course

1. Create the course folder + `index.md` (title, `chapters:` list, body).
2. Create each chapter folder + `index.md` (title, `lessons:` list, optional
   `test:`, body).
3. Write lessons; add `quiz:` to the ones that should be exercises.
4. Add/reference glossary terms as you go.
5. `npm run build` — fix anything it reports (wiring, schema, glossary).
6. Walk through it on the dev server: enroll, take a quiz, take a test, and
   check the score overview on /courses/.
