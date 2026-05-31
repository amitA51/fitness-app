import { describe, expect, it } from 'vitest';
import { computeMacrosFromProfile } from '../settingsService';

describe('settingsService', () => {
  describe('computeMacrosFromProfile', () => {
    it('returns correct macros for a standard male profile', () => {
      const result = computeMacrosFromProfile({
        weightKg: 80,
        heightCm: 180,
        age: 30,
        gender: 'male',
        activityLevel: 'פעיל מתון',
        weightGoal: 'שמירה על משקל',
      });
      expect(result.calories).toBeGreaterThan(0);
      expect(result.protein).toBeGreaterThan(0);
      expect(result.carbs).toBeGreaterThan(0);
      expect(result.fat).toBeGreaterThan(0);
      // Macros should sum close to calories (rounding may cause ±1)
      const macroCalories = result.protein * 4 + result.carbs * 4 + result.fat * 9;
      expect(Math.abs(macroCalories - result.calories)).toBeLessThanOrEqual(1);
    });

    it('returns lower calories for weight loss goal', () => {
      const base = {
        weightKg: 70,
        heightCm: 175,
        age: 25,
        gender: 'male' as const,
        activityLevel: 'פעיל מתון',
      };
      const maintain = computeMacrosFromProfile({ ...base, weightGoal: 'שמירה על משקל' });
      const lose = computeMacrosFromProfile({ ...base, weightGoal: 'ירידה במשקל' });
      expect(lose.calories).toBeLessThan(maintain.calories);
    });

    it('returns higher calories for bulk goal', () => {
      const base = {
        weightKg: 70,
        heightCm: 175,
        age: 25,
        gender: 'male' as const,
        activityLevel: 'פעיל מתון',
      };
      const maintain = computeMacrosFromProfile({ ...base, weightGoal: 'שמירה על משקל' });
      const bulk = computeMacrosFromProfile({ ...base, weightGoal: 'עלייה במסה' });
      expect(bulk.calories).toBeGreaterThan(maintain.calories);
    });

    it('handles zero/invalid inputs gracefully', () => {
      const result = computeMacrosFromProfile({
        weightKg: 0,
        heightCm: 0,
        age: 0,
        gender: 'male',
        activityLevel: 'פעיל מתון',
        weightGoal: 'שמירה על משקל',
      });
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });
  });
});
