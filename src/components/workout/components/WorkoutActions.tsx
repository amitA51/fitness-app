// Extracted from ActiveWorkoutNew.tsx
// Contains finish/cancel/save workflow handlers and state

import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import { Suspense, lazy } from 'react';
import { createWorkoutTemplate, saveWorkoutSession } from '../../../services/dataService';
import type { PersonalItem, WorkoutExercise, WorkoutSession } from '../../../types';
import { todayStr } from '../../../utils/dateUtils';
import { triggerHaptic } from '../../../utils/haptics';
import { generateId } from '../../../utils/id';
import { safeJsonParse } from '../../../utils/safeJson';
import { setVolume } from '../../../utils/workoutMath';
import { useWorkoutDerived, useWorkoutDispatch, useWorkoutState } from '../core/WorkoutContext';
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

// Stable overlay components defined outside the hook to avoid new identity each render
const FinishOverlayComponent: React.FC<{
  onExit: () => void;
  showFinishConfirm: boolean;
  finishIntent: 'finish' | 'cancel';
  workoutStats: WorkoutStats;
  handleConfirmFinish: (item: PersonalItem) => Promise<unknown>;
  handleCancelConfirm: () => void;
  onCooldown: () => void;
  isSaving: boolean;
  saveError: string | null;
}> = ({
  onExit,
  showFinishConfirm,
  finishIntent,
  workoutStats,
  handleConfirmFinish,
  handleCancelConfirm,
  onCooldown,
  isSaving,
  saveError,
}) => (
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
      onCooldown={onCooldown}
      isSaving={isSaving}
      saveError={saveError}
    />
  </Suspense>
);

// Maps a completed session into a createWorkoutTemplate payload. Shared by the
// "save as template" and "do it again" actions so the two can never drift.
// `isFavorite` surfaces the template in the PreWorkoutScreen "התבניות שלך" row,
// which is exactly where the repeat affordance wants the user to land next time.
const buildTemplatePayload = (
  completedSession: WorkoutSession,
  isFavorite: boolean
): Parameters<typeof createWorkoutTemplate>[0] => ({
  name: completedSession.exercises?.[0]?.name || 'My Workout',
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
    sets: ex.sets?.map((s) => ({ reps: s.reps, weight: s.weight })),
  })),
  muscleGroups: Array.from(
    new Set(
      (completedSession.exercises || []).map((e) => e.muscleGroup).filter(Boolean) as string[]
    )
  ),
  isBuiltin: false,
  updatedAt: new Date().toISOString(),
  lastUsed: null,
  timesUsed: 0,
  isFavorite,
});

