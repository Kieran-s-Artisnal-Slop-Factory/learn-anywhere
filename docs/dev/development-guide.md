# Development Guide

System architecture, project layout, and the key technologies and approaches
behind learn-anywhere. For authoring content, see the
[Course Development Guide](../user/course-development-guide.md).

## The core idea

learn-anywhere is a **fully static** site with **no backend**. Two kinds of
data are kept deliberately apart:

- **Content** (titles, prose, quiz/test questions, glossary terms) is authored
  as markdown, validated by Astro content collections at build time, and baked
  into the static bundle.
- **Progress** (started/completed timestamps, current position, quiz/test
  responses and scores) is per-visitor and lives only in the browser's
  IndexedDB.

Content is *copied* into IndexedDB on enrollment so the app runs offline, and
kept fresh with a content hash. Everything the learner does — answering
quizzes, taking tests, tracking progress — happens client-side.

## Tech stack

| Concern           | Choice                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| Static generation | **Astro 7** — one page per course/chapter/lesson/test, content collections for validation |
| Interactivity     | **Svelte 5 (runes)** islands, mounted with `client:only="svelte"`                       |
| Grading           | a pure TypeScript module (`lib/assessment/grade.ts`), unit-tested                       |
| Local storage     | **IndexedDB** via [`idb`](https://github.com/jakearchibald/idb)                         |
| Glossary links    | a **remark plugin** (`lib/glossary/remark-glossary.mjs`) + a vanilla popover script     |
| Offline           | a hand-written **service worker** + web app manifest (installable PWA)                  |
| Tests             | **vitest** (the grader and the content resolver)                                        |

## Project layout

```
src/
  content/
    courses/                    authored courses (folders; see Course Development Guide)
    glossary/                   one .md per glossary term
  content.config.ts             the four content collections + their Zod schemas
  layouts/Layout.astro          <html> shell: theme boot, SW registration, glossary popover
  pages/
    index.astro                 homepage (intro + progress dashboard island)
    courses/
      index.astro               course listing + per-course performance overview
      [course]/index.astro      course page (chapters + enroll/continue)
      [course]/[chapter]/index.astro         chapter page
      [course]/[chapter]/[lesson].astro      lesson page (prose + quiz island)
      [course]/[chapter]/test.astro          full-page chapter test
    flashcards/
      index.astro               deck listing
      [deck].astro              a deck's practice page
    glossary/
      index.astro               all terms with short descriptions
      [term].astro              a term's landing page
    settings.astro  onboarding.astro
    precache.json.ts            build-time route list for the service worker
  components/
    Navbar.svelte  Card.svelte  Accordion.svelte
    apps/          HomeApp, CoursesApp, OnboardingApp, SettingsApp
    course/        CourseOverviewApp, ChapterApp
    exercise/      LessonApp (quiz or mark-as-read)
    assessment/    QuestionCard, AssessmentForm, TestApp
    flashcards/    FlashcardApp (session-only practice)
  lib/
    assessment/    types.ts (question model), grade.ts (pure grader) + tests
    content/       bundle.ts (build-time emit), sync.ts (client cache), resolve.ts (pure), types.ts
    glossary/      remark-glossary.mjs ([[term]] → popup links, build-time)
    db/            types.ts (+ STORES), db.ts (migrations), repo.ts, export.ts, persistence.ts
    progress.ts    completion stamping + cascade (test-aware)
    paths.ts       href()/isPath() base-path helpers
    palette.ts     palette preference
  styles/          theme.css (design tokens), global.css (base + component classes)
public/
  sw.js  manifest.webmanifest  icons/  favicon.svg
scripts/
  generate-icons.mjs            regenerates the PWA icons from the brand colors
```

Pages are thin: an `.astro` page resolves content at build time, renders the
static prose, and mounts one Svelte island for the interactive parts.

## Data model

### Content collections (authored, static)

`src/content.config.ts` defines **three course collections** over one shared
base (`src/content/courses`), separated by glob depth:

- `courses` — `*/index.md`
- `chapters` — `*/*/index.md` (may declare a `test:` — an array of questions)
- `lessons` — `*/*/*.md` excluding `index.md` (may declare a `quiz:`)

plus a **`glossary`** collection (`src/content/glossary/*.md`, one term per
file: `term` + `short` frontmatter, body = landing page) and a
**`flashcards`** collection (`src/content/flashcards/*.md`, one deck per
file: `title` + `cards: [{front, back}]` frontmatter, body = deck
description). Flashcard practice is session-only — no IndexedDB rows, no
progress tracking; missed cards recycle within the round
(`components/flashcards/FlashcardApp.svelte`).

A `generateId` hook derives a **path-scoped id** from each course file
(`effective-learning/memory-fundamentals/the-forgetting-curve`), collapsing
`.../index` to its directory. That id is the IndexedDB key *and* the URL path.

Ordering is authored as relative leaf names in the parent's frontmatter
(`chapters: [...]`, `lessons: [...]`). The bundler resolves those leaves to
full ids itself and throws on anything missing **or orphaned** — the
build-time validation gate. `test` is a **reserved lesson name** (the chapter
test route), enforced by the chapters schema.

A lesson's **kind** is derived, never authored: a `quiz` present ⇒ `exercise`;
otherwise `reading`.

### The question model

`lib/assessment/types.ts` defines the union used by quizzes and tests alike:
`multiple_choice` (2–5 authored options rendered a–e; optional
`all_of_the_above` / `none_of_the_above` appended per question),
`true_false`, `multi_select` (exact-set answer), and `short_answer` (stored,
never graded). The Zod schemas in `content.config.ts` mirror these shapes and
also validate answer indices at build time.

### IndexedDB (progress + cached content)

`src/lib/db/types.ts` defines the stores in `STORES` (`courses`, `chapters`,
`lessons`). Each content-backed row is keyed by its content slug and carries
both:

- **cached content** — `content_hash`, `title`, `description`, child arrays,
  `quiz` (lessons) / `test` (chapters)
- **progress** — `started`, `completed`, `current_chapter` (courses),
  `quiz_responses`/`quiz_score` (lessons),
  `test_responses`/`test_score`/`test_completed` (chapters)

Every row also has bookkeeping fields (`id`, `updated_at`, `deleted_at`,
`server_seq`) that keep soft deletes working and leave the door open to a sync
backend. `repo.ts` is the CRUD layer; migrations in `db.ts` are append-only.

## The content pipeline (build → offline cache)

1. **Build time** (`lib/content/bundle.ts`): each course is resolved into a
   tree and turned into JSON payloads, each stamped with a stable
   `content_hash` (SHA-256 of canonicalized frontmatter + body). Pages embed
   the payloads they need.
2. **Enrollment**: `syncCourseBundle` copies a whole course into IndexedDB.
3. **On every load** (`lib/content/sync.ts`): the embedded hash is compared to
   the cached row's hash — no row → create; hash differs → refresh the
   **content** fields, **preserving progress**; hash matches → cache as-is.

Editing a lesson is therefore safe (progress survives) but renaming its file
is not (the id, and therefore the key, changes).

## Quizzes, tests & grading

The same components serve both assessment kinds:

- `QuestionCard.svelte` renders one question of any type and, after grading,
  the ✓/✗ state and correct-answer highlighting.
- `AssessmentForm.svelte` owns the response array, refuses submission until
  every question is answered, grades via `lib/assessment/grade.ts`, reports
  the outcome to its parent, and offers a retake.
- `LessonApp.svelte` (quiz) persists onto the **lesson** row and completes the
  lesson on first submission — any score completes; the score is recorded for
  the overview. Retakes overwrite the stored submission.
- `TestApp.svelte` (chapter test, its own full-width page at
  `/courses/<course>/<chapter>/test/`) persists onto the **chapter** row and
  stamps `test_completed`.

`grade.ts` is a **pure function** — `(questions, responses, options) →
results + score` — kept free of DOM/DB imports so the subtle rules (effective
option indices with all/none appended, exact-set multi-select, ungraded
short/long answers, unanswered-counts-as-wrong, multi-select partial credit)
are unit-tested in `grade.test.ts`. The `partial_grades` site setting
(astro.config.mjs → Vite define → `lib/assessment/config.ts`) flows in as
`options.partialGrades`; with it on, `score.correct` can be fractional.

Question prompts and flashcard fronts/backs are markdown: rendered at build
time by `lib/content/markdown.ts` (same remark pipeline as lesson bodies,
glossary refs included) into `*_html` fields beside the raw strings.

### Result endpoints & the profile

A quiz/test may declare `result_endpoint` in frontmatter; the payload shape
and POST logic live in `lib/assessment/submit.ts` (pure builders +
`postResults`, tested in `submit.test.ts`). AssessmentForm blocks submission
until the visitor's **profile** (`lib/profile.ts` — name + email in
localStorage, set during onboarding or in Settings) is complete, because the
identity travels as `x-sender-name`/`x-sender-email` headers. Local
completion is deliberately independent of the send: a failed POST keeps the
local grade and offers a retry. This is explicitly *not* a security feature —
answers ship in the page; see the Course Development Guide.

