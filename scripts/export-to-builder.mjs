/**
 * Export this site's content as a Learn Anywhere Builder project file
 * (`kind: learn-anywhere-builder-project`, version 2) so an existing site can
 * be opened and kept editable in the builder.
 *
 *   npm run export:builder [-- --id my-site --title "My Site" --out file.json]
 *
 * What it reads:
 *   - src/content/courses/**, flashcards/*.md, glossary/*.md (frontmatter as
 *     authored — `npm run build` is the validator, this script trusts it)
 *   - astro.config.mjs for settings (runtimes via import — same trick as
 *     scripts/check-runtimes.mjs — contactEndpoint/partial_grades by pattern;
 *     base/site come from the BASE/SITE env vars, like the config itself)
 *   - src/lib/palette.ts for the default palette; public/manifest.webmanifest
 *     for the site's name/description

 * The built-in "Platform walkthrough" course (0.platform-walkthrough) is
 * skipped — it belongs to the platform, not the site's authors.
 *
 * Theme mapping: the builder models a theme as a base palette + sparse
 * `--pal-*` overrides. A site whose default palette is one of the built-ins
 * exports as that base with no overrides; anything unrecognizable falls back
 * to inheriting `boring` with only the parseable `--pal-*` values of the
 * active palette carried over as overrides.
 *
 * Images: the builder keys every binary asset `<course>/images/<name>`, so
 * co-located images are moved there and relative markdown refs in bodies are
 * rewritten to match (filename collisions get a numeric suffix).
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const contentDir = path.join(root, 'src', 'content');

// ---------------------------------------------------------------- CLI args
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};

// ------------------------------------------------------------- frontmatter
/** Split a markdown file into YAML frontmatter data + body. */
function parseFrontmatter(text) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, body: text.trim() };
  return { data: parseYaml(match[1]) ?? {}, body: text.slice(match[0].length).trim() };
}

const isoMtime = async (file) => (await stat(file)).mtime.toISOString();
const row = async (id, file) => {
  const at = await isoMtime(file);
  return { id, updated_at: at, deleted_at: null, server_seq: null, __created: at };
};
/** SyncFields rows carry __created internally; strip it, optionally emitting created_at. */
const finalize = ({ __created, ...rest }, withCreated) =>
  withCreated ? { ...rest, created_at: __created } : rest;

// ------------------------------------------------------------ site settings
async function readSettings() {
  const configPath = path.join(root, 'astro.config.mjs');
  const source = await readFile(configPath, 'utf8');
  let runtimes = [];
  try {
    ({ runtimes = [] } = await import(pathToFileURL(configPath).href));
  } catch {
    const m = /export\s+const\s+runtimes\s*=\s*(\[[^\]]*\])/.exec(source);
    if (m) runtimes = JSON.parse(m[1].replace(/'/g, '"'));
  }
  const contactEndpoint =
    /const\s+contactEndpoint\s*=\s*(['"])(.*?)\1/.exec(source)?.[2] ?? '';
  const partialGrades = /const\s+partial_grades\s*=\s*true/.test(source);
  return {
    base: process.env.BASE ?? '/',
    site: process.env.SITE ?? '',
    contactEndpoint,
    partialGrades,
    runtimes,
    theme: await readTheme(),
  };
}

// ------------------------------------------------------------------- theme
const BUILTIN_PALETTES = ['boring', 'gruvbox', 'forrest'];

async function readTheme() {
  let defaultId = 'boring';
  try {
    const paletteTs = await readFile(path.join(root, 'src', 'lib', 'palette.ts'), 'utf8');
    defaultId = /DEFAULT_PALETTE\s*(?::\s*\w+)?\s*=\s*'([^']+)'/.exec(paletteTs)?.[1] ?? 'boring';
  } catch {}
  if (BUILTIN_PALETTES.includes(defaultId)) {
    const name = defaultId.charAt(0).toUpperCase() + defaultId.slice(1);
    return {
      mode: 'single',
      defaultId,
      themes: [{ id: defaultId, name, base: defaultId, include: true, vars: {} }],
    };
  }
  // Unknown palette id: inherit boring and carry the palette's own --pal-*
  // values over as advanced (per-slot) overrides.
  const vars = {};
  try {
    const css = await readFile(path.join(root, 'src', 'styles', 'theme.css'), 'utf8');
    const block = new RegExp(
      String.raw`\[data-palette=['"]${defaultId}['"]\]\s*\{([\s\S]*?)\}`
    ).exec(css)?.[1];
    if (block) {
      for (const m of block.matchAll(
        /--pal-([\w-]+)\s*:\s*light-dark\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g
      )) {
        vars[m[1]] = { light: m[2].trim(), dark: m[3].trim() };
      }
    }
  } catch {}
  return {
    mode: 'single',
    defaultId,
    themes: [{ id: defaultId, name: defaultId, base: 'boring', include: true, vars }],
  };
}

// ----------------------------------------------------------------- content
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

async function listDir(dir) {
  return existsSync(dir) ? await readdir(dir, { withFileTypes: true }) : [];
}

/**
 * Rewrite relative image refs in a markdown body to the builder's
 * `<course>/images/<name>` location. `fromDir` is the md file's directory
 * relative to the course root ('' for index.md, '<chapter>' otherwise).
 */
function rewriteImageRefs(body, fromDir, assetNameByPath) {
  return body.replace(/(!\[[^\]]*\]\()(\s*)([^)\s]+)([^)]*\))/g, (all, open, ws, ref, close) => {
    if (/^([a-z]+:)?\/\//i.test(ref) || ref.startsWith('/')) return all;
    const resolved = path.posix.normalize(path.posix.join(fromDir, ref));
    const name = assetNameByPath.get(resolved);
    if (!name) return all;
    const prefix = fromDir === '' ? './images/' : '../images/';
    return `${open}${ws}${prefix}${name}${close}`;
  });
}

