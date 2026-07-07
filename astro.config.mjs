// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  markdown: {
    // Dual gruvbox themes; defaultColor:false emits --shiki-light/--shiki-dark
    // variables and Layout.astro's CSS picks one based on the active scheme.
    shikiConfig: {
      themes: { light: 'gruvbox-light-medium', dark: 'gruvbox-dark-medium' },
      defaultColor: false,
    },
  },
  vite: {
    // Per the sqlite-wasm docs: keep Vite from pre-bundling the WASM loader,
    // which breaks its worker/asset URL resolution in dev.
    optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  },
});
