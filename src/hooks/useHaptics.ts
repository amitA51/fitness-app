/**
 * Enhanced Haptic Feedback Hook
 * Provides rich tactile feedback across different devices and platforms
 */

import { useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';

// Haptic intensity levels with corresponding vibration patterns
export type HapticIntensity = 'light' | 'medium' | 'heavy';

// Haptic effect types for different interactions
export type HapticEffect =
  | 'tap'           // Simple tap feedback
  | 'success'       // Task completion, positive action
  | 'error'         // Error or failed action
  | 'warning'       // Warning or caution
  | 'selection'     // Item selection change
  | 'impact'        // Physical collision feel
  | 'notification'  // Incoming notification
  | 'swipe'         // Swipe gesture feedback
  | 'longPress';    // Long press recognition

// Vibration patterns for each effect (in milliseconds)
// Format: [vibrate, pause, vibrate, pause, ...]
const VIBRATION_PATTERNS: Record<HapticEffect, number[]> = {
  tap: [10],                        // Quiet Luxury: Softer tap
  success: [15, 60, 15],            // Quiet Luxury: Gentler double pulse
  error: [50, 50, 50, 50, 50],      // Slightly softer triple pulse
  warning: [35, 120, 35],           // Gentler double with longer pause
  selection: [6],                    // Very light
  impact: [25],                      // Quieter single
  notification: [15, 100, 15, 100, 25], // Attention-grabbing but refined
  swipe: [4, 15, 4],                // Very light sliding feel
  longPress: [40],                  // Confirmation
};

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

// Intensity multipliers for vibration duration
const INTENSITY_MULTIPLIERS: Record<HapticIntensity, number> = {
  light: 0.6,
  medium: 1.0,
  heavy: 1.5,
};

/**
 * Check if the device supports vibration
 */
const supportsVibration = (): boolean => {
  return typeof window !== 'undefined' &&
    'navigator' in window &&
    'vibrate' in window.navigator;
};

/**
 * Check if running on iOS (different haptic system)
 */
const isIOS = (): boolean => {
  return typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Enhanced haptic feedback hook with multiple effect types and platform support
 */
export const useHaptics = () => {
  const { settings } = useSettings();
  const hapticFeedback = settings.workoutSettings?.hapticsEnabled ?? settings.soundEnabled;

  // Check device capabilities once
  const capabilities = useMemo(() => ({
    supportsVibration: supportsVibration(),
    isIOS: isIOS(),
  }), []);

  /**
   * Apply intensity multiplier to a vibration pattern
   */
  const applyIntensity = useCallback((pattern: number[], intensity: HapticIntensity): number[] => {
    const multiplier = INTENSITY_MULTIPLIERS[intensity];
    return pattern.map((duration, index) => {
      // Only modify vibration durations (even indices), not pauses (odd indices)
      if (index % 2 === 0) {
        return Math.round(duration * multiplier);
      }
      return duration;
    });
  }, []);

  /**
   * Trigger a simple haptic with intensity
   */
  const triggerHaptic = useCallback(
    (intensity: HapticIntensity = 'light') => {
      if (!hapticFeedback || !capabilities.supportsVibration) return;

      const duration = intensity === 'light' ? 15 : intensity === 'medium' ? 30 : 50;

      try {
        window.navigator.vibrate(duration);
      } catch (e) {
        console.warn('Vibration failed:', e);
      }
    },
    [hapticFeedback, capabilities.supportsVibration]
  );

  /**
   * Trigger a specific haptic effect
   */
  const triggerEffect = useCallback(
    (effect: HapticEffect, intensity: HapticIntensity = 'medium') => {
      if (!hapticFeedback) return;

      // For iOS, we can only do simple vibrations via AudioContext workaround
      // The Taptic Engine requires native code, so we fall back to simple patterns
      if (capabilities.isIOS) {
        // iOS Safari doesn't support vibration API, so we skip silently
        return;
      }

      if (!capabilities.supportsVibration) return;

      const pattern = VIBRATION_PATTERNS[effect];
      const adjustedPattern = applyIntensity(pattern, intensity);

      try {
        window.navigator.vibrate(adjustedPattern);
      } catch (e) {
        console.warn('Haptic effect failed:', e);
      }
    },
    [hapticFeedback, capabilities, applyIntensity]
  );

  /**
   * Stop any ongoing vibration
   */
  const stopHaptic = useCallback(() => {
    if (capabilities.supportsVibration) {
      try {
        window.navigator.vibrate(0);
      } catch (e) {
        // Ignore errors when stopping
      }
    }
  }, [capabilities.supportsVibration]);

  /**
   * Convenience methods for common effects
   */
  const hapticSuccess = useCallback(() => triggerEffect('success', 'medium'), [triggerEffect]);
  const hapticError = useCallback(() => triggerEffect('error', 'heavy'), [triggerEffect]);
  const hapticWarning = useCallback(() => triggerEffect('warning', 'medium'), [triggerEffect]);
  const hapticTap = useCallback(() => triggerEffect('tap', 'light'), [triggerEffect]);
  const hapticSelection = useCallback(() => triggerEffect('selection', 'light'), [triggerEffect]);
  const hapticNotification = useCallback(() => triggerEffect('notification', 'medium'), [triggerEffect]);

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
