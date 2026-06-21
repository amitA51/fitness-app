import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { parseLocalDate } from '../../../services/analytics/shared';
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
import { recordRecentFoods } from '../recentFoods';
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
  // True when the last day-load failed — the page swaps the skeleton for an
  // explicit error + retry instead of staying stuck on a permanent skeleton.
  const [loadError, setLoadError] = useState(false);

  // Per-day latch for the one-time "hit your calorie goal" celebration. Keyed by
  // date so it fires at most once per day, never re-firing on edit/reload: the
  // FIRST observation of a day silently latches if it already opened at/over
  // goal (a reload of an already-met day must not celebrate); only a live
  // under→over crossing within the session fires the haptic + toast.
  const goalCelebrationRef = useRef<{ date: string; seen: boolean; celebrated: boolean }>({
    date: '',
    seen: false,
    celebrated: false,
  });

  const loadData = useCallback(async () => {
    try {
      const dateToUse = isToday ? todayStr() : selectedDate;
      const entries = await getMealEntriesByDate(dateToUse);
      setTodayEntries(entries);
      const macros = await getDailyMacros(dateToUse);
      setTodayMacros(macros);
      const summary = await getWeeklyNutritionSummary();
      setWeeklySummary(summary);
      setLoadError(false);
    } catch (error) {
      logger.ui.error('Failed to load nutrition data', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
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

  // One-time daily-goal celebration. Fires only on a live under→over crossing of
  // the calorie goal for the day in view; the first observation of a day that
  // already opened at/over goal silently latches so a reload never celebrates.
  useEffect(() => {
    const activeDate = isToday ? todayStr() : selectedDate;
    const goalCal = macroGoals.calories;
    if (goalCal <= 0) return; // no goal → nothing to cross.
    const reached = todayMacros.calories >= goalCal;
    const latch = goalCelebrationRef.current;

    if (latch.date !== activeDate) {
      // First observation of this day: latch as "already celebrated" when it
      // opened at/over goal, so neither this load nor a later edit re-fires.
      goalCelebrationRef.current = { date: activeDate, seen: true, celebrated: reached };
      return;
    }
    if (!reached || latch.celebrated) return;

    goalCelebrationRef.current = { ...latch, celebrated: true };
    triggerHapticEffect('success');
    showToast('הגעת ליעד הקלורי היומי');
  }, [todayMacros.calories, macroGoals.calories, selectedDate, isToday]);

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
      // Remember what was logged so the modal's "אחרונים" shelf can offer
      // repeat meals without a search next time.
      recordRecentFoods(selectedFoods.map((f) => f.id));
      // Medium success haptic (was light): logging a meal should feel as
      // rewarding as logging water, which already uses the medium default.
      triggerHapticEffect('success');
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
      try {
        await deleteMealEntry(id);
      } catch (error) {
        logger.ui.error('Failed to delete meal entry', error);
        showToast('מחיקת הארוחה נכשלה', { variant: 'error' });
        return;
      }
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

  const handleRepeatEntry = useCallback(
    async (id: string) => {
      // Re-log a saved entry onto the day being viewed. Reuses the proven undo
      // re-create path: addMealEntry strips id/createdAt and re-stamps fresh
      // ones, so the copy carries identical name/meals/macros, re-dated to the
      // open day (retroactive logging stays on the viewed day, not today).
      const entry = todayEntries.find((e) => e.id === id);
      if (!entry) return;
      const dateToUse = isToday ? todayStr() : selectedDate;
      const { id: _id, createdAt: _createdAt, ...fields } = entry;
      try {
        await addMealEntry({ ...fields, date: dateToUse });
        triggerHapticEffect('success', 'light');
        showToast('הארוחה נרשמה שוב');
        loadData();
      } catch (error) {
        logger.ui.error('Failed to repeat meal entry', error);
        showToast('רישום הארוחה נכשל', { variant: 'error' });
      }
    },
    [todayEntries, selectedDate, isToday, loadData]
  );

  const handleQuickPreset = useCallback(
    async (preset: MealPreset, mealType: MealType) => {
      const dateToUse = isToday ? todayStr() : selectedDate;
      // Success/error feedback mirrors handleSaveMeal — previously a failed or
      // missing preset silently no-oped and the user couldn't tell anything ran.
      try {
        const entry = await addFoodFromPreset(preset.id, mealType, dateToUse);
        if (!entry) {
          showToast('הוספת הארוחה נכשלה', { variant: 'error' });
          return;
        }
        triggerHapticEffect('success', 'light');
        showToast('הארוחה נשמרה');
        loadData();
      } catch (error) {
        logger.ui.error('Failed to add meal from preset', error);
        showToast('הוספת הארוחה נכשלה', { variant: 'error' });
      }
    },
    [selectedDate, isToday, loadData]
  );

  const goBack = useCallback(() => {
    // parseLocalDate, not new Date('YYYY-MM-DD'): the latter parses as UTC
    // midnight and shifts the calendar day for users ahead of UTC (Israel).
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateStr(d));
    setIsToday(false);
  }, [selectedDate]);

  const goForward = useCallback(() => {
    const d = parseLocalDate(selectedDate);
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
    // Tactile confirmation the tap registered (the selected list can be
    // off-screen above the results) — matches WaterTracker's add feedback.
    triggerHapticEffect('tap', 'light');
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
        // Only an ACTIVE nutrition_target overrides the user's own goals; a
        // paused/ended assignment must not keep clamping their macros. When more
        // than one is active (e.g. the coach re-issued the target), newest wins.
        const target = assignments
          .filter((a) => a.kind === 'nutrition_target' && a.status === 'active')
          .sort((a, b) =>
            (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '')
          )[0];
        if (cancelled || !target) return;
        const p = target.payload;
        const cal = typeof p.calories === 'number' && p.calories > 0 ? p.calories : 0;
        if (!cal) return;
        // Require > 0 (not just typeof): a 0 macro target would zero the goal
        // and divide-by-zero the percentage math downstream.
        const pickTarget = (v: unknown, fallback: number) =>
          typeof v === 'number' && v > 0 ? v : fallback;
        setMacroGoals((prev) => ({
          calories: cal,
          protein: pickTarget(p.protein, prev.protein),
          carbs: pickTarget(p.carbs, prev.carbs),
          fat: pickTarget(p.fat, prev.fat),
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

  const proteinPct = Math.min(Math.round((todayMacros.protein / macroGoals.protein) * 100), 100);
  const carbsPct = Math.min(Math.round((todayMacros.carbs / macroGoals.carbs) * 100), 100);
  const fatPct = Math.min(Math.round((todayMacros.fat / macroGoals.fat) * 100), 100);

  return {
    todayEntries,
    todayMacros,
    macroGoals,
    coachTarget,
    isLoading,
    loadError,
    retryLoad: loadData,
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
    proteinPct,
    carbsPct,
    fatPct,
    handleSaveMeal,
    handleDeleteEntry,
    handleRepeatEntry,
    handleQuickPreset,
    goBack,
    goForward,
    handleAddFood,
    handleRemoveFood,
    handleServingsChange,
    handleCloseModal,
  };
}
