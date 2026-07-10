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

function gradeOne(question: Question, response: QuestionResponse): QuestionResult {
  switch (question.type) {
    case 'short_answer':
      // Stored, never verified.
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
      return { correct, expected };
    }
  }
}

/** Grade a full submission. Unanswered gradable questions count as wrong. */
export function grade(questions: Question[], responses: QuestionResponse[]): GradeOutcome {
  const results = questions.map((q, i) => gradeOne(q, responses[i] ?? null));
  const gradable = results.filter((r) => r.correct !== null);
  return {
    results,
    score: {
      correct: gradable.filter((r) => r.correct === true).length,
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
    if (q.type === 'short_answer') return typeof r === 'string' && r.trim() !== '';
    return true;
  });
}

/** Percentage helper for display; null when nothing was gradable. */
export function percent(score: Score): number | null {
  return score.gradable === 0 ? null : Math.round((score.correct / score.gradable) * 100);
}
