// ============================================================================
// WorkoutHistoryScreen — full-screen history modal shim.
// ============================================================================
// Now a thin wrapper that hosts the unified `WorkoutHistory` (mode="full")
// inside the canonical `Sheet`, rather than hand-rolling a fixed full-screen
// overlay. It keeps its original responsibility of loading its own data (via
// useWorkoutHistory) and preserves the `{ onClose, onSelectSession? }` prop
// signature so any current/future call site keeps compiling. Search, stats,
// month grouping, virtualization, and rows now come from WorkoutHistory.

import React from 'react';
import type { WorkoutSession } from '../../types';
import { Sheet } from '../ui/Sheet';
import { WorkoutHistory } from './history/WorkoutHistory';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';

interface WorkoutHistoryScreenProps {
  onClose: () => void;
  onSelectSession?: (session: WorkoutSession) => void;
}

const WorkoutHistoryScreen: React.FC<WorkoutHistoryScreenProps> = ({
  onClose,
  onSelectSession,
}) => {
  const { sessions, loading } = useWorkoutHistory(100);

  return (
    <Sheet isOpen onClose={onClose} title="היסטוריית אימונים">
      <WorkoutHistory
        sessions={sessions}
        mode="full"
        isLoading={loading}
        onSelectSession={onSelectSession}
      />
    </Sheet>
  );
};

export default React.memo(WorkoutHistoryScreen);
