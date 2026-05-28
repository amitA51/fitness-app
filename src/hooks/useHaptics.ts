/**
 * Enhanced Haptic Feedback Hook
 *
 * Thin React wrapper over `utils/haptics`, which is the SINGLE source of truth
 * for the canonical pattern vocabulary, intensity scaling, iOS handling, the
 * actual `navigator.vibrate` calls, and enable-flag gating (synced from the
 * Settings haptics toggle via setHapticsEnabled). This hook only adapts that
 * util surface to React and reads the live settings flag; it owns no vibration
 * logic of its own.
 */

import { useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import {
  type HapticEffect,
  type HapticIntensity,
  isIOSDevice,
  stopHaptic as stopHapticUtil,
  triggerHapticEffect,
  triggerHapticIntensity,
} from '../utils/haptics';

// Re-exported from the util (canonical definitions) so existing type imports
// from this module keep working unchanged.
export type { HapticEffect, HapticIntensity };

const supportsVibration = (): boolean =>
  typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in window.navigator;

// Quiet Luxury: Additional refined haptic patterns for premium interactions
export const LUXURY_HAPTIC_PATTERNS = {
  // Soft confirmation - like a premium watch click
  softConfirm: [8],
  // Success - gentle double pulse
  luxurySuccess: [10, 50, 10],
  // Selection change - subtle tick
  selectionTick: [5],
  // Modal open - gentle thud
  modalPresent: [15, 30, 8],
  // Swipe threshold reached
  swipeThreshold: [12, 25, 6],
  // Button press - satisfying click
  buttonPress: [8, 20, 4],
  // Save complete - reassuring pulse
  saveComplete: [6, 40, 12],
  // Delete action - slightly heavier for importance
  deleteAction: [18, 30, 10],
} as const;

// Atomic Habits: Specialized haptic patterns for habit interactions
export const HABIT_HAPTIC_PATTERNS = {
  // Habit completed today - celebratory pulse
  habitComplete: [15, 40, 20, 40, 10],
  // Streak milestone (7, 21, 30, 66 days) - achievement feel
  streakMilestone: [20, 60, 25, 60, 30, 60, 15],
  // Chain broken - somber single pulse
  chainBroken: [60],
  // Identity reinforcement - affirming double tap
  identityReinforce: [12, 80, 12],
  // Two-minute phase upgrade - progression feel
  phaseUpgrade: [10, 30, 15, 30, 20],
  // Bad habit urge logged - acknowledgment
  urgeLogged: [8, 50, 6],
  // Substitution action performed - redirect success
  substitutionSuccess: [10, 40, 15, 40, 10],
  // Environment cue reminder - gentle nudge
  cueReminder: [6, 100, 6],
} as const;

/**
 * Enhanced haptic feedback hook with multiple effect types and platform support.
 * Every method delegates to `utils/haptics`; the hook adds no vibration logic.
 */
export const useHaptics = () => {
  const { settings } = useSettings();
  const hapticFeedback = settings.workoutSettings?.hapticsEnabled ?? settings.soundEnabled;

  // Device capabilities, computed once. The actual gating + vibration lives in
  // utils/haptics; these are exposed for callers that branch on support.
  const capabilities = useMemo(
    () => ({
      supportsVibration: supportsVibration(),
      isIOS: isIOSDevice(),
    }),
    []
  );

  /**
   * Trigger a simple haptic with intensity.
   */
  const triggerHaptic = useCallback(
    (intensity: HapticIntensity = 'light') => {
      if (!hapticFeedback) return;
      triggerHapticIntensity(intensity);
    },
    [hapticFeedback]
  );

  /**
   * Trigger a specific haptic effect (looks up the canonical pattern in the util).
   */
  const triggerEffect = useCallback(
    (effect: HapticEffect, intensity: HapticIntensity = 'medium') => {
      if (!hapticFeedback) return;
      triggerHapticEffect(effect, intensity);
    },
    [hapticFeedback]
  );

  /**
   * Stop any ongoing vibration.
   */
  const stopHaptic = useCallback(() => {
    stopHapticUtil();
  }, []);

  /**
   * Convenience methods for common effects.
   */
  const hapticSuccess = useCallback(() => triggerEffect('success', 'medium'), [triggerEffect]);
  const hapticError = useCallback(() => triggerEffect('error', 'heavy'), [triggerEffect]);
  const hapticWarning = useCallback(() => triggerEffect('warning', 'medium'), [triggerEffect]);
  const hapticTap = useCallback(() => triggerEffect('tap', 'light'), [triggerEffect]);
  const hapticSelection = useCallback(() => triggerEffect('selection', 'light'), [triggerEffect]);
  const hapticNotification = useCallback(
    () => triggerEffect('notification', 'medium'),
    [triggerEffect]
  );

  return {
    // Basic haptic
    triggerHaptic,

    // Advanced effects
    triggerEffect,
    stopHaptic,

    // Convenience methods
    hapticSuccess,
    hapticError,
    hapticWarning,
    hapticTap,
    hapticSelection,
    hapticNotification,

    // Device capabilities info
    isSupported: capabilities.supportsVibration,
    isIOS: capabilities.isIOS,
  };
};
