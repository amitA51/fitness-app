// Haptic vocabulary for the app — centralize vibration patterns, keep language consistent.
// Module-level enable flag is synced from SettingsProvider so user's Settings toggle
// gates every vibration path (modern + legacy) without each call site knowing about it.

import { logger } from './logger';

let _hapticsEnabled = true;

export const setHapticsEnabled = (enabled: boolean): void => {
  _hapticsEnabled = enabled;
};

const supportsVibration = (): boolean => typeof navigator !== 'undefined' && 'vibrate' in navigator;

const canVibrate = () => _hapticsEnabled && supportsVibration();

/**
 * iOS Safari does not support the Vibration API (the Taptic Engine needs
 * native code), so effect-based vibration is skipped on iOS.
 */
export const isIOSDevice = (): boolean =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Single low-level vibrate entry point. ALL vibration in the app funnels
 * through here so the Settings haptics toggle (synced via setHapticsEnabled)
 * gates every code path. Errors are logged, never thrown.
 */
const vibrate = (pattern: number | number[]): void => {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch (e) {
    logger.ui.warn('Vibration failed', e);
  }
};

// ----------------------------------------------------------------------------
// Canonical effect vocabulary (merged source of truth).
// Quiet Luxury patterns are the intentional default; intensity scaling and
// iOS handling live here so the React hook is a thin delegating wrapper.
// ----------------------------------------------------------------------------

export type HapticIntensity = 'light' | 'medium' | 'heavy';

export type HapticEffect =
  | 'tap'
  | 'success'
  | 'error'
  | 'warning'
  | 'selection'
  | 'impact'
  | 'notification'
  | 'swipe'
  | 'longPress';

// Vibration patterns for each effect (ms). Format: [vibrate, pause, vibrate, ...]
const EFFECT_PATTERNS: Record<HapticEffect, number[]> = {
  tap: [10], // Quiet Luxury: softer tap
  success: [15, 60, 15], // Quiet Luxury: gentler double pulse
  error: [50, 50, 50, 50, 50], // Softer triple pulse
  warning: [35, 120, 35], // Gentler double with longer pause
  selection: [6], // Very light
  impact: [25], // Quieter single
  notification: [15, 100, 15, 100, 25], // Attention-grabbing but refined
  swipe: [4, 15, 4], // Very light sliding feel
  longPress: [40], // Confirmation
};

// Intensity multipliers applied to vibration durations (not pauses).
const INTENSITY_MULTIPLIERS: Record<HapticIntensity, number> = {
  light: 0.6,
  medium: 1.0,
  heavy: 1.5,
};

const applyIntensity = (pattern: number[], intensity: HapticIntensity): number[] => {
  const multiplier = INTENSITY_MULTIPLIERS[intensity];
  return pattern.map((duration, index) =>
    // Only scale vibration durations (even indices), leave pauses (odd) intact.
    index % 2 === 0 ? Math.round(duration * multiplier) : duration
  );
};

/**
 * Canonical effect trigger. Looks up the merged pattern, applies intensity
 * scaling, skips iOS, and routes through the single vibrate() gate.
 */
export const triggerHapticEffect = (
  effect: HapticEffect,
  intensity: HapticIntensity = 'medium'
): void => {
  if (!canVibrate()) return;
  if (isIOSDevice()) return; // iOS lacks Vibration API support.
  vibrate(applyIntensity(EFFECT_PATTERNS[effect], intensity));
};

/**
 * Canonical simple-intensity trigger (light/medium/heavy single buzz).
 */
export const triggerHapticIntensity = (intensity: HapticIntensity = 'light'): void => {
  const duration = intensity === 'light' ? 15 : intensity === 'medium' ? 30 : 50;
  vibrate(duration);
};

/**
 * Stop any ongoing vibration (ignores the enable flag intentionally — stopping
 * is always safe).
 */
export const stopHaptic = (): void => {
  if (!supportsVibration()) return;
  try {
    navigator.vibrate(0);
  } catch {
    // Ignore errors when stopping.
  }
};

export const haptics = {
  // Set complete: one crisp tick — confirmation, not celebration
  tick: () => vibrate(10),
  // Adjustment (+15s, weight tweak): softer tick
  soft: () => vibrate(20),
  // Pause / resume: medium
  medium: () => vibrate(40),
  // Rest timer final-3 escalation: call once per second when sec in [3,2,1]
  escalation: (sec: number) => {
    if (sec === 3) vibrate(20);
    else if (sec === 2) vibrate(35);
    else if (sec === 1) vibrate(60);
  },
  // Rest timer zero / session complete: deep thump
  thump: () => vibrate(120),
  // PR stamp: double-thump — rare, ceremonial, but silent of UI copy
  prStamp: () => vibrate([80, 60, 40]),
};

// ----------------------------------------------------------------------------
// Legacy API (kept to avoid import breakage across existing call sites).
// Prefer the `haptics` vocabulary above for new code.
// ----------------------------------------------------------------------------

// Simple haptic feedback
export const haptic = (duration = 50): void => {
  vibrate(duration);
};

// Haptic pattern (array of on/off durations)
export const vibratePattern = (pattern: number[]): void => {
  vibrate(pattern);
};

// Common patterns
export const HAPTIC_PATTERNS = {
  TAP: [20],
  SET_COMPLETE: [50, 50, 50],
  REST_END: [200, 100, 200],
  PR_ACHIEVED: [100, 50, 100, 50, 200],
  SUCCESS: [50, 50, 100],
  ERROR: [100, 50, 100],
} satisfies Record<string, number[]>;

// Short feedback (for UI interactions)
export const hapticTap = (): void => haptic(20);

// Medium feedback (for set completion)
export const hapticSetComplete = (): void => vibratePattern(HAPTIC_PATTERNS.SET_COMPLETE);

// Long feedback (for rest timer end)
export const hapticRestEnd = (): void => vibratePattern(HAPTIC_PATTERNS.REST_END);

// Celebration feedback (for personal records)
export const hapticPR = (): void => vibratePattern(HAPTIC_PATTERNS.PR_ACHIEVED);

// Error feedback
export const hapticError = (): void => vibratePattern(HAPTIC_PATTERNS.ERROR);

// Alias for triggerHaptic (used by components)
export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'selection' | undefined = 'medium'
): void => {
  switch (type) {
    case 'light':
      haptic(20);
      break;
    case 'medium':
      haptic(50);
      break;
    case 'heavy':
      haptic(100);
      break;
    case 'success':
      vibratePattern([50, 50, 100]);
      break;
    case 'selection':
      haptic(20);
      break;
    default:
      haptic(50);
  }
};
