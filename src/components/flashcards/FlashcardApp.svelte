<script lang="ts">
  /**
   * Flashcard practice — session-only, no persistence. The deck is shuffled
   * into a queue; reveal the back, then mark the card known ("Got it") or
   * send it to the back of the queue ("Again"). A round ends when every card
   * has been answered correctly once; a summary shows how many needed
   * repeats. Space/Enter flips, 1/2 answer — keyboard-first for fast drills.
   */
  import { onMount } from 'svelte';

  interface Card {
    front: string;
    back: string;
    // Build-rendered markdown (see pages/flashcards/[deck].astro).
    front_html?: string;
    back_html?: string;
  }

  let { cards }: { cards: Card[] } = $props();

  let queue = $state<Card[]>([]);
  let revealed = $state(false);
  let known = $state(0);
  let attempts = $state(0);
  let repeats = $state(0);

  const total = $derived(cards.length);
  const current = $derived(queue[0] ?? null);
  const done = $derived(queue.length === 0);

  function shuffle<T>(list: T[]): T[] {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  function restart() {
    queue = shuffle(cards);
    revealed = false;
    known = 0;
    attempts = 0;
    repeats = 0;
  }

  function flip() {
    if (!done) revealed = !revealed;
  }

  function answer(gotIt: boolean) {
    if (!current || !revealed) return;
    attempts++;
    if (gotIt) {
      known++;
      queue = queue.slice(1);
    } else {
      repeats++;
      // To the back of the queue — it comes around again this round.
      queue = [...queue.slice(1), queue[0]!];
    }
    revealed = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ' || e.key === 'Enter') {
      // Let buttons keep their native Enter/Space activation.
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
      e.preventDefault();
      flip();
    } else if (revealed && e.key === '1') {
      answer(true);
    } else if (revealed && e.key === '2') {
      answer(false);
    }
  }

  onMount(restart);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="practice">
  {#if done && attempts > 0}
    <div class="summary">
      <p class="summary-title">Round complete</p>
      <p class="muted">
        {total} card{total === 1 ? '' : 's'} learned in {attempts} attempt{attempts === 1 ? '' : 's'}
        {#if repeats > 0}
          — {repeats} card{repeats === 1 ? ' was' : 's were'} repeated.
        {:else}
          — perfect round.
        {/if}
      </p>
      <button class="btn btn-primary" onclick={restart}>Practice again</button>
    </div>
  {:else if current}
    <div class="meta">
      <span class="muted">{known}/{total} learned</span>
      {#if queue.length > 1}
        <span class="muted">{queue.length} remaining</span>
      {/if}
    </div>

    <!-- A div-with-button-role rather than a real <button>: card text is
         rendered markdown and may contain glossary links, which can't live
         inside a button element. -->
    <div
      class="card-face"
      class:revealed
      role="button"
      tabindex="0"
      onclick={(e) => {
        // Let links inside the card (e.g. glossary refs) act as links.
        if (!(e.target as HTMLElement).closest('a')) flip();
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      }}
      aria-label={revealed ? 'Card back — press to show front' : 'Card front — press to reveal answer'}
    >
      <span class="side-label">{revealed ? 'Answer' : 'Prompt'}</span>
      {#if revealed ? current.back_html : current.front_html}
        <div class="card-text">{@html revealed ? current.back_html : current.front_html}</div>
      {:else}
        <span class="card-text">{revealed ? current.back : current.front}</span>
      {/if}
      <span class="muted flip-hint">{revealed ? '' : 'Click or press Space to reveal'}</span>
    </div>

    <div class="controls">
      {#if revealed}
        <button class="btn btn-primary" onclick={() => answer(true)}>Got it <kbd>1</kbd></button>
        <button class="btn" onclick={() => answer(false)}>Again <kbd>2</kbd></button>
      {:else}
        <button class="btn" onclick={flip}>Reveal answer</button>
      {/if}
      <button class="btn btn-quiet" onclick={restart}>Restart</button>
    </div>
  {/if}
</div>

<style>
  .practice {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 40rem;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
  }

  .card-face {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 16rem;
    padding: var(--space-5);
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-1);
    cursor: pointer;
    text-align: center;
    width: 100%;
  }

  .card-face:hover {
    border-color: var(--color-primary);
  }

  .card-face.revealed {
    background: var(--surface-raised-color);
  }

  .side-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted-color);
  }

  .card-text {
    font-size: var(--font-size-lg);
    font-weight: 600;
    text-wrap: balance;
  }

  /* Rendered-markdown card text: keep injected elements compact. */
  .card-text :global(p) {
    margin: 0;
  }

  .card-text :global(p + p) {
    margin-top: var(--space-2);
  }

  .card-text :global(pre) {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    overflow-x: auto;
    font-size: var(--font-size-sm);
    font-weight: 400;
  }

  .card-text :global(ul),
  .card-text :global(ol) {
    text-align: left;
    margin: var(--space-2) 0 0;
    padding-left: var(--space-5);
    font-weight: 400;
  }

  .flip-hint {
    font-size: var(--font-size-sm);
    min-height: 1.4em;
  }

  .controls {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .controls .btn-quiet {
    margin-left: auto;
    border-color: transparent;
    background: none;
    color: var(--text-muted-color);
  }

  .controls .btn-quiet:hover {
    color: var(--text-color);
  }

  .summary {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-5);
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
  }

  .summary-title {
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  kbd {
    border: 1px solid var(--border-color);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    padding: 0 var(--space-1);
    font-size: 0.75rem;
    background: var(--surface-raised-color);
    color: var(--text-muted-color);
  }
</style>
