// Shared nutrition constants — single source of truth for values that were
// previously duplicated across nutrition components/services. This is a LEAF
// module: it must not import from services (which import from here) to keep the
// dependency graph acyclic.

import type { MealType } from '../types';

/**
 * Macro accent colors. Previously duplicated verbatim in AddMealModal and
 * FoodLibrary; now imported by both plus the shared MacroGrid. Tokens only —
 * never hardcode accent hex.
 */
export const MACRO_COLORS: Record<'calories' | 'protein' | 'carbs' | 'fat', string> = {
  calories: 'var(--fs-warn)',
  protein: 'var(--fs-accent)',
  carbs: 'var(--fs-accent-2)',
  fat: 'var(--fs-signal)',
};

/**
 * Canonical render order for meal-type groups in the journal. Lives here (not in
 * MealLog) so the grouping fix and any future surface share one ordering.
 */
export const MEAL_TYPE_ORDER: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre-workout',
  'post-workout',
];

const MEAL_TYPE_SET = new Set<string>(MEAL_TYPE_ORDER);

/**
 * Coerce an untrusted value into a valid MealType.
 *
 * `MealEntry.meals[].name` is typed `MealType`, but entries pulled from the
 * cloud are reconstructed from unvalidated JSON (`row.meals || []` in
 * supabaseSync), so at runtime the field can be `undefined` or a stale/foreign
 * string. The journal groups by this value; without coercion an unrecognized
 * key lands in a bucket that the ordered render filters out, so the entry — and
 * its calories — silently disappears from the day. Coercing unknowns to a
 * concrete fallback guarantees every entry is always shown and counted.
 */
export function normalizeMealType(value: unknown, fallback: MealType = 'snack'): MealType {
  return typeof value === 'string' && MEAL_TYPE_SET.has(value) ? (value as MealType) : fallback;
}

// ── Water configuration ─────────────────────────────────────────────────────
// Defaults for the daily water goal and per-glass size. Previously hardcoded in
// waterService; now overridable per user via localStorage (see waterService
// get/set helpers), mirroring the `nutrition_goals` pattern for calories.

/** Default daily hydration goal in milliliters. */
export const DEFAULT_WATER_GOAL_ML = 2500;

/** Default single-glass size in milliliters. */
export const DEFAULT_GLASS_ML = 250;

/** localStorage key holding the user's `{ goalMl, glassMl }` water settings. */
export const WATER_SETTINGS_KEY = 'water_settings';

/** Sensible bounds so a corrupt or hostile localStorage value can't break the UI. */
export const WATER_GOAL_BOUNDS = { min: 250, max: 8000 } as const;
export const GLASS_SIZE_BOUNDS = { min: 50, max: 1000 } as const;
