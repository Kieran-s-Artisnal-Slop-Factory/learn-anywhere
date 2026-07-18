/**
 * Static facts about every runtime id the platform knows how to ship —
 * independent of what THIS site enables (that's config.ts) and of the lazy
 * adapters (registry.ts). Used for validation messages and docs.
 *
 * KEEP IN SYNC with the copy in scripts/check-runtimes.mjs (a plain node
 * script that can't import TypeScript).
 */
export interface RuntimeInfo {
  label: string;
  /** npm packages a site must install to enable this runtime. */
  packages: string[];
}

export const RUNTIME_INFO: Record<string, RuntimeInfo> = {
  sqlite: {
    label: 'SQLite',
    packages: ['@sqlite.org/sqlite-wasm', '@codemirror/lang-sql'],
  },
  web: {
    label: 'Web preview',
    packages: [
      '@codemirror/lang-html',
      '@codemirror/lang-css',
      '@codemirror/lang-javascript',
      '@emmetio/codemirror6-plugin',
      'sucrase',
    ],
  },
};

export const knownRuntime = (id: string): boolean => id in RUNTIME_INFO;

export const installHint = (id: string): string =>
  RUNTIME_INFO[id] ? `npm install ${RUNTIME_INFO[id].packages.join(' ')}` : '(unknown runtime)';
