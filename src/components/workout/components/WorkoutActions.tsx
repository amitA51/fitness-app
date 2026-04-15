// Extracted from ActiveWorkoutNew.tsx
// Contains finish/cancel/save workflow handlers and state

import { useState, useCallback, useMemo } from 'react';
import React, { lazy, Suspense } from 'react';
import { WorkoutSession, WorkoutExercise, PersonalItem } from '../../../types';
import { useWorkoutState, useWorkoutDispatch, useWorkoutDerived } from '../core/WorkoutContext';
import { saveWorkoutSession, createWorkoutTemplate } from '../../../services/dataService';
import { triggerHaptic } from '../../../utils/haptics';
import { formatTime } from '../hooks/useWorkoutTimer';

// Lazy loaded
const WorkoutSummary = lazy(() => import('../WorkoutSummary'));
const ConfirmExitOverlay = lazy(() => import('../overlays/ConfirmExitOverlay'));

export interface WorkoutStats {
    completedSets: number;
    totalVolume: number;
    duration: string;
}

export interface WorkoutFinishState {
    showFinishConfirm: boolean;
    finishIntent: 'finish' | 'cancel';
    isSaving: boolean;
    saveError: string | null;
    workoutStats: WorkoutStats;
    completedSession: WorkoutSession | null;
}

export interface WorkoutFinishHandlers {
    handleFinishRequest: () => void;
    handleDiscardRequest: () => void;
    handleConfirmFinish: (item: PersonalItem) => Promise<unknown>;
    handleCancelConfirm: () => void;
}

export interface UseWorkoutFinishReturn {
    state: WorkoutFinishState;
    handlers: WorkoutFinishHandlers;
    FinishOverlay: React.FC<{ onExit: () => void }>;
    SummaryOverlay: React.FC<{ onExit: () => void }>;
}

