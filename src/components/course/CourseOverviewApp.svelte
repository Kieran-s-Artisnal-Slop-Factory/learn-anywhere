<script lang="ts">
  // Interactive half of the course overview: enrollment (copies the whole
  // course bundle into IndexedDB via the content-hash sync) and per-chapter
  // progress. The course description itself is rendered statically by the
  // page.
  import { onMount } from 'svelte';
  import { get } from '../../lib/db/repo';
  import type { Chapters, Courses, Exercises } from '../../lib/db/types';
  import type { ChapterContent, CourseContent, ExerciseContent } from '../../lib/content/types';
  import { syncCourseBundle } from '../../lib/content/sync';
  import Card from '../Card.svelte';

  interface Bundle {
    course: CourseContent;
    chapters: ChapterContent[];
    exercises: ExerciseContent[];
  }

  let { bundle }: { bundle: Bundle } = $props();

  let loading = $state(true);
  let courseRow: Courses | null = $state(null);
  let chapterProgress = $state<Map<string, { completed: boolean; done: number; total: number }>>(new Map());

  const enrolled = $derived(courseRow != null);
  const continueChapter = $derived(
    courseRow?.current_chapter ?? bundle.course.chapters[0] ?? null
  );

  async function refresh() {
    courseRow = (await get<Courses>('courses', bundle.course.slug)) ?? null;
    const progress = new Map<string, { completed: boolean; done: number; total: number }>();
    for (const chapter of bundle.chapters) {
      const chapterRow = await get<Chapters>('chapters', chapter.slug);
      const exercises = await Promise.all(
        chapter.exercises.map((slug) => get<Exercises>('exercises', slug))
      );
      progress.set(chapter.slug, {
        completed: chapterRow?.completed != null,
        done: exercises.filter((e) => e?.completed).length,
        total: chapter.exercises.length,
      });
    }
    chapterProgress = progress;
  }

  async function enroll() {
    // Cache-or-refresh every row in the course; progress is preserved.
    await syncCourseBundle($state.snapshot(bundle) as Bundle);
    await refresh();
  }

  onMount(async () => {
    await refresh();
    // Already enrolled: keep the cached content fresh (hash check no-ops when
    // nothing changed).
    if (courseRow) await enroll();
    loading = false;
  });
</script>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="stack">
    {#if !enrolled}
      <Card>
        <p>Enroll to start the course — everything is stored in your browser and works offline.</p>
        <button class="btn btn-primary enroll" onclick={enroll}>Enroll</button>
      </Card>
    {:else}
      <div class="row">
        {#if courseRow?.completed}
          <span class="badge done">✓ Course completed</span>
        {:else if continueChapter}
          <a class="btn btn-primary" href={`/courses/${bundle.course.slug}/${continueChapter}/`}>
            {courseRow?.started ? 'Continue' : 'Start course'}
          </a>
        {/if}
      </div>
    {/if}

    <Card title="Chapters">
      <ol class="chapter-list">
        {#each bundle.chapters as chapter, i (chapter.slug)}
          {@const p = chapterProgress.get(chapter.slug)}
          <li>
            {#if enrolled}
              <a href={`/courses/${bundle.course.slug}/${chapter.slug}/`}>{chapter.title}</a>
            {:else}
              <span>{chapter.title}</span>
            {/if}
            <span class="muted">
              {#if p?.completed}
                ✓ complete
              {:else if p && p.done > 0}
                {p.done}/{p.total} exercises
              {:else}
                {chapter.exercises.length} exercises
              {/if}
            </span>
          </li>
        {/each}
      </ol>
    </Card>
  </div>
{/if}

<style>
  .enroll {
    margin-top: var(--space-3);
  }

  .chapter-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-left: var(--space-5);
    margin: 0;
  }

  .chapter-list li {
    display: list-item;
  }

  .chapter-list .muted {
    margin-left: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .badge {
    font-size: var(--font-size-sm);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-full);
    color: var(--color-primary-strong);
  }
</style>
