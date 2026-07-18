# Runtimes: enabling code exercises on your site

Code-based exercises (database exercises today; web preview coming) need a
**runtime** — the in-browser engine that runs the learner's code. Runtimes
are opt-in per site: a site that only uses quizzes ships none of the engine
code, and the Playground page and editor settings stay hidden.

## Enabling a runtime

Two steps, both required:

**1. List it in `astro.config.mjs`:**

```js
// Known ids: 'sqlite', 'web'
export const runtimes = ['sqlite'];
```

**2. Install its packages:**

| Runtime  | What it powers                        | Install                                                  |
| -------- | ------------------------------------- | -------------------------------------------------------- |
| `sqlite` | Database exercises (SQL, in-browser)  | `npm install @sqlite.org/sqlite-wasm @codemirror/lang-sql` |
| `web`    | Web-preview exercises (HTML/CSS/JS)   | *(not implemented yet — see coding-exams-plan.md)*       |

You don't have to memorize the packages: `npm run dev` and `npm run build`
**preflight-check** every enabled runtime and print the exact
`npm install …` command if anything is missing.

## What the platform enforces

- **Content is gated on the config.** If any lesson or chapter uses a
  runtime that isn't in `runtimes`, the build fails with a message naming
  the file, the runtime, and the install command. Content that needs an
  engine can never ship without it.
- **Unknown runtime ids fail the preflight** with the list of known ids.
- Disabling a runtime later (removing it from the array) fails the build
  until the content that uses it is removed too — nothing breaks silently.

## What enabling a runtime adds

- The exercise/test types that need it (see
  [database-exercises.md](database-exercises.md)).
- A **Playground** entry in the navigation — a free experimentation
  environment per runtime, with a tab switcher when several are enabled.
- A **Code editor** setting in Settings → Appearance, letting visitors pin
  the editor's colour scheme light or dark independent of the app theme.

## Offline behavior

Runtime engines are ordinary hashed assets: the service worker picks them up
in its crawl, so exercises and the playground work offline after the first
visit like everything else. SQLite's WASM build is about 1 MB. (Heavier
future runtimes will make offline precaching a site-level choice — see the
plans in the repo root.)
