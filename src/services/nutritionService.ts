import type { FoodItem, MacroNutrients, MealEntry, MealType } from '../types';
import { STORES, dbDelete, dbGetAll, dbPut } from './indexedDBCore';

const FOOD_LIBRARY: FoodItem[] = [
  {
    id: 'food-1',
    name: 'חזה עוף',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-2',
    name: 'אורז לבן מבושל',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-3',
    name: 'ביצה קשה',
    calories: 78,
    protein: 6,
    carbs: 0.6,
    fat: 5,
    fiber: 0,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-4',
    name: 'טונה בשמן',
    calories: 190,
    protein: 27,
    carbs: 0,
    fat: 9,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-5',
    name: 'לחם מחיטה מלאה',
    calories: 80,
    protein: 4,
    carbs: 14,
    fat: 1,
    fiber: 2,
    servingSize: 'פרוסה',
    servings: 1,
  },
  {
    id: 'food-6',
    name: 'חומוס',
    calories: 166,
    protein: 8,
    carbs: 14,
    fat: 10,
    fiber: 4,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-7',
    name: 'גבינה לבנה 5%',
    calories: 80,
    protein: 12,
    carbs: 4,
    fat: 5,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-8',
    name: 'שיבולת שועל',
    calories: 150,
    protein: 5,
    carbs: 27,
    fat: 3,
    fiber: 4,
    servingSize: '40ג',
    servings: 1,
  },
  {
    id: 'food-9',
    name: 'בננה',
    calories: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
    fiber: 3,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-10',
    name: 'תפוח',
    calories: 95,
    protein: 0.5,
    carbs: 25,
    fat: 0.3,
    fiber: 4,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-11',
    name: 'בטטה אפויה',
    calories: 103,
    protein: 2,
    carbs: 24,
    fat: 0.1,
    fiber: 4,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-12',
    name: 'אבוקדו',
    calories: 160,
    protein: 2,
    carbs: 9,
    fat: 15,
    fiber: 7,
    servingSize: 'חצי',
    servings: 1,
  },
  {
    id: 'food-13',
    name: 'יוגורט יווני',
    calories: 100,
    protein: 17,
    carbs: 6,
    fat: 0.7,
    fiber: 0,
    servingSize: '170ג',
    servings: 1,
  },
  {
    id: 'food-14',
    name: 'חלב 2%',
    calories: 120,
    protein: 8,
    carbs: 12,
    fat: 5,
    fiber: 0,
    servingSize: 'כוס',
    servings: 1,
  },
  {
    id: 'food-15',
    name: 'פסטה מבושלת',
    calories: 160,
    protein: 5.5,
    carbs: 31,
    fat: 1,
    fiber: 1.8,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-16',
    name: 'סלמון',
    calories: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-17',
    name: 'שקדים',
    calories: 165,
    protein: 6,
    carbs: 6,
    fat: 14,
    fiber: 3,
    servingSize: '28ג',
    servings: 1,
  },
  {
    id: 'food-18',
    name: 'חמאת בוטנים',
    calories: 190,
    protein: 7,
    carbs: 6,
    fat: 16,
    fiber: 2,
    servingSize: '2 כפות',
    servings: 1,
  },
  {
    id: 'food-19',
    name: 'שמן זית',
    calories: 120,
    protein: 0,
    carbs: 0,
    fat: 14,
    fiber: 0,
    servingSize: 'כף',
    servings: 1,
  },
  {
    id: 'food-20',
    name: 'תמרים',
    calories: 66,
    protein: 0.4,
    carbs: 18,
    fat: 0.1,
    fiber: 1.6,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-21',
    name: 'טחינה',
    calories: 190,
    protein: 5,
    carbs: 8,
    fat: 17,
    fiber: 2,
    servingSize: '2 כפות',
    servings: 1,
  },
  {
    id: 'food-22',
    name: 'פיתה',
    calories: 170,
    protein: 5.5,
    carbs: 33,
    fat: 1,
    fiber: 1.5,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-23',
    name: 'שווארמה הודו',
    calories: 210,
    protein: 25,
    carbs: 3,
    fat: 11,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-24',
    name: 'פלאפל',
    calories: 333,
    protein: 13,
    carbs: 32,
    fat: 18,
    fiber: 4,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-25',
    name: 'שניצל עוף',
    calories: 230,
    protein: 18,
    carbs: 10,
    fat: 13,
    fiber: 0.5,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-26',
    name: 'סביח',
    calories: 450,
    protein: 15,
    carbs: 45,
    fat: 23,
    fiber: 5,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-27',
    name: 'בורקס',
    calories: 320,
    protein: 8,
    carbs: 28,
    fat: 20,
    fiber: 1,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-28',
    name: 'שקשוקה',
    calories: 280,
    protein: 16,
    carbs: 12,
    fat: 20,
    fiber: 3,
    servingSize: 'מנה',
    servings: 1,
  },
  {
    id: 'food-29',
    name: 'מלבי',
    calories: 180,
    protein: 4,
    carbs: 30,
    fat: 5,
    fiber: 0,
    servingSize: 'מנה',
    servings: 1,
  },
  {
    id: 'food-30',
    name: 'בקלאווה',
    calories: 340,
    protein: 4,
    carbs: 38,
    fat: 19,
    fiber: 1,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-31',
    name: "קוטג' 9%",
    calories: 110,
    protein: 14,
    carbs: 3,
    fat: 9,
    fiber: 0,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-32',
    name: 'אורז אדום',
    calories: 110,
    protein: 2.5,
    carbs: 23,
    fat: 0.8,
    fiber: 2,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-33',
    name: 'דגני בוקר',
    calories: 230,
    protein: 7,
    carbs: 42,
    fat: 3,
    fiber: 5,
    servingSize: '50ג',
    servings: 1,
  },
  {
    id: 'food-34',
    name: 'פרוטאין שייק',
    calories: 120,
    protein: 24,
    carbs: 3,
    fat: 1.5,
    fiber: 0,
    servingSize: 'כף',
    servings: 1,
  },
  {
    id: 'food-35',
    name: 'סלט ירקות',
    calories: 45,
    protein: 2,
    carbs: 8,
    fat: 0.5,
    fiber: 3,
    servingSize: 'מנה',
    servings: 1,
  },
  {
    id: 'food-36',
    name: 'כרובית',
    calories: 25,
    protein: 1.9,
    carbs: 5,
    fat: 0.1,
    fiber: 2,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-37',
    name: 'ברוקולי',
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
    fiber: 2.6,
    servingSize: '100ג',
    servings: 1,
  },
  {
    id: 'food-38',
    name: 'מלפפון',
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
    fiber: 0.5,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-39',
    name: 'עגבניה',
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    fiber: 1.2,
    servingSize: 'יחידה',
    servings: 1,
  },
  {
    id: 'food-40',
    name: 'בצל',
    calories: 40,
    protein: 1.1,
    carbs: 9,
    fat: 0.1,
    fiber: 1.7,
    servingSize: 'יחידה',
    servings: 1,
  },
];

