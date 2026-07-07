# Lite Learner

Lite Learner is a staticly generated interactive learning management system to teach people about SQLite through interactive courses and exercises in browser, powered by [sqlite wasm](https://github.com/sqlite/sqlite-wasm).

## Quickstart

```sh
npm install
npm run dev                   # http://localhost:4321
```

## Deploy

```sh
 npm run build  # static output in /dist
```

Host `dist/` anywhere static files can live: Netlify, GitHub Pages,
Cloudflare Pages, or any web server. No runtime required.

## Technical Details

Offline-only Astro + Svelte 5 app generated from local-sync-template. 
IndexedDB is the source of truth and the only copy of the data — there is no server. 
Export JSON backups from Settings. 
There is no server, no account, and no network dependency;
each visitor's data lives in their own browser.

## Tables

- `exercises` — 6 columns (Exercises page)
- `courses` — 4 columns (Courses page)
- `chapters` — 4 columns (Chapters page)

Every table also carries bookkeeping fields (`id`, `updated_at`,
`deleted_at`, `server_seq`) that power soft deletes and keep the door open
to adding a sync backend later without a data migration.

## Backups

The only copy of the data is the browser it was created in. Use Settings →
Backup to export/import everything as one JSON file.

## Evolving the schema

The schema lives in two places that must change together:

1. `src/lib/db/types.ts` — entity interfaces + store map.
2. A new migration appended in `src/lib/db/db.ts` (never edit a
   shipped migration).
