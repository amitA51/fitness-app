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

// ── Scanned-product cache ───────────────────────────────────────────────────
// Resolved barcode lookups (Open Food Facts) keyed by barcode. Lets re-scanned
// products short-circuit a full OFF round-trip when offline/slow, and lets the
// "אחרונים" shelf resolve `off-<barcode>` ids that aren't in the static library.
// localStorage only — no DB, no new deps.

const SCAN_CACHE_KEY = 'sparkos_scanned_food_cache';
const MAX_SCAN_CACHE = 50;

/** Read the barcode→FoodItem cache; tolerant of corrupt/missing JSON. */
function readScanCache(): Record<string, FoodItem> {
  const raw = readJsonStorage<unknown>(SCAN_CACHE_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, FoodItem>)
    : {};
}

/** Persist a resolved scanned product, capped to the most-recent MAX_SCAN_CACHE. */
export function cacheScannedFood(barcode: string, food: FoodItem): void {
  if (!barcode) return;
  const cache = readScanCache();
  // Re-insert at the end so the newest survives the cap; trim oldest first.
  delete cache[barcode];
  cache[barcode] = food;
  const entries = Object.entries(cache);
  const capped = entries.slice(Math.max(0, entries.length - MAX_SCAN_CACHE));
  writeJsonStorage(SCAN_CACHE_KEY, Object.fromEntries(capped));
}

/** Look up a previously scanned product by barcode (null when uncached). */
export function getCachedScannedFood(barcode: string): FoodItem | null {
  return readScanCache()[barcode] ?? null;
}

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

/**
 * Resolve stored ids against the live library AND the scanned-product cache, so
 * re-scanned barcode products (`off-<barcode>`, never in the static library)
 * appear in "אחרונים" instead of paying a full OFF round-trip. Stale ids that
 * match neither source drop out silently.
 */
export function getRecentFoods(): FoodItem[] {
  const library = getFoodLibrary();
  const cache = readScanCache();
  const byId = new Map<string, FoodItem>();
  for (const food of library) byId.set(food.id, food);
  // Scanned products are keyed by barcode in the cache but carry id `off-<code>`.
  for (const food of Object.values(cache)) byId.set(food.id, food);
  return getRecentFoodIds()
    .map((id) => byId.get(id))
    .filter((f): f is FoodItem => f !== undefined);
}
