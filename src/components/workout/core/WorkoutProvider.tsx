// Workout Provider - Main provider component with all workout logic
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useImmerReducer } from 'use-immer';
import { useOptionalSettings } from '../../../contexts/SettingsContext';
import { webPlatform } from '../../../platform/web';
import type { PlatformAdapter } from '../../../platform/web';
import { createWorkoutSet } from '../../../types';
import type { AppSettings } from '../../../types';
import { triggerHapticEffect, vibratePattern } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { safeJsonParse } from '../../../utils/safeJson';
import { setVolume } from '../../../utils/workoutMath';
import { showToast } from '../../ui/GlobalToast';
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

// A persisted draft whose clock is older than this is treated as having a STALE
// CLOCK — not as garbage. Resuming its ancient startTimestamp would open the
// live timer at hours-elapsed and save a nonsensical duration, so the clock is
// reset on restore. The draft itself, and every set logged into it, is KEPT:
// draft.exercises is the entire value of the draft, and a bad clock is not a
// reason to destroy it. See loadState() / the reducer initializer below.
const MAX_DRAFT_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// Stable signature of the persistence-worthy fields. Shared by BOTH the debounced
// write and the 30s backup so an idle session doesn't re-serialize + re-write an
// ever-growing state every 30s when nothing meaningful changed.
const meaningfulStateKey = (s: WorkoutState): string =>
  JSON.stringify({
    exercises: s.exercises,
    currentExerciseIndex: s.currentExerciseIndex,
    supersetGroups: s.supersetGroups,
    startTimestamp: s.startTimestamp,
    totalPausedTime: s.totalPausedTime,
    isPaused: s.isPaused,
    restTimer: s.restTimer,
    finalized: s.finalized,
  });

const platform: PlatformAdapter = webPlatform;

/**
 * Write one value and PROVE it landed.
 *
 * A thrown error is not a usable failure signal here: `webPlatform.setItem`
 * swallows the quota / private-mode exception itself, so `setItem` returning
 * normally says nothing about whether anything was stored. The read-back is
 * what actually distinguishes a real write from a silent no-op (Safari private
 * mode, quota exceeded, iOS storage pressure).
 *
 * Runs on the debounced / interval / visibility persist paths only — never on
 * the set-entry keystroke path — so it cannot slow logging a set.
 */
const writeVerified = (value: string): boolean => {
  try {
    platform.setItem(STORAGE_KEY, value);
  } catch {
    return false;
  }
  try {
    return platform.getItem(STORAGE_KEY) === value;
  } catch {
    return false;
  }
};

/**
 * Stringify-then-store with a single retry that drops transient/UI-only
 * fields (overlays, celebrations, ghost data) if the first attempt fails.
 * Returns true on success — callers MUST surface a false (see persist()).
 */
const persistState = (state: WorkoutState): boolean => {
  // A finished/discarded workout must never be re-persisted (which would let it
  // be restored). Clear the snapshot and bail — this guards every persist path
  // (debounced, interval, visibility, unmount flush).
  if (state.finalized) {
    try {
      platform.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return true;
  }
  // Stamp the wall-clock write time so restore can subtract closed-app time.
  const payload = { ...state, lastPersistedAt: Date.now() };
  try {
    if (writeVerified(JSON.stringify(payload))) return true;
  } catch (err) {
    logger.workout?.warn?.('Workout state serialize failed, trying slim payload', err);
  }
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
      lastPersistedAt: payload.lastPersistedAt,
    };
    if (writeVerified(JSON.stringify(slim))) {
      logger.workout?.warn?.('Workout state slim-persist succeeded after full failure');
      return true;
    }
  } catch (err2) {
    logger.workout?.error?.('Workout state slim serialize failed', err2);
  }
  logger.workout?.error?.('Workout state persist failed (full + slim) — store is unwritable');
  return false;
};

// The store being unwritable (Safari private mode, quota exceeded, iOS storage
// pressure) used to be completely silent: persistState returned false and all
// five call sites threw it away, so the trainee kept logging sets into RAM and
// lost the lot the moment the tab closed.
//
// Surfaced ONCE per session, deliberately: the condition does not change
// between sets, so a toast per set would add no information and would fight the
// trainee for the screen mid-lift ("log first, admire later").
let persistFailureNotified = false;

/**
 * persistState PLUS the user-visible consequence of a false. Every persist path
 * goes through this — debounced write, unmount flush, visibility hide,
 * beforeunload, 30s backup — so none of them can drop the failure again.
 *
 * Module-level rather than a useCallback: three of the five call sites live in
 * effects that must never re-subscribe (the visibility listener, the 30s
 * interval, the unmount flush), so this must not become a hook dependency.
 */