const MEAL_PRESETS: MealPreset[] = [
  {
    id: 'preset-1',
    name: 'ארוחת בוקר ישראלית',
    description: 'ביצים, ירקות, לחם וגבינה',
    meals: [
      { foodId: 'food-3', servings: 2 },
      { foodId: 'food-5', servings: 2 },
      { foodId: 'food-7', servings: 1 },
      { foodId: 'food-35', servings: 1 },
    ],
  },
  {
    id: 'preset-2',
    name: 'שייק חלבון מהיר',
    description: 'שייק חלבון עם בננה ושיבולת שועל',
    meals: [
      { foodId: 'food-34', servings: 2 },
      { foodId: 'food-9', servings: 1 },
      { foodId: 'food-8', servings: 1 },
      { foodId: 'food-14', servings: 1 },
    ],
  },
  {
    id: 'preset-3',
    name: 'ארוחת צהריים - עוף ואורז',
    description: 'חזה עוף עם אורז וסלט',
    meals: [
      { foodId: 'food-1', servings: 2 },
      { foodId: 'food-2', servings: 1.5 },
      { foodId: 'food-35', servings: 1 },
      { foodId: 'food-19', servings: 1 },
    ],
  },
  {
    id: 'preset-4',
    name: "סנדוויץ' טונה",
    description: 'כריך טונה עם ירקות',
    meals: [
      { foodId: 'food-4', servings: 1 },
      { foodId: 'food-5', servings: 2 },
      { foodId: 'food-35', servings: 1 },
    ],
  },
  {
    id: 'preset-5',
    name: 'ארוחת ערב קלה',
    description: 'סלמון עם ירקות ובטטה',
    meals: [
      { foodId: 'food-16', servings: 1.5 },
      { foodId: 'food-11', servings: 1 },
      { foodId: 'food-37', servings: 1 },
      { foodId: 'food-12', servings: 0.5 },
    ],
  },
  {
    id: 'preset-6',
    name: 'פיתה חומוס',
    description: 'פיתה עם חומוס וירקות',
    meals: [
      { foodId: 'food-22', servings: 1 },
      { foodId: 'food-6', servings: 1 },
      { foodId: 'food-35', servings: 1 },
    ],
  },
  {
    id: 'preset-7',
    name: 'שקשוקה ביתית',
    description: 'שקשוקה עם לחם',
    meals: [
      { foodId: 'food-28', servings: 1 },
      { foodId: 'food-5', servings: 1 },
    ],
  },
  {
    id: 'preset-8',
    name: 'ארוחה אחרי אימון',
    description: 'חלבון גבוה להתאוששות',
    meals: [
      { foodId: 'food-1', servings: 2 },
      { foodId: 'food-13', servings: 1 },
      { foodId: 'food-9', servings: 1 },
      { foodId: 'food-17', servings: 1 },
    ],
  },
];

