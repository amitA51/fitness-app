import React from 'react';
import { WorkoutHeader } from '../components';
import InlineRestTimer from '../components/InlineRestTimer';

interface WorkoutHeaderSectionProps {
  startTimestamp: number;
  totalPausedTime: number;
  isPaused: boolean;
  onFinish: () => void;
  onDiscard: () => void;
  onOpenSettings: () => void;
  onOpenTutorial: () => void;
  /** Pause/resume the workout (freezes the duration + rest timers). */
  onTogglePause: () => void;
  isSaving: boolean;
  restTimerActive: boolean;
  restTimerEndTime: number | null;
  onSkipRest: () => void;
  onAddRestTime: (seconds: number) => void;
  nextSetHint: string | undefined;
  /** Planned weight (kg) for the upcoming set — shown as a dir="ltr" chip. 0/undefined hides it. */
  nextSetWeight?: number;
  /** Planned reps for the upcoming set — shown as a dir="ltr" chip. 0/undefined hides it. */
  nextSetReps?: number;
}

const WorkoutHeaderSection: React.FC<WorkoutHeaderSectionProps> = ({
  startTimestamp,
  totalPausedTime,
  isPaused,
  onFinish,
  onDiscard,
  onOpenSettings,
  onOpenTutorial,
  onTogglePause,
  isSaving,
  restTimerActive,
  restTimerEndTime,
  onSkipRest,
  onAddRestTime,
  nextSetHint,
  nextSetWeight,
  nextSetReps,
}) => (
  <div className="flex-shrink-0">
    <WorkoutHeader
      startTimestamp={startTimestamp}
      totalPausedTime={totalPausedTime}
      isPaused={isPaused}
      onFinish={onFinish}
      onDiscard={onDiscard}
      onOpenSettings={onOpenSettings}
      onOpenTutorial={onOpenTutorial}
      onTogglePause={onTogglePause}
      isSaving={isSaving}
    />

    {/* Inline Rest Timer */}
    {restTimerActive && (
      <InlineRestTimer
        active={restTimerActive}
        endTime={restTimerEndTime}
        onSkip={onSkipRest}
        onAddTime={onAddRestTime}
        nextSetHint={nextSetHint}
        nextSetWeight={nextSetWeight}
        nextSetReps={nextSetReps}
        isPaused={isPaused}
      />
    )}
  </div>
);

export default React.memo(WorkoutHeaderSection);
