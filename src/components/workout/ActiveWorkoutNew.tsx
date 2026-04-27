// ActiveWorkout - Main workout component that composes everything
// This replaces the old 1295-line monolithic ActiveWorkout.tsx

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  Exercise,
  PersonalExercise,
  PersonalItem,
  WorkoutExercise,
  WorkoutGoal,
  WorkoutSession,
  WorkoutSettings,
} from '../../types';

import { useWorkoutDerived, useWorkoutDispatch, useWorkoutState } from './core/WorkoutContext';
// Core
import { WorkoutProvider } from './core/WorkoutProvider';

// Components
import { ExerciseDisplay, ExerciseNav, ProgressBar, WorkoutHeader } from './components';
// Inline editorial rest strip (small — imported normally)
import InlineRestTimer from './components/InlineRestTimer';

// Overlays (lazy - loaded on demand)
const NumpadOverlay = React.lazy(() => import('./overlays/NumpadOverlay'));
const ConfirmExitOverlay = React.lazy(() => import('./overlays/ConfirmExitOverlay'));

// Hooks
import { usePersonalRecords } from './hooks/usePersonalRecords';
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
import { PreWorkoutScreen } from './states';

// Existing components we preserve - WaterReminderToast kept static (small and frequently shown)
import WaterReminderToast from './WaterReminderToast';

