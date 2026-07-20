/*
 * learn-anywhere service worker — full offline support.
 *
 * Strategy:
 *  - Install: precache the app shell only, then hand control over. The much
 *    larger asset graph is crawled AFTER activation, slowly, in the
 *    background (see `warmAssetCache`).
 *  - Navigations (HTML): network-first so users always get the newest deploy
 *    when online; every successful response refreshes the cache, and when the
 *    network is unavailable the cached copy (or the cached home page) serves.
 *  - Assets: stale-while-revalidate — served from cache instantly, refreshed
 *    from the network in the background whenever it is reachable.
 *
 * Why the crawl is throttled: a published course's asset graph can run to
 * hundreds of fingerprinted chunks (mermaid, Shiki, diagrams, images).
 * Fetching them back-to-back on install made static hosts — GitHub Pages
 * especially — rate-limit the burst with 503s, and the app's OWN dynamic
 * imports got caught in the same limit ("Failed to fetch dynamically imported
 * module"). Precaching is a nicety; never let it break the running app.
 */
const CACHE_NAME = 'learn-anywhere-cache-v2';

// The worker is served from `${base}/sw.js`, so its registration scope IS the
// configured Astro base ('/' on root deploys, '/repo/' on subpath deploys
// like GitHub Pages). Deriving every path from it keeps the precache correct
// without hardcoding the base in two places.
const BASE = new URL(self.registration.scope).pathname; // always ends with '/'
const ASSET_PREFIX = BASE + '_astro/';
// Fallback when the build-time manifest can't be fetched. precache.json is
// generated from the content collections and includes every course, chapter,
// and exercise page.
const PRECACHE_FALLBACK = ['', 'courses/', 'glossary/', 'settings/', 'onboarding/', 'favicon.svg'];

// Background-crawl pacing. Slow on purpose — nothing waits on this.
const CRAWL_DELAY_MS = 120;
const CRAWL_MAX_ASSETS = 800;

// Statuses a busy static host returns for a burst that it would serve fine a
// moment later. Worth retrying instead of failing the request.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function precacheList() {
  try {
    const response = await fetch(BASE + 'precache.json');
    if (response.ok) {
      const paths = await response.json();
      if (Array.isArray(paths)) return paths.map((path) => BASE + path);
    }
  } catch {
    // offline install retry / manifest missing — fall through
  }
  return PRECACHE_FALLBACK.map((path) => BASE + path);
}

// Servers often send `Vary: Origin`, and module import() requests carry an
// Origin header while our install-time fetches don't — without ignoreVary the
// cache would refuse to serve cached chunks to module loads.
const MATCH_OPTS = { ignoreVary: true };

/**
 * fetch() that rides out a rate-limited/overloaded host. Resolves with the
 * last response even if it is still an error, so callers can decide; only a
 * genuine network failure rejects.
 */
async function fetchWithRetry(request, attempts = 3) {
  let lastResponse;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(request);
      if (!RETRYABLE.has(response.status)) return response;
      lastResponse = response;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts - 1) await sleep(250 * 2 ** attempt);
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}

/** Cache a response we already know is good. Never rejects the caller. */
function store(request, response) {
  const copy = response.clone();
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, copy))
    .catch(() => {});
}

/** The app shell: the pages and icons listed in the build-time manifest. */
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const urls = await precacheList();
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetchWithRetry(url);
        if (response.ok) await cache.put(url, response.clone());
      } catch {
        // A missing shell entry is not worth failing the install over.
      }
    })
  );
}

/**
 * Walk the cached HTML/JS/CSS for fingerprinted /_astro/ references (Vite
 * emits chunk paths as literal strings) and cache them, so lazily-imported
 * features work offline too. Runs after activation, one file at a time with
 * a pause between each, so it never competes with the app for the host's
 * rate limit.
 */
async function warmAssetCache() {
  const cache = await caches.open(CACHE_NAME);
  const seen = new Set(await precacheList());
  const queue = [...seen];
  let fetched = 0;

  while (queue.length > 0 && fetched < CRAWL_MAX_ASSETS) {
    const url = queue.shift();
    let response = await cache.match(url, MATCH_OPTS);
    if (!response) {
      await sleep(CRAWL_DELAY_MS);
      try {
        response = await fetchWithRetry(url);
      } catch {
        continue; // offline mid-crawl; the next activation resumes
      }
      fetched++;
      if (!response.ok) continue;
      await cache.put(url, response.clone());
    }
    const type = response.headers.get('content-type') || '';
    if (!/html|javascript|css/.test(type)) continue;
    const text = await response.clone().text();
    const enqueue = (path) => {
      if (path.startsWith(ASSET_PREFIX) && !seen.has(path)) {
        seen.add(path);
        queue.push(path);
      }
    };
    // Absolute references (HTML tags, dynamic import() chunk paths). Matched
    // without the base prefix, then resolved against it, so fingerprinted
    // chunk paths are found however the bundle spells them.
    for (const match of text.matchAll(/[A-Za-z0-9_.\-/]*\/_astro\/[A-Za-z0-9_.\-]+/g)) {
      const path = match[0].startsWith('/') ? match[0] : BASE + match[0].replace(/^\.?\//, '');
      enqueue(path);
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
  // Only the shell blocks installation; the asset graph is warmed later.
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => warmAssetCache().catch(() => {}))
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
      (async () => {
        try {
          const response = await fetchWithRetry(request);
          if (response.ok) store(request, response);
          if (response.ok || !RETRYABLE.has(response.status)) return response;
          // Host is struggling — a cached page beats an error page.
          const cached = await caches.match(request, MATCH_OPTS);
          return cached ?? (await caches.match(BASE, MATCH_OPTS)) ?? response;
        } catch {
          const cached = await caches.match(request, MATCH_OPTS);
          return cached ?? (await caches.match(BASE, MATCH_OPTS)) ?? Response.error();
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for everything else.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, MATCH_OPTS);
      if (cached) {
        // Refresh in the background; failures here must never surface.
        fetchWithRetry(request)
          .then((response) => {
            if (response.ok) store(request, response);
          })
          .catch(() => {});
        return cached;
      }
      try {
        const response = await fetchWithRetry(request);
        if (response.ok) store(request, response);
        return response;
      } catch {
        // Nothing cached and the network is truly gone. Return a real
        // network error — resolving with `undefined` here made the browser
        // report a synthetic 503 for every miss.
        return Response.error();
      }
    })()
  );
});
