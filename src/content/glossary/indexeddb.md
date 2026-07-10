---
term: IndexedDB
short: The browser's built-in structured database — where Learn Anywhere stores enrolled courses, progress, and scores, entirely on your device.
---

IndexedDB is a database built into every modern browser: structured records,
indexes, and transactions, stored per-site on the user's device. Unlike
localStorage it comfortably holds large, structured data.

Learn Anywhere uses it as the *only* data store. [[enrollment|Enrolling]]
copies a course's content into IndexedDB, and everything you do — starting
lessons, submitting quizzes, taking tests — is written next to it. There is
no server copy; the Settings page offers a JSON export precisely because
this device holds the only one.

One caveat: browsers treat IndexedDB as evictable cache under storage
pressure. The app requests "persistent storage" permission during onboarding
to make eviction much less likely, and backups cover the rest.
