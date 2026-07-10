# learn-anywhere

A **fully static, offline-first LMS** for traditional courses. Lessons mix
readings with quizzes, every chapter can end with a full-page test, and a
glossary provides wikipedia-style definition popups throughout the content.
No backend, no accounts — enrollment copies a course into the browser's
IndexedDB and everything (progress, answers, scores) stays on the device.

Built on [Astro](https://astro.build) + [Svelte 5](https://svelte.dev), derived
from the [lite-learner](https://github.com/kieranwood/lite-learner) template
with the SQL execution environment replaced by a configurable assessment
system.

## Features

- **Courses → chapters → lessons** authored as plain markdown with validated
  frontmatter (content collections)
- **Quizzes** inside lessons and **tests** at the end of chapters, both built
  from the same question types:
  - multiple choice (a–e), with per-question "All of the above" / "None of the
    above" toggles
  - true / false
  - multi-select
  - short answer (stored for review, never graded)
- **Score tracking** — the courses page shows lessons completed, overall
  score, and quiz/test breakdowns per enrolled course
- **Flashcards** — authored decks of front/back cards with a shuffle-and-repeat
  practice mode (missed cards recycle until learned)
- **Glossary** — one markdown file per term with a short popup description and
  a full landing page; reference terms anywhere as `[[term]]` or
  `[[term|display text]]`
- **Offline PWA** — service worker precaches every route; progress backup /
  restore from Settings

## Quick start

```sh
npm install
npm run dev       # dev server
npm test          # vitest: grading rules + content resolver
npm run build     # also the content-validation gate
```

See the [Development Guide](Development%20Guide.md) for architecture and the
[Course Development Guide](Course%20Development%20Guide.md) for authoring
courses, quizzes, tests, and glossary terms.

## Deploying

The site is static (`dist/`). `astro.config.mjs` sets `base: '/learn-anywhere'`
for sub-path hosting (e.g. GitHub Pages — a workflow is included); set `base`
to `/` to serve at a domain root. Every internal link goes through
`lib/paths.ts`, so no other change is needed.
