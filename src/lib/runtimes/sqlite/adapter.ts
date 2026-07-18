/**
 * The SQLite runtime adapter — wraps the worker client behind the shared
 * RuntimeAdapter contract. A future pglite adapter implements the same
 * interface with a different engine (and dialect notes in its docs).
 */
import type { DatabaseSession, RuntimeAdapter } from '../types';
import { SqlClient } from './client';

export const sqliteAdapter: RuntimeAdapter = {
  id: 'sqlite',
  label: 'SQLite',
  kind: 'database',
  async editorLanguage() {
    const { sql, SQLite } = await import('@codemirror/lang-sql');
    return sql({ dialect: SQLite });
  },
  async createSession(): Promise<DatabaseSession> {
    // SqlClient structurally satisfies DatabaseSession (plus extras like
    // serialize/exportJson/checkSolution that the playground uses).
    return new SqlClient();
  },
};