export const useWorkoutFinish = (): UseWorkoutFinishReturn => {
    const state = useWorkoutState();
    const dispatch = useWorkoutDispatch();
    const derived = useWorkoutDerived();

    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [finishIntent, setFinishIntent] = useState<'finish' | 'cancel'>('finish');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);

    const workoutSettings = state.appSettings?.workoutSettings || {};

    const workoutStats = useMemo((): WorkoutStats => {
        const elapsed = Math.floor((Date.now() - state.startTimestamp - state.totalPausedTime) / 1000);
        return {
            completedSets: derived.completedSetsCount,
            totalVolume: derived.totalVolume,
            duration: formatTime(elapsed),
        };
    }, [state.startTimestamp, state.totalPausedTime, derived.completedSetsCount, derived.totalVolume]);

    const handleFinishRequest = useCallback(() => {
        triggerHaptic('light');
        setFinishIntent('finish');
        setShowFinishConfirm(true);
    }, []);

    const handleDiscardRequest = useCallback(() => {
        triggerHaptic('light');
        setFinishIntent('cancel');
        setShowFinishConfirm(true);
    }, []);

    const handleConfirmFinish = useCallback(async (item: PersonalItem) => {
        if (finishIntent === 'cancel') {
            setShowFinishConfirm(false);
            setSaveError(null);

            const saved = localStorage.getItem('active_workout_v3_state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    parsed._completed = true;
                    localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
                } catch {
                    // If parsing fails, just remove it
                }
            }
            localStorage.removeItem('active_workout_v3_state');
            return 'cancel';
        }

        const completedExercises = state.exercises.filter(ex =>
            (ex.sets ?? []).some(s => s.completedAt)
        );

        if (completedExercises.length === 0) {
            setSaveError('לא הושלמו סטים באימון זה. השלם לפחות סט אחד כדי לשמור את האימון.');
            return;
        }

        triggerHaptic('success');
        setShowFinishConfirm(false);
        setSaveError(null);
        setIsSaving(true);

        try {
            const workoutExercises: WorkoutExercise[] = completedExercises.map((ex, index) => ({
                id: ex.id || `ex_${index}`,
                exerciseId: ex.id || `exercise_${index}`,
                exerciseName: ex.name || 'Unknown Exercise',
                targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
                sets: (ex.sets ?? []).filter(s => s.completedAt),
                notes: '',
                restSeconds: ex.defaultRestTime || ex.targetRestTime || 90,
                isCompleted: true,
                order: index,
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                tempo: ex.tempo,
                targetRestTime: ex.targetRestTime,
            }));

            const session: WorkoutSession = {
                id: `session_${Date.now()}`,
                userId: 'local_user',
                workoutItemId: item?.id || `workout_${Date.now()}`,
                startTime: new Date(state.startTimestamp).toISOString(),
                endTime: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                duration: Math.floor((Date.now() - state.startTimestamp) / 1000),
                status: 'completed',
                templateId: null,
                notes: '',
                rating: null,
                totalVolume: workoutExercises.reduce((sum, ex) =>
                    sum + ex.sets.reduce((setSum, s) => setSum + (s.weight * s.reps), 0), 0
                ),
                caloriesBurned: null,
                goalType: workoutSettings.defaultWorkoutGoal as string,
                exercises: workoutExercises,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await saveWorkoutSession(session);

            try {
                const { getWorkoutSessions } = await import('../../../services/dataService');
                const savedSessions = await getWorkoutSessions(1);
                const wasSaved = savedSessions.some(s => s.id === session.id);

                if (!wasSaved) {
                    throw new Error('Session verification failed - session not found in database');
                }
            } catch (verifyError) {
                // Session may still be saved - continue without verification
            }

            const saved = localStorage.getItem('active_workout_v3_state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    parsed._completed = true;
                    localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
                } catch {
                    // If parsing fails, continue anyway
                }
            }

            setCompletedSession(session);
            return 'success';
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'שגיאה לא ידועה';
            setSaveError(`שגיאה בשמירת האימון: ${errorMessage}`);
            return 'error';
        } finally {
            setIsSaving(false);
        }
    }, [finishIntent, state, workoutSettings.defaultWorkoutGoal]);

    const handleCancelConfirm = useCallback(() => {
        setShowFinishConfirm(false);
        setSaveError(null);
    }, []);

    // Confirm Exit Overlay Component
    const FinishOverlay: React.FC<{ onExit: () => void }> = ({ onExit }) => (
        <Suspense fallback={null}>
            <ConfirmExitOverlay
                isOpen={showFinishConfirm}
                intent={finishIntent}
                workoutStats={workoutStats}
                onConfirm={async () => {
                    const result = await handleConfirmFinish({} as PersonalItem);
                    if (result === 'cancel') {
                        onExit();
                    }
                }}
                onCancel={handleCancelConfirm}
                onCooldown={() => {
                    setShowFinishConfirm(false);
                    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
                }}
                isSaving={isSaving}
                saveError={saveError}
            />
        </Suspense>
    );

    // Summary Overlay Component
    const SummaryOverlay: React.FC<{ onExit: () => void }> = ({ onExit }) => {
        if (!completedSession) return null;

        return (
            <Suspense fallback={
                <div className="fixed inset-0 z-[9999] bg-[var(--cosmos-bg-primary)] flex items-center justify-center">
                    <div className="text-white">תוצאות האימון...</div>
                </div>
            }>
                <WorkoutSummary
                    isOpen={true}
                    session={completedSession}
                    onClose={() => {
                        localStorage.removeItem('active_workout_v3_state');
                        onExit();
                    }}
                    onSaveAsTemplate={async () => {
                        const defaultName = completedSession.exercises?.[0]?.name || 'My Workout';
                        await createWorkoutTemplate({
                            name: defaultName,
                            description: '',
                            exercises: (completedSession.exercises || []).map((ex, idx) => ({
                                id: ex.id || `ex_${idx}`,
                                exerciseId: ex.exerciseId || ex.id || `exercise_${idx}`,
                                exerciseName: ex.exerciseName || ex.name || 'Unknown',
                                targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
                                targetSets: ex.sets?.length || 4,
                                targetReps: 10,
                                targetWeight: null,
                                restSeconds: ex.targetRestTime || ex.restSeconds || 90,
                                order: idx,
                                notes: '',
                                name: ex.name,
                                muscleGroup: ex.muscleGroup,
                                targetRestTime: ex.targetRestTime,
                                tempo: ex.tempo,
                                sets: ex.sets?.map(s => ({ reps: s.reps, weight: s.weight })),
                            })),
                            muscleGroups: Array.from(new Set((completedSession.exercises || []).map(e => e.muscleGroup).filter(Boolean) as string[])),
                            isBuiltin: false,
                            updatedAt: new Date().toISOString(),
                            lastUsed: null,
                            timesUsed: 0,
                            isFavorite: false,
                        });
                    }}
                />
            </Suspense>
        );
    };

    return {
        state: {
            showFinishConfirm,
            finishIntent,
            isSaving,
            saveError,
            workoutStats,
            completedSession,
        },
        handlers: {
            handleFinishRequest,
            handleDiscardRequest,
            handleConfirmFinish,
            handleCancelConfirm,
        },
        FinishOverlay,
        SummaryOverlay,
    };
};

export default useWorkoutFinish;
