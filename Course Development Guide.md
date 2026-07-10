# Course Development Guide

How to author courses, quizzes, chapter tests, and glossary terms. For the
system architecture, see the [Development Guide](Development%20Guide.md).

## Layout

One folder per course, one sub-folder per chapter, lesson files inside:

```
src/content/courses/
  1.effective-learning/            ← course folder (name = slug = URL segment)
    index.md                       ← the COURSE page
    memory-fundamentals/           ← chapter folder
      index.md                     ← the CHAPTER page (may declare a test)
      how-memory-works.md          ← a LESSON (may declare a quiz)
src/content/glossary/
  active-recall.md                 ← one glossary TERM per file
```

Folder/file names become ids and URLs (`/courses/<course>/<chapter>/<lesson>/`),
so rename them only if you accept resetting visitors' progress for that item.
`test` is a **reserved lesson filename** — it's the chapter-test route.

## Wiring and ordering

Parents list their children, and array order IS display order:

```yaml
# course index.md
title: Effective Learning
chapters:
  - memory-fundamentals      # folder names, relative to the course folder
  - study-techniques

# chapter index.md
title: Memory Fundamentals
lessons:
  - how-memory-works         # file names minus .md
  - the-forgetting-curve
```

The build fails on a listed child that doesn't exist and on files no parent
lists — broken wiring can't ship.

## Lessons: readings and exercises

A lesson's markdown body is the left-hand prose. Its kind is derived:

- **No `quiz`** → a *reading* lesson, completed with "Mark as read".
- **`quiz` present** → an *exercise*, completed by submitting the quiz (any
  score completes it; the score is recorded and shown in the course overview).

## Questions (quizzes and tests share this format)

`quiz:` (lessons) and `test:` (chapter `index.md`) are arrays of questions.
Four types:

```yaml
quiz:
  # Multiple choice: 2–5 options, rendered a–e. `answer` is a 0-based index.
  - type: multiple_choice
    prompt: When does forgetting begin?
    options:
      - Within hours
      - After a week
      - After a month
    answer: 0

  # All/None of the above are opt-in PER QUESTION and appended after the
  # authored options. `answer: all` / `answer: none` selects them, or keep a
  # numeric answer to use them as distractors.
  - type: multiple_choice
    prompt: Which strategies help?
    options:
      - Breaking material into small pieces
      - Chunking related facts
    all_of_the_above: true
    none_of_the_above: true
    answer: all

  # True / false.
  - type: true_false
    prompt: Forgetting begins within hours.
    answer: true

  # Multi-select: `answer` is the exact set of correct option indices.
  - type: multi_select
    prompt: Which are mnemonic devices?
    options: [An acronym, A vivid image, Re-reading, A story]
    answer: [0, 1, 3]

  # Short answer: free text, stored on the device for review, never graded
  # and excluded from the score.
  - type: short_answer
    prompt: Explain the forgetting curve in your own words.
```

Answer indices are validated at build time (out-of-range indices, `all`
without `all_of_the_above`, duplicate multi-select indices all fail the
build).

Grading: unanswered questions can't be submitted; each gradable question is
right or wrong (no partial credit on multi-select); the score is
`correct/gradable`. Retakes are allowed and overwrite the stored responses
and score.

## Chapter tests

Add `test:` to a chapter's `index.md` to generate a full-page test at
`/courses/<course>/<chapter>/test/`. The chapter's body text is shown on the
chapter page as usual; the test page renders just the questions, full width.

A chapter with a test is only **complete** once every lesson is done *and*
the test has been submitted. The last lesson's "next" button, the chapter
page, and the course overview all link to the test.

## Flashcard decks

One file per deck in `src/content/flashcards/`; the file name is the deck's
slug (`/flashcards/<file-name>/`). Cards are plain text, front and back, in
frontmatter; the markdown body is the deck description shown on the deck page
and (first paragraph) in the deck listing:

```yaml
---
title: Learning Science Terms
cards:
  - front: What is active recall?
    back: Retrieving information from memory instead of re-reading it.
  - front: Roughly how many chunks can working memory hold?
    back: About four.
---
Key vocabulary from the Effective Learning course.
```

Practice is **session-only** (nothing is stored): the deck is shuffled, each
card is revealed then marked "Got it" or "Again", and "Again" cards return to
the back of the queue until every card has been answered correctly once. A
round summary reports how many cards needed repeats. Keyboard shortcuts:
Space/Enter flips, `1` = got it, `2` = again.

Notes:

- `front`/`back` are plain text — markdown and `[[glossary]]` syntax are not
  rendered inside cards (the deck *description* supports both).
- A deck must have at least one card (build-enforced).
- Decks are standalone; they aren't tied to a course, so use the description
  to say which course/chapter they accompany.

## Glossary terms

One file per term in `src/content/glossary/`:

```yaml
---
term: Active recall            # display name (popup title, default link text)
short: Deliberately retrieving information from memory instead of re-reading it.
---
The markdown body — the term's landing page at /glossary/<file-name>/.
```

Keep `term` and `short` on a single line each — the remark plugin reads them
with a minimal parser.

Reference terms from any markdown body (courses, chapters, lessons, other
glossary entries):

```
[[active-recall]]                  → links as "Active recall"
[[active-recall|active recall]]    → links with your own display text
```

Readers get a popup with the short description and a "Read more" link to the
landing page. Notes:

- The file name (minus `.md`) is the slug you reference. Unknown slugs fail
  the build.
- The plugin loads the term list when the dev server starts — **restart `npm
  run dev` after adding a term**.
- References inside code blocks and `inline code` are left alone.
- Use the `|display` form for mid-sentence casing (the default display is the
  `term` field verbatim).

## Checklist for a new course

1. Create the course folder + `index.md` (title, `chapters:` list, body).
2. Create each chapter folder + `index.md` (title, `lessons:` list, optional
   `test:`, body).
3. Write lessons; add `quiz:` to the ones that should be exercises.
4. Add/reference glossary terms as you go.
5. `npm run build` — fix anything it reports (wiring, schema, glossary).
6. Walk through it on the dev server: enroll, take a quiz, take a test, and
   check the score overview on /courses/.
