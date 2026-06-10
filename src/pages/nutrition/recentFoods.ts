// ============================================================================
// recentFoods — localStorage memory of the last logged food ids.
// ============================================================================
// Feeds the "אחרונים" shelf at the top of AddMealModal so repeat meals don't
// cost a full search every time. Most-recent-first, deduped, capped at 10.

import { getFoodLibrary } from '../../services/nutritionService';
import type { FoodItem } from '../../types';
import { readJsonStorage, writeJsonStorage } from '../../utils/safeJson';

const STORAGE_KEY = 'sparkos_recent_food_ids';
const MAX_RECENT = 10;

export function getRecentFoodIds(): string[] {
  const stored = readJsonStorage<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((id): id is string => typeof id === 'string');
}

/** Prepend the just-logged food ids (most-recent-first, deduped, capped). */
export function recordRecentFoods(foodIds: string[]): void {
  if (foodIds.length === 0) return;
  const deduped = [...new Set([...foodIds, ...getRecentFoodIds()])].slice(0, MAX_RECENT);
  writeJsonStorage(STORAGE_KEY, deduped);
}

/** Resolve stored ids against the live library (stale ids drop out silently). */
export function getRecentFoods(): FoodItem[] {
  const library = getFoodLibrary();
  return getRecentFoodIds()
    .map((id) => library.find((f) => f.id === id))
    .filter((f): f is FoodItem => f !== undefined);
}
