/**
 * IndexedDB connection + versioned migrations.
 *
 * MIGRATIONS is an ordered list of upgrade functions, one per version, run in
 * sequence from the client's current version. Never edit an existing
 * migration once shipped — append a new one.
 */
import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { STORES } from './types';

export const DB_NAME = 'lite-learner';

type Migration = (
  db: IDBPDatabase,
  tx: IDBPTransaction<unknown, string[], 'versionchange'>
) => void;

const MIGRATIONS: Migration[] = [
  // v1 — create every object store and its indexes from the STORES map.
  (db) => {
    for (const [name, def] of Object.entries(STORES)) {
      const store = db.createObjectStore(name, { keyPath: 'id' });
      for (const idx of def.indexes) {
        store.createIndex(idx.name, idx.name, { multiEntry: idx.multiEntry ?? false });
      }
    }
  },
  // v2 — content-backed reshape: rows are now keyed by content slug (id =
  // slug) and carry content_hash + cached content fields; `chapters.course`
  // became parent-held ordered arrays and the redundant `complete` boolean is
  // gone. v1 rows were UUID-keyed scaffold data with no content attached and
  // cannot be mapped to slugs, so the stores are cleared; rows are rebuilt
  // from the static content by the content-hash sync on next visit.
  (_db, tx) => {
    for (const name of Object.keys(STORES)) {
      tx.objectStore(name).clear();
    }
  },
  // v3 — add the `playground` store: a single row holding the free-form
  // playground's editor buffer and the user's saved database snapshot (a SQL
  // dump re-run on load). It's local-only scratch, deliberately kept out of the
  // STORES map so the content-sync and export/import flows never touch it.
  (db) => {
    if (!db.objectStoreNames.contains('playground')) {
      db.createObjectStore('playground', { keyPath: 'id' });
    }
  },
];

export const DB_VERSION = MIGRATIONS.length;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        for (let v = oldVersion; v < MIGRATIONS.length; v++) {
          MIGRATIONS[v]!(db, tx);
        }
      },
    });
  }
  return dbPromise;
}
