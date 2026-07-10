---
term: Content collection
short: Astro's typed content system — folders of markdown validated against a schema at build time, then queried like a database while building pages.
---

Content collections are Astro's answer to "a folder full of markdown, but
typed". Each collection declares which files belong to it and a schema for
their [[frontmatter]]; at build time Astro validates every file and exposes
the results as typed data that pages query while rendering.

Learn Anywhere defines five collections: `courses`, `chapters`, and `lessons`
(all under `src/content/courses/`, separated by folder depth), plus
`glossary` and `flashcards`. The schemas live in `src/content.config.ts`.

The practical win is that authoring mistakes fail the build with a pointed
error — a quiz answer index that's out of range, a chapter listing a lesson
file that doesn't exist — rather than surfacing as a broken page for a
learner.
