import { describe, expect, it } from 'vitest';
import { KCAL_PER_GRAM, kcalFromMacros } from '../nutritionMath';

describe('nutritionMath', () => {
  it('uses the Atwater 4/4/9 energy factors', () => {
    expect(KCAL_PER_GRAM).toEqual({ protein: 4, carbs: 4, fat: 9 });
  });

  it('sums calories from a macro breakdown', () => {
    // 10*4 + 20*4 + 5*9 = 40 + 80 + 45 = 165
    expect(kcalFromMacros(10, 20, 5)).toBe(165);
  });

  it('returns 0 for an all-zero breakdown', () => {
    expect(kcalFromMacros(0, 0, 0)).toBe(0);
  });

  it('weights fat at 9 kcal/g', () => {
    expect(kcalFromMacros(0, 0, 10)).toBe(90);
  });
});
