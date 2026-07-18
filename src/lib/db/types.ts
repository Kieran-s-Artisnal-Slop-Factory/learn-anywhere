/**
 * Entity types + object-store map.
 *
 * Two kinds of data share each row:
 *  - cached CONTENT (title, description, quiz/test questions, …) copied from
 *    the static content collections on enrollment and refreshed via
 *    `content_hash`
 *  - per-visitor PROGRESS (started, completed, responses, scores, …) that
 *    lives only in IndexedDB
 *
 * Content-backed rows are keyed by the content slug (`id` = slug) — the
 * path-scoped id (`course/chapter/lesson`), stable across builds — that is
 * what lets the content-hash check find the right row to refresh.
 */
import type { Question, QuestionResponse, Score } from '../assessment/types';
import type { DatabaseBlock, LessonKind, WebBlock } from '../content/types';

/**
 * A code-exercise solution buffer: SQL text (database kind) or the
 * per-tab buffers (web kind). Restored on load but never auto-executed.
 */
export type Solution = string | Record<string, string>;

/**
 * Bookkeeping fields on every entity. This app is offline-only, but the
 * fields keep soft deletes working and leave the door open to adding a sync
 * backend later without a data migration.
 */
export interface SyncFields {
  id: string; // content slug for content-backed rows
  updated_at: string; // UTC ISO 8601; LWW conflict-resolution field
  deleted_at: string | null; // soft-delete tombstone (null = alive)
  server_seq: number | null; // server sync cursor (null = never synced)
}

/** Content fields cached from the static bundle, refreshed by hash. */
export interface CachedContent {
  content_hash: string;
  title: string;
  description: string; // markdown body
}

export interface Courses extends SyncFields, CachedContent {
  chapters: string[]; // ordered chapter slugs — array order is chapter order
  // progress
  current_chapter: string | null; // chapter slug
  started: string | null; // UTC ISO 8601
  completed: string | null; // UTC ISO 8601 — completion derives from != null
}

export interface Chapters extends SyncFields, CachedContent {
  lessons: string[]; // ordered lesson slugs — array order is lesson order
  // At most one of the three test variants (schema-enforced).
  test?: Question[]; // present ⇒ the chapter ends with a full-page test
  test_database?: DatabaseBlock;
  test_web?: WebBlock;
  // progress
  test_responses: QuestionResponse[] | null; // last submission's answers
  test_score: Score | null; // last submission's score
  test_completed: string | null; // first submission timestamp — gates chapter completion
  test_solution: Solution | null; // code-test editor buffer(s)
  started: string | null; // UTC ISO 8601
  completed: string | null; // UTC ISO 8601
}

/**
 * A lesson is an exercise (has a quiz → completed by submitting it) or a
 * reading page (completed via "Mark as read").
 */
export interface Lessons extends SyncFields, CachedContent {
  kind: LessonKind;
  // At most one assessment block (schema-enforced).
  quiz?: Question[];
  database?: DatabaseBlock;
  web?: WebBlock;
  // progress
  quiz_responses: QuestionResponse[] | null; // last submission's answers
  quiz_score: Score | null; // last submission's score
  solution: Solution | null; // code-exercise editor buffer(s)
  started: string | null; // UTC ISO 8601
  completed: string | null; // UTC ISO 8601
}

export interface StoreIndex {
  name: string;
  multiEntry?: boolean;
}

export const STORES: Record<string, { indexes: StoreIndex[] }> = {
  lessons: { indexes: [] },
  courses: { indexes: [] },
  chapters: { indexes: [] },
};

export type StoreName = keyof typeof STORES;
