---
term: Content hash
short: A fingerprint of each piece of content, computed at build time; comparing it against the cached copy tells the app exactly what to refresh — without touching progress.
---

Every course, chapter, and lesson payload is stamped at build time with a
SHA-256 hash of its content (frontmatter + body). The copy cached in your
browser by [[enrollment]] carries the same stamp.

On each visit the page's embedded hash is compared with the cached row:

- **no cached row** → create it (first contact with this content);
- **hashes differ** → the author changed something: overwrite the *content*
  fields and keep the *progress* fields (started, completed, answers,
  scores) untouched;
- **hashes match** → the cache is current, use it as-is.

This is why editing a lesson is safe for learners' progress, while *renaming*
its file is not — the file name is the record's identity, so a rename looks
like brand-new content.
