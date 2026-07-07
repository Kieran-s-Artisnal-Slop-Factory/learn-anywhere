<script lang="ts">
  // Presentational DB viewer: table tabs, column names + declared types, and
  // the first 50 rows of the selected table. The parent owns the SQL client
  // and feeds this component data.
  import type { TableData } from '../../lib/sql/protocol';

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
  <div class="row tabs">
    {#each tables as table (table)}
      <button class="btn btn-sm" class:btn-primary={table === active} onclick={() => onSelect(table)}>
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
              <th>{col.name} <span class="muted coltype">{col.type}</span></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each view.rows as row, i (i)}
            <tr>
              {#each view.columns as col (col.name)}
                <td>{row[col.name] === null ? 'NULL' : String(row[col.name])}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if view.rows.length === 0}
      <p class="muted">Table is empty.</p>
    {:else}
      <p class="muted">First 50 rows.</p>
    {/if}
  {/if}
{/if}

<style>
  .tabs {
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }

  .coltype {
    font-weight: 400;
    font-size: var(--font-size-sm);
  }
</style>
