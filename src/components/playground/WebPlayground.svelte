<script lang="ts">
  /**
   * Web playground — a blank HTML/CSS/JS scratchpad reusing the full
   * WebExercise workspace (tabs, live preview, console strip, viewport
   * presets, zip/screenshot exports) with playground persistence instead of
   * lesson persistence. No Submit (onSubmit null hides it); "Reset to
   * starter" resets to blank.
   */
  import { onMount } from 'svelte';
  import type { WebBlock } from '../../lib/content/types';
  import { loadPlayground, savePlaygroundBuffers } from '../../lib/playground';
  import WebExercise from '../exercise/WebExercise.svelte';

  let { runtimeId }: { runtimeId: string } = $props();

  const block: WebBlock = {
    lang: 'js',
    starter: {
      html: '<h1>Playground</h1>\n<p>Build anything.</p>',
      css: '',
      js: '',
    },
  };

  let saved = $state<Record<string, string> | null>(null);
  let ready = $state(false);

  onMount(async () => {
    const state = await loadPlayground(runtimeId);
    const buffers = state?.buffers ?? {};
    saved =
      buffers.html !== undefined || buffers.css !== undefined || buffers.js !== undefined
        ? { html: buffers.html ?? '', css: buffers.css ?? '', js: buffers.js ?? '' }
        : null;
    ready = true;
  });

  const save = (buffers: Record<string, string>) => savePlaygroundBuffers(runtimeId, buffers).then(() => {});
</script>

{#if !ready}
  <p class="muted">Loading…</p>
{:else}
  <div class="stack">
    <p class="muted intro">
      A blank page, all yours — HTML, CSS, and JS with a live preview. Your work autosaves;
      use Export for a zip of the files or a screenshot.
    </p>
    <WebExercise
      {block}
      initialSolution={saved}
      completed={false}
      onSave={save}
      onSubmit={null}
      wide={true}
      exportName="playground"
    />
  </div>
{/if}

<style>
  .intro {
    max-width: 60ch;
    font-size: var(--font-size-sm);
  }
</style>
