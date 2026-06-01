/**
 * useHapticFeedback — minimal, ergonomic haptics surface for UI components.
 *
 * A thin convenience facade over the comprehensive {@link useHaptics} hook
 * (which itself wraps `utils/haptics`, the single source of truth for the
 * pattern vocabulary, iOS handling, `navigator.vibrate` calls, and the Settings
 * enable-flag gating). This facade owns NO vibration logic — it only narrows the
 * large `useHaptics` API to the handful of effects shared primitives need, so
 * feature agents have one obvious call to reach for.
 *
 * @example
 * const haptics = useHapticFeedback();
 * haptics.tap();        // light selection tick on press
 * haptics.success();    // confirmation pulse after a save
 */
import { useMemo } from 'react';
import { type HapticIntensity, useHaptics } from './useHaptics';

export interface HapticFeedback {
  /** Light tactile tick — use for taps, toggles, selection changes. */
  tap: () => void;
  /** Selection-change tick — equivalent to a subtle picker detent. */
  selection: () => void;
  /** Success pulse — use after a completed/confirmed action. */
  success: () => void;
  /** Warning pulse — use for reversible-but-notable actions. */
  warning: () => void;
  /** Error pulse — use for failures and blocked actions. */
  error: () => void;
  /** Raw intensity trigger for cases the named effects don't cover. */
  impact: (intensity?: HapticIntensity) => void;
}

export function useHapticFeedback(): HapticFeedback {
  const { triggerHaptic, hapticTap, hapticSelection, hapticSuccess, hapticWarning, hapticError } =
    useHaptics();

  return useMemo<HapticFeedback>(
    () => ({
      tap: hapticTap,
      selection: hapticSelection,
      success: hapticSuccess,
      warning: hapticWarning,
      error: hapticError,
      impact: (intensity: HapticIntensity = 'medium') => triggerHaptic(intensity),
    }),
    [hapticTap, hapticSelection, hapticSuccess, hapticWarning, hapticError, triggerHaptic]
  );
}

export default useHapticFeedback;
