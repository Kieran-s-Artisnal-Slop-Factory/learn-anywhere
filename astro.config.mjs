// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
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
    remarkPlugins: [[remarkGlossary, { base }]],
  },
  vite: {
    // Expose the contact endpoint to client code (lib/contact.ts reads it).
    define: {
      'import.meta.env.PUBLIC_CONTACT_ENDPOINT': JSON.stringify(contactEndpoint),
    },
  },
});
