<script lang="ts">
  import { requestPersistentStorage } from '../../lib/db/persistence';
  import {href} from '../../lib/paths';

  let busy = $state(false);

  async function finish() {
    busy = true;
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
