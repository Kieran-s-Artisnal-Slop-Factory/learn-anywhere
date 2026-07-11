---
title: Appyness
lessons:
  - offline-first
  - service-workers-and-pwa
test:
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

How the offline data flow, and the service worker function. What makes the site feel more like an app than a webpage. 
