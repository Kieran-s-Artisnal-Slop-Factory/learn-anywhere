<script lang="ts">
  /**
   * The complete quiz/test form: a real <form> that renders every question,
   * tracks responses, grades on submit, and shows the score + per-question
   * feedback. Used by LessonApp (in-lesson quiz) and TestApp (full-page
   * chapter test); the parent persists the outcome via onSubmit and may pass
   * a previously stored submission back in to show it as already-graded.
   *
   * When the content declares a `result_endpoint`, the graded submission is
   * also POSTed there (form data + x-sender-name/x-sender-email headers) for
   * human marking — and submission is blocked until the visitor has set a
   * name and email in Settings, since the receiver needs to know who to
   * credit. Local grading/completion still happens even if the network send
   * fails (offline-first); a failed send can be retried.
   */
  import { onMount } from 'svelte';
  import { allAnswered, grade, percent, type GradeOutcome } from '../../lib/assessment/grade';
  import type { Question, QuestionResponse, Score } from '../../lib/assessment/types';
  import { postResults, type SubmissionMeta } from '../../lib/assessment/submit';
  import { getProfile, profileComplete, type Profile } from '../../lib/profile';
  import { href } from '../../lib/paths';
  import QuestionCard from './QuestionCard.svelte';

  let {
    questions,
    initialResponses = null,
    submitLabel = 'Submit answers',
    onSubmit,
    endpoint = null,
    meta = null,
  }: {
    questions: Question[];
    /** A stored past submission — when set, the form loads already graded. */
    initialResponses?: QuestionResponse[] | null;
    submitLabel?: string;
    /** Persist hook; called once per submission with answers + score. */
    onSubmit: (responses: QuestionResponse[], score: Score) => void | Promise<void>;
    /** result_endpoint from the content — enables the send-for-marking flow. */
    endpoint?: string | null;
    /** Required when endpoint is set: what the receiver sees. */
    meta?: SubmissionMeta | null;
  } = $props();

  let responses = $state<QuestionResponse[]>(
    initialResponses ? [...initialResponses] : questions.map(() => null)
  );
  let outcome = $state<GradeOutcome | null>(
    initialResponses ? grade(questions, initialResponses) : null
  );
  let triedIncomplete = $state(false);

  let profile = $state<Profile>({ name: '', email: '' });
  let profileReady = $state(false);
  let sendState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  let sendError = $state<string | null>(null);

  const graded = $derived(outcome !== null);
  const complete = $derived(allAnswered(questions, responses));
  const pct = $derived(outcome ? percent(outcome.score) : null);
  // Endpoint forms are locked until the visitor identifies themselves.
  const locked = $derived(endpoint != null && profileReady && !profileComplete(profile));

  onMount(() => {
    profile = getProfile();
    profileReady = true;
  });

  async function send(sent: QuestionResponse[], gradedOutcome: GradeOutcome) {
    if (!endpoint || !meta) return;
    sendState = 'sending';
    sendError = null;
    try {
      await postResults(endpoint, meta, questions, sent, gradedOutcome, profile);
      sendState = 'sent';
    } catch (err) {
      sendState = 'failed';
      sendError = err instanceof Error ? err.message : String(err);
    }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (graded || locked) return;
    if (!complete) {
      triedIncomplete = true;
      return;
    }
    const sent = $state.snapshot(responses) as QuestionResponse[];
    const result = grade(questions, sent);
    outcome = result;
    // Local persistence first — completion must survive a failed send.
    await onSubmit(sent, result.score);
    await send(sent, result);
  }

  function retrySend() {
    if (!outcome) return;
    void send($state.snapshot(responses) as QuestionResponse[], outcome);
  }

  function retake() {
    responses = questions.map(() => null);
    outcome = null;
    triedIncomplete = false;
    sendState = 'idle';
    sendError = null;
  }
</script>

<form class="assessment stack" onsubmit={submit} novalidate>
  {#if locked}
    <p class="banner banner-danger">
      This {meta?.kind ?? 'form'} sends your answers to the course team for marking, so your
      name and email must be set before submission — add them in
      <a href={href('/settings/')}>Settings</a>.
    </p>
  {:else if endpoint && !graded && profileReady}
    <p class="banner">
      Submitting sends your answers to the course team for review as
      <strong>{profile.name}</strong> ({profile.email}).
    </p>
  {/if}

  {#if graded && outcome}
    <p class="banner" class:banner-success={pct === null || pct >= 60} class:banner-warning={pct !== null && pct < 60}>
      {#if pct === null}
        Answers recorded.
      {:else}
        Score: <strong>{outcome.score.correct}/{outcome.score.gradable}</strong> ({pct}%)
        {#if outcome.score.gradable < questions.length}
          — written answers are recorded but not auto-graded.
        {/if}
      {/if}
    </p>
    {#if endpoint}
      {#if sendState === 'sending'}
        <p class="banner">Sending your answers for review…</p>
      {:else if sendState === 'sent'}
        <p class="banner banner-success">Your answers were sent to the course team for review.</p>
      {:else if sendState === 'failed'}
        <p class="banner banner-danger">
          Your results were saved locally, but sending them for review failed ({sendError}).
          <button type="button" class="btn btn-sm retry" onclick={retrySend}>Retry send</button>
        </p>
      {/if}
    {/if}
  {/if}

  <fieldset class="questions" disabled={locked}>
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
  </fieldset>

  <div class="row">
    {#if !graded}
      <button class="btn btn-primary" type="submit" disabled={locked}>{submitLabel}</button>
      {#if triedIncomplete && !complete}
        <span class="incomplete">Answer every question before submitting.</span>
      {/if}
    {:else}
      <button class="btn" type="button" onclick={retake}>Try again</button>
    {/if}
  </div>
</form>

<style>
  .questions {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
  }

  .questions:disabled {
    opacity: 0.6;
  }

  .incomplete {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    align-self: center;
  }

  .retry {
    margin-left: var(--space-2);
  }
</style>
