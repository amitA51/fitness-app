import { afterEach, describe, expect, it } from 'vitest';
import { getFoodLibrary } from '../../../services/nutritionService';
import type { FoodItem } from '../../../types';
import {
  cacheScannedFood,
  getCachedScannedFood,
  getRecentFoodIds,
  getRecentFoods,
  recordRecentFoods,
} from '../recentFoods';

const STORAGE_KEY = 'sparkos_recent_food_ids';
const SCAN_CACHE_KEY = 'sparkos_scanned_food_cache';

function makeScannedFood(barcode: string, name: string): FoodItem {
  return {
    id: `off-${barcode}`,
    name,
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
    barcode,
  };
}

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SCAN_CACHE_KEY);
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

describe('scanned-product cache', () => {
  it('returns null for an uncached barcode', () => {
    expect(getCachedScannedFood('7290000000000')).toBeNull();
  });

  it('caches a scanned product and reads it back by barcode', () => {
    const food = makeScannedFood('7290000000001', 'גבינה');
    cacheScannedFood('7290000000001', food);

    expect(getCachedScannedFood('7290000000001')).toEqual(food);
  });

  it('ignores a cache write with an empty barcode', () => {
    cacheScannedFood('', makeScannedFood('x', 'x'));
    expect(getCachedScannedFood('')).toBeNull();
  });

  it('tolerates a corrupt cache and returns null', () => {
    localStorage.setItem(SCAN_CACHE_KEY, '{not-json');
    expect(getCachedScannedFood('7290000000000')).toBeNull();
  });

  it('caps the cache, evicting the oldest entries', () => {
    // 51 distinct products; cap is 50, so the first inserted must be evicted.
    for (let i = 0; i < 51; i++) {
      const code = `729000000${String(i).padStart(4, '0')}`;
      cacheScannedFood(code, makeScannedFood(code, `food-${i}`));
    }
    expect(getCachedScannedFood('7290000000000')).toBeNull();
    expect(getCachedScannedFood('7290000000050')).not.toBeNull();
  });

  it('resolves a scanned-cache id in recents that is absent from the library', () => {
    // Arrange: a scanned product (off-id, never in the static library).
    const food = makeScannedFood('7290000000002', 'יוגורt');
    cacheScannedFood('7290000000002', food);
    recordRecentFoods([food.id]);

    // Act
    const foods = getRecentFoods();

    // Assert: the off-id resolves via the scanned cache.
    expect(foods).toHaveLength(1);
    expect(foods[0]?.id).toBe(food.id);
  });

  it('resolves library and scanned-cache recents together, preserving order', () => {
    const real = getFoodLibrary()[0];
    expect(real).toBeDefined();
    const scanned = makeScannedFood('7290000000003', 'חמאת בוטנים');
    cacheScannedFood('7290000000003', scanned);
    // Most-recent-first: scanned recorded last lands at the front.
    recordRecentFoods([real!.id]);
    recordRecentFoods([scanned.id]);

    const foods = getRecentFoods();

    expect(foods.map((f) => f.id)).toEqual([scanned.id, real!.id]);
  });
});
