<script lang="ts">
  import { onMount } from 'svelte';
  import { all, put, softDelete, withSyncFields } from '../../lib/db/repo';
  import type { Exercises, SyncFields } from '../../lib/db/types';
  import Card from '../Card.svelte';

  let loading = $state(true);
  let rows: Exercises[] = $state([]);


  let editingId: string | null = $state(null); // null = closed, '' = new row
  let formError: string | null = $state(null);
  let draft = $state(blankDraft());


  /** ISO 8601 -> value for <input type="datetime-local"> (local time). */
  function isoToLocal(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function localToIso(local: string): string {
    return new Date(local).toISOString();
  }

  function blankDraft() {
    return {
    complete: false,
    user_solution: '',
    started: '',
    completed: '',
    initial_sql: '',
    desired_state: "{}",
    };
  }





  async function refresh() {
    rows = await all<Exercises>('exercises');


  }

  onMount(async () => {
    await refresh();
    loading = false;
  });

  function startCreate() {
    draft = blankDraft();

    formError = null;
    editingId = '';
  }

  function startEdit(row: Exercises) {
    draft = {
      complete: row.complete ?? false,
      user_solution: row.user_solution ?? '',
      started: isoToLocal(row.started),
      completed: isoToLocal(row.completed),
      initial_sql: row.initial_sql ?? '',
      desired_state: JSON.stringify(row.desired_state ?? {}, null, 2),
    };

    formError = null;
    editingId = row.id;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    formError = null;
    let values: Omit<Exercises, keyof SyncFields>;
    try {
      values = {
      complete: draft.complete,
      user_solution: draft.user_solution,
      started: draft.started === '' ? null : localToIso(draft.started),
      completed: draft.completed === '' ? null : localToIso(draft.completed),
      initial_sql: draft.initial_sql,
      desired_state: JSON.parse(draft.desired_state),
      };
    } catch (err) {
      formError = 'Invalid JSON: ' + (err instanceof Error ? err.message : String(err));
      return;
    }
    let savedId: string;
    if (editingId) {
      const existing = rows.find((r) => r.id === editingId);
      if (!existing) return;
      await put('exercises', { ...$state.snapshot(existing), ...values });
      savedId = editingId;
    } else {
      const created = await put('exercises', withSyncFields(values));
      savedId = created.id;
    }

    editingId = null;
    await refresh();
  }

  async function del(row: Exercises) {
    if (!confirm('Delete this row?')) return;
    await softDelete('exercises', row.id);
    await refresh();
  }
</script>

<div class="page-header">
  <h1>Exercises</h1>
  <button class="btn btn-primary" onclick={startCreate}>+ New</button>
</div>

{#if editingId !== null}
  <Card title={editingId ? 'Edit' : 'New exercises'}>
    <form class="stack" onsubmit={save}>
      <label class="check">
        <input type="checkbox" bind:checked={draft.complete} />
        Complete
      </label>
      <div>
        <label for="f-user_solution">User solution</label>
        <input id="f-user_solution" bind:value={draft.user_solution} required />
      </div>
      <div>
        <label for="f-started">Started</label>
        <input id="f-started" type="datetime-local" bind:value={draft.started} />
      </div>
      <div>
        <label for="f-completed">Completed</label>
        <input id="f-completed" type="datetime-local" bind:value={draft.completed} />
      </div>
      <div>
        <label for="f-initial_sql">Initial sql</label>
        <input id="f-initial_sql" bind:value={draft.initial_sql} required />
      </div>
      <div>
        <label for="f-desired_state">Desired state (JSON)</label>
        <textarea id="f-desired_state" rows="3" bind:value={draft.desired_state}></textarea>
      </div>

      {#if formError}
        <p class="form-error">{formError}</p>
      {/if}
      <div class="row">
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn" type="button" onclick={() => (editingId = null)}>Cancel</button>
      </div>
    </form>
  </Card>
{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else if rows.length === 0}
  <p class="muted">Nothing here yet.</p>
{:else}
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Complete</th>
          <th>User solution</th>
          <th>Started</th>
          <th>Completed</th>
          <th>Initial sql</th>
          <th>Desired state</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <td>{row.complete ? '✓' : ''}</td>
            <td>{row.user_solution ?? ''}</td>
            <td>{row.started ? new Date(row.started).toLocaleString() : ''}</td>
            <td>{row.completed ? new Date(row.completed).toLocaleString() : ''}</td>
            <td>{row.initial_sql ?? ''}</td>
            <td class="mono">{JSON.stringify(row.desired_state)}</td>
            <td class="actions">
              <button class="btn btn-sm" onclick={() => startEdit(row)}>Edit</button>
              <button class="btn btn-sm btn-danger" onclick={() => del(row)}>Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .actions {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .mono {
    font-family: ui-monospace, monospace;
    font-size: var(--font-size-sm);
  }

  .form-error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-color);
    font-size: var(--font-size-base);
  }

  .inline-new {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .inline-new input {
    max-width: 16rem;
  }

  .link-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-2) 0;
  }

  .link-item {
    margin: 0;
  }
</style>
