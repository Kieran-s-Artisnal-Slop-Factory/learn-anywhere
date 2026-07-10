/**
 * The question model shared by quizzes (inside a lesson) and tests (end of a
 * chapter). Questions are authored in frontmatter, validated by the content
 * collections (content.config.ts mirrors these shapes in Zod), and graded
 * client-side by grade.ts.
 *
 * Four question types:
 *  - multiple_choice — 2–5 authored options rendered a–e; "All of the above"
 *    and "None of the above" can each be enabled per question and are
 *    appended after the authored options.
 *  - true_false
 *  - multi_select — checkboxes; the answer is the exact set of correct options
 *  - short_answer — one line of free text, stored but never graded (not
 *    counted in the score)
 *  - long_answer — multi-line free text, same non-grading rules as
 *    short_answer; meant for quizzes/tests that are sent to a result
 *    endpoint for human marking
 */

/**
 * Prompts are authored as markdown (glossary [[refs]] included). The build
 * renders each one to HTML (bundle.ts) and attaches it as `prompt_html`;
 * the raw `prompt` remains the plain-text source — it's what result-endpoint
 * submissions send. Options are always plain text.
 */
export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  prompt: string;
  prompt_html?: string;
  /** Authored options, rendered with a–e labels. */
  options: string[];
  /** Append an "All of the above" option after the authored ones. */
  all_of_the_above?: boolean;
  /** Append a "None of the above" option last. */
  none_of_the_above?: boolean;
  /** Index into the authored options, or 'all' / 'none' for the appended ones. */
  answer: number | 'all' | 'none';
}

export interface TrueFalseQuestion {
  type: 'true_false';
  prompt: string;
  prompt_html?: string;
  answer: boolean;
}

export interface MultiSelectQuestion {
  type: 'multi_select';
  prompt: string;
  prompt_html?: string;
  options: string[];
  /** Indices of every correct option — the response must match the set exactly. */
  answer: number[];
}

export interface ShortAnswerQuestion {
  type: 'short_answer';
  prompt: string;
  prompt_html?: string;
}

export interface LongAnswerQuestion {
  type: 'long_answer';
  prompt: string;
  prompt_html?: string;
}

export type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | MultiSelectQuestion
  | ShortAnswerQuestion
  | LongAnswerQuestion;

/**
 * One response per question, by position. `null` = unanswered.
 *  - multiple_choice: index into the EFFECTIVE option list (authored + all/none)
 *  - true_false: boolean
 *  - multi_select: selected indices
 *  - short_answer / long_answer: the entered text
 */
export type QuestionResponse = number | boolean | number[] | string | null;

/** A graded submission. Short/long answers are recorded but never gradable. */
export interface Score {
  correct: number;
  gradable: number;
}

/** Per-question grading outcome; `correct: null` = not gradable (short answer). */
export interface QuestionResult {
  correct: boolean | null;
  /** Index of the right choice in the effective option list, where applicable. */
  expected: number | boolean | number[] | null;
}

/**
 * The full option list as rendered: authored options plus the enabled
 * "All of the above" / "None of the above" entries. Responses index into this.
 */
export function effectiveOptions(q: MultipleChoiceQuestion): string[] {
  const opts = [...q.options];
  if (q.all_of_the_above) opts.push('All of the above');
  if (q.none_of_the_above) opts.push('None of the above');
  return opts;
}

/** The correct index in the effective option list. */
export function correctIndex(q: MultipleChoiceQuestion): number {
  if (q.answer === 'all') return q.options.length;
  if (q.answer === 'none') return q.options.length + (q.all_of_the_above ? 1 : 0);
  return q.answer;
}
