<script lang="ts">
  import { requestPersistentStorage } from '../../lib/db/persistence';

  const ONBOARDED_KEY = 'lite-learner-onboarded';

  let busy = $state(false);

  async function finish() {
    busy = true;
    // Best-effort: keep IndexedDB out of the browser's eviction pool.
    await requestPersistentStorage();
    localStorage.setItem(ONBOARDED_KEY, '1');
    location.replace('/courses/');
  }
</script>

<div class="onboarding">
  <h1>Welcome to lite-learner</h1>
  <p class="muted">
    Learn SQL by writing it. Every exercise runs against a real SQLite database in your
    browser — write a statement, run it, and watch the database change.
  </p>
  <ul class="muted points">
    <li>No account and no server: enroll in a course and it's copied into this browser.</li>
    <li>Your progress and solutions are saved locally and survive reloads.</li>
    <li>After the first visit everything works fully offline.</li>
  </ul>
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
</style>
