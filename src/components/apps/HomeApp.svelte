<script lang="ts">
  /**
   * Dashboard homepage: completion stats, in-progress items with quick links,
   * and recently completed exercises/chapters/courses. Everything is read
   * from IndexedDB — links are reconstructed from the parent-holds-children
   * arrays (courses.chapters[] / chapters.exercises[]).
   */
  import { onMount } from 'svelte';
  import { all } from '../../lib/db/repo';
  import type { Chapters, Courses, Exercises } from '../../lib/db/types';

  interface Item {
    kind: 'exercise' | 'chapter' | 'course';
    title: string;
    context: string; // course / chapter it belongs to
    href: string;
    when: string; // ISO timestamp (completed or started)
  }

  let loading = $state(true);
  let stats = $state({ exercises: 0, chapters: 0, courses: 0 });
  let inProgress = $state<Item[]>([]);
  let recentlyCompleted = $state<Item[]>([]);
  let hasAnything = $state(false);

  onMount(async () => {
    const [courses, chapters, exercises] = await Promise.all([
      all<Courses>('courses'),
      all<Chapters>('chapters'),
      all<Exercises>('exercises'),
    ]);
    hasAnything = courses.length > 0;

    // slug → parent maps, from the ordered children arrays
    const chapterOfExercise = new Map<string, Chapters>();
    for (const chapter of chapters) {
      for (const slug of chapter.exercises) chapterOfExercise.set(slug, chapter);
    }
    const courseOfChapter = new Map<string, Courses>();
    for (const course of courses) {
      for (const slug of course.chapters) courseOfChapter.set(slug, course);
    }

    const exerciseHref = (exercise: Exercises): string | null => {
      const chapter = chapterOfExercise.get(exercise.id);
      const course = chapter && courseOfChapter.get(chapter.id);
      return course ? `/courses/${course.id}/${chapter.id}/${exercise.id}/` : null;
    };
    const chapterHref = (chapter: Chapters): string | null => {
      const course = courseOfChapter.get(chapter.id);
      return course ? `/courses/${course.id}/#${chapter.id}` : null;
    };

    stats = {
      exercises: exercises.filter((e) => e.completed).length,
      chapters: chapters.filter((c) => c.completed).length,
      courses: courses.filter((c) => c.completed).length,
    };

    const progress: Item[] = [];
    for (const exercise of exercises) {
      if (exercise.started && !exercise.completed) {
        const href = exerciseHref(exercise);
        const chapter = chapterOfExercise.get(exercise.id);
        if (href) {
          progress.push({
            kind: 'exercise',
            title: exercise.title,
            context: chapter?.title ?? '',
            href,
            when: exercise.started,
          });
        }
      }
    }
    for (const course of courses) {
      if (course.started && !course.completed) {
        progress.push({
          kind: 'course',
          title: course.title,
          context: `${course.chapters.filter((slug) => chapters.find((c) => c.id === slug)?.completed).length}/${course.chapters.length} chapters done`,
          href: `/courses/${course.id}/`,
          when: course.started,
        });
      }
    }
    inProgress = progress.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 6);

    const completedItems: Item[] = [];
    for (const exercise of exercises) {
      if (!exercise.completed) continue;
      const href = exerciseHref(exercise);
      const chapter = chapterOfExercise.get(exercise.id);
      if (href) {
        completedItems.push({
          kind: 'exercise',
          title: exercise.title,
          context: chapter?.title ?? '',
          href,
          when: exercise.completed,
        });
      }
    }
    for (const chapter of chapters) {
      if (!chapter.completed) continue;
      const href = chapterHref(chapter);
      const course = courseOfChapter.get(chapter.id);
      if (href) {
        completedItems.push({
          kind: 'chapter',
          title: chapter.title,
          context: course?.title ?? '',
          href,
          when: chapter.completed,
        });
      }
    }
    for (const course of courses) {
      if (!course.completed) continue;
      completedItems.push({
        kind: 'course',
        title: course.title,
        context: `${course.chapters.length} chapters`,
        href: `/courses/${course.id}/`,
        when: course.completed,
      });
    }
    recentlyCompleted = completedItems.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8);

    loading = false;
  });

  const kindLabel: Record<Item['kind'], string> = {
    exercise: 'exercise',
    chapter: 'chapter',
    course: 'course',
  };
</script>

<div class="page-header">
  <h1>lite-learner</h1>
  <a class="btn" href="/courses/">Browse courses →</a>
</div>

{#if loading}
  <p class="muted">Loading…</p>
{:else if !hasAnything}
  <div class="hero">
    <h2>Learn SQL by writing it.</h2>
    <p class="muted">
      Every exercise runs against a real SQLite database in your browser. Enroll in a course and
      your progress stays on this device — no account, works offline.
    </p>
    <a class="btn btn-primary" href="/courses/">Browse courses</a>
  </div>
{:else}
  <div class="stack">
    <div class="tiles">
      <div class="tile">
        <span class="count">{stats.exercises}</span>
        <span class="label">exercises completed</span>
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
        <a href="/courses/">jump into a course</a>.
      </p>
    {/if}
  </div>
{/if}

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-6) 0;
    max-width: 40rem;
  }

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
