# Coding Exams — Implementation Plan

Adds three new **code-based exercise kinds** alongside the existing quiz/test
system: **database** (SQL against an in-browser engine, ported from
lite-learner), **web preview** (HTML/CSS/JS-or-TS with a live preview), and
**pure code** (WASM language runtimes evaluated in a terminal). Each kind can
appear as a lesson exercise *or* a chapter test, brings a playground, and
respects the platform's constraints: fully static, offline-first, no backend.

This is a plan only — nothing here is implemented. Phases are ordered so each
one ends with something runnable and testable.

---

## 1. Where we are today (what the plan builds on)

- A lesson's kind is **derived from frontmatter**: `quiz:` present ⇒ exercise,
  absent ⇒ reading. Chapters may declare `test:`. Both are arrays of the five
  question types, graded by the pure `lib/assessment/grade.ts`
  (`Score = { correct, gradable }`), rendered by `AssessmentForm`/`QuestionCard`.
- **Storage**: IndexedDB rows keyed by content slug, each half cached-content /
  half progress, reconciled by `content_hash` (progress always survives content
  edits). Migrations in `lib/db/db.ts` are append-only (currently v1).
- **Site settings** flow from `astro.config.mjs` consts → Vite `define` →
  `import.meta.env.PUBLIC_*` (`contactEndpoint`, `partial_grades`). This is the
  established pattern for the new `runtimes` setting.
- **Offline**: `precache.json` is generated from the content collections; the
  service worker precaches routes then crawls for `/_astro/` assets.
- **lite-learner** (sibling repo, same ancestry) already implements the
  database kind end to end: CodeMirror 6 SQL editor themed from the
  `--editor-*`/`--syntax-*` CSS tokens (which learn-anywhere's `theme.css`
  still defines — the port is cheaper than it looks), a SQLite-WASM Web Worker
  with a small promise protocol (`reset`/`exec`/`validate`/`listTables`/
  `tableData`/`dump`/`serialize`/`exportJson`), a positional row comparator
  (`desired_state.query` + expected `rows`), a DB viewer, and a playground with
  its own IndexedDB store. `lite-learner/Development Guide.md` documents all of
  it.

---

## 2. Cross-cutting design (decided up front, built in Phase 0)

### 2.1 Exercise kinds in frontmatter

A lesson declares **at most one** assessment block; kind stays derived, never
authored. Chapters mirror this for tests. `quiz:`/`test:` keep their exact
current shape — existing content is untouched.

```yaml
# Lesson variants (mutually exclusive — zod refinement enforces "at most one")
quiz:      [...]                 # existing
database:  { runtime: sqlite, initial_sql: ..., desired_state: ... }
web:       { starter: { html: ..., css: ..., js: ... } }   # or ts:
code:      { runtime: python, starter: ..., evaluation: ... }

# Chapter variants (same rule; `test:` keeps its current questions-array shape)
test:           [...]            # existing
test_database:  { ... }          # same object shapes as the lesson blocks
test_web:       { ... }
test_code:      { ... }
```

Derived kinds: `reading | exercise | database | web | code` (lessons) and the
test analogs on chapters. `LessonContent`/`ChapterContent` payloads carry the
block; `content_hash` covers it automatically (it hashes raw frontmatter), so
re-authoring an exercise refreshes caches without touching progress.

### 2.2 Runtime registry + dependency gating

Requirement: "some method to tell the system that a site will need the
dependencies installed."

- `astro.config.mjs`:

  ```js
  // Which code runtimes this site ships. Each entry needs its npm package
  // installed (see docs/user/runtimes.md). Empty = no code exercises.
  const runtimes = []; // e.g. ['sqlite', 'web', 'python']
  ```

  Exposed via Vite define as `PUBLIC_RUNTIMES` (JSON array), read by
  `lib/runtimes/config.ts`.

- **Registry** (`lib/runtimes/registry.ts`): maps runtime id → lazy adapter
  loader. Only enabled runtimes are reachable, so Vite tree-shakes/never
  bundles disabled ones; heavy packages stay in `devDependencies`-style
  opt-in installs (documented per runtime), NOT in the base `package.json`.

- **Build-time validation** (in `lib/content/bundle.ts`, where wiring is
  already validated): any lesson/chapter using `database|web|code` whose
  `runtime` is not in `PUBLIC_RUNTIMES` **fails the build** with a message
  naming the file, the runtime, and the install command. This is the same
  fail-fast philosophy as orphaned lessons and unknown glossary terms.

