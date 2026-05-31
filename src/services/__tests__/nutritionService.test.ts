import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FoodItem, MealEntry } from '../../types';
import {
  NUTRITION_GOALS_KEY,
  calcMacroTotals,
  createQuickMeal,
  saveNutritionGoals,
  sumEntryMacros,
} from '../nutritionService';

function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'f1',
    name: 'חזה עוף',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
    ...overrides,
  };
}

function makeEntry(macros: MealEntry['totalMacros']): MealEntry {
  return {
    id: `e-${macros.calories}`,
    date: '2026-05-30',
    name: 'test',
    meals: [],
    totalMacros: macros,
    notes: '',
    createdAt: '2026-05-30T08:00:00.000Z',
  };
}

describe('nutritionService pure logic', () => {
  describe('calcMacroTotals', () => {
    it('sums macros with consistent rounding across servings', () => {
      // Arrange
      const foods = [
        makeFood({ servings: 2 }),
        makeFood({
          id: 'f2',
          name: 'אורז',
          calories: 130,
          protein: 2.7,
          carbs: 28,
          fat: 0.3,
          fiber: 0.4,
          servings: 1.5,
        }),
      ];

      // Act
      const totals = calcMacroTotals(foods);

      // Assert
      expect(totals.calories).toBe(Math.round(165 * 2) + Math.round(130 * 1.5));
      expect(totals.protein).toBeCloseTo(62 + 4.1, 5);
      expect(totals.fiber).toBeCloseTo(0 + 0.6, 5);
    });

    it('returns zeroed totals for an empty list', () => {
      // Arrange / Act
      const totals = calcMacroTotals([]);

      // Assert
      expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    });
  });

  describe('sumEntryMacros', () => {
    it('adds macro totals across entries', () => {
      // Arrange
      const entries = [
        makeEntry({ calories: 500, protein: 30, carbs: 50, fat: 20, fiber: 5 }),
        makeEntry({ calories: 300, protein: 20, carbs: 25, fat: 10, fiber: 3 }),
      ];

      // Act
      const totals = sumEntryMacros(entries);

      // Assert
      expect(totals).toEqual({ calories: 800, protein: 50, carbs: 75, fat: 30, fiber: 8 });
    });
  });

  describe('createQuickMeal', () => {
    it('stamps the provided date so retroactive logging lands on the viewed day', () => {
      // Arrange
      const pastDay = '2026-05-25';

      // Act
      const entry = createQuickMeal('lunch', [makeFood()], pastDay);

      // Assert
      expect(entry.date).toBe(pastDay);
    });

    it('names the entry after its foods rather than the meal-type label', () => {
      // Arrange
      const foods = [makeFood({ name: 'חזה עוף' }), makeFood({ id: 'f2', name: 'אורז' })];

      // Act
      const entry = createQuickMeal('lunch', foods, '2026-05-25');

      // Assert: title is food-derived, not "ארוחת צהריים", avoiding eyebrow/title duplication
      expect(entry.name).toBe('חזה עוף +1');
      expect(entry.meals[0]?.name).toBe('lunch');
    });
  });

  describe('saveNutritionGoals', () => {
    afterEach(() => {
      localStorage.clear();
      vi.restoreAllMocks();
    });

    it('writes the shared key and broadcasts settings-updated', () => {
      // Arrange
      const listener = vi.fn();
      window.addEventListener('settings-updated', listener);

      // Act
      saveNutritionGoals({ calories: 2200, protein: 160, carbs: 250, fat: 70 });

      // Assert
      const stored = JSON.parse(localStorage.getItem(NUTRITION_GOALS_KEY) ?? '{}');
      expect(stored).toEqual({ calories: 2200, protein: 160, carbs: 250, fat: 70 });
      expect(listener).toHaveBeenCalledTimes(1);
      window.removeEventListener('settings-updated', listener);
    });
  });
});
