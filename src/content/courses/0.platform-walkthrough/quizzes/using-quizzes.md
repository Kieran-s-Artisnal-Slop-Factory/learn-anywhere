---
title: Using quizzes and tests
quiz:
  - type: multiple_choice
    prompt: "**Multiple choice** — pick exactly one option. Try it: which answer is labelled *c*?"
    options:
      - The first option
      - The second option
      - This one
      - The fourth option
    answer: 2
  - type: true_false
    prompt: "**True / false** — two buttons, one truth. This quiz saves your answers when you submit."
    answer: true
  - type: multi_select
    prompt: "**Multi-select** — tick every option that applies (checkboxes instead of radio buttons). Select the two even numbers."
    options:
      - "1"
      - "2"
      - "3"
      - "4"
    answer: [1, 3]
  - type: numeric
    prompt: "**Numeric** — type the answer instead of picking it. Enter every factor of 6, comma-separated, in any order."
    answer: [1, 2, 3, 6]
    integer: true
    positive: true
  - type: short_answer
    prompt: "**Short answer** — free text, never auto-graded and not counted in your score. Say hello."
---

This lesson *is* the walkthrough: the quiz beside this text contains one
question of every kind, each prompt explaining its own interface. Answer
them all, then come back to this checklist.

## The mechanics

- **Answering** — radio buttons pick one, checkboxes pick several, numeric
  questions take typed numbers (the input warns as you type if it can't
  read what you wrote), and written answers are plain text boxes.
- **Submitting** — the submit button unlocks once every question has an
  answer. Submitting grades the quiz instantly, marks the lesson complete,
  and shows your score.
- **After grading** — correct choices are highlighted; a wrong numeric
  answer reveals what was expected. Written answers are recorded but never
  graded, and they don't count toward the score.
- **Retakes** — you can resubmit as often as you like; the newest attempt
  replaces the old one everywhere scores are shown.
- **Scores** — the enrolled-courses page tracks your quiz and test results
  per course. Depending on the site's configuration, partially correct
  multi-select and numeric answers may earn partial marks.

## Chapter tests

Some chapters end with a **test**: the same question interface on its own
full page, reached from the last lesson of the chapter or the chapter page.
Completing a chapter requires finishing its lessons *and* its test. Some
quizzes and tests also send your submission to the course team for human
marking — those will tell you so, and ask for your name and email in
Settings first.
