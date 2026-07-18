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
   *
   * Extras:
   *  - `endpoint`/`meta`: result_endpoint support — every Check (and a
   *    sandbox Mark-as-done) POSTs the SQL + outcome for human marking.
   *    Like question forms, submission is blocked until the profile is set.
   *  - Runaway queries: while a statement runs the toolbar disables; after
   *    a moment a Stop button appears that terminates the worker and boots
   *    a fresh seeded engine (the editor buffer is untouched).
   */
  import { onDestroy, onMount } from 'svelte';
  import type { DatabaseBlock } from '../../lib/content/types';
  import { loadRuntime } from '../../lib/runtimes/registry';
  import type { DatabaseSession, Row, RuntimeAdapter, TableData } from '../../lib/runtimes/types';
  import { rowsMatch } from '../../lib/runtimes/sqlite/comparator';
  import { postSolutionResult, type SubmissionMeta } from '../../lib/assessment/submit';
  import { getProfile, profileComplete, type Profile } from '../../lib/profile';
  import { href } from '../../lib/paths';
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
    endpoint = null,
    meta = null,
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
    /** result_endpoint from the content — enables send-for-marking. */
    endpoint?: string | null;
    /** Required when endpoint is set: what the receiver sees. */
    meta?: SubmissionMeta | null;
  } = $props();

  const isChecked = block.desired_state !== undefined;

  let adapter: RuntimeAdapter | null = null;
  let session: DatabaseSession | null = null;
  let editor: SqlEditor | undefined = $state();

  let booting = $state(true);
  let bootError = $state<string | null>(null);
  let sqlError = $state<string | null>(null);
  let resultRows = $state<Row[]>([]);
  let checked = $state<'pass' | 'fail' | null>(null);
  let restoredBanner = $state(false);
  let stoppedBanner = $state(false);

  let tables = $state<string[]>([]);
  let activeTable = $state<string | null>(null);
  let tableView = $state<TableData | null>(null);

  // Busy / runaway-query handling.
  let running = $state(false);
  let stopVisible = $state(false);
  let stopTimer: ReturnType<typeof setTimeout> | undefined;

  // result_endpoint state.
  let profile = $state<Profile>({ name: '', email: '' });
  let profileReady = $state(false);
  let sendState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let sendError = $state<string | null>(null);
  let lastOutcome: boolean | null = null;
  const locked = $derived(endpoint != null && profileReady && !profileComplete(profile));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleSave(doc: string) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void onSave(doc), 600);
  }

  function beginRun() {
    running = true;
    stopVisible = false;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      if (running) stopVisible = true;
    }, 2000);
  }

  function endRun() {
    running = false;
    stopVisible = false;
    clearTimeout(stopTimer);
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

  /** Kill a stuck worker and boot a fresh, seeded engine (buffer untouched). */
  async function stopAndRestart() {
    session?.destroy();
    session = null;
    endRun();
    sqlError = null;
    resultRows = [];
    checked = null;
    booting = true;
    stoppedBanner = true;
    try {
      session = adapter ? await adapter.createSession() : null;
      await seed();
    } catch (err) {
      bootError = err instanceof Error ? err.message : String(err);
    } finally {
      booting = false;
    }
  }

  async function run() {
    if (!session || !editor || running) return;
    const doc = editor.getText();
    sqlError = null;
    checked = null;
    restoredBanner = false;
    stoppedBanner = false;
    beginRun();
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
      endRun();
      clearTimeout(saveTimer);
      await onSave(doc);
    }
  }

  /** POST the buffer + outcome to the result endpoint (when configured). */
  async function send(passed: boolean | null) {
    if (!endpoint || !meta) return;
    lastOutcome = passed;
    sendState = 'sending';
    sendError = null;
    try {
      await postSolutionResult(endpoint, meta, { sql: editor?.getText() ?? '' }, passed, profile);
      sendState = 'sent';
    } catch (err) {
      sendState = 'failed';
      sendError = err instanceof Error ? err.message : String(err);
    }
  }

  async function check() {
    if (!session || !block.desired_state || running || locked) return;
    sqlError = null;
    stoppedBanner = false;
    beginRun();
    try {
      const actual = await session.exec(block.desired_state.query);
      const pass = rowsMatch(block.desired_state.rows, actual);
      checked = pass ? 'pass' : 'fail';
      endRun();
      if (pass) await onPass();
      await send(pass);
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    } finally {
      endRun();
    }
  }

  async function markDone() {
    if (locked) return;
    await onMarkDone();
    await send(null);
  }

  async function reset() {
    if (!session || running) return;
    sqlError = null;
    checked = null;
    resultRows = [];
    restoredBanner = false;
    stoppedBanner = false;
    editor?.setText('');
    clearTimeout(saveTimer);
    await onSave('');
    await seed();
  }

  onMount(async () => {
    profile = getProfile();
    profileReady = true;
    try {
      adapter = await loadRuntime(block.runtime);
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
    clearTimeout(stopTimer);
    session?.destroy();
  });
</script>

<div class="stack">
  {#if bootError}
    <p class="banner banner-danger">Failed to start the database: {bootError}</p>
  {/if}

  {#if locked}
    <p class="banner banner-danger">
      This {meta?.kind === 'test' ? 'test' : 'exercise'} sends your SQL to the course team for
      marking, so your name and email must be set before submission — add them in
      <a href={href('/settings/')}>Settings</a>. You can still run and experiment freely.
    </p>
  {:else if endpoint && profileReady && checked === null && sendState === 'idle'}
    <p class="banner">
      Checking sends your SQL to the course team for review as
      <strong>{profile.name}</strong> ({profile.email}).
    </p>
  {/if}

  {#if restoredBanner}
    <p class="banner banner-warning">
      Your last solution was restored to the editor, but the database has been reset — re-run
      your statements to restore its state.
    </p>
  {/if}

  {#if stoppedBanner}
    <p class="banner banner-warning">
      The query was stopped and the database reset to its seeded state — your SQL is still in
      the editor.
    </p>
  {/if}

  {#if sendState === 'sending'}
    <p class="banner">Sending your SQL for review…</p>
  {:else if sendState === 'sent'}
    <p class="banner banner-success">Your SQL was sent to the course team for review.</p>
  {:else if sendState === 'failed'}
    <p class="banner banner-danger">
      Saved locally, but sending for review failed ({sendError}).
      <button type="button" class="btn btn-sm retry" onclick={() => send(lastOutcome)}>
        Retry send
      </button>
    </p>
  {/if}

  <Card title="Editor">
    {#snippet actions()}
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
    {/snippet}
    <SqlEditor bind:this={editor} onDocChange={scheduleSave} onRun={run} />
    <div class="row toolbar">
      <button class="btn btn-primary" onclick={run} disabled={booting || running}>
        {running ? 'Running…' : 'Run'}
      </button>
      {#if isChecked}
        <button class="btn" onclick={check} disabled={booting || running || locked}>
          Check solution
        </button>
      {:else if !completed}
        <button class="btn" onclick={markDone} disabled={booting || running || locked}>
          Mark as done
        </button>
      {/if}
      {#if stopVisible && running}
        <button class="btn btn-danger" onclick={stopAndRestart}>Stop</button>
      {/if}
      <button class="btn btn-danger reset" onclick={reset} disabled={booting || running}>
        Reset
      </button>
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

  .retry {
    margin-left: var(--space-2);
  }
</style>