const SummaryOverlayComponent: React.FC<{
  onExit: () => void;
  completedSession: WorkoutSession | null;
}> = ({ onExit, completedSession }) => {
  if (!completedSession) return null;

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-overlay bg-[var(--fs-bg)] flex items-center justify-center">
          <div className="text-[var(--fs-ink)]">תוצאות האימון...</div>
        </div>
      }
    >
      <WorkoutSummary
        isOpen={true}
        session={completedSession}
        onClose={() => {
          try {
            localStorage.removeItem('active_workout_v3_state');
          } catch {
            /* ignore */
          }
          onExit();
        }}
        onSaveAsTemplate={async () => {
          await createWorkoutTemplate(buildTemplatePayload(completedSession, false));
        }}
        onRepeatWorkout={() => {
          // Pre-seed the next session as a favorite template (best-effort, fire
          // and forget) so it surfaces in the PreWorkoutScreen "התבניות שלך"
          // row, then exit back to the start flow.
          createWorkoutTemplate(buildTemplatePayload(completedSession, true)).catch(() => {});
          onExit();
        }}
      />
    </Suspense>
  );
};

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
  }, [
    state.startTimestamp,
    state.totalPausedTime,
    derived.completedSetsCount,
    derived.totalVolume,
  ]);

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

  const handleConfirmFinish = useCallback(
    async (item: PersonalItem) => {
      if (finishIntent === 'cancel') {
        setShowFinishConfirm(false);
        setSaveError(null);

        try {
          const saved = localStorage.getItem('active_workout_v3_state');
          if (saved) {
            const parsed = safeJsonParse<Record<string, unknown>>(saved);
            if (parsed) {
              // Immutable update — never mutate the parsed object in place.
              localStorage.setItem(
                'active_workout_v3_state',
                JSON.stringify({ ...parsed, _completed: true })
              );
            }
          }
          localStorage.removeItem('active_workout_v3_state');
        } catch {
          // Storage may be full or unavailable — continue
        }
        return 'cancel';
      }

      const completedExercises = state.exercises.filter((ex) =>
        (ex.sets ?? []).some((s) => s.completedAt)
      );

      if (completedExercises.length === 0) {
        setSaveError('לא הושלם אף סט. יש להשלים לפחות סט אחד כדי לשמור.');
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
          sets: (ex.sets ?? []).filter((s) => s.completedAt),
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
          // UUID, never a prefixed string — cloud workout_sessions.id is uuid
          // and PostgREST rejects `session_<ts>` ids with 22P02.
          id: crypto.randomUUID?.() || generateId('session'),
          userId: 'local_user',
          workoutItemId: item?.id || `workout_${Date.now()}`,
          startTime: new Date(state.startTimestamp).toISOString(),
          endTime: new Date().toISOString(),
          // Local-date key (not UTC slice) so an early-morning finish isn't
          // mis-attributed to the previous calendar day for users ahead of UTC.
          date: todayStr(),
          duration: Math.floor((Date.now() - state.startTimestamp - state.totalPausedTime) / 1000),
          status: 'completed',
          templateId: null,
          notes: '',
          rating: null,
          totalVolume: workoutExercises.reduce(
            (sum, ex) => sum + ex.sets.reduce((setSum, s) => setSum + setVolume(s), 0),
            0
          ),
          caloriesBurned: null,
          goalType: workoutSettings.defaultWorkoutGoal ?? 'general',
          exercises: workoutExercises,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveWorkoutSession(session);

        try {
          const { getWorkoutSessions } = await import('../../../services/dataService');
          const savedSessions = await getWorkoutSessions(1);
          const wasSaved = savedSessions.some((s) => s.id === session.id);

          if (!wasSaved) {
            throw new Error('Session verification failed - session not found in database');
          }
        } catch {
          // Session may still be saved - continue without verification
        }

        try {
          const saved = localStorage.getItem('active_workout_v3_state');
          if (saved) {
            const parsed = safeJsonParse<Record<string, unknown>>(saved);
            if (parsed) {
              // Immutable update — never mutate the parsed object in place.
              localStorage.setItem(
                'active_workout_v3_state',
                JSON.stringify({ ...parsed, _completed: true })
              );
            }
          }
        } catch {
          // Storage may be full or unavailable — continue
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
    },
    [finishIntent, state, workoutSettings.defaultWorkoutGoal]
  );

  const handleCancelConfirm = useCallback(() => {
    setShowFinishConfirm(false);
    setSaveError(null);
  }, []);

  // Stable component references using useMemo to avoid remount
  const FinishOverlay: React.FC<{ onExit: () => void }> = useMemo(
    () =>
      function FinishOverlayWrapper({ onExit }: { onExit: () => void }) {
        return (
          <FinishOverlayComponent
            onExit={onExit}
            showFinishConfirm={showFinishConfirm}
            finishIntent={finishIntent}
            workoutStats={workoutStats}
            handleConfirmFinish={handleConfirmFinish}
            handleCancelConfirm={handleCancelConfirm}
            onCooldown={() => {
              handleCancelConfirm();
              dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
            }}
            isSaving={isSaving}
            saveError={saveError}
          />
        );
      },
    [
      showFinishConfirm,
      finishIntent,
      workoutStats,
      handleConfirmFinish,
      handleCancelConfirm,
      dispatch,
      isSaving,
      saveError,
    ]
  );

  const SummaryOverlay: React.FC<{ onExit: () => void }> = useMemo(
    () =>
      function SummaryOverlayWrapper({ onExit }: { onExit: () => void }) {
        return <SummaryOverlayComponent onExit={onExit} completedSession={completedSession} />;
      },
    [completedSession]
  );

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