- **Preflight script** (`scripts/check-runtimes.mjs`, run at the start of
  `build`/`dev` via npm pre-scripts): for each enabled runtime, try to resolve
  its package(s); print a friendly `npm install <pkg>` hint on failure instead
  of a Vite resolution stack trace.

### 2.3 Adapter interface (extensibility contract)

Everything runtime-specific lives behind one interface so new runtimes (pglite,
ruby.wasm, …) are additive:

```ts
// lib/runtimes/types.ts (sketch)
export interface RuntimeAdapter {
  id: string;                      // 'sqlite' | 'python' | ...
  label: string;                   // 'SQLite', 'Python 3.12 (Pyodide)'
  kind: 'database' | 'code';       // 'web' is a singleton, not an adapter
  editorLanguage(): Promise<LanguageSupport>;   // CodeMirror lang package
  createSession(): Promise<RuntimeSession>;     // usually wraps a Worker
  precacheAssets?(): string[];     // extra URLs for precache.json (e.g. pyodide files)
}

export interface RuntimeSession {
  // The process model: mount files, run, get streams + an exit code.
  run(files: Record<string, string>, argv?: string[]): Promise<RunResult>;
  reset(): Promise<void>;
  destroy(): void;
  // database-kind extras (lite-learner protocol): exec/validate/listTables/
  // tableData/dump — expressed as an optional DatabaseSession sub-interface.
}

export interface RunResult {
  exitCode: number;                // non-zero = failure (the base contract)
  stdout: string;                  // streamed to the terminal as it arrives
  stderr: string;
}
```

### 2.3b The process model: WASI first, WebContainers rejected

The pure-code kind is built on a **process abstraction**: mount the learner's
source (plus author test files) into a virtual filesystem, spawn, pipe
stdout/stderr to the terminal, and read the **exit code** — non-zero fails.

- **WASI** (the WebAssembly System Interface — an actual spec) delivers
  exactly this: argv, env, virtual FS, stdio, exit code. Interpreters compiled
  to `wasm32-wasi` exist for Python (CPython-WASI), JS (QuickJS), Lua, Ruby,
  PHP. They run in a plain Web Worker via a small MIT shim
  (`@bjorn3/browser_wasi_shim`) — **no SharedArrayBuffer, no COOP/COEP
  headers, fully offline** once assets are cached.
- Consequence for extensibility: alongside bespoke adapters, ship a **generic
  WASI adapter** where a runtime is *configuration, not code* — a `.wasm` URL
  + an invocation template (`python /work/main.py`). Adding many runtimes
  becomes "drop in a binary and a registry entry."
- **WebContainers (StackBlitz) — evaluated and rejected** for the core:
  it has the perfect process API (`spawn` → output stream + exit promise) but
  (a) it's a **Node-only** micro-OS — no Python/Go/Rust, so it only covers the
  languages a plain worker already handles; (b) it's **proprietary with a
  commercial license**, wrong for a fork-and-deploy-anywhere platform;
  (c) it **requires COOP/COEP** (SharedArrayBuffer), which many static hosts
  (GitHub Pages) cannot set and which this project deliberately avoids;
  (d) boot + npm installs want the network, weakening offline-first. It could
  become an optional adapter later for Node-ecosystem exercises on sites that
  accept those trade-offs, but nothing in the core may depend on it.
- Compiled languages (Go/Rust/C) are unchanged by any of this: WASI runs
  compiled artifacts; the *compilers* still don't practically run in-browser.

### 2.4 Language-agnostic unit-test evaluation: exit codes, then TAP

Two evaluation tiers, both language-agnostic because they ride on the process
model:

1. **Exit code** (the base tier): run user code + author tests as a process;
   exit 0 = pass, non-zero = fail. Zero per-language machinery — any test
   framework in any language already behaves this way. Score: 1/1.
2. **TAP** (the granular tier): parse the **Test Anything Protocol** from
   stdout for a per-test n/m score — plain text, trivially emitted from any
   language, parsed once in `lib/runtimes/tap.ts`:

```
1..3
ok 1 - add() handles positives
not ok 2 - add() handles negatives
ok 3 - add() handles zero
```

