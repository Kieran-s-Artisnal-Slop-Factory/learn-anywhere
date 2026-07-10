---
title: Files and Folders
quiz:
  - type: multiple_choice
    prompt: Where do course files live?
    options:
      - src/content/courses/
      - public/courses/
      - src/pages/courses/
      - courses/
    answer: 0
  - type: true_false
    prompt: Renaming a lesson file is harmless — learners keep their progress for it.
    answer: false
  - type: multiple_choice
    prompt: Why is `test` a forbidden lesson filename?
    options:
      - It's confusing for learners
      - That URL is reserved for the chapter test page
      - Test files are ignored by the build
      - It clashes with the vitest test runner
    answer: 1
---

Courses are nothing more than folders of markdown. Here's the entire
structure:

```
src/content/courses/
  my-course/               ← course folder (name = URL segment)
    index.md               ← the course page
    first-chapter/         ← chapter folder
      index.md             ← the chapter page (can declare a test)
      some-lesson.md       ← a lesson (can declare a quiz)
      another-lesson.md
```

Three rules carry all the weight:

1. **Names are identity.** A folder or file name becomes the URL
   (`/courses/my-course/first-chapter/some-lesson/`) *and* the key learner
   progress is stored under. Renaming a file is publishing new content —
   everyone's progress for it resets. Pick names you can live with.
2. **`index.md` is the parent.** A course folder's `index.md` is the course
   page; a chapter folder's is the chapter page. Everything else in a chapter
   folder is a lesson.
3. **`test` is reserved.** The chapter test renders at
   `/courses/<course>/<chapter>/test/`, so a lesson file named `test.md` is
   rejected at build time.

Content is validated by a [[content-collection]] on every build, so a broken
structure can't ship — you find out at `npm run build`, not from a learner's
bug report.
