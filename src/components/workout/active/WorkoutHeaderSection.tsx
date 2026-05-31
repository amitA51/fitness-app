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
  supersetMode: boolean;
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
  supersetMode,
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

    {/* Superset Mode Indicator */}
    {supersetMode && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 14px',
          background: 'var(--fs-accent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--fs-heading)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        <span>SUPERSET · בחר תרגיל שני</span>
        <span>2 / 2</span>
      </div>
    )}

    {/* Inline Rest Timer */}
    {restTimerActive && (
      <InlineRestTimer
        active={restTimerActive}
        endTime={restTimerEndTime}
        onSkip={onSkipRest}
        onAddTime={onAddRestTime}
        nextSetHint={nextSetHint}
      />
    )}
  </div>
);

export default React.memo(WorkoutHeaderSection);
