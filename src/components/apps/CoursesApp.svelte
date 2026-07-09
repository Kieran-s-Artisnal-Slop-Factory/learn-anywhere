<script lang="ts">
  // Course listing: static course facts baked in at build time, decorated
  // with the visitor's cached progress from IndexedDB.
  import { onMount } from 'svelte';
  import { all } from '../../lib/db/repo';
  import type { Courses } from '../../lib/db/types';
  import Card from '../Card.svelte';
  import { href } from '../../lib/paths';

  interface CourseCard {
    slug: string;
    title: string;
    blurb: string;
    chapterCount: number;
    lessonCount: number;
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
      {#snippet actions()}
        {#if row?.completed}
          <span class="badge badge-done">✓ completed</span>
        {:else if row?.started}
          <span class="badge badge-active">in progress</span>
        {:else if row}
          <span class="badge">enrolled</span>
        {/if}
      {/snippet}
      <p class="muted counts">{course.chapterCount} chapters · {course.lessonCount} lessons</p>
      <p class="blurb">{course.blurb}</p>
      <a class="btn btn-primary" href={href(`/courses/${course.slug}/`)}>
        {row?.started && !row?.completed ? 'Continue →' : 'View course →'}
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
    margin-block: var(--space-2) var(--space-4);
    max-width: 65ch;
  }
</style>
