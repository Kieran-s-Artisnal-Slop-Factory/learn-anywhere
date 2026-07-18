---
title: Other Features
lessons:
  - glossary-authoring
  - flashcard-decks
  - feedback-and-contact
  - result-endpoints
  - interface-walkthroughs
test:
  - type: multiple_choice
    prompt: What defines a glossary term?
    options:
      - A row in a database
      - One markdown file with `term` and `short` frontmatter
      - An entry in astro.config.mjs
      - A heading in any lesson
    answer: 1
  - type: true_false
    prompt: Referencing a glossary term that doesn't exist fails the build.
    answer: true
  - type: multiple_choice
    prompt: What happens to flashcards you mark "Again"?
    options:
      - They're removed from the deck
      - They return to the back of the queue for this round
      - They're saved for tomorrow
      - Nothing — the button is cosmetic
    answer: 1
  - type: multiple_choice
    prompt: The contact/feedback feature appears only when…
    options:
      - The learner sets a profile
      - "`contactEndpoint` is set in astro.config.mjs"
      - The course declares it in frontmatter
      - The site is installed as an app
    answer: 1
  - type: multi_select
    prompt: Which are true of result endpoints?
    options:
      - Submissions are POSTed as standard form data
      - The sender's name and email travel as x-sender-* headers
      - They make quizzes cheat-proof
      - The learner must set a profile before submitting
    answer: [0, 1, 3]
  - type: multiple_choice
    prompt: A site wants only the quiz walkthrough from the Platform walkthrough course. What does its config look like?
    options:
      - "`interfaceTutorials` with only `quizes: true`"
      - "`runtimes: ['quiz']`"
      - It must delete the other chapters' files
      - Impossible — the course is all-or-nothing
    answer: 0
  - type: long_answer
    prompt: Describe a scenario where a result endpoint fits better than pure auto-grading.
---

Glossary, flashcards, feedback, result endpoints, and interface
walkthroughs — the systems around the lessons. This test covers all five.
