/**
 * The runtime adapter contract — everything engine-specific for code-based
 * exercises lives behind these interfaces so new runtimes (pglite, and later
 * the pure-code extension's engines) are additive.
 *
 * The pure-code extension (general-code-exams-plan.md) widens RuntimeAdapter
 * with kind 'code' and a process-model session — nothing here may assume
 * database-only beyond the `kind` union.
 */
import type { LanguageSupport } from '@codemirror/language';

/** One result row, as the engine returns it. */
export type Row = Record<string, unknown>;

export interface TableData {
  name: string;
  columns: { name: string; type: string }[];
  rows: Row[];
}

export interface RuntimeAdapter {
  /** Registry id — what content frontmatter's `runtime:` refers to. */
  id: string;
  /** Human label for playground tabs etc. ("SQLite"). */
  label: string;
  /** 'web' is a singleton kind, not an adapter; the extension adds 'code'. */
  kind: 'database';
  /** CodeMirror language for the editor (lazy — language packages are heavy). */
  editorLanguage(): Promise<LanguageSupport>;
  /** Boot an engine session, usually wrapping a Web Worker. */
  createSession(): Promise<DatabaseSession>;
  /** Extra asset URLs for precache.json (engines with multi-file payloads). */
  precacheAssets?(): string[];
}

/**
 * A live database engine — lite-learner's worker protocol, verbatim
 * (reset/exec/validate/listTables/tableData/dump).
 */
export interface DatabaseSession {
  /** Discard everything and start a fresh in-memory database. */
  reset(): Promise<void>;
  /** Execute one or more statements; resolves with any result rows. */
  exec(sql: string): Promise<Row[]>;
  /** Prepare-check the statements without executing; throws engine errors. */
  validate(sql: string): Promise<void>;
  listTables(): Promise<string[]>;
  tableData(name: string): Promise<TableData>;
  /** SQL-text snapshot of the current database (schema, optionally data). */
  dump(includeData: boolean): Promise<string>;
  destroy(): void;
}
