---
term: Static site generation
short: Building every page of a site ahead of time into plain HTML/CSS/JS files, so hosting needs no server code — just a place to put files.
---

Static site generation (SSG) means every page is rendered once, at build
time, into ordinary files. There's no application server answering requests —
any static file host (GitHub Pages, an S3 bucket, a folder behind nginx) can
serve the whole site.

Learn Anywhere is fully static: `npm run build` turns the markdown content
into a `dist/` folder of HTML, and that folder *is* the deployment. This is
what makes hosting effectively free and the site trivial to move between
hosts.

The trade-off is that nothing can happen on a server — which is why progress
lives in the browser ([[indexeddb|IndexedDB]]), why interactivity comes from
[[island-architecture|islands]], and why grading runs client-side.
