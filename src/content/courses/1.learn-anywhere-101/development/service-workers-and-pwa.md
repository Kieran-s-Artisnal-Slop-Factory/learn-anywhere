---
title: Service Workers and the PWA
quiz:
  - type: multiple_choice
    prompt: How does the service worker learn which routes to precache?
    options:
      - A hardcoded list in sw.js
      - A precache manifest generated from the content collections at build time
      - It crawls the site at runtime
      - The learner picks pages to save
    answer: 1
  - type: multiple_choice
    prompt: Why are page navigations network-first?
    options:
      - Caches are slow
      - So online visitors always get the newest deploy, with cache as the offline fallback
      - Browsers require it
      - To save storage
    answer: 1
  - type: true_false
    prompt: The service worker must be updated by hand when new lessons are added.
    answer: false
---

The [[indexeddb|IndexedDB]] copy covers a course's *data* — but offline you
also need the *pages*: HTML, scripts, styles. That's the
[[service-worker]]'s job.

## Precaching without a route list

At build time, the site generates a `precache.json` manifest from the
[[content-collection|content collections]] — every course, chapter, lesson,
test, glossary, and flashcard route. On install, the worker caches all of
them, then crawls the cached files for the fingerprinted assets they
reference. New content is automatically covered on the next deploy; nobody
maintains a route list.

## Serving strategies

- **Navigations are network-first**: online visitors always get the newest
  deploy, and the cache answers when the network can't.
- **Assets are stale-while-revalidate**: served instantly from cache,
  refreshed in the background. Asset filenames are content-fingerprinted, so
  staleness is bounded and harmless.

One deployment nicety: the worker derives every path from its registration
scope, so the same code works at a domain root or under a sub-path (the
`base` setting in `astro.config.mjs`) without edits.

## The PWA wrapper

A web app manifest (name, graduation-cap icons, theme colors) plus the
service worker make the site an installable [[pwa|PWA]]: home-screen icon,
its own window, fully offline. Nothing about the app requires installing it —
it's the same site either way, which is the point: progressive enhancement
all the way down.

That's the course. If you want to go deeper, the repository's Development
Guide covers the same ground with file-level detail — and the best next step
is to author a course of your own.
