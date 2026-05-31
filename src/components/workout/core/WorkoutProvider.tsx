// Workout Provider - Main provider component with all workout logic
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useImmerReducer } from 'use-immer';
import { webPlatform } from '../../../platform/web';
import type { PlatformAdapter } from '../../../platform/web';
import { createWorkoutSet } from '../../../types';
import type { AppSettings } from '../../../types';
import { vibratePattern } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { safeJsonParse } from '../../../utils/safeJson';
import { setVolume } from '../../../utils/workoutMath';
import {
  WorkoutDerivedProvider,
  WorkoutDispatchProvider,
  WorkoutStateProvider,
} from './WorkoutContext';
import { resolveActiveSet, workoutReducer } from './workoutReducer';
import {
  HAPTIC_PATTERNS,
  type WorkoutDerivedValue,
  type WorkoutProviderProps,
  type WorkoutState,
  createInitialState,
} from './workoutTypes';
// Data service imports moved to ActiveWorkoutNew.tsx
// PR service imports removed - used in ActiveWorkoutNew.tsx instead

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY = 'active_workout_v3_state';

const platform: PlatformAdapter = webPlatform;

/**
 * Stringify-then-store with a single retry that drops transient/UI-only
 * fields (overlays, celebrations, ghost data) if the first attempt fails.
 * Returns true on success.
 */
const persistState = (state: WorkoutState): boolean => {
  try {
    platform.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    // Try a stripped payload — keep only durable fields a user would lose
    try {
      const slim = {
        exercises: state.exercises,
        currentExerciseIndex: state.currentExerciseIndex,
        supersetGroups: state.supersetGroups,
        startTimestamp: state.startTimestamp,
        totalPausedTime: state.totalPausedTime,
        lastPauseTimestamp: state.lastPauseTimestamp,
        isPaused: state.isPaused,
        restTimer: state.restTimer,
        appSettings: state.appSettings,
      };
      platform.setItem(STORAGE_KEY, JSON.stringify(slim));
      logger.workout?.warn?.('Workout state slim-persist succeeded after full failure', err);
      return true;
    } catch (err2) {
      logger.workout?.error?.('Workout state persist failed (full + slim)', err2);
      return false;
    }
  }
};
// REST_TIMER_SYNC_INTERVAL removed - useRestTimer hook handles its own timing locally
// This eliminates unnecessary re-renders every second

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const loadAppSettings = (): AppSettings => {
  try {
    const stored = platform.getItem('appSettings');
    if (!stored) return {} as AppSettings;
    const parsed = safeJsonParse<AppSettings>(stored);
    return parsed && typeof parsed === 'object' ? parsed : ({} as AppSettings);
  } catch {
    return {} as AppSettings;
  }
};

