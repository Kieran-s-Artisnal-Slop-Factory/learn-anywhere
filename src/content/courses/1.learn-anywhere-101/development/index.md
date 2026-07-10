---
title: Development
lessons:
  - architecture-overview
  - offline-first
  - service-workers-and-pwa
test:
  - type: multiple_choice
    prompt: What does `npm run build` produce?
    options:
      - A Docker image
      - A dist/ folder of static files
      - A Node server bundle
      - A database migration
    answer: 1
  - type: multiple_choice
    prompt: What renders the interactive parts of a page?
    options:
      - Server-side endpoints
      - Svelte islands mounted into static HTML
      - A single-page React app
      - Inline jQuery
    answer: 1
  - type: multiple_choice
    prompt: When content changes, how does an enrolled browser find out?
    options:
      - A push notification
      - Polling an API every hour
      - Comparing the page's content hash with the cached copy
      - It doesn't — learners must re-enroll
    answer: 2
  - type: true_false
    prompt: If a lesson's file is renamed, learners keep their progress for it.
    answer: false
  - type: multi_select
    prompt: Which strategies does the service worker use?
    options:
      - Precache every route at install
      - Network-first for page navigations
      - Stale-while-revalidate for assets
      - Server-side rendering fallback
    answer: [0, 1, 2]
  - type: multiple_choice
    prompt: Which two files must change together when the IndexedDB schema evolves?
    options:
      - astro.config.mjs and package.json
      - The entity types (db/types.ts) and an appended migration (db/db.ts)
      - The service worker and the manifest
      - content.config.ts and the navbar
    answer: 1
  - type: long_answer
    prompt: Explain the trade-offs of the offline-first, no-backend design in your own words.
---

The developer's exit exam — architecture, the offline data flow, and the
service worker. If you can pass this, you can navigate the codebase.
