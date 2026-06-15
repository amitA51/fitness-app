import {
  DEFAULT_SUPERSET_ROUND_REST,
  SUPERSET_TRANSITION_REST,
  calculateRestTime,
  createEmptySet,
  createNextSet,
  getActiveSetIndex,
} from './workoutReducerHelpers';
import type { WorkoutAction, WorkoutState } from './workoutTypes';

// ============================================================
// SET SLICE
// ============================================================

export const setReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  const exercise = draft.exercises[draft.currentExerciseIndex];
  // No blanket early return: EDIT_SPECIFIC_SET/DELETE_SET target an exercise by
  // action.payload.exerciseIndex and must work even when currentExerciseIndex is
  // invalid. Cases that read the active exercise guard with `if (!exercise) return;`.

  switch (action.type) {
    case 'UPDATE_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;

      const activeSet = sets[activeIdx]!;
      sets[activeIdx]!.reps =
        action.payload.field === 'reps' ? action.payload.value : activeSet.reps;
      sets[activeIdx]!.weight =
        action.payload.field === 'weight' ? action.payload.value : activeSet.weight;
      break;
    }

    case 'COMPLETE_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      // Guard against junk sets: when the exercise already has sets and every
      // one is completed, resolveActiveSet returns a virtual index at
      // sets.length. Completing "again" must NOT fabricate an empty 0×0 set
      // (a common path now that auto-add-sets defaults off). The exercise is
      // done — the user must press "הוסף סט" (ADD_SET) to train more. The
      // genuinely-empty case (no planned sets) still creates the first set.
      if (sets.length > 0 && activeIdx >= sets.length) return;
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;

      const currentSet = sets[activeIdx]!;
      if (!currentSet) return;

      currentSet.completedAt = new Date().toISOString();
      currentSet.isCompleted = true;

      // --- CARRY WEIGHT FORWARD ---
      // Sets in an exercise usually share a weight, so pre-fill the next
      // still-empty set with what was just logged — the user only adjusts what
      // changed instead of retyping. Rules:
      //   • only seed an UNTOUCHED set (weight 0, not completed) — never clobber
      //     a value the user already entered or a set they already logged;
      //   • carry like-for-like (working→working, warmup→warmup): warmups are
      //     lighter ramp-ups, so a working weight must not leak into a warmup or
      //     vice-versa;
      //   • only the immediate next matching set — it cascades naturally as each
      //     subsequent set is completed.
      // (ADD_SET already seeds newly-appended sets via createNextSet; this covers
      // the pre-existing template/program sets.)
      if ((currentSet.weight ?? 0) > 0 || (currentSet.reps ?? 0) > 0) {
        for (let i = activeIdx + 1; i < sets.length; i++) {
          const nextSet = sets[i];
          if (!nextSet || nextSet.completedAt) continue;
          if ((nextSet.isWarmup ?? false) !== (currentSet.isWarmup ?? false)) continue;
          if ((nextSet.weight ?? 0) === 0 && (currentSet.weight ?? 0) > 0) {
            nextSet.weight = currentSet.weight;
          }
          if ((nextSet.reps ?? 0) === 0 && (currentSet.reps ?? 0) > 0) {
            nextSet.reps = currentSet.reps;
          }
          break;
        }
      }

      // --- SUPERSET MEMBERSHIP / ROUND TRANSITION (computed BEFORE auto-add) ---
      // Round-robin model (the just-completed set is already marked above):
      //   • Find the next group exercise (after this one, wrapping) that still
      //     has an incomplete set — that's where we go next.
      //   • If it lies AFTER us in group order → same round → short transition
      //     rest (SUPERSET_TRANSITION_REST).
      //   • If we wrapped back to it (≤ our position) → a NEW round started →
      //     use the group's restBetweenRounds.
      //   • If no group exercise has an incomplete set → the whole group is
      //     done → no advance, normal rest applies.
      // Detecting a transition up front also lets us skip auto-adding a trailing
      // set to the exercise we're leaving (which would leak an empty set there).
      const supersetMembership = draft.supersetGroups.find((g) =>
        g.exercises.includes(exercise.id)
      );
      let supersetShortRest: number | null = null;
      let isSupersetTransition = false;
      let nextSupersetIdx = -1;
      if (supersetMembership) {
        const groupExercises = supersetMembership.exercises;
        const n = groupExercises.length;
        const curPos = groupExercises.indexOf(exercise.id);

        let targetExerciseId: string | null = null;
        let wrappedToNewRound = false;
        for (let step = 1; step <= n; step++) {
          const pos = (curPos + step) % n;
          const candidateId = groupExercises[pos];
          const candidate = draft.exercises.find((e) => e.id === candidateId);
          if (!candidate) continue;
          const hasIncompleteSet = (candidate.sets ?? []).some((s) => !s.completedAt);
          if (hasIncompleteSet) {
            targetExerciseId = candidateId ?? null;
            wrappedToNewRound = pos <= curPos;
            break;
          }
        }

        if (targetExerciseId) {
          const targetIdx = draft.exercises.findIndex((e) => e.id === targetExerciseId);
          if (targetIdx !== -1) {
            isSupersetTransition = true;
            nextSupersetIdx = targetIdx;
            supersetShortRest = wrappedToNewRound
              ? (supersetMembership.restBetweenRounds ?? DEFAULT_SUPERSET_ROUND_REST)
              : SUPERSET_TRANSITION_REST;
          }
        }
        // else: group fully complete → leave supersetShortRest null (normal rest)
        // and do not advance.
      }

      // --- AUTO INCREMENT WEIGHT (Progressive Overload) ---
      // If this is the last set and auto-increment is on
      const settings = draft.appSettings?.workoutSettings;
      const shouldIncrement = settings?.autoIncrementWeight || settings?.enableProgressiveOverload;
      const incrementAmount = settings?.weightIncrementAmount || 2.5;

      // --- AUTO ADD NEXT SET ---
      // Only when the user opted into the legacy "infinite sets" flow. By default
      // (autoAddSets !== true) the set count stays fixed to what the user/template
      // defined; extra sets are added manually via ADD_SET. Always skip during a
      // superset transition — the active exercise is changing, so a trailing set
      // here would just leak.
      const autoAddSets = settings?.autoAddSets === true;
      if (autoAddSets && activeIdx === sets.length - 1 && !isSupersetTransition) {
        const nextSet = createNextSet(currentSet, sets.length + 1, exercise.isTimed);
        nextSet.autoGenerated = true;

        // Apply auto-increment if enabled
        if (shouldIncrement && nextSet.weight) {
          nextSet.weight += incrementAmount;
        }

        sets.push(nextSet);
      }

      // --- SUPERSET AUTO-ADVANCE (apply the transition computed above) ---
      if (isSupersetTransition) {
        draft.currentExerciseIndex = nextSupersetIdx;
      }

      // --- AUTO ADVANCE EXERCISE ---
      // When enabled, completing the LAST open set of an exercise jumps to the
      // next exercise that still has an open set (round-robin, wrapping). Only
      // fires when there are no open sets left here — so it never interrupts a
      // user mid-exercise — and never during a superset transition (the group
      // logic already drives navigation). In legacy infinite-set mode
      // (autoAddSets), a fresh set was just appended, so the exercise is never
      // "done" and this stays inert by design.
      if (settings?.autoAdvanceExercise && !isSupersetTransition) {
        const exerciseDone = sets.length > 0 && sets.every((s) => s.completedAt);
        if (exerciseDone) {
          const total = draft.exercises.length;
          for (let step = 1; step <= total; step++) {
            const idx = (draft.currentExerciseIndex + step) % total;
            const candidate = draft.exercises[idx];
            if (candidate && (candidate.sets ?? []).some((s) => !s.completedAt)) {
              draft.currentExerciseIndex = idx;
              break;
            }
          }
        }
      }

      // --- REST TIMER ---
      const shouldStartRest = settings?.autoStartRest ?? true; // Default to true

      if (shouldStartRest) {
        const restTime = calculateRestTime(
          settings,
          exercise,
          supersetShortRest,
          currentSet.isDropSet ?? false
        );

        if (restTime > 0) {
          draft.restTimer = {
            active: true,
            endTime: Date.now() + restTime * 1000,
            totalTime: restTime,
            timeLeft: restTime,
          };
        }
      }

      // Haptic feedback
      if (settings?.hapticsEnabled) {
        draft.pendingHaptic = 'SET_COMPLETE';
      }

      // Confetti is NOT fired here. Mere set completion is not a PR; confetti is
      // gated on an actual PR via the SHOW_PR_CELEBRATION handler (honoring
      // prCelebrationIntensity), which is dispatched only when a record is set.
      break;
    }

    case 'ADD_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      // Seed the new set from the last existing one (weight/reps carry over) so
      // the user only adjusts what changed. Falls back to an empty set when the
      // exercise has none yet.
      const lastSet = sets[sets.length - 1];
      const newSet = lastSet
        ? createNextSet(lastSet, sets.length + 1, exercise.isTimed)
        : createEmptySet(sets.length + 1, exercise.isTimed);
      newSet.isCompleted = false;
      newSet.completedAt = null;
      sets.push(newSet);
      exercise.sets = sets;
      break;
    }

    case 'UNDO_LAST_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      let lastCompletedIndex = -1;
      for (let i = sets.length - 1; i >= 0; i--) {
        if (sets[i]?.completedAt) {
          lastCompletedIndex = i;
          break;
        }
      }

      if (lastCompletedIndex !== -1) {
        const setToUndo = sets[lastCompletedIndex];
        if (setToUndo) {
          setToUndo.completedAt = null;
          setToUndo.isCompleted = false;
        }

        // Remove any auto-generated set that follows (orphan from auto-increment)
        const nextSet = sets[lastCompletedIndex + 1];
        if (
          nextSet &&
          !nextSet.completedAt &&
          (nextSet.autoGenerated ||
            (nextSet.weight === 0 && nextSet.reps === 0 && (nextSet.duration ?? 0) === 0))
        ) {
          sets.splice(lastCompletedIndex + 1, 1);
        }

        // Stop timer and effects
        draft.restTimer = {
          active: false,
          endTime: null,
          totalTime: 0,
          timeLeft: 0,
        };
        draft.pendingHaptic = null;
        draft.showConfetti = false;
      }
      break;
    }

    case 'UPDATE_SET_NOTES': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (activeIdx < 0 || !sets[activeIdx]) return;
      sets[activeIdx]!.notes = action.payload ?? '';
      break;
    }

    case 'UPDATE_SET_RPE': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (activeIdx < 0 || !sets[activeIdx]) return;
      sets[activeIdx]!.rpe = action.payload ?? null;
      break;
    }

    case 'UPDATE_SET_RPE_TAG': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (activeIdx < 0 || !sets[activeIdx]) return;
      sets[activeIdx]!.rpeTag = action.payload;
      break;
    }

    case 'SET_TECHNIQUE': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;
      const target = sets[activeIdx]!;
      const { technique, value } = action.payload;
      if (technique === 'warmup') target.isWarmup = value;
      else if (technique === 'dropSet') target.isDropSet = value;
      else if (technique === 'failure') target.isFailure = value;
      else if (technique === 'restPause') target.isRestPause = value;
      break;
    }

    case 'EDIT_SPECIFIC_SET': {
      const { exerciseIndex, setIndex, updates } = action.payload;
      const targetExercise = draft.exercises[exerciseIndex];
      if (!targetExercise) return;
      const targetSets = targetExercise.sets ?? [];
      if (!targetSets[setIndex]) return;

      const targetSet = targetSets[setIndex]!;
      if (updates.weight !== undefined) targetSet.weight = updates.weight;
      if (updates.reps !== undefined) targetSet.reps = updates.reps;
      break;
    }

    case 'DELETE_SET': {
      const { exerciseIndex, setIndex, token } = action.payload;
      const targetExercise = draft.exercises[exerciseIndex];
      if (!targetExercise) return;
      const targetSets = targetExercise.sets ?? [];
      const removed = targetSets[setIndex];
      if (!removed) return;

      // Don't allow deleting the last set. Refusal leaves lastDeletedSet
      // untouched — callers must not offer an undo for a delete that never
      // happened (the handler mirrors this guard before dispatching).
      if (targetSets.length <= 1) return;

      // Snapshot before removal so RESTORE_DELETED_SET can re-insert it at the
      // same index. One-deep buffer — each delete overwrites the prior snapshot.
      // Key by exerciseId (stable across reorders), falling back to index.
      draft.lastDeletedSet = {
        exerciseId: targetExercise.id ?? String(exerciseIndex),
        setIndex,
        set: { ...removed },
        token: token ?? null,
      };

      targetSets.splice(setIndex, 1);
      break;
    }

    case 'RESTORE_DELETED_SET': {
      const snapshot = draft.lastDeletedSet;
      if (!snapshot) return;

      // Token mismatch: the undo belongs to an OLDER deletion whose snapshot
      // was already overwritten — restoring would resurrect the wrong set.
      const requestedToken = action.payload?.token;
      if (requestedToken && snapshot.token && requestedToken !== snapshot.token) return;

      // Resolve the exercise by its stable id, falling back to the recorded
      // index if the id can't be matched (e.g. legacy exercises without ids).
      const targetExercise =
        draft.exercises.find((e) => e.id === snapshot.exerciseId) ??
        draft.exercises[Number(snapshot.exerciseId)];
      if (!targetExercise) {
        draft.lastDeletedSet = null;
        return;
      }

      const targetSets = targetExercise.sets ?? [];
      // Clamp the insert index — the list may have shrunk/grown since deletion.
      const insertAt = Math.min(Math.max(0, snapshot.setIndex), targetSets.length);
      targetSets.splice(insertAt, 0, { ...snapshot.set });
      targetExercise.sets = targetSets;

      // One-deep buffer: consume the snapshot so a second undo is a no-op.
      draft.lastDeletedSet = null;
      break;
    }
  }
};
