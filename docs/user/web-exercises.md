# Authoring web-preview exercises

Web exercises give learners an HTML / CSS / JS (or TypeScript) editor with a
**live page preview** — for teaching web design and front-end basics. There
is **no auto-grading**: learners build something and press *Submit work* to
complete. If you want to review what they built, pair it with a
[result endpoint](#sending-work-for-review-result_endpoint) or have them
export their work.

Prerequisite: the `web` runtime must be enabled — see
[runtimes.md](runtimes.md). A working reference course ships in
`src/content/courses/8.web-demo/`.

## The `web:` block

A lesson becomes a web exercise by declaring a `web:` block (at most one
assessment block per lesson — `quiz`, `database`, or `web`):

```markdown
---
title: Your First Page
web:
  lang: js                 # or ts — see TypeScript below
  starter:                 # all three optional, default empty
    html: |
      <h1>Hello!</h1>
    css: |
      h1 { color: rebeccapurple; }
    js: |
      console.log('hi');
---

The lesson body is the instructions, shown beside the workspace.
```

- The learner's **HTML is the page body**; the CSS and script are injected
  around it into a complete document. Tell learners to write body content,
  not `<html>`/`<head>` boilerplate.
- The script always lives under the `js` key of `starter`, even for
  `lang: ts`.
- Completion is the explicit **Submit work** button — submitting saves the
  buffers and completes the lesson. No evaluation happens.

## Web chapter tests

A chapter's `index.md` can declare `test_web:` — the full-width test page
becomes the workspace (editor and preview side by side on wide screens).
Give it task text via `instructions` (markdown, glossary refs included),
since the test page has no body of its own:

```yaml
test_web:
  lang: ts
  starter:
    html: |
      <div id="card"></div>
    js: |
      const person = { name: 'Ada', role: 'Engineer' };
  instructions: |
    Build a profile card: style `#card` and render `person` into it, then
    press **Submit work**.
```

The chapter completes once every lesson is done *and* the test is
submitted, like every other test kind.

## TypeScript (`lang: ts`)

The third tab becomes **TS** and the script buffer is transpiled in the
browser with [Sucrase](https://sucrase.io/) before running — **type
stripping only, no typechecking**: type errors won't be caught, only syntax
errors (which show as a banner while the last good preview stays). Use it to
teach TS syntax and let learners write typed code; don't promise them a
compiler. Zip exports include both the original `.ts` and the transpiled
`.js`.

## What the learner gets

- **Three editor tabs** that keep their state (and undo history) when
  switching; work autosaves and is restored on reload.
- **Emmet** in the HTML and CSS tabs — <kbd>Tab</kbd> (or
  <kbd>Ctrl</kbd>+<kbd>E</kbd>) expands abbreviations like `ul>li*3` or
  `m10`. Cheatsheet: <https://docs.emmet.io/cheat-sheet/>.
- A **live preview** that rebuilds shortly after each edit, with
  **Full / Tablet (768px) / Mobile (375px)** width presets and a
  **Refresh** button (re-runs the page's JS).
- A **console strip** under the preview showing `console.log/info/warn/error`
  output and uncaught errors from their page.
- **Reset to starter** restores all three tabs to your authored starter.
- **Export**:
  - *Zip of files* — a standalone `index.html` + `styles.css` + `script.js`
    (+ `script.ts` when applicable) they can open locally or host anywhere.
  - *Screenshot (viewport or full page)* — a PNG of their rendered page at
    the currently selected preview width.

### The sandbox

The preview runs in a sandboxed frame with a unique origin: learner code
can run scripts but **cannot** touch the surrounding app, its storage, or
other pages. External resources (images, fonts, CDN scripts) referenced by
URL will load while online but won't work offline — prefer self-contained
exercises. Screenshot exports render external images best-effort; complex
pages may capture imperfectly (the capture is a DOM re-render, not a true
browser screenshot).

## Sending work for review (`result_endpoint`)

`result_endpoint` next to the lesson's `web:` or the chapter's `test_web:`
makes **Submit work** also POST the three buffers to your endpoint:

```yaml
web:
  starter: { html: ..., css: ..., js: ... }
result_endpoint: https://example.com/results
```

Payload (form data): `kind` (`quiz` for lessons, `test` for chapter tests),
`slug`, `title`, `submitted_at`, `sender_name`/`sender_email`, `passed`
(always `n/a` — web work isn't evaluated), and `solution_html`,
`solution_css`, `solution_js`. Sender identity travels as `x-sender-*`
headers; CORS requirements and the profile gate are the same as for every
other result endpoint (learners must set a name and email before Submit
unlocks; building stays free). Not secure, not for accredited assessment.

## The playground

With the `web` runtime enabled, `/playground/` gains a **Web preview** tab:
the same workspace with a blank page, autosaving buffers, and all the
exports — a scratchpad for anything that doesn't fit an exercise. (The
playground is plain JS; TypeScript is per-exercise.)

## Testing your exercises

1. `npm run build` — validates the block shape and that the runtime is
   enabled.
2. In the dev server: check the starter renders sensibly, try the task
   yourself, verify the console strip shows what you'd expect learners to
   log, and reload once to confirm restore.
3. For `lang: ts`, paste a type-heavy solution and confirm it runs (types
   strip cleanly).
