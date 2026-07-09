import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { BookOpen, Clock, CloudOff, Plus, Search } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { CoachMark } from '../components/guidance/CoachMark';
import { FadeIn } from '../components/motion/FadeIn';
import { Stagger, StaggerItem } from '../components/motion/Stagger';
import { WaterTracker } from '../components/nutrition/WaterTracker';
import { Card } from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
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
    loadError,
    retryLoad,
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
  } = useNutritionData();

  // Adding from the "מזון" library tab stages the food AND opens the meal sheet,
  // so the user immediately SEES it land under "מזונות שנבחרו" with the running
  // total + "שמור ארוחה" CTA — instead of a tap that silently fills an invisible
  // basket (which the library's own "...להוסיף ליומן" prompt had promised). The
  // sheet's own in-list add stays raw (handleAddFood) so it doesn't re-open.
  const handleLibraryAdd = useCallback<typeof handleAddFood>(
    (food) => {
      handleAddFood(food);
      setShowAddMeal(true);
    },
    [handleAddFood, setShowAddMeal]
  );

  const TABS = useMemo<{ key: MealTab; label: string; icon: React.ReactNode }[]>(
    () => [
      { key: 'log', label: 'יומן', icon: <Clock size={15} /> },
      { key: 'library', label: 'מזון', icon: <Search size={15} /> },
      { key: 'presets', label: 'ארוחות', icon: <BookOpen size={15} /> },
    ],
    []
  );

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header */}
      <PageHeader
        title="תזונה"
        eyebrow={
          <>
            <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {todayMacros.calories || 0}/{macroGoals.calories}
            </span>{' '}
            קל׳
          </>
        }
      />

      {/* Day axis — the control that scopes every number below it, placed first
          so the viewed day frames the calorie/macro/meal data (not after it). */}
      <DateNavigator
        isToday={isToday}
        selectedDate={selectedDate}
        goBack={goBack}
        goForward={goForward}
      />

      {/* First-visit hint at the top of the nutrition body */}
      <div className="px-5 pt-4">
        <CoachMark hintKey="hintNutrition">
          לחצו &quot;הוסף ארוחה&quot; למטה — רשמו מה אכלתם. המים והקלוריות מתעדכנים מיד למעלה.
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
      ) : loadError ? (
        // Load failure used to leave a permanent skeleton — show an explicit
        // error with a retry path instead.
        <div className="px-5 mt-4">
          <Card variant="elevated" asymmetric style={{ padding: 16 }}>
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <CloudOff size={28} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
              <p style={{ fontSize: 14, color: 'var(--fs-muted)', margin: 0 }}>
                טעינת נתוני התזונה נכשלה
              </p>
              <button
                type="button"
                onClick={() => retryLoad()}
                className="btn-primary"
                style={{ minHeight: 44 }}
              >
                נסו שוב
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <Stagger>
          <StaggerItem>
            <CalorieHero
              calories={todayMacros.calories}
              goal={macroGoals.calories}
              coachTarget={coachTarget}
              isToday={isToday}
              onEditGoals={() => setShowGoalsEditor(true)}
            />
          </StaggerItem>

          <StaggerItem>
            <MacroStrip
              todayMacros={todayMacros}
              macroGoals={macroGoals}
              proteinPct={proteinPct}
              carbsPct={carbsPct}
              fatPct={fatPct}
            />
          </StaggerItem>
        </Stagger>
      )}

      <WaterTracker selectedDate={selectedDate} isToday={isToday} />

      {/* Editorial Tab Bar — self-labeling (יומן / מזון / ארוחות), so no extra
          umbrella heading above it. */}
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
              ) : loadError ? null : todayEntries.length === 0 ? (
                // On loadError the journal stays blank — the error card above
                // owns the message; an "אין ארוחות עדיין" empty state would lie.
                <EmptyMealState onAdd={() => setShowAddMeal(true)} />
              ) : (
                <GroupedMealLog
                  entries={todayEntries}
                  onDelete={handleDeleteEntry}
                  onRepeat={handleRepeatEntry}
                />
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
                onAddFood={handleLibraryAdd}
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

      <FadeIn>
        <NutritionTrendChart summary={weeklySummary} calorieGoal={macroGoals.calories} />
      </FadeIn>

      <FadeIn>
        <WaterHistoryChart waterHistory={waterHistory} />
      </FadeIn>

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
