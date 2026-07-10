---
term: Service worker
short: A background script the browser runs between your site and the network, able to intercept requests and serve cached responses — the engine behind offline support.
---

A service worker is a script the browser installs alongside a site and runs
in the background, separate from any page. It sits between the site and the
network: every request the site makes can be intercepted, answered from a
cache, or passed through.

Learn Anywhere's service worker (`public/sw.js`) makes the whole app work
offline after the first visit:

- on install it **precaches** every page, using a build-generated manifest of
  routes, then crawls the cached files for the fingerprinted assets they
  reference;
- page navigations are **network-first** (fresh content when online, cached
  pages when not);
- assets are **stale-while-revalidate** (served instantly from cache,
  refreshed in the background).

Together with the [[indexeddb|IndexedDB]] copy of enrolled courses, this is
the offline half of the [[pwa|PWA]] story.
