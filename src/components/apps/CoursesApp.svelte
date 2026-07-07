<script lang="ts">
  // Course listing: static course facts baked in at build time, decorated
  // with the visitor's cached progress from IndexedDB.
  import { onMount } from 'svelte';
  import { all } from '../../lib/db/repo';
  import type { Courses } from '../../lib/db/types';
  import Card from '../Card.svelte';

  interface CourseCard {
    slug: string;
    title: string;
    blurb: string;
    chapterCount: number;
    exerciseCount: number;
  }

  let { courses = [] }: { courses?: CourseCard[] } = $props();

  let rows: Courses[] = $state([]);

  const rowFor = (slug: string) => rows.find((r) => r.id === slug);

  onMount(async () => {
    rows = await all<Courses>('courses');
  });
</script>

<div class="page-header">
  <h1>Courses</h1>
</div>

<div class="stack">
  {#each courses as course (course.slug)}
    {@const row = rowFor(course.slug)}
    <Card title={course.title}>
      <p class="muted counts">{course.chapterCount} chapters · {course.exerciseCount} exercises</p>
      <p class="blurb">{course.blurb}</p>
      <div class="row meta">
        {#if row?.completed}
          <span class="badge done">completed</span>
        {:else if row?.started}
          <span class="badge">in progress</span>
        {:else if row}
          <span class="badge">enrolled</span>
        {/if}
      </div>
      <a class="btn btn-primary" href={`/courses/${course.slug}/`}>
        {row?.started ? 'Continue' : 'View course'}
      </a>
    </Card>
  {:else}
    <p class="muted">No courses have been authored yet.</p>
  {/each}
</div>

<style>
  .counts {
    font-size: var(--font-size-sm);
  }

  .blurb {
    margin-block: var(--space-2);
  }

  .meta {
    margin-bottom: var(--space-3);
  }

  .badge {
    font-size: var(--font-size-sm);
    padding: 0 var(--space-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-full);
    color: var(--text-muted-color);
  }

  .badge.done {
    color: var(--color-primary-strong);
    border-color: var(--color-primary);
  }
</style>
