<script lang="ts">
  import { requestPersistentStorage } from '../../lib/db/persistence';

  const ONBOARDED_KEY = 'lite-learner-onboarded';

  let busy = $state(false);

  async function finish() {
    busy = true;
    // Best-effort: keep IndexedDB out of the browser's eviction pool.
    await requestPersistentStorage();
    localStorage.setItem(ONBOARDED_KEY, '1');
    location.replace('/');
  }
</script>

<div class="onboarding">
  <h1>Welcome to lite-learner</h1>
  <p class="muted">
    Everything you create stays in this browser — there is no server and no account. The app
    works fully offline; export JSON backups from Settings to keep a copy elsewhere.
  </p>
  <div>
    <button class="btn btn-primary" onclick={finish} disabled={busy}>Get started</button>
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
</style>
