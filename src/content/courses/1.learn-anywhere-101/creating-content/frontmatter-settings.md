---
title: Frontmatter Settings
quiz:
  - type: multiple_choice
    prompt: What is [[frontmatter]]? (Notice the glossary link — prompts are markdown too.)
    options:
      - An image format
      - The metadata block at the top of a file controlling the title, quizzes, etc.
      - A CSS framework
      - The first paragraph of a lesson
    answer: 1
  - type: multiple_choice
    prompt: What fences (comes before and after) a frontmatter block?
    options:
      - Triple backticks
      - Three idashes in a row, on their own lines
      - Curly braces
      - An XML tag
    answer: 1
  - type: multiple_choice
    prompt: Where is a chapter's lesson ORDER defined?
    options:
      - Alphabetically by filename
      - In each lesson's `order:` field
      - In the order they appear in chapters index.md's lessons list
      - In src/content.config.ts
    answer: 2
  - type: true_false
    prompt: A lesson file that exists but isn't listed in any chapter's `lessons:` fails the build.
    answer: true
---

[[frontmatter|Frontmatter]] is the YAML block between `---` fences at the top
of every content file. The body below it is what learners read; the
frontmatter is what the platform reads.

## What each file declares

```yaml
# course index.md — title + chapter FOLDER names, in display order
---
title: My Course
chapters:
  - first-chapter
  - second-chapter
---

# chapter index.md — title + lesson FILE names (minus .md), in order
---
title: First Chapter
lessons:
  - some-lesson
  - another-lesson
test:            # optional — adds the chapter test
  - type: true_false
    prompt: …
    answer: true
---

# a lesson — title, plus an optional quiz
---
title: Some Lesson
quiz:
  - type: multiple_choice
    prompt: …
    options: [a, b, c]
    answer: 0
---
```

## Wiring is explicit — and checked

Parents list their children, and the *array order is the display order*.
There's no alphabetical magic and no `order:` numbers to maintain. The build
verifies the wiring both ways: listing a file that doesn't exist fails, and a
file that exists but is listed nowhere ("orphaned" content that would be
invisible) fails too.

A lesson's kind falls out of its frontmatter: `quiz:` present makes it an
[[exercise]], absent makes it a reading. You never declare it.
