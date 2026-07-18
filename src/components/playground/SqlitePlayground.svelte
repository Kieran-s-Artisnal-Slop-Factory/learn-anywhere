<script lang="ts">
  /**
   * Free-form SQLite playground (ported from lite-learner). Starts blank,
   * autosaves the editor buffer for resumability, and can save/restore the
   * whole database as a SQL snapshot (the DB is in-memory, so without a
   * saved snapshot it resets on reload). Exports: SQL text/file, binary
   * .sqlite image, per-table JSON — schema+data or schema-only.
   *
   * Persistence lives in the per-runtime playground store (lib/playground):
   * buffers.main = editor text, snapshot = SQL dump re-run on load.
   */
  import { onDestroy, onMount } from 'svelte';
  import { loadRuntime } from '../../lib/runtimes/registry';
  import type { DatabaseSession, Row, TableData } from '../../lib/runtimes/types';
  import {
    loadPlayground,
    savePlaygroundBuffers,
    savePlaygroundSnapshot,
  } from '../../lib/playground';
  import Card from '../Card.svelte';
  import SqlEditor from '../exercise/SqlEditor.svelte';
  import DbViewer from '../exercise/DbViewer.svelte';

  let { runtimeId }: { runtimeId: string } = $props();

  const ONE_MB = 1024 * 1024;

  let session: DatabaseSession | null = null;
  let editor: SqlEditor | undefined = $state();

  let booting = $state(true);
  let bootError = $state<string | null>(null);
  let sqlError = $state<string | null>(null);
  let resultRows = $state<Row[]>([]);
  let restoredBanner = $state(false);

  let tables = $state<string[]>([]);
  let activeTable = $state<string | null>(null);
  let tableView = $state<TableData | null>(null);

  let saveMsg = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  // Set when a snapshot is over 1 MB and awaiting explicit confirmation.
  let pendingLarge = $state<{ sql: string; bytes: number } | null>(null);
  // Whether exports include row data, or just the schema (CREATE statements).
  let includeData = $state(true);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < ONE_MB) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / ONE_MB).toFixed(2)} MB`;
  }

  function scheduleSave(doc: string) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void savePlaygroundBuffers(runtimeId, { main: doc }), 600);
  }

  async function refreshViewer(preferred?: string | null) {
    if (!session) return;
    tables = await session.listTables();
    activeTable = preferred && tables.includes(preferred) ? preferred : (tables[0] ?? null);
    tableView = activeTable ? await session.tableData(activeTable) : null;
  }

  async function run() {
    if (!session || !editor) return;
    const doc = editor.getText();
    sqlError = null;
    saveMsg = null;
    restoredBanner = false;
    try {
      resultRows = doc.trim() ? await session.exec(doc) : [];
      await refreshViewer(activeTable);
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(saveTimer);
      await savePlaygroundBuffers(runtimeId, { main: doc });
    }
  }

  async function clearDb() {
    if (!session) return;
    if (tables.length > 0 && !confirm('Wipe the database? This clears every table (your saved snapshot is untouched).')) {
      return;
    }
    sqlError = null;
    saveMsg = null;
    resultRows = [];
    restoredBanner = false;
    await session.reset();
    await refreshViewer();
  }

  function triggerDownload(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportAs(dest: 'clipboard' | 'sql' | 'db' | 'json') {
    if (!session) return;
    saveError = null;
    saveMsg = null;
    const scope = includeData ? 'schema + data' : 'schema only';
    try {
      if (dest === 'clipboard') {
        const sql = await session.dump(includeData);
        await navigator.clipboard.writeText(sql);
        saveMsg = `Copied SQL to clipboard (${scope})`;
      } else if (dest === 'sql') {
        const sql = await session.dump(includeData);
        triggerDownload('playground.sql', new Blob([sql], { type: 'application/sql' }));
        saveMsg = `Downloaded playground.sql (${scope})`;
      } else if (dest === 'db') {
        if (!session.serialize) throw new Error('This engine cannot export a binary file');
        const bytes = await session.serialize(includeData);
        triggerDownload('playground.sqlite', new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' }));
        saveMsg = `Downloaded playground.sqlite (${scope})`;
      } else {
        if (!session.exportJson) throw new Error('This engine cannot export JSON');
        const json = await session.exportJson(includeData);
        triggerDownload('playground.json', new Blob([json], { type: 'application/json' }));
        saveMsg = `Downloaded playground.json (${scope})`;
      }
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }
  }

  function onExportPick(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const dest = select.value as 'clipboard' | 'sql' | 'db' | 'json' | '';
    select.value = '';
    if (dest) void exportAs(dest);
  }

  async function save() {
    if (!session) return;
    saveError = null;
    saveMsg = null;
    try {
      const sql = await session.dump(true);
      const bytes = new Blob([sql]).size;
      if (bytes > ONE_MB) {
        pendingLarge = { sql, bytes };
        return;
      }
      await savePlaygroundSnapshot(runtimeId, sql);
      saveMsg = `Snapshot saved · ${formatBytes(bytes)}`;
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }
  }

  async function saveAnyway() {
    if (!pendingLarge) return;
    const { sql, bytes } = pendingLarge;
    pendingLarge = null;
    try {
      await savePlaygroundSnapshot(runtimeId, sql);
      saveMsg = `Large snapshot saved · ${formatBytes(bytes)}`;
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(async () => {
    try {
      const adapter = await loadRuntime(runtimeId);
      session = await adapter.createSession();
      await session.reset();

      const saved = await loadPlayground(runtimeId);
      if (saved?.buffers?.main) editor?.setText(saved.buffers.main);
      if (saved?.snapshot) {
        try {
          await session.exec(saved.snapshot);
          restoredBanner = true;
        } catch (err) {
          bootError = `Couldn't restore your saved snapshot: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      await refreshViewer();
    } catch (err) {
      bootError = err instanceof Error ? err.message : String(err);
    } finally {
      booting = false;
    }
  });

  onDestroy(() => {
    clearTimeout(saveTimer);
    session?.destroy();
  });
