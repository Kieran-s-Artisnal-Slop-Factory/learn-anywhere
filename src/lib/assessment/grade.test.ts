import { describe, expect, it } from 'vitest';
import { allAnswered, grade, percent } from './grade';
import { correctIndex, effectiveOptions, type Question } from './types';

const mc = (over: Partial<Extract<Question, { type: 'multiple_choice' }>> = {}): Question => ({
  type: 'multiple_choice',
  prompt: 'Pick one',
  options: ['a', 'b', 'c'],
  answer: 1,
  ...over,
});

describe('effectiveOptions / correctIndex', () => {
  it('returns authored options untouched by default', () => {
    const q = mc();
    expect(effectiveOptions(q as never)).toEqual(['a', 'b', 'c']);
    expect(correctIndex(q as never)).toBe(1);
  });

  it('appends All of the above when enabled', () => {
    const q = mc({ all_of_the_above: true, answer: 'all' });
    expect(effectiveOptions(q as never)).toEqual(['a', 'b', 'c', 'All of the above']);
    expect(correctIndex(q as never)).toBe(3);
  });

  it('appends None of the above last, after All', () => {
    const q = mc({ all_of_the_above: true, none_of_the_above: true, answer: 'none' });
    expect(effectiveOptions(q as never)).toEqual([
      'a',
      'b',
      'c',
      'All of the above',
      'None of the above',
    ]);
    expect(correctIndex(q as never)).toBe(4);
  });

  it('handles none without all', () => {
    const q = mc({ none_of_the_above: true, answer: 'none' });
    expect(correctIndex(q as never)).toBe(3);
  });
});

describe('grade', () => {
  it('grades multiple choice by effective index', () => {
    const { results, score } = grade([mc()], [1]);
    expect(results[0]).toEqual({ correct: true, expected: 1 });
    expect(score).toEqual({ correct: 1, gradable: 1 });
  });

  it('grades the appended all/none options', () => {
    const q = mc({ all_of_the_above: true, answer: 'all' });
    expect(grade([q], [3]).score.correct).toBe(1);
    expect(grade([q], [0]).score.correct).toBe(0);
  });

  it('grades true/false strictly on booleans', () => {
    const q: Question = { type: 'true_false', prompt: 'Sky is blue', answer: true };
    expect(grade([q], [true]).score.correct).toBe(1);
    expect(grade([q], [false]).score.correct).toBe(0);
    expect(grade([q], [1 as never]).score.correct).toBe(0);
  });

  it('awards multi-select partial credit only when partialGrades is on', () => {
    const q: Question = {
      type: 'multi_select',
      prompt: 'Pick the first three',
      options: ['1', '2', '3', '4'],
      answer: [0, 1, 2],
    };
    // 2 of 3 correct, no wrong picks → 2/3 of a point.
    const two = grade([q], [[0, 1]], { partialGrades: true });
    expect(two.results[0]?.correct).toBe(false);
    expect(two.results[0]?.partial).toBeCloseTo(2 / 3);
    expect(two.score.correct).toBeCloseTo(0.67);
    // A wrong pick cancels a correct one: 2 hits − 1 miss = 1/3.
    expect(grade([q], [[0, 1, 3]], { partialGrades: true }).score.correct).toBeCloseTo(0.33);
    // Floor at zero: 1 hit − 3 would go negative… (1 hit, 1 miss → 0? no: 1-1=0)
    expect(grade([q], [[0, 3]], { partialGrades: true }).score.correct).toBe(0);
    // Fully correct is still a whole point, no `partial` field.
    const full = grade([q], [[2, 1, 0]], { partialGrades: true });
    expect(full.results[0]).toEqual({ correct: true, expected: [0, 1, 2] });
    expect(full.score.correct).toBe(1);
    // Default (off): all-or-nothing.
    expect(grade([q], [[0, 1]]).score.correct).toBe(0);
  });

  it('grades multi-select as an exact set, order-insensitive', () => {
    const q: Question = {
      type: 'multi_select',
      prompt: 'Pick evens',
      options: ['1', '2', '3', '4'],
      answer: [1, 3],
    };
    expect(grade([q], [[3, 1]]).score.correct).toBe(1);
    expect(grade([q], [[1]]).score.correct).toBe(0);
    expect(grade([q], [[1, 2, 3]]).score.correct).toBe(0);
  });

  it('records short answers without grading them', () => {
    const q: Question = { type: 'short_answer', prompt: 'Explain' };
    const { results, score } = grade([q], ['because reasons']);
    expect(results[0]).toEqual({ correct: null, expected: null });
    expect(score).toEqual({ correct: 0, gradable: 0 });
  });

  it('records long answers without grading them', () => {
    const q: Question = { type: 'long_answer', prompt: 'Discuss at length' };
    const { results, score } = grade([q], ['a whole essay']);
    expect(results[0]).toEqual({ correct: null, expected: null });
    expect(score).toEqual({ correct: 0, gradable: 0 });
  });

  it('counts unanswered gradable questions as wrong', () => {
    const { score } = grade([mc(), mc()], [1]);
    expect(score).toEqual({ correct: 1, gradable: 2 });
  });

  it('mixes types into one score', () => {
    const questions: Question[] = [
      mc(),
      { type: 'true_false', prompt: 't', answer: false },
      { type: 'short_answer', prompt: 's' },
    ];
    const { score } = grade(questions, [1, false, 'text']);
    expect(score).toEqual({ correct: 2, gradable: 2 });
  });
});

describe('allAnswered', () => {
  it('requires a non-null response for every question', () => {
    expect(allAnswered([mc()], [])).toBe(false);
    expect(allAnswered([mc()], [null])).toBe(false);
    expect(allAnswered([mc()], [0])).toBe(true);
  });

  it('requires at least one selection for multi-select', () => {
    const q: Question = { type: 'multi_select', prompt: 'm', options: ['a', 'b'], answer: [0] };
    expect(allAnswered([q], [[]])).toBe(false);
    expect(allAnswered([q], [[1]])).toBe(true);
  });

  it('requires non-blank text for short and long answers', () => {
    const short: Question = { type: 'short_answer', prompt: 's' };
    expect(allAnswered([short], ['  '])).toBe(false);
    expect(allAnswered([short], ['x'])).toBe(true);
    const long: Question = { type: 'long_answer', prompt: 'l' };
    expect(allAnswered([long], ['  '])).toBe(false);
    expect(allAnswered([long], ['an essay'])).toBe(true);
  });
});

describe('percent', () => {
  it('rounds and handles the nothing-gradable case', () => {
    expect(percent({ correct: 2, gradable: 3 })).toBe(67);
    expect(percent({ correct: 0, gradable: 0 })).toBeNull();
  });
});
