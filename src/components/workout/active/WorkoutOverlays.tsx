import React from 'react';
import type { Exercise, WorkoutGoal, WorkoutSettings } from '../../../types';
import OverlayLoader from '../components/ui/OverlayLoader';
import OverlayErrorBoundary from '../core/OverlayErrorBoundary';

// Overlays (lazy - loaded on demand)
const NumpadOverlay = React.lazy(() => import('../overlays/NumpadOverlay'));
const ConfirmExitOverlay = React.lazy(() => import('../overlays/ConfirmExitOverlay'));
const PlateCalculatorOverlay = React.lazy(() => import('../overlays/PlateCalculatorOverlay'));
const WorkoutSettingsOverlay = React.lazy(() => import('../overlays/WorkoutSettingsOverlay'));
const ExerciseSelector = React.lazy(() => import('../ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('../QuickExerciseForm'));
const WorkoutGoalSelector = React.lazy(() => import('../WorkoutGoalSelector'));
const WarmupCooldownFlow = React.lazy(() => import('../WarmupCooldownFlow'));
const ExerciseReorder = React.lazy(() => import('../ExerciseReorder'));
const ExerciseTutorial = React.lazy(() => import('../ExerciseTutorial'));

interface NumpadState {
  isOpen: boolean;
  target: 'weight' | 'reps' | null;
  value: string;
}

interface WorkoutOverlaysProps {
  // Numpad
  numpad: NumpadState;
  onNumpadInput: (digit: string) => void;
  onNumpadSetValue: (value: string) => void;
  onNumpadDelete: () => void;
  onNumpadSubmit: () => void;
  onCloseNumpad: () => void;
  // Plate calc
  showPlateCalc: boolean;
  onClosePlateCalc: () => void;
  currentSetWeight: number;
  // Confirm exit
  showFinishConfirm: boolean;
  finishIntent: 'finish' | 'cancel';
  workoutStats: { completedSets: number; totalVolume: number; duration: string };
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

const WorkoutOverlays: React.FC<WorkoutOverlaysProps> = ({
  numpad,
  onNumpadInput,
  onNumpadSetValue,
  onNumpadDelete,
  onNumpadSubmit,
  onCloseNumpad,
  showPlateCalc,
  onClosePlateCalc,
  currentSetWeight,
  showFinishConfirm,
  finishIntent,
  workoutStats,
  onConfirmFinish,
  onCancelFinish,
  onCooldownFromFinish,
  isSaving,
  saveError,
  showSettings,
  workoutSettings,
  onCloseSettings,
  onUpdateSetting,
  isDrawerOpen,
  exercises,
  currentExerciseIndex,
  onReorderExercises,
  onSelectExerciseFromList,
  onRemoveExercise,
  onEditSetInList,
  onDeleteSet,
  onCloseDrawer,
  showExerciseSelector,
  onAddExercise,
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
  onCloseTutorial,
  onCloseAICoach,
}) => (
  <>
    {/* Numpad */}
    <React.Suspense fallback={null}>
      <NumpadOverlay
        isOpen={numpad.isOpen}
        target={numpad.target}
        value={numpad.value}
        onInput={onNumpadInput}
        onSetValue={onNumpadSetValue}
        onDelete={onNumpadDelete}
        onSubmit={onNumpadSubmit}
        onClose={onCloseNumpad}
      />
    </React.Suspense>

    {/* Plate Calculator */}
    {showPlateCalc && (
      <React.Suspense fallback={null}>
        <PlateCalculatorOverlay
          isOpen={showPlateCalc}
          onClose={onClosePlateCalc}
          initialTarget={currentSetWeight}
        />
      </React.Suspense>
    )}

    {/* Confirm Exit */}
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
      />
    </React.Suspense>

    {/* Settings Overlay */}
    <OverlayErrorBoundary fallbackLabel="שגיאה בהגדרות" onDismiss={onCloseSettings}>
      <React.Suspense fallback={<OverlayLoader />}>
        <WorkoutSettingsOverlay
          isOpen={showSettings}
          settings={workoutSettings}
          onClose={onCloseSettings}
          onUpdateSetting={onUpdateSetting}
        />
      </React.Suspense>
    </OverlayErrorBoundary>

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

    {/* Tutorial + AI Coach */}
    <OverlayErrorBoundary
      fallbackLabel="שגיאה ב-AI"
      onDismiss={() => {
        onCloseTutorial();
        onCloseAICoach();
      }}
    >
      <React.Suspense fallback={null}>
        {showTutorial && tutorialExercise && (
          <ExerciseTutorial
            isOpen={true}
            exerciseName={tutorialExercise}
            customNotes={tutorialCustomNotes}
            onClose={onCloseTutorial}
          />
        )}
      </React.Suspense>
    </OverlayErrorBoundary>

    {/* Saving overlay */}
    {isSaving && <OverlayLoader />}
  </>
);

export default React.memo(WorkoutOverlays);
