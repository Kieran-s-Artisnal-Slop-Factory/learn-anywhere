<script lang="ts">
  /**
   * "Give us feedback on this lesson" — rendered at the bottom of lesson and
   * test pages, but only when a contactEndpoint is configured (renders
   * nothing otherwise, so pages can include it unconditionally). Opens a
   * modal with a plain-text message; the subject is fixed to
   * "Feedback: <lesson title> <url>".
   */
  import { contactConfigured, postFeedback } from '../../lib/contact';

  let { title }: { title: string } = $props();

  let open = $state(false);
  let message = $state('');
  let state = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let error = $state<string | null>(null);

  const subject = () => `Feedback: ${title} ${location.href}`;

  function openModal() {
    open = true;
    state = 'idle';
    error = null;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    state = 'sending';
    error = null;
    try {
      await postFeedback(subject(), message.trim());
      state = 'sent';
      message = '';
    } catch (err) {
      state = 'failed';
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

{#if contactConfigured()}
  <div class="feedback">
    <button class="btn" onclick={openModal}>Give us feedback on this lesson</button>
  </div>

  {#if open}
    <div
      class="modal-backdrop"
      role="presentation"
      onclick={(e) => e.target === e.currentTarget && (open = false)}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <h3 id="feedback-title">Lesson feedback</h3>
        <p class="muted small">Sent to the course team with the subject:</p>
        <p class="subject">Feedback: {title} {location.href}</p>
        {#if state === 'sent'}
          <p class="banner banner-success">Thanks — your feedback was sent.</p>
          <div class="row actions">
            <button class="btn" type="button" onclick={() => (open = false)}>Close</button>
          </div>
        {:else}
          <form onsubmit={submit}>
            <label>
              Your feedback
              <textarea rows="6" bind:value={message} placeholder="What worked, what didn't…"></textarea>
            </label>
            {#if state === 'failed'}
              <p class="banner banner-danger">Sending failed ({error}) — try again.</p>
            {/if}
            <div class="row actions">
              <button class="btn" type="button" onclick={() => (open = false)}>Cancel</button>
              <button class="btn btn-primary" type="submit" disabled={state === 'sending' || !message.trim()}>
                {state === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .feedback {
    margin-top: var(--space-5);
    display: flex;
    justify-content: center;
  }

  .small {
    font-size: var(--font-size-sm);
  }

  .subject {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    background: var(--surface-raised-color);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    overflow-wrap: anywhere;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: var(--space-4);
  }

  .modal {
    background: var(--surface-raised-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
    padding: var(--space-4);
    max-width: 32rem;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .modal form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  textarea {
    resize: vertical;
  }

  .actions {
    justify-content: flex-end;
  }
</style>
