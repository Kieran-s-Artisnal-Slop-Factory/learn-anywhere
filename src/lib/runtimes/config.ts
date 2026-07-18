/**
 * The site's enabled code runtimes — the `runtimes` array in astro.config.mjs,
 * injected via a Vite define (same pattern as contactEndpoint /
 * partial_grades). Read by the registry, the playground shell, the navbar,
 * and the build-time content validation in lib/content/bundle.ts.
 */
const raw = import.meta.env.PUBLIC_RUNTIMES as unknown;

export const RUNTIMES: readonly string[] = Array.isArray(raw)
  ? (raw as string[])
  : typeof raw === 'string' && raw !== ''
    ? (JSON.parse(raw) as string[]) // e.g. set through a real env var
    : [];

export const runtimeEnabled = (id: string): boolean => RUNTIMES.includes(id);

/** Anything to show a playground / editor settings for at all? */
export const anyRuntimes = (): boolean => RUNTIMES.length > 0;
