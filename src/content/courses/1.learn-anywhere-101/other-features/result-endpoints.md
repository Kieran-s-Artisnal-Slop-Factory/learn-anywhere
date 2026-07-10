---
title: Result Endpoints
quiz:
  - type: multiple_choice
    prompt: What does result_endpoint add to a quiz or test?
    options:
      - Server-side grading
      - Cheat protection
      - A POST of each submission to a URL you host
      - A leaderboard
    answer: 2
  - type: multi_select
    prompt: What does the POSTed submission include?
    options:
      - Every question's prompt and the learner's response
      - The auto-graded score
      - The sender's name and email
      - The correct answers to grade against
    answer: [0, 1, 2]
  - type: true_false
    prompt: Result endpoints make quizzes secure enough for accredited exams.
    answer: false
  - type: short_answer
    prompt: Why does the platform require a profile before submitting to a result endpoint?
---

Auto-grading handles multiple choice, but "argue for or against X in a
paragraph" needs a human. The [[result-endpoint]] system is how written work
reaches one.

## How it works

Add one line next to a lesson's `quiz:` or a chapter's `test:`:

```yaml
result_endpoint: https://example.com/results
```

Every submission is then also POSTed there as standard form data: the
quiz/test identity, the auto-graded score, and — per question — the prompt,
the learner's response as readable text, and whether it was correct
(written answers arrive marked `ungraded`). The learner's name and email
travel as `x-sender-name` / `x-sender-email` headers, which is why these
forms **require a profile**: the form is disabled with a banner until name
and email are set in Settings.

The intended pattern mixes question types: auto-graded questions give the
learner instant feedback, `short_answer`/`long_answer` questions ride along
in the submission for you to mark later.

## What it is not

**A security boundary.** The correct answers are baked into the page — that's
how instant grading works offline — and the identity is whatever the learner
typed. Use it where trust exists but nuance is needed: internal training,
workshops, community courses. Accredited assessment needs a real backend.

Two practical notes: the endpoint must handle CORS (the custom headers
trigger a preflight), and the learner's local grading and completion succeed
even when the send fails — they get a retry button, so flaky conference WiFi
doesn't block their progress.
