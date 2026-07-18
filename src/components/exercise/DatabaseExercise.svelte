<script lang="ts">
  /**
   * The database-exercise workspace: SQL editor + Run / Check / Reset, a
   * results table, and the DB viewer. Owns the engine session; the PARENT
   * owns persistence (lesson row vs chapter-test row) via the callbacks, so
   * the same component serves lesson exercises and chapter tests.
   *
   * Load sequence (lite-learner's, verbatim):
   *  1. boot the runtime adapter (registry) and a fresh in-memory DB
   *  2. run block.initial_sql to seed it
   *  3. restore the saved buffer WITHOUT executing it — a stored buffer
   *     can't reproduce accumulated DB state, so show a banner instead
   *  4. open the DB viewer on the first table
   *
   * With a desired_state: Check runs the solution query against the live DB
   * and compares rows positionally (comparator) — a pass calls onPass().
   * Without one: an explorable sandbox; "Mark as done" calls onMarkDone().
   * Reset discards the DB, clears the saved buffer, and re-seeds.
   */
  import { onDestroy, onMount } from 'svelte';
  import type { DatabaseBlock } from '../../lib/content/types';
  import { loadRuntime } from '../../lib/runtimes/registry';
  import type { DatabaseSession, Row, TableData } from '../../lib/runtimes/types';
  import { rowsMatch } from '../../lib/runtimes/sqlite/comparator';
  import Card from '../Card.svelte';
  import SqlEditor from './SqlEditor.svelte';
  import DbViewer from './DbViewer.svelte';

  let {
    block,
    initialSolution = null,
    completed = false,
    onSave,
    onPass,
    onMarkDone,
  }: {
    block: DatabaseBlock;
    /** Saved buffer from the row — restored, never auto-executed. */
    initialSolution?: string | null;
    completed?: boolean;
    /** Persist the buffer (debounced by this component; '' clears). */
    onSave: (sql: string) => Promise<void>;
    /** A passing solution check (only fires when desired_state exists). */
    onPass: () => Promise<void>;
    /** Sandbox completion (only shown when there's no desired_state). */
    onMarkDone: () => Promise<void>;
  } = $props();

  const isChecked = block.desired_state !== undefined;

  let session: DatabaseSession | null = null;
  let editor: SqlEditor | undefined = $state();

  let booting = $state(true);
  let bootError = $state<string | null>(null);
  let sqlError = $state<string | null>(null);
  let resultRows = $state<Row[]>([]);
  let checked = $state<'pass' | 'fail' | null>(null);
  let restoredBanner = $state(false);

  let tables = $state<string[]>([]);
  let activeTable = $state<string | null>(null);
  let tableView = $state<TableData | null>(null);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleSave(doc: string) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void onSave(doc), 600);
  }

  async function refreshViewer(preferred?: string | null) {
    if (!session) return;
    tables = await session.listTables();
    activeTable = preferred && tables.includes(preferred) ? preferred : (tables[0] ?? null);
    tableView = activeTable ? await session.tableData(activeTable) : null;
  }

  async function seed() {
    if (!session) return;
    await session.reset();
    if (block.initial_sql) await session.exec(block.initial_sql);
    await refreshViewer();
  }

  async function run() {
    if (!session || !editor) return;
    const doc = editor.getText();
    sqlError = null;
    checked = null;
    restoredBanner = false;
    try {
      if (doc.trim()) {
        resultRows = await session.exec(doc);
        await refreshViewer(activeTable);
      } else {
        resultRows = [];
      }
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(saveTimer);
      await onSave(doc);
    }
  }

  async function check() {
    if (!session || !block.desired_state) return;
    sqlError = null;
    try {
      const actual = await session.exec(block.desired_state.query);
      const pass = rowsMatch(block.desired_state.rows, actual);
      checked = pass ? 'pass' : 'fail';
      if (pass) await onPass();
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    }
  }

  async function reset() {
    if (!session) return;
    sqlError = null;
    checked = null;
    resultRows = [];
    restoredBanner = false;
    editor?.setText('');
    clearTimeout(saveTimer);
    await onSave('');
    await seed();
  }

  onMount(async () => {
    try {
      const adapter = await loadRuntime(block.runtime);
      session = await adapter.createSession();
      await seed();
      if (initialSolution) {
        editor?.setText(initialSolution);
        restoredBanner = true;
      }
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
  {#if bootError}
    <p class="banner banner-danger">Failed to start the database: {bootError}</p>
  {/if}

  {#if restoredBanner}
    <p class="banner banner-warning">
      Your last solution was restored to the editor, but the database has been reset — re-run
      your statements to restore its state.
    </p>
  {/if}

  <Card title="Editor">
    {#snippet actions()}
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
    {/snippet}
    <SqlEditor bind:this={editor} onDocChange={scheduleSave} onRun={run} />
    <div class="row toolbar">
      <button class="btn btn-primary" onclick={run} disabled={booting}>Run</button>
      {#if isChecked}
        <button class="btn" onclick={check} disabled={booting}>Check solution</button>
      {:else if !completed}
        <button class="btn" onclick={onMarkDone} disabled={booting}>Mark as done</button>
      {/if}
      <button class="btn btn-danger reset" onclick={reset} disabled={booting}>Reset</button>
    </div>
    {#if sqlError}
      <p class="banner banner-danger sql-error">{sqlError}</p>
    {/if}
    {#if checked === 'pass'}
      <p class="banner banner-success feedback">Correct — the database matches the expected state.</p>
    {:else if checked === 'fail'}
      <p class="banner banner-warning feedback">
        Not quite — the database doesn't match the expected state yet.
      </p>
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
      <p class="muted">Starting the database engine…</p>
    {:else}
      <DbViewer {tables} active={activeTable} view={tableView} onSelect={(name) => {
        activeTable = name;
        session?.tableData(name).then((data) => (tableView = data));
      }} />
    {/if}
  </Card>
</div>

<style>
  .toolbar {
    margin-top: var(--space-3);
  }

  .toolbar .reset {
    margin-left: auto;
  }

  .sql-error {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    margin-top: var(--space-3);
    color: var(--color-danger);
  }

  .feedback {
    margin-top: var(--space-3);
    font-weight: 600;
  }

  .kbd-hint {
    font-size: var(--font-size-sm);
  }
</style>
