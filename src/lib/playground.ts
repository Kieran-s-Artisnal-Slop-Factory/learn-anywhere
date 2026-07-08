/**
 * Playground persistence. Unlike the course stores, the playground is a single
 * local-only scratch row (`id = 'singleton'`) holding two things:
 *  - `buffer`: the editor text, autosaved for resumability
 *  - `dump`:   a saved SQL snapshot of the database, re-run on load to restore
 *              state (the playground DB is in-memory and otherwise vanishes)
 *
 * It lives in its own IndexedDB store (see the v3 migration) and is accessed
 * directly rather than through the sync-aware repo helpers.
 */
import { getDB } from './db/db';

const STORE = 'playground';
const KEY = 'singleton';

export interface PlaygroundState {
  id: string;
  buffer: string;
  dump: string | null;
  updated_at: string;
}

export async function loadPlayground(): Promise<PlaygroundState | null> {
  const row = (await (await getDB()).get(STORE, KEY)) as PlaygroundState | undefined;
  return row ?? null;
}

async function merge(patch: Partial<Omit<PlaygroundState, 'id' | 'updated_at'>>): Promise<PlaygroundState> {
  const db = await getDB();
  const existing = (await db.get(STORE, KEY)) as PlaygroundState | undefined;
  const next: PlaygroundState = {
    id: KEY,
    buffer: existing?.buffer ?? '',
    dump: existing?.dump ?? null,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await db.put(STORE, next);
  return next;
}

/** Autosave the editor text. */
export const savePlaygroundBuffer = (buffer: string): Promise<PlaygroundState> => merge({ buffer });

/** Persist (or clear, with null) the saved database snapshot. */
export const savePlaygroundDump = (dump: string | null): Promise<PlaygroundState> => merge({ dump });
