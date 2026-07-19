# Learn Anywhere

*A fully static, offline-first LMS (learning management system)*. Designed to be a build-once, run anywhere system for simple, open course authoring.

## What is this for?

If you have any of the below requirements, or they seem appealing, then Learn Anywhere might be a good fit:

- **Cheap Hosting**; When you build the course you get static files, you can host these incredibly cheaply if not free
- **Poor connection scenarios**; If you want a mini-course for a conference, or some other situation with bad connections, then this system will cache the course contents to the user device, meaning the WiFi only has to work long enough for the initial loading of the course
- **No vendor Lock-in**; The code is open source, and the content is just plain markdown files, meaning you can take it anywhere you want. 

## What is this not for?

If you have any of the following requirements, you may be better off looking for other alternatives:

- **Strict Marking**; The system has **all answers** available on the client, meaning it's easy to cheat in
- **Integrations**; Any additional systems you want to integrate will need to be done manually in the code
- **Storing Marks**; The system has no backend (no database or server), so while you can store results using the [`result_endpoint`](docs/user/course-development-guide.md#sending-results-for-marking-result_endpoint) feature, it will require an additional server you need to maintain
- **Cost Gating**; The system is designed to be open. Since everything is static there's no way to easily block people from getting access until they pay. This would need to be handled by an additional gating system, and due to the offline-first nature, it is **incredibly difficult to lock people out** if you want them to only have access for a limited period of time since the course contents are stored on device
- **Plugins**; The feature set of the system is not designed to be easily extensible. Due to the focus on offline support making sweeping architecture and data model changes is not trivial.

## Features

- **Courses → chapters → lessons** authored as plain markdown with validated
  frontmatter (content collections), including optimized images, KaTeX math,
  and Mermaid diagrams
- **Quizzes** inside lessons and **tests** at the end of chapters, both built
  from the same question types:
  - multiple choice (a–e), with per-question "All of the above" / "None of the
    above" toggles
  - true / false
  - multi-select (all-or-nothing by default; a site-wide `partial_grades`
    setting in `astro.config.mjs` enables partial credit)
  - numeric — the learner types the number(s): single values, comma-separated
    lists (any order), tuples like `(10, 15)`, with optional integer-only,
    positive-only, and decimal-precision constraints
  - short answer and long answer (stored/sent for review, never auto-graded
    and excluded from the score)
- **Result endpoints** — a quiz or test can declare a `result_endpoint`;
  submissions are POSTed there (with `x-sender-name`/`x-sender-email`
  headers from the visitor's optional profile) so a person can mark written
  answers. Not secure — answers are in the page — but useful for
  non-accredited courses that want nuanced evaluation
- **Feedback** — an optional `contactEndpoint` in `astro.config.mjs` adds
  per-lesson feedback buttons and a general Contact page
- **Score tracking** — the courses page shows lessons completed, overall
  score, and quiz/test breakdowns per enrolled course
- **Database exercises** — lessons and chapter tests as SQL workspaces
  against a real in-browser SQLite database, checked by database *state*
  (not answer matching), plus a persistent playground with exports. Opt-in
  per site — see [docs/user/runtimes.md](docs/user/runtimes.md) and
  [docs/user/database-exercises.md](docs/user/database-exercises.md)
- **Web exercises** — HTML/CSS/JS-or-TypeScript editor tabs with a live
  sandboxed preview, Emmet, console capture, and zip/screenshot exports;
  submitted rather than graded. See
  [docs/user/web-exercises.md](docs/user/web-exercises.md)
- **Interface walkthroughs** — an optional built-in "Platform walkthrough"
  course teaching learners the quiz, database, and web interfaces; each
  chapter toggled by `interfaceTutorials` in `astro.config.mjs` (all off by
  default)
- **Flashcards** — authored decks of front/back cards with a shuffle-and-repeat
  practice mode (missed cards recycle until learned)
- **Glossary** — one markdown file per term with a short popup description and
  a full landing page; reference terms anywhere as `[[term]]` or
  `[[term|display text]]`
- **Offline PWA** — service worker precaches every route; progress backup /
  restore from Settings

## Documentation

- [Course Development Guide](docs/user/course-development-guide.md) — authoring
  courses, quizzes, tests, glossary terms, and flashcards
- [Adding images](docs/user/images.md) — co-located images, optimization, and
  the `public/` caveat
- [Diagrams](docs/user/diagrams.md) — Mermaid diagrams in markdown bodies
- [Runtimes](docs/user/runtimes.md) — enabling code-exercise engines per site
- [Database exercises](docs/user/database-exercises.md) ·
  [Web exercises](docs/user/web-exercises.md)
- [Development Guide](docs/dev/development-guide.md) — architecture, storage
  model, and contributor notes (with deeper dives in
  [docs/dev/](docs/dev/))

The built site also ships with a self-documenting **Learn Anywhere 101**
course that demonstrates every feature using the platform itself.

## Quick start

### Building

Make sure you have npm (or an equivalent) installed, and run `npm install` to set up dependencies, then the following commands are available:

```sh
npm run dev       # dev server
npm test          # vitest: grading rules + content resolver
npm run build     # also the content-validation gate
```

## Deploying

The site is static, running `npm run build` will dump the files to a folder called `dist`. Take that folder and put it on any static site host.

