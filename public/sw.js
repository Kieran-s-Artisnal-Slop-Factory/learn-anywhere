/*
 * lite-learner service worker — full offline support.
 *
 * Strategy:
 *  - Install: precache every page, then crawl the cached HTML/JS/CSS for
 *    fingerprinted /_astro/ assets (including dynamically imported chunks) so
 *    the whole app works offline even for pages never visited.
 *  - Navigations (HTML): network-first so users always get the newest deploy
 *    when online; every successful response refreshes the cache, and when the
 *    network is unavailable the cached copy (or the cached home page) serves.
 *  - Assets: stale-while-revalidate — served from cache instantly, refreshed
 *    from the network in the background whenever it is reachable.
 */
const CACHE_NAME = 'lite-learner-cache-v1';
const PRECACHE = ['/', '/exercises/', '/courses/', '/chapters/', '/settings/', '/onboarding/', '/favicon.svg'];

// Servers often send `Vary: Origin`, and module import() requests carry an
// Origin header while our install-time fetches don't — without ignoreVary the
// cache would refuse to serve cached chunks to module loads.
const MATCH_OPTS = { ignoreVary: true };

/**
 * Cache every precache URL, then follow /_astro/ references found in cached
 * HTML/JS/CSS (Vite emits chunk paths as literal strings) until the full
 * asset graph is stored.
 */
async function precacheEverything() {
  const cache = await caches.open(CACHE_NAME);
  const seen = new Set(PRECACHE);
  const queue = [...PRECACHE];
  while (queue.length > 0) {
    const url = queue.shift();
    let response = await cache.match(url, MATCH_OPTS);
    if (!response) {
      try {
        response = await fetch(url);
        if (!response.ok) continue;
        await cache.put(url, response.clone());
      } catch {
        continue;
      }
    }
    const type = response.headers.get('content-type') || '';
    if (!/html|javascript|css/.test(type)) continue;
    const text = await response.clone().text();
    const enqueue = (path) => {
      if (path.startsWith('/_astro/') && !seen.has(path)) {
        seen.add(path);
        queue.push(path);
      }
    };
    // Absolute references (HTML tags, dynamic import() chunk paths).
    for (const match of text.matchAll(/\/_astro\/[A-Za-z0-9_.\-]+/g)) {
      enqueue(match[0]);
    }
    // Relative references (Vite emits static imports as "./chunk.js").
    const base = new URL(url, self.location.origin);
    for (const match of text.matchAll(/['"](\.{1,2}\/[A-Za-z0-9_.\-/]+)['"]/g)) {
      try {
        enqueue(new URL(match[1], base).pathname);
      } catch {
        // not a resolvable path — ignore
      }
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheEverything().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network-first: fresh page when online, cached page offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request, MATCH_OPTS).then((cached) => cached ?? caches.match('/', MATCH_OPTS))
        )
    );
    return;
  }

  // Stale-while-revalidate for everything else.
  event.respondWith(
    caches.match(request, MATCH_OPTS).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? refresh;
    })
  );
});
