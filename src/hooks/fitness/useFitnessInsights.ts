/**
 * useFitnessInsights - Hook for Fitness Hub smart calculations
 * Aggregates workout data to provide insights for the UI
 */

import { useState, useEffect, useMemo } from 'react';
import { WorkoutSession } from '../../types';
import { getWorkoutSessions } from '../../services/dataService';
import { calculatePRsFromHistory, PersonalRecord } from '../../services/prService';
import {
    getLastWorkoutSummary,
    getMuscleGroupDaysSince,
    getWeekOverWeekProgress,
    getAllExerciseNames,
    calculateStrengthProgression,
    MuscleGroupLastTrained,
    ProgressDelta,
    LastWorkoutSummary,
    StrengthProgressPoint,
} from '../../services/analyticsService';
import { calculateStreak } from '../../services/achievementService';
import { generateAIWorkoutInsight } from '../../services/aiWorkoutInsightService';
import { logger } from '../../utils/logger';

// ============================================================
// TYPES - For UI agent to use
// ============================================================

export interface FitnessInsightsData {
    // Loading & Error states
    loading: boolean;
    error: string | null;

    // Core stats
    currentStreak: number;
    longestStreak: number;
    totalWorkouts: number;
    workoutsThisMonth: number;
    workoutsThisWeek: number;

    // Last workout
    lastWorkout: LastWorkoutSummary | null;

    // Muscle groups
    muscleGroups: MuscleGroupLastTrained[];
    neglectedMuscles: string[]; // Muscles not trained in 7+ days

    // PRs
    allPRs: PersonalRecord[];
    recentPRs: PersonalRecord[]; // PRs from last 7 days

    // Raw sessions for history timeline
    workoutSessions: WorkoutSession[];

    // Exercise data
    exerciseNames: string[];
    selectedExerciseProgress: StrengthProgressPoint[];
    selectedExerciseDelta: ProgressDelta[] | null;

    // AI Insight
    aiInsight: string | null;
    aiInsightLoading: boolean;

    // Actions
    refresh: () => Promise<void>;
    selectExercise: (name: string) => void;
    generateAIInsight: () => Promise<void>;
}

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useFitnessInsights(): FitnessInsightsData {
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [aiInsightLoading, setAiInsightLoading] = useState(false);

    // Load sessions
    const loadSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getWorkoutSessions(100); // Get last 100 sessions
            setSessions(data);
        } catch (e) {
            logger.analytics.error('Failed to load workout sessions', e);
            setError('שגיאה בטעינת נתוני האימונים');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();

        const handleSave = () => loadSessions();
        const handleCompleted = () => loadSessions();
        
        // Listen for both events to ensure hub stays in sync
        window.addEventListener('WORKOUT_SAVED', handleSave);
        window.addEventListener('WORKOUT_COMPLETED', handleCompleted);

        return () => {
            window.removeEventListener('WORKOUT_SAVED', handleSave);
            window.removeEventListener('WORKOUT_COMPLETED', handleCompleted);
        };
    }, []);

    // Computed values
    const computedData = useMemo(() => {
        if (sessions.length === 0) {
            return {
                currentStreak: 0,
                longestStreak: 0,
                totalWorkouts: 0,
                workoutsThisMonth: 0,
                workoutsThisWeek: 0,
                lastWorkout: null,
                muscleGroups: [],
                neglectedMuscles: [],
                allPRs: [],
                recentPRs: [],
                exerciseNames: [],
            };
        }

        // Streak
        const streakInfo = calculateStreak(sessions);

        // Counts
        const completedSessions = sessions.filter(s => s.endTime);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const workoutsThisWeek = completedSessions.filter(
            s => new Date(s.startTime) >= weekAgo
        ).length;

        const workoutsThisMonth = completedSessions.filter(
            s => new Date(s.startTime) >= monthAgo
        ).length;

        // Last workout
        const lastWorkout = getLastWorkoutSummary(sessions);

        // Muscle groups
        const muscleGroups = getMuscleGroupDaysSince(sessions);
        const neglectedMuscles = muscleGroups
            .filter(mg => mg.daysSince >= 7)
            .map(mg => mg.muscle);

        // PRs
        const prMap = calculatePRsFromHistory(sessions);
        const allPRs = Array.from(prMap.values());
        const recentPRs = allPRs.filter(pr => {
            const prDate = new Date(pr.date);
            return prDate >= weekAgo;
        });

        // Exercise names
        const exerciseNames = getAllExerciseNames(sessions);

        return {
            currentStreak: streakInfo.currentStreak,
            longestStreak: streakInfo.longestStreak,
            totalWorkouts: completedSessions.length,
            workoutsThisMonth,
            workoutsThisWeek,
            lastWorkout,
            muscleGroups,
            neglectedMuscles,
            allPRs,
            recentPRs,
            exerciseNames,
        };
    }, [sessions]);

    // Selected exercise progress
    const selectedExerciseProgress = useMemo(() => {
        if (!selectedExercise || sessions.length === 0) return [];
        return calculateStrengthProgression(sessions, selectedExercise);
    }, [sessions, selectedExercise]);

    const selectedExerciseDelta = useMemo(() => {
        if (!selectedExercise || sessions.length === 0) return null;
        return getWeekOverWeekProgress(sessions);
    }, [sessions, selectedExercise]);

    // Auto-select first exercise
    useEffect(() => {
        if (!selectedExercise && computedData.exerciseNames.length > 0) {
            const firstExercise = computedData.exerciseNames[0];
            if (firstExercise) {
                setSelectedExercise(firstExercise);
            }
        }
    }, [computedData.exerciseNames, selectedExercise]);

    // AI Insight generation
    const generateInsight = async () => {
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
    };

    return {
        loading,
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
    };
}

export default useFitnessInsights;
