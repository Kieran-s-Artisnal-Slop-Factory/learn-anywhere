---
title: Building a Page
lessons:
  - your-first-page
test_web:
  lang: ts
  starter:
    html: |
      <main>
        <h1>Profile card</h1>
        <div id="card"></div>
      </main>
    css: |
      body { font-family: sans-serif; margin: 2rem; }
    js: |
      interface Person {
        name: string;
        role: string;
      }

      const person: Person = { name: 'Ada Lovelace', role: 'Engineer' };
      // Render the person into #card…
  instructions: |
    The chapter test — and a demonstration of a **web test** using
    **TypeScript** (types are stripped in the preview automatically).

    Build a small profile card:

    1. Style `#card` in the CSS tab: a border, padding, and rounded corners.
    2. In the TS tab, render the `person` object's name and role into
       `#card` (e.g. with `document.querySelector` and `innerHTML` or
       created elements).
    3. Check the preview, then press **Submit work**.

    There's no auto-grading — submitting records your work and completes
    the chapter.
---

One lesson on building a page from scratch, capped by a **web test**: a
full-page workspace where you build a small component and submit the result.
