// Settings Context - Provides app-wide settings access
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AppSettings, WorkoutSettings } from '../types';
import { setHapticsEnabled } from '../utils/haptics';
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
  darkMode: false,
  unitSystem: 'metric',
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

/**
 * Detect the OS-level color scheme preference. Used as a default when the
 * user has not explicitly toggled darkMode yet.
 */
const systemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

export const loadStoredSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem('appSettings');
    if (!stored) {
      return { ...DEFAULT_SETTINGS, darkMode: systemPrefersDark() };
    }

    const parsed = safeJsonParse<Partial<AppSettings>>(stored);
    if (parsed && typeof parsed === 'object') {
      return mergeSettings(parsed);
    }
  } catch {
    // Ignore parse errors
  }

  return { ...DEFAULT_SETTINGS, darkMode: systemPrefersDark() };
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

  // Keep state updaters pure (no side effects): React Strict Mode runs updaters
  // twice, which would double-write to localStorage. Persistence is handled by
  // the effect below instead.
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...updates,
      workoutSettings: {
        ...prev.workoutSettings,
        ...(updates.workoutSettings ?? {}),
      },
    }));
  }, []);

  const updateWorkoutSettings = useCallback((updates: Partial<WorkoutSettings>) => {
    setSettings((prev) =>
      mergeSettings({
        ...prev,
        workoutSettings: {
          ...prev.workoutSettings,
          ...updates,
        },
      })
    );
  }, []);

  // Persist whenever settings change, but skip the initial render so we don't
  // immediately rewrite the values we just loaded from storage.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    persistSettings(settings);
  }, [settings]);

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
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [
    settings.workoutSettings.highContrast,
    settings.workoutSettings.largeText,
    settings.workoutSettings.reducedAnimations,
    settings.darkMode,
  ]);

  // Sync haptics toggle to the shared utils/haptics module so legacy callers respect it.
  useEffect(() => {
    setHapticsEnabled(settings.workoutSettings.hapticsEnabled);
  }, [settings.workoutSettings.hapticsEnabled]);

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
