// useWorkoutSave - Owns the finish/cancel save flow for an active workout.
// Extracted from ActiveWorkoutNew to keep the god-component lean. The hook owns
// the save-related local state (summary visibility, completed session, in-flight
// + error flags) and exposes the confirm-finish handler. The component wires the
// returned state/setters into its overlays exactly as before.
import type React from 'react';
import { useCallback, useRef, useState } from 'react';

import { saveWorkoutSession } from '../../../services/dataService';
import type {
  ActiveExercise,
  PersonalItem,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSettings,
} from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { safeJsonParse } from '../../../utils/safeJson';
import { setVolume } from '../../../utils/workoutMath';
import type { WorkoutState } from '../core/workoutTypes';

interface UseWorkoutSaveParams {
  state: WorkoutState;
  workoutSettings: Partial<WorkoutSettings>;
  finishIntent: 'finish' | 'cancel';
  setShowFinishConfirm: (open: boolean) => void;
  item: PersonalItem;
  onExit: () => void;
}

interface UseWorkoutSaveReturn {
  showSummary: boolean;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  completedSession: WorkoutSession | null;
  setCompletedSession: React.Dispatch<React.SetStateAction<WorkoutSession | null>>;
  isSaving: boolean;
  saveError: string | null;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  handleConfirmFinish: () => Promise<void>;
}

/**
 * Encapsulates the workout finish/cancel + persistence flow.
 *
 * The component remains the owner of `finishIntent` and `showFinishConfirm`
 * (those drive the confirm overlay and are also set elsewhere), so they are
 * passed in. All state that is purely about the save itself is owned here.
 */
export function useWorkoutSave({
  state,
  workoutSettings,
  finishIntent,
  setShowFinishConfirm,
  item,
  onExit,
}: UseWorkoutSaveParams): UseWorkoutSaveReturn {
  const [showSummary, setShowSummary] = useState(false);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleConfirmFinish = useCallback(async () => {
    // Guard against double-tap while a save is already in-flight
    if (isSavingRef.current) return;
    if (finishIntent === 'cancel') {
      setShowFinishConfirm(false);
      setSaveError(null);

      // Mark as completed in localStorage to prevent restore
      const saved = localStorage.getItem('active_workout_v3_state');
      if (saved) {
        try {
          const parsed = safeJsonParse<Record<string, unknown>>(saved);
          if (parsed) {
            parsed._completed = true;
            localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
          }
        } catch {
          // If parsing fails, just remove it
        }
      }
      localStorage.removeItem('active_workout_v3_state');

      // Call onExit - the overlay will handle removing the item
      onExit();
      return;
    }

    // Validate: Check if there's anything to save BEFORE closing overlay
    const completedExercises = state.exercises.filter((ex) =>
      (ex.sets ?? []).some((s) => s.completedAt)
    );

    if (completedExercises.length === 0) {
      // No completed sets - show message to user instead of silently exiting
      // Keep overlay open and show error
      setSaveError('לא הושלמו סטים באימון זה. השלם לפחות סט אחד כדי לשמור את האימון.');
      return;
    }

    // Now we can close the overlay and proceed
    triggerHaptic('success');
    setShowFinishConfirm(false);
    setSaveError(null);

    setIsSaving(true);
    isSavingRef.current = true;

    try {
      // Transform ActiveExercise[] to WorkoutExercise[] for saving
      const workoutExercises: WorkoutExercise[] = completedExercises.map(
        (ex: ActiveExercise, index: number) => ({
          id: ex.id || `ex_${index}`,
          exerciseId: ex.id || `exercise_${index}`,
          exerciseName: ex.name || 'Unknown Exercise',
          targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
          sets: (ex.sets ?? [])
            .filter((s) => s.completedAt)
            .map((s) => ({ ...s, isCompleted: !!s.completedAt })),
          notes: '',
          restSeconds: ex.defaultRestTime || ex.targetRestTime || 90,
          isCompleted: true,
          order: index,
          // Additional fields for display
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          tempo: ex.tempo,
          targetRestTime: ex.targetRestTime,
        })
      );

      const sessionDurationSec = Math.floor(
        (Date.now() - state.startTimestamp - state.totalPausedTime) / 1000
      );
      const sessionTotalVolume = workoutExercises.reduce(
        (sum, ex) => sum + ex.sets.reduce((setSum, s) => setSum + setVolume(s), 0),
        0
      );
      // Calorie burn estimate (rough; conservative for resistance training):
      //   ~0.04 kcal per kg of total volume + ~5 kcal per minute baseline.
      // Saturate at the sensible upper bound (1500 kcal for one session).
      const minutes = Math.max(0, sessionDurationSec / 60);
      const estCalories = Math.min(1500, Math.round(sessionTotalVolume * 0.04 + minutes * 5));

      const session: WorkoutSession = {
        id: `session_${Date.now()}`,
        userId: 'local_user',
        workoutItemId: item?.id || `workout_${Date.now()}`,
        startTime: new Date(state.startTimestamp).toISOString(),
        endTime: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10),
        duration: sessionDurationSec,
        status: 'completed',
        templateId: null,
        notes: '',
        rating: null,
        totalVolume: sessionTotalVolume,
        caloriesBurned: estCalories > 0 ? estCalories : null,
        goalType: workoutSettings.defaultWorkoutGoal as string,
        exercises: workoutExercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveWorkoutSession(session);

      // Best-effort verification — log but don't fail the save
      try {
        const { getWorkoutSessions } = await import('../../../services/dataService');
        const savedSessions = await getWorkoutSessions(1);
        const verified = savedSessions.some((s) => s.id === session.id);
        if (!verified) {
          logger.workout?.warn?.('Workout save verification could not confirm — proceeding anyway');
        }
      } catch (verifyError) {
        logger.workout?.warn?.('Workout save verification read failed (non-fatal)', verifyError);
      }

      // Mark workout as completed in localStorage to prevent restore loop
      // This is a safety measure in case the summary doesn't close properly
      const saved = localStorage.getItem('active_workout_v3_state');
      if (saved) {
        try {
          const parsed = safeJsonParse<Record<string, unknown>>(saved);
          if (parsed) {
            parsed._completed = true;
            localStorage.setItem('active_workout_v3_state', JSON.stringify(parsed));
          }
        } catch {
          // If parsing fails, continue anyway
        }
      }

      // Don't delete yet! Wait until summary is closed.
      // keeping the item active allows this component to stay mounted so Summary can be shown.

      setCompletedSession(session);
      setShowSummary(true);
    } catch (e) {
      // Show user-friendly error message via UI instead of console
      const errorMessage = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveError(`שגיאה בשמירת האימון: ${errorMessage}`);
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [
    finishIntent,
    state,
    workoutSettings.defaultWorkoutGoal,
    onExit,
    item?.id,
    setShowFinishConfirm,
  ]);

  return {
    showSummary,
    setShowSummary,
    completedSession,
    setCompletedSession,
    isSaving,
    saveError,
    setSaveError,
    handleConfirmFinish,
  };
}
