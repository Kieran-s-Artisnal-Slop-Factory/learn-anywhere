<script lang="ts">
  /**
   * The complete quiz/test form: renders every question, tracks responses,
   * grades on submit, and shows the score + per-question feedback. Used by
   * LessonApp (in-lesson quiz) and TestApp (full-page chapter test); the
   * parent persists the outcome via onSubmit and may pass a previously
   * stored submission back in to show it as already-graded.
   */
  import { allAnswered, grade, percent, type GradeOutcome } from '../../lib/assessment/grade';
  import type { Question, QuestionResponse, Score } from '../../lib/assessment/types';
  import QuestionCard from './QuestionCard.svelte';

  let {
    questions,
    initialResponses = null,
    submitLabel = 'Submit answers',
    onSubmit,
  }: {
    questions: Question[];
    /** A stored past submission — when set, the form loads already graded. */
    initialResponses?: QuestionResponse[] | null;
    submitLabel?: string;
    /** Persist hook; called once per submission with answers + score. */
    onSubmit: (responses: QuestionResponse[], score: Score) => void | Promise<void>;
  } = $props();

  let responses = $state<QuestionResponse[]>(
    initialResponses ? [...initialResponses] : questions.map(() => null)
  );
  let outcome = $state<GradeOutcome | null>(
    initialResponses ? grade(questions, initialResponses) : null
  );
  let triedIncomplete = $state(false);

  const graded = $derived(outcome !== null);
  const complete = $derived(allAnswered(questions, responses));
  const pct = $derived(outcome ? percent(outcome.score) : null);

  async function submit() {
    if (graded) return;
    if (!complete) {
      triedIncomplete = true;
      return;
    }
    const result = grade(questions, $state.snapshot(responses) as QuestionResponse[]);
    outcome = result;
    await onSubmit($state.snapshot(responses) as QuestionResponse[], result.score);
  }

  function retake() {
    responses = questions.map(() => null);
    outcome = null;
    triedIncomplete = false;
  }
</script>

<div class="assessment stack">
  {#if graded && outcome}
    <p class="banner" class:banner-success={pct === null || pct >= 60} class:banner-warning={pct !== null && pct < 60}>
      {#if pct === null}
        ✓ Answers recorded.
      {:else}
        Score: <strong>{outcome.score.correct}/{outcome.score.gradable}</strong> ({pct}%)
        {#if outcome.score.gradable < questions.length}
          — short answers are recorded but not graded.
        {/if}
      {/if}
    </p>
  {/if}

  {#each questions as question, i (i)}
    <QuestionCard
      {question}
      index={i}
      response={responses[i] ?? null}
      result={outcome?.results[i] ?? null}
      onRespond={(value) => {
        responses[i] = value;
        triedIncomplete = false;
      }}
    />
  {/each}

  <div class="row">
    {#if !graded}
      <button class="btn btn-primary" onclick={submit}>{submitLabel}</button>
      {#if triedIncomplete && !complete}
        <span class="incomplete">Answer every question before submitting.</span>
      {/if}
    {:else}
      <button class="btn" onclick={retake}>Try again</button>
    {/if}
  </div>
</div>

<style>
  .incomplete {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    align-self: center;
  }
</style>
