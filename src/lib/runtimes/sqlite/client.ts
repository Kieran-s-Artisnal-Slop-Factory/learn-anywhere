/**
 * Promise-based client for the SQLite worker. One client = one worker = one
 * in-memory database.
 */
import type { DesiredState, Row } from './comparator';
import { rowsMatch } from './comparator';
import type { DistributiveOmit, SqlRequest, SqlResponse, TableData } from './protocol';

export type { DesiredState };

export class SqlClient {
  #worker: Worker;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.#worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.#worker.onmessage = (event: MessageEvent<SqlResponse>) => {
      const msg = event.data;
      const pending = this.#pending.get(msg.id);
      if (!pending) return;
      this.#pending.delete(msg.id);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error));
    };
  }

  #send<T>(request: DistributiveOmit<SqlRequest, 'id'>): Promise<T> {
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.#worker.postMessage({ ...request, id });
    });
  }

  /** Discard the in-memory DB and start blank. */
  reset(): Promise<void> {
    return this.#send({ type: 'reset' });
  }

  /** Run one or more statements; returns any result rows produced. */
  exec(sql: string): Promise<Row[]> {
    return this.#send({ type: 'exec', sql });
  }

  /** Compile (but don't run) every statement; rejects with the SQLite error. */
  validate(sql: string): Promise<void> {
    return this.#send({ type: 'validate', sql });
  }

  listTables(): Promise<string[]> {
    return this.#send({ type: 'listTables' });
  }

  tableData(name: string): Promise<TableData> {
    return this.#send({ type: 'tableData', name });
  }

  /** Re-runnable SQL (schema, plus INSERTs when `includeData`). */
  dump(includeData = true): Promise<string> {
    return this.#send({ type: 'dump', includeData });
  }

  /** Binary SQLite file image (`.db`); schema-only when `includeData` is false. */
  serialize(includeData = true): Promise<Uint8Array> {
    return this.#send({ type: 'serialize', includeData });
  }

  /**
   * Per-table JSON. With data: `{ table: rows[] }`. Schema only:
   * `{ table: columnInfo[] }`.
   */
  exportJson(includeData = true): Promise<string> {
    return this.#send({ type: 'exportJson', includeData });
  }

  /** Run the solution query against the current DB and compare. */
  async checkSolution(desired: DesiredState): Promise<boolean> {
    const actual = await this.exec(desired.query);
    return rowsMatch(desired.rows, actual);
  }

  /** Terminate the worker (kills any runaway query). */
  destroy(): void {
    this.#worker.terminate();
    const error = new Error('SQL worker terminated');
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
  }
}
