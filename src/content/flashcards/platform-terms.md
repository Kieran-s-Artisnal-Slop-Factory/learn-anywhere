---
title: Platform Terms
cards:
  - front: What does [[enrollment|enrolling]] in a course actually do?
    back: Copies the whole course into your browser's [[indexeddb|IndexedDB]] — **no account**, works offline afterwards.
  - front: What makes a lesson an "exercise"?
    back: A quiz declared in its frontmatter. Lessons without one are readings.
  - front: When is a chapter with a test complete?
    back: When every lesson is done AND the test has been submitted.
  - front: What is a content hash for?
    back: Detecting changed content so the cached copy can refresh without touching your progress.
  - front: Are short/long answer questions graded?
    back: Never automatically — they're recorded (and optionally sent to a result endpoint) but excluded from the score.
  - front: What does a service worker do for this site?
    back: Precaches every page and serves them when offline; navigations are network-first, assets stale-while-revalidate.
  - front: Where does ALL of your progress live?
    back: In this browser's IndexedDB — the only copy, unless you export a backup from Settings.
---

The vocabulary of Learn Anywhere itself — from [[enrollment]] to
[[service-worker|service workers]]. Companion deck to the Basics and
Development chapters of Learn Anywhere 101.
