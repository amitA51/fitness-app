/**
 * useWorkoutHistoryHub - Central hook for accessing workout history in the hub
 *
 * This hook provides a single source of truth for workout sessions,
 * combining data from IndexedDB with real-time updates via events.
 *
 * Features:
 * - Loads workout sessions from IndexedDB
 * - Listens for WORKOUT_SAVED and WORKOUT_COMPLETED events
 * - Provides loading state and refresh capability
 */

import { useCallback, useEffect, useState } from 'react';
import { getWorkoutSessions } from '../../services/dataService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

interface UseWorkoutHistoryHubResult {
  /** Array of workout sessions, sorted by start time (newest first) */
  sessions: WorkoutSession[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Get the most recent session */
  getLatestSession: () => WorkoutSession | null;
  /** Get sessions for a specific date range */
  getSessionsInRange: (startDate: Date, endDate: Date) => WorkoutSession[];
  /** Total count of sessions */
  totalCount: number;
}

/**
 * Central hook for accessing workout history in the hub
 *
 * @param limit - Maximum number of sessions to load (default: 50)
 * @returns UseWorkoutHistoryHubResult
 *
 * @example
 * ```tsx
 * const { sessions, loading, refresh } = useWorkoutHistoryHub(20);
 *
 * if (loading) return <div>Loading...</div>;
 *
 * return (
 *   <div>
 *     {sessions.map(session => (
 *       <WorkoutCard key={session.id} session={session} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export const useWorkoutHistoryHub = (limit = 50): UseWorkoutHistoryHubResult => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(limit);
      setSessions(data);
    } catch (err) {
      logger.workout.error('Failed to load workout sessions', err);
      setError(err instanceof Error ? err : new Error('Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Initial load
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Listen for workout events
  useEffect(() => {
    const handleWorkoutSaved = () => {
      // Reload sessions when a new workout is saved
      loadSessions();
    };

    const handleWorkoutCompleted = () => {
      // Reload sessions when a workout is completed
      loadSessions();
    };

    window.addEventListener('WORKOUT_SAVED', handleWorkoutSaved);
    window.addEventListener('WORKOUT_COMPLETED', handleWorkoutCompleted);

    return () => {
      window.removeEventListener('WORKOUT_SAVED', handleWorkoutSaved);
      window.removeEventListener('WORKOUT_COMPLETED', handleWorkoutCompleted);
    };
  }, [loadSessions]);

  // Helper functions
  const getLatestSession = useCallback((): WorkoutSession | null => {
    return sessions[0] || null;
  }, [sessions]);

  const getSessionsInRange = useCallback(
    (startDate: Date, endDate: Date): WorkoutSession[] => {
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      return sessions.filter((session) => {
        if (!session.startTime) return false;
        const sessionMs = new Date(session.startTime).getTime();
        return sessionMs >= startMs && sessionMs <= endMs;
      });
    },
    [sessions]
  );

  return {
    sessions,
    loading,
    error,
    refresh: loadSessions,
    getLatestSession,
    getSessionsInRange,
    totalCount: sessions.length,
  };
};

export default useWorkoutHistoryHub;
