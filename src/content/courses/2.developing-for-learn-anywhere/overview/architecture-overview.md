---
title: Architecture Overview
quiz:
  - type: multiple_choice
    prompt: Which framework generates the static pages?
    options:
      - Next.js
      - Astro
      - SvelteKit
      - Eleventy
    answer: 1
  - type: multiple_choice
    prompt: Why are the Svelte islands mounted with client:only?
    options:
      - It's faster to compile
      - Their content (progress, answers) exists only in the browser
      - Svelte can't be server-rendered
      - To avoid hydration warnings
    answer: 1
  - type: true_false
    prompt: Adding a lesson requires writing a new Astro page component.
    answer: false
---

Learn Anywhere is two thin layers over a folder of markdown.

## Layer 1: the static build

[[static-site-generation|Astro]] turns `src/content/` into pages. The five
[[content-collection|content collections]] (courses, chapters, lessons,
glossary, flashcards) validate every file against a schema, and a handful of
page templates in `src/pages/` generate one HTML page per course, chapter,
lesson, test, glossary term, and deck. Authors never touch templates —
adding content is adding markdown, and the routes appear.

Two build-time details worth knowing:

- Glossary `[[references]]` are rewritten into definition-carrying links by
  a remark plugin during the markdown render — the popups need no runtime
  lookup.
- Every content payload is stamped with a [[content-hash]], which the
  offline layer uses later.

## Layer 2: the islands

Each page mounts one Svelte component for its interactive part — the quiz
form, the test, the enroll button, the progress dashboard
([[island-architecture]]). Islands are `client:only` because everything they
show lives in the browser: there is no server to render your progress.

The grading logic itself is a plain TypeScript module with no DOM or storage
dependencies, which keeps it unit-testable — `npm test` covers it alongside
the content-wiring resolver. `npm run build` is the other half of the safety
net: it validates every schema, every wiring reference, and every glossary
link.
