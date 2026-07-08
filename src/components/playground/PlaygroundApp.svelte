<script lang="ts">
  /**
   * Free-form SQL playground. Starts blank, autosaves the editor buffer for
   * resumability, and can save/restore the whole database as a SQL snapshot
   * (the DB is in-memory, so without a saved snapshot it resets on reload).
   * "Add from template" wipes the DB and loads a ready-made schema.
   */
  import { onDestroy, onMount } from 'svelte';
  import { SqlClient } from '../../lib/sql/client';
  import type { Row } from '../../lib/sql/comparator';
  import type { TableData } from '../../lib/sql/protocol';
  import { loadPlayground, savePlaygroundBuffer, savePlaygroundDump } from '../../lib/playground';
  import { TEMPLATES } from '../../lib/playgroundTemplates';
  import Card from '../Card.svelte';
  import SqlEditor from './../exercise/SqlEditor.svelte';
  import DbViewer from './../exercise/DbViewer.svelte';

  const ONE_MB = 1024 * 1024;

  let client: SqlClient | null = null;
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

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < ONE_MB) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / ONE_MB).toFixed(2)} MB`;
  }

  function scheduleSave(doc: string) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void savePlaygroundBuffer(doc), 600);
  }

  async function refreshViewer(preferred?: string | null) {
    if (!client) return;
    tables = await client.listTables();
    activeTable = preferred && tables.includes(preferred) ? preferred : (tables[0] ?? null);
    tableView = activeTable ? await client.tableData(activeTable) : null;
  }

  async function run() {
    if (!client || !editor) return;
    const doc = editor.getText();
    sqlError = null;
    saveMsg = null;
    restoredBanner = false;
    try {
      resultRows = doc.trim() ? await client.exec(doc) : [];
      await refreshViewer(activeTable);
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(saveTimer);
      await savePlaygroundBuffer(doc);
    }
  }

  async function clearDb() {
    if (!client) return;
    if (tables.length > 0 && !confirm('Wipe the database? This clears every table (your saved snapshot is untouched).')) {
      return;
    }
    sqlError = null;
    saveMsg = null;
    resultRows = [];
    restoredBanner = false;
    await client.reset();
    await refreshViewer();
  }

  async function loadTemplate(id: string) {
    if (!client) return;
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    if (tables.length > 0 && !confirm(`Load the "${template.name}" template? This wipes the current database.`)) {
      return;
    }
    sqlError = null;
    saveMsg = null;
    resultRows = [];
    restoredBanner = false;
    try {
      await client.reset();
      await client.exec(template.sql);
      await refreshViewer();
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    }
  }

  function onTemplatePick(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const id = select.value;
    select.value = ''; // reset back to the label so the same one can be re-picked
    if (id) void loadTemplate(id);
  }

  async function save() {
    if (!client) return;
    saveError = null;
    saveMsg = null;
    try {
      const sql = await client.dump();
      const bytes = new Blob([sql]).size;
      if (bytes > ONE_MB) {
        pendingLarge = { sql, bytes };
        return;
      }
      await savePlaygroundDump(sql);
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
      await savePlaygroundDump(sql);
      saveMsg = `Large snapshot saved · ${formatBytes(bytes)}`;
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(async () => {
    try {
      client = new SqlClient();
      await client.reset();

      const saved = await loadPlayground();
      if (saved?.buffer) editor?.setText(saved.buffer);
      if (saved?.dump) {
        try {
          await client.exec(saved.dump);
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
    client?.destroy();
  });
</script>

<div class="stack">
  <header class="page-head">
    <div>
      <h1>Playground</h1>
      <p class="muted">
        A blank SQLite database, all yours. Write anything, save a snapshot to pick up where you
        left off, or start from a template.
      </p>
    </div>
    <div class="row head-actions">
      <label class="template-picker">
        <span class="visually-hidden">Add from template</span>
        <select onchange={onTemplatePick} disabled={booting} aria-label="Add from template">
          <option value="">+ Add from template…</option>
          {#each TEMPLATES as t (t.id)}
            <option value={t.id}>{t.name} — {t.description}</option>
          {/each}
        </select>
      </label>
      <button class="btn btn-primary" onclick={save} disabled={booting}>💾 Save snapshot</button>
    </div>
  </header>

  {#if bootError}
    <p class="banner banner-danger">{bootError}</p>
  {/if}

  {#if restoredBanner}
    <p class="banner banner-success">Restored your saved database snapshot.</p>
  {/if}

  {#if pendingLarge}
    <div class="banner banner-warning">
      <p>
        This snapshot is <strong>{formatBytes(pendingLarge.bytes)}</strong> — over 1&nbsp;MB. Saving
        a large snapshot works, but it's stored in your browser and re-run on every load, which can
        be slow.
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
    <p class="banner banner-danger">Couldn't save snapshot: {saveError}</p>
  {/if}

  <Card title="editor">
    {#snippet actions()}
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
    {/snippet}
    <SqlEditor bind:this={editor} onDocChange={scheduleSave} onRun={run} />
    <div class="row toolbar">
      <button class="btn btn-primary" onclick={run} disabled={booting}>▶ Run</button>
      <button class="btn btn-danger clear" onclick={clearDb} disabled={booting}>🗑 Clear database</button>
    </div>
    {#if sqlError}
      <p class="banner banner-danger sql-error">{sqlError}</p>
    {/if}
  </Card>

  {#if resultRows.length > 0}
    {@const cols = Object.keys(resultRows[0]!)}
    <Card title="results">
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

  <Card title="database">
    {#if booting}
      <p class="muted">Starting SQLite…</p>
    {:else}
      <DbViewer {tables} active={activeTable} view={tableView} onSelect={(name) => {
        activeTable = name;
        client?.tableData(name).then((data) => (tableView = data));
      }} />
    {/if}
  </Card>
</div>

<style>
  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .page-head h1 {
    margin-bottom: var(--space-1);
  }

  .page-head p {
    max-width: 46ch;
    font-size: var(--font-size-sm);
  }

  .head-actions {
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .template-picker select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--surface-color);
    color: var(--text-color);
    font: inherit;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .toolbar {
    margin-top: var(--space-3);
  }

  .toolbar .clear {
    margin-left: auto;
  }

  .sql-error {
    font-family: var(--font-body);
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

  kbd {
    border: 1px solid var(--border-color);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    font-size: 0.75rem;
    background: var(--surface-raised-color);
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
