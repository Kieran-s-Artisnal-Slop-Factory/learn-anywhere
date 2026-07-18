/**
 * SQLite WASM Web Worker. Owns a single in-memory database so a slow or
 * looping query never freezes the UI thread.
 *
 * In-memory only (no OPFS): OPFS needs SharedArrayBuffer and therefore
 * COOP/COEP headers, which many static hosts can't set. A fresh in-memory DB
 * per exercise keeps deployment host-agnostic.
 *
 * Protocol: the client posts `{ id, type, ...payload }` and the worker
 * replies `{ id, ok: true, result }` or `{ id, ok: false, error }`.
 */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Row } from './comparator';
import type { SqlRequest, SqlResponse, TableData } from './protocol';

let sqlite3: Sqlite3Static | null = null;
let db: Database | null = null;

async function ensureDb(): Promise<Database> {
  if (!sqlite3) {
    // The published typings take no arguments, but the Emscripten loader
    // accepts print/printErr overrides — silence its console chatter.
    const init = sqlite3InitModule as unknown as (config?: {
      print?: (msg: string) => void;
      printErr?: (msg: string) => void;
    }) => Promise<Sqlite3Static>;
    sqlite3 = await init({ print: () => {}, printErr: () => {} });
  }
  if (!db) {
    db = new sqlite3.oo1.DB(':memory:');
  }
  return db;
}

/** Discard the current DB and start from a blank in-memory file. */
async function reset(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
  await ensureDb();
}

/** Run one or more statements, collecting any result rows produced. */
async function exec(sql: string): Promise<Row[]> {
  const database = await ensureDb();
  const resultRows: Row[] = [];
  database.exec({ sql, rowMode: 'object', callback: (row) => void resultRows.push(row as Row) });
  return resultRows;
}

/**
 * Compile every statement in `sql` without executing any of them —
 * sqlite3_prepare_v3 across the whole string, finalizing each statement.
 * Throws (and the error bubbles to the client) on the first invalid one.
 */
async function validate(sql: string): Promise<void> {
  const database = await ensureDb();
  const s = sqlite3!;
  const { capi, wasm } = s;
  const scope = wasm.scopedAllocPush();
  try {
    // Two pointer slots: *ppStmt (out: compiled stmt), *pzTail (out: rest of SQL).
    const [pSql, sqlByteLen] = wasm.scopedAllocCString(sql, true) as unknown as [number, number];
    const [ppStmt, pzTail] = wasm.scopedAllocPtr(2) as unknown as [number, number];
    let pCurrent = pSql;
    const pEnd = pSql + sqlByteLen;
    while (pCurrent < pEnd) {
      const rc = capi.sqlite3_prepare_v3(
        database.pointer!,
        pCurrent,
        pEnd - pCurrent,
        0,
        ppStmt,
        pzTail
      );
      if (rc !== 0) {
        throw new Error(capi.sqlite3_errmsg(database.pointer!));
      }
      const pStmt = wasm.peekPtr(ppStmt);
      pCurrent = wasm.peekPtr(pzTail);
      if (pStmt) capi.sqlite3_finalize(pStmt);
      else break; // only whitespace/comments remained
    }
  } finally {
    wasm.scopedAllocPop(scope);
  }
}

/** SQL literal for a value read back from the DB (INTEGER/REAL/TEXT/BLOB/NULL). */
function quoteValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (v instanceof Uint8Array) {
    return "X'" + Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('') + "'";
  }
  return "'" + String(v).replaceAll("'", "''") + "'";
}

/** Double-quote an identifier, escaping embedded quotes. */
const quoteId = (name: string): string => '"' + name.replaceAll('"', '""') + '"';

/**
 * Serialize the whole database to re-runnable SQL — our own `.dump`, since the
 * WASM build has no shell. Emits each table's schema followed by INSERTs, then
 * indexes/triggers/views. Generated columns are skipped in the INSERT column
 * list (you can't write them); virtual tables (FTS5, R*Tree) are dumped by
 * their logical columns and their internal shadow tables are omitted.
 */
