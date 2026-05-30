import { describe, expect, it } from 'vitest';
import { calculateBMR, calculateTDEE } from '../tdee';

describe('calculateBMR', () => {
  it('computes Mifflin-St Jeor for valid input', () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 -> 1649
    expect(calculateBMR(70, 175, 30, 'male')).toBe(1649);
  });

  it('returns 0 for non-positive or non-finite input', () => {
    expect(calculateBMR(0, 175, 30, 'male')).toBe(0);
    expect(calculateBMR(-70, 175, 30, 'male')).toBe(0);
    expect(calculateBMR(Number.NaN, 175, 30, 'male')).toBe(0);
  });
});

describe('calculateTDEE', () => {
  it('returns an all-zero result for invalid input', () => {
    expect(calculateTDEE(0, 0, 0, 'male', 'פעיל מתון')).toEqual({
      bmr: 0,
      tdee: 0,
      cut: 0,
      maintain: 0,
      bulk: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('produces macros whose calories sum back to the TDEE target', () => {
    const r = calculateTDEE(70, 175, 30, 'male', 'פעיל מתון');
    const macroCalories = r.protein * 4 + r.carbs * 4 + r.fat * 9;
    expect(Math.abs(macroCalories - r.tdee)).toBeLessThanOrEqual(5);
  });
});
