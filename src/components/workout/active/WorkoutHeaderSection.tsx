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
  isSaving: boolean;
  restTimerActive: boolean;
  restTimerEndTime: number | null;
  onSkipRest: () => void;
  onAddRestTime: (seconds: number) => void;
  nextSetHint: string | undefined;
}

const WorkoutHeaderSection: React.FC<WorkoutHeaderSectionProps> = ({
  startTimestamp,
  totalPausedTime,
  isPaused,
  onFinish,
  onDiscard,
  onOpenSettings,
  onOpenTutorial,
  isSaving,
  restTimerActive,
  restTimerEndTime,
  onSkipRest,
  onAddRestTime,
  nextSetHint,
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
        isPaused={isPaused}
      />
    )}
  </div>
);

export default React.memo(WorkoutHeaderSection);
