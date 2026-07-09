# Content restructure plan

A plan to move lite-learner's content from three flat, slug-named collections
to a **folder-per-course / folder-per-chapter** layout, and to collapse
`exercises` into a single **`lessons`** concept where a lesson is an exercise
only when it declares a solution — otherwise it's a read-only topic page.

This is a **breaking, cross-cutting change**: it touches the content schema,
the build-time bundler, the routing, the IndexedDB store and progress model,
and every content file. It is best done in one coordinated branch. The sections
below go requirement → concrete changes → ripple effects → migration →
phased checklist.

---

## 1. Goals

1. **Folders.** Each course lives in its own folder; each chapter in its own
   sub-folder. A course's root `index.md` is the course's main page; a
   chapter's `index.md` is that chapter's main page. Lesson files can be named
   anything.

   ```
   src/content/courses/
     sqlite-basics/
       index.md                     ← the COURSE (was courses/sqlite-basics.md)
       what-is-a-database/
         index.md                   ← the CHAPTER (was chapters/what-is-a-database.md)
         count-rows.md              ← a LESSON  (was exercises/db-count-rows.md)
         find-a-record.md           ← a LESSON
       reading-data-with-select/
         index.md
         select-everything.md
         ...
     intermediate-sqlite/
       index.md
       ...
   ```

2. **Lessons, not exercises.** One `lessons` collection. A lesson with a
   `desired_state` (and `initial_sql`) is a **checkable exercise**; a lesson
   without one is a **reading/data page** (prose, optionally with a seeded
   database to explore but no "Check solution").

### Bonus benefits (worth calling out)

- **Slug collisions disappear.** Today every exercise slug must be globally
  unique (we already hit `project-schema`/`project-report` colliding between
  the beginner and intermediate projects). With path-derived ids
  (`sqlite-basics/beginner-project/schema` vs
  `intermediate-sqlite/intermediate-project/schema`) the course/chapter folders
  namespace everything.
- **Co-location.** A chapter and its lessons live together; moving/deleting a
  chapter is a folder operation.
- **Chapters get real pages** (an explicit ask — the chapter `index.md`), which
  today are folded into the course page as `#anchor`s.

---

## 2. Current state (what we're changing)

- **`src/content.config.ts`** — three collections (`courses`, `chapters`,
  `exercises`), each a `glob({ pattern: '**/*.md', base: './src/content/<x>' })`
  with a Zod schema. Cross-links use `reference('chapters')` /
  `reference('exercises')`. **Filename minus `.md` is the id/slug.**
- **`src/lib/content/bundle.ts`** — `loadCourseTrees()` resolves each course's
  `reference()` arrays into a `CourseEntryTree` (throwing on a missing
  reference — this is our build-time validation). `toBundle()` +
  `courseContent()/chapterContent()/exerciseContent()` emit JSON payloads with
  a `content_hash`.
- **`src/lib/content/types.ts`** — `CourseContent` / `ChapterContent` /
  `ExerciseContent`. `ExerciseContent` has required `initial_sql` +
  `desired_state`.
- **`src/lib/content/sync.ts`** — `syncCourse/Chapter/Exercise` reconcile
  embedded content into IndexedDB by `content_hash`, preserving progress.
- **`src/lib/db/types.ts`** — stores `exercises`, `courses`, `chapters` (keyed
  by `id = slug`); `Exercises` row carries `initial_sql`, `desired_state`,
  `user_solution`, `started`, `completed`.
- **`src/lib/progress.ts`** — `markExerciseOpened` / `markExerciseCompleted`
  with a chapter→course completion cascade.
- **Routing** — `src/pages/courses/index.astro`,
  `courses/[course]/index.astro`, `courses/[course]/[chapter]/[exercise].astro`
  (no chapter page). `precache.json.ts` enumerates the same routes.
- **Components** — `ExerciseApp.svelte`, `CourseOverviewApp.svelte`,
  `CoursesApp.svelte`.
- **`INSTRUCTOR_GUIDE.md`** documents the flat layout.

---

## 3. Requirement 1 — folders + `index.md`

### 3.1 Directory layout & id derivation

