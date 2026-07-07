/**
 * Entity types + object-store map. GENERATED from your schema.
 */

/**
 * Bookkeeping fields on every entity. This app is offline-only, but the
 * fields keep soft deletes working and leave the door open to adding a sync
 * backend later without a data migration.
 */
export interface SyncFields {
  id: string; // UUID v4, client-generated
  updated_at: string; // UTC ISO 8601; LWW conflict-resolution field
  deleted_at: string | null; // soft-delete tombstone (null = alive)
  server_seq: number | null; // server sync cursor (null = never synced)
}

export interface Exercises extends SyncFields {
  complete: boolean;
  user_solution: string;
  started: string | null; // UTC ISO 8601
  completed: string | null; // UTC ISO 8601
  initial_sql: string;
  desired_state: Record<string, unknown>;
}

export interface Courses extends SyncFields {
  description: string;
  current_chapter: string | null; // FK -> chapters.id
  completed: string | null; // UTC ISO 8601
  started: string | null; // UTC ISO 8601
}

export interface Chapters extends SyncFields {
  description: string;
  course: string; // FK -> courses.id
  completed: string | null; // UTC ISO 8601
  started: string | null; // UTC ISO 8601
}

export interface StoreIndex {
  name: string;
  multiEntry?: boolean;
}

export const STORES: Record<string, { indexes: StoreIndex[] }> = {
  exercises: { indexes: [] },
  courses: { indexes: [] },
  chapters: { indexes: [] },
};

export type StoreName = keyof typeof STORES;
