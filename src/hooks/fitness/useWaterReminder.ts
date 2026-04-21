import { useCallback, useEffect, useRef, useState } from 'react';
import { showNotification } from '../../services/notificationService';
import type { WorkoutSettings } from '../../types';
import { safeJsonParse } from '../../utils/safeJson';
import { useHaptics } from '../useHaptics';

const DEFAULT_WORKOUT_SETTINGS: WorkoutSettings = {
  oledMode: false,
  selectedTheme: 'deepCosmos',
  defaultWorkoutGoal: 'general',
  defaultRestTime: 90,
  defaultSets: 3,
  autoStartRest: true,
  warmupPreference: 'ask',
  cooldownPreference: 'ask',
  keepAwake: true,
  hapticsEnabled: true,
  autoIncrementWeight: false,
  weightIncrementAmount: 2.5,
  showGhostValues: true,
  showVolumePreview: true,
  showIntensityMeter: false,
  showPerformanceStats: false,
  compactMode: false,
  soundEnabled: true,
  voiceCountdownEnabled: false,
  voiceLanguage: 'he-IL',
  voiceVolume: 0.7,
  countdownBeepEnabled: true,
  restTimerVibrate: true,
  restTimerSound: true,
  waterReminderEnabled: false,
  waterReminderInterval: 15,
  workoutRemindersEnabled: false,
  reducedAnimations: false,
  largeText: false,
  highContrast: false,
  enableProgressiveOverload: true,
  progressiveOverloadPercent: 2.5,
  enableOneRepMaxTracking: true,
  showExerciseNotes: true,
  smartRestEnabled: false,
  shortRestTime: 60,
  mediumRestTime: 90,
  longRestTime: 120,
  extendRestAfterFailure: false,
  autoAdvanceExercise: true,
  confirmExerciseComplete: false,
  enableSupersets: false,
  showRestBetweenExercises: true,
  enablePRAlerts: true,
  prCelebrationIntensity: 'full',
  trackVolumeRecords: true,
  timerDisplayMode: 'countup',
  showTimerInHeader: true,
  enableQuickWeightButtons: true,
  quickWeightIncrement: 2.5,
  enableQuickRepsButtons: true,
  gymModeEnabled: false,
  gymModeAutoLock: false,
  promptWeightBeforeWorkout: false,
  promptWeightAfterWorkout: false,
  enableWorkoutAnalytics: true,
  showMuscleGroupBalance: true,
  enableExportToCSV: true,
};

function getWorkoutSettings(): WorkoutSettings {
  try {
    const stored = localStorage.getItem('appSettings');
    if (stored) {
      const parsed = safeJsonParse<{ workoutSettings?: Partial<WorkoutSettings> }>(stored);
      if (parsed?.workoutSettings) {
        return { ...DEFAULT_WORKOUT_SETTINGS, ...parsed.workoutSettings };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_WORKOUT_SETTINGS;
}

/**
 * Hook for water reminder during workouts.
 * Shows a reminder notification/vibration at the configured interval.
 *
 * @param isActive - Whether workout is currently active
 */
export const useWaterReminder = (isActive: boolean) => {
  const { triggerHaptic } = useHaptics();
  const intervalRef = useRef<number | null>(null);
  const lastReminderRef = useRef<number>(0);
  const [workoutSettings, setWorkoutSettings] = useState<WorkoutSettings>(getWorkoutSettings);

  // Listen for settings changes
  useEffect(() => {
    const handleStorageChange = () => {
      setWorkoutSettings(getWorkoutSettings());
    };

    window.addEventListener('storage', handleStorageChange);
    // Also poll for changes (in case same tab)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const showReminder = useCallback(() => {
    // Haptic feedback
    triggerHaptic('medium');

    // Show notification
    showNotification('תזכורת מים', 'לגום מים במהלך האימון.');

    lastReminderRef.current = Date.now();
  }, [triggerHaptic]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only run if workout is active and reminder is enabled
    if (!isActive || !workoutSettings.waterReminderEnabled) {
      return;
    }

    const intervalMinutes = workoutSettings.waterReminderInterval || 15;
    const intervalMs = intervalMinutes * 60 * 1000;

    // Set up interval
    intervalRef.current = window.setInterval(() => {
      showReminder();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    isActive,
    workoutSettings.waterReminderEnabled,
    workoutSettings.waterReminderInterval,
    showReminder,
  ]);

  return {
    triggerManualReminder: showReminder,
    lastReminderTime: lastReminderRef.current,
  };
};

export default useWaterReminder;
