// Settings Context - Provides app-wide settings access
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AppSettings, WorkoutSettings } from '../types';

// Default workout settings
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

const DEFAULT_SETTINGS: AppSettings = {
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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('appSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            workoutSettings: {
              ...DEFAULT_WORKOUT_SETTINGS,
              ...parsed.workoutSettings,
            },
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('appSettings', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const updateWorkoutSettings = useCallback((updates: Partial<WorkoutSettings>) => {
    setSettings(prev => {
      const next = {
        ...prev,
        workoutSettings: {
          ...prev.workoutSettings,
          ...updates,
        },
      };
      try {
        localStorage.setItem('appSettings', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    settings,
    updateSettings,
    updateWorkoutSettings,
  }), [settings, updateSettings, updateWorkoutSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    // Return a fallback instead of throwing - some hooks use this optionally
    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      updateWorkoutSettings: () => {},
    };
  }
  return context;
};

export default SettingsContext;
