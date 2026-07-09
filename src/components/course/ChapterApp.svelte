<script lang="ts">
  /**
   * Interactive half of a chapter page: the lesson list with live progress
   * plus a continue quick-access. Also refreshes the cached rows this page
   * shows (content-hash flow) so a deep link works even before the visitor
   * saw the course page.
   */
  import { onMount } from 'svelte';
  import { get } from '../../lib/db/repo';
  import type { Chapters, Lessons } from '../../lib/db/types';
  import type { ChapterContent, CourseContent, LessonContent } from '../../lib/content/types';
  import { syncChapter, syncCourse, syncLesson } from '../../lib/content/sync';
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

  const done = $derived([...lessonRows.values()].filter((l) => l.completed).length);
  const continueLesson = $derived(
    chapterRow?.completed ? null : (lessons.find((l) => !lessonRows.get(l.slug)?.completed) ?? null)
  );

  onMount(async () => {
    await syncCourse($state.snapshot(course));
    await syncChapter($state.snapshot(chapter));
    for (const lesson of lessons) await syncLesson($state.snapshot(lesson));
    chapterRow = (await get<Chapters>('chapters', chapter.slug)) ?? null;
    const loaded = new Map<string, Lessons>();
    for (const lesson of lessons) {
      const row = await get<Lessons>('lessons', lesson.slug);
      if (row) loaded.set(lesson.slug, row);
    }
    lessonRows = loaded;
    loading = false;
  });
</script>

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="stack">
    {#if chapterRow?.completed}
      <p class="banner banner-success">
        ✓ Chapter completed {new Date(chapterRow.completed).toLocaleDateString()}
      </p>
    {:else if continueLesson}
      <div class="quick-access banner banner-warning">
        <span class="muted">{done}/{lessons.length} lessons done</span>
        <a class="btn btn-primary" href={href(continueLesson.slug)}>
          {done > 0 ? 'Continue' : 'Start'}: {continueLesson.title} →
        </a>
      </div>
    {/if}

    <Card title="lessons">
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
    </Card>
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

  .lesson-list .badge {
    margin-left: var(--space-2);
  }
</style>
