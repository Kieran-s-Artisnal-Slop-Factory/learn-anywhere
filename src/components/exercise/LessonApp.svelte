<script lang="ts">
  /**
   * The interactive half of a lesson page, branching on the lesson's kind:
   *
   *  - EXERCISE (quiz present): the quiz form; submitting it (any score)
   *    completes the lesson and records responses + score. Retakes are
   *    allowed and overwrite the stored submission.
   *  - READING: just a "Mark as read" button.
   *
   * On load: sync the content rows this page touches (content-hash flow),
   * stamp started, and restore a past quiz submission as already-graded.
   */
  import { onMount } from 'svelte';
  import type { QuestionResponse, Score } from '../../lib/assessment/types';
  import { percent } from '../../lib/assessment/grade';
  import type { ChapterContent, CourseContent, LessonContent } from '../../lib/content/types';
  import { syncChapter, syncCourse, syncLesson } from '../../lib/content/sync';
  import { markLessonCompleted, markLessonOpened } from '../../lib/progress';
  import { put } from '../../lib/db/repo';
  import type { Lessons } from '../../lib/db/types';
  import Card from '../Card.svelte';
  import AssessmentForm from '../assessment/AssessmentForm.svelte';
  import DatabaseExercise from './DatabaseExercise.svelte';

  let {
    course,
    chapter,
    lesson,
  }: {
    course: CourseContent;
    chapter: ChapterContent;
    lesson: LessonContent;
  } = $props();

  const isExercise = lesson.kind === 'exercise' && (lesson.quiz?.length ?? 0) > 0;

  let row: Lessons | null = $state(null);
  let booting = $state(true);
  let bootError = $state<string | null>(null);

  const completed = $derived(row?.completed != null);
  const storedPct = $derived(row?.quiz_score ? percent(row.quiz_score) : null);

  async function onQuizSubmit(responses: QuestionResponse[], score: Score) {
    if (!row) return;
    const saved = await put<Lessons>('lessons', {
      ...($state.snapshot(row) as Lessons),
      quiz_responses: responses,
      quiz_score: score,
    });
    row = await markLessonCompleted(course.slug, chapter.slug, saved);
  }

  /** Reading-lesson completion: deliberate, not on mere page load. */
  async function markAsRead() {
    if (!row) return;
    row = await markLessonCompleted(course.slug, chapter.slug, $state.snapshot(row) as Lessons);
  }

  /** Database exercise: persist the SQL buffer ('' clears). */
  async function saveSolution(sqlText: string) {
    if (!row) return;
    row = await put<Lessons>('lessons', {
      ...($state.snapshot(row) as Lessons),
      solution: sqlText === '' ? null : sqlText,
    });
  }

  /** Database exercise: a passing check (or sandbox mark-done) completes. */
  async function completeLesson() {
    if (!row) return;
    row = await markLessonCompleted(course.slug, chapter.slug, $state.snapshot(row) as Lessons);
  }

  onMount(async () => {
    try {
      await syncCourse($state.snapshot(course));
      await syncChapter($state.snapshot(chapter));
      const synced = await syncLesson($state.snapshot(lesson));
      row = await markLessonOpened(course.slug, chapter.slug, synced);
    } catch (err) {
      bootError = err instanceof Error ? err.message : String(err);
    } finally {
      booting = false;
    }
  });
</script>

<div class="stack">
  {#if bootError}
    <p class="banner banner-danger">Failed to start the lesson: {bootError}</p>
  {/if}

  {#if completed}
    <p class="banner banner-success">
      ✓ Completed{row?.completed ? ` ${new Date(row.completed).toLocaleDateString()}` : ''}{isExercise &&
      storedPct !== null
        ? ` — last score ${row?.quiz_score?.correct}/${row?.quiz_score?.gradable} (${storedPct}%).`
        : '.'}
    </p>
  {/if}

  {#if lesson.kind === 'database' && lesson.database}
    {#if booting}
      <p class="muted">Loading…</p>
    {:else}
      <DatabaseExercise
        block={lesson.database}
        initialSolution={typeof row?.solution === 'string' ? row.solution : null}
        {completed}
        onSave={saveSolution}
        onPass={completeLesson}
        onMarkDone={completeLesson}
        endpoint={lesson.result_endpoint ?? null}
        meta={{ kind: 'quiz', slug: lesson.slug, title: lesson.title }}
      />
    {/if}
  {:else if lesson.kind === 'web'}
    <!-- Transitional: the web exercise island lands in Web Phase 1. -->
    <p class="banner banner-warning">
      This lesson uses the <strong>web</strong> exercise type, which isn't implemented yet.
    </p>
  {:else if isExercise && lesson.quiz}
    <Card title="Quiz">
      {#snippet actions()}
        <span class="muted count">{lesson.quiz.length} question{lesson.quiz.length === 1 ? '' : 's'}</span>
      {/snippet}
      {#if booting}
        <p class="muted">Loading…</p>
      {:else}
        <AssessmentForm
          questions={lesson.quiz}
          initialResponses={row?.quiz_responses ?? null}
          submitLabel="Submit quiz"
          onSubmit={onQuizSubmit}
          endpoint={lesson.result_endpoint ?? null}
          meta={{ kind: 'quiz', slug: lesson.slug, title: lesson.title }}
        />
      {/if}
    </Card>
  {:else if !completed}
    <div class="row">
      <button class="btn btn-primary" onclick={markAsRead} disabled={booting}>
        Mark as read
      </button>
    </div>
  {/if}
</div>

<style>
  .count {
    font-size: var(--font-size-sm);
  }
</style>
