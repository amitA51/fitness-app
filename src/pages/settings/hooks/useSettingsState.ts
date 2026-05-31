import { useEffect, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { getMyProfile } from '../../../services/coach/profileService';
import { getCurrentUser } from '../../../services/supabaseAuth';
import type { NotificationSettings, NutritionGoals, UserProfile, WorkoutPrefs } from '../types';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_NUTRITION,
  DEFAULT_PROFILE,
  DEFAULT_WORKOUT_PREFS,
  loadFromStorage,
  saveToStorage,
} from '../types';

export function useSettingsState() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [nutrition, setNutrition] = useState<NutritionGoals>(DEFAULT_NUTRITION);
  const [workoutPrefs, setWorkoutPrefs] = useState<WorkoutPrefs>(DEFAULT_WORKOUT_PREFS);
  const [profileSaved, setProfileSaved] = useState(false);
  const [nutritionSaved, setNutritionSaved] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Coaching
  const [coachName, setCoachName] = useState('');
  const [coachNameSaved, setCoachNameSaved] = useState(false);
  const [enablingCoach, setEnablingCoach] = useState(false);

  // Account / Auth state
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load from storage + settings context on mount
  useEffect(() => {
    setProfile(loadFromStorage<UserProfile>('user_profile', DEFAULT_PROFILE));
    setNutrition(loadFromStorage<NutritionGoals>('nutrition_goals', DEFAULT_NUTRITION));
    setWorkoutPrefs({
      ...loadFromStorage<WorkoutPrefs>('workout_prefs', DEFAULT_WORKOUT_PREFS),
      defaultRestTime: settings.workoutSettings.defaultRestTime,
      autoStartRest: settings.workoutSettings.autoStartRest,
      hapticsEnabled: settings.workoutSettings.hapticsEnabled,
      reducedAnimations: settings.workoutSettings.reducedAnimations,
      largeText: settings.workoutSettings.largeText,
      highContrast: settings.workoutSettings.highContrast,
    });
    setNotificationSettings(
      loadFromStorage('notification_settings', DEFAULT_NOTIFICATION_SETTINGS)
    );
  }, [
    settings.workoutSettings.defaultRestTime,
    settings.workoutSettings.autoStartRest,
    settings.workoutSettings.hapticsEnabled,
    settings.workoutSettings.reducedAnimations,
    settings.workoutSettings.largeText,
    settings.workoutSettings.highContrast,
  ]);

  // Load auth user email on mount
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) setAuthEmail(user.email ?? null);
    });
  }, []);

  // Load coach display name
  useEffect(() => {
    void getMyProfile().then((p) => {
      if (p?.displayName) setCoachName(p.displayName);
    });
  }, []);

  function handleSaveProfile() {
    saveToStorage('user_profile', profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleSaveNutrition() {
    saveToStorage('nutrition_goals', nutrition);
    window.dispatchEvent(new CustomEvent('settings-updated'));
    setNutritionSaved(true);
    setTimeout(() => setNutritionSaved(false), 2000);
  }

  function handleSaveWorkout() {
    saveToStorage('workout_prefs', workoutPrefs);
    updateWorkoutSettings({
      defaultRestTime: workoutPrefs.defaultRestTime,
      autoStartRest: workoutPrefs.autoStartRest,
      hapticsEnabled: workoutPrefs.hapticsEnabled,
      reducedAnimations: workoutPrefs.reducedAnimations,
      largeText: workoutPrefs.largeText,
      highContrast: workoutPrefs.highContrast,
    });
    setWorkoutSaved(true);
    setTimeout(() => setWorkoutSaved(false), 2000);
  }

  const toggleNotification = (key: string) => {
    const updated = {
      ...notificationSettings,
      [key]: !notificationSettings[key as keyof NotificationSettings],
    };
    setNotificationSettings(updated);
    saveToStorage('notification_settings', updated);
  };

  return {
    settings,
    updateSettings,
    profile,
    setProfile,
    nutrition,
    setNutrition,
    workoutPrefs,
    setWorkoutPrefs,
    profileSaved,
    nutritionSaved,
    workoutSaved,
    notificationSettings,
    toggleNotification,
    weeklyReport,
    setWeeklyReport,
    copiedReport,
    setCopiedReport,
    coachName,
    setCoachName,
    coachNameSaved,
    setCoachNameSaved,
    enablingCoach,
    setEnablingCoach,
    authEmail,
    setAuthEmail,
    confirmDelete,
    setConfirmDelete,
    handleSaveProfile,
    handleSaveNutrition,
    handleSaveWorkout,
  };
}