### Contact endpoint

`contactEndpoint` in `astro.config.mjs` is exposed to client code via a Vite
define (`lib/contact.ts`). When non-empty: `FeedbackButton.svelte` renders on
lesson/test pages (subject `Feedback: <lesson> <url>`), and the navbar gains
a Contact link to `/contact/` (custom subject + message via
`ContactApp.svelte`). Both POST form data (`subject`, `message`, optional
sender fields/headers) to the endpoint.

## Code runtimes & database exercises

Code-based exercises live behind an opt-in **runtime** system: sites list
engine ids in `astro.config.mjs` (`runtimes`), a preflight script verifies
the npm packages, and content using a disabled runtime fails the build. The
first shipped kind is **database exercises** — SQL against SQLite-WASM in a
Web Worker, with lite-learner's state-comparison checking, a DB viewer, and
a playground with snapshot persistence and exports.

The second kind is **web exercises** — HTML/CSS/JS-or-TS tabs with a
sandboxed live preview (srcdoc iframe), console capture, Sucrase type
stripping, Emmet, zip/screenshot exports, and a playground tab.

Implementation guides (plumbing, protocols, sequence diagrams, extension
walkthroughs): **[database-runtime.md](database-runtime.md)**
and **[web-runtime.md](web-runtime.md)**. Authoring:
**[database-exercises.md](../user/database-exercises.md)**,
**[web-exercises.md](../user/web-exercises.md)**, and
**[runtimes.md](../user/runtimes.md)**. Roadmap for the deferred
pure-code kind: [../plans/general-code-exams-plan.md](../plans/general-code-exams-plan.md).

