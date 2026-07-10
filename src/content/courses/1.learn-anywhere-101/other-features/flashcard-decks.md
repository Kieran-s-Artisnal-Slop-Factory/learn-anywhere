---
title: Flashcard Decks
quiz:
  - type: multiple_choice
    prompt: What is stored between flashcard practice sessions?
    options:
      - Your accuracy per card
      - Which cards you've mastered
      - Nothing — practice is session-only
      - The date of your last session
    answer: 2
  - type: multiple_choice
    prompt: When does a practice round end?
    options:
      - After a fixed time
      - When every card has been answered correctly once
      - After one pass, misses included
      - When you close the tab
    answer: 1
  - type: true_false
    prompt: Card fronts and backs support full markdown formatting.
    answer: false
---

The **Flashcards** entry in the navigation leads to practice decks — quick
self-testing that lives alongside courses rather than inside them. Try the
decks that ship with this course after the lesson.

## Practicing

A deck is shuffled into a queue. Each card shows its front; click it (or
press Space) to reveal the back, then judge yourself: **Got it** removes the
card from the round, **Again** sends it to the back of the queue to come
around once more. The round ends when every card has been answered correctly
once, with a summary of how many needed repeats. Keyboard shortcuts: Space or
Enter flips, `1` = got it, `2` = again.

Practice is deliberately **session-only** — nothing is recorded. Flashcards
are a drill, not an assessment; quizzes and [[chapter-test|tests]] are where
scores live.

## Authoring a deck

**One markdown file per deck** in `src/content/flashcards/`; cards are plain-text
front/back pairs in [[frontmatter]], and the body is the deck's description:

```yaml
---
title: My Deck
cards:
  - front: The question side
    back: The answer side
  - front: Another question
    back: Another answer
---
Shown on the deck page — say which course this deck accompanies.
```

Fronts and backs are plain text (no markdown, no glossary links); the
description supports both. A deck needs at least one card — the build
enforces it.
