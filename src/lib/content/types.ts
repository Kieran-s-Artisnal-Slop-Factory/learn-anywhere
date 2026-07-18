/**
 * Content payload shapes shared by the build-time emitter (bundle.ts) and
 * the client-side cache sync (sync.ts). Pages bake these into their HTML as
 * JSON so the client can cache content into IndexedDB next to progress.
 *
 * Slugs are path-scoped ids (`course/chapter/lesson`), which double as the
 * URL path under /courses/.
 */
import type { Question } from '../assessment/types';
import type { Row } from '../runtimes/types';

/** A database exercise definition (lesson `database:` / chapter `test_database:`). */
export interface DatabaseBlock {
  runtime: string; // registry id ('sqlite', later 'pglite')
  initial_sql: string;
  desired_state?: { query: string; rows: Row[] };
}

/** A web-preview exercise definition (lesson `web:` / chapter `test_web:`). */
export interface WebBlock {
  lang: 'js' | 'ts';
  starter: { html: string; css: string; js: string };
}

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
  // At most one of test / test_database / test_web (schema-enforced).
  test?: Question[];
  test_database?: DatabaseBlock;
  test_web?: WebBlock;
  // POST target for test submissions (human marking); see assessment/submit.ts.
  result_endpoint?: string;
}

/**
 * A lesson's kind is derived at build time from which assessment block its
 * frontmatter declares (at most one), never authored: `quiz` ⇒ exercise,
 * `database`/`web` ⇒ that kind, none ⇒ reading. The pure-code extension
 * adds 'code' (general-code-exams-plan.md).
 */
export type LessonKind = 'exercise' | 'reading' | 'database' | 'web';

export interface LessonContent {
  slug: string;
  content_hash: string;
  title: string;
  description: string;
  kind: LessonKind;
  quiz?: Question[];
  database?: DatabaseBlock;
  web?: WebBlock;
  // POST target for quiz submissions (human marking); see assessment/submit.ts.
  result_endpoint?: string;
}
