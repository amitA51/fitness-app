// Haptic vocabulary for the app — centralize vibration patterns, keep language consistent.
// Module-level enable flag is synced from SettingsProvider so user's Settings toggle
// gates every vibration path (modern + legacy) without each call site knowing about it.

let _hapticsEnabled = true;

export const setHapticsEnabled = (enabled: boolean): void => {
  _hapticsEnabled = enabled;
};

const canVibrate = () =>
  _hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptics = {
  // Set complete: one crisp tick — confirmation, not celebration
  tick: () => canVibrate() && navigator.vibrate(10),
  // Adjustment (+15s, weight tweak): softer tick
  soft: () => canVibrate() && navigator.vibrate(20),
  // Pause / resume: medium
  medium: () => canVibrate() && navigator.vibrate(40),
  // Rest timer final-3 escalation: call once per second when sec in [3,2,1]
  escalation: (sec: number) => {
    if (!canVibrate()) return;
    if (sec === 3) navigator.vibrate(20);
    else if (sec === 2) navigator.vibrate(35);
    else if (sec === 1) navigator.vibrate(60);
  },
  // Rest timer zero / session complete: deep thump
  thump: () => canVibrate() && navigator.vibrate(120),
  // PR stamp: double-thump — rare, ceremonial, but silent of UI copy
  prStamp: () => canVibrate() && navigator.vibrate([80, 60, 40]),
};

// ----------------------------------------------------------------------------
// Legacy API (kept to avoid import breakage across existing call sites).
// Prefer the `haptics` vocabulary above for new code.
// ----------------------------------------------------------------------------

// Simple haptic feedback
export const haptic = (duration = 50): void => {
  if (canVibrate()) {
    navigator.vibrate(duration);
  }
};

// Haptic pattern (array of on/off durations)
export const vibratePattern = (pattern: number[]): void => {
  if (canVibrate()) {
    navigator.vibrate(pattern);
  }
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
