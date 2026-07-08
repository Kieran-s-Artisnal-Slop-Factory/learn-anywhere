/** Message types shared between the SQLite worker and its client. */
import type { Row } from './comparator';

export type SqlRequest =
  | { id: number; type: 'reset' }
  | { id: number; type: 'exec'; sql: string }
  | { id: number; type: 'validate'; sql: string }
  | { id: number; type: 'listTables' }
  | { id: number; type: 'tableData'; name: string }
  | { id: number; type: 'dump' };

export interface TableData {
  name: string;
  columns: { name: string; type: string }[];
  rows: Row[];
}

export type SqlResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

/** Omit that distributes over a union (plain Omit collapses SqlRequest). */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