Move everything under a single base, `src/content/courses/`, and derive the
role from folder depth:

| Path (relative to base)                     | Role    | Derived id                                  |
| ------------------------------------------- | ------- | ------------------------------------------- |
| `sqlite-basics/index.md`                    | course  | `sqlite-basics`                             |
| `sqlite-basics/what-is-a-database/index.md` | chapter | `sqlite-basics/what-is-a-database`          |
| `sqlite-basics/what-is-a-database/count.md` | lesson  | `sqlite-basics/what-is-a-database/count`    |

Keep **three collections**, separated by glob pattern against the shared base
(least churn — course/chapter schemas differ from lessons, and the downstream
code already thinks in three types):

```ts
// src/content.config.ts (sketch)
const base = './src/content/courses';

// Strip the extension, and collapse ".../index" to its directory.
const idFromEntry = (entry: string) =>
  entry.replace(/\.md$/, '').replace(/\/index$/, '');

const courses = defineCollection({
  loader: glob({ base, pattern: '*/index.md', generateId: ({ entry }) => idFromEntry(entry) }),
  schema: z.object({
    title: z.string(),
    chapters: z.array(z.string()),   // leaf folder names, in order (see §3.2)
  }),
});

const chapters = defineCollection({
  loader: glob({ base, pattern: '*/*/index.md', generateId: ({ entry }) => idFromEntry(entry) }),
  schema: z.object({
    title: z.string(),
    lessons: z.array(z.string()),    // leaf file names, in order
  }),
});

const lessons = defineCollection({
  // every .md that is NOT an index file
  loader: glob({ base, pattern: ['**/*.md', '!**/index.md'], generateId: ({ entry }) => idFromEntry(entry) }),
  schema: lessonSchema,              // see §4
});
```

Notes:
- Astro's Content Layer `glob()` accepts an array `pattern` with `!` negations
  (picomatch) and a `generateId` hook — both used above. **Verify** the exact
  `generateId` signature against the installed Astro version during
  implementation; the default id derivation does not reliably strip `index`, so
  we set it explicitly.
- Depth is encoded by the glob (`*/index.md` vs `*/*/index.md`), so a
  mis-placed file simply won't be picked up by the collection it was meant for —
  worth a build-time sanity check (see §8).

### 3.2 References: relative leaf names, resolved in the bundler

Because ids are now path-scoped, `reference('chapters')` would force the course
to list fully-qualified ids (`sqlite-basics/what-is-a-database`) — verbose and
repeats the course prefix. Instead:

- Frontmatter lists **leaf names** relative to the entry's own folder:

  ```yaml
  # sqlite-basics/index.md
  title: Beginner SQLite
  chapters: [what-is-a-database, sql-fundamentals, ...]
  ```
  ```yaml
  # sqlite-basics/what-is-a-database/index.md
  title: What is a Database?
  lessons: [count-rows, find-a-record, tables-overview]
  ```

- Resolution moves fully into **`bundle.ts`**: `loadCourseTrees()` computes each
  child's full id by prefixing the parent's directory
  (`${courseId}/${chapterLeaf}`, `${chapterId}/${lessonLeaf}`), looks it up in
  the loaded collection, and **throws if missing** — preserving today's
  build-fails-on-broken-wiring guarantee (it already throws; we just build the
  id ourselves instead of reading `ref.id`).

  Trade-off: we drop Zod `reference()` (arrays become `z.array(z.string())`) and
  own the existence check. This is the price of clean relative authoring.

- **Alternative (no arrays):** auto-discover children by globbing the folder and
  order them by a frontmatter `order:` number (or a numeric filename prefix).
  Rejected as the default because the user wants lesson files "called whatever"
  (so no numeric prefixes) and explicit arrays keep ordering in one obvious
  place. Mention as a future option.

### 3.3 Chapter pages (new)

The chapter `index.md` should render as a real page. Add
`src/pages/courses/[course]/[chapter]/index.astro` that renders the chapter body
+ a list of its lessons (reuse/trim `CourseOverviewApp`). Update breadcrumbs and
the course overview to link to `/courses/<course>/<chapter>/` instead of
`/courses/<course>/#<chapter>`.

