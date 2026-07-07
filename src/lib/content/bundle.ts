/**
 * BUILD-TIME ONLY (imports node:crypto + astro:content types) — turns content
 * collection entries into the JSON payloads pages embed for the client, each
 * stamped with a stable content_hash so the client cache can detect
 * re-authored content across deploys.
 */
import { createHash } from 'node:crypto';
import { getCollection, getEntries, type CollectionEntry } from 'astro:content';
import type { ChapterContent, CourseContent, ExerciseContent } from './types';

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
 * order), and each chapter's exercises (in chapter order).
 */
export interface CourseEntryTree {
  course: CollectionEntry<'courses'>;
  chapters: {
    chapter: CollectionEntry<'chapters'>;
    exercises: CollectionEntry<'exercises'>[];
  }[];
}

/** A whole course as embeddable content payloads (what pages bake in). */
export interface CourseBundle {
  course: CourseContent;
  chapters: ChapterContent[];
  exercises: ExerciseContent[];
}

/**
 * Load every course and resolve its reference() arrays. Throwing on a missing
 * reference makes broken course/chapter/exercise wiring fail the build.
 */
export async function loadCourseTrees(): Promise<CourseEntryTree[]> {
  const courseEntries = await getCollection('courses');
  return Promise.all(
    courseEntries.map(async (course) => {
      const chapterEntries = await getEntries(course.data.chapters);
      const missingChapter = chapterEntries.findIndex((c) => !c);
      if (missingChapter !== -1) {
        throw new Error(
          `Course "${course.id}" references missing chapter "${course.data.chapters[missingChapter]!.id}"`
        );
      }
      const chapters = await Promise.all(
        chapterEntries.map(async (chapter) => {
          const exercises = await getEntries(chapter.data.exercises);
          const missing = exercises.findIndex((e) => !e);
          if (missing !== -1) {
            throw new Error(
              `Chapter "${chapter.id}" references missing exercise "${chapter.data.exercises[missing]!.id}"`
            );
          }
          return { chapter, exercises };
        })
      );
      return { course, chapters };
    })
  );
}

export function toBundle(tree: CourseEntryTree): CourseBundle {
  return {
    course: courseContent(tree.course),
    chapters: tree.chapters.map(({ chapter }) => chapterContent(chapter)),
    exercises: tree.chapters.flatMap(({ exercises }) => exercises.map(exerciseContent)),
  };
}

export function courseContent(entry: CollectionEntry<'courses'>): CourseContent {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    chapters: entry.data.chapters.map((ref) => ref.id),
  };
}

export function chapterContent(entry: CollectionEntry<'chapters'>): ChapterContent {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    exercises: entry.data.exercises.map((ref) => ref.id),
  };
}

export function exerciseContent(entry: CollectionEntry<'exercises'>): ExerciseContent {
  const body = entry.body ?? '';
  return {
    slug: entry.id,
    content_hash: contentHash(entry.data, body),
    title: entry.data.title,
    description: body,
    initial_sql: entry.data.initial_sql,
    desired_state: entry.data.desired_state,
  };
}
