/**
 * BUILD-TIME ONLY (imports node:crypto + astro:content types) — turns content
 * collection entries into the JSON payloads pages embed for the client, each
 * stamped with a stable content_hash so the client cache can detect
 * re-authored content across deploys.
 *
 * This is also where the course→chapter→lesson wiring is resolved: parents
 * list their children as relative leaf names (see content.config.ts), and
 * loadCourseTrees() builds the full path ids, throwing on anything missing or
 * orphaned so broken wiring fails the build.
 */
import { createHash } from 'node:crypto';
import { getCollection, type CollectionEntry } from 'astro:content';
import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';
import type { Question } from '../assessment/types';
// @ts-expect-error — plain .mjs module (shared with astro.config.mjs, which
// imports it before any TypeScript pipeline exists).
import { remarkGlossary } from '../glossary/remark-glossary.mjs';
import { resolveTrees } from './resolve';
import type { ChapterContent, CourseContent, LessonContent } from './types';

/**
 * Question prompts are markdown too (glossary [[refs]] included), but they
 * live in frontmatter, which Astro's content pipeline leaves as plain
 * strings. This processor renders them at build time with the same glossary
 * plugin as lesson bodies; the HTML rides along as `prompt_html` next to the
 * raw prompt (which result-endpoint submissions keep sending as text).
 */
let promptProcessor: Promise<MarkdownProcessor> | null = null;

async function renderPrompt(markdown: string): Promise<string> {
  promptProcessor ??= createMarkdownProcessor({
    remarkPlugins: [[remarkGlossary, { base: import.meta.env.BASE_URL }]],
  });
  const rendered = await (await promptProcessor).render(markdown);
  return String(rendered.code);
}

async function withPromptHtml(questions: Question[] | undefined): Promise<Question[] | undefined> {
  if (!questions) return undefined;
  return Promise.all(
    questions.map(async (q) => ({ ...q, prompt_html: await renderPrompt(q.prompt) }))
  );
}

/** JSON.stringify with recursively sorted object keys, so hashing is stable. */
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ':' + canonicalize(v));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Stable hash of one entry's content (frontmatter + body). */
export function contentHash(data: unknown, body: string): string {
  return createHash('sha256')
    .update(canonicalize({ body, data }))
    .digest('hex');
}

/**
 * A fully resolved course: entries for the course, its chapters (in course
 * order), and each chapter's lessons (in chapter order).
 */
export interface CourseEntryTree {
  course: CollectionEntry<'courses'>;
  chapters: {
    chapter: CollectionEntry<'chapters'>;
    lessons: CollectionEntry<'lessons'>[];
  }[];
}

/** A whole course as embeddable content payloads (what pages bake in). */
export interface CourseBundle {
  course: CourseContent;
  chapters: ChapterContent[];
  lessons: LessonContent[];
}

/**
 * Load every course and resolve the relative-leaf child arrays into full
 * path ids. Throws on a listed child that doesn't exist AND on files no
 * parent lists (orphans) — both would otherwise ship broken or invisible
 * content.
 */
export async function loadCourseTrees(): Promise<CourseEntryTree[]> {
  const [courseEntries, chapterEntries, lessonEntries] = await Promise.all([
    getCollection('courses'),
    getCollection('chapters'),
    getCollection('lessons'),
  ]);
  return resolveTrees(courseEntries, chapterEntries, lessonEntries);
}

export async function toBundle(tree: CourseEntryTree): Promise<CourseBundle> {
  return {
    course: courseContent(tree.course),
    chapters: await Promise.all(tree.chapters.map(({ chapter }) => chapterContent(chapter))),
    lessons: await Promise.all(
      tree.chapters.flatMap(({ lessons }) => lessons.map(lessonContent))
    ),
  };
}

export function courseContent(entry: CollectionEntry<'courses'>): CourseContent {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    chapters: entry.data.chapters.map((leaf) => `${entry.id}/${leaf}`),
  };
}

export async function chapterContent(entry: CollectionEntry<'chapters'>): Promise<ChapterContent> {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    lessons: entry.data.lessons.map((leaf) => `${entry.id}/${leaf}`),
    test: await withPromptHtml(entry.data.test as Question[] | undefined),
    result_endpoint: entry.data.result_endpoint,
  };
}

export async function lessonContent(entry: CollectionEntry<'lessons'>): Promise<LessonContent> {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    // Derived, never authored: a declared quiz makes it an exercise.
    kind: entry.data.quiz ? 'exercise' : 'reading',
    quiz: await withPromptHtml(entry.data.quiz as Question[] | undefined),
    result_endpoint: entry.data.result_endpoint,
  };
}
