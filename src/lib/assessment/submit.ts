/**
 * Result-endpoint submission. When a quiz/test declares a `result_endpoint`,
 * the graded submission is POSTed there as form data (multipart/form-data via
 * FormData) so a human can mark it — the use case is non-accredited settings
 * that want short/long answers evaluated by a person rather than a machine.
 *
 * NOT a security boundary: the correct answers are baked into the page (the
 * grader runs client-side), and the sender identity is whatever the visitor
 * typed into their profile. See the Course Development Guide.
 *
 * Identity travels as request headers (x-sender-name / x-sender-email) and is
 * duplicated into the body for receivers that prefer form fields. Custom
 * headers make this a CORS preflighted request — the receiving endpoint must
 * answer OPTIONS and allow these headers.
 */
import { effectiveOptions, type Question, type QuestionResponse, type Score } from './types';
import type { GradeOutcome } from './grade';
import type { Profile } from '../profile';

/** One question's response as human-readable text for the form body. */
export function responseText(question: Question, response: QuestionResponse): string {
  switch (question.type) {
    case 'multiple_choice': {
      const options = effectiveOptions(question);
      return typeof response === 'number' ? (options[response] ?? '') : '';
    }
    case 'true_false':
      return typeof response === 'boolean' ? (response ? 'True' : 'False') : '';
    case 'multi_select':
      return Array.isArray(response)
        ? response.map((i) => question.options[i] ?? '').join('; ')
        : '';
    case 'short_answer':
    case 'long_answer':
      return typeof response === 'string' ? response : '';
  }
}

export interface SubmissionMeta {
  kind: 'quiz' | 'test';
  slug: string; // content slug (course/chapter[/lesson])
  title: string;
}

/** Build the form body: metadata + score + one field triple per question. */
export function buildFormData(
  meta: SubmissionMeta,
  questions: Question[],
  responses: QuestionResponse[],
  outcome: GradeOutcome,
  profile: Profile
): FormData {
  const data = new FormData();
  data.set('kind', meta.kind);
  data.set('slug', meta.slug);
  data.set('title', meta.title);
  data.set('submitted_at', new Date().toISOString());
  data.set('score_correct', String(outcome.score.correct));
  data.set('score_gradable', String(outcome.score.gradable));
  data.set('sender_name', profile.name);
  data.set('sender_email', profile.email);
  questions.forEach((q, i) => {
    const n = i + 1;
    data.set(`q${n}_type`, q.type);
    data.set(`q${n}_prompt`, q.prompt);
    data.set(`q${n}_response`, responseText(q, responses[i] ?? null));
    const result = outcome.results[i];
    const label =
      result?.correct === null || result?.correct === undefined
        ? 'ungraded'
        : result.correct === false && (result.partial ?? 0) > 0
          ? `partial:${result.partial}`
          : String(result.correct);
    data.set(`q${n}_correct`, label);
  });
  return data;
}

/** Header values must be single-line; collapse anything a name could sneak in. */
const headerSafe = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

export async function postResults(
  endpoint: string,
  meta: SubmissionMeta,
  questions: Question[],
  responses: QuestionResponse[],
  outcome: GradeOutcome,
  profile: Profile
): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-sender-name': headerSafe(profile.name),
      'x-sender-email': headerSafe(profile.email),
    },
    body: buildFormData(meta, questions, responses, outcome, profile),
  });
  if (!response.ok) {
    throw new Error(`endpoint responded ${response.status} ${response.statusText}`);
  }
}

export type { Score };
