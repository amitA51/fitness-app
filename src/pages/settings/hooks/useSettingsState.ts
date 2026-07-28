import { useCallback, useEffect, useState } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../../services/coach/pushService';
import { mirrorLocalKey } from '../../../services/localStateMirror';
import {
  getNotificationConfig,
  requestNotificationPermission,
  saveNotificationConfig,
} from '../../../services/notificationService';
import type { NotificationConfig } from '../../../services/notificationService';
import { getCurrentUser } from '../../../services/supabaseAuth';
import { logger } from '../../../utils/logger';
import type { UserProfile, WorkoutPrefs } from '../types';
import {
  AUTOSAVE_DEBOUNCE_MS,
  DEFAULT_PROFILE,
  DEFAULT_WORKOUT_PREFS,
  loadFromStorage,
  saveToStorage,
} from '../types';
import { useAutosave, useSavedFlash } from './useAutosave';

export function useSettingsState() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [workoutPrefs, setWorkoutPrefs] = useState<WorkoutPrefs>(DEFAULT_WORKOUT_PREFS);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(() =>
    getNotificationConfig()
  );
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Account / Auth state
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  // Web-Push enrollment state — resolved asynchronously on mount
  const [pushEnabled, setPushEnabled] = useState(false);

  // Autosave engines own the persistence + the shared "נשמר" flash. Profile is
  // pure localStorage; workout prefs also mirror three knobs into SettingsContext
  // so they keep applying app-wide (rest timer, auto-start, haptics).
  //
  // `mirrorLocalKey` additionally copies the value into the cloud-synced
  // user_settings store. Without it these keys were localStorage-ONLY while also
  // being wiped on an account switch, so a user's body metrics, goals and
  // preferences were unrecoverable — the same defect that destroyed a real user's
  // program progress. See services/localStateMirror.
  const profileAutosave = useAutosave<UserProfile>((next) => {
    const ok = saveToStorage('user_profile', next);
    mirrorLocalKey('user_profile');
    return ok;
  }, AUTOSAVE_DEBOUNCE_MS);
  const workoutAutosave = useAutosave<WorkoutPrefs>((next) => {
    const ok = saveToStorage('workout_prefs', next);
    updateWorkoutSettings({
      defaultRestTime: next.defaultRestTime,
      autoStartRest: next.autoStartRest,
      hapticsEnabled: next.hapticsEnabled,
    });
    mirrorLocalKey('workout_prefs');
    return ok;
  }, AUTOSAVE_DEBOUNCE_MS);
  const notificationsFlash = useSavedFlash();

  // Load profile once on mount — kept independent of the workout-settings sync
  // below so a context change never clobbers an in-flight (debounced) edit.
  useEffect(() => {
    setProfile(loadFromStorage<UserProfile>('user_profile', DEFAULT_PROFILE));
  }, []);

  // Workout prefs hold ONLY real workout knobs; accessibility/display toggles and
  // dark mode are owned by SettingsContext (see "תצוגה ונגישות" section). Load
  // from storage and keep the context-owned knobs in sync.
  useEffect(() => {
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

  // Resolve initial push-enabled state: supported + permission granted + active SW subscription
  useEffect(() => {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setPushEnabled(true);
      })
      .catch((err) => {
        logger.app.warn('useSettingsState: push subscription check failed', err);
      });
  }, []);

  // ── Autosave entry points exposed to the sections ──────────────────────────
  // `update*` debounces (free-text / number fields); `commit*` flushes
  // immediately (discrete choices: selects, toggles, rest-time pills). Both set
  // React state right away so the UI stays responsive.

  const updateProfile = useCallback(
    (next: UserProfile) => {
      setProfile(next);
      profileAutosave.saveDebounced(next);
    },
    [profileAutosave.saveDebounced]
  );

  const commitProfile = useCallback(
    (next: UserProfile) => {
      setProfile(next);
      profileAutosave.saveNow(next);
    },
    [profileAutosave.saveNow]
  );

  const commitWorkout = useCallback(
    (next: WorkoutPrefs) => {
      setWorkoutPrefs(next);
      workoutAutosave.saveNow(next);
    },
    [workoutAutosave.saveNow]
  );

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
    notificationsFlash.flash();
  };

  const togglePush = useCallback(async () => {
    if (pushEnabled) {
      await unsubscribeFromPush();
      setPushEnabled(false);
      return;
    }
    const result = await subscribeToPush();
    if (result.ok) {
      setPushEnabled(true);
      return;
    }
    // Map service errors to Hebrew toasts
    const errorMessages: Record<string, string> = {
      unsupported: 'הדפדפן לא תומך בהתראות',
      denied: 'ההתראות חסומות בדפדפן — אפשר לאפשר בהגדרות האתר',
      no_vapid_key: 'התראות לא מוגדרות בסביבה זו',
      offline: 'אין חיבור — נסו שוב מאוחר יותר',
    };
    const message = (result.error && errorMessages[result.error]) ?? 'הפעלת ההתראות נכשלה';
    showToast(message, 'error');
  }, [pushEnabled]);

  return {
    settings,
    updateSettings,
    profile,
    updateProfile,
    commitProfile,
    profileSaved: profileAutosave.saved,
    workoutPrefs,
    commitWorkout,
    workoutSaved: workoutAutosave.saved,
    notificationConfig,
    toggleNotification,
    notificationsSaved: notificationsFlash.saved,
    pushEnabled,
    togglePush,
    weeklyReport,
    setWeeklyReport,
    copiedReport,
    setCopiedReport,
    authEmail,
    setAuthEmail,
  };
}
