# Lite Learner

Lite Learner is a statically generated interactive learning management system
that teaches SQLite through in-browser courses and exercises, powered by
[sqlite-wasm](https://github.com/sqlite/sqlite-wasm). Courses are authored as
markdown and baked into a static site at build time; every exercise runs
against a real in-memory SQLite database. No server, no accounts, and the
whole app works offline after the first visit.

- **Authoring content**: see the [Instructor Guide](INSTRUCTOR_GUIDE.md) —
  courses, chapters, and exercises are plain markdown under `src/content/`.
- **Progress** (started/completed, current position, editor buffers) lives
  only in the visitor's IndexedDB.

## Quickstart

Requires Node >= 22.12.

```sh
npm install
npm run dev      # http://localhost:4321
npm test         # unit tests (vitest) — the solution comparator lives here
npm run build    # static output in dist/
npm run preview  # serve dist/ locally
```

Development notes:

- The service worker is disabled in dev (it would cache Vite module URLs);
  test offline behavior against `npm run preview` instead.
- A throwaway engine test page lives at `/spike` — handy when poking at the
  SQLite worker without an exercise around it.
- The site is an installable PWA (`public/manifest.webmanifest` + the service
  worker). The PNG icons in `public/icons/` are generated — re-run
  `node scripts/generate-icons.mjs` if the brand colors change.

## Deploy

```sh
npm run build  # static output in /dist
```

Host `dist/` anywhere static files can live: Netlify, GitHub Pages,
Cloudflare Pages, or any web server. No runtime and no special headers
required (the SQLite engine is in-memory on purpose, sidestepping the
COOP/COEP requirements of OPFS persistence). For subpath deploys (e.g.
GitHub Pages under `/repo/`), set `base` in `astro.config.mjs` — the service
worker derives every path from its registration scope, so offline precaching
keeps working.

## Technical details

Offline-only Astro + Svelte 5 app. Two kinds of data, kept deliberately
separate:

- **Content** (titles, descriptions, `initial_sql`, `desired_state`
  solutions) is authored as markdown, validated by Astro content collections
  (broken cross-references fail the build), and baked into the static bundle.
- **Progress** is per-visitor and lives only in IndexedDB — there is no
  server and no network dependency.

Content is copied into IndexedDB on enrollment so the app works offline, and
kept fresh via a content hash: pages embed a sha256 of each entry at build
time and the client reconciles on load — stale cached content is overwritten
while progress fields are always preserved.

### Source map

- `src/content/` — the authored courses/chapters/exercises (markdown).
- `src/content.config.ts` — collection schemas; `reference()` arrays define
  chapter/exercise ordering (array order *is* the order).
- `src/lib/sql/` — the exercise engine: SQLite WASM in a Web Worker
  (`worker.ts`, so runaway queries never freeze the UI), a promise client
  (`client.ts`), and the solution comparator (`comparator.ts` — pure,
  unit-tested, expected-value-driven coercion rules).
- `src/lib/content/` — build-time content-bundle emit (`bundle.ts`) +
  client-side cache sync (`sync.ts`): the content-hash flow above.
- `src/lib/progress.ts` — progress stamping; completing an exercise cascades
  to chapter/course completion. Completion is always a nullable `completed`
  timestamp — booleans are derived, never stored.
- `src/lib/db/` — IndexedDB plumbing: entity types (`types.ts`), append-only
  migrations (`db.ts`), tombstone-aware CRUD (`repo.ts`), JSON backup
  export/import (`export.ts`). Content-backed rows are keyed by content slug.
- `src/components/` — Svelte 5 (runes) islands mounted from thin Astro pages
  with `client:only="svelte"`; the exercise editor is CodeMirror 6 with SQL
  syntax highlighting.
- `src/styles/theme.css` — every design token (gruvbox palette → semantic
  colors → editor/syntax colors). Re-theming means editing this one file.
- `public/sw.js` — offline support: precaches every page from the generated
  `/precache.json` manifest plus the crawled asset graph; network-first for
  pages, stale-while-revalidate for assets.

### Conventions worth knowing

- SQL validity errors come from `prepare()`-ing statements in SQLite WASM and
  surfacing the thrown error — the engine is the source of truth, not an
  editor-side linter.
- Exercise loads never auto-run a restored editor buffer (a single buffer
  can't reproduce accumulated DB state); the UI shows a "re-run your
  statements" banner instead.
- Every entity carries bookkeeping fields (`id`, `updated_at`, `deleted_at`,
  `server_seq`) that power soft deletes and keep the door open to adding a
  sync backend later without a data migration.

## Backups

The only copy of a visitor's progress is the browser it was created in. Use
Settings → Backup to export/import everything as one JSON file.

## Evolving the schema

The schema lives in two places that must change together:

1. `src/lib/db/types.ts` — entity interfaces + store map.
2. A new migration appended in `src/lib/db/db.ts` (never edit a
   shipped migration).

Versions are pinned to ranges proven together (Astro 7 / Svelte 5 / idb 8);
major upgrades may change generated-code assumptions.
