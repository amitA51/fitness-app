// usePreviousData - Hook to fetch and provide ghost values from previous workouts
// Now with caching to prevent redundant data fetches
import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkoutSet, WorkoutSession } from '../../../types';
import { getWorkoutSessions } from '../../../services/dataService';

interface UsePreviousDataReturn {
    previousSets: WorkoutSet[] | null;
    isLoading: boolean;
    error: Error | null;
}

// ============================================================
// MODULE-LEVEL CACHE (shared across all hook instances)
// ============================================================

interface CacheEntry {
    sets: WorkoutSet[] | null;
    timestamp: number;
}

// Cache for exercise previous sets - survives component remounts
const exerciseCache = new Map<string, CacheEntry>();

// Cache for all sessions - expensive to fetch repeatedly
// Sessions are stored PRE-SORTED to avoid sorting on every cache hit
let sessionsCache: {
    data: WorkoutSession[] | null;
    timestamp: number;
    sorted: boolean; // Flag to indicate sessions are already sorted
} = { data: null, timestamp: 0, sorted: false };

// Cache expiry times
const SESSIONS_CACHE_TTL = 60000; // 1 minute for sessions list
const EXERCISE_CACHE_TTL = 300000; // 5 minutes for individual exercise data

/**
 * Sort sessions by most recent first (mutates array for performance)
 * Only called once when caching sessions
 */
const sortSessionsByRecent = (sessions: WorkoutSession[]): WorkoutSession[] => {
    return sessions.sort((a, b) => {
        const tb = new Date((b.endTime ?? b.startTime) || 0).getTime();
        const ta = new Date((a.endTime ?? a.startTime) || 0).getTime();
        return tb - ta;
    });
};

/**
 * Fetches previous workout data for ghost value display
 * Shows what weight/reps were used last time for this exercise
 * Now with caching to prevent redundant fetches
 */
export function usePreviousData(exerciseName: string | undefined): UsePreviousDataReturn {
    const [previousSets, setPreviousSets] = useState<WorkoutSet[] | null>(() => {
        // Initialize from cache if available
        if (exerciseName) {
            const cached = exerciseCache.get(exerciseName);
            if (cached && Date.now() - cached.timestamp < EXERCISE_CACHE_TTL) {
                return cached.sets;
            }
        }
        return null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    // Track if this is the first mount to avoid flash of loading state
    const hasCachedData = useRef(false);

    const fetchPreviousData = useCallback(async (name: string, isCancelled: { current: boolean }) => {
        // Check exercise cache first
        const cachedExercise = exerciseCache.get(name);
        if (cachedExercise && Date.now() - cachedExercise.timestamp < EXERCISE_CACHE_TTL) {
            if (!isCancelled.current) {
                setPreviousSets(cachedExercise.sets);
                setIsLoading(false);
            }
            return;
        }

        try {
            let sessions: WorkoutSession[];
            
            // Check sessions cache - sessions are pre-sorted
            if (sessionsCache.data && sessionsCache.sorted && Date.now() - sessionsCache.timestamp < SESSIONS_CACHE_TTL) {
                sessions = sessionsCache.data;
            } else {
                sessions = await getWorkoutSessions();
                // Sort once when caching, not on every access
                sortSessionsByRecent(sessions);
                sessionsCache = { data: sessions, timestamp: Date.now(), sorted: true };
            }

            if (isCancelled.current) return;

            // Sessions are already sorted, no need to sort again
            // Find most recent session with this exercise
            const lastSession = sessions.find(s =>
                s.exercises.some(e => e.exerciseName === name)
            );

            let result: WorkoutSet[] | null = null;
            
            if (lastSession) {
                const exData = lastSession.exercises.find(e => e.exerciseName === name);
                if (exData) {
                    result = exData.sets;
                }
            }

            // Update cache
            exerciseCache.set(name, { sets: result, timestamp: Date.now() });

            if (!isCancelled.current) {
                setPreviousSets(result);
                setError(null);
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Failed to fetch previous workout data:', err);
            if (!isCancelled.current) {
                setPreviousSets(null);
                setError(err as Error);
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!exerciseName) {
            setPreviousSets(null);
            return;
        }

        // Check if we have valid cached data
        const cached = exerciseCache.get(exerciseName);
        if (cached && Date.now() - cached.timestamp < EXERCISE_CACHE_TTL) {
            setPreviousSets(cached.sets);
            hasCachedData.current = true;
            return;
        }

        const isCancelled = { current: false };
        
        // Only show loading if we don't have cached data
        if (!hasCachedData.current) {
            setIsLoading(true);
        }

        fetchPreviousData(exerciseName, isCancelled);

        return () => {
            isCancelled.current = true;
        };
    }, [exerciseName, fetchPreviousData]);

    return { previousSets, isLoading, error };
}

// ============================================================
// CACHE UTILITIES (for external use if needed)
// ============================================================

/**
 * Clear the previous data cache - useful after completing a workout
 */
export function clearPreviousDataCache(): void {
    exerciseCache.clear();
    sessionsCache = { data: null, timestamp: 0, sorted: false };
}

/**
 * Invalidate cache for a specific exercise
 */
export function invalidateExerciseCache(exerciseName: string): void {
    exerciseCache.delete(exerciseName);
}

export default usePreviousData;
