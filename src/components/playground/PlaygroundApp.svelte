<script lang="ts">
  /**
   * The playground shell: a tab per enabled runtime, lazy-loading each
   * runtime's playground island only when its tab activates (heavy engines
   * must not boot on page load). Per-runtime islands register in PLAYGROUNDS
   * below; runtimes without one yet get an honest placeholder.
   */
  import type { Component } from 'svelte';
  import { RUNTIMES } from '../../lib/runtimes/config';
  import { RUNTIME_INFO } from '../../lib/runtimes/info';

  /**
   * Playground island per runtime id — the UI half of the runtime registry
   * (kept separate so lib/ stays component-free). SQLite's arrives with
   * Database Phase 2:
   *
   *   sqlite: () => import('./SqlitePlayground.svelte').then((m) => m.default),
   */
  const PLAYGROUNDS: Record<string, () => Promise<Component<{ runtimeId: string }>>> = {};

  const tabs = RUNTIMES.map((id) => ({
    id,
    label: RUNTIME_INFO[id]?.label ?? id,
  }));

  let active = $state<string | null>(tabs[0]?.id ?? null);
  // One load per runtime, kept across tab switches (promise caches result).
  const loaded = new Map<string, Promise<Component<{ runtimeId: string }> | null>>();

  function playgroundFor(id: string): Promise<Component<{ runtimeId: string }> | null> {
    let promise = loaded.get(id);
    if (!promise) {
      promise = PLAYGROUNDS[id] ? PLAYGROUNDS[id]().catch(() => null) : Promise.resolve(null);
      loaded.set(id, promise);
    }
    return promise;
  }
</script>

{#if tabs.length === 0}
  <div class="empty">
    <p class="empty-title">No runtimes enabled</p>
    <p class="muted">
      The playground hosts interactive environments for this site's code exercises. This site
      doesn't enable any — a site operator can turn them on via the <code>runtimes</code> setting
      in <code>astro.config.mjs</code>.
    </p>
  </div>
{:else}
  <div class="playground stack">
    {#if tabs.length > 1}
      <div class="tabs" role="tablist">
        {#each tabs as tab (tab.id)}
          <button
            class="tab"
            class:active={active === tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onclick={() => (active = tab.id)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    {/if}

    {#if active !== null}
      {#await playgroundFor(active)}
        <p class="muted">Loading {RUNTIME_INFO[active]?.label ?? active}…</p>
      {:then Playground}
        {#if Playground}
          <Playground runtimeId={active} />
        {:else}
          <div class="empty">
            <p class="empty-title">{RUNTIME_INFO[active]?.label ?? active}</p>
            <p class="muted">
              This runtime is enabled, but its playground isn't implemented yet.
            </p>
          </div>
        {/if}
      {/await}
    {/if}
  </div>
{/if}

<style>
  .empty {
    padding: var(--space-5);
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-lg);
    max-width: 46rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty-title {
    font-weight: 700;
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border-color);
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--text-muted-color);
    cursor: pointer;
  }

  .tab:hover {
    color: var(--text-color);
  }

  .tab.active {
    color: var(--color-primary-strong);
    border-bottom-color: var(--color-primary);
  }
</style>
