// ActiveWorkout - Main workout component that composes everything
// This replaces the old 1295-line monolithic ActiveWorkout.tsx

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Exercise, PersonalItem, WorkoutGoal, WorkoutSettings } from '../../types';

import { useWorkoutDerived, useWorkoutDispatch, useWorkoutState } from './core/WorkoutContext';
// Core
import { WorkoutProvider } from './core/WorkoutProvider';

// Components
import { ExerciseDisplay, ExerciseNav, ProgressBar, WorkoutHeader } from './components';
// Inline editorial rest strip (small — imported normally)
import InlineRestTimer from './components/InlineRestTimer';
// Slide-to-complete CTA pinned to bottom of workout shell (above safe-area)
import SlideToComplete from './components/SlideToComplete';
// Aria-live announcer for screen readers (set complete, rest start/end, PRs)
import WorkoutAriaLive from './components/WorkoutAriaLive';

// Overlays (lazy - loaded on demand)
const NumpadOverlay = React.lazy(() => import('./overlays/NumpadOverlay'));
const ConfirmExitOverlay = React.lazy(() => import('./overlays/ConfirmExitOverlay'));
const PlateCalculatorOverlay = React.lazy(() => import('./overlays/PlateCalculatorOverlay'));

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

import OverlayLoader from './components/ui/OverlayLoader';
import { ToastContainer } from './components/ui/Toast';
import OverlayErrorBoundary from './core/OverlayErrorBoundary';
// Extracted components
import PreWorkoutScreen from './states/PreWorkoutScreen';

// Existing components we preserve - WaterReminderToast kept static (small and frequently shown)
import WaterReminderToast from './WaterReminderToast';

