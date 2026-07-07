# Lite Learner

Lite Learner is a statically generated learning management system that gives you an
interactive in-browser way to learn SQLite. The project was bootstrapped using
local-sync-template and is a static Astro + Svelte frontend that stores the user's
progress in IndexedDB.

## What the scaffold provides

local-sync-template created this scaffold and wired up the persistence layer. The
existing code is a **starting point** — a good foundation for how user data is
persisted and managed entirely on the client.

Every entity carries bookkeeping fields — `id`, `updated_at`, `deleted_at`, and
`server_seq`. These are largely irrelevant to this project (there is no sync
backend) and should be **left alone** so soft deletes keep working and a sync
backend could be added later without a data migration.

The scaffold currently ships three stores (`courses`, `chapters`, `exercises`).
The data model below reshapes them; Phase 1 implements that reshape.

## Data model

The app has two distinct kinds of data, and keeping them straight is the most
important design decision in the project:

- **Content** — titles, descriptions, `initial_sql`, `desired_state` — is authored
  as markdown, validated by Astro content collections, and baked into the static
  bundle at build time.
- **Progress** — `started`, `completed`, `current_chapter`, `user_solution` — is
  per-visitor and lives only in IndexedDB.

Content is *copied* into IndexedDB on enrollment (so the app works offline and
progress sits next to the content it describes), and kept fresh with a content
hash (see below).

### Content collections (authored, static)

Three collections, all markdown (the body is the description). Solutions are
**embedded in the exercise** rather than living in a separate collection.

- **courses** — `src/content/courses/*.md`
  - `title` (string)
  - `chapters` (array of `reference('chapters')`): the chapters in this course.
    **Array order is the chapter order** — there is no separate `order` field.
  - body markdown: the course description
- **chapters** — `src/content/chapters/*.md`
  - `title` (string)
  - `exercises` (array of `reference('exercises')`): the exercises in this
    chapter. **Array order is the exercise order.**
  - body markdown: the chapter description
- **exercises** — `src/content/exercises/*.md`
  - `title` (string)
  - `initial_sql` (string): the starting content that seeds the exercise, and the
    value the exercise resets to
  - `desired_state` (object): the embedded solution, typed as
    `{ query: string; rows: Record<string, unknown>[] }`. `query` is run against
    the user's DB and the result is compared to `rows` to decide completion.
  - body markdown: the exercise description

`desired_state` supports two idioms:

- **Checking only specific fields.** For `SELECT age FROM users ORDER BY age;` the
  solution is `{ "query": "SELECT age FROM users ORDER BY age;", "rows": [{"age":21},{"age":30}] }`.
  Only the listed columns matter — other columns in the result rows are ignored.
- **Inspecting tables.** The query can be a pragma, e.g.
  `PRAGMA table_info('table_name');`, and `rows` describes the expected schema.

Because everything is static, `desired_state` ships to the browser and the answer
is inspectable. That is **fine** — this project is a learning tool, not an
accredited assessment, so being able to "cheat" is acceptable.

### Using `reference()`

Cross-collection links use Astro's [`reference()`](https://docs.astro.build/en/guides/content-collections/#defining-collection-references)
helper in the Zod schema:

```ts
// courses schema
chapters: z.array(reference('chapters'))
// chapters schema
exercises: z.array(reference('exercises'))
```

This gives us two things for free:

1. **Build-time validation** — a referenced slug that doesn't exist fails the
   build, so broken course/chapter/exercise wiring never ships.
2. **Query-time resolution** — `getEntry()` (or `getEntries()`) turns a reference
   into the target entry when rendering.

The array position is the authoritative ordering, so no `order`/`sequence` field
is needed anywhere.

### IndexedDB (progress + cached content)

Content-backed rows are **keyed by the content slug** (stable across builds), not a
generated UUID — that stable key is what lets the hash check below find the right
row. The `id`/`updated_at`/`deleted_at`/`server_seq` bookkeeping fields stay as-is.

