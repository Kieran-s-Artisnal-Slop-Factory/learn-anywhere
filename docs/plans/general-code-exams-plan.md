# General Code Exams — Extension Plan (deferred)

The third code-based exercise kind: **pure code** — arbitrary-language
exercises evaluated in the browser via WASM runtimes, with output in a
terminal emulator. Deliberately **deferred until after the main plan**
(`plan-archive/coding-exams-plan.md`: foundation + database + web preview,
now fully shipped and archived) is complete:
it carries the most caveats (worker lifecycle, large assets, runtime
sourcing, honest language limits), and the direction below was worked out in
advance so the foundation doesn't paint us into a corner.

**Status: not scheduled.** This document preserves the design notes and the
phase breakdown for when the time is dedicated to it.

---

## 1. What this extension assumes exists (from the main plan)

Built during the main plan's Phase 0 and the two shipped types:

- The `runtimes` config array in `astro.config.mjs` → `PUBLIC_RUNTIMES`
  define, the runtime **registry** (`lib/runtimes/registry.ts`), the
  `scripts/check-runtimes.mjs` preflight, and build-time "content uses a
  disabled runtime" validation in `bundle.ts`.
- The **"at most one assessment block per lesson/chapter"** zod refinement —
  the `code:` / `test_code:` keys are reserved by the main plan for this
  extension, so adding them later is additive.
- The shared **`CodeEditor.svelte`** chassis (CodeMirror 6, themed from the
  `--editor-*`/`--syntax-*` tokens) and `lib/editorTheme.ts`.
- The **playground shell** (`/playground/` with a runtime switcher and
  per-runtime persistence in the `playground` store) — this extension adds
  tabs to it, not a new page.
- The `solution` progress field pattern on lesson/chapter rows, the
  reset-progress integration, and the `result_endpoint` `solution_*`
  form-data extension.
- The `RuntimeAdapter` interface — this extension **widens** `RuntimeSession`
  with the process model below.

---

## 2. Core design direction

### 2.1 The process model: WASI first, WebContainers rejected

The kind is built on a **process abstraction**: mount the learner's source
(plus author test files) into a virtual filesystem, spawn, pipe stdout/stderr
to the terminal, and read the **exit code** — non-zero fails.

```ts
// Widening of RuntimeSession (lib/runtimes/types.ts)
export interface RuntimeSession {
  // Mount files, run, get streams + an exit code.
  run(files: Record<string, string>, argv?: string[]): Promise<RunResult>;
  reset(): Promise<void>;
  destroy(): void;
}

export interface RunResult {
  exitCode: number;                // non-zero = failure (the base contract)
  stdout: string;                  // streamed to the terminal as it arrives
  stderr: string;
}
```

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
  The honest runtime matrix: **Python/JS/TS/Lua/Ruby/PHP are practical**;
  Go/Rust/C require a hosted compiler service and therefore break the
  offline story — the adapter interface doesn't forbid them, but the docs
  must set expectations.

### 2.2 Language-agnostic evaluation: exit codes, then TAP

Two evaluation tiers, both language-agnostic because they ride on the process
model:

1. **Exit code** (the base tier): run user code + author tests as a process;
   exit 0 = pass, non-zero = fail. Zero per-language machinery — any test
   framework in any language already behaves this way. Score: 1/1.
2. **TAP** (the granular tier): parse the **Test Anything Protocol** from
   stdout for a per-test n/m score — plain text, trivially emitted from any
   language, parsed once in `lib/runtimes/tap.ts` (pure module + vitest
   suite):

```
1..3
ok 1 - add() handles positives
not ok 2 - add() handles negatives
ok 3 - add() handles zero
```

