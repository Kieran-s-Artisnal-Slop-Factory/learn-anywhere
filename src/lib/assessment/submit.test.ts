import { describe, expect, it } from 'vitest';
import { grade } from './grade';
import { buildFormData, responseText } from './submit';
import type { Question } from './types';

const questions: Question[] = [
  {
    type: 'multiple_choice',
    prompt: 'Pick one',
    options: ['a', 'b'],
    all_of_the_above: true,
    answer: 'all',
  },
  { type: 'true_false', prompt: 'Yes?', answer: true },
  { type: 'multi_select', prompt: 'Pick some', options: ['x', 'y', 'z'], answer: [0, 2] },
  { type: 'short_answer', prompt: 'Explain' },
  { type: 'long_answer', prompt: 'Discuss' },
];

describe('responseText', () => {
  it('renders each response type as human-readable text', () => {
    expect(responseText(questions[0]!, 2)).toBe('All of the above');
    expect(responseText(questions[1]!, false)).toBe('False');
    expect(responseText(questions[2]!, [0, 2])).toBe('x; z');
    expect(responseText(questions[3]!, 'short text')).toBe('short text');
    expect(responseText(questions[4]!, 'long text')).toBe('long text');
  });

  it('renders unanswered as empty string', () => {
    expect(responseText(questions[0]!, null)).toBe('');
    expect(responseText(questions[1]!, null)).toBe('');
  });
});

describe('buildFormData', () => {
  it('carries metadata, score, sender, and one field triple per question', () => {
    const responses = [2, true, [0, 2], 'because', 'essay'];
    const outcome = grade(questions, responses);
    const data = buildFormData(
      { kind: 'test', slug: 'course/chapter', title: 'Chapter Test' },
      questions,
      responses,
      outcome,
      { name: 'Ada', email: 'ada@example.com' }
    );
    expect(data.get('kind')).toBe('test');
    expect(data.get('slug')).toBe('course/chapter');
    expect(data.get('title')).toBe('Chapter Test');
    expect(data.get('sender_name')).toBe('Ada');
    expect(data.get('sender_email')).toBe('ada@example.com');
    expect(data.get('score_correct')).toBe('3');
    expect(data.get('score_gradable')).toBe('3');
    expect(data.get('q1_type')).toBe('multiple_choice');
    expect(data.get('q1_response')).toBe('All of the above');
    expect(data.get('q1_correct')).toBe('true');
    expect(data.get('q4_correct')).toBe('ungraded');
    expect(data.get('q5_type')).toBe('long_answer');
    expect(data.get('q5_response')).toBe('essay');
  });
});
