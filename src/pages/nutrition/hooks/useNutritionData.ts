import { useCallback, useEffect, useMemo, useState } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { listMyAssignments } from '../../../services/coach';
import {
  DEFAULT_MACRO_GOALS,
  type DailyNutritionSummary,
  addFoodFromPreset,
  addMealEntry,
  createQuickMeal,
  deleteMealEntry,
  getDailyMacros,
  getMealEntriesByDate,
  getMealPresets,
  getWeeklyNutritionSummary,
  saveNutritionGoals,
} from '../../../services/nutritionService';
import type { MealPreset } from '../../../services/nutritionService';
import type { FoodItem, MacroNutrients, MealEntry, MealType } from '../../../types';
import { toLocalDateStr, todayStr } from '../../../utils/dateUtils';
import { triggerHapticEffect } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { safeJsonParse } from '../../../utils/safeJson';
import { useSearchFoods } from './useSearchFoods';

export function useNutritionData() {
  const [todayEntries, setTodayEntries] = useState<MealEntry[]>([]);
  const [todayMacros, setTodayMacros] = useState<MacroNutrients>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [macroGoals, setMacroGoals] = useState<MacroNutrients>(DEFAULT_MACRO_GOALS);
  const [coachTarget, setCoachTarget] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [isToday, setIsToday] = useState(true);
  const [waterHistory, setWaterHistory] = useState<{ date: string; total: number }[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<DailyNutritionSummary[]>([]);
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState<(FoodItem & { servings: number })[]>([]);
  const [activeTab, setActiveTab] = useState<'log' | 'library' | 'presets'>('log');
  // True only until the first day-load resolves, so the calorie/macro/journal
  // surfaces can show skeletons on initial mount instead of flashing zeros.
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const dateToUse = isToday ? todayStr() : selectedDate;
    const entries = await getMealEntriesByDate(dateToUse);
    setTodayEntries(entries);
    const macros = await getDailyMacros(dateToUse);
    setTodayMacros(macros);
    const summary = await getWeeklyNutritionSummary();
    setWeeklySummary(summary);
    setIsLoading(false);
  }, [selectedDate, isToday]);

  const loadWaterHistory = useCallback(async () => {
    const { getWaterByDateRange } = await import('../../../services/waterService');
    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(toLocalDateStr(d));
    }
    const startDate = dates[0] ?? '';
    const endDate = dates[dates.length - 1] ?? '';
    const entries = await getWaterByDateRange(startDate, endDate);
    const byDate = new Map<string, number>();
    for (const e of entries) {
      byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amountMl);
    }
    setWaterHistory(dates.map((d) => ({ date: d, total: byDate.get(d) ?? 0 })));
  }, []);

  useEffect(() => {
    loadData();
    loadWaterHistory();
    // Keep the 7-day chart fresh when a glass is added/removed anywhere,
    // mirroring the settings-updated pattern (the chart loaded once on mount).
    window.addEventListener('water-updated', loadWaterHistory);
    return () => window.removeEventListener('water-updated', loadWaterHistory);
  }, [loadData, loadWaterHistory]);

  const handleSaveMeal = useCallback(async () => {
    if (selectedFoods.length === 0) return;
    // createQuickMeal already sums macros via calcMacroTotals (one source of
    // truth) and stamps the selected day, so retroactive logging lands on the
    // day being viewed instead of always on today.
    const dateToUse = isToday ? todayStr() : selectedDate;
    const entry = createQuickMeal(
      selectedMealType,
      selectedFoods.map((f) => ({ ...f, servings: f.servings })),
      dateToUse
    );
    try {
      await addMealEntry(entry);
      triggerHapticEffect('success', 'light');
      showToast('הארוחה נשמרה');
      setShowAddMeal(false);
      setSelectedFoods([]);
      setSearchQuery('');
      loadData();
    } catch (error) {
      logger.ui.error('Failed to save meal', error);
      showToast('שמירת הארוחה נכשלה', { variant: 'error' });
    }
  }, [selectedFoods, selectedMealType, selectedDate, isToday, loadData]);

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      // Snapshot the full entry before deleting so the undo action can re-insert
      // it. The journal passes only the id, so we look it up in the loaded day.
      const removed = todayEntries.find((e) => e.id === id);
      await deleteMealEntry(id);
      triggerHapticEffect('tap', 'light');
      loadData();
      if (!removed) return;
      // addMealEntry strips id/createdAt and re-stamps fresh ones, so undo
      // re-creates the entry with identical data (date, name, meals, macros).
      const { id: _id, createdAt: _createdAt, ...fields } = removed;
      showToast('הארוחה נמחקה', {
        duration: 5000,
        action: {
          label: 'בטל',
          onClick: () => {
            void (async () => {
              try {
                await addMealEntry(fields);
                loadData();
              } catch (error) {
                logger.ui.error('Failed to undo meal delete', error);
                showToast('שחזור הארוחה נכשל', { variant: 'error' });
              }
            })();
          },
        },
      });
    },
    [loadData, todayEntries]
  );

  const handleQuickPreset = useCallback(
    async (preset: MealPreset, mealType: MealType) => {
      const dateToUse = isToday ? todayStr() : selectedDate;
      const entry = await addFoodFromPreset(preset.id, mealType, dateToUse);
      if (entry) {
        loadData();
      }
    },
    [selectedDate, isToday, loadData]
  );

  const goBack = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateStr(d));
    setIsToday(false);
  }, [selectedDate]);

  const goForward = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = todayStr();
    const newDate = toLocalDateStr(d);
    if (newDate >= today) {
      setSelectedDate(today);
      setIsToday(true);
    } else {
      setSelectedDate(newDate);
    }
  }, [selectedDate]);

  const handleAddFood = useCallback((food: FoodItem) => {
    setSelectedFoods((prev) => {
      const existing = prev.find((f) => f.id === food.id);
      if (existing) {
        return prev.map((f) => (f.id === food.id ? { ...f, servings: f.servings + 1 } : f));
      }
      return [...prev, { ...food, servings: 1 }];
    });
  }, []);

  const handleRemoveFood = useCallback((foodId: string) => {
    setSelectedFoods((prev) => prev.filter((f) => f.id !== foodId));
  }, []);

  const handleServingsChange = useCallback((foodId: string, delta: number) => {
    setSelectedFoods((prev) =>
      prev.map((f) => {
        if (f.id !== foodId) return f;
        return { ...f, servings: Math.max(0.5, f.servings + delta) };
      })
    );
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowAddMeal(false);
    setSelectedFoods([]);
  }, []);

  // Persist edited goals to the SAME key + event Settings uses. When a coach
  // target is active we refuse the write (the editor disables the form and
  // explains why) so a silent localStorage write can't be clobbered on reload.
  const handleSaveGoals = useCallback(
    (goals: MacroNutrients): boolean => {
      if (coachTarget) return false;
      saveNutritionGoals(goals);
      setShowGoalsEditor(false);
      return true;
    },
    [coachTarget]
  );

  // Read the user's saved macro goals from Settings
  useEffect(() => {
    const apply = () => {
      try {
        const raw = localStorage.getItem('nutrition_goals');
        const parsed = safeJsonParse<Partial<Record<keyof MacroNutrients, number | ''>>>(raw);
        if (!parsed) return;
        const pick = (v: number | '' | undefined, fallback: number) =>
          typeof v === 'number' && v > 0 ? v : fallback;
        setMacroGoals({
          calories: pick(parsed.calories, DEFAULT_MACRO_GOALS.calories),
          protein: pick(parsed.protein, DEFAULT_MACRO_GOALS.protein),
          carbs: pick(parsed.carbs, DEFAULT_MACRO_GOALS.carbs),
          fat: pick(parsed.fat, DEFAULT_MACRO_GOALS.fat),
        });
      } catch {
        /* ignore corrupt JSON */
      }
    };
    apply();
    window.addEventListener('storage', apply);
    window.addEventListener('settings-updated', apply);
    return () => {
      window.removeEventListener('storage', apply);
      window.removeEventListener('settings-updated', apply);
    };
  }, []);

  // Override goals with coach-assigned nutrition target (if any).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assignments = await listMyAssignments();
        const target = assignments.find((a) => a.kind === 'nutrition_target');
        if (cancelled || !target) return;
        const p = target.payload;
        const cal = typeof p.calories === 'number' ? p.calories : 0;
        if (!cal) return;
        setMacroGoals((prev) => ({
          calories: cal,
          protein: typeof p.protein === 'number' ? p.protein : prev.protein,
          carbs: typeof p.carbs === 'number' ? p.carbs : prev.carbs,
          fat: typeof p.fat === 'number' ? p.fat : prev.fat,
        }));
        setCoachTarget(true);
      } catch {
        /* degrade silently for offline/guest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFoods = useSearchFoods(searchQuery);
  const presets = useMemo(() => getMealPresets(), []);

  const calPct = Math.min(Math.round((todayMacros.calories / macroGoals.calories) * 100), 100);
  const proteinPct = Math.min(Math.round((todayMacros.protein / macroGoals.protein) * 100), 100);
  const carbsPct = Math.min(Math.round((todayMacros.carbs / macroGoals.carbs) * 100), 100);
  const fatPct = Math.min(Math.round((todayMacros.fat / macroGoals.fat) * 100), 100);

  return {
    todayEntries,
    todayMacros,
    macroGoals,
    coachTarget,
    isLoading,
    selectedDate,
    isToday,
    waterHistory,
    weeklySummary,
    showGoalsEditor,
    setShowGoalsEditor,
    handleSaveGoals,
    showAddMeal,
    setShowAddMeal,
    selectedMealType,
    setSelectedMealType,
    searchQuery,
    setSearchQuery,
    selectedFoods,
    activeTab,
    setActiveTab,
    filteredFoods,
    presets,
    calPct,
    proteinPct,
    carbsPct,
    fatPct,
    handleSaveMeal,
    handleDeleteEntry,
    handleQuickPreset,
    goBack,
    goForward,
    handleAddFood,
    handleRemoveFood,
    handleServingsChange,
    handleCloseModal,
  };
}
