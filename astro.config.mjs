// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import { remarkGlossary } from './src/lib/glossary/remark-glossary.mjs';

const base = '/learn-anywhere';

// https://astro.build/config
export default defineConfig({
  base,
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
    remarkPlugins: [[remarkGlossary, { base }]],
  },
});
