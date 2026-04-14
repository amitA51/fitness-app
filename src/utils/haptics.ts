// Haptics utility - wrapper for vibration API with fallback patterns

// Simple haptic feedback
export const haptic = (duration: number = 50): void => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
};

// Haptic pattern (array of on/off durations)
export const vibratePattern = (pattern: number[]): void => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Common patterns
export const HAPTIC_PATTERNS: Record<string, number[]> = {
  TAP: [20],
  SET_COMPLETE: [50, 50, 50],
  REST_END: [200, 100, 200],
  PR_ACHIEVED: [100, 50, 100, 50, 200],
  SUCCESS: [50, 50, 100],
  ERROR: [100, 50, 100],
};

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
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'selection' | undefined = 'medium'): void => {
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