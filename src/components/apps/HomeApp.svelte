<script lang="ts">
  import { onMount } from 'svelte';
  import { all } from '../../lib/db/repo';

  let loading = $state(true);
  let exercisesCount = $state(0);
  let coursesCount = $state(0);
  let chaptersCount = $state(0);

  onMount(async () => {
    exercisesCount = (await all('exercises')).length;
    coursesCount = (await all('courses')).length;
    chaptersCount = (await all('chapters')).length;
    loading = false;
  });
</script>

<div class="page-header">
  <h1>lite-learner</h1>
</div>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="tiles">
    <a class="tile" href="/exercises/">
      <span class="count">{exercisesCount}</span>
      <span class="label">Exercises</span>
    </a>
    <a class="tile" href="/courses/">
      <span class="count">{coursesCount}</span>
      <span class="label">Courses</span>
    </a>
    <a class="tile" href="/chapters/">
      <span class="count">{chaptersCount}</span>
      <span class="label">Chapters</span>
    </a>
  </div>

  <p class="muted status">
    Everything lives in this browser — remember to export a backup now and then in
    <a href="/settings/">Settings</a>.
  </p>
{/if}

<style>
  .tiles {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-1);
    text-decoration: none;
    color: var(--text-color);
  }

  .tile:hover {
    border-color: var(--color-primary);
  }

  .count {
    font-size: var(--font-size-2xl);
    font-weight: 800;
    color: var(--color-primary-strong);
  }

  .label {
    font-weight: 600;
    color: var(--text-muted-color);
  }

  .status {
    margin-top: var(--space-5);
    font-size: var(--font-size-sm);
  }
</style>
