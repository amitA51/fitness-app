/**
 * useWorkoutHistoryHub - Central hook for accessing workout history
 * Accepts optional external sessions to avoid duplicate IndexedDB reads
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWorkoutSessions } from '../../services/dataService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

interface UseWorkoutHistoryHubResult {
  sessions: WorkoutSession[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getLatestSession: () => WorkoutSession | null;
  getSessionsInRange: (startDate: Date, endDate: Date) => WorkoutSession[];
  totalCount: number;
}

export const useWorkoutHistoryHub = (
  limit = 50,
  externalSessions?: WorkoutSession[]
): UseWorkoutHistoryHubResult => {
  const [localSessions, setLocalSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);

  const sessions = externalSessions ?? localSessions;

  const loadSessions = useCallback(async () => {
    if (externalSessions) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(limit);
      setLocalSessions(data);
    } catch (err) {
      logger.workout.error('Failed to load workout sessions', err);
      setError(err instanceof Error ? err : new Error('Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  }, [limit, externalSessions]);

  useEffect(() => {
    if (externalSessions) {
      setLoading(false);
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadSessions();
  }, [externalSessions, loadSessions]);

  useEffect(() => {
    if (externalSessions) return;
    const handleWorkoutSaved = () => loadSessions();
    const handleWorkoutCompleted = () => loadSessions();
    window.addEventListener('WORKOUT_SAVED', handleWorkoutSaved);
    window.addEventListener('WORKOUT_COMPLETED', handleWorkoutCompleted);
    return () => {
      window.removeEventListener('WORKOUT_SAVED', handleWorkoutSaved);
      window.removeEventListener('WORKOUT_COMPLETED', handleWorkoutCompleted);
    };
  }, [externalSessions, loadSessions]);

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
    loading: externalSessions ? false : loading,
    error,
    refresh: loadSessions,
    getLatestSession,
    getSessionsInRange,
    totalCount: sessions.length,
  };
};

export default useWorkoutHistoryHub;
