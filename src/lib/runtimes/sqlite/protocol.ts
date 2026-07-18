/**
 * Message types shared between the SQLite worker and its client.
 * (Ported from lite-learner's lib/sql/protocol.ts; Row/TableData now come
 * from the shared runtime types.)
 */
import type { Row, TableData } from '../types';

export type { Row, TableData };

export type SqlRequest =
  | { id: number; type: 'reset' }
  | { id: number; type: 'exec'; sql: string }
  | { id: number; type: 'validate'; sql: string }
  | { id: number; type: 'listTables' }
  | { id: number; type: 'tableData'; name: string }
  | { id: number; type: 'dump'; includeData: boolean }
  | { id: number; type: 'serialize'; includeData: boolean }
  | { id: number; type: 'exportJson'; includeData: boolean };

export type SqlResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

/** Omit that distributes over a union (plain Omit collapses SqlRequest). */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
