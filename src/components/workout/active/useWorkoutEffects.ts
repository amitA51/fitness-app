import { useEffect, useRef } from 'react';
import { getWorkoutTemplates } from '../../../services/dataService';
import type { Exercise, WorkoutSettings } from '../../../types';
import { createWorkoutSet } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import type { WorkoutAction } from '../core/workoutTypes';

interface UseWorkoutEffectsOptions {
  dispatch: React.Dispatch<WorkoutAction>;
  exercises: Exercise[];
  currentExerciseIndex: number;
  startTimestamp: number;
  workoutSettings: Partial<WorkoutSettings>;
  showGoalSelector: boolean;
  showWarmup: boolean;
  showCooldown: boolean;
  showExerciseSelector: boolean;
  showQuickForm: boolean;
  initialTemplateId?: string;
  preWorkoutScreenShown: boolean;
  setPreWorkoutScreenShown?: (v: boolean) => void;
  setShowWaterReminder: (v: boolean) => void;
  // Derived
  completedSetsCount: number;
  currentExercise: Exercise | null | undefined;
  // Settings
  keepScreenAwake: () => (() => void) | undefined;
  announceSetComplete: (nextExerciseName?: string) => void;
  pendingTimeouts: React.MutableRefObject<ReturnType<typeof setTimeout>[]>;
}

export function useWorkoutEffects({
  dispatch,
  exercises,
  currentExerciseIndex,
  startTimestamp,
  workoutSettings,
  showGoalSelector,
  showWarmup,
  showCooldown,
  showExerciseSelector,
  showQuickForm,
  initialTemplateId,
  preWorkoutScreenShown,
  setShowWaterReminder,
  completedSetsCount,
  currentExercise,
  keepScreenAwake,
  announceSetComplete,
  pendingTimeouts,
}: UseWorkoutEffectsOptions) {
  // Track last announced set count to avoid re-announcing on re-renders
  const lastAnnouncedSetsRef = useRef(0);

  // Cleanup pending timeouts on unmount
  useEffect(
    () => () => {
      pendingTimeouts.current.forEach(clearTimeout);
    },
    [pendingTimeouts]
  );

  // Keep screen awake when workout is active
  useEffect(() => {
    const releaseWakeLock = keepScreenAwake();
    return () => {
      if (releaseWakeLock) releaseWakeLock();
    };
  }, [keepScreenAwake]);

  // Voice announcement: set complete + next exercise name
  useEffect(() => {
    const count = completedSetsCount;
    if (count === 0 || count === lastAnnouncedSetsRef.current) return;
    lastAnnouncedSetsRef.current = count;

    if (!currentExercise) return;

    const currentSets = currentExercise.sets || [];
    const hasMoreSets = currentSets.some((s) => !s.completedAt);

    if (!hasMoreSets) {
      const nextExercise = exercises[currentExerciseIndex + 1];
      announceSetComplete(nextExercise?.name);
    } else {
      announceSetComplete();
    }
  }, [completedSetsCount, currentExercise, exercises, currentExerciseIndex, announceSetComplete]);

  // Load initial template if provided
  useEffect(() => {
    if (!initialTemplateId || exercises.length > 0) return;

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
              sets: [createWorkoutSet({ reps: 0, weight: 0 })],
            };
            dispatch({ type: 'ADD_EXERCISE', payload: exercise });
          }
        }
      } catch {
        dispatch({ type: 'OPEN_SELECTOR' });
      }
    };
    loadTemplate();
  }, [initialTemplateId, exercises.length, dispatch]);

  // Workout start flow - runs once on mount (StrictMode-safe via ref guard)
  const startFlowRan = useRef(false);
  useEffect(() => {
    if (startFlowRan.current) return;
    startFlowRan.current = true;

    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    if (elapsed > 10) return;

    const warmupPreference = workoutSettings.warmupPreference || 'ask';
    const hasGoal = !!workoutSettings.defaultWorkoutGoal;

    if (!hasGoal && !showGoalSelector && !showWarmup) {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: true } });
      return;
    }

    if (hasGoal && warmupPreference !== 'never' && !showWarmup && !showExerciseSelector) {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
    }
  }, [
    startTimestamp,
    workoutSettings,
    dispatch,
    showGoalSelector,
    showWarmup,
    showExerciseSelector,
  ]);

  // Auto-open exercise selector after PreWorkoutScreen
  useEffect(() => {
    if (
      preWorkoutScreenShown &&
      exercises.length === 0 &&
      !showExerciseSelector &&
      !showQuickForm &&
      !showGoalSelector &&
      !showWarmup &&
      !showCooldown
    ) {
      dispatch({ type: 'OPEN_SELECTOR' });
    }
  }, [
    preWorkoutScreenShown,
    exercises.length,
    showExerciseSelector,
    showQuickForm,
    showGoalSelector,
    showWarmup,
    showCooldown,
    dispatch,
  ]);

  // Water reminder
  useEffect(() => {
    if (!workoutSettings.waterReminderEnabled) return;

    const minutes = (workoutSettings.waterReminderInterval as number) || 15;
    const WATER_INTERVAL = minutes * 60 * 1000;
    const interval = setInterval(() => {
      setShowWaterReminder(true);
    }, WATER_INTERVAL);

    return () => clearInterval(interval);
  }, [
    workoutSettings.waterReminderEnabled,
    workoutSettings.waterReminderInterval,
    setShowWaterReminder,
  ]);
}
