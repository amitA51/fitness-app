import { afterEach, describe, expect, it } from 'vitest';
import { getFoodLibrary } from '../../../services/nutritionService';
import { getRecentFoodIds, getRecentFoods, recordRecentFoods } from '../recentFoods';

const STORAGE_KEY = 'sparkos_recent_food_ids';

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('recentFoods', () => {
  it('returns an empty list when nothing was recorded', () => {
    expect(getRecentFoodIds()).toEqual([]);
    expect(getRecentFoods()).toEqual([]);
  });

  it('records ids most-recent-first', () => {
    // Arrange / Act
    recordRecentFoods(['a']);
    recordRecentFoods(['b', 'c']);

    // Assert
    expect(getRecentFoodIds()).toEqual(['b', 'c', 'a']);
  });

  it('dedupes a re-logged food and moves it to the front', () => {
    recordRecentFoods(['a', 'b']);
    recordRecentFoods(['b']);

    expect(getRecentFoodIds()).toEqual(['b', 'a']);
  });

  it('caps the list at 10 ids', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);
    recordRecentFoods(ids);

    const stored = getRecentFoodIds();
    expect(stored).toHaveLength(10);
    expect(stored[0]).toBe('id-0');
  });

  it('ignores an empty save', () => {
    recordRecentFoods(['a']);
    recordRecentFoods([]);

    expect(getRecentFoodIds()).toEqual(['a']);
  });

  it('resolves only ids that exist in the food library, preserving order', () => {
    // Arrange: one real library item between two stale ids.
    const real = getFoodLibrary()[0];
    expect(real).toBeDefined();
    recordRecentFoods(['stale-1', real!.id, 'stale-2']);

    // Act
    const foods = getRecentFoods();

    // Assert: stale ids drop out silently.
    expect(foods).toHaveLength(1);
    expect(foods[0]?.id).toBe(real!.id);
  });

  it('returns an empty list for corrupt stored JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(getRecentFoodIds()).toEqual([]);
  });

  it('filters non-string entries out of stored data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['ok', 7, null, 'also-ok']));
    expect(getRecentFoodIds()).toEqual(['ok', 'also-ok']);
  });
});
