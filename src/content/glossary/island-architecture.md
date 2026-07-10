---
term: Island architecture
short: Pages are static HTML with small self-contained interactive components ("islands") mounted into them, instead of one big client-side app.
---

In island architecture, a page is mostly static HTML — fast to load, works
without JavaScript — with a few interactive components ("islands") hydrated
into specific spots. Each island is independent; there is no single
page-spanning application.

Learn Anywhere's pages follow this pattern strictly: the lesson text,
navigation, and structure are static output from
[[static-site-generation|the build]], and one Svelte island per page handles
the interactive part — the quiz form on a lesson, the test on a test page,
the progress dashboard on the homepage.

The islands are mounted with Astro's `client:only="svelte"` directive, since
their content (your progress, your answers) only exists in the browser and
can't be server-rendered.
