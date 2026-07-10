<script lang="ts">
  /**
   * One question, any type. Owns nothing — the parent form holds the
   * response array and passes this question's slot down; after grading the
   * per-question result drives the ✓/✗ feedback and correct-answer reveal.
   */
  import { effectiveOptions, type Question, type QuestionResponse, type QuestionResult } from '../../lib/assessment/types';

  let {
    question,
    index,
    response,
    result = null,
    onRespond,
  }: {
    question: Question;
    index: number; // 0-based position, shown as "Question N"
    response: QuestionResponse;
    result?: QuestionResult | null;
    onRespond: (value: QuestionResponse) => void;
  } = $props();

  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const graded = $derived(result !== null);

  const options = $derived(
    question.type === 'multiple_choice'
      ? effectiveOptions(question)
      : question.type === 'multi_select'
        ? question.options
        : []
  );

  function toggleMulti(idx: number) {
    const current = Array.isArray(response) ? response : [];
    onRespond(
      current.includes(idx) ? current.filter((v) => v !== idx) : [...current, idx].sort((a, b) => a - b)
    );
  }

  /** Feedback class for one option row after grading. */
  function optionState(idx: number): 'correct' | 'wrong' | null {
    if (!result) return null;
    if (question.type === 'multiple_choice') {
      if (idx === result.expected) return 'correct';
      if (idx === response && result.correct === false) return 'wrong';
    }
    if (question.type === 'multi_select' && Array.isArray(result.expected)) {
      const picked = Array.isArray(response) && response.includes(idx);
      if (result.expected.includes(idx)) return 'correct';
      if (picked) return 'wrong';
    }
    return null;
  }
</script>

<fieldset class="question" class:graded>
  <legend>
    <span class="q-number">Question {index + 1}</span>
    {#if graded && result?.correct !== null}
      <span class="badge" class:badge-done={result?.correct} class:badge-danger={!result?.correct}>
        {result?.correct ? '✓ correct' : '✗ incorrect'}
      </span>
    {:else if graded}
      <span class="badge">recorded</span>
    {/if}
  </legend>
  <p class="prompt">{question.prompt}</p>

  {#if question.type === 'multiple_choice'}
    <div class="options" role="radiogroup">
      {#each options as option, i (i)}
        <label class="option" class:correct={optionState(i) === 'correct'} class:wrong={optionState(i) === 'wrong'}>
          <input
            type="radio"
            name={`q-${index}`}
            checked={response === i}
            disabled={graded}
            onchange={() => onRespond(i)}
          />
          <span class="letter">{letters[i]})</span>
          <span>{option}</span>
        </label>
      {/each}
    </div>
  {:else if question.type === 'true_false'}
    <div class="options" role="radiogroup">
      {#each [true, false] as value (value)}
        <label
          class="option"
          class:correct={graded && result?.expected === value}
          class:wrong={graded && response === value && result?.correct === false}
        >
          <input
            type="radio"
            name={`q-${index}`}
            checked={response === value}
            disabled={graded}
            onchange={() => onRespond(value)}
          />
          <span>{value ? 'True' : 'False'}</span>
        </label>
      {/each}
    </div>
  {:else if question.type === 'multi_select'}
    <p class="muted hint">Select all that apply.</p>
    <div class="options">
      {#each options as option, i (i)}
        <label class="option" class:correct={optionState(i) === 'correct'} class:wrong={optionState(i) === 'wrong'}>
          <input
            type="checkbox"
            checked={Array.isArray(response) && response.includes(i)}
            disabled={graded}
            onchange={() => toggleMulti(i)}
          />
          <span>{option}</span>
        </label>
      {/each}
    </div>
  {:else if question.type === 'short_answer'}
    <p class="muted hint">Your answer is saved for your own review — it isn't graded.</p>
    <textarea
      rows="3"
      placeholder="Type your answer…"
      disabled={graded}
      value={typeof response === 'string' ? response : ''}
      oninput={(e) => onRespond((e.target as HTMLTextAreaElement).value)}
    ></textarea>
  {/if}
</fieldset>

<style>
  .question {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4) var(--space-4);
    margin: 0;
    background: var(--surface-color);
  }

  legend {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-2);
  }

  .q-number {
    font-weight: 700;
    font-size: var(--font-size-sm);
    color: var(--text-muted-color);
  }

  .prompt {
    font-weight: 600;
    margin-bottom: var(--space-3);
  }

  .hint {
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-2);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .option {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .question:not(.graded) .option:hover {
    border-color: var(--color-primary);
  }

  .graded .option {
    cursor: default;
  }

  .option.correct {
    border-color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
  }

  .option.wrong {
    border-color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  }

  .letter {
    font-weight: 700;
    color: var(--text-muted-color);
  }

  .badge-danger {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  textarea {
    width: 100%;
    resize: vertical;
    background: var(--surface-raised-color, var(--surface-color));
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font: inherit;
  }
</style>
