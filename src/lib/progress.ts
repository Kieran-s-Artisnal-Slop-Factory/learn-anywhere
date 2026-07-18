/**
 * Progress stamping. Completion is always the nullable `completed` timestamp
 * — "is complete" derives from `completed != null`.
 *
 * Rules:
 *  - opening a lesson (or a chapter test) stamps started on it, its chapter,
 *    and its course (first time only) and points course.current_chapter at
 *    the chapter
 *  - completing a lesson (submitting the quiz for exercises, "Mark as read"
 *    for readings) stamps lesson.completed
 *  - submitting a chapter test stamps chapter.test_completed
 *  - a CHAPTER is complete when every lesson in it is complete AND its test
 *    (if it has one) has been submitted; a COURSE is complete when every
 *    chapter is
 */
import { get, nowIso, put } from './db/repo';
import type { Chapters, Courses, Lessons } from './db/types';

/** Lesson-load bookkeeping: stamp started + course position. */
export async function markLessonOpened(
  courseSlug: string,
  chapterSlug: string,
  lesson: Lessons
): Promise<Lessons> {
  const now = nowIso();
  let updated = lesson;
  if (!lesson.started) {
    updated = await put<Lessons>('lessons', { ...lesson, started: now });
  }
  await markChapterOpened(courseSlug, chapterSlug);
  return updated;
}

/** Same bookkeeping for pages that aren't a lesson (the chapter test). */
export async function markChapterOpened(courseSlug: string, chapterSlug: string): Promise<void> {
  const now = nowIso();
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
}

/**
 * Stamp a completed lesson and cascade chapter/course completion. Exercises
 * arrive here from a quiz submission, reading lessons from "Mark as read" —
 * the cascade treats every lesson uniformly.
 */
export async function markLessonCompleted(
  courseSlug: string,
  chapterSlug: string,
  lesson: Lessons
): Promise<Lessons> {
  const now = nowIso();
  const updated = lesson.completed
    ? lesson
    : await put<Lessons>('lessons', { ...lesson, completed: now });
  await maybeCompleteChapter(courseSlug, chapterSlug, now);
  return updated;
}

/**
 * Stamp a submitted chapter test (first submission only — retakes update
 * scores elsewhere but the gate stays open) and cascade completion.
 */
export async function markTestCompleted(
  courseSlug: string,
  chapter: Chapters
): Promise<Chapters> {
  const now = nowIso();
  const updated = chapter.test_completed
    ? chapter
    : await put<Chapters>('chapters', { ...chapter, test_completed: now });
  await maybeCompleteChapter(courseSlug, chapter.id, now);
  return updated;
}

/** Chapter completes when every lesson is done and the test (if any) is taken. */
async function maybeCompleteChapter(
  courseSlug: string,
  chapterSlug: string,
  now: string
): Promise<void> {
  const chapter = await get<Chapters>('chapters', chapterSlug);
  if (!chapter || chapter.completed) return;
  const siblings = await Promise.all(chapter.lessons.map((slug) => get<Lessons>('lessons', slug)));
  const lessonsDone = siblings.every((l) => l?.completed);
  // Any test variant (questions, database, web) gates completion the same way.
  const hasTest =
    (chapter.test?.length ?? 0) > 0 || chapter.test_database != null || chapter.test_web != null;
  const testDone = !hasTest || chapter.test_completed != null;
  if (!lessonsDone || !testDone) return;

  await put<Chapters>('chapters', { ...chapter, completed: now });
  const course = await get<Courses>('courses', courseSlug);
  if (course && !course.completed) {
    const chapters = await Promise.all(course.chapters.map((slug) => get<Chapters>('chapters', slug)));
    if (chapters.every((c) => c?.completed)) {
      await put<Courses>('courses', { ...course, completed: now });
    }
  }
}

/** Progress fields on a lesson row, back to their just-enrolled defaults. */
function clearedLesson(lesson: Lessons): Lessons {
  return {
    ...lesson,
    quiz_responses: null,
    quiz_score: null,
    solution: null,
    started: null,
    completed: null,
  };
}

/** Progress fields on a chapter row (not its lessons — see resetChapter). */
function clearedChapter(chapter: Chapters): Chapters {
  return {
    ...chapter,
    test_responses: null,
    test_score: null,
    test_completed: null,
    test_solution: null,
    started: null,
    completed: null,
  };
}

/**
 * Wipe all progress for a chapter: every lesson in it plus the chapter row
 * itself (test answers/score included). Because a reset chapter can no longer
 * be complete, its course is un-completed too, and current_chapter is cleared
 * if it pointed here. Cached content is untouched — this only nulls progress.
 */
export async function resetChapterProgress(
  courseSlug: string,
  chapterSlug: string
): Promise<void> {
  const chapter = await get<Chapters>('chapters', chapterSlug);
  if (!chapter) return;
  for (const slug of chapter.lessons) {
    const lesson = await get<Lessons>('lessons', slug);
    if (lesson) await put<Lessons>('lessons', clearedLesson(lesson));
  }
  await put<Chapters>('chapters', clearedChapter(chapter));

  const course = await get<Courses>('courses', courseSlug);
  if (course && (course.completed || course.current_chapter === chapterSlug)) {
    await put<Courses>('courses', {
      ...course,
      completed: null,
      current_chapter: course.current_chapter === chapterSlug ? null : course.current_chapter,
    });
  }
}

/**
 * Wipe all progress for a whole course: every chapter and lesson, plus the
 * course row (started/completed/current_chapter). Leaves the visitor enrolled
 * with the content still cached — just back to zero progress.
 */
export async function resetCourseProgress(courseSlug: string): Promise<void> {
  const course = await get<Courses>('courses', courseSlug);
  if (!course) return;
  for (const chapterSlug of course.chapters) {
    const chapter = await get<Chapters>('chapters', chapterSlug);
    if (!chapter) continue;
    for (const slug of chapter.lessons) {
      const lesson = await get<Lessons>('lessons', slug);
      if (lesson) await put<Lessons>('lessons', clearedLesson(lesson));
    }
    await put<Chapters>('chapters', clearedChapter(chapter));
  }
  await put<Courses>('courses', {
    ...course,
    current_chapter: null,
    started: null,
    completed: null,
  });
}
