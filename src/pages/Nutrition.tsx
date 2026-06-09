import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { BookOpen, Clock, Plus, Search } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';
import { CoachMark } from '../components/guidance/CoachMark';
import { WaterTracker } from '../components/nutrition/WaterTracker';
import { SkeletonBox } from '../components/ui/SkeletonLoader';
import { AddMealModal } from './nutrition/components/AddMealModal';
import { CalorieHero } from './nutrition/components/CalorieHero';
import { DateNavigator } from './nutrition/components/DateNavigator';
import { FoodLibrary } from './nutrition/components/FoodLibrary';
import { GoalsEditor } from './nutrition/components/GoalsEditor';
import { MacroStrip } from './nutrition/components/MacroStrip';
import { EmptyMealState, GroupedMealLog, MealLogSkeleton } from './nutrition/components/MealLog';
import { MealPresetCard } from './nutrition/components/MealPresetCard';
import { NutritionTrendChart } from './nutrition/components/NutritionTrendChart';
import { WaterHistoryChart } from './nutrition/components/WaterHistoryChart';
import { useNutritionData } from './nutrition/hooks/useNutritionData';

type MealTab = 'log' | 'library' | 'presets';

export default function NutritionPage() {
  const shouldReduceMotion = useReducedMotion();
  const {
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
  } = useNutritionData();

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
          paddingInlineStart: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingInlineEnd: 'max(20px, env(safe-area-inset-right, 20px))',
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
          {todayLabel} ·{' '}
          <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {todayMacros.calories || 0}/{macroGoals.calories}
          </span>{' '}
          קל׳
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

      {/* First-visit hint at the top of the nutrition body */}
      <div className="px-5 pt-4">
        <CoachMark hintKey="hintNutrition">
          תעדו כאן ארוחות ומים — הנתונים מתעדכנים מיד בסיכום היומי.
        </CoachMark>
      </div>

      {isLoading ? (
        <div className="px-5 mt-4" role="status" aria-busy="true" aria-label="טוען נתוני תזונה">
          <SkeletonBox height={150} borderRadius="lg" className="mb-0" />
          <div className="grid grid-cols-3 gap-px mt-px">
            <SkeletonBox height={96} />
            <SkeletonBox height={96} />
            <SkeletonBox height={96} />
          </div>
        </div>
      ) : (
        <>
          <CalorieHero
            calories={todayMacros.calories}
            goal={macroGoals.calories}
            calPct={calPct}
            coachTarget={coachTarget}
            onEditGoals={() => setShowGoalsEditor(true)}
          />

          <MacroStrip
            todayMacros={todayMacros}
            macroGoals={macroGoals}
            proteinPct={proteinPct}
            carbsPct={carbsPct}
            fatPct={fatPct}
          />
        </>
      )}

      <WaterTracker selectedDate={selectedDate} isToday={isToday} />

      {/* Section heading */}
      <h2
        className="mt-5 px-5"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--fs-ink)',
        }}
      >
        ארוחות
      </h2>

      <DateNavigator
        isToday={isToday}
        selectedDate={selectedDate}
        goBack={goBack}
        goForward={goForward}
      />

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
              type="button"
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
            <m.div
              key="log"
              id="nutrition-panel-log"
              role="tabpanel"
              aria-labelledby="nutrition-tab-log"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <MealLogSkeleton />
              ) : todayEntries.length === 0 ? (
                <EmptyMealState onAdd={() => setShowAddMeal(true)} />
              ) : (
                <GroupedMealLog entries={todayEntries} onDelete={handleDeleteEntry} />
              )}
            </m.div>
          )}

          {activeTab === 'library' && (
            <m.div
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
                isLoading={isLoading}
              />
            </m.div>
          )}

          {activeTab === 'presets' && (
            <m.div
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
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <NutritionTrendChart summary={weeklySummary} calorieGoal={macroGoals.calories} />

      <WaterHistoryChart waterHistory={waterHistory} />

      {/* FAB */}
      <m.button
        onClick={() => setShowAddMeal(true)}
        className="fixed bottom-24 z-40 flex items-center justify-center accent-glow"
        style={{
          width: '56px',
          height: '56px',
          background: 'var(--fs-accent)',
          // Dark ink on the mint fill — readable in both themes (--fs-heading is
          // near-white in dark mode and washes out the icon on bright mint).
          color: 'var(--color-ink-on-accent)',
          border: '2px solid var(--fs-primary)',
          insetInlineEnd: '20px',
        }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.06 }}
        aria-label="הוסף ארוחה"
      >
        <Plus size={24} strokeWidth={2.5} />
      </m.button>

      {/* Add Meal Modal */}
      <AddMealModal
        isOpen={showAddMeal}
        selectedMealType={selectedMealType}
        onMealTypeChange={setSelectedMealType}
        selectedFoods={selectedFoods}
        onAddFood={handleAddFood}
        onRemoveFood={handleRemoveFood}
        onServingsChange={handleServingsChange}
        onSave={handleSaveMeal}
        onClose={handleCloseModal}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Goals Editor — daily control point, writes the shared nutrition_goals key */}
      <GoalsEditor
        isOpen={showGoalsEditor}
        goals={macroGoals}
        coachTarget={coachTarget}
        onSave={handleSaveGoals}
        onClose={() => setShowGoalsEditor(false)}
      />
    </div>
  );
}
