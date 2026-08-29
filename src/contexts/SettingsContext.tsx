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
import { setSoundEnabled } from '../utils/audio';
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

/**
 * Write the canonical `appSettings` value. Returns the exact string written so
 * the provider can recognise its own value when it re-reads the key, and `null`
 * when the write failed.
 *
 * This provider is the ONLY writer of `appSettings`. A second store that also
 * wrote the key destroyed settings: each read it once at mount and then wrote a
 * whole stale snapshot over the other's, and services/localStateMirror synced
 * the loss to every device.
 */
const persistSettings = (settings: AppSettings): string | null => {
  try {
    const raw = JSON.stringify(settings);
    localStorage.setItem('appSettings', raw);
    return raw;
  } catch {
    // Ignore storage errors
    return null;
  }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());

  // Browser storage is cleared before a different auth identity is exposed.
  // Reset this provider's in-memory copy at the same point so stale settings
  // cannot remain visible until the next full reload.
  useEffect(() => {
    const resetForUserChange = () => {
      setSettings({ ...DEFAULT_SETTINGS, darkMode: systemPrefersDark() });
    };
    window.addEventListener('auth:local-data-cleared', resetForUserChange);
    return () => window.removeEventListener('auth:local-data-cleared', resetForUserChange);
  }, []);

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
  // The exact string last written by this provider. Used to tell our own value
  // apart from one written outside React (see the adopt effect below).
  const lastWrittenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    const written = persistSettings(settings);
    if (written !== null) lastWrittenRef.current = written;
  }, [settings]);

  // Adopt a value written to `appSettings` from outside React instead of
  // overwriting it on the next toggle.
  //
  // This provider owns the key, but it is not the only thing that can change it:
  // services/localStateMirror rehydrates the raw string after a cloud pull on
  // sign-in, and another tab can write it too. Holding the pre-pull snapshot and
  // then persisting it is the same destroy-then-sync defect with the mirror as
  // the other writer, so re-read on the signals the app already emits
  // (`settings-updated` after a cloud reflection, `storage` from another tab).
  useEffect(() => {
    const adoptExternalWrite = () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem('appSettings');
      } catch {
        return;
      }
      // Nothing there, or it is the value we just wrote: nothing to adopt.
      if (raw === null || raw === lastWrittenRef.current) return;

      const parsed = safeJsonParse<Partial<AppSettings>>(raw);
      if (!parsed || typeof parsed !== 'object') return;

      lastWrittenRef.current = raw;
      setSettings(mergeSettings(parsed));
    };

    window.addEventListener('storage', adoptExternalWrite);
    window.addEventListener('settings-updated', adoptExternalWrite);
    return () => {
      window.removeEventListener('storage', adoptExternalWrite);
      window.removeEventListener('settings-updated', adoptExternalWrite);
    };
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

  // Sync sound toggle to the shared utils/audio module so all beeps/dings respect it.
  useEffect(() => {
    setSoundEnabled(settings.workoutSettings.soundEnabled);
  }, [settings.workoutSettings.soundEnabled]);

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

/**
 * Same context, but `null` instead of a throw when no `SettingsProvider` is
 * above the caller.
 *
 * For stores that must defer to this provider as the single writer of
 * `appSettings` yet can legitimately mount without it — error-boundary
 * fallbacks render outside the provider (see hooks/useReducedMotion), as do
 * unit tests that mount a subtree on its own.
 */
export const useOptionalSettings = (): SettingsContextValue | null => useContext(SettingsContext);

export default SettingsContext;
