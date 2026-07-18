import { describe, expect, it } from 'vitest';
import { rowsMatch, valueMatches } from './comparator';

describe('valueMatches', () => {
  describe('null', () => {
    it('matches SQLite NULL', () => {
      expect(valueMatches(null, null)).toBe(true);
    });
    it('matches a missing column (undefined)', () => {
      expect(valueMatches(null, undefined)).toBe(true);
    });
    it('does not match 0, empty string, or false', () => {
      expect(valueMatches(null, 0)).toBe(false);
      expect(valueMatches(null, '')).toBe(false);
      expect(valueMatches(null, false)).toBe(false);
    });
  });

  describe('number', () => {
    it('compares integers exactly', () => {
      expect(valueMatches(21, 21)).toBe(true);
      expect(valueMatches(21, 22)).toBe(false);
    });
    it('accepts BigInt INTEGER results', () => {
      expect(valueMatches(21, 21n)).toBe(true);
      expect(valueMatches(21, 22n)).toBe(false);
    });
    it('compares REALs within epsilon', () => {
      expect(valueMatches(0.3, 0.1 + 0.2)).toBe(true);
      expect(valueMatches(0.3, 0.301)).toBe(false);
    });
    it('an integer-valued expected compares exactly, not by epsilon', () => {
      expect(valueMatches(1, 1 + 1e-12)).toBe(false);
    });
    it('rejects string results (no number<->string coercion)', () => {
      expect(valueMatches(21, '21')).toBe(false);
    });
    it('rejects NULL results', () => {
      expect(valueMatches(21, null)).toBe(false);
      expect(valueMatches(21, undefined)).toBe(false);
    });
  });

  describe('boolean', () => {
    it('true matches 1, false matches 0', () => {
      expect(valueMatches(true, 1)).toBe(true);
      expect(valueMatches(false, 0)).toBe(true);
      expect(valueMatches(true, 0)).toBe(false);
      expect(valueMatches(false, 1)).toBe(false);
    });
    it('accepts BigInt 0/1', () => {
      expect(valueMatches(true, 1n)).toBe(true);
      expect(valueMatches(false, 0n)).toBe(true);
    });
    it('other integers are not booleans', () => {
      expect(valueMatches(true, 2)).toBe(false);
    });
    it('rejects strings and NULL', () => {
      expect(valueMatches(true, 'true')).toBe(false);
      expect(valueMatches(true, null)).toBe(false);
    });
  });

  describe('string', () => {
    it('strict equality', () => {
      expect(valueMatches('Alice', 'Alice')).toBe(true);
      expect(valueMatches('Alice', 'alice')).toBe(false);
      expect(valueMatches('Alice', ' Alice')).toBe(false);
    });
    it('no number->string coercion', () => {
      expect(valueMatches('21', 21)).toBe(false);
    });
    it('rejects NULL', () => {
      expect(valueMatches('Alice', null)).toBe(false);
    });
  });

  it('rejects unsupported expected types (BLOB-ish)', () => {
    expect(valueMatches(new Uint8Array([1]), new Uint8Array([1]))).toBe(false);
    expect(valueMatches({ nested: true }, { nested: true })).toBe(false);
  });
});

describe('rowsMatch', () => {
  it('matches identical row sets', () => {
    expect(
      rowsMatch(
        [{ age: 21 }, { age: 30 }],
        [{ age: 21 }, { age: 30 }]
      )
    ).toBe(true);
  });

  it('requires exact row count', () => {
    expect(rowsMatch([{ age: 21 }], [{ age: 21 }, { age: 30 }])).toBe(false);
    expect(rowsMatch([{ age: 21 }, { age: 30 }], [{ age: 21 }])).toBe(false);
  });

  it('is positional — order matters', () => {
    expect(rowsMatch([{ age: 21 }, { age: 30 }], [{ age: 30 }, { age: 21 }])).toBe(false);
  });

  it('ignores extra columns in the result', () => {
    expect(
      rowsMatch(
        [{ age: 21 }],
        [{ id: 1, name: 'Alice', age: 21 }]
      )
    ).toBe(true);
  });

  it('a column missing from the result fails unless expected null', () => {
    expect(rowsMatch([{ age: 21 }], [{ name: 'Alice' }])).toBe(false);
    expect(rowsMatch([{ age: null }], [{ name: 'Alice' }])).toBe(true);
  });

  it('both empty matches (e.g. asserting a table is empty)', () => {
    expect(rowsMatch([], [])).toBe(true);
  });

  it('handles pragma-style schema rows', () => {
    const expected = [
      { name: 'id', type: 'INTEGER', pk: 1 },
      { name: 'title', type: 'TEXT', pk: 0 },
    ];
    const actual = [
      { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
      { cid: 1, name: 'title', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
    ];
    expect(rowsMatch(expected, actual)).toBe(true);
  });

  it('mixed types in one row', () => {
    expect(
      rowsMatch(
        [{ name: 'Alice', age: 21, active: true, note: null }],
        [{ name: 'Alice', age: 21n, active: 1, note: null }]
      )
    ).toBe(true);
  });
});
