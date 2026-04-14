// Constants for the fitness app
export const STORAGE_KEYS = {
  WORKOUT_TEMPLATES: 'workout_templates',
  WORKOUT_SESSIONS: 'workout_sessions',
  PERSONAL_EXERCISES: 'personal_exercises',
  BODY_WEIGHT: 'body_weight',
  RECOVERY_LOGS: 'recovery_logs',
  NUTRITION_LOGS: 'nutrition_logs',
  USER_SETTINGS: 'user_settings',
};

// Alias for backwards compatibility
export const LOCAL_STORAGE_KEYS = STORAGE_KEYS;

// Re-export all constants
// Note: Z_INDEX is exported only from zIndex.ts to avoid namespace conflict
export { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from './designTokens';
export * from './zIndex';
export * from './workoutConstants';