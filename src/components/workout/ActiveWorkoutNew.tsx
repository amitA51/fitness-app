// ActiveWorkout - Main workout component that composes everything
// This replaces the old 1295-line monolithic ActiveWorkout.tsx

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActiveExercise, PersonalItem, WorkoutSettings } from '../../types';

import { syncTemplatesFromCloud } from '../../hooks/useCloudTemplateReflection';
import { listMyAssignments } from '../../services/coach';
import { logger } from '../../utils/logger';

import { useWorkoutDerived, useWorkoutDispatch, useWorkoutState } from './core/WorkoutContext';
// Core
import { WorkoutProvider } from './core/WorkoutProvider';

// Components
import { ExerciseDisplay, ProgressBar } from './components';
import DraftConflictDialog from './components/DraftConflictDialog';
import PRCelebrationBanner from './components/PRCelebrationBanner';
import SupersetPicker from './components/SupersetPicker';
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
const WorkoutPlanScreen = React.lazy(() => import('./states/WorkoutPlanScreen'));

import { cn } from '../../utils/styles';

// sessionStorage key for the "user started a fresh workout / wants the selector"
// intent. Namespaced to avoid collisions; survives remounts of both
// WorkoutContent and WorkoutProvider, and is explicitly cleared once the
// workout has exercises or the user cancels.
const PREWO_STARTED_KEY = 'sparkos_prewo_started';

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
  const navigate = useNavigate();

  // Track whether the user started a fresh workout and wants the selector. This
  // intent is persisted in sessionStorage under a single namespaced key so it
  // SURVIVES remounts of both WorkoutContent (local useState would reset to
  // false) AND WorkoutProvider (the reducer sanitizes showExerciseSelector to
  // false on init). The lazy initializer recovers the true value after any
  // remount, which lets the safety-net effect in useWorkoutEffects re-open the
  // selector. The flag is cleared the moment the workout truly starts (an
  // exercise exists) or the user cancels, so it can never leak into a later or
  // mid-workout session.
  const [preWorkoutScreenShown, setPreWorkoutScreenShownState] = useState(() => {
    try {
      return sessionStorage.getItem(PREWO_STARTED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setPreWorkoutScreenShown = useCallback((v: boolean) => {
    try {
      if (v) {
        sessionStorage.setItem(PREWO_STARTED_KEY, '1');
      } else {
        sessionStorage.removeItem(PREWO_STARTED_KEY);
      }
    } catch (err) {
      logger.workout?.warn?.('prewo flag persist failed', err);
    }
    setPreWorkoutScreenShownState(v);
  }, []);

  // Clear the persisted pre-workout intent as soon as the workout actually has
  // exercises (currentExercise is truthy). From that point we have left the
  // empty fresh-start window, so the safety-net effect must never re-open the
  // selector again — clearing the flag guarantees the persisted intent only
  // lives during the empty pre-workout window and cannot leak mid-workout or
  // into a later session.
  useEffect(() => {
    if (derived.currentExercise && preWorkoutScreenShown) {
      setPreWorkoutScreenShown(false);
    }
  }, [derived.currentExercise, preWorkoutScreenShown, setPreWorkoutScreenShown]);

  // Inline coach injection for the workout surface: the most recent coach-assigned
  // program (kind === 'program' with a templateId). Sourced from Supabase, so it
  // degrades gracefully offline/guest (stays null, card simply isn't rendered).
  const [coachProgram, setCoachProgram] = useState<{
    id: string;
    title: string | null;
    templateId: string;
  } | null>(null);
  const [startingCoachProgram, setStartingCoachProgram] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assignments = await listMyAssignments();
        const program = assignments.find((a) => a.kind === 'program' && a.templateId);
        if (cancelled || !program || !program.templateId) return;
        setCoachProgram({ id: program.id, title: program.title, templateId: program.templateId });
      } catch (err) {
        // Offline/guest: no coach card. Log for visibility, never surface to the user here.
        logger.workout?.warn?.('coach program assignment load failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Local state
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishIntent, setFinishIntent] = useState<'finish' | 'cancel'>('finish');

  // Draft-vs-template conflict: the user explicitly asked to start a template
  // but a restored unfinished draft already populated the reducer (the
  // template-load effect bails when exercises exist). Captured ONCE at mount —
  // the user must choose between resuming the draft and starting fresh,
  // instead of the draft silently hijacking the requested program.
  const [showDraftConflict, setShowDraftConflict] = useState(
    () => !!initialTemplateId && state.exercises.length > 0
  );
  const handleResumeDraft = useCallback(() => setShowDraftConflict(false), []);
  const handleStartNewFromTemplate = useCallback(() => {
    // Discard the draft in place; with exercises empty again, the
    // template-load effect in useWorkoutEffects fires and loads the program.
    dispatch({ type: 'RESET_ACTIVE_WORKOUT' });
    setShowDraftConflict(false);
  }, [dispatch]);

  // PR celebration dismiss (auto-fired by the banner after ~2.5s).
  const handleDismissPRCelebration = useCallback(
    () => dispatch({ type: 'HIDE_PR_CELEBRATION' }),
    [dispatch]
  );

  // Optional pre-workout planning table. `planningMode` gates a full-screen
  // planning step; `planDraft` holds the exercises picked in the selector that
  // seed it. Both are transient UI state — nothing is committed to the reducer
  // until the trainee taps "התחל אימון" (which dispatches SET_EXERCISES).
  const [planningMode, setPlanningMode] = useState(false);
  const [planDraft, setPlanDraft] = useState<ActiveExercise[]>([]);

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
      dispatch,
      workoutSettings,
      finishIntent,
      setShowFinishConfirm,
      item,
      onExit,
      templateId: initialTemplateId,
    });

  // ── Back-button guard ─────────────────────────────────────────────────
  // A stray hardware-Back / swipe-back must not silently tear down a live
  // session. While exercises exist we keep a same-URL sentinel entry on the
  // history stack: pressing Back pops the sentinel (the /workout route — and
  // this component — stay mounted), and we convert the gesture into the
  // existing discard-confirm dialog while re-arming the sentinel.
  const hasLiveSession = state.exercises.length > 0 && !showSummary;
  useEffect(() => {
    if (!hasLiveSession) return undefined;
    window.history.pushState({ fsWorkoutGuard: true }, '');
    const onPopState = () => {
      window.history.pushState({ fsWorkoutGuard: true }, '');
      setFinishIntent('cancel');
      setShowFinishConfirm(true);
    };
    // Tab close / refresh — native confirm (session state is auto-persisted,
    // but the user should still know they're leaving mid-workout).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Consume the sentinel so post-workout navigation isn't one entry
      // behind. Skipped when the router already moved on (state isn't ours).
      if ((window.history.state as { fsWorkoutGuard?: boolean } | null)?.fsWorkoutGuard) {
        window.history.back();
      }
    };
  }, [hasLiveSession]);

  // Superset creation via picker bottom sheet + remove handler.
  const {
    supersetPickerOpen,
    supersetAnchorId,
    openSupersetPicker,
    closeSupersetPicker,
    confirmSuperset,
    handleRemoveSuperset,
  } = useSupersetMode({
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
    workoutSettings,
    showGoalSelector: state.showGoalSelector,
    showWarmup: state.showWarmup,
    showCooldown: state.showCooldown,
    showExerciseSelector: state.showExerciseSelector,
    showQuickForm: state.showQuickForm,
    initialTemplateId,
    preWorkoutScreenShown,
    completedSetsCount: derived.completedSetsCount,
    currentExercise: derived.currentExercise,
    keepScreenAwake,
    announceSetComplete,
    pendingTimeouts,
  });

  // Stable nextSetHint string for InlineRestTimer (Hebrew kicker).
  const nextSetHint = useMemo(() => {
    if (derived.activeSetIndex >= 0) {
      return `הסט הבא · ${String(derived.activeSetIndex + 1).padStart(2, '0')}`;
    }
    return undefined;
  }, [derived.activeSetIndex]);

  // Planned weight/reps for the upcoming set — rendered as a dir="ltr" numeric
  // chip in the rest timer so the user previews exactly what's next. Read from
  // the active set; 0 means "not yet planned" and the chip is omitted.
  const nextSetTargets = useMemo(() => {
    if (derived.activeSetIndex < 0) return undefined;
    const nextSet = derived.currentExercise?.sets?.[derived.activeSetIndex];
    if (!nextSet) return undefined;
    return { weight: nextSet.weight ?? 0, reps: nextSet.reps ?? 0 };
  }, [derived.activeSetIndex, derived.currentExercise]);

  // PR info for current exercise
  const prInfo = useMemo(() => {
    if (!derived.currentExercise) return '';
    const pr = getPRForExercise(derived.currentExercise.name ?? '');
    if (!pr) return '';
    return `PR: ${pr.maxWeight} ק״ג`;
  }, [derived.currentExercise, getPRForExercise]);

  // Workout stats for confirm dialog
  const workoutStats = useMemo(() => {
    const elapsed = Math.floor((Date.now() - state.startTimestamp - state.totalPausedTime) / 1000);
    // Non-warmup sets with data entered but never checked — the session
    // builder silently drops them, so the confirm dialog warns first.
    const pendingSets = state.exercises.reduce(
      (sum, ex) =>
        sum +
        (ex.sets ?? []).filter(
          (s) => !s.completedAt && !s.isWarmup && ((s.weight ?? 0) > 0 || (s.reps ?? 0) > 0)
        ).length,
      0
    );
    return {
      completedSets: derived.completedSetsCount,
      totalVolume: derived.totalVolume,
      duration: formatTime(elapsed),
      pendingSets,
    };
  }, [
    state.startTimestamp,
    state.totalPausedTime,
    state.exercises,
    derived.completedSetsCount,
    derived.totalVolume,
  ]);

  // All dispatch-wrapper handlers extracted to a hook for brevity.
  const currentExerciseName = derived.currentExercise?.name || '';
  const {
    handleUpdateSet,
    handleCompleteSet,
    handleAddSet,
    handleOpenNumpad,
    handleUndoSet,
    handleSkipSet,
    handleUpdateSetSegments,
    handleUpdateRPE,
    handleUpdateRpeTag,
    handleToggleTechnique,
    handleOpenPlateCalc,
    handleClosePlateCalc,
    handleUpdateNotes,
    handleEditSet,
    handleEditSetInList,
    handleDeleteSet,
    handleRenameExercise,
    handleTogglePause,
    handleFinishRequest,
    handleDiscardRequest,
    handleChangeExercise,
    handleNextExercise,
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
    handleNumpadSubmitAdvance,
    handleNumpadClear,
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
    exercises: state.exercises,
    personalExerciseLibrary,
    workoutSettings,
    currentExerciseName,
    setFinishIntent,
    setShowFinishConfirm,
    setSaveError,
    pendingTimeouts,
  });

  // "התחל סט הבא" from the rest timer: skip rest AND open the weight entry for
  // the next set in one tap, removing the skip-then-find-input step.
  const handleStartNextSet = useCallback(() => {
    handleSkipRest();
    handleOpenNumpad('weight');
  }, [handleSkipRest, handleOpenNumpad]);

  // Mid-workout movement swap — replace the live exercise with a chosen
  // alternative from its "חלופות" sheet. Session-scoped: only the live exercise
  // changes (the persistent, next-time swap stays the Program-page swap). The
  // reducer keeps the prescription intact and re-lists the previous movement as
  // an alternative so the user can swap back. Selection haptic fires in the sheet.
  const handleSwapExercise = useCallback(
    (exerciseId: string, newName: string) => {
      dispatch({ type: 'SWAP_EXERCISE', payload: { exerciseId, newName } });
    },
    [dispatch]
  );

  // Horizontal swipe navigation between exercises (pointer-based, RTL-aware).
  const { handleSwipePointerDown, handleSwipePointerMove, handleSwipePointerEnd } =
    useSwipeNavigation({
      currentExerciseIndex: state.currentExerciseIndex,
      exercisesLength: state.exercises.length,
      onChangeExercise: handleChangeExercise,
    });

  // Start the coach-assigned program: ensure the referenced template is synced
  // into the local-first store (it lives in Supabase), then SPA-navigate into
  // the workout flow with that template. Mirrors MyCoach.startProgram so both
  // entry points behave identically.
  const handleStartCoachProgram = async () => {
    if (!coachProgram || startingCoachProgram) return;
    setStartingCoachProgram(true);
    try {
      await syncTemplatesFromCloud();
      navigate(`/workout/${coachProgram.templateId}`);
    } catch (err) {
      logger.workout?.error?.('failed to start coach program', err);
      setStartingCoachProgram(false);
    }
  };

  // If showing summary
  if (showSummary && completedSession) {
    return <WorkoutSummaryView completedSession={completedSession} onExit={onExit} />;
  }

  // Optional pre-workout planning table. Gated before the empty-state branch so
  // it owns the screen while the draft is uncommitted (the reducer still has no
  // exercises at this point — the draft lives entirely in WorkoutPlanScreen).
  if (planningMode) {
    return (
      <React.Suspense fallback={null}>
        <WorkoutPlanScreen
          initialExercises={planDraft}
          defaultSets={workoutSettings.defaultSets ?? 3}
          weightIncrement={workoutSettings.weightIncrementAmount ?? 2.5}
          goal={workoutSettings.defaultWorkoutGoal}
          oledMode={!!workoutSettings.oledMode}
          showGhostValues={showGhostValues}
          onStart={(exercises) => {
            dispatch({ type: 'SET_EXERCISES', payload: exercises });
            dispatch({ type: 'CHANGE_EXERCISE', payload: 0 });
            setPlanningMode(false);
            setPlanDraft([]);
          }}
          onCancel={() => {
            // Back to exercise selection: drop the draft and reopen the selector.
            setPlanningMode(false);
            setPlanDraft([]);
            dispatch({ type: 'OPEN_SELECTOR' });
          }}
        />
      </React.Suspense>
    );
  }

  // If no current exercise OR exercise has no name, show PreWorkoutScreen for initial welcome
  if (!derived.currentExercise || !derived.currentExercise.name?.trim()) {
    return (
      <>
        {/* PreWorkoutScreen is rendered OUTSIDE Suspense so it always stays
            mounted. Previously it shared one Suspense boundary with the lazy
            ExerciseSelector: pressing "התחל אימון" set showExerciseSelector,
            which mounted the lazy selector and SUSPENDED the shared boundary —
            replacing the whole subtree (including this welcome screen) with the
            blank fallback until the chunk resolved. On any delay/abort that read
            as "nothing happened / the library never opened". Keeping the welcome
            screen out of Suspense, and giving the lazy overlays their own
            boundary with a transparent fallback, makes the selector overlay
            reliably on top the moment its chunk is ready. */}
        <PreWorkoutScreen
          oledMode={!!workoutSettings.oledMode}
          coachProgramTitle={coachProgram?.title ?? null}
          hasCoachProgram={!!coachProgram}
          isStartingCoachProgram={startingCoachProgram}
          onStartCoachProgram={handleStartCoachProgram}
          onStartWorkout={() => {
            // Mark that the welcome screen was shown. Clear any stuck flow modals
            // (goal/warmup can linger on if a prior session left them set) so the
            // selector isn't blocked, then open it for the empty-start path.
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
            setPreWorkoutScreenShown(true);
            dispatch({ type: 'OPEN_SELECTOR' });
          }}
          onCancel={() => {
            // User explicitly cancelled — clear the persisted pre-workout intent
            // so the selector can't reopen on a future mount, close any open
            // modals, then exit.
            setPreWorkoutScreenShown(false);
            dispatch({ type: 'CLOSE_SELECTOR' });
            dispatch({ type: 'CLOSE_QUICK_FORM' });
            dispatch({ type: 'TOGGLE_SETTINGS', payload: false });
            setShowFinishConfirm(false);
            onExit();
          }}
          onSelectTemplate={(templateId: string) => {
            // SPA navigation (preserves app state) — the route remounts the
            // workout with this template via initialTemplateId. Previously this
            // did a full page reload (window.location.href), losing state.
            navigate(`/workout/${templateId}`);
          }}
        />

        {/* Lazy overlays get their OWN Suspense with a transparent fallback so a
            still-loading chunk can never blank the welcome screen behind them. */}
        {(state.showExerciseSelector || state.showQuickForm) && (
          <React.Suspense fallback={null}>
            {state.showExerciseSelector && (
              <ExerciseSelector
                isOpen={true}
                onSelect={(ex) => dispatch({ type: 'ADD_EXERCISE', payload: ex })}
                onClose={() => dispatch({ type: 'CLOSE_SELECTOR' })}
                onCreateNew={() => dispatch({ type: 'OPEN_QUICK_FORM' })}
                goal={workoutSettings.defaultWorkoutGoal}
                onPlanRequested={(exercises) => {
                  // Hand the picks to the planning table instead of starting now.
                  setPlanDraft(exercises);
                  setPlanningMode(true);
                  dispatch({ type: 'CLOSE_SELECTOR' });
                }}
              />
            )}

            {state.showQuickForm && (
              <QuickExerciseForm
                onAdd={(ex) => dispatch({ type: 'ADD_EXERCISE', payload: ex })}
                onClose={() => dispatch({ type: 'CLOSE_QUICK_FORM' })}
              />
            )}
          </React.Suspense>
        )}
      </>
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

      {/* PR celebration — compact lime banner (the one earned use of
          --fs-signal). Visual only: WorkoutAriaLive owns the SR announcement.
          Honors the user's celebration-intensity setting ('off' hides it). */}
      {(workoutSettings.prCelebrationIntensity ?? 'full') !== 'off' && (
        <PRCelebrationBanner pr={state.showPRCelebration} onDismiss={handleDismissPRCelebration} />
      )}

      {/* Restored-draft vs requested-template conflict */}
      <DraftConflictDialog
        isOpen={showDraftConflict}
        onResume={handleResumeDraft}
        onStartNew={handleStartNewFromTemplate}
      />

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
          onTogglePause={handleTogglePause}
          isSaving={isSaving}
          restTimerActive={state.restTimer.active}
          restTimerEndTime={state.restTimer.endTime}
          onSkipRest={handleSkipRest}
          onAddRestTime={handleAddRestTime}
          onStartNextSet={handleStartNextSet}
          nextSetHint={nextSetHint}
          nextSetWeight={nextSetTargets?.weight}
          nextSetReps={nextSetTargets?.reps}
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
            onAddSet={handleAddSet}
            onNextExercise={handleNextExercise}
            hasNextExercise={state.currentExerciseIndex < state.exercises.length - 1}
            onOpenNumpad={handleOpenNumpad}
            onRenameExercise={handleRenameExercise}
            onEditSet={handleEditSet}
            nameSuggestions={nameSuggestions}
            onUpdateRPE={handleUpdateRPE}
            onUpdateRpeTag={handleUpdateRpeTag}
            onUpdateNotes={handleUpdateNotes}
            onUndo={handleUndoSet}
            onSkipSet={handleSkipSet}
            onUpdateSetSegments={handleUpdateSetSegments}
            showGhostValues={showGhostValues}
            showVolumePreview={showVolumePreview}
            enableQuickWeightButtons={enableQuickWeightButtons}
            enableQuickRepsButtons={enableQuickRepsButtons}
            weightIncrement={workoutSettings.weightIncrementAmount ?? 2.5}
            supersetGroups={state.supersetGroups}
            onCreateSuperset={openSupersetPicker}
            onRemoveSuperset={handleRemoveSuperset}
            onToggleTechnique={handleToggleTechnique}
            onOpenPlateCalc={handleOpenPlateCalc}
            onSwapExercise={handleSwapExercise}
            onOpenAICoach={handleOpenTutorial}
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
          supersetGroups={state.supersetGroups}
        />
      </div>

      {/* === OVERLAYS === */}
      <WorkoutOverlays
        numpad={state.numpad}
        onNumpadInput={handleNumpadInput}
        onNumpadSetValue={handleNumpadSetValue}
        onNumpadDelete={handleNumpadDelete}
        onNumpadSubmit={handleNumpadSubmit}
        onNumpadSubmitAdvance={handleNumpadSubmitAdvance}
        onNumpadClear={handleNumpadClear}
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
        supersetGroups={state.supersetGroups}
        onCreateSupersetGroup={confirmSuperset}
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

      {/* Superset picker — anchored on the exercise whose chip was tapped */}
      {supersetPickerOpen && (
        <SupersetPicker
          isOpen={supersetPickerOpen}
          exercises={state.exercises}
          anchorExerciseId={supersetAnchorId}
          existingGroups={state.supersetGroups}
          onConfirm={confirmSuperset}
          onClose={closeSupersetPicker}
        />
      )}
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
