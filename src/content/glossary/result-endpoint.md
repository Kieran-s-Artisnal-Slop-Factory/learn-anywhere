---
term: Result endpoint
short: An optional URL a quiz or test can declare; submissions are POSTed there so a person can mark written answers. Explicitly not secure — for non-accredited use.
---

A quiz or test can declare `result_endpoint: <url>` in its [[frontmatter]].
When it does, every submission is also sent to that URL as a standard form
POST — the learner's answers, the auto-graded score, and their name and email
(from their profile, which becomes required for these forms).

The point is nuance: multiple choice grades itself, but short and long answer
questions need a human. A result endpoint lets a course author collect whole
submissions and mark the written parts later.

**It is not a security feature.** The correct answers are baked into the page
and the sender identity is self-reported. It's intended for settings that
aren't accredited but want richer evaluation — internal training, workshops,
community courses.
