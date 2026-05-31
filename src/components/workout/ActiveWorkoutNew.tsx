// ActiveWorkout - Main workout component that composes everything
// This replaces the old 1295-line monolithic ActiveWorkout.tsx

import React, { useState, useMemo, useRef } from 'react';
import type { PersonalItem, WorkoutSettings } from '../../types';

import { useWorkoutDerived, useWorkoutDispatch, useWorkoutState } from './core/WorkoutContext';
// Core
import { WorkoutProvider } from './core/WorkoutProvider';

// Components
import { ExerciseDisplay, ProgressBar } from './components';
// Aria-live announcer for screen readers (set complete, rest start/end, PRs)
import WorkoutAriaLive from './components/WorkoutAriaLive';

// Hooks
import { useExerciseSuggestions } from './hooks/useExerciseSuggestions';
import { usePersonalRecords } from './hooks/usePersonalRecords';
import { useSupersetMode } from './hooks/useSupersetMode';
import { useSwipeNavigation } from './hooks/useSwipeNavigation';
import { useWorkoutSave } from './hooks/useWorkoutSave';
import {
  useAccessibilitySettings,
  useDisplaySettings,
  useWorkoutSettings,
} from './hooks/useWorkoutSettings';
import { formatTime } from './hooks/useWorkoutTimer';

// Extracted components
import PreWorkoutScreen from './states/PreWorkoutScreen';

// Existing components we preserve - WaterReminderToast kept static (small and frequently shown)
import WaterReminderToast from './WaterReminderToast';

// Extracted sub-components (AR-2)
import {
  WorkoutBottomBar,
  WorkoutHeaderSection,
  WorkoutOverlays,
  WorkoutSummaryView,
  useWorkoutEffects,
  useWorkoutHandlers,
} from './active';

