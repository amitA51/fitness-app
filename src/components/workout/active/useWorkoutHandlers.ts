import { useCallback } from 'react';
import type { Exercise, WorkoutSettings } from '../../../types';
import { playSuccess } from '../../../utils/audio';
import { triggerHaptic } from '../../../utils/haptics';
import { useWorkoutDispatch } from '../core/WorkoutContext';

interface UseWorkoutHandlersOptions {
  currentExerciseIndex: number;
  exercisesLength: number;
  personalExerciseLibrary: Array<{
    name?: string;
    muscleGroup?: string;
    tempo?: string;
    defaultRestTime?: number;
    tutorialText?: string;
  }>;
  workoutSettings: Partial<WorkoutSettings>;
  currentExerciseName: string;
  setFinishIntent: (intent: 'finish' | 'cancel') => void;
  setShowFinishConfirm: (show: boolean) => void;
  setSaveError: (err: string | null) => void;
  pendingTimeouts: React.MutableRefObject<ReturnType<typeof setTimeout>[]>;
}

export function useWorkoutHandlers({
  currentExerciseIndex,
  exercisesLength,
  personalExerciseLibrary,
  workoutSettings,
  currentExerciseName,
  setFinishIntent,
  setShowFinishConfirm,
  setSaveError,
  pendingTimeouts,
}: UseWorkoutHandlersOptions) {
  const dispatch = useWorkoutDispatch();

  const handleUpdateSet = useCallback(
    (field: 'weight' | 'reps', value: number) => {
      triggerHaptic('light');
      dispatch({ type: 'UPDATE_SET', payload: { field, value } });
    },
    [dispatch]
  );

  const handleCompleteSet = useCallback(() => {
    triggerHaptic('success');
    playSuccess();
    dispatch({ type: 'COMPLETE_SET' });
  }, [dispatch]);

  const handleOpenNumpad = useCallback(
    (target: 'weight' | 'reps') => {
      triggerHaptic('light');
      dispatch({ type: 'OPEN_NUMPAD', payload: target });
    },
    [dispatch]
  );

  const handleAddSet = useCallback(() => {
    triggerHaptic('light');
    dispatch({ type: 'ADD_SET' });
  }, [dispatch]);

  const handleUndoSet = useCallback(() => {
    triggerHaptic('medium');
    dispatch({ type: 'UNDO_LAST_SET' });
  }, [dispatch]);

  const handleUpdateRPE = useCallback(
    (rpe: number | null) => {
      if (rpe !== null) triggerHaptic('light');
      dispatch({ type: 'UPDATE_SET_RPE', payload: rpe ?? undefined });
    },
    [dispatch]
  );

  const handleToggleTechnique = useCallback(
    (technique: 'warmup' | 'dropSet' | 'failure' | 'restPause', value: boolean) => {
      dispatch({ type: 'SET_TECHNIQUE', payload: { technique, value } });
    },
    [dispatch]
  );

  const handleOpenPlateCalc = useCallback(() => {
    dispatch({ type: 'OPEN_PLATE_CALC' });
  }, [dispatch]);

  const handleClosePlateCalc = useCallback(() => {
    dispatch({ type: 'CLOSE_PLATE_CALC' });
  }, [dispatch]);

  const handleUpdateNotes = useCallback(
    (notes: string) => {
      dispatch({ type: 'UPDATE_SET_NOTES', payload: notes });
    },
    [dispatch]
  );

  const handleEditSet = useCallback(
    (setIndex: number, updates: { weight?: number; reps?: number }) => {
      dispatch({
        type: 'EDIT_SPECIFIC_SET',
        payload: { exerciseIndex: currentExerciseIndex, setIndex, updates },
      });
    },
    [dispatch, currentExerciseIndex]
  );

  const handleEditSetInList = useCallback(
    (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number }) => {
      dispatch({
        type: 'EDIT_SPECIFIC_SET',
        payload: { exerciseIndex, setIndex, updates },
      });
    },
    [dispatch]
  );

  const handleDeleteSet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      dispatch({ type: 'DELETE_SET', payload: { exerciseIndex, setIndex } });
    },
    [dispatch]
  );

  const handleRenameExercise = useCallback(
    (name: string) => {
      dispatch({ type: 'RENAME_EXERCISE', payload: { index: currentExerciseIndex, name } });
      const match = personalExerciseLibrary.find((pe) => pe.name === name);
      if (match) {
        dispatch({
          type: 'UPDATE_EXERCISE_META',
          payload: {
            index: currentExerciseIndex,
            muscleGroup: match.muscleGroup,
            tempo: match.tempo,
            targetRestTime: match.defaultRestTime,
            tutorialText: match.tutorialText,
          },
        });
      }
    },
    [dispatch, currentExerciseIndex, personalExerciseLibrary]
  );

  const handleFinishRequest = useCallback(() => {
    triggerHaptic('light');
    setFinishIntent('finish');
    const pref = workoutSettings.cooldownPreference || 'ask';
    if (pref === 'always') {
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
      return;
    }
    setShowFinishConfirm(true);
  }, [dispatch, workoutSettings.cooldownPreference, setFinishIntent, setShowFinishConfirm]);

  const handleDiscardRequest = useCallback(() => {
    triggerHaptic('light');
    setFinishIntent('cancel');
    setShowFinishConfirm(true);
  }, [setFinishIntent, setShowFinishConfirm]);

  const handleChangeExercise = useCallback(
    (idx: number) => {
      dispatch({ type: 'CHANGE_EXERCISE', payload: idx });
    },
    [dispatch]
  );

  const handleNextExercise = useCallback(() => {
    if (currentExerciseIndex < exercisesLength - 1) {
      triggerHaptic('light');
      dispatch({ type: 'CHANGE_EXERCISE', payload: currentExerciseIndex + 1 });
    }
  }, [dispatch, currentExerciseIndex, exercisesLength]);

  const handleOpenDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: true });
  }, [dispatch]);

  const handleCloseDrawer = useCallback(() => {
    dispatch({ type: 'TOGGLE_DRAWER', payload: false });
  }, [dispatch]);

  const handleCloseSelector = useCallback(() => {
    dispatch({ type: 'CLOSE_SELECTOR' });
  }, [dispatch]);

  const handleAddExercise = useCallback(
    (ex: Exercise) => {
      dispatch({ type: 'ADD_EXERCISE', payload: ex });
    },
    [dispatch]
  );

  const handleSkipRest = useCallback(() => {
    dispatch({ type: 'SKIP_REST' });
  }, [dispatch]);

  const handleAddRestTime = useCallback(
    (seconds: number) => {
      dispatch({ type: 'ADD_REST_TIME', payload: seconds });
    },
    [dispatch]
  );

  const handleNumpadInput = useCallback(
    (digit: string) => {
      dispatch({ type: 'NUMPAD_INPUT', payload: digit });
    },
    [dispatch]
  );

  const handleNumpadSetValue = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_NUMPAD_VALUE', payload: value });
    },
    [dispatch]
  );

  const handleNumpadDelete = useCallback(() => {
    dispatch({ type: 'NUMPAD_DELETE' });
  }, [dispatch]);

  const handleNumpadSubmit = useCallback(() => {
    dispatch({ type: 'NUMPAD_SUBMIT' });
  }, [dispatch]);

  const handleCloseNumpad = useCallback(() => {
    dispatch({ type: 'CLOSE_NUMPAD' });
  }, [dispatch]);

  const handleCloseSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS', payload: false });
  }, [dispatch]);

  const handleUpdateSetting = useCallback(
    (key: string, value: unknown) => {
      dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    },
    [dispatch]
  );

  const handleOpenSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS', payload: true });
  }, [dispatch]);

  const handleOpenTutorial = useCallback(() => {
    dispatch({ type: 'SHOW_TUTORIAL', payload: currentExerciseName });
  }, [dispatch, currentExerciseName]);

  const handleReorderExercises = useCallback(
    (newOrder: Exercise[]) => {
      dispatch({ type: 'REORDER_EXERCISES', payload: newOrder });
    },
    [dispatch]
  );

  const handleSelectExerciseFromList = useCallback(
    (idx: number) => {
      dispatch({ type: 'CHANGE_EXERCISE', payload: idx });
      dispatch({ type: 'TOGGLE_DRAWER', payload: false });
    },
    [dispatch]
  );

  const handleRemoveExercise = useCallback(
    (idx: number) => {
      dispatch({ type: 'REMOVE_EXERCISE', payload: idx });
    },
    [dispatch]
  );

  const handleOpenQuickForm = useCallback(() => {
    dispatch({ type: 'OPEN_QUICK_FORM' });
  }, [dispatch]);

  const handleCloseQuickForm = useCallback(() => {
    dispatch({ type: 'CLOSE_QUICK_FORM' });
  }, [dispatch]);

  const handleCancelFinish = useCallback(() => {
    setShowFinishConfirm(false);
    setSaveError(null);
  }, [setShowFinishConfirm, setSaveError]);

  const handleCooldownFromFinish = useCallback(() => {
    setShowFinishConfirm(false);
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: true } });
  }, [dispatch, setShowFinishConfirm]);

  const handleCloseGoalSelector = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });
  }, [dispatch]);

  const handleWarmupComplete = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
    if (exercisesLength === 0) {
      pendingTimeouts.current.push(setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300));
    }
  }, [dispatch, exercisesLength, pendingTimeouts]);

  const handleWarmupSkip = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: false } });
    if (exercisesLength === 0) {
      pendingTimeouts.current.push(setTimeout(() => dispatch({ type: 'OPEN_SELECTOR' }), 300));
    }
  }, [dispatch, exercisesLength, pendingTimeouts]);

  const handleCooldownComplete = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: false } });
    setFinishIntent('finish');
    setShowFinishConfirm(true);
  }, [dispatch, setFinishIntent, setShowFinishConfirm]);

  const handleCooldownSkip = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'cooldown', isOpen: false } });
    setFinishIntent('finish');
    setShowFinishConfirm(true);
  }, [dispatch, setFinishIntent, setShowFinishConfirm]);

  const handleCloseTutorial = useCallback(() => {
    dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'tutorial', isOpen: false } });
  }, [dispatch]);

  const handleCloseAICoach = useCallback(() => {
    dispatch({ type: 'CLOSE_AI_COACH' });
  }, [dispatch]);

  const handleOpenSelector = useCallback(() => {
    dispatch({ type: 'OPEN_SELECTOR' });
  }, [dispatch]);

  const handleGoalSelect = useCallback(
    (goal: import('../../../types').WorkoutGoal) => {
      triggerHaptic('medium');
      dispatch({ type: 'UPDATE_SETTINGS', payload: { defaultWorkoutGoal: goal } });
      dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'goal', isOpen: false } });
      const warmupPreference = workoutSettings.warmupPreference || 'ask';
      if (warmupPreference === 'always' || warmupPreference === 'ask') {
        pendingTimeouts.current.push(
          setTimeout(() => {
            dispatch({ type: 'SET_MODAL_STATE', payload: { modal: 'warmup', isOpen: true } });
          }, 300)
        );
      }
    },
    [dispatch, workoutSettings.warmupPreference, pendingTimeouts]
  );

  return {
    handleUpdateSet,
    handleCompleteSet,
    handleAddSet,
    handleOpenNumpad,
    handleUndoSet,
    handleUpdateRPE,
    handleToggleTechnique,
    handleOpenPlateCalc,
    handleClosePlateCalc,
    handleUpdateNotes,
    handleEditSet,
    handleEditSetInList,
    handleDeleteSet,
    handleRenameExercise,
    handleFinishRequest,
    handleDiscardRequest,
    handleChangeExercise,
    handleNextExercise,
    handleOpenDrawer,
    handleCloseDrawer,
    handleCloseSelector,
    handleAddExercise,
    handleSkipRest,
    handleAddRestTime,
    handleNumpadInput,
    handleNumpadSetValue,
    handleNumpadDelete,
    handleNumpadSubmit,
    handleCloseNumpad,
    handleCloseSettings,
    handleUpdateSetting,
    handleOpenSettings,
    handleOpenTutorial,
    handleReorderExercises,
    handleSelectExerciseFromList,
    handleRemoveExercise,
    handleOpenQuickForm,
    handleCloseQuickForm,
    handleCancelFinish,
    handleCooldownFromFinish,
    handleCloseGoalSelector,
    handleWarmupComplete,
    handleWarmupSkip,
    handleCooldownComplete,
    handleCooldownSkip,
    handleCloseTutorial,
    handleCloseAICoach,
    handleOpenSelector,
    handleGoalSelect,
  };
}