---

## 4. Requirement 2 — lessons (exercise *or* reading)

### 4.1 Schema

```ts
// lessonSchema
const desiredState = z.object({
  query: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())),
});

const lessonSchema = z
  .object({
    title: z.string(),
    initial_sql: z.string().optional(),   // seed DB; optional for pure-prose lessons
    desired_state: desiredState.optional(),// present ⇒ checkable exercise
  })
  .refine((d) => !d.desired_state || d.initial_sql !== undefined, {
    message: 'A lesson with desired_state must also provide initial_sql (the starting DB).',
  });
```

Derived **kind** (computed in `bundle.ts`, not authored):

- `desired_state` present → `kind: 'exercise'` (editor + Run + **Check
  solution**, completion via the state check — today's behaviour).
- `desired_state` absent, `initial_sql` present → `kind: 'reading'` with an
  explorable database (prose + editor/Run + DB viewer, **no** Check).
- neither → `kind: 'reading'`, prose only (no engine island needed).

### 4.2 Content payload & completion semantics

`ChapterContent.exercises` → `lessons`; `ExerciseContent` → **`LessonContent`**
with `initial_sql?`, `desired_state?`, and a required `kind`.

Completion:
- **Exercise lessons** complete on a passing solution check (unchanged).
- **Reading lessons** need a non-check path to "done". Recommended: a
  **"Mark as read"** button that stamps `completed` (intentional, not on mere
  page load). The chapter→course cascade then treats every lesson uniformly
  (all complete ⇒ chapter complete). Keep the "mark on open" option in mind as
  a lighter alternative, but a button avoids marking things read that were only
  glanced at.

---

## 5. Downstream changes, file by file

| File | Change |
| --- | --- |
| `src/content.config.ts` | New base + three glob patterns + `generateId`; `reference()` → `z.array(z.string())`; merged `lessonSchema` with optional `initial_sql`/`desired_state` + refine. |
| `src/lib/content/bundle.ts` | Resolve hierarchy from relative leaf arrays (build full ids, throw on missing); rename `exerciseContent`→`lessonContent`; add derived `kind`; `CourseEntryTree`/`CourseBundle` use `lessons`. Content hash unchanged (still `canonicalize({body,data})`). |
| `src/lib/content/types.ts` | `ExerciseContent`→`LessonContent` (`initial_sql?`, `desired_state?`, `kind`); `ChapterContent.exercises`→`lessons`. |
| `src/lib/content/sync.ts` | `syncExercise`→`syncLesson`; persist optional SQL fields + `kind`; `syncCourseBundle` iterates `lessons`. |
| `src/lib/db/types.ts` | Rename `Exercises`→`Lessons` type; `initial_sql?`/`desired_state?` optional; add `kind`; `Chapters.exercises`→`lessons`. Store key: **keep the physical store name `exercises`** to avoid an object-store rename, or rename to `lessons` via a migration (see §6). |
| `src/lib/db/db.ts` | Add the next migration (store rename if chosen; otherwise a clear of content-derived rows — see §6). Bump `DB_VERSION` via the appended migration. |
| `src/lib/progress.ts` | `markExercise*`→`markLesson*`; cascade counts all lessons; add `markLessonRead` (or fold into a generic "complete" for reading lessons). |
| `src/lib/sql/comparator.ts` | Unchanged (`DesiredState` still drives checks) — only its callers move. |
| `src/pages/courses/index.astro` | `exerciseCount`→`lessonCount` (or split "exercises vs reading"); course id is now the folder (`tree.course.id` = `sqlite-basics`), unchanged shape. |
| `src/pages/courses/[course]/index.astro` | Link chapters to their own pages; counts by lesson/kind. |
| `src/pages/courses/[course]/[chapter]/index.astro` | **New** — chapter overview page. |
| `src/pages/courses/[course]/[chapter]/[exercise].astro` | Rename dir to `[lesson].astro`. **Derive leaf params from full ids** (`course`, `chapter`, `lesson` = last path segments) so URLs stay `/courses/<course>/<chapter>/<lesson>/`. Render `LessonApp` and branch on `kind`. prev/next still walks the flattened course. |
| `src/pages/precache.json.ts` | Emit course, **chapter**, and lesson routes; derive leaf path segments from ids. |
| `src/components/exercise/ExerciseApp.svelte` | → `LessonApp.svelte`: branch on `kind`. Exercise: today's flow. Reading+`initial_sql`: seed, show editor/Run/DB viewer, hide Check, show "Mark as read". Reading-only: prose + "Mark as read", skip the SQL worker entirely. |
| `src/components/course/CourseOverviewApp.svelte` | `exercises`→`lessons`; badge exercise vs reading; link to chapter pages. |
| `src/components/apps/CoursesApp.svelte` | Counts wording. |
| `INSTRUCTOR_GUIDE.md` | Rewrite for folders + `index.md` + lessons (exercise vs reading), new authoring rules. |
| `courses.md` (plan doc) | Optional: note the reading-lesson opportunities (the conceptual chapters — "What is a Database?", the WAL chapter — are natural reading lessons). |

---

## 6. Progress & IndexedDB migration (the risky part)

**Progress is keyed by `id` (= slug).** Ids change from flat (`db-count-rows`)
to path-scoped (`sqlite-basics/what-is-a-database/count-rows`), so **existing
per-lesson progress cannot be matched to the new ids** and will orphan
regardless of how carefully files are renamed.

Options:

1. **Accept a progress reset (recommended for this MVP).** Add a migration that
   clears the content-derived stores (there is precedent: migration v2 already
   `clear()`s all stores on the content-backed reshape). Rows are rebuilt from
   the embedded content on next visit by the sync layer. Simplest, honest,
   low-risk.
2. **Best-effort remap.** Ship a one-off map from old flat slug → new path id
   and rewrite keys in the migration. More code, only worth it if real user
   progress must survive — unlikely here.

Store rename:
- If renaming the physical store `exercises`→`lessons`: IndexedDB can't rename a
  store, so the migration creates `lessons`, (optionally copies), deletes
  `exercises`. Combined with option 1, just **create `lessons` fresh and drop
  `exercises`**.
- To minimise churn, you may instead **keep the store named `exercises`** and
  only rename the TypeScript types — but a clear is still needed for the id
  change. Recommend the clean rename since we're already migrating.

Remember: `STORES` in `db/types.ts` drives store creation (v1) and the
export/import + sync flows. Update it consistently, and confirm
`src/lib/db/export.ts` (which iterates `STORES`) still round-trips.

---

## 7. Content migration (moving the files)

Mechanical, scriptable:

1. For each existing course `courses/<c>.md` → `courses/<c>/index.md`.
2. For each chapter it lists, `chapters/<ch>.md` →
   `courses/<c>/<ch>/index.md`, and rewrite its `exercises:` array to
   `lessons:` with **leaf** names.
3. For each exercise, `exercises/<ex>.md` → `courses/<c>/<ch>/<leaf>.md`. Pick
   clean leaf names now that they're folder-scoped (e.g. drop the `db-` prefix
   from `db-count-rows` → `count-rows`; the beginner/intermediate `project-*`
   collisions can both become `schema`/`report`).