// Lazy loaded components (heavy - only loaded when needed)
// Following Vercel best practices: bundle-dynamic-imports
const WorkoutSummary = React.lazy(() => import('./WorkoutSummary'));
const ExerciseTutorial = React.lazy(() => import('./ExerciseTutorial'));
const AICoach = React.lazy(() => import('./AICoach'));
const ExerciseSelector = React.lazy(() => import('./ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('./QuickExerciseForm'));
const WorkoutSettingsOverlay = React.lazy(() => import('./overlays/WorkoutSettingsOverlay'));
const WarmupCooldownFlow = React.lazy(() => import('./WarmupCooldownFlow'));
const WorkoutGoalSelector = React.lazy(() => import('./WorkoutGoalSelector'));
const ExerciseReorder = React.lazy(() => import('./ExerciseReorder'));

// Services
import {
  createWorkoutTemplate,
  getPersonalExercises,
  getWorkoutSessions,
  getWorkoutTemplates,
  saveWorkoutSession,
} from '../../services/dataService';
import { getExerciseNames } from '../../services/prService';
import { createWorkoutSet } from '../../types';

import { playSuccess } from '../../utils/audio';
// CSS
import { triggerHaptic } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { safeJsonParse } from '../../utils/safeJson';
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
  const [showSummary, setShowSummary] = useState(false);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishIntent, setFinishIntent] = useState<'finish' | 'cancel'>('finish');

  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [personalExerciseLibrary, setPersonalExerciseLibrary] = useState<PersonalExercise[]>([]);
  const [showWaterReminder, setShowWaterReminder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Superset mode - when user clicks "create superset" button
  const [supersetMode, setSupersetMode] = useState(false);
  const [supersetFirstExerciseId, setSupersetFirstExerciseId] = useState<string | null>(null);

  // Track last announced set count to avoid re-announcing on re-renders
  const lastAnnouncedSetsRef = useRef(0);

  // Settings
  const workoutSettings: Partial<WorkoutSettings> = state.appSettings?.workoutSettings || {};
  const bgPrimary = (workoutSettings.oledMode as boolean) ? '#000000' : 'var(--bone)';

  // PR tracking
  const { getPRForExercise } = usePersonalRecords(state.exercises, state.currentExerciseIndex);

  // Celebration System

  // Settings hooks
  const { keepScreenAwake, announceSetComplete } = useWorkoutSettings();
  const displaySettings = useDisplaySettings();

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

  // Load exercise suggestions
  useEffect(() => {
    const loadNames = async () => {
      try {
        const [_sessions, personalExercises] = await Promise.all([
          getWorkoutSessions(100),
          getPersonalExercises().catch(() => []),
        ]);
        const historyNames = getExerciseNames();
        const libraryNames = Array.from(
          new Set((personalExercises as PersonalExercise[]).map((ex) => ex.name).filter(Boolean))
        );
        setPersonalExerciseLibrary(personalExercises as PersonalExercise[]);
        setNameSuggestions(
          Array.from(new Set([...historyNames, ...libraryNames]))
            .filter((n): n is string => !!n)
            .sort()
        );
      } catch {
        // Silently handle name suggestion loading errors
      }
    };
    loadNames();
  }, []);

  // Load initial template if provided (from PreWorkoutScreen quick-start)
  useEffect(() => {
    if (!initialTemplateId || state.exercises.length > 0) return;

    const loadTemplate = async () => {
      try {
        const templates = await getWorkoutTemplates();
        const template = templates.find((t) => t.id === initialTemplateId);
        if (template && template.exercises && template.exercises.length > 0) {
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
              sets:
                ex.sets && ex.sets.length > 0
                  ? ex.sets.map((s) =>
                      createWorkoutSet({ reps: s.reps || 0, weight: s.weight || 0 })
                    )
                  : Array(4)
                      .fill(null)
                      .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
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

  // Workout start flow - runs on mount
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle goal selection - optionally trigger warmup
  const handleGoalSelect = useCallback(
    (goal: WorkoutGoal) => {
      triggerHaptic('medium');
      dispatch({ type: 'UPDATE_SETTINGS', payload: { defaultWorkoutGoal: goal } });
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });

      // Check warmup preference
      const warmupPreference = workoutSettings.warmupPreference || 'ask';
      if (warmupPreference === 'always') {
        setTimeout(() => {
          dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
        }, 300);
      } else if (warmupPreference === 'ask') {
        // Could show a prompt here, for now let's trigger warmup
        setTimeout(() => {
          dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
        }, 300);
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

  // Superset handling
  const handleCreateSuperset = useCallback(
    (exerciseId: string) => {
      if (!supersetMode) {
        // Enter superset mode - select first exercise
        triggerHaptic('medium');
        setSupersetMode(true);
        setSupersetFirstExerciseId(exerciseId);
      } else if (supersetFirstExerciseId && supersetFirstExerciseId !== exerciseId) {
        // Create superset with two exercises
        triggerHaptic('success');
        dispatch({
          type: 'CREATE_SUPERSET',
          payload: {
            exerciseIds: [supersetFirstExerciseId, exerciseId],
            restBetweenRounds: workoutSettings.defaultRestTime || 60,
          },
        });
        setSupersetMode(false);
        setSupersetFirstExerciseId(null);
      }
    },
    [dispatch, supersetMode, supersetFirstExerciseId, workoutSettings.defaultRestTime]
  );

  const handleFinishRequest = useCallback(() => {
    // Go straight to confirmation - cooldown is optional via button in overlay
    triggerHaptic('light');
    setFinishIntent('finish');
    setShowFinishConfirm(true);
  }, []);

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

  // Horizontal swipe navigation between exercises.
  // Pointer-based, RTL-aware, ignores gestures originating in interactive targets.
  const swipeStartRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const handleSwipePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        'button, input, textarea, select, [role="button"], [role="slider"], [data-no-swipe]'
      )
    ) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      id: e.pointerId,
    };
  }, []);

  const handleSwipePointerMove = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    // No-op — we decide on pointerup. Tracking here would require canceling scroll.
  }, []);

  const handleSwipePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || start.id !== e.pointerId) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const duration = Date.now() - start.t;

      const MIN_DX = 70;
      const MAX_DY = 40;
      const MAX_DURATION = 400;

      if (Math.abs(dx) < MIN_DX) return;
      if (Math.abs(dy) > MAX_DY) return;
      if (duration > MAX_DURATION) return;

      const total = state.exercises.length;
      if (total <= 1) return;

      const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
      // In RTL: positive dx (swipe right) → previous exercise. LTR is inverse.
      const direction = dx > 0 ? (isRTL ? -1 : 1) : isRTL ? 1 : -1;
      const nextIndex = state.currentExerciseIndex + direction;

      if (nextIndex < 0 || nextIndex >= total) return;

      triggerHaptic('light');
      handleChangeExercise(nextIndex);
    },
    [handleChangeExercise, state.currentExerciseIndex, state.exercises.length]
  );

  const handleOpenDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: true });
  }, [dispatch]);

  const handleCloseDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: false });
  }, [dispatch]);

  const handleOpenSelector = useCallback(() => {
    dispatch({ type: 'OPEN_SELECTOR' });
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

  const handleNumpadDelete = useCallback(() => {
    dispatch({ type: 'NUMPAD_DELETE' });
  }, [dispatch]);

  const handleNumpadSubmit = useCallback(() => {
    dispatch({ type: 'NUMPAD_SUBMIT' });
  }, [dispatch]);

  const handleCloseNumpad = useCallback(() => {
    dispatch({ type: 'CLOSE_NUMPAD' });
  }, [dispatch]);

  const handleToggleSettings = useCallback(
    (show: boolean) => {
      dispatch({ type: 'TOGGLE_SETTINGS', payload: show });
    },
    [dispatch]
  );

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

  const handleConfirmFinish = useCallback(async () => {
    if (finishIntent === 'cancel') {
      setShowFinishConfirm(false);
      setSaveError(null);

      // Mark as completed in localStorage to prevent restore
      const saved = localStorage.getItem('active_workout_v3_state');
      if (saved) {
        try {
          const parsed = safeJsonParse<Record<string, unknown>>(saved);
          if (parsed) {
            parsed._completed = true;
            localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
          }
        } catch {
          // If parsing fails, just remove it
        }
      }
      localStorage.removeItem('active_workout_v3_state');

      // Call onExit - the overlay will handle removing the item
      onExit();
      return;
    }

    // Validate: Check if there's anything to save BEFORE closing overlay
    const completedExercises = state.exercises.filter((ex) =>
      (ex.sets ?? []).some((s) => s.completedAt)
    );

    if (completedExercises.length === 0) {
      // No completed sets - show message to user instead of silently exiting
      // Keep overlay open and show error
      setSaveError('לא הושלמו סטים באימון זה. השלם לפחות סט אחד כדי לשמור את האימון.');
      return;
    }

    // Now we can close the overlay and proceed
    triggerHaptic('success');
    setShowFinishConfirm(false);
    setSaveError(null);

    setIsSaving(true);

    try {
      // Transform Exercise[] to WorkoutExercise[] for saving
      const workoutExercises: WorkoutExercise[] = completedExercises.map((ex, index) => ({
        id: ex.id || `ex_${index}`,
        exerciseId: ex.id || `exercise_${index}`,
        exerciseName: ex.name || 'Unknown Exercise',
        targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
        sets: (ex.sets ?? []).filter((s) => s.completedAt),
        notes: '',
        restSeconds: ex.defaultRestTime || ex.targetRestTime || 90,
        isCompleted: true,
        order: index,
        // Additional fields for display
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        tempo: ex.tempo,
        targetRestTime: ex.targetRestTime,
      }));

      const session: WorkoutSession = {
        id: `session_${Date.now()}`,
        userId: 'local_user',
        workoutItemId: item?.id || `workout_${Date.now()}`,
        startTime: new Date(state.startTimestamp).toISOString(),
        endTime: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        duration: Math.floor((Date.now() - state.startTimestamp - state.totalPausedTime) / 1000),
        status: 'completed',
        templateId: null,
        notes: '',
        rating: null,
        totalVolume: workoutExercises.reduce(
          (sum, ex) => sum + ex.sets.reduce((setSum, s) => setSum + s.weight * s.reps, 0),
          0
        ),
        caloriesBurned: null,
        goalType: workoutSettings.defaultWorkoutGoal as string,
        exercises: workoutExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveWorkoutSession(session);

      // Verify session was saved by reading it back
      let wasSaved = true;
      try {
        const { getWorkoutSessions } = await import('../../services/dataService');
        const savedSessions = await getWorkoutSessions(1);
        wasSaved = savedSessions.some((s) => s.id === session.id);
        if (!wasSaved) {
          throw new Error('Session verification failed - not found in database');
        }
      } catch (verifyError) {
        logger.workout?.error?.('Workout save verification failed', verifyError);
        wasSaved = false;
      }

      if (!wasSaved) {
        setSaveError('שמירת האימון נכשלה. הנתונים נשמרו מקומית — נסה שוב כשהחיבור יציב.');
        return;
      }

      // Mark workout as completed in localStorage to prevent restore loop
      // This is a safety measure in case the summary doesn't close properly
      const saved = localStorage.getItem('active_workout_v3_state');
      if (saved) {
        try {
          const parsed = safeJsonParse<Record<string, unknown>>(saved);
          if (parsed) {
            parsed._completed = true;
            localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
          }
        } catch {
          // If parsing fails, continue anyway
        }
      }

      // Don't delete yet! Wait until summary is closed.
      // keeping the item active allows this component to stay mounted so Summary can be shown.

      setCompletedSession(session);
      setShowSummary(true);
    } catch (e) {
      // Show user-friendly error message via UI instead of console
      const errorMessage = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveError(`שגיאה בשמירת האימון: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }, [finishIntent, state, workoutSettings.defaultWorkoutGoal, onExit]);

  // If showing summary
  if (showSummary && completedSession) {
    return (
      <React.Suspense
        fallback={
          <div className="fixed inset-0 z-[9999] bg-[var(--bone)] flex items-center justify-center">
            <div
              style={{
                color: 'var(--navy)',
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
      <React.Suspense fallback={<div className="fixed inset-0 bg-[var(--bone)]" />}>
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
      className={cn('relative flex flex-col min-h-screen font-sans transition-colors duration-500')}
      style={{ background: bgPrimary, color: 'var(--ink)' }}
    >
      {/* Progress Bar */}
      <ProgressBar progress={derived.progressPercent} />

      {/* Main Content - Editorial Annual Layout */}
      <div className="relative z-10 flex flex-col flex-1 overflow-y-auto overscroll-contain">
        {/* Header (thin bone strip) */}
        <WorkoutHeader
          startTimestamp={state.startTimestamp}
          totalPausedTime={state.totalPausedTime}
          isPaused={state.isPaused}
          currentExerciseName={derived.currentExercise.name}
          onFinish={handleFinishRequest}
          onDiscard={handleDiscardRequest}
          onOpenSettings={() => dispatch({ type: 'TOGGLE_SETTINGS', payload: true })}
          onOpenTutorial={() =>
            dispatch({ type: 'SHOW_TUTORIAL', payload: derived.currentExercise?.name || '' })
          }
          onOpenAICoach={() => dispatch({ type: 'OPEN_AI_COACH' })}
        />

        {/* Superset Mode Indicator — chapter-break strip */}
        {supersetMode && (
          <div className="chapter-break">
            <span className="left">SUPERSET · בחר תרגיל שני</span>
            <span className="right">2 / 2</span>
          </div>
        )}

        {/* Inline Rest Timer (editorial strip, not a modal) */}
        {state.restTimer.active && (
          <InlineRestTimer
            active={state.restTimer.active}
            endTime={state.restTimer.endTime}
            onSkip={handleSkipRest}
            onAddTime={handleAddRestTime}
            nextSetHint={
              derived.activeSetIndex >= 0
                ? `NEXT · SET ${String(derived.activeSetIndex + 1).padStart(2, '0')}`
                : undefined
            }
          />
        )}

        {/* Exercise Display (hero + inputs) */}
        <div
          className="flex-1 flex items-stretch justify-center"
          onPointerDown={handleSwipePointerDown}
          onPointerMove={handleSwipePointerMove}
          onPointerUp={handleSwipePointerEnd}
          onPointerCancel={handleSwipePointerEnd}
          style={{ touchAction: 'pan-y' }}
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
            showGhostValues={displaySettings.showGhostValues}
            showVolumePreview={displaySettings.showVolumePreview}
            enableQuickWeightButtons={workoutSettings.enableQuickWeightButtons as boolean}
            enableQuickRepsButtons={workoutSettings.enableQuickRepsButtons as boolean}
            supersetGroups={state.supersetGroups}
            onCreateSuperset={handleCreateSuperset}
          />
        </div>

        {/* Navigation Footer */}
        <div
          className="w-full pb-[env(safe-area-inset-bottom,12px)]"
          style={{ background: 'var(--bone)' }}
        >
          <ExerciseNav
            exercises={state.exercises}
            currentIndex={state.currentExerciseIndex}
            onChangeExercise={handleChangeExercise}
            onOpenDrawer={handleOpenDrawer}
            onAddExercise={handleOpenSelector}
          />
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
          onDelete={handleNumpadDelete}
          onSubmit={handleNumpadSubmit}
          onClose={handleCloseNumpad}
        />
      </React.Suspense>

      {/* Confirm Exit */}
      <React.Suspense fallback={null}>
        <ConfirmExitOverlay
          isOpen={showFinishConfirm}
          intent={finishIntent}
          workoutStats={workoutStats}
          onConfirm={handleConfirmFinish}
          onCancel={() => {
            setShowFinishConfirm(false);
            setSaveError(null);
          }}
          onCooldown={() => {
            setShowFinishConfirm(false);
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
          }}
          isSaving={isSaving}
          saveError={saveError}
        />
      </React.Suspense>

      {/* Settings Overlay */}
      <OverlayErrorBoundary
        fallbackLabel="שגיאה בהגדרות"
        onDismiss={() => handleToggleSettings(false)}
      >
        <React.Suspense fallback={<OverlayLoader />}>
          <WorkoutSettingsOverlay
            isOpen={state.showSettings}
            settings={workoutSettings}
            onClose={() => handleToggleSettings(false)}
            onUpdateSetting={(key, value) =>
              dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } })
            }
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
          <WorkoutGoalSelector
            onSelect={(goal: WorkoutGoal) => handleGoalSelect(goal)}
            onClose={() =>
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } })
            }
          />
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
                setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300);
              }
            }}
            onSkip={() => {
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
              // After skip, open exercise selector if no exercises
              if (state.exercises.length === 0) {
                setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300);
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

          {/* AI Coach */}
          {state.showAICoach && derived.currentExercise && (
            <AICoach
              currentExercise={derived.currentExercise}
              onClose={() => dispatch({ type: 'CLOSE_AI_COACH' })}
            />
          )}
        </React.Suspense>
      </OverlayErrorBoundary>

      {/* Water Reminder Toast */}
      <WaterReminderToast
        isVisible={showWaterReminder}
        onDismiss={() => setShowWaterReminder(false)}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />
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
