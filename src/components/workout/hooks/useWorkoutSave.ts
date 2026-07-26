// useWorkoutSave - Owns the finish/cancel save flow for an active workout.
// Extracted from ActiveWorkoutNew to keep the god-component lean. The hook owns
// the save-related local state (summary visibility, completed session, in-flight
// + error flags) and exposes the confirm-finish handler. The component wires the
// returned state/setters into its overlays exactly as before.
import type React from 'react';
import { useCallback, useRef, useState } from 'react';

import { showToast } from '../../../components/ui/GlobalToast';
import { trackFunnel } from '../../../services/analytics/funnel';
import { saveWorkoutSession } from '../../../services/dataService';
import { persistSessionPRs } from '../../../services/prService';
import { buildWorkoutSession } from '../../../services/workoutSessionBuilder';
import type { PersonalItem, WorkoutSession, WorkoutSettings } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { logger } from '../../../utils/logger';
import { safeJsonParse } from '../../../utils/safeJson';
import type { WorkoutAction, WorkoutState } from '../core/workoutTypes';
import { clearPreviousDataCache } from './usePreviousData';

interface UseWorkoutSaveParams {
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
  workoutSettings: Partial<WorkoutSettings>;
  finishIntent: 'finish' | 'cancel';
  setShowFinishConfirm: (open: boolean) => void;
  item: PersonalItem;
  onExit: () => void;
  /**
   * Template id this workout was started from (undefined for free workouts).
   * Used to attribute a completed session to the built-in program day so the
   * 12-week pointer only advances for a genuine program workout.
   */
  templateId?: string;
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
  dispatch,
  workoutSettings,
  finishIntent,
  setShowFinishConfirm,
  item,
  onExit,
  templateId,
}: UseWorkoutSaveParams): UseWorkoutSaveReturn {
  const [showSummary, setShowSummary] = useState(false);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Latest confirm-finish handler, for the error-toast retry action (the
  // callback identity changes across renders; the toast closure must not
  // capture a stale one).
  const retryFinishRef = useRef<(() => Promise<void>) | null>(null);

  const handleConfirmFinish = useCallback(async () => {
    // Guard against double-tap while a save is already in-flight
    if (isSavingRef.current) return;
    if (finishIntent === 'cancel') {
      setShowFinishConfirm(false);
      setSaveError(null);

      // Discard the persisted draft so it can't be restored. (A `_completed`
      // marker write here would be pointless — the key is removed immediately.)
      localStorage.removeItem('active_workout_v3_state');

      // Stop the provider from re-persisting this (now discarded) workout on
      // unmount / interval / visibility — otherwise it would be restored next time.
      dispatch({ type: 'FINALIZE_WORKOUT' });

      // Call onExit - the overlay will handle removing the item
      onExit();
      return;
    }

    // Validate: Check if there's anything to save BEFORE closing overlay
    const buildResult = buildWorkoutSession({
      exercises: state.exercises,
      startTimestamp: state.startTimestamp,
      totalPausedTime: state.totalPausedTime,
      itemId: item?.id || `workout_${Date.now()}`,
      goalType: workoutSettings.defaultWorkoutGoal ?? 'general',
    });

    if (!buildResult) {
      // No completed sets - show message to user instead of silently exiting
      // Keep overlay open and show error
      setSaveError('לא הושלם אף סט. יש להשלים לפחות סט אחד כדי לשמור.');
      return;
    }

    // The confirm overlay stays OPEN until the save resolves: it owns the
    // isSaving spinner and is the only renderer of saveError. Closing it
    // before the await meant a failed save surfaced its error into an
    // unmounted component — the user saw nothing and assumed the workout
    // was saved.
    setSaveError(null);

    setIsSaving(true);
    isSavingRef.current = true;

    try {
      const session = buildResult.session;

      await saveWorkoutSession(session);

      // Core retention event. Recorded after the save so it can never claim a
      // workout that was not actually persisted.
      trackFunnel('workout_completed', {
        exercises: session.exercises?.length ?? 0,
        durationMinutes: Math.round((session.duration ?? 0) / 60),
      });

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
            // Immutable update — never mutate the parsed object in place.
            localStorage.setItem(
              'active_workout_v3_state',
              JSON.stringify({ ...parsed, _completed: true })
            );
          }
        } catch {
          // If parsing fails, continue anyway
        }
      }

      // Don't delete yet! Wait until summary is closed.
      // keeping the item active allows this component to stay mounted so Summary can be shown.

      // The workout is saved — mark it finalized so the provider stops persisting
      // and clears the snapshot. Without this, the still-mounted provider re-writes
      // the workout to localStorage on unmount and it reappears as "active" next time.
      dispatch({ type: 'FINALIZE_WORKOUT' });

      // Save landed — NOW close the confirm overlay and celebrate.
      triggerHaptic('success');
      setShowFinishConfirm(false);

      // Persist genuine PRs from this session into the personal_records store
      // (cloud-synced inside savePR). Identity is the normalized exercise name
      // and the checker diffs against existing records, so a retry can't
      // duplicate. Never blocks or fails the save.
      try {
        await persistSessionPRs(session);
      } catch (prError) {
        logger.workout?.warn?.('Failed to persist session PRs (non-fatal)', prError);
      }

      // Ghost values cache previous-session sets for up to 5 minutes — drop it
      // so the workout just saved becomes the "previous" data immediately.
      clearPreviousDataCache();

      setCompletedSession(session);
      setShowSummary(true);

      // Best-effort: reconcile a coach-scheduled workout to "done" if this
      // completed session matches one planned for today. Dynamic import keeps
      // the coach service out of the workout bundle; never blocks the save.
      void import('../../../services/coach/scheduleService')
        .then(({ reconcileScheduleOnSessionSave }) =>
          reconcileScheduleOnSessionSave({
            templateId: session.templateId,
            startTime: session.startTime,
            status: session.status,
            id: session.id,
          })
        )
        .catch(() => undefined);

      // Best-effort: advance the built-in 12-week program if this completed
      // session corresponds to a program day the trainee started. Dynamic import
      // keeps the program service out of the workout bundle; never blocks the save.
      void import('../../../services/programService')
        .then(({ reconcileProgramOnSessionSave }) =>
          reconcileProgramOnSessionSave({
            startTime: session.startTime,
            status: session.status,
            id: session.id,
            // session.templateId is always null from the builder, so attribute
            // via the template the runner was launched from instead.
            templateId: templateId ?? session.templateId ?? null,
          })
        )
        .catch(() => undefined);
    } catch (e) {
      // Show user-friendly error message via UI instead of console
      const errorMessage = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveError(`שגיאה בשמירת האימון: ${errorMessage}`);
      // The overlay (still mounted) renders saveError — but the user may
      // backdrop-dismiss it. A toast with a retry action makes the failure
      // impossible to miss either way. The retry re-runs the latest
      // confirm-finish via ref (this callback is recreated across renders).
      showToast('שמירת האימון נכשלה', {
        variant: 'error',
        duration: 8000,
        action: {
          label: 'נסה שוב',
          onClick: () => {
            void retryFinishRef.current?.();
          },
        },
      });
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [
    finishIntent,
    state,
    dispatch,
    workoutSettings.defaultWorkoutGoal,
    onExit,
    item?.id,
    setShowFinishConfirm,
    templateId,
  ]);

  // Keep the retry ref pointing at the latest handler (render-phase assignment,
  // same pattern as sessionRef in WorkoutSummary).
  retryFinishRef.current = handleConfirmFinish;

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
