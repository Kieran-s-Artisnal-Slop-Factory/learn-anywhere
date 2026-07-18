<script lang="ts">
  /**
   * The chapter test island — the whole interactive body of the full-page
   * /courses/<course>/<chapter>/test/ route. Submitting stores responses +
   * score on the chapter row, stamps test_completed (first time), and lets
   * the chapter/course completion cascade run. Retakes overwrite the stored
   * submission; the completion gate stays open once passed through.
   */
  import { onMount } from 'svelte';
  import type { QuestionResponse, Score } from '../../lib/assessment/types';
  import { percent } from '../../lib/assessment/grade';
  import type { ChapterContent, CourseContent } from '../../lib/content/types';
  import { syncChapter, syncCourse } from '../../lib/content/sync';
  import { markChapterOpened, markTestCompleted } from '../../lib/progress';
  import { put } from '../../lib/db/repo';
  import type { Chapters } from '../../lib/db/types';
  import AssessmentForm from './AssessmentForm.svelte';
  import DatabaseExercise from '../exercise/DatabaseExercise.svelte';
  import WebExercise from '../exercise/WebExercise.svelte';

  let {
    course,
    chapter,
  }: {
    course: CourseContent;
    chapter: ChapterContent;
  } = $props();

  let row: Chapters | null = $state(null);
  let booting = $state(true);
  let bootError = $state<string | null>(null);

  const taken = $derived(row?.test_completed != null);
  const storedPct = $derived(row?.test_score ? percent(row.test_score) : null);

  async function onTestSubmit(responses: QuestionResponse[], score: Score) {
    if (!row) return;
    const saved = await put<Chapters>('chapters', {
      ...($state.snapshot(row) as Chapters),
      test_responses: responses,
      test_score: score,
    });
    row = await markTestCompleted(course.slug, saved);
  }

  /** Database test: persist the SQL buffer on the chapter row ('' clears). */
  async function saveTestSolution(sqlText: string) {
    if (!row) return;
    row = await put<Chapters>('chapters', {
      ...($state.snapshot(row) as Chapters),
      test_solution: sqlText === '' ? null : sqlText,
    });
  }

  /** Code test (database check pass / web submit) — stamps test_completed. */
  async function completeCodeTest() {
    if (!row) return;
    row = await markTestCompleted(course.slug, $state.snapshot(row) as Chapters);
  }

  /** Web test: persist the three tab buffers on the chapter row. */
  async function saveWebTestSolution(buffers: Record<string, string>) {
    if (!row) return;
    row = await put<Chapters>('chapters', {
      ...($state.snapshot(row) as Chapters),
      test_solution: buffers,
    });
  }

  onMount(async () => {
    try {
      await syncCourse($state.snapshot(course));
      row = await syncChapter($state.snapshot(chapter));
      await markChapterOpened(course.slug, chapter.slug);
    } catch (err) {
      bootError = err instanceof Error ? err.message : String(err);
    } finally {
      booting = false;
    }
  });
</script>

<div class="stack">
  {#if bootError}
    <p class="banner banner-danger">Failed to load the test: {bootError}</p>
  {/if}

  {#if taken}
    <p class="banner banner-success">
      ✓ Test taken{row?.test_completed ? ` ${new Date(row.test_completed).toLocaleDateString()}` : ''}{storedPct !==
      null
        ? ` — last score ${row?.test_score?.correct}/${row?.test_score?.gradable} (${storedPct}%).`
        : '.'}
      Retaking updates your recorded score.
    </p>
  {/if}

  {#if booting}
    <p class="muted">Loading…</p>
  {:else if chapter.test_database}
    <DatabaseExercise
      block={chapter.test_database}
      initialSolution={typeof row?.test_solution === 'string' ? row.test_solution : null}
      completed={taken}
      onSave={saveTestSolution}
      onPass={completeCodeTest}
      onMarkDone={completeCodeTest}
      endpoint={chapter.result_endpoint ?? null}
      meta={{ kind: 'test', slug: chapter.slug, title: chapter.title }}
    />
  {:else if chapter.test_web}
    <WebExercise
      block={chapter.test_web}
      initialSolution={row?.test_solution != null && typeof row.test_solution === 'object'
        ? (row.test_solution as Record<string, string>)
        : null}
      completed={taken}
      onSave={saveWebTestSolution}
      onSubmit={completeCodeTest}
      endpoint={chapter.result_endpoint ?? null}
      meta={{ kind: 'test', slug: chapter.slug, title: chapter.title }}
      wide={true}
      exportName={`${chapter.slug.split('/').pop() ?? 'test'}-test`}
    />
  {:else if chapter.test}
    <AssessmentForm
      questions={chapter.test}
      initialResponses={row?.test_responses ?? null}
      submitLabel="Submit test"
      onSubmit={onTestSubmit}
      endpoint={chapter.result_endpoint ?? null}
      meta={{ kind: 'test', slug: chapter.slug, title: chapter.title }}
    />
  {/if}
</div>
