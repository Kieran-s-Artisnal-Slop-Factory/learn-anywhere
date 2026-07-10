<script lang="ts">
  /**
   * Course listing: static course facts baked in at build time, decorated
   * with the visitor's cached progress from IndexedDB. Enrolled courses get
   * a performance overview — lessons done, quiz/test average, and per-source
   * breakdown — aggregated from the stored scores.
   */
  import { onMount } from 'svelte';
  import { percent } from '../../lib/assessment/grade';
  import { all } from '../../lib/db/repo';
  import type { Chapters, Courses, Lessons } from '../../lib/db/types';
  import Card from '../Card.svelte';
  import { href } from '../../lib/paths';

  interface CourseCard {
    slug: string;
    title: string;
    blurb: string;
    chapterCount: number;
    lessonCount: number;
  }

  interface Performance {
    lessonsDone: number;
    quizzesTaken: number;
    testsTaken: number;
    testTotal: number;
    /** Combined quiz+test percentage over everything gradable, null until something is graded. */
    averagePct: number | null;
    quizPct: number | null;
    testPct: number | null;
  }

  let { courses = [] }: { courses?: CourseCard[] } = $props();

  let rows: Courses[] = $state([]);
  let performance = $state<Map<string, Performance>>(new Map());

  const rowFor = (slug: string) => rows.find((r) => r.id === slug);

  onMount(async () => {
    const [courseRows, chapterRows, lessonRows] = await Promise.all([
      all<Courses>('courses'),
      all<Chapters>('chapters'),
      all<Lessons>('lessons'),
    ]);
    rows = courseRows;

    const perf = new Map<string, Performance>();
    for (const course of courseRows) {
      // Slugs are path ids, so children live under `<course-slug>/`.
      const inCourse = (id: string) => id.startsWith(course.id + '/');
      const lessons = lessonRows.filter((l) => inCourse(l.id));
      const chapters = chapterRows.filter((c) => inCourse(c.id));

      let quizCorrect = 0;
      let quizGradable = 0;
      let quizzesTaken = 0;
      for (const lesson of lessons) {
        if (!lesson.quiz_score) continue;
        quizzesTaken++;
        quizCorrect += lesson.quiz_score.correct;
        quizGradable += lesson.quiz_score.gradable;
      }
      let testCorrect = 0;
      let testGradable = 0;
      let testsTaken = 0;
      for (const chapter of chapters) {
        if (!chapter.test_score) continue;
        testsTaken++;
        testCorrect += chapter.test_score.correct;
        testGradable += chapter.test_score.gradable;
      }

      perf.set(course.id, {
        lessonsDone: lessons.filter((l) => l.completed).length,
        quizzesTaken,
        testsTaken,
        testTotal: chapters.filter((c) => (c.test?.length ?? 0) > 0).length,
        averagePct: percent({ correct: quizCorrect + testCorrect, gradable: quizGradable + testGradable }),
        quizPct: percent({ correct: quizCorrect, gradable: quizGradable }),
        testPct: percent({ correct: testCorrect, gradable: testGradable }),
      });
    }
    performance = perf;
  });
</script>

<div class="page-header">
  <h1>Courses</h1>
</div>

<div class="stack">
  {#each courses as course (course.slug)}
    {@const row = rowFor(course.slug)}
    {@const perf = performance.get(course.slug)}
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

      {#if row && perf}
        <div class="perf">
          <div class="stat">
            <span class="stat-value">{perf.lessonsDone}/{course.lessonCount}</span>
            <span class="stat-label">lessons done</span>
          </div>
          <div class="stat">
            <span class="stat-value">{perf.averagePct === null ? '—' : `${perf.averagePct}%`}</span>
            <span class="stat-label">overall score</span>
          </div>
          <div class="stat">
            <span class="stat-value">{perf.quizPct === null ? '—' : `${perf.quizPct}%`}</span>
            <span class="stat-label">{perf.quizzesTaken} quiz{perf.quizzesTaken === 1 ? '' : 'zes'}</span>
          </div>
          {#if perf.testTotal > 0}
            <div class="stat">
              <span class="stat-value">{perf.testPct === null ? '—' : `${perf.testPct}%`}</span>
              <span class="stat-label">{perf.testsTaken}/{perf.testTotal} tests</span>
            </div>
          {/if}
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow={perf.lessonsDone} aria-valuemin="0" aria-valuemax={course.lessonCount}>
          <div class="progress-fill" style={`width: ${course.lessonCount === 0 ? 0 : Math.round((perf.lessonsDone / course.lessonCount) * 100)}%`}></div>
        </div>
      {/if}

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

  .perf {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .stat {
    display: flex;
    flex-direction: column;
    min-width: 6rem;
  }

  .stat-value {
    font-weight: 800;
    font-size: var(--font-size-lg);
    color: var(--color-primary-strong);
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-muted-color);
    font-weight: 600;
  }

  .progress-track {
    height: 0.5rem;
    border-radius: var(--radius-full);
    background: var(--surface-raised-color);
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }

  .progress-fill {
    height: 100%;
    background: var(--color-success);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }
</style>