</script>

<div class="stack">
  <div class="head">
    <p class="muted intro">
      A blank SQLite database, all yours. Write anything, save a snapshot to pick up where you
      left off, or export your work.
    </p>
    <div class="row head-actions">
      <div class="seg" role="group" aria-label="Export contents">
        <button
          type="button"
          class="seg-btn"
          class:on={includeData}
          aria-pressed={includeData}
          onclick={() => (includeData = true)}
          disabled={booting}>Schema + data</button>
        <button
          type="button"
          class="seg-btn"
          class:on={!includeData}
          aria-pressed={!includeData}
          onclick={() => (includeData = false)}
          disabled={booting}>Schema only</button>
      </div>
      <label class="picker">
        <span class="visually-hidden">Export database</span>
        <select onchange={onExportPick} disabled={booting} aria-label="Export database">
          <option value="">Export…</option>
          <option value="clipboard">Copy SQL to clipboard</option>
          <option value="sql">SQL file (.sql)</option>
          <option value="db">SQLite file (.sqlite)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </label>
      <button class="btn btn-primary" onclick={save} disabled={booting}>Save snapshot</button>
    </div>
  </div>

  {#if bootError}
    <p class="banner banner-danger">{bootError}</p>
  {/if}

  {#if restoredBanner}
    <p class="banner banner-success">Restored your saved database snapshot.</p>
  {/if}

  {#if pendingLarge}
    <div class="banner banner-warning">
      <p>
        This snapshot is <strong>{formatBytes(pendingLarge.bytes)}</strong> — over 1&nbsp;MB.
        Saving works, but it's stored in your browser and re-run on every load, which can be
        slow.
      </p>
      <div class="row">
        <button class="btn btn-sm btn-primary" onclick={saveAnyway}>Save anyway</button>
        <button class="btn btn-sm" onclick={() => (pendingLarge = null)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if saveMsg}
    <p class="banner banner-success">{saveMsg}</p>
  {/if}
  {#if saveError}
    <p class="banner banner-danger">Export/save failed: {saveError}</p>
  {/if}

  <Card title="Editor">
    {#snippet actions()}
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
    {/snippet}
    <SqlEditor bind:this={editor} onDocChange={scheduleSave} onRun={run} />
    <div class="row toolbar">
      <button class="btn btn-primary" onclick={run} disabled={booting}>Run</button>
      <button class="btn btn-danger clear" onclick={clearDb} disabled={booting}>Clear database</button>
    </div>
    {#if sqlError}
      <p class="banner banner-danger sql-error">{sqlError}</p>
    {/if}
  </Card>

  {#if resultRows.length > 0}
    {@const cols = Object.keys(resultRows[0]!)}
    <Card title="Results">
      {#snippet actions()}
        <span class="muted kbd-hint">{resultRows.length} row{resultRows.length === 1 ? '' : 's'}</span>
      {/snippet}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              {#each cols as col (col)}
                <th>{col}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each resultRows as resultRow, i (i)}
              <tr>
                {#each cols as col (col)}
                  <td>{resultRow[col] === null ? 'NULL' : String(resultRow[col])}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}

  <Card title="Database">
    {#if booting}
      <p class="muted">Starting SQLite…</p>
    {:else}
      <DbViewer {tables} active={activeTable} view={tableView} onSelect={(name) => {
        activeTable = name;
        session?.tableData(name).then((data) => (tableView = data));
      }} />
    {/if}
  </Card>
</div>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .intro {
    max-width: 46ch;
    font-size: var(--font-size-sm);
  }

  .head-actions {
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .picker select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--surface-color);
    color: var(--text-color);
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    width: auto;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .seg-btn {
    border: none;
    background: var(--surface-color);
    color: var(--text-muted-color);
    padding: var(--space-2) var(--space-3);
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .seg-btn + .seg-btn {
    border-left: 1px solid var(--border-color);
  }

  .seg-btn.on {
    background: var(--color-primary-soft);
    color: var(--color-primary-strong);
  }

  .seg-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .toolbar {
    margin-top: var(--space-3);
  }

  .toolbar .clear {
    margin-left: auto;
  }

  .sql-error {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    margin-top: var(--space-3);
    color: var(--color-danger);
  }

  .banner-warning p {
    margin-bottom: var(--space-2);
  }

  .kbd-hint {
    font-size: var(--font-size-sm);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