- Authors write test code *in the exercise's language*; each adapter ships a
  tiny TAP shim (Python: ~20-line helper prepended to test code; JS: same).
- The parser maps results straight onto the existing `Score`
  (`correct/gradable`) and per-question-style pass/fail rows, so the score UI,
  course overview aggregation, and `result_endpoint` submissions all work
  unchanged.
- Alternative `evaluation.mode: output` (normalized stdout comparison) covers
  "print the right thing" exercises without test code.

### 2.5 Storage (IndexedDB)

- New progress fields on `Lessons` (mirrored as `test_*` on `Chapters`):
  - `solution: string | Record<string,string> | null` — the editor buffer(s):
    SQL string (database), `{ html, css, js|ts }` (web), source string (code).
  - `solution_score: Score | null` — TAP/output results (code kind only;
    database is pass/fail via `completed`).
  - Row fields on schemaless IDB need **no migration**; `sync.ts` just gains
    defaults, and backup export/import covers them automatically.
- **Migration v2**: add the `playground` store (lite-learner's v3, adapted) —
  keyed by runtime id instead of a singleton, so each runtime keeps its own
  buffer/snapshot: `{ id: runtimeId, buffers: Record<string,string>, snapshot: string | null, updated_at }`.
- Solutions follow lite-learner's restore rule: **restored but never
  auto-executed** (a stored buffer can't reproduce accumulated engine state; a
  banner tells the learner to re-run).

### 2.6 Playground shell

`/playground/` page (restoring the navbar slot lite-learner had):

- Built only when `runtimes` is non-empty; nav link hidden otherwise (same
  pattern as Contact).
- A **runtime switcher** (tabs) across every enabled runtime, including `web`.
  Each adapter/kind supplies its own playground island; the shell owns the
  switcher + per-runtime persistence.
- Requirement 4 ("switch between them if multiple languages are installed") is
  satisfied here.

### 2.7 Offline / PWA

- Editor + engine JS chunks land in `/_astro/` and are picked up by the
  service worker's existing crawl.
- Multi-file runtimes (Pyodide is ~10–200 MB depending on packages) expose
  `precacheAssets()`; `precache.json.ts` appends them. **Open decision** (see
  §8): precaching huge runtimes should likely be opt-in per site
  (`precacheRuntimes: boolean` config) to avoid blowing up first-visit cost.
- Like lite-learner, database engines stay **in-memory only** (no OPFS) so no
  COOP/COEP headers are required and any static host works.

### 2.8 Completion & scoring semantics

| Kind      | Completes when…                            | Score shown              |
| --------- | ------------------------------------------ | ------------------------ |
| quiz/test | submitted (any score) — unchanged          | `correct/gradable`       |
| database  | solution check passes (lite-learner rule)  | pass/fail                |
| web       | learner presses "Submit work" (no eval)    | none                     |
| code      | submitted test run (score recorded)        | TAP `pass/total` as Score |

`result_endpoint` extends naturally: code/database/web submissions POST the
solution text alongside the score — slots into the existing form-data format
as `solution_*` fields (Phase 2 of each type).

---

## 3. Phase 0 — Foundation (prerequisite for all three types)

Small but load-bearing; ships alongside Database Phase 1 if preferred, but has
its own exit criteria.

**Tasks**

1. `lib/runtimes/`: `types.ts` (adapter interface), `config.ts`
   (`PUBLIC_RUNTIMES`), `registry.ts` (empty registry), `tap.ts` (parser +
   unit tests — pure, vitest).
2. `astro.config.mjs`: `runtimes` const + define; `scripts/check-runtimes.mjs`
   preflight.
3. Schema plumbing: zod blocks for `database`/`web`/`code` (+ chapter
   `test_*` variants) with the "at most one assessment" refinement; derived
   kinds through `content.config.ts` → `bundle.ts` → `content/types.ts` →
   `sync.ts` → `db/types.ts`; build-time "runtime not enabled" validation.
4. Migration v2 (`playground` store) + `lib/playground.ts` (per-runtime keyed,
   adapted from lite-learner).
5. `/playground/` shell page + switcher island (renders "no runtimes enabled"
   when empty); conditional nav link.
6. Port the editor chassis: `components/editor/CodeEditor.svelte` — CodeMirror 6
   core themed from the existing `--editor-*`/`--syntax-*` tokens, language
   passed in as a prop, Ctrl/Cmd-Enter run keymap, doc-change callback.
   Re-add `lib/editorTheme.ts` (editor light/dark pin, dropped during the
   original fork) + its Settings row.

**Dependencies**: `codemirror`, `@codemirror/view`, `@codemirror/language`,
`@lezer/highlight` (base packages only; language packages come per type).

**Exit criteria (testable)**

- `npm run build` green with `runtimes: []` and all existing content —
  quizzes/tests/readings behave identically (regression pass).
- A lesson using `database:` with `runtimes: []` fails the build with the
  friendly message.
- TAP parser unit tests pass; playground page renders its empty state.

---

## 4. Type 1 — Database (port from lite-learner)

### Phase 1: initial implementation

Goal: a playable SQLite exercise lesson + chapter test, faithful to
lite-learner's behavior, wired into learn-anywhere's progress model.

**Schema** (per-exercise; matches lite-learner's authoring semantics so its
Course Development Guide rules — ORDER BY, introspection tricks — carry over):

```yaml
database:
  runtime: sqlite            # registry id; 'pglite' later, same shape
  initial_sql: |             # seeds a fresh in-memory DB on load/reset
    CREATE TABLE users (...);
  desired_state:             # omit ⇒ explorable sandbox lesson ("mark as read")
    query: SELECT ... ORDER BY ...
    rows:
      - { id: 1, name: Ada }
```

**Port list** (from `lite-learner/src/`, adapted to the adapter interface):

- `lib/sql/worker.ts`, `client.ts`, `protocol.ts` → `lib/runtimes/sqlite/`
  (single in-memory DB in a Web Worker; `optimizeDeps.exclude` for
  `@sqlite.org/sqlite-wasm` goes into the config, applied when enabled).
- `lib/sql/comparator.ts` + `comparator.test.ts` → verbatim (pure, tested).
- `components/exercise/SqlEditor.svelte` → thin wrapper over the Phase 0
  `CodeEditor` + `@codemirror/lang-sql`.
- `components/exercise/DbViewer.svelte` → near-verbatim (tab per table,
  declared column types, first 50 rows).
- Lesson island: a `DatabaseExercise.svelte` mounted by `LessonApp` when
  `kind === 'database'` — lite-learner's exact load sequence (fresh DB → seed
  → restore buffer *without executing* + banner → viewer on first table →
  stamp started), Run / Check solution / Reset toolbar. Check pass ⇒
  `markLessonCompleted`.
