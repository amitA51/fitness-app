import { describe, expect, it } from 'vitest';
import { formatInt, formatThousands, formatThousandsDecimal } from '../formatThousands';

describe('formatThousands utilities', () => {
  it('formatInt rounds to a whole-number string', () => {
    expect(formatInt(12.6)).toBe('13');
    expect(formatInt(12.4)).toBe('12');
    expect(formatInt(0)).toBe('0');
  });

  it('formatThousands adds grouping separators on a rounded integer', () => {
    expect(formatThousands(8140)).toBe('8,140');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(1234567)).toBe('1,234,567');
  });

  it('formatThousandsDecimal keeps one decimal only when fractional', () => {
    expect(formatThousandsDecimal(8140)).toBe('8,140');
    expect(formatThousandsDecimal(12.5)).toBe('12.5');
    expect(formatThousandsDecimal(12)).toBe('12');
  });
});
