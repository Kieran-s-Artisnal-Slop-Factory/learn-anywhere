---
title: Tracking Your Progress
quiz:
  - type: multiple_choice
    prompt: Where is your progress stored?
    options:
      - On the course author's server
      - In your browser, on this device
      - In a cookie shared across devices
      - Nowhere — it resets every visit
    answer: 1
  - type: true_false
    prompt: Exporting a backup from Settings is the only way to move your progress to another device.
    answer: true
  - type: multiple_choice
    prompt: What does the courses page show for a course you're enrolled in?
    options:
      - Lessons completed
      - Overall score percentage
      - Quiz and test score breakdowns
    all_of_the_above: true
    answer: all
---

Everything you do in a course is recorded — locally.

## What gets tracked

Opening a lesson stamps it *started*; submitting its quiz (or marking it
read) stamps it *completed*. Completions cascade upward: when every lesson in
a chapter is done (and its test taken, if it has one) the chapter completes,
and when every chapter completes, so does the course.

Scores are kept too. The **Courses** page shows each enrolled course with a
progress bar, lessons completed, and your average across quizzes and tests —
that's the at-a-glance "how am I doing" view. The **Home** page shows what's
in progress and what you finished recently.

## Where it lives — and how to keep it

All of this sits in your browser's [[indexeddb|IndexedDB]] storage. No
account means no sync: this device holds the only copy. Two things protect
it:

1. **Persistent storage** — requested during onboarding, it asks the browser
   not to evict the data under storage pressure.
2. **Backups** — Settings → Backup exports everything as one JSON file, and
   can import it again (on this device or another).

If you clear your browser data for this site, your progress goes with it —
export first.
