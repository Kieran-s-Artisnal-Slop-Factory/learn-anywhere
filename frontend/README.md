# lite-learner frontend

Offline-only Astro + Svelte 5 app. IndexedDB is the source of truth and the
only copy of the data — there is no server. Export JSON backups from Settings.

## Develop

```sh
npm install
npm run dev
```

Everything runs in the browser — no server to start.

## Build

```sh
npm run build   # static output in dist/
```

Deploy `dist/` to any static host (Netlify, GitHub Pages, Cloudflare Pages,
or a plain file server) — each visitor's data stays in their own browser.

## Architecture notes

- `src/lib/db/types.ts` — entity interfaces + object-store map.
- `src/lib/db/db.ts` — IndexedDB migrations (append-only, never edit shipped ones).
- `src/lib/db/repo.ts` — CRUD helpers; reads filter tombstones, writes stamp
  `updated_at`, deletes are soft.
- `src/lib/db/export.ts` — JSON backup export/import.
- Pages are thin Astro wrappers mounting one Svelte 5 root component with
  `client:only="svelte"`; state is component-local runes (`$state`/`$derived`).

Versions are pinned to ranges proven together (Astro 7 / Svelte 5 / idb 8);
major upgrades may change generated-code assumptions.
