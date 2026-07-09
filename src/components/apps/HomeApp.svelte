<script lang="ts">
  /**
   * Homepage progress dashboard: completion stats, in-progress items with
   * quick links, and recently completed lessons/chapters/courses.
   * Everything is read from IndexedDB — slugs are path ids, so they double
   * as the URL path under /courses/.
   *
   * Renders NOTHING when the visitor isn't enrolled in any course — the
   * static intro in index.astro is the whole homepage in that case.
   */
  import { onMount } from 'svelte';
  import { all } from '../../lib/db/repo';
  import type { Chapters, Courses, Lessons } from '../../lib/db/types';
  import { href } from '../../lib/paths';

  interface Item {
    kind: 'lesson' | 'chapter' | 'course';
    title: string;
    context: string; // course / chapter it belongs to
    href: string;
    when: string; // ISO timestamp (completed or started)
  }

  let loading = $state(true);
  let stats = $state({ lessons: 0, chapters: 0, courses: 0 });
  let inProgress = $state<Item[]>([]);
  let recentlyCompleted = $state<Item[]>([]);
  let hasAnything = $state(false);

  onMount(async () => {
    const [courses, chapters, lessons] = await Promise.all([
      all<Courses>('courses'),
      all<Chapters>('chapters'),
      all<Lessons>('lessons'),
    ]);
    hasAnything = courses.length > 0;

    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    // A lesson's chapter id is its own id minus the last path segment.
    const chapterOfLesson = (lesson: Lessons) =>
      chapterById.get(lesson.id.split('/').slice(0, -1).join('/'));

    stats = {
      lessons: lessons.filter((l) => l.completed).length,
      chapters: chapters.filter((c) => c.completed).length,
      courses: courses.filter((c) => c.completed).length,
    };

    const progress: Item[] = [];
    for (const lesson of lessons) {
      if (lesson.started && !lesson.completed) {
        progress.push({
          kind: 'lesson',
          title: lesson.title,
          context: chapterOfLesson(lesson)?.title ?? '',
          href: href(`/courses/${lesson.id}/`),
          when: lesson.started,
        });
      }
    }
    for (const course of courses) {
      if (course.started && !course.completed) {
        progress.push({
          kind: 'course',
          title: course.title,
          context: `${course.chapters.filter((slug) => chapters.find((c) => c.id === slug)?.completed).length}/${course.chapters.length} chapters done`,
          href: href(`/courses/${course.id}/`),
          when: course.started,
        });
      }
    }
    inProgress = progress.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 6);

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const completedItems: Item[] = [];
    for (const lesson of lessons) {
      if (!lesson.completed) continue;
      completedItems.push({
        kind: 'lesson',
        title: lesson.title,
        context: chapterOfLesson(lesson)?.title ?? '',
        href: href(`/courses/${lesson.id}/`),
        when: lesson.completed,
      });
    }
    for (const chapter of chapters) {
      if (!chapter.completed) continue;
      completedItems.push({
        kind: 'chapter',
        title: chapter.title,
        context: courseById.get(chapter.id.split('/')[0]!)?.title ?? '',
        href: href(`/courses/${chapter.id}/`),
        when: chapter.completed,
      });
    }
    for (const course of courses) {
      if (!course.completed) continue;
      completedItems.push({
        kind: 'course',
        title: course.title,
        context: `${course.chapters.length} chapters`,
        href: href(`/courses/${course.id}/`),
        when: course.completed,
      });
    }
    recentlyCompleted = completedItems.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8);

    loading = false;
  });

  const kindLabel: Record<Item['kind'], string> = {
    lesson: 'lesson',
    chapter: 'chapter',
    course: 'course',
  };
</script>

{#if !loading && hasAnything}
  <div class="stack">
    <div class="tiles">
      <div class="tile">
        <span class="count">{stats.lessons}</span>
        <span class="label">lessons completed</span>
      </div>
      <div class="tile">
        <span class="count">{stats.chapters}</span>
        <span class="label">chapters completed</span>
      </div>
      <div class="tile">
        <span class="count">{stats.courses}</span>
        <span class="label">courses completed</span>
      </div>
    </div>

    {#if inProgress.length > 0}
      <section>
        <h2 class="section-title">In progress</h2>
        <ul class="item-list">
          {#each inProgress as item (item.href)}
            <li>
              <a class="item" href={item.href}>
                <span class="badge badge-active">{kindLabel[item.kind]}</span>
                <span class="item-title">{item.title}</span>
                <span class="muted item-context">{item.context}</span>
                <span class="item-go">→</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if recentlyCompleted.length > 0}
      <section>
        <h2 class="section-title">Recently completed</h2>
        <ul class="item-list">
          {#each recentlyCompleted as item (item.kind + item.href)}
            <li>
              <a class="item" href={item.href}>
                <span class="badge badge-done">{kindLabel[item.kind]}</span>
                <span class="item-title">{item.title}</span>
                <span class="muted item-context">{item.context}</span>
                <span class="muted item-when">{new Date(item.when).toLocaleDateString()}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if inProgress.length === 0 && recentlyCompleted.length === 0}
      <p class="muted">
        You're enrolled but haven't started an exercise yet —
        <a href={href('/courses/')}>jump into a course</a>.
      </p>
    {/if}
  </div>
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
  }

  .count {
    font-size: var(--font-size-2xl);
    font-weight: 800;
    color: var(--color-primary-strong);
  }

  .label {
    font-weight: 600;
    color: var(--text-muted-color);
    font-size: var(--font-size-sm);
  }

  .section-title {
    font-size: var(--font-size-lg);
    margin-bottom: var(--space-3);
    color: var(--gb-yellow);
  }

  .section-title::before {
    content: '## ';
    color: var(--text-muted-color);
  }

  .item-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--surface-color);
    text-decoration: none;
    color: var(--text-color);
  }

  .item:hover {
    border-color: var(--color-primary);
    color: var(--text-color);
  }

  .item-title {
    font-weight: 600;
  }

  .item-context {
    font-size: var(--font-size-sm);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-when,
  .item-go {
    font-size: var(--font-size-sm);
    margin-left: auto;
    flex-shrink: 0;
  }

  .item-context + .item-when,
  .item-context + .item-go {
    margin-left: 0;
  }
</style>
