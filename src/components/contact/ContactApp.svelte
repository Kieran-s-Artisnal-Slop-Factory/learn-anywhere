<script lang="ts">
  /**
   * The /contact/ page body: general feedback with a custom subject and a
   * plain-text message, POSTed to the configured contactEndpoint. The page
   * exists even when no endpoint is configured (it's statically built), so
   * it explains itself in that case; the navbar only links here when
   * configured.
   */
  import { contactConfigured, postFeedback } from '../../lib/contact';
  import Card from '../Card.svelte';

  let subject = $state('');
  let message = $state('');
  let state = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    state = 'sending';
    error = null;
    try {
      await postFeedback(subject.trim(), message.trim());
      state = 'sent';
    } catch (err) {
      state = 'failed';
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function reset() {
    subject = '';
    message = '';
    state = 'idle';
    error = null;
  }
</script>

{#if !contactConfigured()}
  <p class="muted">
    This site hasn't configured a contact endpoint, so there's nowhere to send feedback.
  </p>
{:else}
  <Card title="Send us a message">
    {#if state === 'sent'}
      <div class="stack">
        <p class="banner banner-success">Thanks — your message was sent.</p>
        <div class="row">
          <button class="btn" onclick={reset}>Send another</button>
        </div>
      </div>
    {:else}
      <form class="stack" onsubmit={submit}>
        <label>
          Subject
          <input type="text" bind:value={subject} placeholder="What's this about?" />
        </label>
        <label>
          Message
          <textarea rows="8" bind:value={message} placeholder="Your feedback, question, or issue…"></textarea>
        </label>
        {#if state === 'failed'}
          <p class="banner banner-danger">Sending failed ({error}) — try again.</p>
        {/if}
        <div class="row">
          <button
            class="btn btn-primary"
            type="submit"
            disabled={state === 'sending' || !subject.trim() || !message.trim()}
          >
            {state === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    {/if}
  </Card>
{/if}

<style>
  textarea {
    resize: vertical;
  }
</style>
