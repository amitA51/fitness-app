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

// Mifflin-St Jeor: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - s
// s = +5 for males, -161 for females
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | 'other'
): number {
  const s = gender === 'female' ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | 'other',
  activityLevel: string
): TDEEResult {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const multiplier = ACTIVITY_MAP[activityLevel] ?? 1.55;
  const tdee = Math.round(bmr * multiplier);

  const cut = tdee - 500;
  const maintain = tdee;
  const bulk = tdee + 300;

  // Macro split: 30% protein, 40% carbs, 30% fat (general fitness)
  const protein = Math.round((tdee * 0.3) / 4);
  const carbs = Math.round((tdee * 0.4) / 4);
  const fat = Math.round((tdee * 0.3) / 9);

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

  // Recompute macros from goal-adjusted calories (30% protein, 40% carbs, 30% fat)
  const protein = Math.round((calories * 0.3) / 4);
  const carbs = Math.round((calories * 0.4) / 4);
  const fat = Math.round((calories * 0.3) / 9);

  return { calories, protein, carbs, fat };
}