- Chapter test variant: same island on the full-width test page; submission
  gates chapter completion via the existing `test_completed` path.
- Solution buffer autosaved (600 ms debounce) into `Lessons.solution`.

**Dependencies**: `@sqlite.org/sqlite-wasm`, `@codemirror/lang-sql`.

**Testing**: comparator + resolver vitest suites; a hidden/demo course chapter
with one seeded-reading, one checked exercise, one database test; manual pass
of the lesson-load/reset/restore sequence; build-gate tests (runtime disabled
⇒ build fails).

**Exit criteria**: you can author the YAML above, run SQL, see the DB viewer
update, get a pass/fail check that completes the lesson, take a database
chapter test, and everything survives reload + offline.

### Phase 2: polish

- SQLite **playground** tab: editor + viewer + "save database snapshot"
  (`dump`) restored on load — lite-learner's playground, on the per-runtime
  store. Export helpers (`serialize` → `.sqlite` download, `exportJson`).
- Empty/error states (worker crash → terminate + restart), long-query
  busy indicator, result-rows table styling parity with the corporate theme.
- `result_endpoint` support: POST the SQL buffer + pass/fail.
- Reset-progress integration (the new reset buttons must clear `solution`).
- Content: extend Learn Anywhere 101 (or a new demo course) with a real
  database chapter that doubles as the feature's living test.

### Phase 3: document

