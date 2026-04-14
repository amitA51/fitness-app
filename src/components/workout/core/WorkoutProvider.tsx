// Workout Provider - Main provider component with all workout logic
import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { useImmerReducer } from 'use-immer';
import {
    WorkoutState,
    WorkoutProviderProps,
    WorkoutDerivedValue,
    createInitialState,
    HAPTIC_PATTERNS
} from './workoutTypes';
import { workoutReducer } from './workoutReducer';
import { vibratePattern } from '../../../utils/haptics';
import { createWorkoutSet } from '../../../types';
import {
    WorkoutStateProvider,
    WorkoutDispatchProvider,
    WorkoutDerivedProvider
} from './WorkoutContext';
import { AppSettings } from '../../../types';
import { getThemeVariables } from '../themes';
// Data service imports moved to ActiveWorkoutNew.tsx
// PR service imports removed - used in ActiveWorkoutNew.tsx instead

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY = 'active_workout_v3_state';
// REST_TIMER_SYNC_INTERVAL removed - useRestTimer hook handles its own timing locally
// This eliminates unnecessary re-renders every second

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const loadAppSettings = (): AppSettings => {
    try {
        const stored = localStorage.getItem('appSettings');
        if (!stored) return {} as AppSettings;
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed : {} as AppSettings;
    } catch {
        return {} as AppSettings;
    }
};



// ============================================================
// PROVIDER COMPONENT
// ============================================================

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({
    item,
    children,
}) => {
    // Load saved state or create new
    const loadState = useCallback((): WorkoutState | null => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Don't restore if workout was marked as completed
                // This prevents the loop issue where completed workouts keep reopening
                if (parsed._completed) {
                    localStorage.removeItem(STORAGE_KEY);
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
    const [state, dispatch] = useImmerReducer(
        workoutReducer,
        null,
        () => {
            const savedState = loadState();
            const appSettings = loadAppSettings();

            if (savedState) {
                return {
                    ...createInitialState([], 0, appSettings),
                    ...savedState,
                    appSettings,
                    isPaused: true,
                    lastPauseTimestamp: Date.now(),
                    pendingHaptic: null,
                };
            }

            // Ensure item exists before accessing its properties
            const exercises = item?.exercises || [];
            return createInitialState(
                // Filter out any exercises without valid names
                exercises.filter(ex => ex?.name?.trim()),
                item?.workoutDuration || 0,
                appSettings
            );
        }
    );

    // State ref for effects that need current state without re-subscribing
    const stateRef = useRef(state);
    stateRef.current = state;

    // ============================================================
    // PERSISTENCE
    // ============================================================

    const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Debounced persistence
        if (persistTimeoutRef.current) {
            clearTimeout(persistTimeoutRef.current);
        }

        persistTimeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch {
                // Silently handle storage quota errors
            }
        }, 500);

        return () => {
            if (persistTimeoutRef.current) {
                clearTimeout(persistTimeoutRef.current);
            }
        };
    }, [state]);

    // ============================================================
    // VISIBILITY CHANGE HANDLING (Background/Foreground)
    // ============================================================

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
                } catch {
                    // Silently handle storage errors
                }
            } else if (document.visibilityState === 'visible') {
                if (stateRef.current.restTimer.active && stateRef.current.restTimer.endTime) {
                    dispatch({ type: 'SYNC_REST_TIMER' });
                }
            }
        };

        const handleBeforeUnload = () => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
            } catch {
                // Silently handle storage errors
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]); // stateRef used instead of state to prevent handler recreation

    // ============================================================
    // PERIODIC AUTO-SAVE (Every 30 seconds as backup)
    // ============================================================

    useEffect(() => {
        const intervalId = setInterval(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
            } catch {
                // Silently handle storage errors
            }
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
    // HAPTIC FEEDBACK
    // ============================================================

    useEffect(() => {
        if (!state.pendingHaptic) return;

        const pattern = state.pendingHaptic === 'SET_COMPLETE'
            ? HAPTIC_PATTERNS.SET_COMPLETE
            : HAPTIC_PATTERNS.REST_END;

        vibratePattern([...pattern]);
        dispatch({ type: 'CLEAR_PENDING_HAPTIC' });
    }, [state.pendingHaptic, dispatch]);

    // ============================================================
    // THEME APPLICATION
    // ============================================================

    useEffect(() => {
        const themeId = state.appSettings?.workoutSettings?.selectedTheme || 'deepCosmos';
        try {
            const variables = getThemeVariables(themeId);
            const root = document.documentElement;
            Object.entries(variables).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });
            document.body.setAttribute('data-theme', themeId);
        } catch {
            // Silently handle theme application errors
        }

        return () => {
            document.body.removeAttribute('data-theme');
        };
    }, [state.appSettings?.workoutSettings?.selectedTheme]);

    // ============================================================
    // SETTINGS PERSISTENCE
    // ============================================================

    useEffect(() => {
        if (!state.appSettings?.workoutSettings) return;
        try {
            const existingSettings = localStorage.getItem('appSettings');
            const parsed = existingSettings ? JSON.parse(existingSettings) : {};
            const updated = {
                ...parsed,
                workoutSettings: {
                    ...(parsed.workoutSettings || {}),
                    ...state.appSettings.workoutSettings,
                },
            };
            localStorage.setItem('appSettings', JSON.stringify(updated));
        } catch {
            // Silently handle settings persistence errors
        }
    }, [state.appSettings?.workoutSettings]);

    // ============================================================
    // WAKE LOCK
    // ============================================================

    useEffect(() => {
        if (!state.appSettings?.workoutSettings?.keepAwake) return;

        let wakeLock: WakeLockSentinel | null = null;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch {
                // Silently handle wake lock errors
            }
        };

        requestWakeLock();

        return () => {
            wakeLock?.release();
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

        const activeSetIndex = currentExercise.sets?.findIndex(s => !s.completedAt) ?? -1;
        const displaySetIndex = activeSetIndex === -1 ? (currentExercise.sets?.length ?? 0) : activeSetIndex;
        const currentSet = currentExercise.sets?.[displaySetIndex] || createWorkoutSet({ reps: 0, weight: 0 });

        // Calculate stats
        let completedSetsCount = 0;
        let totalSets = 0;
        let totalVolume = 0;

        state.exercises.forEach(ex => {
            (ex.sets || []).forEach(set => {
                if (set.isWarmup) return; // Warmup sets excluded from stats
                totalSets++;
                if (set.completedAt) {
                    completedSetsCount++;
                    totalVolume += (set.weight || 0) * (set.reps || 0);
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
                <WorkoutDerivedProvider value={derived}>
                    {children}
                </WorkoutDerivedProvider>
            </WorkoutDispatchProvider>
        </WorkoutStateProvider>
    );
};

export default WorkoutProvider;
