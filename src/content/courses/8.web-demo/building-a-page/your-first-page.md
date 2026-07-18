---
title: Your First Page
web:
  lang: js
  starter:
    html: |
      <h1>Hello!</h1>
      <p>Edit me in the HTML tab.</p>
    css: |
      h1 {
        color: rebeccapurple;
      }
    js: |
      console.log('The JS tab runs as a module in the preview.');
---

Welcome to a **web exercise**. The workspace beside this text has three
tabs — **HTML**, **CSS**, and **JS** — and a live **preview** that rebuilds
as you type. Your HTML is the page body; the CSS and JS are injected around
it.

## Things to try

- Change the heading text in the HTML tab and watch the preview update.
- In the CSS tab, style the paragraph — try `p { font-style: italic; }`.
- Use **Emmet** in the HTML tab: type `ul>li*3` and press <kbd>Tab</kbd> to
  expand it into a list.
- In the JS tab, grab an element and change it:

```js
document.querySelector('h1').textContent = 'Hello from JS!';
```

Your work autosaves and survives reloads. **Reset to starter** puts all
three tabs back to the original code if you want a clean slate.

When you've made the page yours, press **Submit work** to complete the
lesson — there's no grading, just making.
