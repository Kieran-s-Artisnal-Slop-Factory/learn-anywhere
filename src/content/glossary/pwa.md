---
term: PWA
short: Progressive Web App — a website that can be installed like a native app, with an icon, its own window, and offline support.
---

A Progressive Web App is a website with the extras that let a browser treat
it like an installable application: a **web app manifest** (name, icons,
colors, display mode) and a [[service-worker]] providing offline behavior.

Learn Anywhere ships both, so on most platforms you can "install" it from the
browser menu: it gets a home-screen/desktop icon, opens in its own window,
and — because enrolled courses live in [[indexeddb|IndexedDB]] and pages are
precached — works fully offline once installed.

Installation is entirely optional; the site behaves identically in a normal
browser tab.
