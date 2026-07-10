/**
 * Plain-text fallback for glossary references. Most content is rendered
 * through remark (where remark-glossary.mjs turns [[refs]] into popup links),
 * but a few places show raw markdown as text — course blurbs, chapter
 * description lines — and there the syntax must not leak through.
 */
export function stripGlossaryRefs(text: string): string {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, slug: string, display?: string) =>
    (display ?? slug.replace(/-/g, ' ')).trim()
  );
}
