/**
 * useProgressionRecommendation - Hook for getting weight progression recommendations
 *
 * Provides personalized recommendations on when to increase/decrease weight
 * based on workout history, RPE, and consistency.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWorkoutSessions } from '../../services/dataService';
import {
  type AIProgressionContext,
  type ExerciseProgressionData,
  type ProgressionRecommendation,
  buildAIProgressionContext,
  calculateAllExercisesProgression,
  calculateProgression,
  getRecommendationLabel,
} from '../../services/progressionService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressionExercise {
  id: string;
  name: string;
  targetReps?: number;
  targetSets?: number;
}

export interface UseProgressionRecommendationResult {
  // Loading states
  loading: boolean;
  error: string | null;

  // Single exercise recommendation
  getRecommendation: (exerciseId: string) => ExerciseProgressionData | null;
  getRecommendationLabel: (rec: ProgressionRecommendation) => string;

  // All exercises for current workout
  exerciseRecommendations: ExerciseProgressionData[];

  // For AI integration
  getAIContext: (exerciseId: string) => AIProgressionContext | null;

  // Actions
  refresh: () => Promise<void>;
}

export interface UseProgressionForExerciseResult {
  data: ExerciseProgressionData | null;
  loading: boolean;
  error: string | null;
  label: string;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK: Get recommendations for multiple exercises
// ============================================================================

export function useProgressionRecommendation(
  exercises: ProgressionExercise[]
): UseProgressionRecommendationResult {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(50);
      setSessions(data);
    } catch (e) {
      logger.ai.error('Failed to load sessions for progression', e);
      setError('שגיאה בטעינת נתוני ההתקדמות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Calculate recommendations for all exercises
  const exerciseRecommendations = useMemo(() => {
    if (sessions.length === 0 || exercises.length === 0) return [];
    return calculateAllExercisesProgression(sessions, exercises);
  }, [sessions, exercises]);

  // Get recommendation for specific exercise
  const getRecommendation = useCallback(
    (exerciseId: string): ExerciseProgressionData | null => {
      return exerciseRecommendations.find((r) => r.exerciseId === exerciseId) || null;
    },
    [exerciseRecommendations]
  );

  // Get AI context for a specific exercise
  const getAIContext = useCallback(
    (exerciseId: string): AIProgressionContext | null => {
      const data = getRecommendation(exerciseId);
      if (!data) return null;
      return buildAIProgressionContext(data);
    },
    [getRecommendation]
  );

  return {
    loading,
    error,
    getRecommendation,
    getRecommendationLabel,
    exerciseRecommendations,
    getAIContext,
    refresh: loadSessions,
  };
}

// ============================================================================
// HOOK: Get recommendation for single exercise
// ============================================================================

export function useProgressionForExercise(
  exerciseId: string,
  exerciseName: string,
  targetReps = 8,
  targetSets = 4
): UseProgressionForExerciseResult {
  const [data, setData] = useState<ExerciseProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sessions = await getWorkoutSessions(50);
      const result = calculateProgression({
        exerciseId,
        exerciseName,
        targetReps,
        targetSets,
        sessions,
      });
      setData(result);
    } catch (e) {
      logger.ai.error('Failed to calculate progression', e);
      setError('שגיאה בחישוב ההתקדמות');
    } finally {
      setLoading(false);
    }
  }, [exerciseId, exerciseName, targetReps, targetSets]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    label: data ? getRecommendationLabel(data.recommendation) : '',
    refresh: load,
  };
}

// ============================================================================
// HOOK: Get AI-enhanced recommendation (future integration)
// ============================================================================

export interface AIEnhancedRecommendation {
  baseRecommendation: ExerciseProgressionData;
  aiInsight: string | null;
  suggestedWorkout: string | null;
  warnings: string[];
}

export function useAIEnhancedRecommendation(
  exerciseId: string,
  exerciseName: string
): {
  data: AIEnhancedRecommendation | null;
  loading: boolean;
  generateInsight: () => Promise<void>;
} {
  const [data, setData] = useState<AIEnhancedRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const workoutSessions = await getWorkoutSessions(50);
      setSessions(workoutSessions);

      const baseRec = calculateProgression({
        exerciseId,
        exerciseName,
        targetReps: 8,
        targetSets: 4,
        sessions: workoutSessions,
      });

      setData({
        baseRecommendation: baseRec,
        aiInsight: null,
        suggestedWorkout: null,
        warnings: [],
      });
    } catch (e) {
      logger.ai.error('Failed to load AI recommendation', e);
    } finally {
      setLoading(false);
    }
  }, [exerciseId, exerciseName]);

  useEffect(() => {
    load();
  }, [load]);

  const generateInsight = useCallback(async () => {
    if (!data || sessions.length === 0) return;

    // This will be connected to AI service in the future
    // For now, generate basic insight based on data
    const ctx = buildAIProgressionContext(data.baseRecommendation);

    let insight = '';
    let suggestedWorkout = '';
    const warnings: string[] = [];

    // Build insight message
    insight = `בהתבסס על ${sessions.length} אימונים, `;

    if (data.baseRecommendation.recommendation === 'INCREASE_WEIGHT') {
      insight += `אתה מוכן להעלות משקל ל-${data.baseRecommendation.suggestedWeight} ק"ג. `;
      insight += `עקביות של ${Math.round(data.baseRecommendation.confidence)}% באימונים האחרונים.`;
    } else if (data.baseRecommendation.recommendation === 'MAINTAIN') {
      insight += `מומלץ להמשיך עם ${data.baseRecommendation.currentWeight} ק"ג `;
      insight += `ולהתמקד בשיפור הטכניקה.`;
    } else if (data.baseRecommendation.recommendation === 'DECREASE_WEIGHT') {
      insight += `שים לב ל-RPE הגבוה - מומלץ להוריד משקל ל-${data.baseRecommendation.suggestedWeight} ק"ג.`;
      warnings.push('הימנע מאימון אינטנסיבי אם יש כאבים');
    }

    if (ctx.recentRPEs.length > 0) {
      const avgRPE = ctx.recentRPEs.reduce((a, b) => a + b, 0) / ctx.recentRPEs.length;
      insight += ` RPE ממוצע: ${avgRPE.toFixed(1)}/10.`;
    }

    // Suggested workout
    suggestedWorkout = buildSuggestedWorkout(ctx);

    setData((prev) =>
      prev
        ? {
            ...prev,
            aiInsight: insight,
            suggestedWorkout,
            warnings,
          }
        : null
    );
  }, [data, sessions]);

  return {
    data,
    loading,
    generateInsight,
  };
}

// ============================================================================
// HELPER: Build suggested workout description
// ============================================================================

function buildSuggestedWorkout(ctx: AIProgressionContext): string {
  if (ctx.recommendation === 'INCREASE_WEIGHT') {
    return `${ctx.exerciseName}: ${ctx.targetSets} סטים × ${ctx.targetReps} חזרות × ${ctx.currentWeight + 2.5} ק"ג`;
  } else if (ctx.recommendation === 'DECREASE_WEIGHT') {
    return `${ctx.exerciseName}: ${ctx.targetSets} סטים × ${ctx.targetReps} חזרות × ${Math.round((ctx.currentWeight * 0.6) / 2.5) * 2.5} ק"ג (דלואד)`;
  } else {
    return `${ctx.exerciseName}: ${ctx.targetSets} סטים × ${ctx.targetReps} חזרות × ${ctx.currentWeight} ק"ג`;
  }
}
