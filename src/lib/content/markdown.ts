/**
 * BUILD-TIME markdown rendering for content that lives in frontmatter —
 * question prompts and flashcard fronts/backs — which Astro's content
 * pipeline leaves as plain strings. Uses the same glossary plugin as lesson
 * bodies, so [[refs]] work everywhere.
 */
import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// @ts-expect-error — plain .mjs module (shared with astro.config.mjs, which
// imports it before any TypeScript pipeline exists).
import { remarkGlossary } from '../glossary/remark-glossary.mjs';

let processor: Promise<MarkdownProcessor> | null = null;

/** Render a small markdown fragment (glossary refs + $math$ included) to HTML. */
export async function renderMarkdownFragment(markdown: string): Promise<string> {
  processor ??= createMarkdownProcessor({
    remarkPlugins: [[remarkGlossary, { base: import.meta.env.BASE_URL }], remarkMath],
    rehypePlugins: [rehypeKatex],
  });
  const rendered = await (await processor).render(markdown);
  return String(rendered.code);
}
