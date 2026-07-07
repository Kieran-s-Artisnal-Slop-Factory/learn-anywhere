<script lang="ts">
  import { onMount } from 'svelte';
  import { all, put, softDelete, withSyncFields } from '../../lib/db/repo';
  import type { Courses, SyncFields, Chapters } from '../../lib/db/types';
  import Card from '../Card.svelte';

  let loading = $state(true);
  let rows: Courses[] = $state([]);
  let chaptersOptions: Chapters[] = $state([]);

  let editingId: string | null = $state(null); // null = closed, '' = new row
  let formError: string | null = $state(null);
  let draft = $state(blankDraft());
  let inlineNew = $state({ current_chapter: '' });

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
    description: '',
    current_chapter: '',
    completed: '',
    started: '',
    };
  }

  const chaptersLabel = (id: string | null) =>
    chaptersOptions.find((o) => o.id === id)?.description ?? id ?? '';

  /** Create a chapters row in place and select it for current_chapter. */
  async function createForFk_current_chapter() {
    const label = inlineNew.current_chapter.trim();
    if (!label) return;
    const created = await put('chapters', withSyncFields({ description: label, course: '', completed: null, started: null }));
    chaptersOptions = await all<Chapters>('chapters');
    draft.current_chapter = created.id;
    inlineNew.current_chapter = '';
  }


  async function refresh() {
    rows = await all<Courses>('courses');
    chaptersOptions = await all<Chapters>('chapters');

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

  function startEdit(row: Courses) {
    draft = {
      description: row.description ?? '',
      current_chapter: row.current_chapter ?? '',
      completed: isoToLocal(row.completed),
      started: isoToLocal(row.started),
    };

    formError = null;
    editingId = row.id;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    formError = null;
    let values: Omit<Courses, keyof SyncFields>;
    try {
      values = {
      description: draft.description,
      current_chapter: draft.current_chapter === '' ? null : draft.current_chapter,
      completed: draft.completed === '' ? null : localToIso(draft.completed),
      started: draft.started === '' ? null : localToIso(draft.started),
      };
    } catch (err) {
      formError = 'Invalid JSON: ' + (err instanceof Error ? err.message : String(err));
      return;
    }
    let savedId: string;
    if (editingId) {
      const existing = rows.find((r) => r.id === editingId);
      if (!existing) return;
      await put('courses', { ...$state.snapshot(existing), ...values });
      savedId = editingId;
    } else {
      const created = await put('courses', withSyncFields(values));
      savedId = created.id;
    }

    editingId = null;
    await refresh();
  }

  async function del(row: Courses) {
    if (!confirm('Delete this row?')) return;
    await softDelete('courses', row.id);
    await refresh();
  }
</script>

<div class="page-header">
  <h1>Courses</h1>
  <button class="btn btn-primary" onclick={startCreate}>+ New</button>
</div>

{#if editingId !== null}
  <Card title={editingId ? 'Edit' : 'New courses'}>
    <form class="stack" onsubmit={save}>
      <div>
        <label for="f-description">Description</label>
        <input id="f-description" bind:value={draft.description} required />
      </div>
      <div>
        <label for="f-current_chapter">Current chapter</label>
        <select id="f-current_chapter" bind:value={draft.current_chapter}>
          <option value="">—</option>
          {#each chaptersOptions as opt (opt.id)}
            <option value={opt.id}>{opt.description}</option>
          {/each}
        </select>
        <div class="inline-new">
          <input
            placeholder="New chapters description"
            bind:value={inlineNew.current_chapter}
          />
          <button
            type="button"
            class="btn btn-sm"
            onclick={() => createForFk_current_chapter()}
            disabled={!inlineNew.current_chapter.trim()}
          >
            + New
          </button>
        </div>
      </div>
      <div>
        <label for="f-completed">Completed</label>
        <input id="f-completed" type="datetime-local" bind:value={draft.completed} />
      </div>
      <div>
        <label for="f-started">Started</label>
        <input id="f-started" type="datetime-local" bind:value={draft.started} />
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
          <th>Description</th>
          <th>Current chapter</th>
          <th>Completed</th>
          <th>Started</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <td>{row.description ?? ''}</td>
            <td>{chaptersLabel(row.current_chapter)}</td>
            <td>{row.completed ? new Date(row.completed).toLocaleString() : ''}</td>
            <td>{row.started ? new Date(row.started).toLocaleString() : ''}</td>
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
