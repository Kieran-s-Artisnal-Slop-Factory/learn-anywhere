---
title: Markdown Basics
quiz:
  - type: multiple_choice
    prompt: "How do you write a second-level heading? ## Like This"
    options:
      - "# Heading"
      - "## Heading"
      - "**Heading**"
      - "<h2>Heading</h2> only"
    answer: 1
  - type: multiple_choice
    prompt: "What does `[label](https://example.com)` produce?"
    options:
      - An image
      - A code block
      - A link labelled "label"
      - A footnote
    answer: 2
  - type: multi_select
    prompt: Select which produce *emphasis* and **strong** text?
    options:
      - "*single asterisks*"
      - "**double asterisks**"
      - "~~tildes~~"
      - "`backticks`"
    answer: [0, 1]
---

Lesson bodies are plain markdown — the same syntax as GitHub readmes. If you
know it, skip to the quiz. If not, this is 90% of what you'll use (with more details [here](https://www.markdownguide.org/basic-syntax/)):

## The essentials

```markdown
## A heading            (# = h1, ## = h2, ### = h3…)

Plain paragraphs are just text separated by blank lines.

**bold**, *italic*, and `inline code`.

- a bullet list
- with items

1. a numbered list
2. in order

[a link](https://example.com)

> a quote block
```

Fenced code blocks get syntax highlighting automatically:

````markdown
```js
const x = 1;
```
````

## Two platform extras

Beyond standard markdown, lesson bodies support **glossary references** —
`[[term]]` or `[[term|display text]]` — which become hoverable definition
links. 

For example `[[frontmatter|Frontmetter]]` becomes [[frontmatter|Frontmatter]] (More on authoring those in chapter 3.)

And remember the split: the markdown *body* is prose; everything structured —
titles, quizzes, ordering — lives in the frontmatter above it, which the next
lesson covers.
