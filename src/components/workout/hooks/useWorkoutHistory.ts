import { useCallback, useEffect, useState } from 'react';
import { getWorkoutSessions } from '../../../services/dataService';
import { getCurrentUser } from '../../../services/supabaseAuth';
import type { WorkoutSession } from '../../../types';
import { logger } from '../../../utils/logger';

export interface WorkoutHistoryStats {
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number;
  averageVolume: number;
  averageDuration: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
}

export interface UseWorkoutHistoryResult {
  sessions: WorkoutSession[];
  stats: WorkoutHistoryStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const calculateStats = (sessions: WorkoutSession[]): WorkoutHistoryStats => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const completedSessions = sessions.filter((s) => s.endTime);

  let totalVolume = 0;
  let totalDuration = 0;

  completedSessions.forEach((session) => {
    session.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.completedAt && set.weight && set.reps) {
          totalVolume += set.weight * set.reps;
        }
      });
    });

    if (session.startTime && session.endTime) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      totalDuration += (end - start) / 60000;
    }
  });

  const workoutsThisWeek = completedSessions.filter((s) => new Date(s.startTime) >= weekAgo).length;

  const workoutsThisMonth = completedSessions.filter(
    (s) => new Date(s.startTime) >= monthAgo
  ).length;

  return {
    totalWorkouts: completedSessions.length,
    totalVolume: Math.round(totalVolume),
    totalDuration: Math.round(totalDuration),
    averageVolume:
      completedSessions.length > 0 ? Math.round(totalVolume / completedSessions.length) : 0,
    averageDuration:
      completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0,
    workoutsThisWeek,
    workoutsThisMonth,
  };
};

export function useWorkoutHistory(limit = 100): UseWorkoutHistoryResult {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [stats, setStats] = useState<WorkoutHistoryStats>({
    totalWorkouts: 0,
    totalVolume: 0,
    totalDuration: 0,
    averageVolume: 0,
    averageDuration: 0,
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(limit);
      setSessions(data);
      setStats(calculateStats(data));
    } catch (e) {
      logger.workout.error('Failed to load workout history', e);
      setError('שגיאה בטעינת היסטוריית האימונים');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const checkUser = async () => {
      await getCurrentUser();
    };
    checkUser();
  }, []);

  return {
    sessions,
    stats,
    loading,
    error,
    refresh: loadSessions,
  };
}

export default useWorkoutHistory;
