import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Search, ChevronDown, ChevronUp,
  Flame, Beef, Wheat, Droplets, Trash2, Clock, BookOpen, Sparkles,
} from 'lucide-react';
import {
  getFoodLibrary, searchFoods, getMealPresets, addMealEntry,
  deleteMealEntry, getTodayMealEntries, getTodayMacros,
  getMacroPercentages, calcFoodMacros, MEAL_TYPE_LABELS, MEAL_TYPE_ICONS,
  createQuickMeal, addFoodFromPreset,
} from '../services/nutritionService';
import type { MealEntry, FoodItem, MealType, MacroNutrients } from '../types';
import type { MealPreset } from '../services/nutritionService';

const MACRO_COLORS = {
  calories: '#FF9F0A',
  protein: '#0A84FF',
  carbs: '#30D158',
  fat: '#FF453A',
};

const MACRO_GOALS: MacroNutrients = {
  calories: 2500,
  protein: 150,
  carbs: 300,
  fat: 80,
};

type MealTab = 'log' | 'library' | 'presets';

export default function NutritionPage() {
  const [todayEntries, setTodayEntries] = useState<MealEntry[]>([]);
  const [todayMacros, setTodayMacros] = useState<MacroNutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [activeTab, setActiveTab] = useState<MealTab>('log');
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState<(FoodItem & { servings: number })[]>([]);

  const loadData = useCallback(async () => {
    const entries = await getTodayMealEntries();
    setTodayEntries(entries);
    const macros = await getTodayMacros();
    setTodayMacros(macros);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const macroPcts = useMemo(() => getMacroPercentages(todayMacros), [todayMacros]);

  const handleSaveMeal = async () => {
    if (selectedFoods.length === 0) return;
    const entry = createQuickMeal(selectedMealType, selectedFoods.map(f => ({ ...f, servings: f.servings })));
    const totalMacros = selectedFoods.reduce((acc, f) => {
      const m = calcFoodMacros(f);
      return { calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const fullEntry: MealEntry = { ...entry, totalMacros };
    await addMealEntry(fullEntry);
    setShowAddMeal(false);
    setSelectedFoods([]);
    setSearchQuery('');
    loadData();
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteMealEntry(id);
    loadData();
  };

  const handleQuickPreset = async (preset: MealPreset, mealType: MealType) => {
    const entry = addFoodFromPreset(preset.id, mealType);
    if (entry) {
      await addMealEntry(entry);
      loadData();
    }
  };

  const handleAddFood = (food: FoodItem) => {
    const existing = selectedFoods.find(f => f.id === food.id);
    if (existing) {
      setSelectedFoods(prev => prev.map(f => f.id === food.id ? { ...f, servings: f.servings + 1 } : f));
    } else {
      setSelectedFoods(prev => [...prev, { ...food, servings: 1 }]);
    }
  };

  const handleRemoveFood = (foodId: string) => {
    setSelectedFoods(prev => prev.filter(f => f.id !== foodId));
  };

  const handleServingsChange = (foodId: string, delta: number) => {
    setSelectedFoods(prev => prev.map(f => {
      if (f.id !== foodId) return f;
      return { ...f, servings: Math.max(0.5, f.servings + delta) };
    }));
  };

  const filteredFoods = useMemo(() => searchFoods(searchQuery), [searchQuery]);
  const presets = useMemo(() => getMealPresets(), []);

  const calPct = Math.min(Math.round((todayMacros.calories / MACRO_GOALS.calories) * 100), 100);
  const proteinPct = Math.min(Math.round((todayMacros.protein / MACRO_GOALS.protein) * 100), 100);
  const carbsPct = Math.min(Math.round((todayMacros.carbs / MACRO_GOALS.carbs) * 100), 100);
  const fatPct = Math.min(Math.round((todayMacros.fat / MACRO_GOALS.fat) * 100), 100);

  const TABS: { key: MealTab; label: string; icon: React.ReactNode }[] = [
    { key: 'log', label: 'יומן', icon: <Clock size={15} /> },
    { key: 'library', label: 'מזון', icon: <Search size={15} /> },
    { key: 'presets', label: 'ארוחות', icon: <BookOpen size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-black pb-28" dir="rtl">
      <div className="h-safe-top" />

      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[#8E8E93] text-sm font-medium mb-0.5">
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="font-condensed font-bold text-[var(--color-primary)] text-4xl leading-none tracking-wide">
              תזונה
            </h1>
          </div>
          <div className="text-end">
            <div className="text-[#8E8E93] text-[11px] mb-0.5">נצרך היום</div>
            <div className="text-white font-black text-xl leading-none">{todayMacros.calories}</div>
            <div className="text-[#8E8E93] text-[11px]">/ {MACRO_GOALS.calories} קל׳</div>
          </div>
        </div>
      </header>

      {/* Macro Summary Card */}
      <div className="px-4 mb-4">
        <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
          {/* Calorie bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame size={14} style={{ color: MACRO_COLORS.calories }} />
                <span className="text-white text-sm font-semibold">קלוריות</span>
              </div>
              <span className="text-[#8E8E93] text-xs">{todayMacros.calories} / {MACRO_GOALS.calories}</span>
            </div>
            <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: MACRO_COLORS.calories }}
                initial={{ width: 0 }}
                animate={{ width: `${calPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            </div>
            <div className="text-end text-[#8E8E93] text-[10px] mt-1">{calPct}%</div>
          </div>

          {/* Macro bars */}
          <div className="space-y-3">
            {([
              { label: 'חלבון', icon: <Beef size={13} />, current: todayMacros.protein, goal: MACRO_GOALS.protein, pct: proteinPct, color: MACRO_COLORS.protein, unit: 'ג' },
              { label: 'פחמימות', icon: <Wheat size={13} />, current: todayMacros.carbs, goal: MACRO_GOALS.carbs, pct: carbsPct, color: MACRO_COLORS.carbs, unit: 'ג' },
              { label: 'שומן', icon: <Droplets size={13} />, current: todayMacros.fat, goal: MACRO_GOALS.fat, pct: fatPct, color: MACRO_COLORS.fat, unit: 'ג' },
            ]).map(m => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5" style={{ color: m.color }}>
                    {m.icon}
                    <span className="text-xs font-medium text-white">{m.label}</span>
                  </div>
                  <span className="text-[#8E8E93] text-xs">{m.current}{m.unit} / {m.goal}{m.unit}</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: m.color }}
                    initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                </div>
              </div>
            ))}
          </div>

          {macroPcts.proteinPct > 0 && (
            <div className="flex justify-center gap-5 mt-4 pt-4 border-t border-white/[0.06]">
              <span className="text-[11px]" style={{ color: MACRO_COLORS.protein }}>ח׳ {macroPcts.proteinPct}%</span>
              <span className="text-[11px]" style={{ color: MACRO_COLORS.carbs }}>פח׳ {macroPcts.carbsPct}%</span>
              <span className="text-[11px]" style={{ color: MACRO_COLORS.fat }}>ש׳ {macroPcts.fatPct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Pill Tab Bar */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 p-1 bg-white/[0.06] rounded-2xl">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'text-[#8E8E93]'
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4">
        <AnimatePresence mode="sync">
          {activeTab === 'log' && (
            <motion.div key="log" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {todayEntries.length === 0 ? (
                <EmptyMealState onAdd={() => setShowAddMeal(true)} />
              ) : (
                <div className="space-y-3">
                  {todayEntries.map(entry => (
                    <MealEntryCard key={entry.id} entry={entry} onDelete={handleDeleteEntry} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <FoodLibrary foods={filteredFoods} onAddFood={handleAddFood} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            </motion.div>
          )}

          {activeTab === 'presets' && (
            <motion.div key="presets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-3">
              {presets.map(preset => (
                <MealPresetCard key={preset.id} preset={preset} onSelect={(m) => handleQuickPreset(preset, m)} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <motion.button
        onClick={() => setShowAddMeal(true)}
        className="fixed bottom-24 left-5 z-40 w-14 h-14 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white shadow-[0_0_24px_var(--color-primary)] transition-shadow"
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}>
        <Plus size={26} strokeWidth={2.5} />
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
            onClose={() => { setShowAddMeal(false); setSelectedFoods([]); }}
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center mb-5">
        <Flame size={36} className="text-[var(--color-primary)]" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">עדיין לא תיעדת ארוחות</h3>
      <p className="text-sm text-[#8E8E93] mb-7 max-w-xs">התחל לעקוב אחרי התזונה שלך כדי לראות את המאקרוס שלך</p>
      <motion.button onClick={onAdd} className="flex items-center gap-2 px-7 py-3.5 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-sm" whileTap={{ scale: 0.95 }}>
        <Plus size={18} />הוסף ארוחה ראשונה
      </motion.button>
    </motion.div>
  );
});

// ── Meal Entry Card ──────────────────────────────────────────────────────────
const MealEntryCard = memo(function MealEntryCard({ entry, onDelete }: { entry: MealEntry; onDelete: (id: string) => void }) {
  return (
    <motion.div layout className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-white text-sm leading-tight">{entry.name}</h4>
          <span className="text-[11px] text-[#8E8E93] mt-0.5 block">{entry.meals.map(m => MEAL_TYPE_LABELS[m.name]).join(', ')}</span>
        </div>
        <button onClick={() => onDelete(entry.id)} className="p-2 rounded-xl bg-white/[0.06] text-[#8E8E93] hover:text-[#FF453A] transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        {entry.meals.flatMap(m => m.foods).slice(0, 4).map((f, i) => (
          <span key={i} className="px-2.5 py-1 bg-white/[0.06] rounded-full text-[11px] text-[#8E8E93]">{f.name} ×{f.servings}</span>
        ))}
        {entry.meals.flatMap(m => m.foods).length > 4 && (
          <span className="text-[11px] text-[#8E8E93]">+{entry.meals.flatMap(m => m.foods).length - 4} עוד</span>
        )}
      </div>
      <div className="flex gap-3 pt-3 border-t border-white/[0.06]">
        <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: MACRO_COLORS.calories }}><Flame size={11} />{entry.totalMacros.calories} קל׳</span>
        <span className="text-[11px] font-medium" style={{ color: MACRO_COLORS.protein }}>ח: {entry.totalMacros.protein}ג</span>
        <span className="text-[11px] font-medium" style={{ color: MACRO_COLORS.carbs }}>פח: {entry.totalMacros.carbs}ג</span>
        <span className="text-[11px] font-medium" style={{ color: MACRO_COLORS.fat }}>ש: {entry.totalMacros.fat}ג</span>
      </div>
    </motion.div>
  );
});

// ── Food Library ─────────────────────────────────────────────────────────────
const FoodLibrary = memo(function FoodLibrary({ foods, onAddFood, searchQuery, onSearchChange }: { foods: FoodItem[]; onAddFood: (f: FoodItem) => void; searchQuery: string; onSearchChange: (q: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-[#8E8E93]" />
        <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="חפש מזון..."
          className="w-full bg-[#2C2C2E] rounded-full py-3 pr-11 pl-5 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40" />
      </div>
      <div className="space-y-2">
        {foods.map(food => (
          <motion.div key={food.id} layout className="bg-[#111111] rounded-[18px] border border-white/[0.06] overflow-hidden">
            <button onClick={() => setExpanded(expanded === food.id ? null : food.id)} className="w-full flex items-center justify-between p-4 text-start">
              <div>
                <span className="font-medium text-white text-sm">{food.name}</span>
                <span className="text-[11px] text-[#8E8E93] ms-2">{food.servingSize}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: MACRO_COLORS.calories }}>{food.calories} קל׳</span>
                {expanded === food.id ? <ChevronUp size={15} className="text-[#8E8E93]" /> : <ChevronDown size={15} className="text-[#8E8E93]" />}
              </div>
            </button>
            <AnimatePresence>
              {expanded === food.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
                    <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4">
                      {([
                        { val: food.calories, label: 'קל', color: MACRO_COLORS.calories },
                        { val: `${food.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                        { val: `${food.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                        { val: `${food.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                      ]).map(m => (
                        <div key={m.label} className="bg-white/[0.04] rounded-xl py-2">
                          <div className="font-bold text-sm" style={{ color: m.color }}>{m.val}</div>
                          <div className="text-[10px] text-[#8E8E93] mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => onAddFood(food)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold">
                      <Plus size={15} />הוסף
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

// ── Meal Preset Card ─────────────────────────────────────────────────────────
const MealPresetCard = memo(function MealPresetCard({ preset, onSelect }: { preset: MealPreset; onSelect: (m: MealType) => void }) {
  const [showMealSelect, setShowMealSelect] = useState(false);
  const totalCal = useMemo(() => preset.meals.reduce((s, m) => {
    const f = getFoodLibrary().find(fd => fd.id === m.foodId);
    return s + (f ? f.calories * m.servings : 0);
  }, 0), [preset.meals]);
  return (
    <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-white text-sm">{preset.name}</h4>
          <p className="text-[11px] text-[#8E8E93] mt-0.5">{preset.description}</p>
        </div>
        <span className="text-sm font-bold" style={{ color: MACRO_COLORS.calories }}>{totalCal} קל׳</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {preset.meals.map((m, i) => {
          const f = getFoodLibrary().find(fd => fd.id === m.foodId);
          return f ? (
            <span key={i} className="px-2.5 py-1 bg-white/[0.06] rounded-full text-[11px] text-[#8E8E93]">{f.name} ×{m.servings}</span>
          ) : null;
        })}
      </div>
      {showMealSelect ? (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => { onSelect(key as MealType); setShowMealSelect(false); }}
              className="px-3 py-2 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-semibold border border-[var(--color-primary)]/20">
              {MEAL_TYPE_ICONS[key as MealType]} {label}
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => setShowMealSelect(true)} className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold flex items-center justify-center gap-1.5">
          <Sparkles size={14} />הוסף מהיר
        </button>
      )}
    </div>
  );
});

function AddMealModal({
  selectedMealType, onMealTypeChange, selectedFoods, onAddFood, onRemoveFood, onServingsChange, onSave, onClose, searchQuery, onSearchChange,
}: {
  selectedMealType: MealType; onMealTypeChange: (m: MealType) => void;
  selectedFoods: (FoodItem & { servings: number })[];
  onAddFood: (f: FoodItem) => void; onRemoveFood: (id: string) => void; onServingsChange: (id: string, delta: number) => void;
  onSave: () => void; onClose: () => void;
  searchQuery: string; onSearchChange: (q: string) => void;
}) {
  const foods = useMemo(() => searchFoods(searchQuery), [searchQuery]);
  const totalMacros = useMemo(() => selectedFoods.reduce((acc, f) => {
    const m = calcFoodMacros(f);
    return { calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 }), [selectedFoods]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="sticky top-0 bg-[#1C1C1E] z-10 px-5 pt-2 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">הוסף ארוחה</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[#8E8E93]"><X size={17} /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => onMealTypeChange(key as MealType)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${selectedMealType === key ? 'bg-[var(--color-primary)] text-white' : 'bg-white/[0.08] text-[#8E8E93]'}`}>
                {MEAL_TYPE_ICONS[key as MealType]} {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {selectedFoods.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">מזונות שנבחרו</h3>
              {selectedFoods.map(food => (
                <div key={food.id} className="flex items-center justify-between bg-white/[0.06] rounded-[14px] p-3.5">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{food.name}</span>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => onServingsChange(food.id, -0.5)} className="w-7 h-7 rounded-lg bg-white/[0.1] text-white flex items-center justify-center font-bold text-base">−</button>
                      <span className="text-sm text-white w-8 text-center font-medium">{food.servings}</span>
                      <button onClick={() => onServingsChange(food.id, 0.5)} className="w-7 h-7 rounded-lg bg-white/[0.1] text-white flex items-center justify-center font-bold text-base">+</button>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="text-sm font-bold" style={{ color: MACRO_COLORS.calories }}>{calcFoodMacros(food).calories} קל׳</span>
                    <button onClick={() => onRemoveFood(food.id)} className="block text-xs text-[#FF453A] mt-1">הסר</button>
                  </div>
                </div>
              ))}
              <div className="bg-white/[0.04] rounded-[14px] p-3.5 border border-white/[0.06]">
                <div className="flex justify-around text-center text-xs">
                  {([
                    { val: totalMacros.calories, label: 'קלוריות', color: MACRO_COLORS.calories },
                    { val: `${totalMacros.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                    { val: `${totalMacros.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                    { val: `${totalMacros.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                  ]).map(m => (
                    <div key={m.label}>
                      <div className="font-black text-base" style={{ color: m.color }}>{m.val}</div>
                      <div className="text-[#8E8E93] mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-[#8E8E93]" />
            <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="חפש מזון..."
              className="w-full bg-[#2C2C2E] rounded-[14px] py-3 pr-11 pl-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40" />
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {foods.slice(0, 20).map(food => (
              <button key={food.id} onClick={() => onAddFood(food)}
                className="w-full flex items-center justify-between p-3.5 rounded-[14px] bg-white/[0.06] active:bg-white/[0.1] transition-colors text-start">
                <div>
                  <span className="text-sm text-white">{food.name}</span>
                  <span className="text-[11px] text-[#8E8E93] ms-2">{food.servingSize}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: MACRO_COLORS.calories }}>{food.calories} קל׳</span>
              </button>
            ))}
          </div>

          <motion.button onClick={onSave} disabled={selectedFoods.length === 0}
            className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
            whileTap={{ scale: selectedFoods.length > 0 ? 0.98 : 1 }}>
            שמור ארוחה {selectedFoods.length > 0 && `(${totalMacros.calories} קל׳)`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
