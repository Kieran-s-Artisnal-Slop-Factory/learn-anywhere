<script lang="ts">
  /**
   * The interactive body of the course page: enroll / continue quick-access
   * plus every chapter and its lessons with live progress. Enrolling copies
   * the whole course bundle into IndexedDB via the content-hash sync; the
   * same sync refreshes stale cached content on every visit.
   */
  import { onMount } from 'svelte';
  import { get } from '../../lib/db/repo';
  import type { Chapters, Courses, Lessons } from '../../lib/db/types';
  import type { ChapterContent, CourseContent, LessonContent } from '../../lib/content/types';
  import { syncCourseBundle } from '../../lib/content/sync';
  import Card from '../Card.svelte';
  import {href as linkCorrector} from '../../lib/paths';

  interface Bundle {
    course: CourseContent;
    chapters: ChapterContent[];
    lessons: LessonContent[];
  }

  let { bundle }: { bundle: Bundle } = $props();

  let loading = $state(true);
  let courseRow: Courses | null = $state(null);
  let chapterRows = $state<Map<string, Chapters>>(new Map());
  let lessonRows = $state<Map<string, Lessons>>(new Map());

  const lessonBySlug = new Map(bundle.lessons.map((l) => [l.slug, l]));
  const enrolled = $derived(courseRow != null);
  const totalDone = $derived(
    bundle.lessons.filter((l) => lessonRows.get(l.slug)?.completed).length
  );

  /**
   * Where "Continue" goes: the first incomplete lesson, preferring the
   * chapter the visitor was last in (course.current_chapter).
   */
  const continueTarget = $derived.by(() => {
    if (!courseRow || courseRow.completed) return null;
    const ordered = [...bundle.chapters];
    const currentIndex = ordered.findIndex((c) => c.slug === courseRow!.current_chapter);
    if (currentIndex > 0) ordered.unshift(...ordered.splice(currentIndex, 1));
    for (const chapter of ordered) {
      for (const slug of chapter.lessons) {
        if (!lessonRows.get(slug)?.completed) {
          const lesson = lessonBySlug.get(slug);
          if (lesson) return { chapter, lesson };
        }
      }
    }
    return null;
  });

  // Slugs are path ids, so they double as the URL path under /courses/.
  const href = (slug: string) => linkCorrector(`/courses/${slug}/`);

  function chapterDone(chapter: ChapterContent): number {
    return chapter.lessons.filter((slug) => lessonRows.get(slug)?.completed).length;
  }

  /** Split `text` on `inline code` spans so descriptions render backticks. */
  function inlineCode(text: string): { code: boolean; text: string }[] {
    return text.split('`').map((part, i) => ({ code: i % 2 === 1, text: part }));
  }

  async function refresh() {
    courseRow = (await get<Courses>('courses', bundle.course.slug)) ?? null;
    const chapters = new Map<string, Chapters>();
    const lessons = new Map<string, Lessons>();
    for (const chapter of bundle.chapters) {
      const chapterRow = await get<Chapters>('chapters', chapter.slug);
      if (chapterRow) chapters.set(chapter.slug, chapterRow);
      for (const slug of chapter.lessons) {
        const lessonRow = await get<Lessons>('lessons', slug);
        if (lessonRow) lessons.set(slug, lessonRow);
      }
    }
    chapterRows = chapters;
    lessonRows = lessons;
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
            Finished {new Date(courseRow.completed).toLocaleDateString()} — every lesson stays
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
            {continueTarget.chapter.title} · {totalDone}/{bundle.lessons.length} lessons done
          </p>
        </div>
        <a class="btn btn-primary" href={href(continueTarget.lesson.slug)}>
          {courseRow?.started ? 'Continue' : 'Start'}: {continueTarget.lesson.title} →
        </a>
      </div>
    {/if}

    {#each bundle.chapters as chapter, i (chapter.slug)}
      {@const done = chapterDone(chapter)}
      {@const chapterRow = chapterRows.get(chapter.slug)}
      <Card
        title={`${i + 1}. ${chapter.title}`}
        titleHref={enrolled ? href(chapter.slug) : undefined}
      >
        {#snippet actions()}
          {#if chapterRow?.completed}
            <span class="badge badge-done">✓ complete</span>
          {:else if done > 0}
            <span class="badge badge-active">{done}/{chapter.lessons.length}</span>
          {:else}
            <span class="badge">{chapter.lessons.length} lessons</span>
          {/if}
        {/snippet}
        <p class="muted chapter-desc">
          {#each inlineCode(chapter.description.trim()) as seg, j (j)}
            {#if seg.code}<code>{seg.text}</code>{:else}{seg.text}{/if}
          {/each}
        </p>
        <ol class="lesson-list">
          {#each chapter.lessons as slug (slug)}
            {@const lesson = lessonBySlug.get(slug)}
            {@const lessonRow = lessonRows.get(slug)}
            {#if lesson}
              <li>
                {#if enrolled}
                  <a href={href(slug)}>{lesson.title}</a>
                {:else}
                  <span>{lesson.title}</span>
                {/if}
                {#if lesson.kind === 'reading'}
                  <span class="badge">reading</span>
                {/if}
                {#if lessonRow?.completed}
                  <span class="badge badge-done">✓</span>
                {:else if lessonRow?.started}
                  <span class="badge badge-active">in progress</span>
                {/if}
              </li>
            {/if}
          {/each}
        </ol>
      </Card>
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