- **courses**: `content_hash`, cached content (`title`, `description`,
  `chapters[]`), progress (`current_chapter`, `started`, `completed`)
- **chapters**: `content_hash`, cached content (`title`, `description`,
  `exercises[]`), progress (`started`, `completed`)
- **exercises**: `content_hash`, cached content (`title`, `description`,
  `initial_sql`, `desired_state`), progress (`user_solution`, `started`,
  `completed`)

`completed` is a nullable timestamp and is the **only** completion field — a
boolean "is complete" is derived from `completed != null`. (The scaffold's extra
`complete` boolean is dropped.)

### Content caching & invalidation (content hash)

Content is cached into IndexedDB so the app runs offline, but caches must not go
stale when the course is re-authored and redeployed. We detect staleness with a
content hash instead of trying to reconcile by slug alone:

- At build time, each course/chapter/exercise page **emits a `content_hash`** — a
  stable hash of that entry's content (frontmatter + body).
- Each cached row stores the `content_hash` it was built from.
- On load, compare the page's emitted hash to the cached row's hash:
  - **No row** → create it from the embedded content.
  - **Hash differs** → overwrite the cached **content** fields from the embedded
    content and update the stored hash, **preserving progress fields**
    (`started`, `completed`, `user_solution`, `current_chapter`).
  - **Hash matches** → use the cache as-is.

### Validation & coercion rules

To check an exercise, run `desired_state.query` against the user's current
in-memory DB and compare the returned rows to `desired_state.rows`.

Every solution query is authored with an explicit `ORDER BY`, so comparison is
**positional and unambiguous** — the author guarantees exact row count and order,
and the checker does no set-reconciliation, dedup, or multi-answer handling.

Rules:

- **Row count** — the result must have exactly `rows.length` rows; fewer or more
  fails.
- **Column subset** — for each row, only the keys present in the expected object
  are compared; extra columns in the result are ignored.
- **Positional** — expected row `i` is compared to result row `i`.
- **Value coercion** (the expected value drives the comparison):
  - `null` → matches SQLite `NULL` only (result value `null`/`undefined`).
  - **number** → normalize the result with `Number()` (covers `BigInt` INTEGERs
    and REAL). Integers compare exactly; REAL compares within an epsilon
    (`Math.abs(a - b) <= 1e-9`). Values beyond 2^53 are out of scope.
  - **boolean** → SQLite has no boolean type; compare `Number(result)` to
    `expected ? 1 : 0`.
  - **string** → strict equality against the result value as returned (TEXT →
    string). No trimming, case-sensitive, no number↔string coercion.
  - **BLOB** → out of scope for the example course; not supported by the comparator.

This comparator is a pure function `(expectedRows, actualRows) => boolean` — it
should be **unit-tested in isolation**, since that is where the subtle bugs live.

## How it should be used

From the teacher's perspective:

1. Author a course as three kinds of markdown files (courses, chapters, exercises)
   under `src/content/`. A course's frontmatter lists its chapters in order; a
   chapter's frontmatter lists its exercises in order; an exercise's frontmatter
   carries its `initial_sql` and its `desired_state` solution. The markdown bodies
   are the descriptions.
2. Run `npm run build` to statically generate a page for every course, chapter,
   and exercise.
3. Deploy `dist/` to any static host.

From the user's perspective:

1. Browse the course listing.
2. Open a course overview page.
3. Enroll — the course's content is cached into IndexedDB (see content-hash
   invalidation).
4. Work through the chapters and their exercises. Each exercise runs against an
   in-browser SQLite DB and is validated against its `desired_state`.
5. Progress — started/completed, current position, and in-progress editor buffers
   — persists in IndexedDB and survives reloads and offline use.

# Phase 0 (Experimentation)

De-risk the engine **before** authoring content around it. Build a throwaway spike
page that proves the risky pieces work together:

