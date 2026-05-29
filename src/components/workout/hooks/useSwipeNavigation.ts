// useSwipeNavigation - Horizontal pointer-swipe navigation between exercises.
// Extracted from ActiveWorkoutNew. RTL-aware and ignores gestures that start on
// interactive targets (buttons, inputs, sliders, [data-no-swipe]). Owns the
// gesture-start ref internally; the component spreads the returned pointer
// handlers onto the swipe surface and supplies the change-exercise callback.
import type React from 'react';
import { useCallback, useRef } from 'react';

import { triggerHaptic } from '../../../utils/haptics';

// Gesture thresholds — a swipe must move far enough horizontally, stay roughly
// horizontal, and complete quickly enough to count as an exercise change.
const MIN_DX = 70;
const MAX_DY = 40;
const MAX_DURATION = 400;

interface UseSwipeNavigationParams {
  currentExerciseIndex: number;
  exercisesLength: number;
  onChangeExercise: (idx: number) => void;
}

interface UseSwipeNavigationReturn {
  handleSwipePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleSwipePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleSwipePointerEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Provides pointer handlers for swiping between exercises.
 *
 * Decision happens on pointer up/cancel (move is a no-op so native scroll is
 * never blocked). Behavior is identical to the inlined version previously in
 * ActiveWorkoutNew.
 */
export function useSwipeNavigation({
  currentExerciseIndex,
  exercisesLength,
  onChangeExercise,
}: UseSwipeNavigationParams): UseSwipeNavigationReturn {
  const swipeStartRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const handleSwipePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        'button, input, textarea, select, [role="button"], [role="slider"], [data-no-swipe]'
      )
    ) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      id: e.pointerId,
    };
  }, []);

  const handleSwipePointerMove = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    // No-op — we decide on pointerup. Tracking here would require canceling scroll.
  }, []);

  const handleSwipePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (!start || start.id !== e.pointerId) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const duration = Date.now() - start.t;

      if (Math.abs(dx) < MIN_DX) return;
      if (Math.abs(dy) > MAX_DY) return;
      if (duration > MAX_DURATION) return;

      const total = exercisesLength;
      if (total <= 1) return;

      const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
      // In RTL: positive dx (swipe right) → previous exercise. LTR is inverse.
      const direction = dx > 0 ? (isRTL ? -1 : 1) : isRTL ? 1 : -1;
      const nextIndex = currentExerciseIndex + direction;

      if (nextIndex < 0 || nextIndex >= total) return;

      triggerHaptic('light');
      onChangeExercise(nextIndex);
    },
    [onChangeExercise, currentExerciseIndex, exercisesLength]
  );

  return { handleSwipePointerDown, handleSwipePointerMove, handleSwipePointerEnd };
}
