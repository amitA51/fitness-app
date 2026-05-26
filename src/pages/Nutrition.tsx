import { AnimatePresence, motion } from 'framer-motion';
import {
  Beef,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Droplets,
  Flame,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { WaterTracker } from '../components/nutrition/WaterTracker';
import {
  DEFAULT_MACRO_GOALS,
  MEAL_TYPE_ICONS,
  MEAL_TYPE_LABELS,
  addFoodFromPreset,
  addMealEntry,
  calcFoodMacros,
  createQuickMeal,
  deleteMealEntry,
  getDailyMacros,
  getFoodLibrary,
  getMealEntriesByDate,
  getMealPresets,
  searchFoods,
} from '../services/nutritionService';
import type { MealPreset } from '../services/nutritionService';
import type { FoodItem, MacroNutrients, MealEntry, MealType } from '../types';
import { safeJsonParse } from '../utils/safeJson';

const MACRO_COLORS = {
  calories: 'var(--fs-warn)',
  protein: 'var(--fs-accent)',
  carbs: 'var(--fs-accent-2)',
  fat: 'var(--fs-signal)',
};

type MealTab = 'log' | 'library' | 'presets';

export default function NutritionPage() {
  const [todayEntries, setTodayEntries] = useState<MealEntry[]>([]);
  const [todayMacros, setTodayMacros] = useState<MacroNutrients>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  // Effective macro goals — user-saved values from Settings, falling back to
  // built-in defaults. Settings stores `number | ''`; an empty string means
  // "use default for this macro".
  const [macroGoals, setMacroGoals] = useState<MacroNutrients>(DEFAULT_MACRO_GOALS);
  const [activeTab, setActiveTab] = useState<MealTab>('log');
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState<(FoodItem & { servings: number })[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split('T')[0] ?? ''
  );
  const [isToday, setIsToday] = useState(true);
  const [waterHistory, setWaterHistory] = useState<{ date: string; total: number }[]>([]);

  const loadData = useCallback(async () => {
    const dateToUse = isToday ? (new Date().toISOString().split('T')[0] ?? '') : selectedDate;
    const entries = await getMealEntriesByDate(dateToUse);
    setTodayEntries(entries);
    const macros = await getDailyMacros(dateToUse);
    setTodayMacros(macros);
  }, [selectedDate, isToday]);

  const loadWaterHistory = useCallback(async () => {
    const { getWaterByDateRange } = await import('../services/waterService');
    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0] ?? '');
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
  }, [loadData, loadWaterHistory]);

  const handleSaveMeal = useCallback(async () => {
    if (selectedFoods.length === 0) return;
    const entry = createQuickMeal(
      selectedMealType,
      selectedFoods.map((f) => ({ ...f, servings: f.servings }))
    );
    const totalMacros = selectedFoods.reduce(
      (acc, f) => {
        const m = calcFoodMacros(f);
        return {
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fat: acc.fat + m.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const fullEntry: MealEntry = { ...entry, totalMacros };
    await addMealEntry(fullEntry);
    setShowAddMeal(false);
    setSelectedFoods([]);
    setSearchQuery('');
    loadData();
  }, [selectedFoods, selectedMealType, loadData]);

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      await deleteMealEntry(id);
      loadData();
    },
    [loadData]
  );

  const handleQuickPreset = useCallback(
    async (preset: MealPreset, mealType: MealType) => {
      const entry = await addFoodFromPreset(preset.id, mealType);
      if (entry) {
        loadData();
      }
    },
    [loadData]
  );

  const goBack = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0] ?? '');
    setIsToday(false);
  }, [selectedDate]);

  const goForward = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date().toISOString().split('T')[0] ?? '';
    const newDate = d.toISOString().split('T')[0] ?? '';
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

  const filteredFoods = useMemo(() => searchFoods(searchQuery), [searchQuery]);
  const presets = useMemo(() => getMealPresets(), []);

  // Read the user's saved macro goals from Settings on mount and whenever
  // Settings dispatches an update (Settings persists via `saveToStorage`).
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
    return () => window.removeEventListener('storage', apply);
  }, []);

  const calPct = Math.min(Math.round((todayMacros.calories / macroGoals.calories) * 100), 100);
  const proteinPct = Math.min(Math.round((todayMacros.protein / macroGoals.protein) * 100), 100);
  const carbsPct = Math.min(Math.round((todayMacros.carbs / macroGoals.carbs) * 100), 100);
  const fatPct = Math.min(Math.round((todayMacros.fat / macroGoals.fat) * 100), 100);

  const TABS = useMemo<{ key: MealTab; label: string; icon: React.ReactNode }[]>(
    () => [
      { key: 'log', label: 'יומן', icon: <Clock size={15} /> },
      { key: 'library', label: 'מזון', icon: <Search size={15} /> },
      { key: 'presets', label: 'ארוחות', icon: <BookOpen size={15} /> },
    ],
    []
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    []
  );

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header */}
      <header
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
          paddingBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fs-muted)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {todayLabel} · {todayMacros.calories || 0}/{macroGoals.calories} קל׳
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
            margin: '4px 0 0',
          }}
        >
          תזונה
        </h1>
      </header>

      {/* Block Hero — today's calories */}
      <div className="block-hero section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in">
        <span className="ribbon">{calPct}% · GOAL</span>
        <div className="label">נצרך היום · CONSUMED TODAY</div>
        <div className="number kinetic-number large">{todayMacros.calories || 0}</div>
        <div className="sub">/ {macroGoals.calories} KCAL</div>
        {/* Calorie bar */}
        <div className="mt-4 fs-progress-track" style={{ height: '6px' }}>
          <motion.div
            className="fs-progress-fill"
            style={{ height: '100%' }}
            initial={{ width: 0 }}
            animate={{ width: `${calPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Data Strip — 3 macro columns */}
      <div
        className="mx-0"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          border: '2px solid var(--fs-primary)',
          borderTop: 'none',
        }}
      >
        {[
          {
            label: 'PROTEIN',
            he: 'חלבון',
            icon: <Beef size={12} />,
            cur: todayMacros.protein,
            goal: macroGoals.protein,
            pct: proteinPct,
          },
          {
            label: 'CARBS',
            he: 'פחמימות',
            icon: <Wheat size={12} />,
            cur: todayMacros.carbs,
            goal: macroGoals.carbs,
            pct: carbsPct,
          },
          {
            label: 'FAT',
            he: 'שומן',
            icon: <Droplets size={12} />,
            cur: todayMacros.fat,
            goal: macroGoals.fat,
            pct: fatPct,
          },
        ].map((m, i) => (
          <div
            key={m.label}
            className="glass-surface fs-accent-rail"
            style={{
              background: 'var(--fs-surface)',
              padding: '18px 14px',
              borderInlineStart: i > 0 ? '2px solid var(--fs-primary)' : 'none',
            }}
          >
            <div
              className="flex items-center gap-1 mb-2"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '32px',
                lineHeight: 0.9,
                color: 'var(--fs-ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {m.cur}
              <em
                style={{
                  fontStyle: 'normal',
                  fontSize: '16px',
                  color: 'var(--fs-accent)',
                  marginInlineStart: '2px',
                }}
              >
                G
              </em>
            </div>
            <div className="mt-2 fs-progress-track" style={{ height: '4px' }}>
              <motion.div
                className="fs-progress-fill"
                style={{ height: '100%' }}
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <div
              className="mt-1"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '11px',
                color: 'var(--fs-muted)',
              }}
            >
              {m.he} · {m.cur}/{m.goal}
            </div>
          </div>
        ))}
      </div>

      <WaterTracker />

      {/* Chapter break + tabs */}
      <div className="chapter-break mt-5">
        <span className="left">§01 · MEALS</span>
        <span className="right">ארוחות</span>
      </div>

      {/* Date Navigator */}
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goBack}
            className="chip"
            aria-label="יום קודם"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            {isToday
              ? 'היום'
              : new Date(selectedDate).toLocaleDateString('he-IL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
          </span>
          <button
            onClick={goForward}
            disabled={isToday}
            className="chip"
            style={{ minWidth: 44, minHeight: 44, opacity: isToday ? 0.4 : 1 }}
            aria-label="יום הבא"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editorial Tab Bar */}
      <div className="px-5 pt-4 pb-3">
        <div
          className="flex gap-1"
          style={{ borderBottom: '2px solid var(--fs-primary)' }}
          role="tablist"
          aria-label="תזונה"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              role="tab"
              id={`nutrition-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`nutrition-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const next = TABS[(idx + 1) % TABS.length];
                  if (!next) return;
                  setActiveTab(next.key);
                  document.getElementById(`nutrition-tab-${next.key}`)?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                  if (!prev) return;
                  setActiveTab(prev.key);
                  document.getElementById(`nutrition-tab-${prev.key}`)?.focus();
                }
              }}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''} flex items-center gap-1.5`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-5">
        <AnimatePresence mode="sync">
          {activeTab === 'log' && (
            <motion.div
              key="log"
              id="nutrition-panel-log"
              role="tabpanel"
              aria-labelledby="nutrition-tab-log"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {todayEntries.length === 0 ? (
                <EmptyMealState onAdd={() => setShowAddMeal(true)} />
              ) : (
                <div className="space-y-3">
                  {todayEntries.map((entry) => (
                    <MealEntryCard key={entry.id} entry={entry} onDelete={handleDeleteEntry} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div
              key="library"
              id="nutrition-panel-library"
              role="tabpanel"
              aria-labelledby="nutrition-tab-library"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <FoodLibrary
                foods={filteredFoods}
                onAddFood={handleAddFood}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'presets' && (
            <motion.div
              key="presets"
              id="nutrition-panel-presets"
              role="tabpanel"
              aria-labelledby="nutrition-tab-presets"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {presets.map((preset) => (
                <MealPresetCard
                  key={preset.id}
                  preset={preset}
                  onSelect={(m) => handleQuickPreset(preset, m)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Water History Chart */}
      {waterHistory.length > 0 && (
        <div className="px-5 mt-6">
          <div
            style={{
              border: '2px solid var(--fs-primary)',
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              padding: '18px 16px',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title flex items-center gap-2">
                <Droplets size={14} />§ HYDRATION HISTORY · היסטוריית מים
              </h3>
            </div>
            <div
              className="h-28 flex items-end gap-2"
              role="img"
              aria-label="היסטוריית שתייה - 7 ימים"
            >
              {waterHistory.map((entry, i) => {
                const maxMl = 2500;
                const heightPct = Math.max(4, (entry.total / maxMl) * 100);
                const isLast = i === waterHistory.length - 1;
                return (
                  <div key={entry.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      {entry.total > 0 ? `${Math.round(entry.total / 250)}` : ''}
                    </span>
                    <motion.div
                      className="w-full"
                      style={{
                        backgroundColor: isLast ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                        border: isLast ? '2px solid var(--fs-primary)' : 'none',
                        minHeight: 4,
                      }}
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="eyebrow" style={{ color: 'var(--fs-muted)', fontSize: '10px' }}>
                GLASSES (250ML) · GOAL: 2500ML
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <motion.button
        onClick={() => setShowAddMeal(true)}
        className="fixed bottom-24 z-40 flex items-center justify-center accent-glow"
        style={{
          width: '56px',
          height: '56px',
          background: 'var(--fs-accent)',
          color: 'var(--fs-heading)',
          border: '2px solid var(--fs-primary)',
          left: '20px',
          right: 'auto',
        }}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        aria-label="הוסף ארוחה"
      >
        <Plus size={24} strokeWidth={2.5} />
      </motion.button>

      {/* Add Meal Modal */}
      <AnimatePresence>
        {showAddMeal && (
          <AddMealModal
            selectedMealType={selectedMealType}
            onMealTypeChange={setSelectedMealType}
            selectedFoods={selectedFoods}
            onAddFood={handleAddFood}
            onRemoveFood={handleRemoveFood}
            onServingsChange={handleServingsChange}
            onSave={handleSaveMeal}
            onClose={() => {
              setShowAddMeal(false);
              setSelectedFoods([]);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Empty Meal State ─────────────────────────────────────────────────────────
const EmptyMealState = memo(function EmptyMealState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 flex items-center justify-center mb-4"
        style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-accent)' }}
      >
        <Flame size={26} />
      </div>
      <h3
        className="mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 800,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
        }}
      >
        עדיין לא תיעדת ארוחות
      </h3>
      <p className="eyebrow mb-5" style={{ color: 'var(--fs-muted)' }}>
        START TRACKING
      </p>
      <button
        onClick={onAdd}
        className="btn-primary start-workout-btn accent-glow flex items-center gap-2"
      >
        <Plus size={15} />
        הוסף ארוחה
      </button>
    </div>
  );
});

// ── Meal Entry Card ──────────────────────────────────────────────────────────
const MealEntryCard = memo(function MealEntryCard({
  entry,
  onDelete,
}: { entry: MealEntry; onDelete: (id: string) => void }) {
  const mealLabel = entry.meals.map((m) => MEAL_TYPE_LABELS[m.name]).join(', ');
  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Accent side bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: 'var(--fs-accent)',
        }}
      />
      <div className="flex items-start justify-between mb-2" style={{ paddingInlineStart: '8px' }}>
        <span className="eyebrow" style={{ color: 'var(--fs-accent)' }}>
          § {mealLabel}
        </span>
        <button
          onClick={() => onDelete(entry.id)}
          className="w-12 h-12 flex items-center justify-center transition-colors"
          style={{ color: 'var(--fs-muted)' }}
          aria-label="מחק ארוחה"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <h4
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '22px',
          lineHeight: 1,
          color: 'var(--fs-ink)',
          marginBottom: '6px',
          paddingInlineStart: '8px',
          textTransform: 'uppercase',
        }}
      >
        {entry.name}
      </h4>

      {/* Calories — big display */}
      <div className="flex items-baseline gap-2 mb-3" style={{ paddingInlineStart: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '36px',
            lineHeight: 0.9,
            color: 'var(--fs-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {entry.totalMacros.calories}
        </span>
        <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
          KCAL
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3" style={{ paddingInlineStart: '8px' }}>
        {entry.meals
          .flatMap((m) => m.foods)
          .slice(0, 4)
          .map((f, i) => (
            <span key={i} className="chip">
              {f.name} ×{f.servings}
            </span>
          ))}
        {entry.meals.flatMap((m) => m.foods).length > 4 && (
          <span className="chip">+{entry.meals.flatMap((m) => m.foods).length - 4}</span>
        )}
      </div>

      <div
        className="flex gap-3 pt-3"
        style={{
          borderTop: '1px solid var(--fs-surface-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.12em',
          color: 'var(--fs-heading)',
          textTransform: 'uppercase',
          paddingInlineStart: '8px',
        }}
      >
        <span className="flex items-center gap-1">
          <Flame size={11} />
          {entry.totalMacros.calories}
        </span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>P {entry.totalMacros.protein}G</span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>C {entry.totalMacros.carbs}G</span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>F {entry.totalMacros.fat}G</span>
        {(entry.totalMacros.fiber ?? 0) > 0 && (
          <>
            <span style={{ color: 'var(--fs-muted)' }}>·</span>
            <span>Fb {Math.round(entry.totalMacros.fiber ?? 0)}G</span>
          </>
        )}
      </div>
    </div>
  );
});

// ── Food Library ─────────────────────────────────────────────────────────────
const FoodLibrary = memo(function FoodLibrary({
  foods,
  onAddFood,
  searchQuery,
  onSearchChange,
}: {
  foods: FoodItem[];
  onAddFood: (f: FoodItem) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute top-1/2 -translate-y-1/2 right-4"
          style={{ color: 'var(--fs-muted)' }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="חפש מזון..."
          className="w-full py-3 pr-11 pl-5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 0,
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            minHeight: '48px',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--fs-accent)';
            e.target.style.boxShadow = '0 0 0 2px rgba(77,220,187,0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--fs-surface-2)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>
      <div className="space-y-2">
        {foods.map((food) => (
          <div
            key={food.id}
            className="magnetic-card glass-surface"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <button
              onClick={() => setExpanded(expanded === food.id ? null : food.id)}
              className="w-full flex items-center justify-between p-3 text-start"
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--fs-ink)',
                  }}
                >
                  {food.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--fs-muted)',
                    marginInlineStart: '8px',
                  }}
                >
                  {food.servingSize}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: MACRO_COLORS.calories,
                  }}
                >
                  {food.calories} קל׳
                </span>
                {expanded === food.id ? (
                  <ChevronUp size={15} style={{ color: 'var(--fs-muted)' }} />
                ) : (
                  <ChevronDown size={15} style={{ color: 'var(--fs-muted)' }} />
                )}
              </div>
            </button>
            <AnimatePresence>
              {expanded === food.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="px-4 pb-4 pt-2"
                    style={{ borderTop: '1px solid var(--fs-surface-2)' }}
                  >
                    <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4">
                      {[
                        { val: food.calories, label: 'קל', color: MACRO_COLORS.calories },
                        { val: `${food.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                        { val: `${food.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                        { val: `${food.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                      ].map((m) => (
                        <div
                          key={m.label}
                          style={{
                            borderRadius: '12px',
                            padding: '8px 4px',
                            backgroundColor: 'var(--fs-surface-2)',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              fontSize: '14px',
                              color: m.color,
                            }}
                          >
                            {m.val}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '10px',
                              color: 'var(--fs-muted)',
                              marginTop: '2px',
                            }}
                          >
                            {m.label}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => onAddFood(food)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 0,
                        backgroundColor: 'var(--fs-primary)',
                        color: 'var(--fs-accent)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Plus size={14} />
                      הוסף
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Meal Preset Card ─────────────────────────────────────────────────────────
const MealPresetCard = memo(function MealPresetCard({
  preset,
  onSelect,
}: { preset: MealPreset; onSelect: (m: MealType) => void }) {
  const [showMealSelect, setShowMealSelect] = useState(false);
  const totalCal = useMemo(
    () =>
      preset.meals.reduce((s, m) => {
        const f = getFoodLibrary().find((fd) => fd.id === m.foodId);
        return s + (f ? f.calories * m.servings : 0);
      }, 0),
    [preset.meals]
  );
  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Accent side bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: 'var(--fs-accent)',
        }}
      />
      <div className="flex items-start justify-between mb-3" style={{ paddingInlineStart: '8px' }}>
        <div>
          <h4
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '14px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            {preset.name}
          </h4>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
              marginTop: '2px',
            }}
          >
            {preset.description}
          </p>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            color: MACRO_COLORS.calories,
          }}
        >
          {totalCal} קל׳
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3" style={{ paddingInlineStart: '8px' }}>
        {preset.meals.map((m, i) => {
          const f = getFoodLibrary().find((fd) => fd.id === m.foodId);
          return f ? (
            <span
              key={i}
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--fs-muted)',
                backgroundColor: 'var(--fs-surface-2)',
              }}
            >
              {f.name} ×{m.servings}
            </span>
          ) : null;
        })}
      </div>
      {showMealSelect ? (
        <div className="flex gap-2 flex-wrap" style={{ paddingInlineStart: '8px' }}>
          {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => {
            const Icon = MEAL_TYPE_ICONS[key as MealType];
            return (
              <button
                key={key}
                onClick={() => {
                  onSelect(key as MealType);
                  setShowMealSelect(false);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--fs-surface-2)',
                  color: 'var(--fs-heading)',
                  border: '1px solid var(--fs-surface-2)',
                  cursor: 'pointer',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => setShowMealSelect(true)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 0,
            backgroundColor: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={13} />
          הוסף מהיר
        </button>
      )}
    </div>
  );
});

function AddMealModal({
  selectedMealType,
  onMealTypeChange,
  selectedFoods,
  onAddFood,
  onRemoveFood,
  onServingsChange,
  onSave,
  onClose,
  searchQuery,
  onSearchChange,
}: {
  selectedMealType: MealType;
  onMealTypeChange: (m: MealType) => void;
  selectedFoods: (FoodItem & { servings: number })[];
  onAddFood: (f: FoodItem) => void;
  onRemoveFood: (id: string) => void;
  onServingsChange: (id: string, delta: number) => void;
  onSave: () => void;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const foods = useMemo(() => searchFoods(searchQuery), [searchQuery]);
  const totalMacros = useMemo(
    () =>
      selectedFoods.reduce(
        (acc, f) => {
          const m = calcFoodMacros(f);
          return {
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [selectedFoods]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg rounded-t-[28px] max-h-[88vh] overflow-y-auto"
        style={{
          background: 'var(--fs-surface)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--fs-surface-2)' }} />
        </div>

        <div
          className="sticky top-0 z-10 px-5 pt-[max(env(safe-area-inset-top,0px),8px)] pb-4"
          style={{
            background: 'var(--fs-surface)',
            borderBottom: '1px solid var(--fs-surface-2)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              הוסף ארוחה
            </h2>
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center"
              style={{
                borderRadius: '50%',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="סגור"
            >
              <X size={17} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => {
              const Icon = MEAL_TYPE_ICONS[key as MealType];
              return (
                <button
                  key={key}
                  onClick={() => onMealTypeChange(key as MealType)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    padding: '7px 14px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-hebrew)',
                    transition: 'all 0.15s ease',
                    ...(selectedMealType === key
                      ? { backgroundColor: 'var(--fs-accent)', color: 'var(--fs-heading)' }
                      : { backgroundColor: 'var(--fs-surface-2)', color: 'var(--fs-muted)' }),
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {selectedFoods.length > 0 && (
            <div className="space-y-2">
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: 'var(--fs-ink)',
                  textTransform: 'uppercase',
                }}
              >
                מזונות שנבחרו
              </h3>
              {selectedFoods.map((food) => (
                <div
                  key={food.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--fs-surface-2)',
                    borderRadius: '14px',
                    padding: '14px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-hebrew)',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--fs-ink)',
                      }}
                    >
                      {food.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => onServingsChange(food.id, -0.5)}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--fs-surface)',
                          color: 'var(--fs-ink)',
                          border: '1px solid var(--fs-surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '18px',
                        }}
                        aria-label="הפחת חצי מנה"
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '14px',
                          color: 'var(--fs-ink)',
                          width: '32px',
                          textAlign: 'center',
                          fontWeight: 500,
                        }}
                      >
                        {food.servings}
                      </span>
                      <button
                        onClick={() => onServingsChange(food.id, 0.5)}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--fs-surface)',
                          color: 'var(--fs-ink)',
                          border: '1px solid var(--fs-surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '18px',
                        }}
                        aria-label="הוסף חצי מנה"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-end">
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: MACRO_COLORS.calories,
                      }}
                    >
                      {calcFoodMacros(food).calories} קל׳
                    </span>
                    <button
                      onClick={() => onRemoveFood(food.id)}
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: 'var(--fs-warn)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      הסר
                    </button>
                  </div>
                </div>
              ))}
              <div
                style={{
                  backgroundColor: 'var(--fs-surface-2)',
                  borderRadius: '14px',
                  padding: '14px',
                  border: '1px solid var(--fs-surface-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    textAlign: 'center',
                  }}
                >
                  {[
                    { val: totalMacros.calories, label: 'קלוריות', color: MACRO_COLORS.calories },
                    { val: `${totalMacros.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                    { val: `${totalMacros.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                    { val: `${totalMacros.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                  ].map((m) => (
                    <div key={m.label}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 900,
                          fontSize: '16px',
                          color: m.color,
                        }}
                      >
                        {m.val}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          color: 'var(--fs-muted)',
                          marginTop: '2px',
                        }}
                      >
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Search
              size={16}
              className="absolute top-1/2 -translate-y-1/2 right-4"
              style={{ color: 'var(--fs-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חפש מזון..."
              style={{
                width: '100%',
                backgroundColor: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: '14px',
                padding: '12px 40px 12px 16px',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                outline: 'none',
                minHeight: '48px',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--fs-accent)';
                e.target.style.boxShadow = '0 0 0 2px rgba(77,220,187,0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--fs-surface-2)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {foods.slice(0, 20).map((food) => (
              <button
                key={food.id}
                onClick={() => onAddFood(food)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--fs-surface-2)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {food.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--fs-muted)',
                      marginInlineStart: '8px',
                    }}
                  >
                    {food.servingSize}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: MACRO_COLORS.calories,
                  }}
                >
                  {food.calories} קל׳
                </span>
              </button>
            ))}
          </div>

          <motion.button
            onClick={onSave}
            disabled={selectedFoods.length === 0}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              backgroundColor:
                selectedFoods.length > 0 ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
              color: selectedFoods.length > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: selectedFoods.length > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedFoods.length > 0 ? 1 : 0.4,
            }}
            whileTap={{ scale: selectedFoods.length > 0 ? 0.98 : 1 }}
          >
            שמור ארוחה {selectedFoods.length > 0 && `(${totalMacros.calories} קל׳)`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