4. Rewrite the course `index.md` `chapters:` array to leaf folder names.
5. Delete the old flat `courses/`, `chapters/`, `exercises/` directories.
6. A short Node script can do 1–5 by reading current frontmatter arrays to know
   the course→chapter→exercise mapping (the arrays already encode order).

There are three courses, ~30 chapters, ~110 lessons — worth scripting rather
than hand-moving, then eyeballing a diff.

---

## 8. Validation & testing

- `npm run build` remains the gate: schema failures and (now bundler-side)
  missing-reference throws fail the build. Add explicit, friendly errors in
  `loadCourseTrees` for: a course/chapter `index.md` missing, a listed leaf not
  found, a `desired_state` without `initial_sql` (covered by the schema
  refine), and a lesson file that no chapter lists (orphan — warn or fail).
- Keep the existing `comparator.test.ts`; add a small unit test for
  `idFromEntry` and for the relative-leaf → full-id resolver.
- Manual: dev-serve, open a course → chapter page → an exercise lesson (checks
  still pass) and a reading lesson (prose renders, "Mark as read" completes and
  cascades).
- Re-run the SQLite-authoring validation habit (validate every `desired_state`
  against the real wasm build) is unaffected — only file locations change.

---

## 9. Risks & edge cases

- **`generateId` behaviour** varies across Astro versions; pin it down first
  (spike: log the ids the loader produces for a sample folder tree).
