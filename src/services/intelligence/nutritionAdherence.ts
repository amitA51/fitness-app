// ============================================================================
// Nutrition Adherence — goal-aware, protein-inclusive nutrition signal
// ============================================================================
//
// Replaces the old calories-only compliance metric (min(100, cal/goal*100)) that:
//   - clamped over-eating to a perfect 100 (a chronic surplus "looked perfect"),
//   - scored a deliberate cut as low compliance (no notion of goal direction),
//   - ignored protein entirely — the single most important nutrition signal for
//     a hypertrophy/strength app.  (RN-2)
//
// This module reports a SIGNED calorie delta (so surplus vs deficit is visible),
// a separate protein-adherence percentage, and a goal-aware onTrack flag.
// ============================================================================

import type { MacroNutrients } from '../../types';
import type { WeightDirection } from './profile';

export interface NutritionAdherence {
  calorieGoal: number;
  avgCalories: number;
  /** Signed: +N% over goal, -N% under goal. */
  calorieDeltaPercent: number;
  proteinGoal: number | null;
  avgProtein: number | null;
  /** avgProtein / proteinGoal, capped at 150. null when no protein goal. */
  proteinAdherencePercent: number | null;
  goalDirection: WeightDirection | null;
  /** Goal-aware: a deficit is fine when cutting, a surplus when gaining; protein
   * shortfall (<85% of goal) always fails it. */
  onTrack: boolean;
  /** Hebrew one-liner for prompts/UI. */
  summary: string;
}

export function computeNutritionAdherence(
  dailyAverage: MacroNutrients | undefined,
  goal: MacroNutrients | undefined,
  goalDirection: WeightDirection | null
): NutritionAdherence | null {
  if (!dailyAverage || !goal || !(goal.calories > 0)) return null;

  const avgCalories = Math.round(dailyAverage.calories || 0);
  const calorieDeltaPercent = Math.round(((avgCalories - goal.calories) / goal.calories) * 100);

  const proteinGoal = goal.protein > 0 ? goal.protein : null;
  const avgProtein = Number.isFinite(dailyAverage.protein)
    ? Math.round(dailyAverage.protein)
    : null;
  const proteinAdherencePercent =
    proteinGoal && avgProtein !== null
      ? Math.min(150, Math.round((avgProtein / proteinGoal) * 100))
      : null;

  let onTrack: boolean;
  if (goalDirection === 'lose') onTrack = calorieDeltaPercent <= 5;
  else if (goalDirection === 'gain') onTrack = calorieDeltaPercent >= -5;
  else onTrack = Math.abs(calorieDeltaPercent) <= 10;
  if (proteinAdherencePercent !== null && proteinAdherencePercent < 85) onTrack = false;

  const calorieWord =
    calorieDeltaPercent > 5 ? 'עודף' : calorieDeltaPercent < -5 ? 'גירעון' : 'מאוזן';
  const proteinPart =
    proteinAdherencePercent !== null ? ` · חלבון ${proteinAdherencePercent}% מהיעד` : '';
  const summary = `${avgCalories}/${goal.calories} קל' (${calorieWord} ${Math.abs(calorieDeltaPercent)}%)${proteinPart}`;

  return {
    calorieGoal: goal.calories,
    avgCalories,
    calorieDeltaPercent,
    proteinGoal,
    avgProtein,
    proteinAdherencePercent,
    goalDirection,
    onTrack,
    summary,
  };
}