- [x] Load SQLite WASM in a Web Worker and instantiate a fresh in-memory DB
- [x] Run a seed script (`initial_sql`), then a user query, and render the rows in
      a scratch DB viewer
- [x] Validate a statement with `prepare()` and bubble the thrown error to the UI
      (note learned: prepare resolves table names against the *current* schema, so
      a buffer that creates a table and then queries it fails prepare-only
      validation until the create has run — Run just executes and bubbles errors;
      Validate is a separate prepare-only action)
- [x] Run a `{ query, rows }` solution check through the coercion comparator
- [ ] Confirm the whole flow works **offline** via the service worker
      (precache verified complete — all 28 assets incl. sqlite3.wasm, the worker
      chunk, and /spike/ are in the SW cache after install, and the SW serves
      cache-first on network failure; the final human check is toggling DevTools
      offline and reloading /spike/)
- [x] Confirm CodeMirror 6 + a SQL mode bundles cleanly and works offline
- [x] Confirm in-memory mode avoids the COOP/COEP header requirement
      (`crossOriginIsolated === false` and the engine runs fine)

# Phase 1 (Schema finalization and content)

- [x] Reshape the IndexedDB schema (`src/lib/db/types.ts` + a new appended
      migration in `src/lib/db/db.ts`)
    - [x] Key content-backed stores by slug and add `content_hash`
    - [x] Add `title` to courses, chapters, and exercises
    - [x] Replace the `chapters.course` FK with parent-holds-ordered-children
          arrays: `courses.chapters[]`, `chapters.exercises[]`
    - [x] Drop the redundant `complete` boolean (derive from `completed`)
    - [x] Type `desired_state` as `{ query: string; rows: Record<string, unknown>[] }`
