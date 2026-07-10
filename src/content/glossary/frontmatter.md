---
term: Frontmatter
short: The YAML block between --- fences at the top of a markdown file, holding structured settings like the title, quiz questions, or chapter list.
---

Frontmatter is the block of YAML between `---` fences at the very top of a
markdown file. The text below the fences is the page's prose; the frontmatter
is its *settings*.

```yaml
---
title: My Lesson
quiz:
  - type: true_false
    prompt: Frontmatter is written in YAML.
    answer: true
---
The lesson text starts here.
```

On Learn Anywhere, frontmatter is where everything structured lives: lesson
titles, quiz and test questions, a course's chapter order, a glossary term's
short description, a flashcard deck's cards. Every field is validated at
build time by a [[content-collection]] schema, so a typo like `anwser:` fails
the build instead of shipping broken.
