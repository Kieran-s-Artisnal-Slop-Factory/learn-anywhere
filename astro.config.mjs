// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkGlossary } from './src/lib/glossary/remark-glossary.mjs';

// Change the `/` to a different URL if you're serving the site from a path other than root
// for example, if the site is served from https://example.com/astro-course/, set base = '/astro-course/'.
// You can also set the BASE environment variable, or add `--base=/astro-course/` to your build command
const base = process.env.BASE ?? '/'; 

// If you are using a custom domain, replace `undefined` with your domain name (e.g. 'https://example.com')
// You can also set the SITE environment variable, or add `--site=https://example.com` to your build command
const site= process.env.SITE?? undefined;

// Optional feedback endpoint. When set to a URL, the site grows a "Contact"
// nav link (general feedback: custom subject + message) and a "Give us
// feedback on this lesson" button at the bottom of lesson and test pages.
// Feedback is sent as a standard form POST (fields: subject, message, plus
// sender_name/sender_email when the visitor set a profile) to this endpoint,
// which you host separately. Empty string = feature disabled.
const contactEndpoint = '';

// Grading behavior for multi-select questions. false (default): all-or-
// nothing — the answer must be the exact set of correct options. true:
// partial marks — each correctly selected option earns a fraction, each
// wrong selection cancels one out (never below zero for the question):
//   points = max(0, correct selections − wrong selections) / total correct
// Applies to every quiz and test on the site; scores may be fractional.
const partial_grades = false;

// Which code-exercise runtimes this site ships (docs/user/runtimes.md). Each
// entry needs its npm packages installed — `npm run dev`/`build` preflight-
// check them and print the install command if any are missing. Content that
// uses a runtime not listed here FAILS THE BUILD. Empty = no code exercises,
// no playground. Known ids: 'sqlite', 'web'.
// Exported so scripts/check-runtimes.mjs can read the same list.
export const runtimes = ['sqlite', 'web'];

// https://astro.build/config
export default defineConfig({
  base:base,
  site:site,
  integrations: [svelte()],
  markdown: {
    // Dual gruvbox themes; defaultColor:false emits --shiki-light/--shiki-dark
    // variables and Layout.astro's CSS picks one based on the active scheme.
    shikiConfig: {
      themes: { light: 'gruvbox-light-medium', dark: 'gruvbox-dark-medium' },
      defaultColor: false,
    },
    // [[term]] / [[term|display]] → glossary popup links. The plugin reads
    // src/content/glossary at config-load time, so restart the dev server
    // after adding or renaming a term.
    // remark-math + rehype-katex: $inline$ and $$block$$ math, rendered to
    // KaTeX HTML at build time (Layout.astro ships the KaTeX stylesheet).
    remarkPlugins: [[remarkGlossary, { base }], remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    // Per the sqlite-wasm docs: keep Vite from pre-bundling the WASM loader,
    // which breaks its worker/asset URL resolution in dev. Harmless when the
    // sqlite runtime is disabled (the package is simply never imported).
    optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
    // Expose site settings to client code (lib/contact.ts, lib/assessment/config.ts).
    define: {
      'import.meta.env.PUBLIC_CONTACT_ENDPOINT': JSON.stringify(contactEndpoint),
      'import.meta.env.PUBLIC_PARTIAL_GRADES': JSON.stringify(partial_grades),
      'import.meta.env.PUBLIC_RUNTIMES': JSON.stringify(runtimes),
    },
  },
});
