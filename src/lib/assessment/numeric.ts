/**
 * Numeric-question parsing and matching — pure functions (no DOM/DB), unit
 * tested in numeric.test.ts. Used by grade.ts and the QuestionCard input.
 *
 * Authors declare `answer` as one of three shapes:
 *   42                      one number
 *   [7, 9, 25]              several numbers (learner enters comma-separated)
 *   [[10, 15], [12.4, -3]]  tuples (learner enters "(a, b), (c, d)")
 *
 * Options: `integer` (whole numbers only, exact comparison), `positive`
 * (no negative values may be entered), `precision` (decimals of tolerance:
 * precision 3 accepts |diff| ≤ 0.0005). Defaults: floats allowed, negatives
 * allowed, tolerance 1e-9 (float-noise only).
 *
 * Multi-value comparison is a MULTISET match — entry order never matters,
 * but counts do (7,7,9 ≠ 7,9,9). Tuple component order matters within a
 * tuple; the list of tuples is order-insensitive.
 */

export type NumericAnswer = number | number[] | number[][];

export interface NumericOptions {
  integer?: boolean;
  positive?: boolean;
  precision?: number;
}

/** True when the authored answer is tuple-shaped. */
export function isTupleAnswer(answer: NumericAnswer): answer is number[][] {
  return Array.isArray(answer) && Array.isArray(answer[0]);
}

/** The authored answer as a uniform list (scalars become a 1-list). */
export function expectedList(answer: NumericAnswer): number[] | number[][] {
  return typeof answer === 'number' ? [answer] : answer;
}

/** Comparison tolerance from the options. */
export function toleranceOf(options: NumericOptions): number {
  if (options.integer) return 0;
  if (options.precision !== undefined) return 0.5 * Math.pow(10, -options.precision);
  return 1e-9;
}

export type ParseResult =
  | { ok: true; values: number[] | number[][] }
  | { ok: false; error: string };

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function parseOne(raw: string, options: NumericOptions): number | { error: string } {
  const text = raw.trim();
  if (text === '' || !NUMBER_RE.test(text)) {
    return { error: `"${text || raw.trim() || '…'}" is not a number` };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: `"${text}" is not a number` };
  if (options.integer && !Number.isInteger(value)) {
    return { error: `"${text}" — whole numbers only` };
  }
  if (options.positive && value < 0) {
    return { error: `"${text}" — negative values aren't allowed here` };
  }
  return value;
}

/**
 * Parse learner input for a question. Scalar shape: comma-separated numbers.
 * Tuple shape: "(a, b), (c, d)" — every tuple must have `tupleSize`
 * components.
 */
export function parseNumericInput(
  text: string,
  shape: { tuples: boolean; tupleSize?: number },
  options: NumericOptions = {}
): ParseResult {
  const input = text.trim();
  if (input === '') return { ok: false, error: 'Enter an answer' };

  if (!shape.tuples) {
    const values: number[] = [];
    for (const part of input.split(',')) {
      const parsed = parseOne(part, options);
      if (typeof parsed !== 'number') return { ok: false, error: parsed.error };
      values.push(parsed);
    }
    return { ok: true, values };
  }

  // Tuples: the whole input must be (…) groups separated by commas/space.
  const shell = input.replace(/\(([^()]*)\)/g, '§').replace(/[\s,]/g, '');
  if (shell !== '§'.repeat((input.match(/\(/g) ?? []).length) || !input.includes('(')) {
    return { ok: false, error: 'Enter tuples like (1, 2), (3, 4)' };
  }
  const groups = [...input.matchAll(/\(([^()]*)\)/g)].map((m) => m[1] ?? '');
  const tuples: number[][] = [];
  for (const group of groups) {
    const parts = group.split(',');
    if (shape.tupleSize !== undefined && parts.length !== shape.tupleSize) {
      return { ok: false, error: `Each tuple needs ${shape.tupleSize} values` };
    }
    const tuple: number[] = [];
    for (const part of parts) {
      const parsed = parseOne(part, options);
      if (typeof parsed !== 'number') return { ok: false, error: parsed.error };
      tuple.push(parsed);
    }
    tuples.push(tuple);
  }
  return { ok: true, values: tuples };
}

const valueMatches = (expected: number, got: number, tolerance: number) =>
  Math.abs(expected - got) <= tolerance;

const tupleMatches = (expected: number[], got: number[], tolerance: number) =>
  expected.length === got.length && expected.every((e, i) => valueMatches(e, got[i]!, tolerance));

export interface MatchOutcome {
  /** Expected values that were matched by an entered value. */
  hits: number;
  /** Entered values that matched nothing (wrong entries). */
  misses: number;
  /** Every expected matched AND nothing extra entered. */
  exact: boolean;
}

/** Multiset match: each entered value consumes at most one expected value. */
export function matchValues(
  expected: number[] | number[][],
  got: number[] | number[][],
  tolerance: number
): MatchOutcome {
  const remaining = [...expected] as (number | number[])[];
  let hits = 0;
  let misses = 0;
  for (const value of got as (number | number[])[]) {
    const index = remaining.findIndex((e) =>
      Array.isArray(e)
        ? Array.isArray(value) && tupleMatches(e, value, tolerance)
        : !Array.isArray(value) && valueMatches(e, value, tolerance)
    );
    if (index === -1) {
      misses++;
    } else {
      hits++;
      remaining.splice(index, 1);
    }
  }
  return { hits, misses, exact: remaining.length === 0 && misses === 0 };
}

/** Human-readable form of an authored answer, for post-grade reveal. */
export function formatNumericAnswer(answer: NumericAnswer): string {
  if (typeof answer === 'number') return String(answer);
  if (isTupleAnswer(answer)) return answer.map((t) => `(${t.join(', ')})`).join(', ');
  return answer.join(', ');
}

/** Input-format hint shown under the field while answering. */
export function numericHint(answer: NumericAnswer, options: NumericOptions): string {
  const kind = options.integer ? 'whole number' : 'number';
  const constraints = [
    options.positive ? 'no negatives' : null,
    !options.integer && options.precision !== undefined
      ? `accurate to ${options.precision} decimal${options.precision === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);
  const suffix = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
  if (isTupleAnswer(answer)) {
    const size = answer[0]!.length;
    const sample = `(${Array.from({ length: size }, (_, i) => i + 1).join(', ')})`;
    const count = answer.length;
    return count === 1
      ? `Enter a tuple like ${sample}${suffix}`
      : `Enter ${count} tuples like ${sample}, … — any order${suffix}`;
  }
  const list = expectedList(answer) as number[];
  return list.length === 1
    ? `Enter one ${kind}${suffix}`
    : `Enter ${list.length} comma-separated ${kind}s — any order${suffix}`;
}
