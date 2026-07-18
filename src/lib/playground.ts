/**
 * Playground persistence — one local-only scratch row PER RUNTIME (keyed by
 * the runtime id, so SQLite and future runtimes each keep their own state):
 *  - `buffers`: the editor text per tab (a single-editor playground uses one
 *    well-known key, e.g. { main: '...' })
 *  - `snapshot`: an optional saved engine snapshot (for SQLite: a SQL dump
 *    re-run on load, since the in-memory DB otherwise vanishes)
 *
 * Lives in its own IndexedDB store (migration v2) and is accessed directly
 * rather than through the sync-aware repo helpers — it's scratch, not
 * content-backed progress, and backup export deliberately skips it.
 */
import { getDB } from './db/db';

const STORE = 'playground';

export interface PlaygroundState {
  id: string; // runtime id
  buffers: Record<string, string>;
  snapshot: string | null;
  updated_at: string;
}

export async function loadPlayground(runtimeId: string): Promise<PlaygroundState | null> {
  const row = (await (await getDB()).get(STORE, runtimeId)) as PlaygroundState | undefined;
  return row ?? null;
}

async function merge(
  runtimeId: string,
  patch: Partial<Omit<PlaygroundState, 'id' | 'updated_at'>>
): Promise<PlaygroundState> {
  const db = await getDB();
  const existing = (await db.get(STORE, runtimeId)) as PlaygroundState | undefined;
  const next: PlaygroundState = {
    id: runtimeId,
    buffers: existing?.buffers ?? {},
    snapshot: existing?.snapshot ?? null,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await db.put(STORE, next);
  return next;
}

/** Autosave the editor buffer(s). */
export const savePlaygroundBuffers = (
  runtimeId: string,
  buffers: Record<string, string>
): Promise<PlaygroundState> => merge(runtimeId, { buffers });

/** Persist (or clear, with null) the saved engine snapshot. */
export const savePlaygroundSnapshot = (
  runtimeId: string,
  snapshot: string | null
): Promise<PlaygroundState> => merge(runtimeId, { snapshot });