const persist = (state: WorkoutState): boolean => {
  const ok = persistState(state);
  if (ok || persistFailureNotified) return ok;
  persistFailureNotified = true;
  showToast('האימון לא נשמר במכשיר', {
    variant: 'error',
    description:
      'הסטים קיימים רק בזיכרון הדפדפן. סיימו את האימון עכשיו כדי לשמור אותו — סגירת הכרטיסייה תמחק אותם.',
    duration: 8000,
  });
  return ok;
};

/** A new workout session re-arms the notice. Called once, on provider mount. */
const resetPersistFailureNotice = (): void => {
  persistFailureNotified = false;
};
// REST_TIMER_SYNC_INTERVAL removed - useRestTimer hook handles its own timing locally
// This eliminates unnecessary re-renders every second

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Fallback seed for `appSettings`, used ONLY when no `SettingsProvider` is
 * mounted above this provider. With one mounted, the context is the source of
 * truth and is read instead — reading the key here as a second independent
 * snapshot is what let the two stores overwrite each other.
 */
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
  // `appSettings` in localStorage has exactly ONE writer: SettingsProvider.
  // This provider reads and writes it THROUGH that context so an in-workout
  // change and a Settings-screen change can never overwrite each other's
  // snapshot. Optional because the workout tree can also mount without the
  // provider above it (error-boundary fallbacks, focused unit tests).
  const appSettingsContext = useOptionalSettings();
  const appSettingsContextRef = useRef(appSettingsContext);
  appSettingsContextRef.current = appSettingsContext;

  // Load saved state or create new.
  //
  // Returns the draft PLUS whether its clock is stale. A stale clock is a clock
  // problem: the caller resets startTimestamp/totalPausedTime and keeps every
  // logged set. Deleting the draft here is what silently ate an evening's sets
  // for anyone who meant to finish the workout the next morning.
  const loadState = useCallback((): { draft: WorkoutState; clockStale: boolean } | null => {
    try {
      const saved = platform.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = safeJsonParse<WorkoutState & { _completed?: boolean }>(saved);
        if (!parsed) return null;
        if (parsed._completed) {
          platform.removeItem(STORAGE_KEY);
          return null;
        }
        const lastWrite = parsed.lastPersistedAt ?? parsed.lastPauseTimestamp ?? null;
        const clockStale = !!lastWrite && Date.now() - lastWrite > MAX_DRAFT_AGE_MS;
        if (clockStale) {
          logger.workout?.warn?.(
            'Restored draft has a stale clock — resetting timers, keeping sets',
            {
              ageMs: Date.now() - (lastWrite as number),
              exercises: parsed.exercises?.length ?? 0,
            }
          );
        }
        return { draft: parsed, clockStale };
      }
    } catch {
      // Ignore persistence errors silently
    }
    return null;
  }, []);

  // Initialize state
  const [state, dispatch] = useImmerReducer(workoutReducer, null, () => {
    const loaded = loadState();
    // Prefer the context: a restored draft carries its own (older) copy of
    // appSettings, and a second independent read of localStorage would diverge
    // from SettingsProvider the moment either side changed a value.
    const appSettings = appSettingsContext?.settings ?? loadAppSettings();

    if (loaded) {
      const { draft: savedState, clockStale } = loaded;
      // Subtract the wall-time the app was closed/backgrounded from the workout
      // duration by adding it to totalPausedTime. Prefer the persist stamp; fall
      // back to the last pause time, then to now (no adjustment).
      const lastTimestamp =
        savedState.lastPersistedAt || savedState.lastPauseTimestamp || Date.now();
      // A stale clock is not carried forward at all: the gap is hours or days,
      // so folding it into totalPausedTime would be as meaningless as reusing
      // the old startTimestamp. The clock starts now; the sets are untouched.
      const closedAppElapsed = clockStale ? 0 : Math.max(0, Date.now() - lastTimestamp);
      // Preserve the user's own pause state. Previously we force-paused on every
      // restore, which froze the duration timer with no obvious way to resume —
      // so a resumed-but-still-"paused" workout saved a far-too-short duration.
      const wasPaused = savedState.isPaused === true;

      return {
        ...createInitialState([], 0, appSettings),
        ...savedState,
        appSettings,
        isPaused: wasPaused,
        lastPauseTimestamp: wasPaused ? Date.now() : null,
        // ONLY the clock is reset for a stale draft — exercises, sets,
        // supersets and the current index all survive verbatim above.
        startTimestamp: clockStale ? Date.now() : (savedState.startTimestamp ?? Date.now()),
        totalPausedTime: clockStale ? 0 : (savedState.totalPausedTime || 0) + closedAppElapsed,
        pendingHaptic: null,
        finalized: false,
        // Sanitize transient UI/celebration flags
        showConfetti: false,
        showPRCelebration: null,
        showSettings: false,
        showExerciseSelector: false,
        showQuickForm: false,
        showExerciseLibrary: false,
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

  // One provider mount = one workout session, so the "store is unwritable"
  // notice is re-armed here and only here.
  useEffect(() => {
    resetPersistFailureNotice();
  }, []);

  useEffect(() => {
    // Only persist when meaningful workout data changes (exercises, index, supersets, pause state)
    // Skip overlay toggles, celebrations, and timer ticks
    const meaningful = meaningfulStateKey(state);
    if (meaningful === lastPersistedRef.current) return;
    lastPersistedRef.current = meaningful;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      persist(state);
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
      persist(stateRef.current);
    },
    []
  );

  // ============================================================
  // VISIBILITY CHANGE HANDLING (Background/Foreground)
  // ============================================================

  useEffect(() => {
    const removeVisibility = platform.onVisibilityChange((hidden) => {
      if (hidden) {
        persist(stateRef.current);
      } else {
        if (stateRef.current.restTimer.active && stateRef.current.restTimer.endTime) {
          dispatch({ type: 'SYNC_REST_TIMER' });
        }
      }
    });

    const removeUnload = platform.onBeforeUnload(() => {
      persist(stateRef.current);
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
      // Skip the backup write when nothing persist-worthy changed since the last
      // write — avoids re-serializing an ever-growing idle state every 30s.
      const key = meaningfulStateKey(stateRef.current);
      if (key === lastPersistedRef.current) return;
      lastPersistedRef.current = key;
      persist(stateRef.current);
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
      // Single source of the set-complete buzz (slider + handler no longer
      // self-buzz). Route through the canonical Quiet-Luxury 'success' effect
      // ([15,60,15], iOS-safe) instead of the legacy heavy [50,50,50] triple.
      triggerHapticEffect('success');
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
  // SETTINGS RECONCILIATION (SettingsProvider is the single writer)
  // ============================================================
  // This provider used to write `appSettings` itself, merging its own
  // mount-time snapshot into the key. SettingsProvider wrote the same key from
  // ITS mount-time snapshot. Neither observed the other, so each wrote a stale
  // whole over the other's value: toggling ניגודיות גבוהה in the workout
  // overlay and then מצב כהה in Settings destroyed the high-contrast
  // preference, and services/localStateMirror mirrors this key to the cloud, so
  // the loss was restored onto every device on the next sign-in.
  //
  // Both directions are reconciled here, in ONE effect, so the outcome cannot
  // depend on effect ordering:
  //   • the context moved  -> it wins; absorb it into the workout store
  //   • only this store moved -> forward it to the context, the single writer
  // Signatures are compared by value (the same JSON-signature idiom used for
  // `lastPersistedRef` above), so the two stores cannot ping-pong forever on
  // freshly allocated objects that hold identical values.
  const agreedSettingsRef = useRef<{ workout: string; context: string }>({
    workout: '',
    context: '',
  });

  const contextWorkoutSettings = appSettingsContext?.settings.workoutSettings;

  useEffect(() => {
    const workoutSettings = state.appSettings?.workoutSettings;
    if (!workoutSettings) return;

    const agreed = agreedSettingsRef.current;
    const workoutSignature = JSON.stringify(workoutSettings);
    const contextSignature = contextWorkoutSettings ? JSON.stringify(contextWorkoutSettings) : '';

    const workoutMoved = workoutSignature !== agreed.workout;
    const contextMoved = contextSignature !== agreed.context;
    if (!workoutMoved && !contextMoved) return;

    // The context owns the key, so when it moved it wins — even if this store
    // moved in the same commit. Absorbing first means a value changed on the
    // Settings screen mid-workout can never be forwarded back stale.
    if (contextMoved && contextWorkoutSettings) {
      agreedSettingsRef.current = { ...agreed, context: contextSignature };
      dispatch({ type: 'UPDATE_SETTINGS', payload: contextWorkoutSettings });
      return;
    }

    agreedSettingsRef.current = { ...agreed, workout: workoutSignature };

    const context = appSettingsContextRef.current;
    if (context) {
      context.updateWorkoutSettings(workoutSettings);
      return;
    }

    // No SettingsProvider above us — this provider is then the only writer, so
    // it merges into storage itself rather than dropping the change.
    try {
      const existingSettings = platform.getItem('appSettings');
      const parsed: AppSettings = existingSettings
        ? (safeJsonParse<AppSettings>(existingSettings) ?? ({} as AppSettings))
        : ({} as AppSettings);
      const updated = {
        ...parsed,
        workoutSettings: {
          ...(parsed.workoutSettings || {}),
          ...workoutSettings,
        },
      };
      platform.setItem('appSettings', JSON.stringify(updated));
    } catch {
      // Silently handle settings persistence errors
    }
  }, [state.appSettings?.workoutSettings, contextWorkoutSettings, dispatch]);

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
