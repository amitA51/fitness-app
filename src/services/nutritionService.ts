import {
  Apple,
  Coffee,
  Dumbbell,
  type LucideIcon,
  Salad,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import type { FoodItem, MacroNutrients, MealEntry, MealType } from '../types';
import { toLocalDateStr, todayStr } from '../utils/dateUtils';
import { generateId } from '../utils/id';
import { KCAL_PER_GRAM, kcalFromMacros } from '../utils/nutritionMath';
import { writeJsonStorage } from '../utils/safeJson';
import { STORES, dbDelete, dbGetAll, dbGetByRange, dbPut } from './indexedDBCore';
import { mirrorLocalKey } from './localStateMirror';
import { FOOD_LIBRARY, MEAL_PRESETS, type MealPreset } from './nutritionData';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudNutritionLog, syncNutritionLog } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

// Re-exported so existing importers (MealPresetCard, useNutritionData) keep
// importing the MealPreset type from this module unchanged.
export type { MealPreset };

export const DEFAULT_MACRO_GOALS: MacroNutrients = {
  calories: 2500,
  protein: 150,
  carbs: 300,
  fat: 80,
};

/** localStorage key shared with Settings for the user's manual macro goals. */
export const NUTRITION_GOALS_KEY = 'nutrition_goals';

/**
 * Persist the user's macro goals to the SAME localStorage key Settings uses and
 * broadcast the SAME `settings-updated` event, so every existing listener
 * (nutrition hook, settings screen) stays in sync from a single write path.
 */
export function saveNutritionGoals(goals: MacroNutrients): void {
  writeJsonStorage(NUTRITION_GOALS_KEY, {
    calories: goals.calories,
    protein: goals.protein,
    carbs: goals.carbs,
    fat: goals.fat,
  });
  // Back the goals up to the cloud. They were localStorage-only AND wiped on an
  // account switch, so the targets the whole nutrition screen compares against
  // were unrecoverable. See services/localStateMirror.
  mirrorLocalKey(NUTRITION_GOALS_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settings-updated'));
  }
}

/**
 * Single source of truth for summing a list of foods into macro totals.
 * Rounds each food's contribution consistently (calories to integer, macros to
 * one decimal) so the meal modal, quick-save, and presets never drift apart.
 */
