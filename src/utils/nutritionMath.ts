/**
 * Shared nutrition math — the Atwater macro-to-calorie factors and the
 * single forward `kcalFromMacros` helper.
 *
 * The 4/4/9 kcal-per-gram constants were previously re-typed inline in several
 * modules (nutrition macro percentages, TDEE macro splits). Centralizing them
 * here keeps the magic numbers in one place so call sites can never silently
 * diverge if the factors or rounding ever change.
 */

/** Atwater energy factors: kilocalories per gram of each macronutrient. */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Total calories contributed by a macro breakdown, using the Atwater factors.
 * Pure function; callers round as needed.
 */
export const kcalFromMacros = (protein: number, carbs: number, fat: number): number =>
  protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
