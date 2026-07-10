<script lang="ts">
  import { onMount } from 'svelte';
  import { requestPersistentStorage } from '../../lib/db/persistence';
  import { getProfile, setProfile } from '../../lib/profile';
  import {href} from '../../lib/paths';

  let busy = $state(false);
  let name = $state('');
  let email = $state('');

  onMount(() => {
    const profile = getProfile();
    name = profile.name;
    email = profile.email;
  });

  async function finish() {
    busy = true;
    setProfile({ name, email });
    // Best-effort: keep IndexedDB out of the browser's eviction pool.
    await requestPersistentStorage();
    location.replace(href('/courses/'));
  }
</script>

<div class="onboarding">
  <h1>Welcome to Learn Anywhere</h1>
  <p class="muted">
    Courses you can take entirely in your browser: read the lessons, answer the quizzes as you
    go, and finish each chapter with a test. Your scores are tracked so you can see how you're
    doing.
  </p>
  <ul class="muted points">
    <li>No account and no server: enroll in a course and it's copied into this browser.</li>
    <li>Your progress, answers, and scores are saved locally and survive reloads.</li>
    <li>After the first visit everything works fully offline.</li>
  </ul>
  <div class="profile">
    <p class="profile-title">Who are you? <span class="muted">(optional)</span></p>
    <p class="muted small">
      Some courses send quiz and test answers to their authors for marking — that needs a name
      and email so they know whose work it is. You can add or change these later in Settings.
    </p>
    <div class="fields">
      <label>
        Name
        <input type="text" bind:value={name} autocomplete="name" placeholder="Ada Lovelace" />
      </label>
      <label>
        Email
        <input type="email" bind:value={email} autocomplete="email" placeholder="ada@example.com" />
      </label>
    </div>
  </div>
  <div>
    <button class="btn btn-primary" onclick={finish} disabled={busy}>Browse courses</button>
  </div>
</div>

<style>
  .onboarding {
    max-width: 34rem;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-6);
  }

  .muted {
    color: var(--text-muted-color);
  }

  .points {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-left: var(--space-5);
    margin: 0;
  }

  .profile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--surface-color);
  }

  .profile-title {
    font-weight: 700;
  }

  .small {
    font-size: var(--font-size-sm);
  }

  .fields {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    margin-top: var(--space-2);
  }
</style>
