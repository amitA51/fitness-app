// WorkoutInputOverlays — numeric input tools for the active set.
//
// Group: NumpadOverlay (weight/reps keypad) + PlateCalculatorOverlay (barbell
// plate math). Both are lazy-loaded and now CONDITIONALLY mounted — they no
// longer sit in the tree while closed. Orchestration (which is open) stays in
// the workout reducer; this component only renders what the reducer says is open.

import React from 'react';
import type { NumpadState } from '../core/workoutTypes';

const NumpadOverlay = React.lazy(() => import('../overlays/NumpadOverlay'));
const PlateCalculatorOverlay = React.lazy(() => import('../overlays/PlateCalculatorOverlay'));

export interface WorkoutInputOverlaysProps {
  // Numpad
  numpad: NumpadState;
  onNumpadInput: (digit: string) => void;
  onNumpadSetValue: (value: string) => void;
  onNumpadDelete: () => void;
  onNumpadSubmit: () => void;
  onCloseNumpad: () => void;
  // Plate calculator
  showPlateCalc: boolean;
  onClosePlateCalc: () => void;
  currentSetWeight: number;
}

const WorkoutInputOverlays: React.FC<WorkoutInputOverlaysProps> = ({
  numpad,
  onNumpadInput,
  onNumpadSetValue,
  onNumpadDelete,
  onNumpadSubmit,
  onCloseNumpad,
  showPlateCalc,
  onClosePlateCalc,
  currentSetWeight,
}) => (
  <>
    {/* Numpad — only mounted while open */}
    {numpad.isOpen && (
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
    )}

    {/* Plate Calculator — only mounted while open */}
    {showPlateCalc && (
      <React.Suspense fallback={null}>
        <PlateCalculatorOverlay
          isOpen={showPlateCalc}
          onClose={onClosePlateCalc}
          initialTarget={currentSetWeight}
        />
      </React.Suspense>
    )}
  </>
);

export default React.memo(WorkoutInputOverlays);
