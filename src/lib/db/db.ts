/**
 * IndexedDB connection + versioned migrations.
 *
 * MIGRATIONS is an ordered list of upgrade functions, one per version, run in
 * sequence from the client's current version. Never edit an existing
 * migration once shipped — append a new one.
 */
import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { STORES } from './types';

export const DB_NAME = 'learn-anywhere';

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
  // v2 — add the `playground` store: one row per code runtime holding that
  // playground's editor buffer(s) and an optional saved snapshot (e.g. a SQL
  // dump re-run on load). Local-only scratch, deliberately kept out of the
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
