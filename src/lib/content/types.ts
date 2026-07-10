/**
 * Content payload shapes shared by the build-time emitter (bundle.ts) and
 * the client-side cache sync (sync.ts). Pages bake these into their HTML as
 * JSON so the client can cache content into IndexedDB next to progress.
 *
 * Slugs are path-scoped ids (`course/chapter/lesson`), which double as the
 * URL path under /courses/.
 */
import type { Question } from '../assessment/types';

export interface CourseContent {
  slug: string;
  content_hash: string;
  title: string;
  description: string; // markdown body
  chapters: string[]; // ordered chapter slugs (full ids)
}

export interface ChapterContent {
  slug: string;
  content_hash: string;
  title: string;
  description: string;
  lessons: string[]; // ordered lesson slugs (full ids)
  // Present ⇒ the chapter ends with a full-page test at <chapter>/test/.
  test?: Question[];
  // POST target for test submissions (human marking); see assessment/submit.ts.
  result_endpoint?: string;
}

/**
 * A lesson is an EXERCISE when it declares a `quiz`; otherwise it is a
 * READING page. `kind` is derived at build time, never authored.
 */
export type LessonKind = 'exercise' | 'reading';

export interface LessonContent {
  slug: string;
  content_hash: string;
  title: string;
  description: string;
  kind: LessonKind;
  quiz?: Question[];
  // POST target for quiz submissions (human marking); see assessment/submit.ts.
  result_endpoint?: string;
}