## Progress model

Completion is always a **nullable `completed` timestamp**. `lib/progress.ts`
stamps and cascades:

- a lesson completes (quiz submission for exercises, "Mark as read" for
  readings)
- a chapter completes when **every lesson is complete AND its test (if it has
  one) has been submitted** (`test_completed`)
- a course completes when every chapter is complete

Opening a lesson or test stamps `started` up the tree and points
`course.current_chapter` at it, which drives the homepage dashboard and
"Continue" buttons. The courses page aggregates stored quiz/test scores into
the per-course performance overview (overall %, quiz %, test %).

## The glossary

Two halves:

1. **Build time** — `lib/glossary/remark-glossary.mjs` runs over every
   markdown body (config in `astro.config.mjs`, which passes the `base`). It
   reads `src/content/glossary/*.md` once at config load, then rewrites
   `[[slug]]` / `[[slug|display]]` text into
   `<a class="glossary-link" href="…/glossary/slug/" data-term data-short>`.
   Unknown slugs **throw**, failing the build like broken chapter wiring.
   Because the term list is read at config load, **restart the dev server
   after adding a term**. Code blocks and inline code are skipped.
2. **Runtime** — an inline script in `Layout.astro` shows a popover
   (term, short description, "Read more →") on hover/focus and toggles it on
   click, so plain click doesn't navigate away mid-reading; middle-click and
   no-JS fall back to the landing page at `/glossary/<slug>/`.

`/glossary/` lists every term; `/glossary/[term]/` renders the landing page
(which can itself contain `[[links]]`).

## Offline support & PWA

`public/sw.js` precaches every route from the build-time `precache.json`
(generated from the content collections — courses, chapters, lessons, tests,
and glossary pages are all covered automatically), then crawls the cached
HTML/JS/CSS for fingerprinted `/_astro/` assets. Navigations are
network-first; assets are stale-while-revalidate. The worker derives every
path from its registration scope, so it works unchanged under a sub-path
deploy.

## Base-path / sub-path hosting

Every internal link and navigation goes through `href()` in `lib/paths.ts`,
which prefixes `import.meta.env.BASE_URL`. With `base: '/learn-anywhere'` in
`astro.config.mjs` the app serves at `example.com/learn-anywhere/`; set `base`
to `/` to serve at the root. The remark glossary plugin receives the same
`base` via plugin options since markdown can't use `paths.ts`.

## Theming

`styles/theme.css` is two layers: raw `--pal-*` color slots (each a
`light-dark()` pair; "boring" is the app default — Layout.astro ships
`data-palette="boring"` statically — while gruvbox remains the CSS's
attribute-less base palette, with "forrest" as the third choice) and semantic
tokens that reference only `--pal-*`.
Palette and light/dark pins are stored in localStorage
(`learn-anywhere-theme` / `learn-anywhere-palette`) and applied by
`Layout.astro` before first paint.

## Persistence, backups & migrations

- **Backups** (`lib/db/export.ts`): Settings → Backup exports every store as
  one JSON envelope; import clears and reloads the covered stores.
- **Persistent storage** (`persistence.ts`): the app requests the persistent
  IndexedDB bucket so browsers are less likely to evict progress.
- **Schema changes** touch two files together: the entity types + `STORES` in
  `db/types.ts`, and a new appended migration in `db.ts`. Never edit a shipped
  migration.

## Testing

```sh
npm test         # vitest: grade (all question types + edge cases) + resolve (ids/ordering/orphans)
npm run build    # the content-validation gate — schema, wiring, and glossary errors fail here
```

The grader and resolver are deliberately pure so they test without a browser
or `astro:content`. Everything else is validated by the build and by manual
dev-server passes.

## Exporting to Learn Anywhere Builder

```sh
npm run export:builder   # → <site-id>.learn-anywhere-builder.json (gitignored)
# options: -- --id my-site --title "My Site" --out path/to/file.json
```

`scripts/export-to-builder.mjs` packages this site's content as a Learn
Anywhere Builder project file (envelope v2) that the builder's import
accepts. It reads courses/flashcards/glossary frontmatter as authored (run
`npm run build` first — that's the validator), pulls settings from
`astro.config.mjs` (plus the `BASE`/`SITE` env vars) and the site name and
description from `public/manifest.webmanifest`. The theme exports as the
default palette when it's a built-in; anything unrecognized inherits the
builder's `boring` base with the palette's `--pal-*` values carried over as
per-slot overrides. Co-located images are re-homed to the builder's
`<course>/images/` layout with markdown refs rewritten to match (the rewrite
is regex-based, so example refs inside code fences are rewritten too).