export function calcMacroTotals(foods: FoodItem[]): MacroNutrients {
  return foods.reduce<MacroNutrients>(
    (acc, f) => ({
      calories: acc.calories + Math.round(f.calories * f.servings),
      protein: acc.protein + Math.round(f.protein * f.servings * 10) / 10,
      carbs: acc.carbs + Math.round(f.carbs * f.servings * 10) / 10,
      fat: acc.fat + Math.round(f.fat * f.servings * 10) / 10,
      fiber: (acc.fiber ?? 0) + Math.round((f.fiber ?? 0) * f.servings * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

/**
 * Sum macro totals across a list of meal entries. Used for per-meal-type group
 * summaries in the journal so the math matches calcMacroTotals' rounding.
 */
export function sumEntryMacros(entries: MealEntry[]): MacroNutrients {
  return entries.reduce<MacroNutrients>(
    (acc, e) => ({
      calories: acc.calories + (e.totalMacros?.calories ?? 0),
      protein: Math.round((acc.protein + (e.totalMacros?.protein ?? 0)) * 10) / 10,
      carbs: Math.round((acc.carbs + (e.totalMacros?.carbs ?? 0)) * 10) / 10,
      fat: Math.round((acc.fat + (e.totalMacros?.fat ?? 0)) * 10) / 10,
      fiber: Math.round(((acc.fiber ?? 0) + (e.totalMacros?.fiber ?? 0)) * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
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
  return FOOD_LIBRARY.filter((f) => f.name.toLowerCase().includes(q));
}

export async function addFoodFromPreset(
  presetId: string,
  mealType: MealType,
  date: string = todayStr()
): Promise<MealEntry | null> {
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
    // Entry id must be a UUID: cloud nutrition_logs.id is uuid and PostgREST
    // rejects `meal-...` ids with 22P02. Inner meal ids live inside the jsonb
    // `meals` column, so they may keep the prefixed format.
    id: crypto.randomUUID?.() || generateId('meal'),
    date,
    name: preset.name,
    meals: [
      {
        id: generateId('meal'),
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

  await dbPut(STORES.NUTRITION_LOGS, mealEntry);

  void (async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        const syncPayload = {
          id: mealEntry.id,
          date: mealEntry.date,
          calories: Math.round(mealEntry.totalMacros.calories),
          protein: Math.round(mealEntry.totalMacros.protein),
          carbs: Math.round(mealEntry.totalMacros.carbs),
          fat: Math.round(mealEntry.totalMacros.fat),
          meals: mealEntry.meals.map((m) => ({
            id: m.id,
            name: m.name,
            calories: Math.round(m.totalMacros.calories),
            protein: Math.round(m.totalMacros.protein),
            carbs: Math.round(m.totalMacros.carbs),
            fat: Math.round(m.totalMacros.fat),
            time: m.time,
          })),
          notes: mealEntry.notes,
          createdAt: mealEntry.createdAt,
        };
        syncWithRetry(
          () => syncNutritionLog(user.id, syncPayload),
          `addMealEntryFromPreset:${mealEntry.id}`,
          3,
          { type: 'nutrition:update', payload: syncPayload }
        );
      }
    } catch {
      // Best-effort sync — failure is handled by the retry queue
    }
  })();

  return mealEntry;
}

export async function addMealEntry(entry: Omit<MealEntry, 'id' | 'createdAt'>): Promise<MealEntry> {
  const newEntry: MealEntry = {
    ...entry,
    // UUID — cloud nutrition_logs.id is uuid (see addFoodFromPreset).
    id: crypto.randomUUID?.() || generateId('meal'),
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORES.NUTRITION_LOGS, newEntry);

  const user = await getCurrentUser();
  if (user) {
    const syncPayload = {
      id: newEntry.id,
      date: newEntry.date,
      calories: Math.round(newEntry.totalMacros.calories),
      protein: Math.round(newEntry.totalMacros.protein),
      carbs: Math.round(newEntry.totalMacros.carbs),
      fat: Math.round(newEntry.totalMacros.fat),
      meals: newEntry.meals.map((m) => ({
        id: m.id,
        name: m.name,
        calories: Math.round(m.totalMacros.calories),
        protein: Math.round(m.totalMacros.protein),
        carbs: Math.round(m.totalMacros.carbs),
        fat: Math.round(m.totalMacros.fat),
        time: m.time,
      })),
      notes: newEntry.notes,
      createdAt: newEntry.createdAt,
    };
    syncWithRetry(() => syncNutritionLog(user.id, syncPayload), `addMealEntry:${newEntry.id}`, 3, {
      type: 'nutrition:update',
      payload: syncPayload,
    });
  }

  return newEntry;
}

export async function updateMealEntry(entry: MealEntry): Promise<void> {
  await dbPut(STORES.NUTRITION_LOGS, entry);

  const user = await getCurrentUser();
  if (user) {
    const syncPayload = {
      id: entry.id,
      date: entry.date,
      calories: Math.round(entry.totalMacros.calories),
      protein: Math.round(entry.totalMacros.protein),
      carbs: Math.round(entry.totalMacros.carbs),
      fat: Math.round(entry.totalMacros.fat),
      meals: entry.meals.map((m) => ({
        id: m.id,
        name: m.name,
        calories: Math.round(m.totalMacros.calories),
        protein: Math.round(m.totalMacros.protein),
        carbs: Math.round(m.totalMacros.carbs),
        fat: Math.round(m.totalMacros.fat),
        time: m.time,
      })),
      notes: entry.notes,
      createdAt: entry.createdAt,
    };
    syncWithRetry(() => syncNutritionLog(user.id, syncPayload), `updateMealEntry:${entry.id}`, 3, {
      type: 'nutrition:update',
      payload: syncPayload,
    });
  }
}

export async function deleteMealEntry(id: string): Promise<void> {
  await dbDelete(STORES.NUTRITION_LOGS, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudNutritionLog(user.id, id), `deleteMealEntry:${id}`, 3, {
      type: 'nutrition:delete',
      payload: id,
    });
  }
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
      calories: acc.calories + (e.totalMacros?.calories ?? 0),
      protein: acc.protein + (e.totalMacros?.protein ?? 0),
      carbs: acc.carbs + (e.totalMacros?.carbs ?? 0),
      fat: acc.fat + (e.totalMacros?.fat ?? 0),
      fiber: (acc.fiber ?? 0) + (e.totalMacros?.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
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
  const totalCaloriesFromMacros = kcalFromMacros(macros.protein, macros.carbs, macros.fat);
  if (totalCaloriesFromMacros === 0) return { proteinPct: 0, carbsPct: 0, fatPct: 0 };
  return {
    proteinPct: Math.round(
      ((macros.protein * KCAL_PER_GRAM.protein) / totalCaloriesFromMacros) * 100
    ),
    carbsPct: Math.round(((macros.carbs * KCAL_PER_GRAM.carbs) / totalCaloriesFromMacros) * 100),
    fatPct: Math.round(((macros.fat * KCAL_PER_GRAM.fat) / totalCaloriesFromMacros) * 100),
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
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(toLocalDateStr(date));
  }

  const allEntries = await dbGetByRange<MealEntry>(
    STORES.NUTRITION_LOGS,
    'date',
    dates[0] ?? '',
    dates[dates.length - 1] ?? ''
  );
  const entriesByDate = new Map<string, MealEntry[]>();
  for (const entry of allEntries) {
    const existing = entriesByDate.get(entry.date) ?? [];
    existing.push(entry);
    entriesByDate.set(entry.date, existing);
  }

  return dates.map((dateStr) => {
    const entries = entriesByDate.get(dateStr) ?? [];
    const macros = entries.reduce<MacroNutrients>(
      (acc, e) => ({
        calories: acc.calories + (e.totalMacros?.calories ?? 0),
        protein: acc.protein + (e.totalMacros?.protein ?? 0),
        carbs: acc.carbs + (e.totalMacros?.carbs ?? 0),
        fat: acc.fat + (e.totalMacros?.fat ?? 0),
        fiber: (acc.fiber ?? 0) + (e.totalMacros?.fiber ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
    return {
      date: dateStr,
      macros,
      mealCount: entries.length,
      macroPercentages: getMacroPercentages(macros),
    };
  });
}

export function createQuickMeal(
  mealType: MealType,
  foods: FoodItem[],
  date: string = todayStr()
): MealEntry {
  const totalMacros = calcMacroTotals(foods);
  // Name the entry after its foods (first food + count) rather than the meal
  // type, so the card title doesn't duplicate the meal-type eyebrow/group header.
  const firstFood = foods[0]?.name ?? MEAL_TYPE_LABELS[mealType];
  const name = foods.length > 1 ? `${firstFood} +${foods.length - 1}` : firstFood;
  return {
    // UUID — cloud nutrition_logs.id is uuid (see addFoodFromPreset).
    id: crypto.randomUUID?.() || generateId('meal'),
    date,
    name,
    meals: [
      {
        id: generateId('meal'),
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

export const MEAL_TYPE_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Salad,
  dinner: UtensilsCrossed,
  snack: Apple,
  'pre-workout': Dumbbell,
  'post-workout': Zap,
};

export function calcFoodMacros(food: FoodItem): MacroNutrients {
  return {
    calories: Math.round(food.calories * food.servings),
    protein: Math.round(food.protein * food.servings * 10) / 10,
    carbs: Math.round(food.carbs * food.servings * 10) / 10,
    fat: Math.round(food.fat * food.servings * 10) / 10,
    fiber: Math.round((food.fiber ?? 0) * food.servings * 10) / 10,
  };
}
