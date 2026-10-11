// usePreviousData - Hook to fetch and provide ghost values from previous workouts
// Now with caching to prevent redundant data fetches
import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkoutSessions } from '../../../services/dataService';
import type { WorkoutSession, WorkoutSet } from '../../../types';
import { logger } from '../../../utils/logger';

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
 * Sort sessions by most recent first (returns a new sorted array)
 * Only called once when caching sessions
 */
const sortSessionsByRecent = (sessions: WorkoutSession[]): WorkoutSession[] => {
  return [...sessions].sort((a, b) => {
    const tb = new Date((b.endTime ?? b.startTime) || 0).getTime();
    const ta = new Date((a.endTime ?? a.startTime) || 0).getTime();
    return tb - ta;
  });
};

// One read shared by every concurrent caller: the "last time" strip and the
// progression chip both ask when an exercise opens.
let sessionsInFlight: Promise<WorkoutSession[]> | null = null;
// Bumped by clearPreviousDataCache. A read that started before a clear (for
// example while the finished workout was still being saved) must not write its
// stale list back into the cache for the next minute.
let sessionsCacheGeneration = 0;

/** The cached recent-first session list while it is fresh; null otherwise. Never reads. */
export function peekRecentSessions(): WorkoutSession[] | null {
  return sessionsCache.data &&
    sessionsCache.sorted &&
    Date.now() - sessionsCache.timestamp < SESSIONS_CACHE_TTL
    ? sessionsCache.data
    : null;
}

/**
 * Saved sessions, most recent first, from the one-minute cache behind every
 * previous-data read on the set screen. Exported so the progression suggestion
 * reads exactly the sessions the "last time" strip does, without a second fetch.
 */
export function loadRecentSessions(): Promise<WorkoutSession[]> {
  const cached = peekRecentSessions();
  if (cached) return Promise.resolve(cached);
  if (!sessionsInFlight) {
    const generation = sessionsCacheGeneration;
    const read = getWorkoutSessions().then((fetched) => {
      // Sort once when caching, not on every access. sortSessionsByRecent
      // returns a NEW sorted array — use that result (the original `fetched`
      // is unsorted), otherwise a `find` over it would scan in fetch order.
      const sorted = sortSessionsByRecent(fetched);
      if (generation === sessionsCacheGeneration) {
        sessionsCache = { data: sorted, timestamp: Date.now(), sorted: true };
      }
      return sorted;
    });
    sessionsInFlight = read;
    read.then(
      () => {
        if (sessionsInFlight === read) sessionsInFlight = null;
      },
      () => {
        if (sessionsInFlight === read) sessionsInFlight = null;
      }
    );
  }
  return sessionsInFlight;
}

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
      // Pre-sorted, shared with every other set-screen reader (see loadRecentSessions).
      const sessions = await loadRecentSessions();

      if (isCancelled.current) return;

      // Sessions are already sorted, no need to sort again
      // Find most recent session with this exercise
      const lastSession = sessions.find((s) => s.exercises.some((e) => e.exerciseName === name));

      let result: WorkoutSet[] | null = null;

      if (lastSession) {
        const exData = lastSession.exercises.find((e) => e.exerciseName === name);
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
      logger.workout.error('Failed to fetch previous workout data', err);
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

    // No fresh cache for this name (e.g. the user just SWAPPED to a new movement
    // mid-workout): clear any prior name's data so the previous-set badge and
    // ghost values don't briefly show the swapped-OUT exercise's numbers while
    // the async fetch for the new name is in flight.
    setPreviousSets(null);
    hasCachedData.current = false;

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
  sessionsCacheGeneration++;
  sessionsInFlight = null;
}

/**
 * Invalidate cache for a specific exercise
 */
export function invalidateExerciseCache(exerciseName: string): void {
  exerciseCache.delete(exerciseName);
}

export default usePreviousData;
