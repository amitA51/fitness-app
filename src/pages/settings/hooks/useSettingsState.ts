import { useEffect, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  getNotificationConfig,
  requestNotificationPermission,
  saveNotificationConfig,
} from '../../../services/notificationService';
import type { NotificationConfig } from '../../../services/notificationService';
import { getCurrentUser } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import type { UserProfile, WorkoutPrefs } from '../types';
import { DEFAULT_PROFILE, DEFAULT_WORKOUT_PREFS, loadFromStorage, saveToStorage } from '../types';

export function useSettingsState() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [workoutPrefs, setWorkoutPrefs] = useState<WorkoutPrefs>(DEFAULT_WORKOUT_PREFS);
  const [profileSaved, setProfileSaved] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(() =>
    getNotificationConfig()
  );
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Account / Auth state
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load from storage + settings context on mount.
  // Workout prefs hold ONLY real workout knobs; accessibility/display toggles
  // and dark mode are owned by SettingsContext (see "תצוגה ונגישות" section).
  // Nutrition-goal editing lives in the Nutrition screen now, not here.
  useEffect(() => {
    setProfile(loadFromStorage<UserProfile>('user_profile', DEFAULT_PROFILE));
    setWorkoutPrefs({
      ...loadFromStorage<WorkoutPrefs>('workout_prefs', DEFAULT_WORKOUT_PREFS),
      defaultRestTime: settings.workoutSettings.defaultRestTime,
      autoStartRest: settings.workoutSettings.autoStartRest,
      hapticsEnabled: settings.workoutSettings.hapticsEnabled,
    });
  }, [
    settings.workoutSettings.defaultRestTime,
    settings.workoutSettings.autoStartRest,
    settings.workoutSettings.hapticsEnabled,
  ]);

  // Load auth user email on mount
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) setAuthEmail(user.email ?? null);
    });
  }, []);

  function handleSaveProfile() {
    saveToStorage('user_profile', profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleSaveWorkout() {
    saveToStorage('workout_prefs', workoutPrefs);
    updateWorkoutSettings({
      defaultRestTime: workoutPrefs.defaultRestTime,
      autoStartRest: workoutPrefs.autoStartRest,
      hapticsEnabled: workoutPrefs.hapticsEnabled,
    });
    setWorkoutSaved(true);
    setTimeout(() => setWorkoutSaved(false), 2000);
  }

  // Wire notification toggles directly to notificationService (unified
  // CONFIG_KEY). Turning a toggle on requests browser permission so the
  // persisted config is actually actionable rather than a dead switch.
  const toggleNotification = async (key: keyof NotificationConfig) => {
    const nextEnabled = !notificationConfig[key];
    if (nextEnabled) {
      try {
        await requestNotificationPermission();
      } catch (err) {
        logger.app.warn('requestNotificationPermission failed', err);
      }
    }
    const updated = saveNotificationConfig({ [key]: nextEnabled });
    setNotificationConfig(updated);
  };

  return {
    settings,
    updateSettings,
    profile,
    setProfile,
    workoutPrefs,
    setWorkoutPrefs,
    profileSaved,
    workoutSaved,
    notificationConfig,
    toggleNotification,
    weeklyReport,
    setWeeklyReport,
    copiedReport,
    setCopiedReport,
    authEmail,
    setAuthEmail,
    confirmDelete,
    setConfirmDelete,
    handleSaveProfile,
    handleSaveWorkout,
  };
}
