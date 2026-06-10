/**
 * useFitnessInsights - Hook for Fitness Hub smart calculations
 * Aggregates workout data to provide insights for the UI
 * Uses DataContext sessions when available to avoid duplicate IndexedDB reads
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateAIWorkoutInsight } from '../../services/aiWorkoutInsightService';
import type {
  LastWorkoutSummary,
  MuscleGroupLastTrained,
  ProgressDelta,
  StrengthProgressPoint,
} from '../../services/analyticsService';
import { calculateStrengthProgression } from '../../services/analyticsService';
import { onWorkoutSaved } from '../../services/dataEvents';
import { getWorkoutSessions } from '../../services/dataService';
import type { PersonalRecord } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
import { aggregateInsights } from './insightsAggregator';

// ============================================================
// TYPES - For UI agent to use
// ============================================================

export interface FitnessInsightsData {
  loading: boolean;
  error: string | null;

  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  workoutsThisMonth: number;
  workoutsThisWeek: number;

  lastWorkout: LastWorkoutSummary | null;

  muscleGroups: MuscleGroupLastTrained[];
  neglectedMuscles: string[];

  allPRs: PersonalRecord[];
  recentPRs: PersonalRecord[];

  workoutSessions: WorkoutSession[];

  exerciseNames: string[];
  selectedExerciseProgress: StrengthProgressPoint[];
  selectedExerciseDelta: ProgressDelta[] | null;
  /** Week-over-week volume deltas for ALL exercises (locally aggregated). */
  weekOverWeekDeltas: ProgressDelta[];

  aiInsight: string | null;
  aiInsightLoading: boolean;

  refresh: () => Promise<void>;
  selectExercise: (name: string) => void;
  generateAIInsight: () => Promise<void>;
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useFitnessInsights(externalSessions?: WorkoutSession[]): FitnessInsightsData {
  const [localSessions, setLocalSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const sessions = externalSessions ?? localSessions;

  const loadSessions = useCallback(async () => {
    if (externalSessions) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(100);
      setLocalSessions(data);
    } catch (e) {
      logger.analytics.error('Failed to load workout sessions', e);
      setError('שגיאה בטעינת נתוני האימונים');
    } finally {
      setLoading(false);
    }
  }, [externalSessions]);

  useEffect(() => {
    if (externalSessions) {
      setLoading(false);
      return;
    }

    loadSessions();

    const unsubscribeWorkoutSaved = onWorkoutSaved(loadSessions);
    window.addEventListener('WORKOUT_COMPLETED', loadSessions);

    return () => {
      unsubscribeWorkoutSaved();
      window.removeEventListener('WORKOUT_COMPLETED', loadSessions);
    };
  }, [externalSessions, loadSessions]);

  // Single aggregation pass over sessions - memoized on sessions only
  const aggregated = useMemo(() => aggregateInsights(sessions), [sessions]);

  const computedData = useMemo(
    () => ({
      currentStreak: aggregated.currentStreak,
      longestStreak: aggregated.longestStreak,
      totalWorkouts: aggregated.totalWorkouts,
      workoutsThisMonth: aggregated.workoutsThisMonth,
      workoutsThisWeek: aggregated.workoutsThisWeek,
      lastWorkout: aggregated.lastWorkout,
      muscleGroups: aggregated.muscleGroups as MuscleGroupLastTrained[],
      neglectedMuscles: aggregated.neglectedMuscles as string[],
      allPRs: aggregated.allPRs as PersonalRecord[],
      recentPRs: aggregated.recentPRs as PersonalRecord[],
      exerciseNames: aggregated.exerciseNames as string[],
      weekOverWeekDeltas: aggregated.allDeltas as ProgressDelta[],
    }),
    [aggregated]
  );

  const selectedExerciseProgress = useMemo(() => {
    if (!selectedExercise || sessions.length === 0) return [];
    return calculateStrengthProgression(sessions, selectedExercise);
  }, [sessions, selectedExercise]);

  // Cheap lookup into pre-computed map - no re-scan when selection changes
  const selectedExerciseDelta = useMemo(() => {
    if (!selectedExercise || sessions.length === 0) return null;
    return (aggregated.weekOverWeekMap.get(selectedExercise) as ProgressDelta[]) ?? null;
  }, [aggregated.weekOverWeekMap, selectedExercise, sessions.length]);

  useEffect(() => {
    if (!selectedExercise && computedData.exerciseNames.length > 0) {
      const firstExercise = computedData.exerciseNames[0];
      if (firstExercise) setSelectedExercise(firstExercise);
    }
  }, [computedData.exerciseNames, selectedExercise]);

  const generateInsight = useCallback(async () => {
    if (aiInsightLoading) return;
    try {
      setAiInsightLoading(true);
      const insight = await generateAIWorkoutInsight(sessions);
      setAiInsight(insight);
    } catch (e) {
      logger.ai.error('Failed to generate AI insight', e);
      setAiInsight(null);
    } finally {
      setAiInsightLoading(false);
    }
  }, [aiInsightLoading, sessions]);

  return useMemo(
    () => ({
      loading: externalSessions ? false : loading,
      error,
      ...computedData,
      workoutSessions: sessions,
      selectedExerciseProgress,
      selectedExerciseDelta,
      aiInsight,
      aiInsightLoading,
      refresh: loadSessions,
      selectExercise: setSelectedExercise,
      generateAIInsight: generateInsight,
    }),
    [
      externalSessions,
      loading,
      error,
      computedData,
      sessions,
      selectedExerciseProgress,
      selectedExerciseDelta,
      aiInsight,
      aiInsightLoading,
      loadSessions,
      generateInsight,
    ]
  );
}

export default useFitnessInsights;