// Lazy loaded components (heavy - only loaded when needed)
// Following Vercel best practices: bundle-dynamic-imports
const WorkoutSummary = React.lazy(() => import('./WorkoutSummary'));
const ExerciseTutorial = React.lazy(() => import('./ExerciseTutorial'));
const ExerciseSelector = React.lazy(() => import('./ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('./QuickExerciseForm'));
const WorkoutSettingsOverlay = React.lazy(() => import('./overlays/WorkoutSettingsOverlay'));
const WarmupCooldownFlow = React.lazy(() => import('./WarmupCooldownFlow'));
const WorkoutGoalSelector = React.lazy(() => import('./WorkoutGoalSelector'));
const ExerciseReorder = React.lazy(() => import('./ExerciseReorder'));

// Services
import { createWorkoutTemplate, getWorkoutTemplates } from '../../services/dataService';
// Exercise names derived from personalExercises loaded below (getExerciseNames removed — was broken)
import { createWorkoutSet } from '../../types';

import { playSuccess } from '../../utils/audio';
// CSS
import { triggerHaptic } from '../../utils/haptics';
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

  // Track last announced set count to avoid re-announcing on re-renders
  const lastAnnouncedSetsRef = useRef(0);

  // Track pending setTimeout IDs to clear on unmount (prevent dispatch-after-unmount)
  const pendingTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      pendingTimeouts.current.forEach(clearTimeout);
    },
    []
  );

  // Settings
  const workoutSettings: Partial<WorkoutSettings> = state.appSettings?.workoutSettings || {};

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

  // Keep screen awake when workout is active
  useEffect(() => {
    const releaseWakeLock = keepScreenAwake();
    return () => {
      if (releaseWakeLock) releaseWakeLock();
    };
  }, [keepScreenAwake]);

  // Voice announcement: set complete + next exercise name
  useEffect(() => {
    const count = derived.completedSetsCount;
    // Guard: only trigger when a NEW set is completed (not on re-render)
    if (count === 0 || count === lastAnnouncedSetsRef.current) return;
    lastAnnouncedSetsRef.current = count;

    const currentEx = derived.currentExercise;
    const exercises = state.exercises;
    const currentIdx = state.currentExerciseIndex;

    if (!currentEx) return;

    // Determine next exercise: if current exercise has more sets pending,
    // we don't announce next exercise name yet
    const currentSets = currentEx.sets || [];
    const hasMoreSets = currentSets.some((s) => !s.completedAt);

    if (!hasMoreSets) {
      // Current exercise is done — announce next exercise name
      const nextExercise = exercises[currentIdx + 1];
      announceSetComplete(nextExercise?.name);
    } else {
      // More sets remaining in current exercise
      announceSetComplete();
    }
  }, [
    derived.completedSetsCount,
    derived.currentExercise,
    state.exercises,
    state.currentExerciseIndex,
    announceSetComplete,
  ]);

  // Load initial template if provided (from PreWorkoutScreen quick-start)
  useEffect(() => {
    if (!initialTemplateId || state.exercises.length > 0) return;

    const loadTemplate = async () => {
      try {
        const templates = await getWorkoutTemplates();
        const template = templates.find((t) => t.id === initialTemplateId);
        if (template?.exercises && template.exercises.length > 0) {
          triggerHaptic('success');
          for (const ex of template.exercises) {
            const exercise: Exercise = {
              id:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? `ex-${crypto.randomUUID()}`
                  : `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              name: ex.name || ex.exerciseName || 'Unknown',
              muscleGroup: ex.muscleGroup,
              targetRestTime: ex.targetRestTime || 90,
              // Always start with a single empty set — user defines sets during the workout
              sets: [createWorkoutSet({ reps: 0, weight: 0 })],
            };
            dispatch({ type: 'ADD_EXERCISE', payload: exercise });
          }
        }
      } catch {
        // Template loading failed, show selector
        dispatch({ type: 'OPEN_SELECTOR' });
      }
    };
    loadTemplate();
  }, [initialTemplateId, state.exercises.length, dispatch]);

  // Workout start flow - runs once on mount (StrictMode-safe via ref guard)
  const startFlowRan = useRef(false);
  useEffect(() => {
    if (startFlowRan.current) return;
    startFlowRan.current = true;

    const elapsed = Math.floor((Date.now() - state.startTimestamp) / 1000);
    if (elapsed > 10) return; // Only run on fresh workout start

    const warmupPreference = workoutSettings.warmupPreference || 'ask';
    const hasGoal = !!workoutSettings.defaultWorkoutGoal;

    // If no goal set, show goal selector first (warmup will trigger after goal selection)
    if (!hasGoal && !state.showGoalSelector && !state.showWarmup) {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: true } });
      return;
    }

    // If goal is already set, check warmup preference directly
    if (
      hasGoal &&
      warmupPreference !== 'never' &&
      !state.showWarmup &&
      !state.showExerciseSelector
    ) {
      // Show warmup flow
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
    }
  }, [
    state.startTimestamp,
    workoutSettings,
    dispatch,
    state.showGoalSelector,
    state.showWarmup,
    state.showExerciseSelector,
  ]);

  // Handle goal selection - optionally trigger warmup
  const handleGoalSelect = useCallback(
    (goal: WorkoutGoal) => {
      triggerHaptic('medium');
      dispatch({ type: 'UPDATE_SETTINGS', payload: { defaultWorkoutGoal: goal } });
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });

      // Check warmup preference
      const warmupPreference = workoutSettings.warmupPreference || 'ask';
      if (warmupPreference === 'always') {
        pendingTimeouts.current.push(
          setTimeout(() => {
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
          }, 300)
        );
      } else if (warmupPreference === 'ask') {
        // Could show a prompt here, for now let's trigger warmup
        pendingTimeouts.current.push(
          setTimeout(() => {
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
          }, 300)
        );
      }
      // 'never' - do nothing
    },
    [dispatch, workoutSettings.warmupPreference]
  );

  // Auto-open exercise selector only AFTER PreWorkoutScreen has been shown
  // (i.e., user has seen the welcome screen first)
  useEffect(() => {
    if (
      preWorkoutScreenShown &&
      state.exercises.length === 0 &&
      !state.showExerciseSelector &&
      !state.showQuickForm &&
      !state.showGoalSelector &&
      !state.showWarmup &&
      !state.showCooldown
    ) {
      dispatch({ type: 'OPEN_SELECTOR' });
    }
  }, [
    preWorkoutScreenShown,
    state.exercises.length,
    state.showExerciseSelector,
    state.showQuickForm,
    state.showGoalSelector,
    state.showWarmup,
    state.showCooldown,
    dispatch,
  ]);

  // Water reminder — reads correct settings keys with configurable interval
  useEffect(() => {
    if (!workoutSettings.waterReminderEnabled) return;

    const minutes = (workoutSettings.waterReminderInterval as number) || 15;
    const WATER_INTERVAL = minutes * 60 * 1000;
    const interval = setInterval(() => {
      setShowWaterReminder(true);
    }, WATER_INTERVAL);

    return () => clearInterval(interval);
  }, [workoutSettings.waterReminderEnabled, workoutSettings.waterReminderInterval]);

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

  // Handlers
  const handleUpdateSet = useCallback(
    (field: 'weight' | 'reps', value: number) => {
      triggerHaptic('light');
      dispatch({ type: 'UPDATE_SET', payload: { field, value } });
    },
    [dispatch]
  );

  const handleCompleteSet = useCallback(() => {
    triggerHaptic('success');
    playSuccess();
    dispatch({ type: 'COMPLETE_SET' });
  }, [dispatch]);

  const handleOpenNumpad = useCallback(
    (target: 'weight' | 'reps') => {
      triggerHaptic('light');
      dispatch({ type: 'OPEN_NUMPAD', payload: target });
    },
    [dispatch]
  );

  const handleUndoSet = useCallback(() => {
    triggerHaptic('medium');
    dispatch({ type: 'UNDO_LAST_SET' });
  }, [dispatch]);

  const handleUpdateRPE = useCallback(
    (rpe: number | null) => {
      if (rpe !== null) triggerHaptic('light');
      dispatch({ type: 'UPDATE_SET_RPE', payload: rpe ?? undefined });
    },
    [dispatch]
  );

  const handleToggleTechnique = useCallback(
    (technique: 'warmup' | 'dropSet' | 'failure' | 'restPause', value: boolean) => {
      dispatch({ type: 'SET_TECHNIQUE', payload: { technique, value } });
    },
    [dispatch]
  );

  const handleOpenPlateCalc = useCallback(() => {
    dispatch({ type: 'OPEN_PLATE_CALC' });
  }, [dispatch]);

  const handleClosePlateCalc = useCallback(() => {
    dispatch({ type: 'CLOSE_PLATE_CALC' });
  }, [dispatch]);

  const handleUpdateNotes = useCallback(
    (notes: string) => {
      dispatch({ type: 'UPDATE_SET_NOTES', payload: notes });
    },
    [dispatch]
  );

  // Edit a specific set (for the SetEditBottomSheet)
  const handleEditSet = useCallback(
    (setIndex: number, updates: { weight?: number; reps?: number }) => {
      dispatch({
        type: 'EDIT_SPECIFIC_SET',
        payload: {
          exerciseIndex: state.currentExerciseIndex,
          setIndex,
          updates,
        },
      });
    },
    [dispatch, state.currentExerciseIndex]
  );

  // Edit a specific set in list view (from ExerciseReorder)
  const handleEditSetInList = useCallback(
    (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number }) => {
      dispatch({
        type: 'EDIT_SPECIFIC_SET',
        payload: { exerciseIndex, setIndex, updates },
      });
    },
    [dispatch]
  );

  // Delete a specific set (from ExerciseReorder)
  const handleDeleteSet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      dispatch({
        type: 'DELETE_SET',
        payload: { exerciseIndex, setIndex },
      });
    },
    [dispatch]
  );

  const handleRenameExercise = useCallback(
    (name: string) => {
      dispatch({ type: 'RENAME_EXERCISE', payload: { index: state.currentExerciseIndex, name } });

      // Apply library metadata if match found
      const match = personalExerciseLibrary.find((pe) => pe.name === name);
      if (match) {
        dispatch({
          type: 'UPDATE_EXERCISE_META',
          payload: {
            index: state.currentExerciseIndex,
            muscleGroup: match.muscleGroup,
            tempo: match.tempo,
            targetRestTime: match.defaultRestTime,
            tutorialText: match.tutorialText,
          },
        });
      }
    },
    [dispatch, state.currentExerciseIndex, personalExerciseLibrary]
  );

  const handleFinishRequest = useCallback(() => {
    // Honor cooldownPreference: 'always' shows cooldown flow first, then
    // finish confirm. 'ask'/'never' goes straight to confirmation (the
    // confirm overlay still exposes a manual Cooldown button for 'ask').
    triggerHaptic('light');
    setFinishIntent('finish');
    const pref = workoutSettings.cooldownPreference || 'ask';
    if (pref === 'always') {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
      return;
    }
    setShowFinishConfirm(true);
  }, [dispatch, workoutSettings.cooldownPreference]);

  const handleDiscardRequest = useCallback(() => {
    // Show confirmation dialog with cancel intent
    triggerHaptic('light');
    setFinishIntent('cancel');
    setShowFinishConfirm(true);
  }, []);

  // Stable handlers for child components to prevent unnecessary re-renders
  const handleChangeExercise = useCallback(
    (idx: number) => {
      dispatch({ type: 'CHANGE_EXERCISE', payload: idx });
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

  const handleOpenDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: true });
  }, [dispatch]);

  const handleCloseDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: false });
  }, [dispatch]);

  const handleCloseSelector = useCallback(() => {
    dispatch({ type: 'CLOSE_SELECTOR' });
  }, [dispatch]);

  const handleAddExercise = useCallback(
    (ex: Exercise) => {
      dispatch({ type: 'ADD_EXERCISE', payload: ex });
    },
    [dispatch]
  );

  const handleSkipRest = useCallback(() => {
    dispatch({ type: 'SKIP_REST' });
  }, [dispatch]);

  const handleAddRestTime = useCallback(
    (seconds: number) => {
      dispatch({ type: 'ADD_REST_TIME', payload: seconds });
    },
    [dispatch]
  );

  const handleNumpadInput = useCallback(
    (digit: string) => {
      dispatch({ type: 'NUMPAD_INPUT', payload: digit });
    },
    [dispatch]
  );

  const handleNumpadSetValue = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_NUMPAD_VALUE', payload: value });
    },
    [dispatch]
  );

  const handleNumpadDelete = useCallback(() => {
    dispatch({ type: 'NUMPAD_DELETE' });
  }, [dispatch]);

  const handleNumpadSubmit = useCallback(() => {
    dispatch({ type: 'NUMPAD_SUBMIT' });
  }, [dispatch]);

  const handleCloseNumpad = useCallback(() => {
    dispatch({ type: 'CLOSE_NUMPAD' });
  }, [dispatch]);

  const handleCloseSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS', payload: false });
  }, [dispatch]);

  const handleUpdateSetting = useCallback(
    (key: string, value: unknown) => {
      dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    },
    [dispatch]
  );

  // Stable handlers for WorkoutHeader so its memo holds across state ticks.
  // Without these, inline arrow props broke memo on every parent re-render,
  // causing WorkoutHeader (and its MonoTimer subtree) to re-render on every
  // set log, numpad keypress, RPE pick, etc.
  const handleOpenSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS', payload: true });
  }, [dispatch]);

  const currentExerciseNameForTutorial = derived.currentExercise?.name || '';
  const handleOpenTutorial = useCallback(() => {
    dispatch({ type: 'SHOW_TUTORIAL', payload: currentExerciseNameForTutorial });
  }, [dispatch, currentExerciseNameForTutorial]);

  const handleReorderExercises = useCallback(
    (newOrder: Exercise[]) => {
      dispatch({ type: 'REORDER_EXERCISES', payload: newOrder });
    },
    [dispatch]
  );

  const handleSelectExerciseFromList = useCallback(
    (idx: number) => {
      dispatch({ type: 'CHANGE_EXERCISE', payload: idx });
      dispatch({ type: 'TOGGLE_DRAWER', payload: false });
    },
    [dispatch]
  );

  const handleRemoveExercise = useCallback(
    (idx: number) => {
      dispatch({ type: 'REMOVE_EXERCISE', payload: idx });
    },
    [dispatch]
  );

  const handleOpenQuickForm = useCallback(() => {
    dispatch({ type: 'OPEN_QUICK_FORM' });
  }, [dispatch]);

  const handleCloseQuickForm = useCallback(() => {
    dispatch({ type: 'CLOSE_QUICK_FORM' });
  }, [dispatch]);

  const handleCancelFinish = useCallback(() => {
    setShowFinishConfirm(false);
    setSaveError(null);
  }, [setSaveError]);

  const handleCooldownFromFinish = useCallback(() => {
    setShowFinishConfirm(false);
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
  }, [dispatch]);

  const handleCloseGoalSelector = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });
  }, [dispatch]);

  // If showing summary
  if (showSummary && completedSession) {
    return (
      <React.Suspense
        fallback={
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'var(--fs-bg)' }}
          >
            <div
              style={{
                color: 'var(--fs-heading)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              תוצאות האימון...
            </div>
          </div>
        }
      >
        <WorkoutSummary
          isOpen={true}
          session={completedSession}
          onClose={() => {
            // Clear localStorage to prevent restore
            localStorage.removeItem('active_workout_v3_state');
            // Call onExit - the overlay will handle removing the item
            onExit();
          }}
          onSaveAsTemplate={async () => {
            const defaultName = completedSession.exercises?.[0]?.name || 'My Workout';
            await createWorkoutTemplate({
              name: defaultName,
              description: '',
              exercises: (completedSession.exercises || []).map((ex, idx) => ({
                id: ex.id || `ex_${idx}`,
                exerciseId: ex.exerciseId || ex.id || `exercise_${idx}`,
                exerciseName: ex.exerciseName || ex.name || 'Unknown',
                targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
                targetSets: ex.sets?.length || 4,
                targetReps: 10,
                targetWeight: null,
                restSeconds: ex.targetRestTime || ex.restSeconds || 90,
                order: idx,
                notes: '',
                // Additional fields
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                targetRestTime: ex.targetRestTime,
                tempo: ex.tempo,
                sets: ex.sets?.map((s) => ({ reps: s.reps, weight: s.weight })),
              })),
              muscleGroups: Array.from(
                new Set(
                  (completedSession.exercises || [])
                    .map((e) => e.muscleGroup)
                    .filter(Boolean) as string[]
                )
              ),
              isBuiltin: false,
              updatedAt: new Date().toISOString(),
              lastUsed: null,
              timesUsed: 0,
              isFavorite: false,
            });
          }}
        />
      </React.Suspense>
    );
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
        <div className="flex-shrink-0">
          <WorkoutHeader
            startTimestamp={state.startTimestamp}
            totalPausedTime={state.totalPausedTime}
            isPaused={state.isPaused}
            onFinish={handleFinishRequest}
            onDiscard={handleDiscardRequest}
            onOpenSettings={handleOpenSettings}
            onOpenTutorial={handleOpenTutorial}
            isSaving={isSaving}
          />

          {/* Superset Mode Indicator */}
          {supersetMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 14px',
                background: 'var(--fs-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--fs-heading)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              <span>SUPERSET · בחר תרגיל שני</span>
              <span>2 / 2</span>
            </div>
          )}

          {/* Inline Rest Timer */}
          {state.restTimer.active && (
            <InlineRestTimer
              active={state.restTimer.active}
              endTime={state.restTimer.endTime}
              onSkip={handleSkipRest}
              onAddTime={handleAddRestTime}
              nextSetHint={nextSetHint}
            />
          )}
        </div>

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
        <div
          className="w-full flex-shrink-0"
          style={{
            background: 'var(--fs-bg)',
            borderTop: '1px solid var(--fs-surface-2)',
            padding: '0 14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* 6A: Slide to complete */}
          <div style={{ paddingTop: 8 }}>
            <SlideToComplete
              label="החלק לסימון סט כבוצע"
              onComplete={handleCompleteSet}
              disabled={false}
            />
          </div>

          {/* 6B: Nav row */}
          <ExerciseNav
            exercises={state.exercises}
            currentIndex={state.currentExerciseIndex}
            onChangeExercise={handleChangeExercise}
            onOpenDrawer={handleOpenDrawer}
            onAddExercise={() => {
              dispatch({ type: 'OPEN_SELECTOR' });
            }}
          />

          {/* 6C: Next up strip */}
          {state.currentExerciseIndex < state.exercises.length - 1 &&
            (() => {
              const nextEx = state.exercises[state.currentExerciseIndex + 1];
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: 'color-mix(in srgb, var(--fs-accent) 6%, var(--fs-surface))',
                    border: '1px solid color-mix(in srgb, var(--fs-accent) 14%, transparent)',
                    borderRadius: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fs-accent)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    הבא:
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--fs-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      direction: 'ltr',
                    }}
                  >
                    {nextEx?.name || '—'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--fs-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {nextEx?.sets?.length || 0} sets
                  </span>
                </div>
              );
            })()}
        </div>
      </div>

      {/* === OVERLAYS === */}

      {/* Numpad */}
      <React.Suspense fallback={null}>
        <NumpadOverlay
          isOpen={state.numpad.isOpen}
          target={state.numpad.target}
          value={state.numpad.value}
          onInput={handleNumpadInput}
          onSetValue={handleNumpadSetValue}
          onDelete={handleNumpadDelete}
          onSubmit={handleNumpadSubmit}
          onClose={handleCloseNumpad}
        />
      </React.Suspense>

      {/* Plate Calculator */}
      {state.showPlateCalc && (
        <React.Suspense fallback={null}>
          <PlateCalculatorOverlay
            isOpen={state.showPlateCalc}
            onClose={handleClosePlateCalc}
            initialTarget={derived.currentSet?.weight || 60}
          />
        </React.Suspense>
      )}

      {/* Confirm Exit */}
      <React.Suspense fallback={null}>
        <ConfirmExitOverlay
          isOpen={showFinishConfirm}
          intent={finishIntent}
          workoutStats={workoutStats}
          onConfirm={handleConfirmFinish}
          onCancel={handleCancelFinish}
          onCooldown={handleCooldownFromFinish}
          isSaving={isSaving}
          saveError={saveError}
        />
      </React.Suspense>

      {/* Settings Overlay */}
      <OverlayErrorBoundary fallbackLabel="שגיאה בהגדרות" onDismiss={handleCloseSettings}>
        <React.Suspense fallback={<OverlayLoader />}>
          <WorkoutSettingsOverlay
            isOpen={state.showSettings}
            settings={workoutSettings}
            onClose={handleCloseSettings}
            onUpdateSetting={handleUpdateSetting}
          />
        </React.Suspense>
      </OverlayErrorBoundary>

      {/* Exercise List Drawer */}
      {state.isDrawerOpen && (
        <React.Suspense fallback={null}>
          <ExerciseReorder
            exercises={state.exercises}
            currentIndex={state.currentExerciseIndex}
            onReorder={handleReorderExercises}
            onSelectExercise={handleSelectExerciseFromList}
            onDeleteExercise={handleRemoveExercise}
            onEditSet={handleEditSetInList}
            onDeleteSet={handleDeleteSet}
            onClose={handleCloseDrawer}
          />
        </React.Suspense>
      )}
      {/* Exercise Selector */}
      {state.showExerciseSelector && (
        <React.Suspense fallback={null}>
          <ExerciseSelector
            isOpen={true}
            onSelect={handleAddExercise}
            onClose={handleCloseSelector}
            onCreateNew={handleOpenQuickForm}
            goal={workoutSettings.defaultWorkoutGoal}
          />
        </React.Suspense>
      )}

      {/* Quick Exercise Form */}
      {state.showQuickForm && (
        <React.Suspense fallback={null}>
          <QuickExerciseForm onAdd={handleAddExercise} onClose={handleCloseQuickForm} />
        </React.Suspense>
      )}

      {/* Goal Selector */}
      {state.showGoalSelector && (
        <React.Suspense fallback={null}>
          <WorkoutGoalSelector onSelect={handleGoalSelect} onClose={handleCloseGoalSelector} />
        </React.Suspense>
      )}

      {/* Warmup Flow */}
      {state.showWarmup && (
        <React.Suspense fallback={null}>
          <WarmupCooldownFlow
            type="warmup"
            onComplete={() => {
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
              // After warmup, open exercise selector if no exercises
              if (state.exercises.length === 0) {
                pendingTimeouts.current.push(
                  setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300)
                );
              }
            }}
            onSkip={() => {
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
              // After skip, open exercise selector if no exercises
              if (state.exercises.length === 0) {
                pendingTimeouts.current.push(
                  setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300)
                );
              }
            }}
          />
        </React.Suspense>
      )}

      {/* Cooldown Flow */}
      {state.showCooldown && (
        <React.Suspense fallback={null}>
          <WarmupCooldownFlow
            type="cooldown"
            onComplete={() => {
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: false } });
              // After cooldown, show finish confirm
              setFinishIntent('finish');
              setShowFinishConfirm(true);
            }}
            onSkip={() => {
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: false } });
              // After skip, show finish confirm
              setFinishIntent('finish');
              setShowFinishConfirm(true);
            }}
          />
        </React.Suspense>
      )}

      {/* Tutorial + AI Coach */}
      <OverlayErrorBoundary
        fallbackLabel="שגיאה ב-AI"
        onDismiss={() => {
          dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'tutorial', isOpen: false } });
          dispatch({ type: 'CLOSE_AI_COACH' });
        }}
      >
        <React.Suspense fallback={null}>
          {state.showTutorial && state.tutorialExercise && (
            <ExerciseTutorial
              isOpen={true}
              exerciseName={state.tutorialExercise}
              customNotes={derived.currentExercise?.programExtras?.notes as string | undefined}
              onClose={() =>
                dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'tutorial', isOpen: false } })
              }
            />
          )}

          {/* AI Coach (temporarily hidden for Fresh Steel redesign) */}
          {/* {state.showAICoach && derived.currentExercise && (
            <AICoach
              currentExercise={derived.currentExercise}
              onClose={() => dispatch({ type: 'CLOSE_AI_COACH' })}
            />
          )} */}
        </React.Suspense>
      </OverlayErrorBoundary>

      {/* Water Reminder Toast */}
      <WaterReminderToast
        isVisible={showWaterReminder}
        onDismiss={() => setShowWaterReminder(false)}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />

      {/* Saving overlay (blocks interactions + signals progress) */}
      {isSaving && <OverlayLoader />}
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