// ============================================================
// PROVIDER COMPONENT
// ============================================================

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({ item, children }) => {
  // Load saved state or create new
  const loadState = useCallback((): WorkoutState | null => {
    try {
      const saved = platform.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = safeJsonParse<WorkoutState & { _completed?: boolean }>(saved);
        if (!parsed) return null;
        if (parsed._completed) {
          platform.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed;
      }
    } catch {
      // Ignore persistence errors silently
    }
    return null;
  }, []);

  // Initialize state
  const [state, dispatch] = useImmerReducer(workoutReducer, null, () => {
    const savedState = loadState();
    const appSettings = loadAppSettings();

    if (savedState) {
      // Calculate wall-time elapsed while app was closed and add to totalPausedTime
      const lastTimestamp = savedState.lastPauseTimestamp || Date.now();
      const closedAppElapsed = Math.max(0, Date.now() - lastTimestamp);

      return {
        ...createInitialState([], 0, appSettings),
        ...savedState,
        appSettings,
        isPaused: true,
        lastPauseTimestamp: Date.now(),
        totalPausedTime: (savedState.totalPausedTime || 0) + closedAppElapsed,
        pendingHaptic: null,
        // Sanitize transient UI/celebration flags
        showConfetti: false,
        showPRCelebration: null,
        showSettings: false,
        showExerciseSelector: false,
        showQuickForm: false,
        showExerciseLibrary: false,
        showAICoach: false,
        showPlateCalc: false,
        showGoalSelector: false,
        showWarmup: false,
        showCooldown: false,
        showWaterReminder: false,
        showTutorial: false,
        tutorialExercise: null,
      };
    }

    // Ensure item exists before accessing its properties
    const exercises = item?.exercises || [];
    return createInitialState(
      // Filter out any exercises without valid names
      exercises.filter((ex) => ex?.name?.trim()),
      item?.workoutDuration || 0,
      appSettings
    );
  });

  // State ref for effects that need current state without re-subscribing
  const stateRef = useRef(state);
  stateRef.current = state;

  // ============================================================
  // PERSISTENCE
  // ============================================================

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>('');

  useEffect(() => {
    // Only persist when meaningful workout data changes (exercises, index, supersets, pause state)
    // Skip overlay toggles, celebrations, and timer ticks
    const meaningful = JSON.stringify({
      exercises: state.exercises,
      currentExerciseIndex: state.currentExerciseIndex,
      supersetGroups: state.supersetGroups,
      startTimestamp: state.startTimestamp,
      totalPausedTime: state.totalPausedTime,
      isPaused: state.isPaused,
      restTimer: state.restTimer,
    });
    if (meaningful === lastPersistedRef.current) return;
    lastPersistedRef.current = meaningful;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      persistState(state);
    }, 500);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [state]);

  // Flush latest state on unmount to avoid losing the last debounced write
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      persistState(stateRef.current);
    },
    []
  );

  // ============================================================
  // VISIBILITY CHANGE HANDLING (Background/Foreground)
  // ============================================================

  useEffect(() => {
    const removeVisibility = platform.onVisibilityChange((hidden) => {
      if (hidden) {
        persistState(stateRef.current);
      } else {
        if (stateRef.current.restTimer.active && stateRef.current.restTimer.endTime) {
          dispatch({ type: 'SYNC_REST_TIMER' });
        }
      }
    });

    const removeUnload = platform.onBeforeUnload(() => {
      persistState(stateRef.current);
    });

    return () => {
      removeVisibility();
      removeUnload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]); // stateRef used instead of state to prevent handler recreation

  // ============================================================
  // PERIODIC AUTO-SAVE (Every 30 seconds as backup)
  // ============================================================

  useEffect(() => {
    const intervalId = setInterval(() => {
      persistState(stateRef.current);
    }, 30000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stateRef used - interval runs every 30s without resetting

  // ============================================================
  // REST TIMER - No periodic sync needed!
  // The useRestTimer hook in RestTimerOverlay handles its own
  // local state updates every 100ms without triggering parent re-renders.
  // SYNC_REST_TIMER is only called on visibility change (coming back from background)
  // ============================================================

  // ============================================================
  // HAPTIC + SOUND FEEDBACK (rest end / set complete)
  // ============================================================
  // Reads workoutSettings to gate vibration AND sound based on:
  //   - hapticsEnabled (already gated at the reducer level too)
  //   - restTimerVibrate (only for REST_END)
  //   - soundEnabled + restTimerSound (only for REST_END)

  useEffect(() => {
    if (!state.pendingHaptic) return;

    const ws = state.appSettings?.workoutSettings;

    if (state.pendingHaptic === 'SET_COMPLETE') {
      vibratePattern([...HAPTIC_PATTERNS.SET_COMPLETE]);
    } else if (state.pendingHaptic === 'REST_END') {
      // Vibration honors restTimerVibrate (default true)
      if (ws?.restTimerVibrate !== false) {
        vibratePattern([...HAPTIC_PATTERNS.REST_END]);
      }
      // Sound honors restTimerSound + soundEnabled (default true). Done lazily
      // to avoid pulling audio into the WorkoutProvider import graph at the top.
      if (ws?.restTimerSound !== false && ws?.soundEnabled !== false) {
        platform.playRestEndSound();
      }
    }

    dispatch({ type: 'CLEAR_PENDING_HAPTIC' });
  }, [state.pendingHaptic, state.appSettings?.workoutSettings, dispatch]);

  // ============================================================
  // SOUND ENABLED — keep utils/audio gate in sync with workout settings
  // ============================================================
  // The SettingsContext already syncs soundEnabled to utils/audio, but during
  // an active workout the canonical store is state.appSettings, so we also
  // sync from here in case the user changes the value via the workout overlay.
  useEffect(() => {
    const enabled = state.appSettings?.workoutSettings?.soundEnabled;
    if (typeof enabled === 'boolean') {
      platform.setSoundEnabled(enabled);
    }
  }, [state.appSettings?.workoutSettings?.soundEnabled]);

  // ============================================================
  // SETTINGS PERSISTENCE
  // ============================================================

  useEffect(() => {
    if (!state.appSettings?.workoutSettings) return;
    try {
      const existingSettings = platform.getItem('appSettings');
      const parsed: AppSettings = existingSettings
        ? (safeJsonParse<AppSettings>(existingSettings) ?? ({} as AppSettings))
        : ({} as AppSettings);
      const updated = {
        ...parsed,
        workoutSettings: {
          ...(parsed.workoutSettings || {}),
          ...state.appSettings.workoutSettings,
        },
      };
      platform.setItem('appSettings', JSON.stringify(updated));
    } catch {
      // Silently handle settings persistence errors
    }
  }, [state.appSettings?.workoutSettings]);

  // ============================================================
  // WAKE LOCK
  // ============================================================

  useEffect(() => {
    if (!state.appSettings?.workoutSettings?.keepAwake) return;

    let wakeLockHandle: { release: () => void } | null = null;

    const requestWakeLock = async () => {
      wakeLockHandle = await platform.requestWakeLock();
    };

    requestWakeLock();

    return () => {
      wakeLockHandle?.release();
    };
  }, [state.appSettings?.workoutSettings?.keepAwake]);

  // ============================================================
  // DERIVED VALUES (Memoized)
  // ============================================================

  const derived = useMemo<WorkoutDerivedValue>(() => {
    const currentExercise = state.exercises[state.currentExerciseIndex];

    if (!currentExercise) {
      return {
        currentExercise: undefined,
        activeSetIndex: 0,
        currentSet: createWorkoutSet({ reps: 0, weight: 0 }),
        completedSetsCount: 0,
        totalSets: 0,
        totalVolume: 0,
        progressPercent: 0,
      };
    }

    const { activeSetIndex: displaySetIndex } = resolveActiveSet(currentExercise.sets);
    const currentSet =
      currentExercise.sets?.[displaySetIndex] || createWorkoutSet({ reps: 0, weight: 0 });

    // Calculate stats
    let completedSetsCount = 0;
    let totalSets = 0;
    let totalVolume = 0;

    state.exercises.forEach((ex) => {
      (ex.sets || []).forEach((set) => {
        if (set.isWarmup) return; // Warmup sets excluded from stats
        totalSets++;
        if (set.completedAt) {
          completedSetsCount++;
          totalVolume += setVolume(set);
        }
      });
    });

    const progressPercent = totalSets > 0 ? (completedSetsCount / totalSets) * 100 : 0;

    return {
      currentExercise,
      activeSetIndex: displaySetIndex,
      currentSet,
      completedSetsCount,
      totalSets,
      totalVolume,
      progressPercent,
    };
  }, [state.exercises, state.currentExerciseIndex]);

  // Note: finishWorkout logic is handled directly in ActiveWorkoutNew.tsx

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <WorkoutStateProvider value={state}>
      <WorkoutDispatchProvider value={dispatch}>
        <WorkoutDerivedProvider value={derived}>{children}</WorkoutDerivedProvider>
      </WorkoutDispatchProvider>
    </WorkoutStateProvider>
  );
};

export default WorkoutProvider;
