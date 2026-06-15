import { useEffect, useRef } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { getWorkoutTemplate } from '../../../services/dataService';
import type { Exercise, WorkoutSettings } from '../../../types';
import { createWorkoutSet } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import type { WorkoutAction } from '../core/workoutTypes';

interface UseWorkoutEffectsOptions {
  dispatch: React.Dispatch<WorkoutAction>;
  exercises: Exercise[];
  currentExerciseIndex: number;
  workoutSettings: Partial<WorkoutSettings>;
  showGoalSelector: boolean;
  showWarmup: boolean;
  showCooldown: boolean;
  showExerciseSelector: boolean;
  showQuickForm: boolean;
  initialTemplateId?: string;
  preWorkoutScreenShown: boolean;
  setPreWorkoutScreenShown?: (v: boolean) => void;
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
  workoutSettings,
  showGoalSelector,
  showWarmup,
  showCooldown,
  showExerciseSelector,
  showQuickForm,
  initialTemplateId,
  preWorkoutScreenShown,
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
        // Look up by id directly: program-day templates are hidden from the list
        // getter, so a list+find would miss them. The by-id getter returns them.
        const template = await getWorkoutTemplate(initialTemplateId);
        if (template?.exercises && template.exercises.length > 0) {
          triggerHaptic('success');
          for (const ex of template.exercises) {
            // Structured-program exercises carry programExtras (RPE target,
            // intensity technique, substitutions, coaching notes) and a target
            // set/rep prescription — preserve them so the runner shows the plan.
            // Regular templates keep their original single empty-set behavior.
            const isProgram = !!ex.programExtras;
            const setCount = isProgram ? Math.max(1, ex.targetSets ?? ex.sets?.length ?? 1) : 1;
            const reps = isProgram ? (ex.targetReps ?? 0) : 0;
            const exercise: Exercise = {
              id:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? `ex-${crypto.randomUUID()}`
                  : `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              name: ex.name || ex.exerciseName || 'Unknown',
              exerciseName: ex.exerciseName || ex.name,
              muscleGroup: ex.muscleGroup,
              targetMuscle: ex.targetMuscle,
              targetRestTime: ex.targetRestTime || ex.restSeconds || 90,
              notes: isProgram ? ex.notes : undefined,
              programExtras: ex.programExtras,
              sets: Array.from({ length: setCount }, () => createWorkoutSet({ reps, weight: 0 })),
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

  // Workout start flow (goal → warmup) — runs ONCE, and ONLY after the workout
  // has actually started (the PreWorkoutScreen was dismissed AND at least one
  // exercise exists). Running it while still on PreWorkoutScreen turned on
  // showGoalSelector/showWarmup invisibly (those modals only render in the main
  // workout branch), which then blocked the auto-open-selector effect below.
  // Gating on `preWorkoutScreenShown && exercises.length > 0` makes the flow
  // deterministic: goal/warmup only appear over the live workout UI that hosts
  // their modals.
  const startFlowRan = useRef(false);
  useEffect(() => {
    if (startFlowRan.current) return;
    if (!preWorkoutScreenShown || exercises.length === 0) return;
    startFlowRan.current = true;

    const warmupPreference = workoutSettings.warmupPreference || 'ask';
    const hasGoal = !!workoutSettings.defaultWorkoutGoal;

    if (!hasGoal && !showGoalSelector && !showWarmup) {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: true } });
      return;
    }

    if (hasGoal && warmupPreference !== 'never' && !showWarmup) {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
    }
  }, [
    preWorkoutScreenShown,
    exercises.length,
    workoutSettings,
    dispatch,
    showGoalSelector,
    showWarmup,
  ]);

  // Auto-open exercise selector after PreWorkoutScreen.
  // Only runs once the welcome screen was dismissed and there are still no
  // exercises — and never while a flow modal is open. With the start flow no
  // longer firing during PreWorkoutScreen, showGoalSelector/showWarmup stay
  // false here, so the selector reliably opens for the empty-start path.
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

  // Water reminder — routed through the canonical bottom toast (replaces the
  // bespoke WaterReminderToast). The interval here is the scheduler; showToast
  // owns rendering, auto-dismiss, and the accent (cyan) hydration styling.
  useEffect(() => {
    if (!workoutSettings.waterReminderEnabled) return;

    const minutes = (workoutSettings.waterReminderInterval as number) || 15;
    const WATER_INTERVAL = minutes * 60 * 1000;
    const interval = setInterval(() => {
      showToast('תזכורת מים', {
        variant: 'water',
        position: 'bottom',
        description: 'זמן ללגום מים',
      });
    }, WATER_INTERVAL);

    return () => clearInterval(interval);
  }, [workoutSettings.waterReminderEnabled, workoutSettings.waterReminderInterval]);
}
