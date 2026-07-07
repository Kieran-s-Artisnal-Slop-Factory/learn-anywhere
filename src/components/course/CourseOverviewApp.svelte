<script lang="ts">
  /**
   * The interactive body of the course page: enroll / continue quick-access
   * plus every chapter and its exercises with live progress. Enrolling copies
   * the whole course bundle into IndexedDB via the content-hash sync; the
   * same sync refreshes stale cached content on every visit.
   */
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
  let chapterRows = $state<Map<string, Chapters>>(new Map());
  let exerciseRows = $state<Map<string, Exercises>>(new Map());

  const exerciseBySlug = new Map(bundle.exercises.map((e) => [e.slug, e]));
  const enrolled = $derived(courseRow != null);
  const totalDone = $derived(
    bundle.exercises.filter((e) => exerciseRows.get(e.slug)?.completed).length
  );

  /**
   * Where "Continue" goes: the first incomplete exercise, preferring the
   * chapter the visitor was last in (course.current_chapter).
   */
  const continueTarget = $derived.by(() => {
    if (!courseRow || courseRow.completed) return null;
    const ordered = [...bundle.chapters];
    const currentIndex = ordered.findIndex((c) => c.slug === courseRow!.current_chapter);
    if (currentIndex > 0) ordered.unshift(...ordered.splice(currentIndex, 1));
    for (const chapter of ordered) {
      for (const slug of chapter.exercises) {
        if (!exerciseRows.get(slug)?.completed) {
          const exercise = exerciseBySlug.get(slug);
          if (exercise) return { chapter, exercise };
        }
      }
    }
    return null;
  });

  const exerciseHref = (chapter: ChapterContent, exerciseSlug: string) =>
    `/courses/${bundle.course.slug}/${chapter.slug}/${exerciseSlug}/`;

  function chapterDone(chapter: ChapterContent): number {
    return chapter.exercises.filter((slug) => exerciseRows.get(slug)?.completed).length;
  }

  /** Split `text` on `inline code` spans so descriptions render backticks. */
  function inlineCode(text: string): { code: boolean; text: string }[] {
    return text.split('`').map((part, i) => ({ code: i % 2 === 1, text: part }));
  }

  async function refresh() {
    courseRow = (await get<Courses>('courses', bundle.course.slug)) ?? null;
    const chapters = new Map<string, Chapters>();
    const exercises = new Map<string, Exercises>();
    for (const chapter of bundle.chapters) {
      const chapterRow = await get<Chapters>('chapters', chapter.slug);
      if (chapterRow) chapters.set(chapter.slug, chapterRow);
      for (const slug of chapter.exercises) {
        const exerciseRow = await get<Exercises>('exercises', slug);
        if (exerciseRow) exercises.set(slug, exerciseRow);
      }
    }
    chapterRows = chapters;
    exerciseRows = exercises;
  }

  async function enroll() {
    await syncCourseBundle($state.snapshot(bundle) as Bundle);
    await refresh();
  }

  onMount(async () => {
    await refresh();
    // Already enrolled: keep the cached content fresh (hash check no-ops when
    // nothing changed).
    if (courseRow) await enroll();
    loading = false;
    // Chapter anchors only exist after hydration, so honor #chapter manually.
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView();
    }
  });
</script>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="stack">
    {#if !enrolled}
      <div class="quick-access banner">
        <div>
          <p class="qa-title">Ready to start?</p>
          <p class="muted qa-sub">
            Enrolling copies the course into your browser — no account, works offline.
          </p>
        </div>
        <button class="btn btn-primary" onclick={enroll}>Enroll</button>
      </div>
    {:else if courseRow?.completed}
      <div class="quick-access banner banner-success">
        <div>
          <p class="qa-title">✓ Course completed</p>
          <p class="muted qa-sub">
            Finished {new Date(courseRow.completed).toLocaleDateString()} — every exercise stays
            open for experimenting.
          </p>
        </div>
      </div>
    {:else if continueTarget}
      <div class="quick-access banner banner-warning">
        <div>
          <p class="qa-title">
            {courseRow?.started ? 'Pick up where you left off' : 'Ready when you are'}
          </p>
          <p class="muted qa-sub">
            {continueTarget.chapter.title} · {totalDone}/{bundle.exercises.length} exercises done
          </p>
        </div>
        <a class="btn btn-primary" href={exerciseHref(continueTarget.chapter, continueTarget.exercise.slug)}>
          {courseRow?.started ? 'Continue' : 'Start'}: {continueTarget.exercise.title} →
        </a>
      </div>
    {/if}

    {#each bundle.chapters as chapter, i (chapter.slug)}
      {@const done = chapterDone(chapter)}
      {@const chapterRow = chapterRows.get(chapter.slug)}
      <section id={chapter.slug}>
        <Card title={`${i + 1}. ${chapter.title}`}>
          {#snippet actions()}
            {#if chapterRow?.completed}
              <span class="badge badge-done">✓ complete</span>
            {:else if done > 0}
              <span class="badge badge-active">{done}/{chapter.exercises.length}</span>
            {:else}
              <span class="badge">{chapter.exercises.length} exercises</span>
            {/if}
          {/snippet}
          <p class="muted chapter-desc">
            {#each inlineCode(chapter.description.trim()) as seg, j (j)}
              {#if seg.code}<code>{seg.text}</code>{:else}{seg.text}{/if}
            {/each}
          </p>
          <ol class="exercise-list">
            {#each chapter.exercises as slug (slug)}
              {@const exercise = exerciseBySlug.get(slug)}
              {@const exerciseRow = exerciseRows.get(slug)}
              {#if exercise}
                <li>
                  {#if enrolled}
                    <a href={exerciseHref(chapter, slug)}>{exercise.title}</a>
                  {:else}
                    <span>{exercise.title}</span>
                  {/if}
                  {#if exerciseRow?.completed}
                    <span class="badge badge-done">✓</span>
                  {:else if exerciseRow?.started}
                    <span class="badge badge-active">in progress</span>
                  {/if}
                </li>
              {/if}
            {/each}
          </ol>
        </Card>
      </section>
    {/each}
  </div>
{/if}

<style>
  .quick-access {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
  }

  .qa-title {
    font-weight: 700;
  }

  .qa-sub {
    font-size: var(--font-size-sm);
  }

  .chapter-desc {
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-3);
  }

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

  .exercise-list .badge {
    margin-left: var(--space-2);
  }

  section {
    scroll-margin-top: calc(var(--navbar-height) + var(--space-4));
  }
</style>