- Authors write test code *in the exercise's language*; each runtime ships a
  tiny TAP shim (`assert_eq`, `assert_true`, `test(name, fn)` — ~20 lines,
  prepended to the author's test file).
- The parser maps results straight onto the existing `Score`
  (`correct/gradable`) and per-question-style pass/fail rows, so the score
  UI, course overview aggregation, and `result_endpoint` submissions all
  work unchanged.
- Alternative `evaluation.mode: output` (normalized stdout comparison —
  trailing whitespace, CRLF) covers "print the right thing" exercises
  without test code.

### 2.3 Storage & completion

- `solution: string | null` on the lesson row (source buffer), `test_*`
  analog on chapters; `solution_score: Score | null` for TAP/output results.
  Schemaless IDB row fields — no migration needed; `sync.ts` gains defaults;
  backup export covers them automatically.
- Completion: submitted test run completes the lesson with the score
  recorded (mirrors quiz semantics), shown as TAP `pass/total`.
- Solutions restored on load but **never auto-executed**.

---

## 3. Phase 1 — initial implementation

Goal: the **generic WASI adapter** running one real interpreter —
**CPython-WASI** — behind the process model: mount files, spawn, stream
stdout/stderr to the terminal, evaluate by exit code. A second WASI runtime
(QuickJS or Lua) added by *configuration only*, to prove the runtime-as-data
claim before Phase 2. Pyodide (package ecosystem, micropip) is deliberately
deferred to Phase 2 as a bespoke adapter behind the same interface — Phase 1
stands on stdlib-only Python.

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

Chapter tests use `test_code:` with the same object shape.

**Build**

- `lib/runtimes/tap.ts`: TAP parser + unit tests (pure, vitest) — the one
  foundation piece that was *removed* from the main plan's Phase 0 and moved
  here.
- `lib/runtimes/wasi/`: the **generic WASI adapter** — a Web Worker hosting
  `@bjorn3/browser_wasi_shim` (runaway user code must never freeze the tab;
  terminate + respawn on timeout). Runtimes are registry *entries*, not code:
  `{ id, label, wasmUrl, argv: ['python', '/work/main.py'], testArgv,
  editorLanguage, tapShim }`. Phase 1 ships the CPython-WASI entry plus one
  more (QuickJS or Lua) to prove entries generalize.
- Evaluation tiers per §2.2: **exit code** is the base (test process exits
  non-zero ⇒ fail); when stdout parses as TAP, the per-test n/m score is used
  instead. Author test code is mounted as its own file next to the user's.
- `components/exercise/CodeExercise.svelte`: `CodeEditor`
  (`@codemirror/lang-python` etc. via the registry entry) + terminal panel —
  **xterm.js** (`@xterm/xterm`), write-only in Phase 1 (program output, not
  interactive stdin).
- Run = execute user code alone, stream output + exit status. **Check** = run
  the test process, show per-test pass/fail list when TAP is present (reusing
  the QuestionCard-style ✓/✗ rows) or a single pass/fail from the exit code,
  record `solution_score`, complete on submit.
- Chapter test variant via `test_code`.
- Runtime config surface: everything runtime-specific (wasm asset, argv
  templates, shim, editor language, precache list) lives in its registry
  entry; bespoke adapters (Pyodide, Phase 2) implement the same
  `RuntimeAdapter` interface when a wasm binary + argv isn't enough.

**Dependencies** (opt-in): `@bjorn3/browser_wasi_shim`, `@xterm/xterm`,
`@codemirror/lang-python` (+ interpreter `.wasm` assets, vendored or
downloaded into `public/runtimes/` by a documented script — decide at P1).

**Exit criteria**: author the YAML, run Python, see prints and the exit
status in the terminal, Check shows 2/2 tests green and completes the lesson;
a second runtime works by adding one registry entry and changing one
frontmatter line; disabled runtime fails the build.

---

## 4. Phase 2 — polish

- Code **playground** tabs: one per installed code runtime (buffer + last
  output persisted per runtime id) on the existing playground shell.
- Terminal polish: ANSI colors, clear button, execution-time/exit-status
  line, configurable timeout with friendly "killed after Ns" messaging.
- **Pyodide as the first bespoke adapter** (same `RuntimeAdapter` interface):
  for courses that need the package ecosystem (`packages: [numpy]` via
  micropip) — proves bespoke and WASI-generic runtimes coexist. Asset
  strategy: `precacheAssets()` + the `precacheRuntimes` config decision
  (see §6); loading indicator with progress (first boot is seconds even
  warm).
- `result_endpoint`: source + TAP/exit-code results as `solution_*` fields.
- Honest runtime matrix in docs (see §2.1's compiled-language note).

---

## 5. Phase 3 — document

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

## 6. Open questions (decide at this extension's P1 review)

1. **Precaching heavy runtimes** — `precacheRuntimes: true|false` site
   config, or per-runtime? Pyodide can be 10s of MB; CPython-WASI is ~20 MB;
   SQLite-WASM (~1 MB) is always fine. Leaning: config flag, default off for
   adapters that declare themselves "heavy", always-on for light ones.
2. **Score semantics for `output` / exit-code modes** — pass/fail (1/1) or
   excluded from score aggregation? Leaning: 1/1.
3. **Interactive stdin** in the terminal — synchronous stdin from a worker
   needs SharedArrayBuffer (COOP/COEP), which we deliberately avoid. Defer;
   document as a known limitation.
4. **Where interpreter `.wasm` binaries live** — vendored into
   `public/runtimes/` by a documented fetch script (pinned versions, offline
   builds, repo stays slim) vs committed to the repo vs npm packages where
   they exist. Leaning: fetch script with pinned URLs + checksums.
5. **Python runtime identity** — is `runtime: python` CPython-WASI, with
   Pyodide as a separate `runtime: pyodide` (package ecosystem), or one
   `python` id whose backing engine is a site-level choice? Leaning: separate
   ids; explicit beats magic and courses declare what they actually need.

---

## 7. Deliverables map (extension only)

```
src/lib/runtimes/
  tap.ts (+ tap.test.ts)              TAP parser (pure)
  wasi/                               generic adapter: worker + WASI shim host;
                                      registry entries for cpython, quickjs/lua
                                      — entries are data + a TAP shim each
  pyodide/                            Phase 2 bespoke adapter, package ecosystem
public/runtimes/                      vendored interpreter .wasm binaries
                                      (fetched by a pinned-version script)
scripts/fetch-runtimes.mjs            pinned-URL + checksum wasm downloader
src/components/exercise/CodeExercise.svelte
src/components/playground/            code playground tabs (added to shell)
docs/user/code-exercises.md
docs/dev/code-runtimes.md             incl. the "adding a runtime" walkthrough
```