// Lazy loaded components (heavy - only loaded when needed)
const ExerciseSelector = React.lazy(() => import('./ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('./QuickExerciseForm'));

import { cn } from '../../utils/styles';

// ============================================================
// TYPES
// ============================================================

interface ActiveWorkoutProps {
  item: PersonalItem;
  onUpdate: (id: string, updates: Partial<PersonalItem>) => void;
  onExit: () => void;
}

// Note: ParticleExplosion and EmptyWorkoutState moved to separate files
// for better code organization and maintainability

// ============================================================
// MAIN WORKOUT CONTENT
// ============================================================

export const WorkoutContent: React.FC<{
  item: PersonalItem;
  onUpdate: (id: string, updates: Partial<PersonalItem>) => void;
  onExit: () => void;
  initialTemplateId?: string;
}> = ({ item, onExit, initialTemplateId }) => {
  const state = useWorkoutState();
  const dispatch = useWorkoutDispatch();
  const derived = useWorkoutDerived();

  // Track whether PreWorkoutScreen has been shown (so we don't auto-open selector before it)
  const [preWorkoutScreenShown, setPreWorkoutScreenShown] = useState(false);

  // Local state
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishIntent, setFinishIntent] = useState<'finish' | 'cancel'>('finish');

  const [showWaterReminder, setShowWaterReminder] = useState(false);

  // Track pending setTimeout IDs to clear on unmount (prevent dispatch-after-unmount)
  const pendingTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Settings — memoized to keep stable reference for memo'd children
  const workoutSettings: Partial<WorkoutSettings> = useMemo(
    () => state.appSettings?.workoutSettings || {},
    [state.appSettings?.workoutSettings]
  );

  // Extract primitives passed as props so child memo() is not broken by
  // the workoutSettings object reference changing on every state tick.
  const enableQuickWeightButtons = workoutSettings.enableQuickWeightButtons ?? true;
  const enableQuickRepsButtons = workoutSettings.enableQuickRepsButtons ?? true;

  // Save/finish flow (summary state + confirm-finish handler) lives in a hook.
  const { showSummary, completedSession, isSaving, saveError, setSaveError, handleConfirmFinish } =
    useWorkoutSave({
      state,
      workoutSettings,
      finishIntent,
      setShowFinishConfirm,
      item,
      onExit,
    });

  // Superset selection state machine + its create/remove handlers.
  const { supersetMode, handleCreateSuperset, handleRemoveSuperset } = useSupersetMode({
    dispatch,
    defaultRestTime: workoutSettings.defaultRestTime,
  });

  // Exercise name suggestions + personal exercise library (loaded once on mount).
  const { nameSuggestions, personalExerciseLibrary } = useExerciseSuggestions();

  // PR tracking
  const { getPRForExercise } = usePersonalRecords(state.exercises, state.currentExerciseIndex);

  // Celebration System

  // Settings hooks
  const { keepScreenAwake, announceSetComplete } = useWorkoutSettings();
  const displaySettings = useDisplaySettings();

  // Stabilize display setting primitives so child memo() holds when the
  // settings object reference changes but values are identical.
  const showGhostValues = displaySettings.showGhostValues;
  const showVolumePreview = displaySettings.showVolumePreview;

  // Apply accessibility settings (this hook has side effects that apply to document)
  useAccessibilitySettings();

  // All side effects (screen wake, announcements, template loading, start flow, water reminder)
  useWorkoutEffects({
    dispatch,
    exercises: state.exercises,
    currentExerciseIndex: state.currentExerciseIndex,
    startTimestamp: state.startTimestamp,
    workoutSettings,
    showGoalSelector: state.showGoalSelector,
    showWarmup: state.showWarmup,
    showCooldown: state.showCooldown,
    showExerciseSelector: state.showExerciseSelector,
    showQuickForm: state.showQuickForm,
    initialTemplateId,
    preWorkoutScreenShown,
    setShowWaterReminder,
    completedSetsCount: derived.completedSetsCount,
    currentExercise: derived.currentExercise,
    keepScreenAwake,
    announceSetComplete,
    pendingTimeouts,
  });

  // Stable nextSetHint string for InlineRestTimer
  const nextSetHint = useMemo(() => {
    if (derived.activeSetIndex >= 0) {
      return `NEXT · SET ${String(derived.activeSetIndex + 1).padStart(2, '0')}`;
    }
    return undefined;
  }, [derived.activeSetIndex]);

  // PR info for current exercise
  const prInfo = useMemo(() => {
    if (!derived.currentExercise) return '';
    const pr = getPRForExercise(derived.currentExercise.name ?? '');
    if (!pr) return '';
    return `PR: ${pr.maxWeight}kg`;
  }, [derived.currentExercise, getPRForExercise]);

  // Workout stats for confirm dialog
  const workoutStats = useMemo(() => {
    const elapsed = Math.floor((Date.now() - state.startTimestamp - state.totalPausedTime) / 1000);
    return {
      completedSets: derived.completedSetsCount,
      totalVolume: derived.totalVolume,
      duration: formatTime(elapsed),
    };
  }, [
    state.startTimestamp,
    state.totalPausedTime,
    derived.completedSetsCount,
    derived.totalVolume,
  ]);

  // All dispatch-wrapper handlers extracted to a hook for brevity.
  const currentExerciseName = derived.currentExercise?.name || '';
  const {
    handleUpdateSet,
    handleCompleteSet,
    handleOpenNumpad,
    handleUndoSet,
    handleUpdateRPE,
    handleToggleTechnique,
    handleOpenPlateCalc,
    handleClosePlateCalc,
    handleUpdateNotes,
    handleEditSet,
    handleEditSetInList,
    handleDeleteSet,
    handleRenameExercise,
    handleFinishRequest,
    handleDiscardRequest,
    handleChangeExercise,
    handleOpenDrawer,
    handleCloseDrawer,
    handleCloseSelector,
    handleAddExercise,
    handleSkipRest,
    handleAddRestTime,
    handleNumpadInput,
    handleNumpadSetValue,
    handleNumpadDelete,
    handleNumpadSubmit,
    handleCloseNumpad,
    handleCloseSettings,
    handleUpdateSetting,
    handleOpenSettings,
    handleOpenTutorial,
    handleReorderExercises,
    handleSelectExerciseFromList,
    handleRemoveExercise,
    handleOpenQuickForm,
    handleCloseQuickForm,
    handleCancelFinish,
    handleCooldownFromFinish,
    handleCloseGoalSelector,
    handleWarmupComplete,
    handleWarmupSkip,
    handleCooldownComplete,
    handleCooldownSkip,
    handleCloseTutorial,
    handleCloseAICoach,
    handleOpenSelector,
    handleGoalSelect,
  } = useWorkoutHandlers({
    currentExerciseIndex: state.currentExerciseIndex,
    exercisesLength: state.exercises.length,
    personalExerciseLibrary,
    workoutSettings,
    currentExerciseName,
    setFinishIntent,
    setShowFinishConfirm,
    setSaveError,
    pendingTimeouts,
  });

  // Horizontal swipe navigation between exercises (pointer-based, RTL-aware).
  const { handleSwipePointerDown, handleSwipePointerMove, handleSwipePointerEnd } =
    useSwipeNavigation({
      currentExerciseIndex: state.currentExerciseIndex,
      exercisesLength: state.exercises.length,
      onChangeExercise: handleChangeExercise,
    });

  // If showing summary
  if (showSummary && completedSession) {
    return <WorkoutSummaryView completedSession={completedSession} onExit={onExit} />;
  }

  // If no current exercise OR exercise has no name, show PreWorkoutScreen for initial welcome
  if (!derived.currentExercise || !derived.currentExercise.name?.trim()) {
    return (
      <React.Suspense
        fallback={<div className="fixed inset-0" style={{ background: 'var(--fs-bg)' }} />}
      >
        <PreWorkoutScreen
          oledMode={!!workoutSettings.oledMode}
          onStartWorkout={() => {
            // Mark that the welcome screen was shown, then open selector
            setPreWorkoutScreenShown(true);
            dispatch({ type: 'OPEN_SELECTOR' });
          }}
          onCancel={() => {
            // User explicitly cancelled — close any open modals first, then exit
            dispatch({ type: 'CLOSE_SELECTOR' });
            dispatch({ type: 'CLOSE_QUICK_FORM' });
            dispatch({ type: 'TOGGLE_SETTINGS', payload: false });
            setShowFinishConfirm(false);
            onExit();
          }}
          onSelectTemplate={(templateId: string) => {
            // Navigate to workout with template - full page navigation
            window.location.href = `/workout/${templateId}`;
          }}
        />

        {state.showExerciseSelector && (
          <ExerciseSelector
            isOpen={true}
            onSelect={(ex) => dispatch({ type: 'ADD_EXERCISE', payload: ex })}
            onClose={() => dispatch({ type: 'CLOSE_SELECTOR' })}
            onCreateNew={() => dispatch({ type: 'OPEN_QUICK_FORM' })}
            goal={workoutSettings.defaultWorkoutGoal}
          />
        )}

        {state.showQuickForm && (
          <QuickExerciseForm
            onAdd={(ex) => dispatch({ type: 'ADD_EXERCISE', payload: ex })}
            onClose={() => dispatch({ type: 'CLOSE_QUICK_FORM' })}
          />
        )}
      </React.Suspense>
    );
  }

  // Main workout UI
  return (
    <div
      className={cn(
        'relative flex flex-col h-dvh font-sans transition-colors duration-500 ambient-mesh ambient-mesh-soft'
      )}
      style={{
        background: 'var(--fs-bg)',
        color: 'var(--fs-ink)',
      }}
    >
      {/* Progress Bar */}
      <ProgressBar progress={derived.progressPercent} />

      {/* Screen-reader announcements for workout events */}
      <WorkoutAriaLive />

      {/* Main Content - Fresh Steel Compact Layout */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header (pinned) */}
        <WorkoutHeaderSection
          startTimestamp={state.startTimestamp}
          totalPausedTime={state.totalPausedTime}
          isPaused={state.isPaused}
          onFinish={handleFinishRequest}
          onDiscard={handleDiscardRequest}
          onOpenSettings={handleOpenSettings}
          onOpenTutorial={handleOpenTutorial}
          isSaving={isSaving}
          supersetMode={!!supersetMode}
          restTimerActive={state.restTimer.active}
          restTimerEndTime={state.restTimer.endTime}
          onSkipRest={handleSkipRest}
          onAddRestTime={handleAddRestTime}
          nextSetHint={nextSetHint}
        />

        {/* Middle: exercise card (pinned) + scrollable content */}
        <div
          className="flex-1 min-h-0 flex items-stretch"
          onPointerDown={handleSwipePointerDown}
          onPointerMove={handleSwipePointerMove}
          onPointerUp={handleSwipePointerEnd}
          onPointerCancel={handleSwipePointerEnd}
          style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', overflow: 'hidden' }}
        >
          <ExerciseDisplay
            exercise={derived.currentExercise}
            displaySetIndex={derived.activeSetIndex}
            currentSet={derived.currentSet}
            prInfo={prInfo}
            onUpdateSet={handleUpdateSet}
            onCompleteSet={handleCompleteSet}
            onOpenNumpad={handleOpenNumpad}
            onRenameExercise={handleRenameExercise}
            onEditSet={handleEditSet}
            nameSuggestions={nameSuggestions}
            onUpdateRPE={handleUpdateRPE}
            onUpdateNotes={handleUpdateNotes}
            onUndo={handleUndoSet}
            showGhostValues={showGhostValues}
            showVolumePreview={showVolumePreview}
            enableQuickWeightButtons={enableQuickWeightButtons}
            enableQuickRepsButtons={enableQuickRepsButtons}
            supersetGroups={state.supersetGroups}
            onCreateSuperset={handleCreateSuperset}
            onRemoveSuperset={handleRemoveSuperset}
            onToggleTechnique={handleToggleTechnique}
            onOpenPlateCalc={handleOpenPlateCalc}
          />
        </div>

        {/* ── BOTTOM SECTION (spec §6) — pinned, never scrolls ── */}
        <WorkoutBottomBar
          exercises={state.exercises}
          currentExerciseIndex={state.currentExerciseIndex}
          onChangeExercise={handleChangeExercise}
          onOpenDrawer={handleOpenDrawer}
          onAddExercise={handleOpenSelector}
          onCompleteSet={handleCompleteSet}
        />
      </div>

      {/* === OVERLAYS === */}
      <WorkoutOverlays
        numpad={state.numpad}
        onNumpadInput={handleNumpadInput}
        onNumpadSetValue={handleNumpadSetValue}
        onNumpadDelete={handleNumpadDelete}
        onNumpadSubmit={handleNumpadSubmit}
        onCloseNumpad={handleCloseNumpad}
        showPlateCalc={state.showPlateCalc}
        onClosePlateCalc={handleClosePlateCalc}
        currentSetWeight={derived.currentSet?.weight || 60}
        showFinishConfirm={showFinishConfirm}
        finishIntent={finishIntent}
        workoutStats={workoutStats}
        onConfirmFinish={handleConfirmFinish}
        onCancelFinish={handleCancelFinish}
        onCooldownFromFinish={handleCooldownFromFinish}
        isSaving={isSaving}
        saveError={saveError}
        showSettings={state.showSettings}
        workoutSettings={workoutSettings}
        onCloseSettings={handleCloseSettings}
        onUpdateSetting={handleUpdateSetting}
        isDrawerOpen={state.isDrawerOpen}
        exercises={state.exercises}
        currentExerciseIndex={state.currentExerciseIndex}
        onReorderExercises={handleReorderExercises}
        onSelectExerciseFromList={handleSelectExerciseFromList}
        onRemoveExercise={handleRemoveExercise}
        onEditSetInList={handleEditSetInList}
        onDeleteSet={handleDeleteSet}
        onCloseDrawer={handleCloseDrawer}
        showExerciseSelector={state.showExerciseSelector}
        onAddExercise={handleAddExercise}
        onCloseSelector={handleCloseSelector}
        onOpenQuickForm={handleOpenQuickForm}
        defaultWorkoutGoal={workoutSettings.defaultWorkoutGoal}
        showQuickForm={state.showQuickForm}
        onCloseQuickForm={handleCloseQuickForm}
        showGoalSelector={state.showGoalSelector}
        onGoalSelect={handleGoalSelect}
        onCloseGoalSelector={handleCloseGoalSelector}
        showWarmup={state.showWarmup}
        showCooldown={state.showCooldown}
        onWarmupComplete={handleWarmupComplete}
        onWarmupSkip={handleWarmupSkip}
        onCooldownComplete={handleCooldownComplete}
        onCooldownSkip={handleCooldownSkip}
        showTutorial={state.showTutorial}
        tutorialExercise={state.tutorialExercise}
        tutorialCustomNotes={derived.currentExercise?.programExtras?.notes as string | undefined}
        onCloseTutorial={handleCloseTutorial}
        onCloseAICoach={handleCloseAICoach}
      />

      {/* Water Reminder Toast */}
      <WaterReminderToast
        isVisible={showWaterReminder}
        onDismiss={() => setShowWaterReminder(false)}
      />
    </div>
  );
};

// ============================================================
// MAIN EXPORT
// ============================================================

/**
 * ActiveWorkout - Main workout component
 * Uses the new modular architecture with:
 * - WorkoutProvider for state management
 * - Isolated timer rendering (no parent re-renders)
 * - onPointerDown for instant button response
 * - Split overlays for better performance
 */
const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ item, onUpdate, onExit }) => {
  return (
    <WorkoutProvider
      item={item}
      onUpdate={onUpdate as (id: string, updates: Record<string, unknown>) => void}
      onExit={onExit}
    >
      <WorkoutContent item={item} onUpdate={onUpdate} onExit={onExit} />
    </WorkoutProvider>
  );
};

export default ActiveWorkout;
