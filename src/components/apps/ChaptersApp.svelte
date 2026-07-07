<script lang="ts">
  import { onMount } from 'svelte';
  import { all, put, softDelete, withSyncFields } from '../../lib/db/repo';
  import type { Chapters, SyncFields, Courses } from '../../lib/db/types';
  import Card from '../Card.svelte';

  let loading = $state(true);
  let rows: Chapters[] = $state([]);
  let coursesOptions: Courses[] = $state([]);

  let editingId: string | null = $state(null); // null = closed, '' = new row
  let formError: string | null = $state(null);
  let draft = $state(blankDraft());
  let inlineNew = $state({ course: '' });

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
    course: '',
    completed: '',
    started: '',
    };
  }

  const coursesLabel = (id: string | null) =>
    coursesOptions.find((o) => o.id === id)?.description ?? id ?? '';

  /** Create a courses row in place and select it for course. */
  async function createForFk_course() {
    const label = inlineNew.course.trim();
    if (!label) return;
    const created = await put('courses', withSyncFields({ description: label, current_chapter: null, completed: null, started: null }));
    coursesOptions = await all<Courses>('courses');
    draft.course = created.id;
    inlineNew.course = '';
  }


  async function refresh() {
    rows = await all<Chapters>('chapters');
    coursesOptions = await all<Courses>('courses');

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

  function startEdit(row: Chapters) {
    draft = {
      description: row.description ?? '',
      course: row.course ?? '',
      completed: isoToLocal(row.completed),
      started: isoToLocal(row.started),
    };

    formError = null;
    editingId = row.id;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    formError = null;
    let values: Omit<Chapters, keyof SyncFields>;
    try {
      values = {
      description: draft.description,
      course: draft.course,
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
      await put('chapters', { ...$state.snapshot(existing), ...values });
      savedId = editingId;
    } else {
      const created = await put('chapters', withSyncFields(values));
      savedId = created.id;
    }

    editingId = null;
    await refresh();
  }

  async function del(row: Chapters) {
    if (!confirm('Delete this row?')) return;
    await softDelete('chapters', row.id);
    await refresh();
  }
</script>

<div class="page-header">
  <h1>Chapters</h1>
  <button class="btn btn-primary" onclick={startCreate}>+ New</button>
</div>

{#if editingId !== null}
  <Card title={editingId ? 'Edit' : 'New chapters'}>
    <form class="stack" onsubmit={save}>
      <div>
        <label for="f-description">Description</label>
        <input id="f-description" bind:value={draft.description} required />
      </div>
      <div>
        <label for="f-course">Course</label>
        <select id="f-course" bind:value={draft.course} required>
          <option value="" disabled>Select…</option>
          {#each coursesOptions as opt (opt.id)}
            <option value={opt.id}>{opt.description}</option>
          {/each}
        </select>
        <div class="inline-new">
          <input
            placeholder="New courses description"
            bind:value={inlineNew.course}
          />
          <button
            type="button"
            class="btn btn-sm"
            onclick={() => createForFk_course()}
            disabled={!inlineNew.course.trim()}
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
          <th>Course</th>
          <th>Completed</th>
          <th>Started</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <td>{row.description ?? ''}</td>
            <td>{coursesLabel(row.course)}</td>
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
