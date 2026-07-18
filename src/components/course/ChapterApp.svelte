<script lang="ts">
  /**
   * Interactive half of a chapter page: the lesson list with live progress
   * plus a continue quick-access, ending with the chapter test (when the
   * chapter has one). Also refreshes the cached rows this page shows
   * (content-hash flow) so a deep link works even before the visitor saw the
   * course page.
   */
  import { onMount } from 'svelte';
  import { percent } from '../../lib/assessment/grade';
  import { get } from '../../lib/db/repo';
  import type { Chapters, Lessons } from '../../lib/db/types';
  import type { ChapterContent, CourseContent, LessonContent } from '../../lib/content/types';
  import { syncChapter, syncCourse, syncLesson } from '../../lib/content/sync';
  import { resetChapterProgress } from '../../lib/progress';
  import Card from '../Card.svelte';
  import {href as linkCorrector} from '../../lib/paths';

  let {
    course,
    chapter,
    lessons,
  }: {
    course: CourseContent;
    chapter: ChapterContent;
    lessons: LessonContent[];
  } = $props();

  let loading = $state(true);
  let chapterRow: Chapters | null = $state(null);
  let lessonRows = $state<Map<string, Lessons>>(new Map());

  const href = (slug: string) => linkCorrector(`/courses/${slug}/`);

  const hasTest =
    (chapter.test?.length ?? 0) > 0 || chapter.test_database != null || chapter.test_web != null;
  const done = $derived([...lessonRows.values()].filter((l) => l.completed).length);
  const testPct = $derived(chapterRow?.test_score ? percent(chapterRow.test_score) : null);
  const continueLesson = $derived(
    chapterRow?.completed ? null : (lessons.find((l) => !lessonRows.get(l.slug)?.completed) ?? null)
  );
  // Every lesson done but the test still open → point "continue" at the test.
  const testIsNext = $derived(
    !chapterRow?.completed && !continueLesson && hasTest && !chapterRow?.test_completed
  );
  // Anything worth resetting — a started/completed chapter or any touched lesson.
  const hasProgress = $derived(
    chapterRow?.started != null ||
      chapterRow?.completed != null ||
      chapterRow?.test_completed != null ||
      [...lessonRows.values()].some((l) => l.started || l.completed)
  );

  async function loadRows() {
    chapterRow = (await get<Chapters>('chapters', chapter.slug)) ?? null;
    const loaded = new Map<string, Lessons>();
    for (const lesson of lessons) {
      const row = await get<Lessons>('lessons', lesson.slug);
      if (row) loaded.set(lesson.slug, row);
    }
    lessonRows = loaded;
  }

  async function resetProgress() {
    if (!confirm(`Reset your progress for "${chapter.title}"? This clears its lessons' completion and quiz answers, and the chapter test — the content stays. This can't be undone.`)) {
      return;
    }
    await resetChapterProgress(course.slug, chapter.slug);
    await loadRows();
  }

  onMount(async () => {
    await syncCourse($state.snapshot(course));
    await syncChapter($state.snapshot(chapter));
    for (const lesson of lessons) await syncLesson($state.snapshot(lesson));
    await loadRows();
    loading = false;
  });
</script>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="stack">
    {#if chapterRow?.completed}
      <p class="banner banner-success">
        ✓ Chapter completed {new Date(chapterRow.completed).toLocaleDateString()}{testPct !== null
          ? ` · test score ${chapterRow.test_score?.correct}/${chapterRow.test_score?.gradable} (${testPct}%)`
          : ''}
      </p>
    {:else if continueLesson}
      <div class="quick-access banner banner-warning">
        <span class="muted">{done}/{lessons.length} lessons done</span>
        <a class="btn btn-primary" href={href(continueLesson.slug)}>
          {done > 0 ? 'Continue' : 'Start'}: {continueLesson.title} →
        </a>
      </div>
    {:else if testIsNext}
      <div class="quick-access banner banner-warning">
        <span class="muted">All lessons done — the chapter test is what's left.</span>
        <a class="btn btn-primary" href={href(`${chapter.slug}/test`)}>Take the chapter test →</a>
      </div>
    {/if}

    <Card title="Lessons">
      <ol class="lesson-list">
        {#each lessons as lesson (lesson.slug)}
          {@const row = lessonRows.get(lesson.slug)}
          <li>
            <a href={href(lesson.slug)}>{lesson.title}</a>
            {#if lesson.kind === 'reading'}
              <span class="badge">reading</span>
            {/if}
            {#if row?.completed}
              <span class="badge badge-done">✓</span>
            {:else if row?.started}
              <span class="badge badge-active">in progress</span>
            {/if}
          </li>
        {/each}
      </ol>
      {#if hasTest}
        <div class="test-row">
          <a href={href(`${chapter.slug}/test`)}>Chapter test</a>
          <span class="badge">test</span>
          {#if chapterRow?.test_completed}
            <span class="badge badge-done">✓ {testPct === null ? 'taken' : `${testPct}%`}</span>
          {/if}
        </div>
      {/if}
    </Card>

    {#if hasProgress}
      <div class="reset-row">
        <button class="btn btn-danger btn-sm" onclick={resetProgress}>Reset chapter progress</button>
      </div>
    {/if}
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

  .lesson-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-left: var(--space-5);
    margin: 0;
  }

  .lesson-list li {
    display: list-item;
  }

  .lesson-list .badge,
  .test-row .badge {
    margin-left: var(--space-2);
  }

  .test-row {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px dashed var(--border-color);
    padding-left: var(--space-5);
  }

  .reset-row {
    display: flex;
    justify-content: flex-end;
  }
</style>