async function dump(includeData: boolean): Promise<string> {
  const database = await ensureDb();
  const query = (sql: string): Row[] => {
    const out: Row[] = [];
    database.exec({ sql, rowMode: 'object', callback: (row) => void out.push(row as Row) });
    return out;
  };

  const objects = query(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid;"
  );
  const tables = objects.filter((o) => o.type === 'table');
  const virtualNames = tables
    .filter((t) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(String(t.sql)))
    .map((t) => String(t.name));
  // A virtual table's shadow tables are named "<vtab>_something".
  const isShadow = (name: string) =>
    virtualNames.some((vt) => name !== vt && name.startsWith(vt + '_'));

  const lines: string[] = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];

  for (const t of tables) {
    const name = String(t.name);
    if (isShadow(name)) continue;
    lines.push(String(t.sql) + ';');
    if (!includeData) continue;
    // hidden = 0 excludes generated columns (and other non-writable columns).
    const cols = query(
      `SELECT name FROM pragma_table_xinfo(${quoteValue(name)}) WHERE hidden = 0 ORDER BY cid;`
    ).map((c) => String(c.name));
    if (cols.length === 0) continue;
    const colList = cols.map(quoteId).join(', ');
    for (const r of query(`SELECT ${colList} FROM ${quoteId(name)};`)) {
      lines.push(
        `INSERT INTO ${quoteId(name)} (${colList}) VALUES (${cols.map((c) => quoteValue(r[c])).join(', ')});`
      );
    }
  }

  // Indexes, triggers, and views after all table data (so restore doesn't fire
  // triggers or hit half-built views).
  for (const o of objects) {
    if (o.type === 'table' || isShadow(String(o.name))) continue;
    lines.push(String(o.sql) + ';');
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

/**
 * Serialize the database to a binary SQLite file image (`.db`). Schema only
 * (`includeData` false) replays just the schema into a throwaway DB first, so
 * the exported file has the tables but no rows.
 */
async function serialize(includeData: boolean): Promise<Uint8Array> {
  const database = await ensureDb();
  if (includeData) {
    // Copy out of WASM memory so the transferred bytes outlive the DB.
    return sqlite3!.capi.sqlite3_js_db_export(database.pointer!);
  }
  const schema = await dump(false);
  const temp = new sqlite3!.oo1.DB(':memory:');
  try {
    temp.exec(schema);
    return sqlite3!.capi.sqlite3_js_db_export(temp.pointer!);
  } finally {
    temp.close();
  }
}

/**
 * Export every base table as JSON. With data: `{ table: [rowObjects] }`. Schema
 * only: `{ table: [{ name, type, notnull, pk }] }`. Virtual tables' internal
 * shadow tables are skipped; BigInt integers and BLOB bytes are coerced to
 * JSON-friendly forms.
 */
async function exportJson(includeData: boolean): Promise<string> {
  const database = await ensureDb();
  const query = (sql: string): Row[] => {
    const out: Row[] = [];
    database.exec({ sql, rowMode: 'object', callback: (row) => void out.push(row as Row) });
    return out;
  };
  const tables = query(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  const virtualNames = tables
    .filter((t) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(String(t.sql)))
    .map((t) => String(t.name));
  const isShadow = (name: string) =>
    virtualNames.some((vt) => name !== vt && name.startsWith(vt + '_'));

  const result: Record<string, Row[]> = {};
  for (const t of tables) {
    const name = String(t.name);
    if (isShadow(name)) continue;
    result[name] = includeData
      ? query(`SELECT * FROM ${quoteId(name)};`)
      : query(
          `SELECT name, type, "notnull" AS "notnull", pk FROM pragma_table_info(${quoteValue(name)}) ORDER BY cid;`
        );
  }
  return JSON.stringify(
    result,
    (_key, value) =>
      typeof value === 'bigint'
        ? Number(value)
        : value instanceof Uint8Array
          ? Array.from(value)
          : value,
    2
  );
}

/** Table names, alphabetical (the DB viewer opens the first one). */
async function listTables(): Promise<string[]> {
  const rows = await exec(
    "SELECT tbl_name FROM sqlite_master WHERE type='table' AND tbl_name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  return rows.map((r) => String(r['tbl_name']));
}

/** Column metadata + the first 50 rows of one table, for the DB viewer. */
async function tableData(name: string): Promise<TableData> {
  const database = await ensureDb();
  const columns: TableData['columns'] = [];
  database.exec({
    // Parameter binding doesn't work inside PRAGMA on all builds; quote by
    // doubling embedded quotes instead.
    sql: `PRAGMA table_info("${name.replaceAll('"', '""')}");`,
    rowMode: 'object',
    callback: (row: Row) => {
      columns.push({ name: String(row['name']), type: String(row['type']) });
    },
  });
  const rows: Row[] = [];
  database.exec({
    sql: `SELECT * FROM "${name.replaceAll('"', '""')}" LIMIT 50;`,
    rowMode: 'object',
    callback: (row) => void rows.push(row as Row),
  });
  return { name, columns, rows };
}

self.onmessage = async (event: MessageEvent<SqlRequest>) => {
  const msg = event.data;
  const reply = (response: SqlResponse) => self.postMessage(response);
  try {
    switch (msg.type) {
      case 'reset':
        await reset();
        reply({ id: msg.id, ok: true, result: undefined });
        break;
      case 'exec':
        reply({ id: msg.id, ok: true, result: await exec(msg.sql) });
        break;
      case 'validate':
        await validate(msg.sql);
        reply({ id: msg.id, ok: true, result: undefined });
        break;
      case 'listTables':
        reply({ id: msg.id, ok: true, result: await listTables() });
        break;
      case 'tableData':
        reply({ id: msg.id, ok: true, result: await tableData(msg.name) });
        break;
      case 'dump':
        reply({ id: msg.id, ok: true, result: await dump(msg.includeData) });
        break;
      case 'serialize':
        reply({ id: msg.id, ok: true, result: await serialize(msg.includeData) });
        break;
      case 'exportJson':
        reply({ id: msg.id, ok: true, result: await exportJson(msg.includeData) });
        break;
    }
  } catch (err) {
    reply({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
