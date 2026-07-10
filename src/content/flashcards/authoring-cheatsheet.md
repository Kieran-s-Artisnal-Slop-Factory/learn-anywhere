---
title: Authoring Cheatsheet
cards:
  - front: Which file is a course's or chapter's main page?
    back: index.md — everything else in a chapter folder is a lesson.
  - front: How is lesson order decided?
    back: The chapter index.md's `lessons:` list — array order is display order.
  - front: Which lesson filename is reserved?
    back: test — it's the chapter-test route.
  - front: How do you write a multiple-choice answer?
    back: "answer: <0-based index into options>, or 'all'/'none' when those options are enabled."
  - front: How do you enable "All of the above" on one question?
    back: "all_of_the_above: true — it's appended after the authored options; use answer: all to make it correct."
  - front: What fails the build?
    back: Broken wiring (missing/orphaned files), invalid answers, unknown glossary references, schema errors.
  - front: How do you reference a glossary term with custom display text?
    back: "[[slug|display text]] — plain [[slug]] shows the term's name."
  - front: What does result_endpoint do?
    back: POSTs every submission (answers + score + sender identity) to a URL you host, for human marking.
---

Quick-fire recall for course authors — pairs with the Creating Content and
Other Features chapters of Learn Anywhere 101.
