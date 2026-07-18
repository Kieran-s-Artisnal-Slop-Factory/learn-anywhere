---
title: Using the web workspace
web:
  lang: js
  starter:
    html: |
      <h1>Welcome to the web workspace</h1>
      <p>Everything you type appears in the preview, live.</p>
      <button id="press-me">Press me</button>
    css: |
      body {
        font-family: sans-serif;
      }
      button {
        padding: 0.5rem 1rem;
      }
    js: |
      document.getElementById('press-me').addEventListener('click', () => {
        console.log('The console strip below the preview caught this.');
      });
---

The workspace beside this text is a small web development environment:
three editor tabs and a live preview of the page they build.

## The parts

- **HTML / CSS / JS tabs** — your page's body, its styles, and its script.
  Each tab keeps its own undo history; switching tabs never loses work,
  and everything **autosaves** as you type.
- **The preview** — rebuilds about half a second after you stop typing.
  It's sandboxed: your code can't touch the rest of the site. Use
  **Refresh** to re-run it deliberately.
- **Preview sizing** — the **Full / Tablet / Mobile** buttons set standard
  widths, and you can also **drag the preview's bottom-right corner** to
  any size you like (clicking a preset resets a drag).
- **The console** — `console.log` output and errors from your page appear
  in a strip under the preview. Click the starter's button to see it work.
- **Emmet** — in the HTML tab, type an abbreviation like `ul>li*3` and
  press <kbd>Tab</kbd> to expand it.

## Finishing and exporting

There's no grading — when you're happy with the page, press **Submit
work** to complete the lesson. The **Export…** menu downloads your work as
a zip of standalone files or as a PNG screenshot, and **Reset to starter**
returns all three tabs to the original code.

Chapter *tests* use this same workspace full-width with the task above it,
and if the site has a **Playground** link in the navigation, that's the
same editor as a free scratchpad.