export interface MealPreset {
  id: string;
  name: string;
  description: string;
  meals: { foodId: string; servings: number }[];
}

function generateId(): string {
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function calcMacroTotals(foods: FoodItem[]): MacroNutrients {
  return foods.reduce<MacroNutrients>(
    (acc, f) => ({
      calories: acc.calories + Math.round(f.calories * f.servings),
      protein: acc.protein + Math.round(f.protein * f.servings * 10) / 10,
      carbs: acc.carbs + Math.round(f.carbs * f.servings * 10) / 10,
      fat: acc.fat + Math.round(f.fat * f.servings * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function getFoodLibrary(): FoodItem[] {
  return FOOD_LIBRARY;
}

export function getMealPresets(): MealPreset[] {
  return MEAL_PRESETS;
}

export function searchFoods(query: string): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return FOOD_LIBRARY;
  return FOOD_LIBRARY.filter(
    (f) => f.name.includes(q) || (f.brand && f.brand.toLowerCase().includes(q))
  );
}

export function addFoodFromPreset(presetId: string, mealType: MealType): MealEntry | null {
  const preset = MEAL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  const foods = preset.meals
    .map((m) => {
      const food = FOOD_LIBRARY.find((f) => f.id === m.foodId);
      if (!food) return null;
      return { ...food, servings: m.servings };
    })
    .filter(Boolean) as FoodItem[];

  const totalMacros = calcMacroTotals(foods);
  const mealEntry: MealEntry = {
    id: generateId(),
    date: todayStr(),
    name: preset.name,
    meals: [
      {
        id: `m-${Date.now()}`,
        name: mealType,
        foods,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        totalMacros,
      },
    ],
    totalMacros,
    notes: '',
    createdAt: new Date().toISOString(),
  };

  dbPut(STORES.NUTRITION_LOGS, mealEntry);
  return mealEntry;
}

export async function addMealEntry(entry: Omit<MealEntry, 'id' | 'createdAt'>): Promise<MealEntry> {
  const newEntry: MealEntry = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORES.NUTRITION_LOGS, newEntry);
  return newEntry;
}

export async function updateMealEntry(entry: MealEntry): Promise<void> {
  await dbPut(STORES.NUTRITION_LOGS, entry);
}

export async function deleteMealEntry(id: string): Promise<void> {
  await dbDelete(STORES.NUTRITION_LOGS, id);
}

export async function getMealEntriesByDate(date: string): Promise<MealEntry[]> {
  const all = await dbGetAll<MealEntry>(STORES.NUTRITION_LOGS);
  return all.filter((e) => e.date === date);
}

export async function getMealEntriesByDateRange(
  startDate: string,
  endDate: string
): Promise<MealEntry[]> {
  const all = await dbGetAll<MealEntry>(STORES.NUTRITION_LOGS);
  return all.filter((e) => e.date >= startDate && e.date <= endDate);
}

export async function getTodayMealEntries(): Promise<MealEntry[]> {
  return getMealEntriesByDate(todayStr());
}

export async function getDailyMacros(date: string): Promise<MacroNutrients> {
  const entries = await getMealEntriesByDate(date);
  return entries.reduce<MacroNutrients>(
    (acc, e) => ({
      calories: acc.calories + e.totalMacros.calories,
      protein: acc.protein + e.totalMacros.protein,
      carbs: acc.carbs + e.totalMacros.carbs,
      fat: acc.fat + e.totalMacros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export async function getTodayMacros(): Promise<MacroNutrients> {
  return getDailyMacros(todayStr());
}

export function getMacroPercentages(macros: MacroNutrients): {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
} {
  const totalCaloriesFromMacros = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
  if (totalCaloriesFromMacros === 0) return { proteinPct: 0, carbsPct: 0, fatPct: 0 };
  return {
    proteinPct: Math.round(((macros.protein * 4) / totalCaloriesFromMacros) * 100),
    carbsPct: Math.round(((macros.carbs * 4) / totalCaloriesFromMacros) * 100),
    fatPct: Math.round(((macros.fat * 9) / totalCaloriesFromMacros) * 100),
  };
}

export interface DailyNutritionSummary {
  date: string;
  macros: MacroNutrients;
  mealCount: number;
  macroPercentages: { proteinPct: number; carbsPct: number; fatPct: number };
}

export async function getWeeklyNutritionSummary(): Promise<DailyNutritionSummary[]> {
  const today = new Date();
  const results: DailyNutritionSummary[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0] ?? '';
    const macros = await getDailyMacros(dateStr);
    const entries = await getMealEntriesByDate(dateStr);
    results.push({
      date: dateStr,
      macros,
      mealCount: entries.length,
      macroPercentages: getMacroPercentages(macros),
    });
  }
  return results;
}

export function createQuickMeal(mealType: MealType, foods: FoodItem[]): MealEntry {
  const totalMacros = calcMacroTotals(foods);
  return {
    id: generateId(),
    date: todayStr(),
    name: `${MEAL_TYPE_LABELS[mealType]}`,
    meals: [
      {
        id: `m-${Date.now()}`,
        name: mealType,
        foods,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        totalMacros,
      },
    ],
    totalMacros,
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
  snack: 'חטיף',
  'pre-workout': 'לפני אימון',
  'post-workout': 'אחרי אימון',
};

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
  'pre-workout': '⚡',
  'post-workout': '💪',
};

export function calcFoodMacros(food: FoodItem): MacroNutrients {
  return {
    calories: Math.round(food.calories * food.servings),
    protein: Math.round(food.protein * food.servings * 10) / 10,
    carbs: Math.round(food.carbs * food.servings * 10) / 10,
    fat: Math.round(food.fat * food.servings * 10) / 10,
  };
}
