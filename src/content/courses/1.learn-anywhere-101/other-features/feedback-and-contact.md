---
title: Feedback and Contact
quiz:
  - type: multiple_choice
    prompt: Where is the feedback feature turned on?
    options:
      - In each course's frontmatter
      - In astro.config.mjs, via contactEndpoint
      - In the Settings page
      - It's always on
    answer: 1
  - type: multiple_choice
    prompt: What subject does the per-lesson feedback button use?
    options:
      - The learner types one
      - "Feedback: <lesson name> <url>"
      - The course title
      - The lesson's slug
    answer: 1
  - type: true_false
    prompt: Sending feedback requires the learner to set a name and email first.
    answer: false
---

A static site has no inbox — but course authors still want to hear "this
question is ambiguous" or "this chapter needs an example". The contact system
bridges that with one config value.

## Turning it on

In `astro.config.mjs`:

```js
const contactEndpoint = 'https://example.com/feedback';
```

You host that endpoint yourself — anything that accepts a standard form POST
(fields: `subject`, `message`, plus `sender_name`/`sender_email` when the
learner has a profile set). Leave it as an empty string and the feature
vanishes from the site entirely — which is why you may not see it in this
copy of the course.

## What learners get

When configured, two things appear:

1. a **"Give us feedback on this lesson"** button at the bottom of every
   lesson and test page — it opens a small form whose subject is fixed to
   `Feedback: <lesson name> <url>`, so reports arrive pre-labelled with
   exactly where the learner was;
2. a **Contact** link in the navigation, for general messages with a custom
   subject.

Unlike [[result-endpoint|result endpoints]], feedback doesn't require a
profile — name and email are attached when present, but anonymous feedback
goes through fine.
