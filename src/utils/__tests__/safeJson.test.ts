import { describe, expect, it } from 'vitest';
import { safeJsonParse, safeJsonParseOr } from '../safeJson';

describe('safeJsonParse', () => {
  it('round-trips valid JSON', () => {
    const original = { name: 'workout', count: 3, done: true };
    const serialized = JSON.stringify(original);
    expect(safeJsonParse(serialized)).toEqual(original);
  });

  it('returns undefined for invalid JSON (does not throw)', () => {
    expect(() => safeJsonParse('{not valid json')).not.toThrow();
    expect(safeJsonParse('{not valid json')).toBeUndefined();
  });

  it('handles null input safely', () => {
    expect(safeJsonParse(null)).toBeUndefined();
  });

  it('handles undefined input safely', () => {
    expect(safeJsonParse(undefined)).toBeUndefined();
  });

  it('handles empty string safely', () => {
    expect(safeJsonParse('')).toBeUndefined();
  });

  it('parses deeply nested objects', () => {
    const deep = {
      level1: {
        level2: {
          level3: {
            level4: { items: [1, 2, 3, { leaf: 'value' }] },
          },
        },
      },
    };
    const parsed = safeJsonParse<typeof deep>(JSON.stringify(deep));
    expect(parsed).toEqual(deep);
    expect(parsed?.level1.level2.level3.level4.items[3]).toEqual({ leaf: 'value' });
  });
});

describe('safeJsonParseOr', () => {
  it('returns fallback when parsing fails', () => {
    expect(safeJsonParseOr('bad json', { fallback: true })).toEqual({ fallback: true });
  });

  it('returns parsed value when successful', () => {
    expect(safeJsonParseOr('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback for null/undefined input', () => {
    expect(safeJsonParseOr(null, 'default')).toBe('default');
    expect(safeJsonParseOr(undefined, 42)).toBe(42);
  });
});
