<script lang="ts">
  /**
   * The interactive half of an exercise page. On load (per the plan):
   *  1. fresh in-memory SQLite DB
   *  2. run exercise.initial_sql to seed it
   *  3. restore the editor buffer from user_solution WITHOUT executing it —
   *     a stored buffer can't reproduce DB state, so show a warning banner
   *  4. open the DB viewer on the first table
   *  5. stamp started if null
   *  6. surface completed state
   * Reset discards the DB, clears user_solution, and re-runs this sequence.
   */
  import { onDestroy, onMount } from 'svelte';
  import { SqlClient } from '../../lib/sql/client';
  import type { Row } from '../../lib/sql/comparator';
  import type { TableData } from '../../lib/sql/protocol';
  import type { ChapterContent, CourseContent, ExerciseContent } from '../../lib/content/types';
  import { syncChapter, syncCourse, syncExercise } from '../../lib/content/sync';
  import { markExerciseCompleted, markExerciseOpened } from '../../lib/progress';
  import { put } from '../../lib/db/repo';
  import type { Exercises } from '../../lib/db/types';
  import Card from '../Card.svelte';
  import SqlEditor from './SqlEditor.svelte';
  import DbViewer from './DbViewer.svelte';

  let {
    course,
    chapter,
    exercise,
  }: {
    course: CourseContent;
    chapter: ChapterContent;
    exercise: ExerciseContent;
  } = $props();

  let client: SqlClient | null = null;
  let editor: SqlEditor | undefined = $state();
  let row: Exercises | null = $state(null);

  let booting = $state(true);
  let bootError = $state<string | null>(null);
  let sqlError = $state<string | null>(null);
  let resultRows = $state<Row[]>([]);
  let checked = $state<'pass' | 'fail' | null>(null);
  let restoredBanner = $state(false);

  let tables = $state<string[]>([]);
  let activeTable = $state<string | null>(null);
  let tableView = $state<TableData | null>(null);

  const completed = $derived(row?.completed != null);

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleSave(doc: string) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveBuffer(doc), 600);
  }

  async function saveBuffer(doc: string) {
    if (!row) return;
    row = await put<Exercises>('exercises', {
      ...$state.snapshot(row) as Exercises,
      user_solution: doc === '' ? null : doc,
    });
  }

  async function refreshViewer(preferred?: string | null) {
    if (!client) return;
    tables = await client.listTables();
    activeTable = preferred && tables.includes(preferred) ? preferred : (tables[0] ?? null);
    tableView = activeTable ? await client.tableData(activeTable) : null;
  }

  async function seed() {
    if (!client) return;
    await client.reset();
    await client.exec(exercise.initial_sql);
    await refreshViewer();
  }

  async function run() {
    if (!client || !editor) return;
    const doc = editor.getText();
    sqlError = null;
    checked = null;
    restoredBanner = false;
    try {
      if (doc.trim()) {
        resultRows = await client.exec(doc);
        await refreshViewer(activeTable);
      } else {
        resultRows = [];
      }
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(saveTimer);
      await saveBuffer(doc);
    }
  }

  async function check() {
    if (!client || !row) return;
    sqlError = null;
    try {
      const pass = await client.checkSolution($state.snapshot(exercise.desired_state));
      checked = pass ? 'pass' : 'fail';
      if (pass) {
        row = await markExerciseCompleted(course.slug, chapter.slug, $state.snapshot(row) as Exercises);
      }
    } catch (err) {
      sqlError = err instanceof Error ? err.message : String(err);
    }
  }

  async function reset() {
    if (!client) return;
    sqlError = null;
    checked = null;
    resultRows = [];
    restoredBanner = false;
    editor?.setText('');
    clearTimeout(saveTimer);
    await saveBuffer('');
    await seed();
  }

  onMount(async () => {
    try {
      // Cache/refresh the content rows this page touches (content-hash flow),
      // then stamp progress.
      await syncCourse($state.snapshot(course));
      await syncChapter($state.snapshot(chapter));
      const synced = await syncExercise($state.snapshot(exercise));
      row = await markExerciseOpened(course.slug, chapter.slug, synced);

      client = new SqlClient();
      await seed();

      if (row.user_solution) {
        editor?.setText(row.user_solution);
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
    client?.destroy();
  });
</script>

<div class="stack">
  {#if bootError}
    <p class="banner banner-danger">Failed to start the exercise engine: {bootError}</p>
  {/if}

  {#if completed}
    <p class="banner banner-success">
      ✓ Completed{row?.completed ? ` ${new Date(row.completed).toLocaleDateString()}` : ''} — keep
      experimenting or reset to start over.
    </p>
  {/if}

  {#if restoredBanner}
    <p class="banner banner-warning">
      Your last solution was restored to the editor, but the database has been reset — re-run your
      statements to restore its state.
    </p>
  {/if}

  <Card title="editor">
    {#snippet actions()}
      <span class="muted kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
    {/snippet}
    <SqlEditor bind:this={editor} onDocChange={scheduleSave} onRun={run} />
    <div class="row toolbar">
      <button class="btn btn-primary" onclick={run} disabled={booting}>▶ Run</button>
      <button class="btn" onclick={check} disabled={booting}>✓ Check solution</button>
      <button class="btn btn-danger reset" onclick={reset} disabled={booting}>↺ Reset</button>
    </div>
    {#if sqlError}
      <p class="banner banner-danger sql-error">{sqlError}</p>
    {/if}
    {#if checked === 'pass'}
      <p class="banner banner-success feedback">✓ Correct — exercise complete!</p>
    {:else if checked === 'fail'}
      <p class="banner banner-warning feedback">
        ✗ Not quite — the database doesn't match the expected state yet.
      </p>
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
  .toolbar {
    margin-top: var(--space-3);
  }

  .toolbar .reset {
    margin-left: auto;
  }

  .sql-error {
    font-family: var(--font-body);
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

  kbd {
    border: 1px solid var(--border-color);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    font-size: 0.75rem;
    background: var(--surface-raised-color);
  }
</style>