async function readCourse(slug, warn) {
  const courseDir = path.join(contentDir, 'courses', slug);

  // Collect every image in the course tree first so bodies can be rewritten.
  // assets: [{name, absPath}], assetNameByPath: course-relative path -> name
  const assets = [];
  const assetNameByPath = new Map();
  const usedNames = new Set();
  async function collectImages(dir, rel) {
    for (const entry of await listDir(dir)) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await collectImages(path.join(dir, entry.name), entryRel);
      else if (IMAGE_EXT.test(entry.name)) {
        let name = entry.name;
        for (let n = 2; usedNames.has(name); n++) {
          name = entry.name.replace(/(\.[^.]+)$/, `-${n}$1`);
        }
        usedNames.add(name);
        assets.push({ name, absPath: path.join(dir, entry.name) });
        assetNameByPath.set(entryRel, name);
      }
    }
  }
  await collectImages(courseDir, '');

  const courseFile = path.join(courseDir, 'index.md');
  const courseDoc = parseFrontmatter(await readFile(courseFile, 'utf8'));
  const course = {
    ...finalize(await row(slug, courseFile), true),
    project: '', // stamped by the caller
    title: courseDoc.data.title ?? slug,
    description: rewriteImageRefs(courseDoc.body, '', assetNameByPath),
    chapters: (courseDoc.data.chapters ?? []).map((leaf) => `${slug}/${leaf}`),
  };

  const chapters = [];
  const lessons = [];
  for (const chapterLeaf of courseDoc.data.chapters ?? []) {
    const chapterFile = path.join(courseDir, chapterLeaf, 'index.md');
    if (!existsSync(chapterFile)) {
      warn(`${slug}/${chapterLeaf}/index.md missing (listed in chapters:) — skipped`);
      continue;
    }
    const chapterDoc = parseFrontmatter(await readFile(chapterFile, 'utf8'));
    const chapterId = `${slug}/${chapterLeaf}`;
    chapters.push({
      ...finalize(await row(chapterId, chapterFile)),
      title: chapterDoc.data.title ?? chapterLeaf,
      description: rewriteImageRefs(chapterDoc.body, chapterLeaf, assetNameByPath),
      lessons: (chapterDoc.data.lessons ?? []).map((leaf) => `${chapterId}/${leaf}`),
      ...(chapterDoc.data.test ? { test: chapterDoc.data.test } : {}),
      ...(chapterDoc.data.test_database ? { test_database: chapterDoc.data.test_database } : {}),
      ...(chapterDoc.data.test_web ? { test_web: chapterDoc.data.test_web } : {}),
      ...(chapterDoc.data.result_endpoint ? { result_endpoint: chapterDoc.data.result_endpoint } : {}),
    });
    for (const lessonLeaf of chapterDoc.data.lessons ?? []) {
      const lessonFile = path.join(courseDir, chapterLeaf, `${lessonLeaf}.md`);
      if (!existsSync(lessonFile)) {
        warn(`${slug}/${chapterLeaf}/${lessonLeaf}.md missing (listed in lessons:) — skipped`);
        continue;
      }
      const lessonDoc = parseFrontmatter(await readFile(lessonFile, 'utf8'));
      lessons.push({
        ...finalize(await row(`${chapterId}/${lessonLeaf}`, lessonFile)),
        title: lessonDoc.data.title ?? lessonLeaf,
        body: rewriteImageRefs(lessonDoc.body, chapterLeaf, assetNameByPath),
        ...(lessonDoc.data.quiz ? { quiz: lessonDoc.data.quiz } : {}),
        ...(lessonDoc.data.database ? { database: lessonDoc.data.database } : {}),
        ...(lessonDoc.data.web ? { web: lessonDoc.data.web } : {}),
        ...(lessonDoc.data.result_endpoint ? { result_endpoint: lessonDoc.data.result_endpoint } : {}),
      });
    }
  }

  const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  };
  const assetRows = await Promise.all(
    assets.map(async ({ name, absPath }) => ({
      id: `${slug}/images/${name}`,
      mime: MIME[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
      base64: (await readFile(absPath)).toString('base64'),
    }))
  );

  return { course, chapters, lessons, assets: assetRows };
}

