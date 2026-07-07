/**
 * Progress stamping. Completion is always the nullable `completed` timestamp
 * — "is complete" derives from `completed != null`.
 *
 * Rules:
 *  - opening an exercise stamps started on the exercise, its chapter, and its
 *    course (first time only) and points course.current_chapter at the chapter
 *  - passing an exercise's solution check stamps exercise.completed, then
 *    cascades: chapter.completed when every exercise in it is complete,
 *    course.completed when every chapter is complete
 */
import { get, nowIso, put } from './db/repo';
import type { Chapters, Courses, Exercises } from './db/types';

/** Plan step 5 of exercise load + course position bookkeeping. */
export async function markExerciseOpened(
  courseSlug: string,
  chapterSlug: string,
  exercise: Exercises
): Promise<Exercises> {
  const now = nowIso();
  let updated = exercise;
  if (!exercise.started) {
    updated = await put<Exercises>('exercises', { ...exercise, started: now });
  }
  const chapter = await get<Chapters>('chapters', chapterSlug);
  if (chapter && !chapter.started) {
    await put<Chapters>('chapters', { ...chapter, started: now });
  }
  const course = await get<Courses>('courses', courseSlug);
  if (course && (!course.started || course.current_chapter !== chapterSlug)) {
    await put<Courses>('courses', {
      ...course,
      started: course.started ?? now,
      current_chapter: chapterSlug,
    });
  }
  return updated;
}

/** Stamp a passed exercise and cascade chapter/course completion. */
export async function markExerciseCompleted(
  courseSlug: string,
  chapterSlug: string,
  exercise: Exercises
): Promise<Exercises> {
  const now = nowIso();
  const updated = exercise.completed
    ? exercise
    : await put<Exercises>('exercises', { ...exercise, completed: now });

  const chapter = await get<Chapters>('chapters', chapterSlug);
  if (chapter && !chapter.completed) {
    const siblings = await Promise.all(chapter.exercises.map((slug) => get<Exercises>('exercises', slug)));
    if (siblings.every((e) => e?.completed)) {
      await put<Chapters>('chapters', { ...chapter, completed: now });
      const course = await get<Courses>('courses', courseSlug);
      if (course && !course.completed) {
        const chapters = await Promise.all(course.chapters.map((slug) => get<Chapters>('chapters', slug)));
        if (chapters.every((c) => c?.completed)) {
          await put<Courses>('courses', { ...course, completed: now });
        }
      }
    }
  }
  return updated;
}
