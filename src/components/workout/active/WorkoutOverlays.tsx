// WorkoutOverlays — thin orchestrator that composes the active-workout overlay
// groups. The 10+ overlays and their 50+ props were split into three scoped
// components by category:
//   • WorkoutInputOverlays    — numpad, plate calculator
//   • WorkoutSettingsOverlays — settings sheet (own error boundary)
//   • WorkoutFlowOverlays     — confirm-exit, drawer, selector, quick-add, goal,
//                               warmup/cooldown, tutorial+AI, saving spinner
//
// This file keeps the ORIGINAL external props contract so ActiveWorkoutNew is
// unchanged. Each group lazy-loads its heavy overlays and only mounts what the
// workout reducer reports as open — closed overlays are no longer in the tree.

import React from 'react';
import type { Exercise, WorkoutGoal, WorkoutSettings } from '../../../types';
import type { NumpadState, SupersetGroup } from '../core/workoutTypes';
import WorkoutFlowOverlays from './WorkoutFlowOverlays';
import WorkoutInputOverlays from './WorkoutInputOverlays';
import WorkoutSettingsOverlays from './WorkoutSettingsOverlays';

interface WorkoutOverlaysProps {
  // Numpad
  numpad: NumpadState;
  onNumpadInput: (digit: string) => void;
  onNumpadSetValue: (value: string) => void;
  onNumpadDelete: () => void;
  onNumpadSubmit: () => void;
  onNumpadSubmitAdvance: () => void;
  onNumpadClear: () => void;
  onCloseNumpad: () => void;
  // Plate calc
  showPlateCalc: boolean;
  onClosePlateCalc: () => void;
  currentSetWeight: number;
  // Confirm exit
  showFinishConfirm: boolean;
  finishIntent: 'finish' | 'cancel';
  workoutStats: {
    completedSets: number;
    totalVolume: number;
    duration: string;
    /** Non-warmup sets with weight/reps entered but not checked — they will NOT be saved. */
    pendingSets?: number;
  };
  onConfirmFinish: () => void;
  onCancelFinish: () => void;
  onCooldownFromFinish: () => void;
  isSaving: boolean;
  saveError: string | null;
  // Settings
  showSettings: boolean;
  workoutSettings: Partial<WorkoutSettings>;
  onCloseSettings: () => void;
  onUpdateSetting: (key: string, value: unknown) => void;
  // Drawer
  isDrawerOpen: boolean;
  exercises: Exercise[];
  currentExerciseIndex: number;
  onReorderExercises: (newOrder: Exercise[]) => void;
  onSelectExerciseFromList: (idx: number) => void;
  onRemoveExercise: (idx: number) => void;
  onEditSetInList: (
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number }
  ) => void;
  onDeleteSet: (exerciseIndex: number, setIndex: number) => void;
  onCloseDrawer: () => void;
  supersetGroups?: SupersetGroup[];
  onCreateSupersetGroup?: (exerciseIds: string[]) => void;
  // Exercise selector
  showExerciseSelector: boolean;
  onAddExercise: (ex: Exercise) => void;
  onCloseSelector: () => void;
  onOpenQuickForm: () => void;
  defaultWorkoutGoal?: WorkoutGoal;
  // Quick form
  showQuickForm: boolean;
  onCloseQuickForm: () => void;
  // Goal selector
  showGoalSelector: boolean;
  onGoalSelect: (goal: WorkoutGoal) => void;
  onCloseGoalSelector: () => void;
  // Warmup/Cooldown
  showWarmup: boolean;
  showCooldown: boolean;
  onWarmupComplete: () => void;
  onWarmupSkip: () => void;
  onCooldownComplete: () => void;
  onCooldownSkip: () => void;
  // Tutorial
  showTutorial: boolean;
  tutorialExercise: string | null;
  tutorialCustomNotes?: string;
  onCloseTutorial: () => void;
  onCloseAICoach: () => void;
}

const WorkoutOverlays: React.FC<WorkoutOverlaysProps> = (props) => (
  <>
    <WorkoutInputOverlays
      numpad={props.numpad}
      onNumpadInput={props.onNumpadInput}
      onNumpadSetValue={props.onNumpadSetValue}
      onNumpadDelete={props.onNumpadDelete}
      onNumpadSubmit={props.onNumpadSubmit}
      onNumpadSubmitAdvance={props.onNumpadSubmitAdvance}
      onNumpadClear={props.onNumpadClear}
      onCloseNumpad={props.onCloseNumpad}
      showPlateCalc={props.showPlateCalc}
      onClosePlateCalc={props.onClosePlateCalc}
      currentSetWeight={props.currentSetWeight}
    />

    <WorkoutSettingsOverlays
      showSettings={props.showSettings}
      workoutSettings={props.workoutSettings}
      onCloseSettings={props.onCloseSettings}
      onUpdateSetting={props.onUpdateSetting}
    />

    <WorkoutFlowOverlays
      showFinishConfirm={props.showFinishConfirm}
      finishIntent={props.finishIntent}
      workoutStats={props.workoutStats}
      onConfirmFinish={props.onConfirmFinish}
      onCancelFinish={props.onCancelFinish}
      onCooldownFromFinish={props.onCooldownFromFinish}
      isSaving={props.isSaving}
      saveError={props.saveError}
      isDrawerOpen={props.isDrawerOpen}
      exercises={props.exercises}
      currentExerciseIndex={props.currentExerciseIndex}
      onReorderExercises={props.onReorderExercises}
      onSelectExerciseFromList={props.onSelectExerciseFromList}
      onRemoveExercise={props.onRemoveExercise}
      onEditSetInList={props.onEditSetInList}
      onDeleteSet={props.onDeleteSet}
      onCloseDrawer={props.onCloseDrawer}
      supersetGroups={props.supersetGroups}
      onCreateSupersetGroup={props.onCreateSupersetGroup}
      showExerciseSelector={props.showExerciseSelector}
      onAddExercise={props.onAddExercise}
      onCloseSelector={props.onCloseSelector}
      onOpenQuickForm={props.onOpenQuickForm}
      defaultWorkoutGoal={props.defaultWorkoutGoal}
      showQuickForm={props.showQuickForm}
      onCloseQuickForm={props.onCloseQuickForm}
      showGoalSelector={props.showGoalSelector}
      onGoalSelect={props.onGoalSelect}
      onCloseGoalSelector={props.onCloseGoalSelector}
      showWarmup={props.showWarmup}
      showCooldown={props.showCooldown}
      onWarmupComplete={props.onWarmupComplete}
      onWarmupSkip={props.onWarmupSkip}
      onCooldownComplete={props.onCooldownComplete}
      onCooldownSkip={props.onCooldownSkip}
      showTutorial={props.showTutorial}
      tutorialExercise={props.tutorialExercise}
      tutorialCustomNotes={props.tutorialCustomNotes}
      onCloseTutorial={props.onCloseTutorial}
      onCloseAICoach={props.onCloseAICoach}
    />
  </>
);

export default React.memo(WorkoutOverlays);
