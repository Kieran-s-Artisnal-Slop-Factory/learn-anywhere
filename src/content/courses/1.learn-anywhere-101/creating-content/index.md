---
title: Creating Content
lessons:
  - files-and-folders
  - markdown-basics
  - frontmatter-settings
  - writing-questions
test:
  - type: multiple_choice
    prompt: A course's chapters live in which order?
    options:
      - Alphabetical by folder name
      - The order listed in the course's `chapters:` frontmatter
      - Newest first
      - The order the folders were created
    answer: 1
  - type: multiple_choice
    prompt: Which file is a chapter's main page?
    options:
      - chapter.md
      - main.md
      - index.md
      - readme.md
    answer: 2
  - type: true_false
    prompt: A lesson file named `test.md` is allowed.
    answer: false
  - type: multiple_choice
    prompt: "In markdown, what does `**text**` produce?"
    options:
      - Italic text
      - Bold text
      - A heading
      - Inline code
    answer: 1
  - type: multi_select
    prompt: Which of these mistakes will fail the build?
    options:
      - Listing a lesson in `lessons:` that has no file
      - A lesson file no chapter lists
      - A multiple-choice `answer` index out of range
      - Referencing a glossary term that doesn't exist
    answer: [0, 1, 2, 3]
  - type: multiple_choice
    prompt: What makes a lesson an exercise rather than a reading?
    options:
      - "Setting `kind: exercise` in frontmatter"
      - "Declaring a `quiz:` in frontmatter"
      - Putting it last in the chapter
      - Naming the file with an ex- prefix
    answer: 1
  - type: long_answer
    prompt: Sketch the frontmatter for a lesson titled "Hello" with one true/false question. (Written answers aren't auto-graded.)
---

The authoring test: files, wiring, markdown, and question syntax. Everything
here was covered in the four lessons — and remember the build is the final
examiner: if your content is wired wrong, `npm run build` fails before a
learner ever sees it.