// -------------------------------------------------------------------- main
async function main() {
  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(path.join(root, 'public', 'manifest.webmanifest'), 'utf8'));
  } catch {}
  const siteTitle = argValue('--title') ?? manifest.name ?? 'Learn Anywhere';
  const siteId =
    argValue('--id') ??
    siteTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // The built-in interface-tutorials course (interfaceTutorials in
  // astro.config.mjs) is platform content, not authored content — never
  // export it, whatever the flags say.
  const WALKTHROUGH_COURSE_ID = '0.platform-walkthrough';
  const courseSlugs = (await listDir(path.join(contentDir, 'courses')))
    .filter((e) => e.isDirectory() && e.name !== WALKTHROUGH_COURSE_ID)
    .map((e) => e.name)
    .sort();
  if (courseSlugs.length === 0) throw new Error('no courses found under src/content/courses');

  const courses = [];
  const chapters = [];
  const lessons = [];
  const assets = [];
  for (const slug of courseSlugs) {
    const parsed = await readCourse(slug, warn);
    parsed.course.project = siteId;
    courses.push(parsed.course);
    chapters.push(...parsed.chapters);
    lessons.push(...parsed.lessons);
    assets.push(...parsed.assets);
  }

  const decks = [];
  for (const entry of await listDir(path.join(contentDir, 'flashcards'))) {
    if (!entry.name.endsWith('.md')) continue;
    const file = path.join(contentDir, 'flashcards', entry.name);
    const doc = parseFrontmatter(await readFile(file, 'utf8'));
    const leaf = entry.name.replace(/\.md$/, '');
    decks.push({
      ...finalize(await row(`${siteId}/flashcards/${leaf}`, file)),
      title: doc.data.title ?? leaf,
      description: doc.body,
      cards: doc.data.cards ?? [],
    });
  }

  const terms = [];
  for (const entry of await listDir(path.join(contentDir, 'glossary'))) {
    if (!entry.name.endsWith('.md')) continue;
    const file = path.join(contentDir, 'glossary', entry.name);
    const doc = parseFrontmatter(await readFile(file, 'utf8'));
    const leaf = entry.name.replace(/\.md$/, '');
    terms.push({
      ...finalize(await row(`${siteId}/glossary/${leaf}`, file)),
      term: doc.data.term ?? leaf,
      short: doc.data.short ?? '',
      body: doc.body,
    });
  }

  const now = new Date().toISOString();
  const envelope = {
    kind: 'learn-anywhere-builder-project',
    version: 2,
    exportedAt: now,
    project: {
      id: siteId,
      updated_at: now,
      deleted_at: null,
      server_seq: null,
      title: siteTitle,
      description: manifest.description ?? '',
      settings: await readSettings(),
      courses: courses.map((c) => c.id),
      created_at: now,
      last_opened_at: now,
    },
    courses,
    chapters,
    lessons,
    decks,
    terms,
    assets,
  };

  const out = path.resolve(root, argValue('--out') ?? `${siteId}.learn-anywhere-builder.json`);
  await writeFile(out, JSON.stringify(envelope, null, 2));

  console.log(`Exported site "${siteTitle}" (${siteId}) → ${out}`);
  console.log(
    `  ${courses.length} course(s), ${chapters.length} chapter(s), ${lessons.length} lesson(s), ` +
      `${decks.length} deck(s), ${terms.length} term(s), ${assets.length} image(s)`
  );
  for (const w of warnings) console.warn(`  warning: ${w}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