- [x] Define the three [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
      and their Zod schemas, using `reference()` for the chapter/exercise arrays
- [x] Implement the content-hash emit + IndexedDB cache-invalidation flow
      (`src/lib/content/bundle.ts` emits at build time, `src/lib/content/sync.ts`
      reconciles client-side; /courses/ wires it end to end and resolves the
      reference() arrays at build time so broken slugs fail the build)
- [x] Scaffold an example course teaching the basics of SQLite
    - [x] 2 chapters
        - [x] Creating a table
            - [x] Exercise 1 — `CREATE TABLE`
            - [x] Exercise 2 — idempotency: `CREATE TABLE IF NOT EXISTS` and
                  re-runnability in schema files
        - [x] Creating and querying content
            - [x] Exercise 1 — creating a row: `INSERT INTO`
            - [x] Exercise 2 — reading a row: `SELECT` (checkable via
                  `CREATE TABLE adults AS SELECT …`, since validation inspects
                  DB state rather than the query text)

# Phase 2

- [x] Build out the course listings page that shows off the available courses
      (`/courses/` — static course facts + a progress island)
- [x] Build out the course overview page (`/courses/{course}/` — statically
      rendered description, enroll button, per-chapter progress)
- [x] Build out the chapter overview page (`/courses/{course}/{chapter}/`)
- [x] Build out the exercise page
      (`/courses/{course}/{chapter}/{exercise}/` — implements the on-load
      sequence: fresh DB → seed → restore buffer without executing (warning
      banner) → viewer on first table → stamp started → surface completed)
    - [x] Build out the exercise editor component (`SqlEditor.svelte`)
        - [x] CodeMirror 6 text editor with SQL syntax highlighting
        - [x] Surface syntax/validity errors by `prepare()`-ing statements against
              SQLite WASM and bubbling up any thrown error (the engine is the
              source of truth, not an editor linter)
        - [x] Build out the DB viewer component (`DbViewer.svelte`)
    - [x] Implement solution validation using the coercion comparator above
          (passing cascades completion: exercise → chapter when all its
          exercises are done → course when all chapters are done;
          `src/lib/progress.ts`)
- [x] (supporting) `precache.json` endpoint generated from the collections so
      the service worker precaches every course/chapter/exercise page — new
      content is offline-capable without touching `sw.js`

# Phase 3

- [x] Build out the user onboarding flow (first-visit gate → learner-focused
      welcome → persistent-storage request → lands on the course listing)
- [x] Build out the per-course onboarding/enrollment flow (Enroll on the course
      overview copies the whole bundle into IndexedDB via the content-hash
      sync; chapters stay unlinked until enrolled; deep links to
      chapter/exercise pages self-sync so shared URLs still work)

# Technical requirements

- **Completely static** — build and deploy the files to any static host provider.
- Astro powers the generation.
    - **Three** content collections, all markdown:
        1. **courses** — `title`, ordered `chapters` references, description body
        2. **chapters** — `title`, ordered `exercises` references, description body
        3. **exercises** — `title`, `initial_sql`, embedded `desired_state`
           solution, description body
    - The `desired_state` solution has a `query` that is run and a `rows`
      representation of what it should produce, supporting subset-of-columns
      checks and pragma inspection (see Data model → Validation & coercion rules).
- Svelte for reactivity.
    - Use Svelte 5 with runes.
- IndexedDB persists user state.
- An in-browser editor for exercises that lets you write SQL, execute it against an
  in-memory SQLite WASM DB, and visually explore the DB state.
    - **[CodeMirror 6](https://codemirror.net/)** as the in-browser SQL editor —
      chosen over Monaco because it is a fraction of the size, bundles cleanly with
      Vite/Astro, and works offline without an AMD loader or worker setup.
        - Validity errors come from `prepare()`-ing statements in SQLite WASM and
          surfacing the thrown error, not from an editor-side SQL linter.
    - [sqlite-wasm](https://github.com/sqlite/sqlite-wasm) as the exercise engine,
      run in a **Web Worker** so a slow or looping query never freezes the editor.
    - **Stay in-memory (no OPFS).** OPFS-backed persistence needs
      `SharedArrayBuffer`, which requires cross-origin isolation
      (`Cross-Origin-Opener-Policy: same-origin` +
      `Cross-Origin-Embedder-Policy: require-corp`) headers that many static hosts
      won't let you set. A fresh in-memory DB per exercise sidesteps that entirely
      and keeps deployment host-agnostic.
    - A custom DB viewer that shows your columns, their datatypes, the first 50
      rows, and the ability to move between the tables that exist in the DB.
    - On exercise load:
        1. Instantiate a fresh in-memory SQLite DB (blank file).
        2. Run `exercise.initial_sql` to seed the exercise.
        3. Restore the editor buffer from `exercise.user_solution` if it exists —
           **but do not execute it.** In-memory DB state is the sum of every
           statement ever run, which a single stored buffer cannot reproduce, and
           auto-running a half-finished buffer could throw. Instead show a
           **warning banner**: the database has been reset, re-run your statements
           to restore its state.
        4. Open the DB viewer on the first table found:
           `SELECT tbl_name FROM sqlite_master WHERE type='table' ORDER BY name LIMIT 1;`
        5. If `exercise.started` is null, set it to the current time.
        6. If `exercise.completed` is set, indicate the exercise is completed.
    - Allow the user to reset, which discards the in-memory DB, clears
      `exercise.user_solution`, and re-runs the startup process.
- After initial load the app must function **fully offline**. A service worker
  caches all page contents, JS, CSS, etc. needed to use every page normally; when a
  connection is available it looks for updates, otherwise it serves from cache.
    - Thread Astro's configured `base` through the service worker so precache
      paths resolve correctly on subpath deploys (e.g. GitHub Pages under
      `/repo/`). **Done** — `sw.js` derives every path from its registration
      scope (which is the base, since the worker lives at `${base}/sw.js`), and
      the Layout registers it via `import.meta.env.BASE_URL`.
