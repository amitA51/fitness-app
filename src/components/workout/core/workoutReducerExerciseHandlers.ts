import { DEFAULT_SUPERSET_ROUND_REST } from './workoutReducerHelpers';
import type { SupersetGroup, WorkoutAction, WorkoutState } from './workoutTypes';

/**
 * English (canonical) side of a bilingual "Hebrew | English" label, used as the
 * exercise identity for PR/ghost lookups. Mirrors programService.englishOf but
 * inlined to keep the reducer free of the program-data import graph.
 */
const englishOfLabel = (label: string): string => {
  const idx = label.lastIndexOf('|');
  return idx >= 0 ? label.slice(idx + 1).trim() : label.trim();
};

// ============================================================
// EXERCISE SLICE
// ============================================================

export const exerciseReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'ADD_EXERCISE': {
      const exerciseName = action.payload?.name?.trim();
      if (!exerciseName) return;
      draft.exercises.push({ ...action.payload, name: exerciseName });
      draft.currentExerciseIndex = draft.exercises.length - 1;
      draft.showExerciseSelector = false;
      draft.showQuickForm = false;
      break;
    }

    case 'REMOVE_EXERCISE': {
      const removedIdx = action.payload;
      // Capture the removed exercise's id BEFORE splicing so we can prune it
      // from any superset/giant-set group it belonged to.
      const removedId = draft.exercises[removedIdx]?.id;
      draft.exercises.splice(removedIdx, 1);

      // Prune the orphan id from every group, then drop degenerate (<2 member)
      // groups — mirrors CREATE_SUPERSET's cleanup so a superset can't be left
      // pointing at a deleted exercise.
      if (removedId) {
        draft.supersetGroups = draft.supersetGroups
          .map((g) => ({ ...g, exercises: g.exercises.filter((id) => id !== removedId) }))
          .filter((g) => g.exercises.length >= 2);
      }

      // Keep the active exercise stable: deleting a position at or before the
      // active one shifts later exercises down, so decrement to follow it.
      if (draft.currentExerciseIndex > removedIdx) {
        draft.currentExerciseIndex -= 1;
      }
      if (draft.currentExerciseIndex >= draft.exercises.length) {
        draft.currentExerciseIndex = Math.max(0, draft.exercises.length - 1);
      }
      break;
    }

    case 'REORDER_EXERCISES': {
      // Preserve the active exercise by identity across the reorder. Capture its
      // id first, replace the array, then re-resolve its new position. The
      // `.filter` can shorten the array (dropping unnamed exercises), so clamp
      // the fallback index to stay in bounds and avoid an undefined active card.
      const activeId = draft.exercises[draft.currentExerciseIndex]?.id;
      draft.exercises = action.payload.filter((ex) => ex.name?.trim());
      const newIdx = activeId ? draft.exercises.findIndex((e) => e.id === activeId) : -1;
      draft.currentExerciseIndex =
        newIdx !== -1
          ? newIdx
          : Math.min(draft.currentExerciseIndex, Math.max(0, draft.exercises.length - 1));
      break;
    }

    case 'CHANGE_EXERCISE': {
      draft.currentExerciseIndex = action.payload;
      break;
    }

    case 'RENAME_EXERCISE': {
      const { index, name } = action.payload;
      const exercise = draft.exercises[index];
      if (exercise && name.trim()) {
        exercise.name = name.trim();
      }
      break;
    }

    case 'UPDATE_EXERCISE_META': {
      const { index, muscleGroup, tempo, targetRestTime, tutorialText } = action.payload;
      const exercise = draft.exercises[index];
      if (exercise) {
        if (muscleGroup !== undefined) exercise.muscleGroup = muscleGroup;
        if (tempo !== undefined) exercise.tempo = tempo;
        if (targetRestTime !== undefined) exercise.targetRestTime = targetRestTime;
        if (tutorialText !== undefined) exercise.tutorialText = tutorialText;
      }
      break;
    }

    case 'SET_EXERCISES': {
      draft.exercises = action.payload.filter((ex) => ex.name?.trim());
      break;
    }

    case 'CREATE_SUPERSET': {
      const { exerciseIds, restBetweenRounds } = action.payload;

      // De-duplicate and keep only ids that map to real exercises. Supports
      // 2 (superset) and 3+ (giant set). Preserves the caller's ordering, which
      // defines the round-robin order used by COMPLETE_SET.
      const uniqueIds = [...new Set(exerciseIds)].filter((id) =>
        draft.exercises.some((e) => e.id === id)
      );
      if (uniqueIds.length < 2) return;

      // Prevent overlapping groups: strip these exercises out of any existing
      // group first, then drop groups that fall below 2 members (degenerate).
      draft.supersetGroups = draft.supersetGroups
        .map((g) => ({ ...g, exercises: g.exercises.filter((id) => !uniqueIds.includes(id)) }))
        .filter((g) => g.exercises.length >= 2);

      const superset: SupersetGroup = {
        id: `superset-${Date.now()}`,
        exercises: uniqueIds,
        restBetweenRounds: restBetweenRounds || DEFAULT_SUPERSET_ROUND_REST,
      };

      draft.supersetGroups.push(superset);
      break;
    }

    case 'REMOVE_SUPERSET': {
      const { exerciseId } = action.payload;
      draft.supersetGroups = draft.supersetGroups.filter((g) => !g.exercises.includes(exerciseId));
      break;
    }

    case 'SWAP_EXERCISE': {
      // Replace the live exercise's MOVEMENT only. The prescription (sets, reps,
      // RPE target, rest, technique, notes, programExtras) is preserved — just
      // the name/identity changes — so a swap mid-workout keeps the plan intact.
      const { exerciseId, newName, libraryMeta } = action.payload;
      const idx = draft.exercises.findIndex((e) => e.id === exerciseId);
      if (idx === -1) return;
      const exercise = draft.exercises[idx];
      if (!exercise) return;

      const previousName = exercise.name ?? exercise.exerciseName ?? '';
      const trimmed = newName.trim();
      if (!trimmed || trimmed === previousName) return;

      // A logged WORKING set belongs to the ORIGINAL movement. Renaming now would
      // re-attribute that set — and any PR / ghost-seed it drives, which key on
      // exerciseName — to the new exercise, silently corrupting history. Refuse
      // the swap once a working set is logged. Warmups are movement-agnostic
      // ramp-ups, so they don't block it. (The UI also hides the "חלופות" chip
      // after the first working set, so this is the defense-in-depth guard.)
      const hasLoggedWorkingSet = (exercise.sets ?? []).some((s) => s.completedAt && !s.isWarmup);
      if (hasLoggedWorkingSet) return;

      // Rebuild the alternatives list: drop the chosen movement and add the
      // previous one back to the FRONT, so the user can always swap back. The
      // list is de-duplicated and stripped of empties; order is otherwise kept.
      const prevAlternatives = exercise.programExtras?.alternatives ?? [];
      const nextAlternatives = [
        previousName,
        ...prevAlternatives.filter((a) => a !== trimmed && a !== previousName),
      ].filter((a) => a.length > 0);

      exercise.name = trimmed;
      exercise.exerciseName = trimmed;
      exercise.exerciseId = englishOfLabel(trimmed);
      // A library swap carries the chosen movement's catalog metadata so the
      // muscle map, equipment badge, tutorial steps and analytics follow the new
      // movement. The new movement's reference data REPLACES the old wholesale —
      // clearing a field the new movement lacks rather than leaving the prior
      // movement's value stale (the muscle map's secondaries, the equipment badge
      // and the tutorial instructions otherwise belong to the replaced movement).
      // muscleGroup is the analytics/grouping anchor, so keep the old one only if
      // the new movement somehow lacks it. Preset swaps omit libraryMeta and keep
      // the original targeting + guidance entirely.
      if (libraryMeta) {
        if (libraryMeta.muscleGroup) exercise.muscleGroup = libraryMeta.muscleGroup;
        exercise.targetMuscle = libraryMeta.targetMuscle;
        exercise.secondaryMuscles = libraryMeta.secondaryMuscles;
        exercise.equipment = libraryMeta.equipment;
        exercise.tutorialText = libraryMeta.tutorialText;
        exercise.instructions = libraryMeta.instructions;
      }
      if (exercise.programExtras) {
        exercise.programExtras.alternatives = nextAlternatives;
      }
      break;
    }
  }
};
