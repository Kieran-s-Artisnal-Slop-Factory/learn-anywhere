/**
 * Remark plugin: wikimedia-style glossary links in any content markdown.
 *
 *   [[spaced-repetition]]                 → linked as the term's display name
 *   [[spaced-repetition|spaced practice]] → linked as "spaced practice"
 *
 * Each reference becomes an anchor to the term's landing page
 * (/glossary/<slug>/) carrying the term's name and short description as data
 * attributes — Layout.astro's popover script turns those into the hover/tap
 * definition popup, entirely offline, no runtime lookup.
 *
 * The glossary is read from src/content/glossary/*.md ONCE when the plugin is
 * constructed (i.e. at astro.config load), so restart the dev server after
 * adding or renaming a term. An unknown slug throws, failing the build the
 * same way broken chapter/lesson wiring does.
 *
 * Plain .mjs (not .ts): astro.config.mjs imports it directly at config-load
 * time, before any TypeScript pipeline exists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const GLOSSARY_DIR = 'src/content/glossary';
// Text between [[ and ]], with an optional |display part.
const REF_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Minimal frontmatter reader for the two simple string fields we need. */
function readFrontmatter(path) {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(term|short):\s*(.+)$/);
    if (kv) fields[kv[1]] = kv[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
}

function loadGlossary() {
  const terms = new Map();
  let files = [];
  try {
    files = readdirSync(GLOSSARY_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return terms; // no glossary directory yet — [[refs]] will throw below
  }
  for (const file of files) {
    const slug = basename(file, '.md');
    const { term, short } = readFrontmatter(join(GLOSSARY_DIR, file));
    terms.set(slug, { term: term ?? slug, short: short ?? '' });
  }
  return terms;
}

const escapeHtml = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * @param {{ base?: string }} options — the app's base path, so glossary hrefs
 *   work under sub-path hosting (mirrors lib/paths.ts, which markdown can't use).
 */
export function remarkGlossary(options = {}) {
  const base = (options.base ?? '/').replace(/\/$/, '');
  const terms = loadGlossary();

  /** Depth-first walk replacing [[refs]] in text nodes with html nodes. */
  function walk(node, parent) {
    if (node.type === 'text' && parent && REF_PATTERN.test(node.value)) {
      REF_PATTERN.lastIndex = 0;
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(REF_PATTERN)) {
        const [whole, slug, display] = m;
        const entry = terms.get(slug.trim());
        if (!entry) {
          throw new Error(
            `Unknown glossary term "[[${slug}]]" — no ${GLOSSARY_DIR}/${slug.trim()}.md ` +
              `(restart the dev server if you just added it)`
          );
        }
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        const text = escapeHtml((display ?? entry.term).trim());
        parts.push({
          type: 'html',
          value:
            `<a class="glossary-link" href="${base}/glossary/${slug.trim()}/" ` +
            `data-term="${escapeHtml(entry.term)}" data-short="${escapeHtml(entry.short)}">${text}</a>`,
        });
        last = m.index + whole.length;
      }
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      const idx = parent.children.indexOf(node);
      parent.children.splice(idx, 1, ...parts);
      return;
    }
    // Skip code blocks / inline code so examples can show the syntax itself.
    if (node.type === 'code' || node.type === 'inlineCode') return;
    if (node.children) {
      // Iterate over a copy: replacements mutate the children array.
      for (const child of [...node.children]) walk(child, node);
    }
  }

  return (tree) => walk(tree, null);
}
