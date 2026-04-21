// Settings Context - Provides app-wide settings access
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings, WorkoutSettings } from '../types';
import { safeJsonParse } from '../utils/safeJson';

// Default workout settings
export const DEFAULT_WORKOUT_SETTINGS: WorkoutSettings = {
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

export const DEFAULT_SETTINGS: AppSettings = {
  workoutSettings: DEFAULT_WORKOUT_SETTINGS,
  theme: 'deepCosmos',
  soundEnabled: true,
  keepAwake: true,
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateWorkoutSettings: (updates: Partial<WorkoutSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const mergeSettings = (stored?: Partial<AppSettings>): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...stored,
  workoutSettings: {
    ...DEFAULT_WORKOUT_SETTINGS,
    ...stored?.workoutSettings,
  },
});

export const loadStoredSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem('appSettings');
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = safeJsonParse<Partial<AppSettings>>(stored);
    if (parsed && typeof parsed === 'object') {
      return mergeSettings(parsed);
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_SETTINGS;
};

const persistSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = mergeSettings({ ...prev, ...updates });
      persistSettings(next);
      return next;
    });
  }, []);

  const updateWorkoutSettings = useCallback((updates: Partial<WorkoutSettings>) => {
    setSettings((prev) => {
      const next = mergeSettings({
        ...prev,
        workoutSettings: {
          ...prev.workoutSettings,
          ...updates,
        },
      });
      persistSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      'reduce-motion',
      settings.workoutSettings.reducedAnimations
    );
    document.documentElement.classList.toggle(
      'high-contrast',
      settings.workoutSettings.highContrast
    );
    document.documentElement.classList.toggle('large-text', settings.workoutSettings.largeText);
  }, [
    settings.workoutSettings.highContrast,
    settings.workoutSettings.largeText,
    settings.workoutSettings.reducedAnimations,
  ]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      updateWorkoutSettings,
    }),
    [settings, updateSettings, updateWorkoutSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
