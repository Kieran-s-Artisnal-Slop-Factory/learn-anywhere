---
title: Interface Walkthroughs
quiz:
  - type: multiple_choice
    prompt: When does the "Platform walkthrough" course appear on a site?
    options:
      - Always — it's built in
      - When at least one `interfaceTutorials` flag is `true`
      - When the learner enables it in Settings
      - When the site has a result endpoint
    answer: 1
  - type: multi_select
    prompt: Which walkthrough chapters can be enabled?
    options:
      - Standard quizzes
      - The database workspace
      - The web workspace
      - The flashcards screen
    answer: [0, 1, 2]
  - type: true_false
    prompt: "Enabling the database walkthrough on a site without the `sqlite` runtime fails the build."
    answer: true
---

Some interfaces here take a minute to learn — the quiz form, the SQL
workspace, the web editor. Instead of every course explaining the buttons,
the platform ships a ready-made **Platform walkthrough** course: one
single-lesson chapter per interface, each a hands-on tour written *inside*
the interface it teaches.

## Turning it on

It's controlled by `interfaceTutorials` in `astro.config.mjs` — three
flags, all `false` by default:

```js
const interfaceTutorials = {
  web: false,      // web workspace tour
  database: false, // database workspace tour
  quizes: false,   // every question type in one quiz
};
```

Set any flag to `true` and the matching chapter appears; the course itself
only exists while at least one flag is on. Disabled chapters are removed
*everywhere* — pages, the course list, offline caching, and progress
tracking all agree the chapter isn't there.

## The fine print

- The walkthrough content lives in the repo at
  `src/content/courses/0.platform-walkthrough/` — you can edit it like any
  other course if your site's tone differs.
- The `web` and `database` chapters contain real exercises, so they need
  their runtime (`web` / `sqlite`) in the site's `runtimes` list; enabling
  one without it fails the build with the usual runtime message.
- Learners treat it as a normal course: enrollable, trackable, resettable.
