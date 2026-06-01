import { describe, expect, it } from 'vitest';
import type { MealEntry, MealType } from '../types';
import { MEAL_TYPE_ORDER, normalizeMealType } from './nutrition';

describe('normalizeMealType', () => {
  it('returns every known meal type unchanged', () => {
    for (const t of MEAL_TYPE_ORDER) {
      expect(normalizeMealType(t)).toBe(t);
    }
  });

  it('coerces missing/undefined to the snack fallback', () => {
    expect(normalizeMealType(undefined)).toBe('snack');
    expect(normalizeMealType(null)).toBe('snack');
  });

  it('coerces unknown / foreign strings to the fallback', () => {
    // e.g. a stale or non-MealType value rebuilt from unvalidated cloud JSON
    expect(normalizeMealType('brunch')).toBe('snack');
    expect(normalizeMealType('')).toBe('snack');
    expect(normalizeMealType(42)).toBe('snack');
  });

  it('honors an explicit fallback', () => {
    expect(normalizeMealType('nope', 'breakfast')).toBe('breakfast');
  });
});

// Replicates GroupedMealLog's exact grouping so the journal behavior is covered
// without rendering. The fix is `normalizeMealType(meals[0]?.name)` instead of
// `meals[0]?.name ?? 'snack'`.
function groupByType(entries: MealEntry[]): { type: MealType; count: number }[] {
  const byType = new Map<MealType, MealEntry[]>();
  for (const entry of entries) {
    const type = normalizeMealType(entry.meals[0]?.name);
    const list = byType.get(type) ?? [];
    list.push(entry);
    byType.set(type, list);
  }
  return MEAL_TYPE_ORDER.filter((t) => byType.has(t)).map((type) => ({
    type,
    count: (byType.get(type) ?? []).length,
  }));
}

function entry(id: string, mealName: unknown): MealEntry {
  const macros = { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0 };
  return {
    id,
    date: '2026-06-01',
    name: id,
    // `name` is typed MealType, but cloud-synced data is unvalidated JSON, so we
    // deliberately feed a foreign value here to exercise the coercion path.
    meals: [
      { id: `${id}-m`, name: mealName as MealType, foods: [], time: '08:00', totalMacros: macros },
    ],
    totalMacros: macros,
    notes: '',
    createdAt: '2026-06-01T08:00:00.000Z',
  };
}

describe('GroupedMealLog grouping by meal type', () => {
  it('groups entries under their meal type and orders by MEAL_TYPE_ORDER', () => {
    const groups = groupByType([
      entry('a', 'dinner'),
      entry('b', 'breakfast'),
      entry('c', 'lunch'),
      entry('d', 'breakfast'),
    ]);
    // breakfast before lunch before dinner, regardless of insertion order
    expect(groups.map((g) => g.type)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(groups.find((g) => g.type === 'breakfast')?.count).toBe(2);
  });

  it('does NOT drop entries whose stored type is unknown/missing (the bug)', () => {
    const entries = [
      entry('a', 'breakfast'),
      entry('b', 'brunch'), // foreign string — old code bucketed it under a key never rendered
      entry('c', undefined), // missing — old `?? snack` caught only this case
    ];
    const groups = groupByType(entries);
    const total = groups.reduce((s, g) => s + g.count, 0);
    // Every entry survives: 1 breakfast + 2 coerced to snack = 3 total
    expect(total).toBe(entries.length);
    expect(groups.find((g) => g.type === 'snack')?.count).toBe(2);
  });
});
