/**
 * Runtime dependency preflight — runs before `npm run dev` / `npm run build`
 * (pre-scripts). For every runtime enabled in astro.config.mjs, verify its
 * npm packages resolve, and fail with the exact install command instead of a
 * Vite resolution stack trace mid-build.
 *
 * The package map mirrors src/lib/runtimes/info.ts — KEEP IN SYNC (this is a
 * plain node script and can't import TypeScript).
 */
import { createRequire } from 'node:module';
import { runtimes } from '../astro.config.mjs';

const RUNTIME_PACKAGES = {
  sqlite: ['@sqlite.org/sqlite-wasm', '@codemirror/lang-sql'],
  web: [
    '@codemirror/lang-html',
    '@codemirror/lang-css',
    '@codemirror/lang-javascript',
    '@emmetio/codemirror6-plugin',
    'sucrase',
  ],
};

const require = createRequire(import.meta.url);
const problems = [];

for (const id of runtimes) {
  const packages = RUNTIME_PACKAGES[id];
  if (!packages) {
    problems.push(
      `Unknown runtime "${id}" in astro.config.mjs — known runtimes: ` +
        Object.keys(RUNTIME_PACKAGES).join(', ')
    );
    continue;
  }
  const missing = packages.filter((pkg) => {
    try {
      require.resolve(`${pkg}/package.json`);
      return false;
    } catch {
      // Some packages restrict exports; fall back to resolving the bare id.
      try {
        require.resolve(pkg);
        return false;
      } catch {
        return true;
      }
    }
  });
  if (missing.length > 0) {
    problems.push(
      `Runtime "${id}" is enabled but its packages aren't installed.\n` +
        `  Fix: npm install ${missing.join(' ')}`
    );
  }
}

if (problems.length > 0) {
  console.error('\n[check-runtimes] Problems with the `runtimes` setting in astro.config.mjs:\n');
  for (const p of problems) console.error(`- ${p}\n`);
  process.exit(1);
}

if (runtimes.length > 0) {
  console.log(`[check-runtimes] ok — enabled runtimes: ${runtimes.join(', ')}`);
}
