// WorkoutFlowOverlays — session-flow overlays for the active workout.
//
// Group: confirm-exit (finish/cancel), exercise-list drawer (reorder/edit),
// exercise selector, quick-add form, goal selector, warmup & cooldown flows,
// tutorial + AI coach, and the saving spinner. Each heavy overlay is lazy-loaded
// and only mounted while its reducer flag is open (the drawer/selector/etc. were
// already conditional; confirm-exit is now conditional too). The tutorial/AI
// coach pair keeps its own OverlayErrorBoundary so an AI failure can't blank the
// live workout. Orchestration stays in the workout reducer.

import React from 'react';
import type { Exercise, WorkoutGoal } from '../../../types';
import OverlayLoader from '../components/ui/OverlayLoader';
import OverlayErrorBoundary from '../core/OverlayErrorBoundary';
import type { SupersetGroup } from '../core/workoutTypes';

const ConfirmExitOverlay = React.lazy(() => import('../overlays/ConfirmExitOverlay'));
const ExerciseSelector = React.lazy(() => import('../ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('../QuickExerciseForm'));
const WorkoutGoalSelector = React.lazy(() => import('../WorkoutGoalSelector'));
const WarmupCooldownFlow = React.lazy(() => import('../WarmupCooldownFlow'));
const ExerciseReorder = React.lazy(() => import('../ExerciseReorder'));
const ExerciseTutorial = React.lazy(() => import('../ExerciseTutorial'));

export interface WorkoutFlowOverlaysProps {
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
  /** True when confirm-finish hit the short-session gate — show the ask UI. */
  shortSessionAsk?: boolean;
  /** User answered the short-session ask: record the micro-session, or drop it. */
  onResolveShortSession?: (record: boolean) => void;
  // Drawer (exercise list reorder/edit)
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
  onAddExercises?: (exercises: Exercise[]) => void;
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
  // Tutorial + AI coach
  showTutorial: boolean;
  tutorialExercise: string | null;
  tutorialCustomNotes?: string;
  tutorialPrimaryMuscle?: string;
  tutorialSecondaryMuscles?: string[];
  tutorialMechanic?: string;
  tutorialForce?: string;
  tutorialLevel?: string;
  tutorialEquipment?: string;
  tutorialInstructions?: string;
  /** Current set's note + its writer — the note strip now lives in the coach. */
  tutorialNote?: string;
  onSaveTutorialNote?: (note: string) => void;
  onCloseTutorial: () => void;
  onCloseAICoach: () => void;
}

const WorkoutFlowOverlays: React.FC<WorkoutFlowOverlaysProps> = ({
  showFinishConfirm,
  finishIntent,
  workoutStats,
  onConfirmFinish,
  onCancelFinish,
  onCooldownFromFinish,
  isSaving,
  saveError,
  shortSessionAsk = false,
  onResolveShortSession,
  isDrawerOpen,
  exercises,
  currentExerciseIndex,
  onReorderExercises,
  onSelectExerciseFromList,
  onRemoveExercise,
  onEditSetInList,
  onDeleteSet,
  onCloseDrawer,
  supersetGroups,
  onCreateSupersetGroup,
  showExerciseSelector,
  onAddExercise,
  onAddExercises,
  onCloseSelector,
  onOpenQuickForm,
  defaultWorkoutGoal,
  showQuickForm,
  onCloseQuickForm,
  showGoalSelector,
  onGoalSelect,
  onCloseGoalSelector,
  showWarmup,
  showCooldown,
  onWarmupComplete,
  onWarmupSkip,
  onCooldownComplete,
  onCooldownSkip,
  showTutorial,
  tutorialExercise,
  tutorialCustomNotes,
  tutorialPrimaryMuscle,
  tutorialSecondaryMuscles,
  tutorialMechanic,
  tutorialForce,
  tutorialLevel,
  tutorialEquipment,
  tutorialInstructions,
  tutorialNote,
  onSaveTutorialNote,
  onCloseTutorial,
  onCloseAICoach,
}) => (
  <>
    {/* Confirm Exit — only mounted while open */}
    {showFinishConfirm && (
      <React.Suspense fallback={null}>
        <ConfirmExitOverlay
          isOpen={showFinishConfirm}
          intent={finishIntent}
          workoutStats={workoutStats}
          onConfirm={onConfirmFinish}
          onCancel={onCancelFinish}
          onCooldown={onCooldownFromFinish}
          isSaving={isSaving}
          saveError={saveError}
          shortSessionAsk={shortSessionAsk}
          onProceedWithSave={onResolveShortSession}
        />
      </React.Suspense>
    )}

    {/* Exercise List Drawer */}
    {isDrawerOpen && (
      <React.Suspense fallback={null}>
        <ExerciseReorder
          exercises={exercises}
          currentIndex={currentExerciseIndex}
          onReorder={onReorderExercises}
          onSelectExercise={onSelectExerciseFromList}
          onDeleteExercise={onRemoveExercise}
          onEditSet={onEditSetInList}
          onDeleteSet={onDeleteSet}
          supersetGroups={supersetGroups}
          onCreateSupersetGroup={onCreateSupersetGroup}
          onClose={onCloseDrawer}
        />
      </React.Suspense>
    )}

    {/* Exercise Selector */}
    {showExerciseSelector && (
      <React.Suspense fallback={null}>
        <ExerciseSelector
          isOpen={true}
          onSelect={onAddExercise}
          onSelectMany={onAddExercises}
          onClose={onCloseSelector}
          onCreateNew={onOpenQuickForm}
          goal={defaultWorkoutGoal}
        />
      </React.Suspense>
    )}

    {/* Quick Exercise Form */}
    {showQuickForm && (
      <React.Suspense fallback={null}>
        <QuickExerciseForm onAdd={onAddExercise} onClose={onCloseQuickForm} />
      </React.Suspense>
    )}

    {/* Goal Selector */}
    {showGoalSelector && (
      <React.Suspense fallback={null}>
        <WorkoutGoalSelector onSelect={onGoalSelect} onClose={onCloseGoalSelector} />
      </React.Suspense>
    )}

    {/* Warmup Flow */}
    {showWarmup && (
      <React.Suspense fallback={null}>
        <WarmupCooldownFlow type="warmup" onComplete={onWarmupComplete} onSkip={onWarmupSkip} />
      </React.Suspense>
    )}

    {/* Cooldown Flow */}
    {showCooldown && (
      <React.Suspense fallback={null}>
        <WarmupCooldownFlow
          type="cooldown"
          onComplete={onCooldownComplete}
          onSkip={onCooldownSkip}
        />
      </React.Suspense>
    )}

    {/* Tutorial + AI Coach — own error boundary so an AI failure can't blank the workout */}
    {showTutorial && tutorialExercise && (
      <OverlayErrorBoundary
        fallbackLabel="שגיאה ב-AI"
        onDismiss={() => {
          onCloseTutorial();
          onCloseAICoach();
        }}
      >
        <React.Suspense fallback={null}>
          <ExerciseTutorial
            isOpen={true}
            exerciseName={tutorialExercise}
            customNotes={tutorialCustomNotes}
            primaryMuscle={tutorialPrimaryMuscle}
            secondaryMuscles={tutorialSecondaryMuscles}
            mechanic={tutorialMechanic}
            force={tutorialForce}
            level={tutorialLevel}
            equipment={tutorialEquipment}
            instructions={tutorialInstructions}
            note={tutorialNote}
            onSaveNote={onSaveTutorialNote}
            onClose={onCloseTutorial}
          />
        </React.Suspense>
      </OverlayErrorBoundary>
    )}

    {/* Saving overlay */}
    {isSaving && <OverlayLoader />}
  </>
);

export default React.memo(WorkoutFlowOverlays);
