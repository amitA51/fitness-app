// TDEE (Total Daily Energy Expenditure) Calculator
// Uses the Mifflin-St Jeor equation, the most accurate for active populations

export type ActivityMultiplier = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;

export interface TDEEResult {
  bmr: number; // Base Metabolic Rate
  tdee: number; // Total Daily Energy Expenditure
  cut: number; // Weight loss (-500 kcal)
  maintain: number; // Maintain weight
  bulk: number; // Gain weight (+300 kcal)
  protein: number; // Recommended protein (g)
  carbs: number; // Recommended carbs (g)
  fat: number; // Recommended fat (g)
}

export type WeightGoal = 'lose' | 'maintain' | 'gain';

const ACTIVITY_MAP: Record<string, ActivityMultiplier> = {
  'לא פעיל': 1.2,
  'פעיל מעט': 1.375,
  'פעיל מתון': 1.55,
  'פעיל מאוד': 1.725,
  ספורטאי: 1.9,
};

const GOAL_MAP: Record<string, WeightGoal> = {
  'ירידה במשקל': 'lose',
  'שמירה על משקל': 'maintain',
  'עלייה במסה': 'gain',
};

/**
 * "We cannot compute this" — returned whenever an input the formula genuinely
 * needs is missing, instead of substituting a plausible value. Callers must
 * treat a zero result as "no target" and show nothing, mirroring the Progress
 * page's rule for BMI: a health claim built on an assumed input is worse than
 * no claim, because it changes the category and not just the digit.
 */
const UNKNOWN_TDEE: TDEEResult = {
  bmr: 0,
  tdee: 0,
  cut: 0,
  maintain: 0,
  bulk: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

// Mifflin-St Jeor: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - s
// s = +5 for males, -161 for females
export function calculateBMR(
  weightKg: number | null,
  heightCm: number | null,
  age: number | null,
  gender: 'male' | 'female' | 'other' | ''
): number {
  // The sex term is worth ±166 kcal, so an unknown sex cannot be quietly read
  // as male — that is a fabricated health input, not a rounding choice.
  if (gender === '') return 0;
  // Mifflin-St Jeor is only defined for positive weight/height/age; guard so
  // bad input can't produce a negative/NaN BMR that propagates into macros.
  // `null` (the "not answered" sentinel) fails Number.isFinite by design.
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(age) ||
    (weightKg as number) <= 0 ||
    (heightCm as number) <= 0 ||
    (age as number) <= 0
  ) {
    return 0;
  }
  const s = gender === 'female' ? -161 : 5;
  return Math.round(
    10 * (weightKg as number) + 6.25 * (heightCm as number) - 5 * (age as number) + s
  );
}

export function calculateTDEE(
  weightKg: number | null,
  heightCm: number | null,
  age: number | null,
  gender: 'male' | 'female' | 'other' | '',
  activityLevel: string
): TDEEResult {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  if (bmr <= 0) {
    return UNKNOWN_TDEE;
  }
  // No fallback multiplier. The previous `?? 1.55` meant an unrecorded activity
  // level silently became "moderately active" HERE, so deleting the stored
  // field alone would only have moved the fabrication one layer down.
  const multiplier = ACTIVITY_MAP[activityLevel];
  if (multiplier === undefined) {
    return UNKNOWN_TDEE;
  }
  const tdee = Math.round(bmr * multiplier);

  const cut = tdee - 500;
  const maintain = tdee;
  const bulk = tdee + 300;

  // Macro split: 30% protein, 40% carbs, 30% fat (general fitness).
  // Fat is derived from the remaining calories so protein*4 + carbs*4 + fat*9
  // sums back to the calorie target instead of drifting from independent rounding.
  const protein = Math.round((tdee * 0.3) / 4);
  const carbs = Math.round((tdee * 0.4) / 4);
  const fat = Math.round((tdee - protein * 4 - carbs * 4) / 9);

  return { bmr, tdee, cut, maintain, bulk, protein, carbs, fat };
}

export function getMacroGoalsForGoal(
  tdeeResult: TDEEResult,
  goal: string
): { calories: number; protein: number; carbs: number; fat: number } {
  const goalType = GOAL_MAP[goal] ?? 'maintain';
  let calories: number;

  switch (goalType) {
    case 'lose':
      calories = tdeeResult.cut;
      break;
    case 'gain':
      calories = tdeeResult.bulk;
      break;
    default:
      calories = tdeeResult.maintain;
  }

  // Recompute macros from goal-adjusted calories (30% protein, 40% carbs, 30% fat).
  // Fat absorbs rounding so the macros sum back to the calorie target.
  const protein = Math.round((calories * 0.3) / 4);
  const carbs = Math.round((calories * 0.4) / 4);
  const fat = Math.round((calories - protein * 4 - carbs * 4) / 9);

  return { calories, protein, carbs, fat };
}
