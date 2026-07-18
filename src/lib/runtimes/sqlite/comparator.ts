/**
 * Solution comparator: compares the rows returned by running a
 * `desired_state.query` against the expected `desired_state.rows`.
 * (Ported verbatim from lite-learner's lib/sql/comparator.ts — pure and
 * unit-tested; that's where the subtle bugs live.)
 *
 * Solution queries are authored with an explicit ORDER BY, so comparison is
 * positional — exact row count, row i vs row i, no set-reconciliation.
 * The expected value drives coercion (see rowsMatch).
 */
import type { Row } from '../types';

export type { Row };

/** An exercise's embedded solution: run `query`, compare to `rows`. */
export interface DesiredState {
  query: string;
  rows: Row[];
}

const REAL_EPSILON = 1e-9;

/** Compare one expected value against the value SQLite returned. */
export function valueMatches(expected: unknown, actual: unknown): boolean {
  if (expected === null) {
    // SQLite NULL only (a missing column also arrives as undefined).
    return actual === null || actual === undefined;
  }

  if (typeof expected === 'number') {
    // Normalize BigInt INTEGERs and REALs; values beyond 2^53 are out of scope.
    if (typeof actual !== 'number' && typeof actual !== 'bigint') return false;
    const a = Number(actual);
    if (Number.isNaN(a)) return false;
    if (Number.isInteger(expected)) return a === expected;
    return Math.abs(a - expected) <= REAL_EPSILON;
  }

  if (typeof expected === 'boolean') {
    // SQLite has no boolean type — booleans are stored as 0/1 integers.
    if (typeof actual !== 'number' && typeof actual !== 'bigint') return false;
    return Number(actual) === (expected ? 1 : 0);
  }

  if (typeof expected === 'string') {
    // Strict: no trimming, case-sensitive, no number<->string coercion.
    return actual === expected;
  }

  // BLOBs / anything else are unsupported by design.
  return false;
}

/**
 * Positional comparison: exact row count, and for each row only the keys
 * present in the expected object are checked (extra result columns ignored).
 */
export function rowsMatch(expectedRows: Row[], actualRows: Row[]): boolean {
  if (actualRows.length !== expectedRows.length) return false;
  return expectedRows.every((expected, i) => {
    const actual = actualRows[i]!;
    return Object.entries(expected).every(([key, value]) => valueMatches(value, actual[key]));
  });
}
