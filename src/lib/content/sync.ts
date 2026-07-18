/**
 * CLIENT-SIDE content-cache invalidation. Pages embed *Content payloads
 * (built by bundle.ts, each carrying a content_hash); on load these functions
 * reconcile them with the cached IndexedDB rows:
 *
 *  - no row       -> create it from the embedded content
 *  - hash differs -> overwrite the cached CONTENT fields + hash, preserving
 *                    PROGRESS (started/completed/responses/scores/…)
 *  - hash matches -> use the cache as-is
 *
 * Rows are keyed by content slug (id = slug), which is what makes the lookup
 * stable across builds.
 */
import { getDB } from '../db/db';
import { nowIso, put } from '../db/repo';
import type { Chapters, Courses, Lessons, StoreName, SyncFields } from '../db/types';
import type { ChapterContent, CourseContent, LessonContent } from './types';

/** Raw row fetch that sees tombstones — a re-enrollment must revive them. */
async function rawGet<T extends SyncFields>(store: StoreName, slug: string): Promise<T | undefined> {
  return (await (await getDB()).get(store, slug)) as T | undefined;
}

function newContentRow(slug: string): SyncFields {
  return { id: slug, updated_at: nowIso(), deleted_at: null, server_seq: null };
}

export async function syncCourse(content: CourseContent): Promise<Courses> {
  const existing = await rawGet<Courses>('courses', content.slug);
  if (existing && !existing.deleted_at && existing.content_hash === content.content_hash) {
    return existing;
  }
  return put<Courses>('courses', {
    ...(existing ?? { ...newContentRow(content.slug), current_chapter: null, started: null, completed: null }),
    deleted_at: null,
    content_hash: content.content_hash,
    title: content.title,
    description: content.description,
    chapters: content.chapters,
  } as Courses);
}

export async function syncChapter(content: ChapterContent): Promise<Chapters> {
  const existing = await rawGet<Chapters>('chapters', content.slug);
  if (existing && !existing.deleted_at && existing.content_hash === content.content_hash) {
    return existing;
  }
  return put<Chapters>('chapters', {
    ...(existing ?? {
      ...newContentRow(content.slug),
      test_responses: null,
      test_score: null,
      test_completed: null,
      test_solution: null,
      started: null,
      completed: null,
    }),
    deleted_at: null,
    content_hash: content.content_hash,
    title: content.title,
    description: content.description,
    lessons: content.lessons,
    test: content.test,
    test_database: content.test_database,
    test_web: content.test_web,
  } as Chapters);
}

export async function syncLesson(content: LessonContent): Promise<Lessons> {
  const existing = await rawGet<Lessons>('lessons', content.slug);
  if (existing && !existing.deleted_at && existing.content_hash === content.content_hash) {
    return existing;
  }
  return put<Lessons>('lessons', {
    ...(existing ?? {
      ...newContentRow(content.slug),
      quiz_responses: null,
      quiz_score: null,
      solution: null,
      started: null,
      completed: null,
    }),
    deleted_at: null,
    content_hash: content.content_hash,
    title: content.title,
    description: content.description,
    kind: content.kind,
    quiz: content.quiz,
    database: content.database,
    web: content.web,
  } as Lessons);
}

/** Cache a whole course (course + chapters + lessons) — the enrollment copy. */
export async function syncCourseBundle(bundle: {
  course: CourseContent;
  chapters: ChapterContent[];
  lessons: LessonContent[];
}): Promise<Courses> {
  for (const lesson of bundle.lessons) await syncLesson(lesson);
  for (const chapter of bundle.chapters) await syncChapter(chapter);
  return syncCourse(bundle.course);
}
