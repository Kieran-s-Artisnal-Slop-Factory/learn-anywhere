<script lang="ts">
  // Presentational DB viewer: table tabs, column names + declared types, and
  // the first 50 rows of the selected table. The parent owns the SQL client
  // and feeds this component data. (Ported from lite-learner.)
  import type { TableData } from '../../lib/runtimes/types';

  let {
    tables,
    active,
    view,
    onSelect,
  }: {
    tables: string[];
    active: string | null;
    view: TableData | null;
    onSelect: (name: string) => void;
  } = $props();
</script>

{#if tables.length === 0}
  <p class="muted">No tables in the database yet.</p>
{:else}
  <div class="tabs" role="tablist">
    {#each tables as table (table)}
      <button
        class="tab"
        class:active={table === active}
        role="tab"
        aria-selected={table === active}
        onclick={() => onSelect(table)}
      >
        {table}
      </button>
    {/each}
  </div>
  {#if view}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            {#each view.columns as col (col.name)}
              <th>{col.name} <span class="coltype">{col.type.toLowerCase()}</span></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each view.rows as row, i (i)}
            <tr>
              {#each view.columns as col (col.name)}
                {#if row[col.name] === null}
                  <td class="null-cell">NULL</td>
                {:else}
                  <td>{String(row[col.name])}</td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted note">
      {#if view.rows.length === 0}
        Table is empty.
      {:else}
        First 50 rows.
      {/if}
    </p>
  {/if}
{/if}

<style>
  .tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    color: var(--text-muted-color);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .tab:hover {
    color: var(--text-color);
  }

  .tab.active {
    color: var(--color-primary-strong);
    border-bottom-color: var(--color-primary);
  }

  .coltype {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--syntax-type);
  }

  .null-cell {
    color: var(--text-muted-color);
    font-style: italic;
    font-size: var(--font-size-sm);
  }

  .note {
    font-size: var(--font-size-sm);
    margin-top: var(--space-2);
  }
</style>
