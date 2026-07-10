---
term: Enrollment
short: Copying a course into your browser's local storage so it works offline — no account, no server, just a button.
---

Enrolling in a course on Learn Anywhere doesn't create an account anywhere —
there is no server to create it on. Instead, the whole course (every chapter,
lesson, quiz, and test) is copied into your browser's [[indexeddb|IndexedDB]]
storage.

From that point on the course is *yours*: progress, quiz answers, and test
scores are stored next to the copied content, on your device only. After the
first visit, the course keeps working with no connection at all.

## Keeping content fresh

When the course author publishes an update, the [[content-hash]] mechanism
notices the difference on your next online visit and refreshes the copied
content — without touching your progress.
