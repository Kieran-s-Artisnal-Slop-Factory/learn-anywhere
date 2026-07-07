<script lang="ts">
  // Interactive half of the chapter overview: per-exercise progress badges.
  // Also refreshes the cached rows this page shows (content-hash flow) so a
  // deep link works even before the visitor saw the course page.
  import { onMount } from 'svelte';
  import { get } from '../../lib/db/repo';
  import type { Exercises } from '../../lib/db/types';
  import type { ChapterContent, CourseContent, ExerciseContent } from '../../lib/content/types';
  import { syncChapter, syncCourse, syncExercise } from '../../lib/content/sync';
  import Card from '../Card.svelte';

  let {
    course,
    chapter,
    exercises,
  }: {
    course: CourseContent;
    chapter: ChapterContent;
    exercises: ExerciseContent[];
  } = $props();

  let loading = $state(true);
  let rows = $state<Map<string, Exercises>>(new Map());

  onMount(async () => {
    await syncCourse($state.snapshot(course));
    await syncChapter($state.snapshot(chapter));
    for (const exercise of exercises) await syncExercise($state.snapshot(exercise));
    const loaded = new Map<string, Exercises>();
    for (const exercise of exercises) {
      const row = await get<Exercises>('exercises', exercise.slug);
      if (row) loaded.set(exercise.slug, row);
    }
    rows = loaded;
    loading = false;
  });
</script>

<Card title="Exercises">
  {#if loading}
    <p class="muted">Loading…</p>
  {:else}
    <ol class="exercise-list">
      {#each exercises as exercise (exercise.slug)}
        {@const row = rows.get(exercise.slug)}
        <li>
          <a href={`/courses/${course.slug}/${chapter.slug}/${exercise.slug}/`}>{exercise.title}</a>
          <span class="muted">
            {#if row?.completed}
              ✓ complete
            {:else if row?.started}
              in progress
            {/if}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</Card>

<style>
  .exercise-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-left: var(--space-5);
    margin: 0;
  }

  .exercise-list li {
    display: list-item;
  }

  .exercise-list .muted {
    margin-left: var(--space-2);
    font-size: var(--font-size-sm);
  }
</style>
