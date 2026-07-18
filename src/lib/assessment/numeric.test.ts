import { describe, expect, it } from 'vitest';
import {
  formatNumericAnswer,
  isTupleAnswer,
  matchValues,
  numericHint,
  parseNumericInput,
  toleranceOf,
} from './numeric';

describe('parseNumericInput — scalars', () => {
  it('parses a single number', () => {
    expect(parseNumericInput('42', { tuples: false })).toEqual({ ok: true, values: [42] });
    expect(parseNumericInput('  -3.5 ', { tuples: false })).toEqual({ ok: true, values: [-3.5] });
  });

  it('parses comma-separated values with sloppy spacing', () => {
    expect(parseNumericInput('7,9, 10,  25', { tuples: false })).toEqual({
      ok: true,
      values: [7, 9, 10, 25],
    });
  });

  it('rejects garbage, empties, and partial numbers', () => {
    expect(parseNumericInput('', { tuples: false }).ok).toBe(false);
    expect(parseNumericInput('abc', { tuples: false }).ok).toBe(false);
    expect(parseNumericInput('1, ,3', { tuples: false }).ok).toBe(false);
    expect(parseNumericInput('1e5', { tuples: false }).ok).toBe(false);
  });

  it('enforces integer mode', () => {
    expect(parseNumericInput('4.5', { tuples: false }, { integer: true }).ok).toBe(false);
    expect(parseNumericInput('4', { tuples: false }, { integer: true })).toEqual({
      ok: true,
      values: [4],
    });
  });

  it('enforces positive mode (no negatives)', () => {
    expect(parseNumericInput('-1', { tuples: false }, { positive: true }).ok).toBe(false);
    expect(parseNumericInput('0, 2', { tuples: false }, { positive: true })).toEqual({
      ok: true,
      values: [0, 2],
    });
  });
});

describe('parseNumericInput — tuples', () => {
  it('parses tuples with spacing', () => {
    expect(parseNumericInput('(10,15), (12.4, -36.2)', { tuples: true, tupleSize: 2 })).toEqual({
      ok: true,
      values: [
        [10, 15],
        [12.4, -36.2],
      ],
    });
  });

  it('rejects non-tuple input, stray text, and wrong sizes', () => {
    expect(parseNumericInput('10, 15', { tuples: true, tupleSize: 2 }).ok).toBe(false);
    expect(parseNumericInput('(1,2) junk', { tuples: true, tupleSize: 2 }).ok).toBe(false);
    expect(parseNumericInput('(1, 2, 3)', { tuples: true, tupleSize: 2 }).ok).toBe(false);
  });
});

describe('toleranceOf', () => {
  it('is exact for integers, 1e-9 default, half-ulp of precision', () => {
    expect(toleranceOf({ integer: true })).toBe(0);
    expect(toleranceOf({})).toBe(1e-9);
    expect(toleranceOf({ precision: 3 })).toBeCloseTo(0.0005);
  });
});

describe('matchValues', () => {
  it('matches multisets order-insensitively', () => {
    expect(matchValues([7, 9, 25], [25, 7, 9], 0)).toEqual({ hits: 3, misses: 0, exact: true });
  });

  it('respects multiplicity', () => {
    expect(matchValues([7, 7, 9], [7, 9, 9], 0)).toEqual({ hits: 2, misses: 1, exact: false });
  });

  it('counts wrong entries as misses and missing answers as non-exact', () => {
    expect(matchValues([7, 9], [7, 8], 0)).toEqual({ hits: 1, misses: 1, exact: false });
    expect(matchValues([7, 9], [7], 0)).toEqual({ hits: 1, misses: 0, exact: false });
  });

  it('applies the precision tolerance (todo.md example: 4.3875 @ 3 ≈ 4.3879)', () => {
    const tolerance = toleranceOf({ precision: 3 });
    expect(matchValues([4.3875], [4.3879], tolerance).exact).toBe(true);
    expect(matchValues([4.3875], [4.389], tolerance).exact).toBe(false);
  });

  it('matches tuples: internal order strict, list order free', () => {
    const expected = [
      [10, 15],
      [12.4, -36.2],
    ];
    expect(matchValues(expected, [[12.4, -36.2], [10, 15]], 1e-9).exact).toBe(true);
    expect(matchValues(expected, [[15, 10], [12.4, -36.2]], 1e-9).exact).toBe(false);
  });
});

describe('helpers', () => {
  it('detects tuple answers and formats each shape', () => {
    expect(isTupleAnswer([[1, 2]])).toBe(true);
    expect(isTupleAnswer([1, 2])).toBe(false);
    expect(formatNumericAnswer(42)).toBe('42');
    expect(formatNumericAnswer([7, 9])).toBe('7, 9');
    expect(formatNumericAnswer([[10, 15], [1, 2]])).toBe('(10, 15), (1, 2)');
  });

  it('builds sensible hints', () => {
    expect(numericHint(42, { integer: true })).toBe('Enter one whole number');
    expect(numericHint([7, 9], { positive: true })).toContain('2 comma-separated numbers');
    expect(numericHint([[1, 2]], {})).toContain('(1, 2)');
    expect(numericHint(1.5, { precision: 2 })).toContain('accurate to 2 decimals');
  });
});
