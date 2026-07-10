---
title: Authoring Glossary Terms
quiz:
  - type: multiple_choice
    prompt: Where do glossary term files live?
    options:
      - src/content/glossary/
      - src/glossary/
      - public/glossary/
      - Inside each course folder
    answer: 0
  - type: multiple_choice
    prompt: Which frontmatter field provides the popup description?
    options:
      - description
      - summary
      - short
      - popup
    answer: 2
  - type: true_false
    prompt: After adding a new term you must restart the dev server for references to resolve.
    answer: true
---

You've been hovering glossary links all course — here's the whole system from
the authoring side.

## One file per term

Each term is a markdown file in `src/content/glossary/`. The file name is the
slug you reference; the frontmatter carries the display name and the popup
text; the body is the term's landing page:

```yaml
---
term: Service worker
short: A background script that intercepts requests and serves cached responses.
---
The full landing-page article goes here, at /glossary/service-worker/.
```

Keep `term` and `short` each on a single line — the reference resolver reads
them with a deliberately minimal parser.

## Referencing terms

Anywhere in course markdown (and in other glossary entries):

```
[[service-worker]]                  → links as "Service worker"
[[service-worker|service workers]]  → your own display text
```

The default display is the `term` field verbatim, so use the `|` form for
mid-sentence casing or plurals. References inside code blocks are left alone
— that's how this lesson shows the syntax without triggering it.

## The safety net, and one gotcha

An unknown slug fails the build, same as broken chapter wiring — you can't
ship a dangling reference. The gotcha: the term list is loaded when the dev
server starts, so after *adding* a term, restart `npm run dev` before
referencing it.