- `docs/user/database-exercises.md`: authoring schema, ORDER BY/positional
  comparison rules, coercion table (null/number/boolean/string — lifted from
  the comparator), introspection recipes (from lite-learner's course guide),
  playground, enabling the runtime (`runtimes: ['sqlite']` + install command).
- `docs/dev/database-runtime.md`: worker protocol, adapter mapping, sequence
  diagrams (lesson load; check flow: `desired_state.query` → rows →
  `rowsMatch`), how pglite would slot in (second adapter, same
  `DatabaseSession` interface, dialect notes).

---

## 5. Type 2 — Web preview (HTML/CSS/JS-or-TS)

### Phase 1: initial implementation

Goal: a three-tab editor + live preview lesson you can play with; work is
stored; no evaluation.

**Schema**

```yaml
web:
  lang: js                   # or ts
  starter:
    html: |
      <main>...</main>
    css: ""
    js: ""                   # key matches lang
```

**Build**

- `components/exercise/WebExercise.svelte`: tab strip (HTML / CSS / JS|TS),
  one `CodeEditor` per tab (`@codemirror/lang-html|css|javascript`), and a
  sandboxed `<iframe>` preview.
- Preview assembly: compose a `srcdoc` document (user HTML + `<style>` +
  `<script type="module">`), `sandbox="allow-scripts"`, rebuilt on a
  debounce. Same-origin via srcdoc keeps the document reachable for the
  Phase-2 screenshot without cross-origin pain.
- **TypeScript**: transpile in-browser with **Sucrase** (small, fast,
  type-stripping only — no typechecking, which is the right trade for an
  exercise sandbox). Documented as such.
- **Emmet**: `@emmetio/codemirror6-plugin` on the HTML/CSS editors.
- Storage: `solution = { html, css, js }` autosaved; restore on load
  (safe to auto-render here — unlike SQL there's no accumulated state).
- Completion: explicit **"Submit work"** button ⇒ `markLessonCompleted`
  (plus chapter-test variant via `test_web`).

**Dependencies**: `@codemirror/lang-html`, `@codemirror/lang-css`,
`@codemirror/lang-javascript`, `@emmetio/codemirror6-plugin`, `sucrase`.

**Exit criteria**: author the YAML, edit all three tabs (with Emmet
expansions), watch the preview live-update, TS variant transpiles, work
survives reload, submitting completes the lesson.

### Phase 2: polish

- **Export as zip**: `fflate` (tiny, tree-shakeable) — `index.html`,
  `styles.css`, `script.js` (post-transpile + original `.ts` when applicable).
- **Screenshot export**: serialize the same-origin iframe document
  (recommend spiking `modern-screenshot` / `snapdom` — both render DOM →
  image without a server; html2canvas is the fallback). Two buttons:
  *viewport* (iframe's current box) and *full page* (document scrollHeight).
  Known limits (external images/fonts under CSP, canvas taint) get documented
  honestly.
- Web **playground** tab: same island, playground persistence, plus the zip /
  screenshot exports.
- Preview conveniences: refresh button, viewport-size presets
  (mobile/tablet/desktop), console-message capture strip (postMessage from an
  injected shim) — cheap and hugely useful for JS exercises.
- Layout polish: editor/preview split behavior on the two-column lesson page
  vs full-width test page; resizable divider.
- `result_endpoint`: POST the three buffers.

### Phase 3: document

- `docs/user/web-exercises.md`: schema, lang: js|ts, Emmet cheatsheet
  pointer, what the sandbox allows/blocks, export features, playground.
- `docs/dev/web-runtime.md`: srcdoc assembly + sandboxing rationale, Sucrase
  pipeline, screenshot approach + limitations, sequence diagram
  (edit → debounce → assemble → iframe swap; export paths).

---

## 6. Type 3 — Pure code (WASM runtimes + terminal)

### Phase 1: initial implementation

Goal: the **generic WASI adapter** (see §2.3b) running one real interpreter —
**CPython-WASI** — behind the process model: mount files, spawn, stream
stdout/stderr to the terminal, evaluate by exit code. A second WASI runtime
(QuickJS or Lua) added by *configuration only*, to prove the
runtime-as-data claim before Phase 2. Pyodide (package ecosystem, micropip)
is deliberately deferred to Phase 2 as a bespoke adapter behind the same
interface — Phase 1 stands on stdlib-only Python.

**Schema**

```yaml
code:
  runtime: python
  starter: |
    def add(a, b):
        ...
  evaluation:
    mode: tests              # tests (exit code + optional TAP) | output
    tests: |                 # mounted as /work/test.py, run after user code;
      from main import add   # exit 0 = pass; TAP on stdout = per-test score
      assert_eq("add() handles positives", add(1, 2), 3)
      assert_eq("add() handles negatives", add(-1, -2), -3)
    # mode: output alternative:
    # expected_output: "hello\n"     (normalized: trailing whitespace, CRLF)
```

**Build**

- `lib/runtimes/wasi/`: the **generic WASI adapter** — a Web Worker hosting
  `@bjorn3/browser_wasi_shim` (runaway user code must never freeze the tab;
  terminate + respawn on timeout). Runtimes are registry *entries*, not code:
  `{ id, label, wasmUrl, argv: ['python', '/work/main.py'], testArgv,
  editorLanguage, tapShim }`. Phase 1 ships the CPython-WASI entry plus one
  more (QuickJS or Lua) to prove entries generalize.
- Evaluation tiers per §2.4: **exit code** is the base (test process exits
  non-zero ⇒ fail); when stdout parses as TAP, the per-test n/m score is used
  instead. Author test code is mounted as its own file next to the user's.
- TAP shim per runtime (`assert_eq`, `assert_true`, `test(name, fn)` — a few
  helpers prepended to the author's test file) → stdout → `tap.ts` parser
  → `Score`.
- `components/exercise/CodeExercise.svelte`: `CodeEditor`
  (`@codemirror/lang-python` etc. via the registry entry) + terminal panel —
  **xterm.js** (`@xterm/xterm`), write-only in Phase 1 (program output, not
  interactive stdin).
- Run = execute user code alone, stream output + exit status. **Check** = run
  the test process, show per-test pass/fail list when TAP is present (reusing
  the QuestionCard-style ✓/✗ rows) or a single pass/fail from the exit code,
  record `solution_score`, complete on submit.
- Chapter test variant via `test_code`.
- Runtime config surface (requirement 3): everything runtime-specific
  (wasm asset, argv templates, shim, editor language, precache list) lives in
  its registry entry; bespoke adapters (Pyodide, Phase 2) implement the same
  `RuntimeAdapter` interface when a wasm binary + argv isn't enough.

**Dependencies** (opt-in): `@bjorn3/browser_wasi_shim`, `@xterm/xterm`,
`@codemirror/lang-python` (+ interpreter `.wasm` assets, vendored or
downloaded into `public/runtimes/` by a documented script — decide at P1).

**Exit criteria**: author the YAML, run Python, see prints and the exit
status in the terminal, Check shows 2/2 tests green and completes the lesson;
a second runtime works by adding one registry entry and changing one
frontmatter line; disabled runtime fails the build.

### Phase 2: polish

- Code **playground** tabs: one per installed code runtime (buffer + last
  output persisted per runtime id).
- Terminal polish: ANSI colors, clear button, execution-time/exit-status
  line, configurable timeout with friendly "killed after Ns" messaging.
- **Pyodide as the first bespoke adapter** (same `RuntimeAdapter` interface):
  for courses that need the package ecosystem (`packages: [numpy]` via
  micropip) — proves bespoke and WASI-generic runtimes coexist. Asset
  strategy: `precacheAssets()` + the `precacheRuntimes` config decision
  (see §8); loading indicator with progress (first boot is seconds even warm).
- `result_endpoint`: source + TAP/exit-code results.
- Honest runtime matrix in docs: Python/JS/TS/Lua/Ruby/PHP are practical
  in-browser; **Go/Rust/C are not** (they need a compile step no static,
  offline site can provide) — the adapter interface doesn't forbid them, but
  the docs must set expectations that those require a hosted compiler service
  and therefore break the offline story.

### Phase 3: document

- `docs/user/code-exercises.md`: schema, all evaluation modes (exit code /
  TAP / output), the TAP shim helpers per shipped runtime, runtime matrix +
  install commands, playground.
- `docs/dev/code-runtimes.md`: adapter interface + registry-entry reference,
  worker protocol, WASI shim architecture, TAP contract, sequence diagrams
  (run; check → test process → exit code/TAP → Score), and the centerpiece:
  **"Adding a runtime" walkthrough**, two tiers —
  (a) *zero-code*: add a WASI registry entry (Lua-WASI as the worked example:
  wasm URL, argv template, TAP shim, preflight mapping, test checklist);
  (b) *bespoke*: implement `RuntimeAdapter` for engines that aren't plain
  WASI commands (Pyodide as the worked example).

---

## 7. Suggested order & why

| Step | Deliverable | Rationale |
| ---- | ----------- | --------- |
| 0    | Foundation  | Everything else hangs off it; small; provably non-breaking |
| 1    | Database P1 → P2 → P3 | Reference implementation exists; de-risks the adapter/registry/playground design against real code |
| 2    | Web P1 → P2 → P3 | No evaluation engine — pure UI; exercises the multi-buffer storage + export paths |
| 3    | Pure code P1 → P2 → P3 | Hardest (workers, TAP, big assets); benefits from everything learned |

Each type's P1 is a review checkpoint: play with it, confirm the schema and
storage feel right, *then* invest in polish. Schema changes after P1 are
cheap (content_hash refreshes caches; progress fields are additive).

---

## 8. Open questions (decide during Phase 0 / at each P1 review)

1. **Precaching heavy runtimes** — `precacheRuntimes: true|false` site config,
   or per-runtime? Pyodide can be 10s of MB; SQLite-WASM is ~1 MB (always
   fine). Leaning: config flag, default off for adapters that declare
   themselves "heavy", always-on for light ones.
2. **Database completion strictness** — lite-learner completes only on a
   passing check; quizzes complete on any submission. Keep the split per the
   table in §2.8, or unify? Leaning: keep — "make the DB match" has an
   objective bar; quizzes are formative.
3. **Playground for `web` and code runtimes on the same page** — one switcher
   with heavy lazy-loading per tab (leaning yes: only instantiate a runtime
   when its tab activates, destroy on switch-away).
4. **`test` filename collision** — chapter test pages already reserve the
   `test` lesson name; no new reserved names needed (test variants live in
   chapter frontmatter), but confirm `test_database` etc. don't complicate the
   `test.astro` static-path generation (they shouldn't: one test page per
   chapter regardless of kind).
5. **Score semantics for `output` / exit-code modes** — pass/fail (1/1) or
   excluded from score aggregation? Leaning: 1/1.
6. **Interactive stdin** in the terminal (Phase 2+ of pure code) —
   synchronous stdin from a worker needs SharedArrayBuffer (COOP/COEP), which
   we deliberately avoid. Defer; document as a known limitation.
7. **Where interpreter `.wasm` binaries live** — vendored into
   `public/runtimes/` by a documented fetch script (pinned versions, offline
   builds, repo stays slim) vs committed to the repo vs npm packages where
   they exist. Leaning: fetch script with pinned URLs + checksums.
8. **Python runtime identity** — is `runtime: python` CPython-WASI, with
   Pyodide as a separate `runtime: pyodide` (package ecosystem), or one
   `python` id whose backing engine is a site-level choice? Leaning: separate
   ids; explicit beats magic and courses declare what they actually need.

---

## 9. Deliverables map

```
astro.config.mjs                      runtimes const (+ precacheRuntimes)
scripts/check-runtimes.mjs            dependency preflight
src/lib/runtimes/
  types.ts  config.ts  registry.ts  tap.ts (+ tap.test.ts)
  sqlite/   (worker, client, protocol, comparator + tests, adapter)
  wasi/     (generic adapter: worker + WASI shim host; registry entries
             for cpython, quickjs/lua — entries are data + a TAP shim each)
  pyodide/  (Phase 2 bespoke adapter, package ecosystem)
public/runtimes/                      vendored interpreter .wasm binaries
                                      (fetched by a pinned-version script)
src/lib/playground.ts                 per-runtime persistence (migration v2)
src/lib/editorTheme.ts                editor scheme pin (restored)
src/components/editor/CodeEditor.svelte
src/components/exercise/
  DatabaseExercise.svelte  SqlEditor.svelte  DbViewer.svelte
  WebExercise.svelte  CodeExercise.svelte
src/components/playground/            shell + per-kind playground islands
src/pages/playground.astro
docs/user/
  runtimes.md                         enabling runtimes + install commands
  database-exercises.md  web-exercises.md  code-exercises.md
docs/dev/
  database-runtime.md  web-runtime.md  code-runtimes.md   (each with
                                       sequence diagrams + code references)
```

Existing docs to touch as each type lands: `Course Development Guide.md`
(pointer sections to `docs/user/*`), `Development Guide.md` (architecture
paragraph + deliverables map), `README.md` (feature bullets), and the
Learn Anywhere 101 / developer course content once features are real.
