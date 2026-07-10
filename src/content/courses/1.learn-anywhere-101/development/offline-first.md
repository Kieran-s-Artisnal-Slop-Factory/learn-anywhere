---
title: The Offline-First Data Model
quiz:
  - type: multiple_choice
    prompt: What are the two kinds of data on a cached lesson row?
    options:
      - Public and private
      - Cached content and per-visitor progress
      - Hot and cold
      - Synced and unsynced
    answer: 1
  - type: multiple_choice
    prompt: A content hash differs between the page and the cache. What happens?
    options:
      - The row is deleted and recreated
      - Content fields refresh; progress fields are preserved
      - The learner is asked to re-enroll
      - Nothing until the next enrollment
    answer: 1
  - type: true_false
    prompt: Completion is stored as a boolean flag.
    answer: false
---

The interesting engineering problem: content is published by a build, but
progress belongs to a browser. How do the two stay consistent with no server
between them?

## One row, two halves

[[enrollment|Enrolling]] copies every course, chapter, and lesson into
[[indexeddb|IndexedDB]], keyed by its slug. Each row holds:

- **cached content** — title, body, quiz/test questions, and the
  [[content-hash]] they were built with;
- **progress** — `started` and `completed` timestamps, quiz responses and
  scores.

Completion is always a nullable timestamp, never a boolean — "is complete"
derives from `completed != null`, and the timestamp doubles as history for
the home dashboard. Completions cascade: lesson → chapter (when all lessons
and the test are done) → course.

## Reconciliation, the whole algorithm

On every page load, the embedded content payload is compared with the cached
row:

1. no row → create it;
2. hash differs → overwrite the content half, *keep the progress half*;
3. hash matches → cache is current.

That's it. Publishing a fixed typo flows to learners on their next online
visit without touching their progress — but a *renamed* file has a new slug,
so it's a new row and old progress orphans. Names are identity.

## Bookkeeping for a future that may come

Every row also carries `updated_at` and a soft-delete tombstone. There's no
sync backend today, but the fields mean adding one later wouldn't need a data
migration. Speaking of migrations: the IndexedDB schema evolves through an
append-only migration list — a shipped migration is never edited, only
followed.