- **`reference()` removal** means we lose Zod's automatic ref validation;
  compensate with explicit throws in the bundler (already the pattern) and
  tests.
- **Ordering** now lives only in the `index.md` arrays; an author who adds a
  lesson file but forgets to list it gets an orphan — make that a build warning.
- **Reading-lesson completion** semantics affect the cascade; decide button vs
  auto-open before wiring `progress.ts` so chapter/course completion stays
  meaningful.
- **URL stability.** Deriving leaf params keeps `/courses/<c>/<ch>/<lesson>/`
  URLs, but individual lesson leaves may be renamed during the move (§7) —
  acceptable given progress resets anyway; avoid churning leaf names after this
  lands.
- **Service worker precache** must include the new chapter routes or they won't
  be offline-available.

---

## 10. Phased implementation checklist

1. **Spike** the loader: create one sample course folder, confirm `generateId`
   + glob patterns produce the ids in the §3.1 table. Adjust `generateId`.
2. **Schema + bundler.** Rewrite `content.config.ts` (3 collections, string
   arrays, `lessonSchema`); rewrite `bundle.ts` resolution (relative-leaf →
   full id, throw on missing, derive `kind`); rename types in
   `content/types.ts`.
3. **Migrate content** with a script (§7); delete old dirs. Build until green.
4. **Persistence.** Update `db/types.ts` + `STORES`, add the DB migration
   (create `lessons`, drop `exercises`, clear content-derived rows), update
   `sync.ts` and `progress.ts` (add reading-lesson completion).
5. **Routing.** Rename `[exercise].astro`→`[lesson].astro` with leaf-param
   derivation; add the chapter `index.astro`; update `courses/index.astro`,
   `[course]/index.astro`, `precache.json.ts`.
6. **Components.** `ExerciseApp`→`LessonApp` (branch on `kind`);
   `CourseOverviewApp` (lessons + chapter links + kind badges); `CoursesApp`.
7. **Docs.** Rewrite `INSTRUCTOR_GUIDE.md`.
8. **Verify.** `npm run build`, `npm test`, and a dev-server pass over an
   exercise lesson and a reading lesson (light + a couple of palettes for
   good measure).

---

## 11. Example: one authored chapter, after

```
src/content/courses/sqlite-basics/what-is-a-database/
├── index.md
├── count-rows.md
├── find-a-record.md
└── what-is-a-table.md        ← a NEW reading lesson (no desired_state)
```

```markdown
<!-- index.md (chapter) -->
---
title: What is a Database?
lessons: [what-is-a-table, count-rows, find-a-record]
---
Before writing much SQL, get a feel for what a database actually is…
```

```markdown
<!-- what-is-a-table.md (reading lesson: prose + explorable DB, no check) -->
---
title: "Tables, rows, and columns"
initial_sql: |
  CREATE TABLE movies (id INTEGER PRIMARY KEY, title TEXT, year INTEGER);
  INSERT INTO movies (title, year) VALUES ('Inception', 2010), ('Parasite', 2019);
---
A **table** is like a named spreadsheet… Poke at the `movies` table below.
```

```markdown
<!-- count-rows.md (exercise lesson: has desired_state ⇒ checkable) -->
---
title: "Rows are records: counting them"
initial_sql: |
  CREATE TABLE movies (id INTEGER PRIMARY KEY, title TEXT);
  INSERT INTO movies (title) VALUES ('Inception'), ('Parasite');
desired_state:
  query: "SELECT movie_count FROM answer;"
  rows:
    - { movie_count: 2 }
---
## Your task
Save the movie count into `answer`…
```

The first is a reading page; the second is an exercise — same collection, same
file shape, distinguished only by whether a solution is declared.
