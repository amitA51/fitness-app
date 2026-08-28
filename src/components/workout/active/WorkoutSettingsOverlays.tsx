// WorkoutSettingsOverlays — settings surface for the active workout.
//
// Group: WorkoutSettingsOverlay, wrapped in its own OverlayErrorBoundary so a
// settings render failure can't take down the live logging UI. Lazy-loaded and
// only mounted while open. The reducer owns the open/close flag.

import React from 'react';
import type { WorkoutSettings } from '../../../types';
import OverlayLoader from '../components/ui/OverlayLoader';
import OverlayErrorBoundary from '../core/OverlayErrorBoundary';

const WorkoutSettingsOverlay = React.lazy(() => import('../overlays/WorkoutSettingsOverlay'));

export interface WorkoutSettingsOverlaysProps {
  showSettings: boolean;
  workoutSettings: Partial<WorkoutSettings>;
  onCloseSettings: () => void;
  onUpdateSetting: (key: string, value: unknown) => void;
}

const WorkoutSettingsOverlays: React.FC<WorkoutSettingsOverlaysProps> = ({
  showSettings,
  workoutSettings,
  onCloseSettings,
  onUpdateSetting,
}) => {
  if (!showSettings) return null;

  return (
    <OverlayErrorBoundary fallbackLabel="ההגדרות לא נפתחו" onDismiss={onCloseSettings}>
      <React.Suspense fallback={<OverlayLoader />}>
        <WorkoutSettingsOverlay
          isOpen={showSettings}
          settings={workoutSettings}
          onClose={onCloseSettings}
          onUpdateSetting={onUpdateSetting}
        />
      </React.Suspense>
    </OverlayErrorBoundary>
  );
};

export default React.memo(WorkoutSettingsOverlays);
