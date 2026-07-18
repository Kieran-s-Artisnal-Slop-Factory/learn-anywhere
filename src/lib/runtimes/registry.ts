/**
 * Runtime registry — the single place adapters are wired in. Loaders are
 * lazy so an adapter's engine + language packages are only bundled/fetched
 * when its runtime is actually used.
 */
import { runtimeEnabled } from './config';
import type { RuntimeAdapter } from './types';

const LOADERS: Record<string, () => Promise<RuntimeAdapter>> = {
  sqlite: () => import('./sqlite/adapter').then((m) => m.sqliteAdapter),
};

/** Runtime ids that are both enabled by the site AND have an adapter. */
export const availableRuntimes = (): string[] =>
  Object.keys(LOADERS).filter((id) => runtimeEnabled(id));

export async function loadRuntime(id: string): Promise<RuntimeAdapter> {
  if (!runtimeEnabled(id)) {
    throw new Error(`Runtime "${id}" is not enabled in astro.config.mjs (runtimes: [...])`);
  }
  const loader = LOADERS[id];
  if (!loader) {
    throw new Error(`Runtime "${id}" has no registered adapter (not implemented yet)`);
  }
  return loader();
}
