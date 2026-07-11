/**
 * Pure grading — (questions, responses) in, per-question results + score out.
 * No DOM or IndexedDB imports so it can be unit-tested directly
 * (grade.test.ts); the quiz/test islands call it and persist the outcome.
 */
import {
  correctIndex,
  type Question,
  type QuestionResponse,
  type QuestionResult,
  type Score,
} from './types';

export interface GradeOutcome {
  results: QuestionResult[];
  score: Score;
}

export interface GradeOptions {
  /**
   * Multi-select partial credit (the site-wide `partial_grades` setting):
   * each correct selection earns 1/total-correct, each wrong selection
   * cancels one out, floored at zero for the question.
   */
  partialGrades?: boolean;
}

function gradeOne(
  question: Question,
  response: QuestionResponse,
  options: GradeOptions
): QuestionResult {
  switch (question.type) {
    case 'short_answer':
    case 'long_answer':
      // Stored (and sent to the result endpoint, when one is configured)
      // but never machine-graded.
      return { correct: null, expected: null };
    case 'true_false':
      return {
        correct: typeof response === 'boolean' && response === question.answer,
        expected: question.answer,
      };
    case 'multiple_choice': {
      const expected = correctIndex(question);
      return { correct: response === expected, expected };
    }
    case 'multi_select': {
      const expected = [...question.answer].sort((a, b) => a - b);
      const got = Array.isArray(response) ? [...response].sort((a, b) => a - b) : null;
      const correct =
        got !== null && got.length === expected.length && got.every((v, i) => v === expected[i]);
      if (options.partialGrades && !correct) {
        const hits = got?.filter((v) => expected.includes(v)).length ?? 0;
        const misses = (got?.length ?? 0) - hits;
        const partial = Math.max(0, hits - misses) / expected.length;
        return { correct, expected, partial };
      }
      return { correct, expected };
    }
  }
}

/** A result's contribution to the score: 1, 0, or a partial fraction. */
function points(result: QuestionResult): number {
  if (result.correct === true) return 1;
  return result.partial ?? 0;
}

/** Grade a full submission. Unanswered gradable questions count as wrong. */
export function grade(
  questions: Question[],
  responses: QuestionResponse[],
  options: GradeOptions = {}
): GradeOutcome {
  const results = questions.map((q, i) => gradeOne(q, responses[i] ?? null, options));
  const gradable = results.filter((r) => r.correct !== null);
  // Round away float noise from summed fractions (e.g. 1/3 + 1/3 + 1/3).
  const correct = Math.round(gradable.reduce((sum, r) => sum + points(r), 0) * 100) / 100;
  return {
    results,
    score: {
      correct,
      gradable: gradable.length,
    },
  };
}

/** True when every question (short answers included) has a response. */
export function allAnswered(questions: Question[], responses: QuestionResponse[]): boolean {
  return questions.every((q, i) => {
    const r = responses[i] ?? null;
    if (r === null) return false;
    if (q.type === 'multi_select') return Array.isArray(r) && r.length > 0;
    if (q.type === 'short_answer' || q.type === 'long_answer') {
      return typeof r === 'string' && r.trim() !== '';
    }
    return true;
  });
}

/** Percentage helper for display; null when nothing was gradable. */
export function percent(score: Score): number | null {
  return score.gradable === 0 ? null : Math.round((score.correct / score.gradable) * 100);
}
