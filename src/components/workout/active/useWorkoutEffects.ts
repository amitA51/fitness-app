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

  // Load initial template if provided.
  // The `exercises.length` guard alone cannot hold: the load is async, so two
  // invocations of this effect (StrictMode's double-mount, a dep change while
  // the fetch is in flight) both pass the check with an empty list and both
  // dispatch — which appended the whole plan TWICE (14 exercises for a 7-move
  // day, the runner parked mid-list at the head of the second copy). This ref
  // is claimed synchronously, before any await, so only the first invocation
  // per template id ever reaches the dispatch.
  const loadedTemplateIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialTemplateId || exercises.length > 0) return;
    if (loadedTemplateIdRef.current === initialTemplateId) return;
    loadedTemplateIdRef.current = initialTemplateId;

    const loadTemplate = async () => {
      try {
        // Look up by id directly: program-day templates are hidden from the list
        // getter, so a list+find would miss them. The by-id getter returns them.
        const template = await getWorkoutTemplate(initialTemplateId);
        if (template?.exercises && template.exercises.length > 0) {
          triggerHaptic('success');
          const loaded: Exercise[] = [];
          for (const ex of template.exercises) {
            // Structured-program exercises carry programExtras (RPE target,
            // intensity technique, substitutions, coaching notes) — those stay
            // program-only.
            const isProgram = !!ex.programExtras;
            // The set/rep prescription is honoured for EVERY template, program or
            // not, via the one expression the program path has always used.
            // Gating it on `isProgram` discarded what a regular template already
            // stores: the built-in templates ship 4x8 / 3x12, the template editor
            // renders those as chips and the estimated duration is COMPUTED from
            // them — yet a 4x8 squat opened as "set 1 of 1", reps 0, so the lifter
            // tapped "add set" three times and retyped the reps, per exercise.
            //
            // A pre-created set is a PLAN, never a result: createWorkoutSet
            // defaults to isCompleted:false / completedAt:null and the weight is
            // 0, so these sets are invisible to every completed-set count, volume
            // sum and finish-dialog total (all of which gate on completion), and
            // `reps` is only the target the set-logging UI pre-fills. It sizes the
            // progress spine ("הבא · סט 1 מתוך 4") and nothing else.
            const setCount = Math.max(1, ex.targetSets ?? ex.sets?.length ?? 1);
            const reps = ex.targetReps ?? 0;
            // Structured-program exercises prepend the PDF's prescribed warmup
            // set(s) before the working sets: [ ...warmups (isWarmup), ...working ].
            // Warmups carry no target reps/weight (they're ramp-ups) and are
            // excluded from working-set tallies, PR detection, and volume. Regular
            // templates keep their original single working-set-only behavior.
            const warmupCount = isProgram ? (ex.programExtras?.warmupSets ?? 0) : 0;
            const workingSets = Array.from({ length: setCount }, () =>
              createWorkoutSet({ reps, weight: 0 })
            );
            const warmupSets = Array.from({ length: warmupCount }, () =>
              createWorkoutSet({ reps: 0, weight: 0, isWarmup: true })
            );
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
              sets: [...warmupSets, ...workingSets],
            };
            loaded.push(exercise);
          }
          // One batched add: a per-exercise ADD_EXERCISE loop would park the
          // runner on the LAST exercise of the plan, so the workout opened at
          // the end of the list and walked backwards. ADD_EXERCISES focuses the
          // first exercise instead.
          dispatch({ type: 'ADD_EXERCISES', payload: loaded });
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
  //
  // This is a ONE-SHOT intent, not a standing invariant, and the ref is what
  // makes the difference. Expressed as a condition ("pre-workout + empty ⇒ open")
  // the effect re-fired the instant CLOSE_SELECTOR landed — the workout is still
  // empty and the intent is still set, so Back/X/"ביטול"/backdrop each closed the
  // sheet and had it slammed straight back open (measured: 4 ms), and the welcome
  // screen behind it was unreachable.
  //
  // The intent counts as served the moment the sheet is ON SCREEN, whoever opened
  // it — both real entry points ("התחל אימון" and the ?startEmpty deep link)
  // dispatch OPEN_SELECTOR themselves and beat this effect to it, so claiming the
  // ref only when this effect dispatches would leave it unclaimed and reopen on
  // the first close. What is left is a genuine safety net: a remount that
  // sanitized showExerciseSelector back to false still gets its sheet, and a
  // dismissal stays dismissed. Re-armed when the intent itself is cleared, so the
  // next "התחל אימון" opens the picker again.
  const autoOpenedSelectorRef = useRef(false);
  useEffect(() => {
    if (!preWorkoutScreenShown) {
      autoOpenedSelectorRef.current = false;
      return;
    }
    if (showExerciseSelector || showQuickForm) {
      autoOpenedSelectorRef.current = true;
      return;
    }
    if (autoOpenedSelectorRef.current) return;
    if (exercises.length === 0 && !showGoalSelector && !showWarmup && !showCooldown) {
      autoOpenedSelectorRef.current = true;
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
