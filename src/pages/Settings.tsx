import {
  ArrowUpFromLine,
  Bell,
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Dumbbell,
  FileJson,
  Moon,
  RefreshCw,
  Share2,
  Target,
  User,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { SettingsCard } from '../components/ui/SettingsCard';
import { NumberInput } from '../components/ui/SettingsNumberInput';
import { SettingsRow } from '../components/ui/SettingsRow';
import { SaveButton } from '../components/ui/SettingsSaveButton';
import { SectionLabel } from '../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../components/ui/SettingsToggle';
import { useCoach } from '../contexts/CoachContext';
import { useSettings } from '../contexts/SettingsContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { getMyProfile, updateMyProfile } from '../services/coach/profileService';
import {
  copyToClipboard,
  exportWorkoutHistoryCSV,
  generateWeeklyReport,
  shareReport,
} from '../services/exportService';
import { STORES, dbClear } from '../services/indexedDBCore';
import { getCurrentUser, signOut } from '../services/supabaseAuth';
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { safeJsonParseOr } from '../utils/safeJson';
import { calculateTDEE, getMacroGoalsForGoal } from '../utils/tdee';

// ============================================================================
// CONSTANTS
// ============================================================================

const REST_TIME_OPTIONS = [
  { value: 30, label: '30 שנ' },
  { value: 60, label: '60 שנ' },
  { value: 90, label: '90 שנ' },
  { value: 120, label: '2 דק' },
  { value: 180, label: '3 דק' },
];

type WeightGoal = 'ירידה במשקל' | 'שמירה על משקל' | 'עלייה במסה';
type ActivityLevel = 'לא פעיל' | 'פעיל מעט' | 'פעיל מתון' | 'פעיל מאוד' | 'ספורטאי';

interface UserProfile {
  name: string;
  age: number | '';
  height: number | '';
  weightGoal: WeightGoal;
  activityLevel: ActivityLevel;
}

interface NutritionGoals {
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fat: number | '';
}

interface WorkoutPrefs {
  defaultRestTime: number;
  autoStartRest: boolean;
  hapticsEnabled: boolean;
  reducedAnimations: boolean;
  largeText: boolean;
  highContrast: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: '',
  height: '',
  weightGoal: 'שמירה על משקל',
  activityLevel: 'פעיל מתון',
};

const DEFAULT_NUTRITION: NutritionGoals = {
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

const DEFAULT_WORKOUT_PREFS: WorkoutPrefs = {
  defaultRestTime: 90,
  autoStartRest: true,
  hapticsEnabled: true,
  reducedAnimations: false,
  largeText: false,
  highContrast: false,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...safeJsonParseOr<Partial<T>>(raw, {} as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

export default function Settings() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();
  const navigate = useNavigate();
  const { isCoach, enable } = useCoach();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [nutrition, setNutrition] = useState<NutritionGoals>(DEFAULT_NUTRITION);
  const [workoutPrefs, setWorkoutPrefs] = useState<WorkoutPrefs>(DEFAULT_WORKOUT_PREFS);
  const [profileSaved, setProfileSaved] = useState(false);
  const [nutritionSaved, setNutritionSaved] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    workoutReminderEnabled: false,
    workoutReminderTime: '08:00',
    missedWorkoutAlertDays: 3,
    nutritionReminderEnabled: false,
    prNotificationEnabled: true,
  });
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Coaching
  const [coachName, setCoachName] = useState('');
  const [coachNameSaved, setCoachNameSaved] = useState(false);
  const [enablingCoach, setEnablingCoach] = useState(false);

  // Account / Auth state
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cloud sync state
  const [cloudConnected, setCloudConnected] = useState(false);
  const [isSyncingUp, setIsSyncingUp] = useState(false);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const LAST_SYNC_KEY = 'last_sync_time';

  const loadLastSyncTime = useCallback(() => {
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        setLastSyncTime(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Check Supabase connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!isSupabaseConfigured()) {
        setCloudConnected(false);
        return;
      }
      try {
        const { testConnection } = await import('../services/supabaseSync');
        const connected = await testConnection();
        setCloudConnected(connected);
      } catch {
        setCloudConnected(false);
      }
    };
    checkConnection();
    loadLastSyncTime();
  }, [loadLastSyncTime]);

  // Load pending sync count when sync completes
  const loadPendingCount = useCallback(async () => {
    try {
      const { dbGetAll: getAll } = await import('../services/indexedDBCore');
      const pending = await getAll(STORES.PENDING_SYNC);
      setPendingSyncCount(pending.length);
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
    // Refresh count periodically when there are pending items
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [loadPendingCount]);

  // Cloud sync handlers
  const handleSyncToCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingUp(true);
    setSyncMessage('מעלה לענן...');
    try {
      const { syncAllData } = await import('../services/supabaseSync');
      const result = await syncAllData();
      if (result.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        setSyncMessage(`הועלו ${result.syncedItems} פריטים!`);
      } else {
        setSyncMessage(result.error || 'שגיאה בהעלאה');
      }
    } catch {
      setSyncMessage('שגיאה בהעלאה');
    } finally {
      setIsSyncingUp(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handlePullFromCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingDown(true);
    setSyncMessage('מביא נתונים מהענן...');
    try {
      const { pullAllData } = await import('../services/supabaseSync');
      const result = await pullAllData();
      if (result.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        setSyncMessage(`התקבלו ${result.syncedItems} פריטים!`);
      } else {
        setSyncMessage(result.error || 'שגיאה בטעינה');
      }
    } catch {
      setSyncMessage('שגיאה בטעינה');
    } finally {
      setIsSyncingDown(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleSyncAll = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncingAll(true);
    setSyncMessage('מסנכרן הכל...');
    try {
      const { syncAllData, pullAllData } = await import('../services/supabaseSync');
      const syncResult = await syncAllData();
      if (!syncResult.success) {
        setSyncMessage(syncResult.error || 'שגיאה בסנכרון');
        return;
      }
      const pullResult = await pullAllData();
      if (pullResult.success) {
        const now = new Date().toLocaleString('he-IL');
        localStorage.setItem(LAST_SYNC_KEY, now);
        setLastSyncTime(now);
        const totalItems = (syncResult.syncedItems || 0) + (pullResult.syncedItems || 0);
        setSyncMessage(`סנכרון הושלם: ${totalItems} פריטים`);
      } else {
        setSyncMessage(pullResult.error || 'שגיאה בסנכרון');
      }
    } catch {
      setSyncMessage('שגיאה בסנכרון');
    } finally {
      setIsSyncingAll(false);
      loadPendingCount();
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

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
      loadFromStorage('notification_settings', {
        workoutReminderEnabled: false,
        workoutReminderTime: '08:00',
        missedWorkoutAlertDays: 3,
        nutritionReminderEnabled: false,
        prNotificationEnabled: true,
      })
    );
  }, [settings.workoutSettings]);

  // Load auth user email on mount
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) setAuthEmail(user.email ?? null);
    });
  }, []);

  // Load coach display name (online; degrades to empty offline)
  useEffect(() => {
    void getMyProfile().then((p) => {
      if (p?.displayName) setCoachName(p.displayName);
    });
  }, []);

  const handleDeleteAllData = async () => {
    const allStores = Object.values(STORES);
    for (const store of allStores) {
      await dbClear(store);
    }
    // Clear localStorage
    const keysToClear = ['user_profile', 'nutrition_goals', 'workout_prefs', 'last_sync_time'];
    for (const key of keysToClear) {
      localStorage.removeItem(key);
    }
    window.location.reload();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      logger.app.warn('handleSignOut: signOut threw', err);
    }
    setAuthEmail(null);
    // signOut clears IndexedDB and user-scoped localStorage. Reload so React
    // contexts re-hydrate from a clean slate and no stale data is shown.
    window.location.reload();
  };

  const handleSaveCoachName = async () => {
    await updateMyProfile({ displayName: coachName.trim() || null });
    setCoachNameSaved(true);
    setTimeout(() => setCoachNameSaved(false), 2000);
  };

  const handleEnableCoach = async () => {
    if (isCoach || enablingCoach) return;
    setEnablingCoach(true);
    try {
      await enable();
    } catch (err) {
      logger.app.warn('enable coach mode failed', err);
    } finally {
      setEnablingCoach(false);
    }
  };

  function handleSaveProfile() {
    saveToStorage('user_profile', profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleSaveNutrition() {
    saveToStorage('nutrition_goals', nutrition);
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
      [key]: !notificationSettings[key as keyof typeof notificationSettings],
    };
    setNotificationSettings(updated);
    saveToStorage('notification_settings', updated);
  };

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header */}
      <header
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
          paddingBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fs-muted)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          התאמות אישיות וסנכרון
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
            margin: '4px 0 0',
          }}
        >
          הגדרות
        </h1>
      </header>

      <div className="px-4 pt-5">
        <p
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            marginBottom: '20px',
          }}
        >
          התאמות מובייל, אימון, תזונה וסנכרון במקום אחד.
        </p>

        {/* ── PROFILE SECTION ─────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="01" titleEn="GENERAL · PROFILE">
            כללי
          </SectionLabel>

          {/* Avatar card */}
          <div
            className="mb-3"
            style={{
              borderRadius: '22px 16px 22px 16px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <ProfileAvatar name={profile.name} />
          </div>

          <SettingsCard>
            {/* Name */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                >
                  <User size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  שם
                </span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="הכנס שם..."
                  aria-label="שם"
                  style={{
                    width: '144px',
                    minHeight: '44px',
                    padding: '6px 10px',
                    fontSize: '14px',
                    backgroundColor: 'var(--fs-surface)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 0,
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-hebrew)',
                    outline: 'none',
                    textAlign: 'left',
                  }}
                />
              </div>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
            </div>

            {/* Age */}
            <SettingsRow
              icon={
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: 'var(--fs-warn)',
                  }}
                >
                  גיל
                </span>
              }
              label="גיל"
              divider={true}
            >
              <NumberInput
                value={profile.age}
                onChange={(v) => setProfile({ ...profile, age: v })}
                min={10}
                max={100}
                placeholder="—"
                unit="שנים"
              />
            </SettingsRow>

            {/* Height */}
            <SettingsRow
              icon={
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: 'var(--fs-accent-2)',
                  }}
                >
                  גב'
                </span>
              }
              label="גובה"
              divider={true}
            >
              <NumberInput
                value={profile.height}
                onChange={(v) => setProfile({ ...profile, height: v })}
                min={100}
                max={250}
                placeholder="—"
                unit='ס"מ'
              />
            </SettingsRow>

            {/* Weight goal */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                >
                  <Target size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  מטרת משקל
                </span>
                <div className="relative flex items-center gap-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--fs-heading)',
                      fontWeight: 600,
                    }}
                  >
                    {profile.weightGoal}
                  </span>
                  <ChevronLeft size={14} style={{ color: 'var(--fs-muted)' }} />
                  <select
                    value={profile.weightGoal}
                    onChange={(e) =>
                      setProfile({ ...profile, weightGoal: e.target.value as WeightGoal })
                    }
                    aria-label="מטרת משקל"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  >
                    <option>ירידה במשקל</option>
                    <option>שמירה על משקל</option>
                    <option>עלייה במסה</option>
                  </select>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
            </div>

            {/* Activity level */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                >
                  <Zap size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  רמת פעילות
                </span>
                <div className="relative flex items-center gap-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--fs-heading)',
                      fontWeight: 600,
                    }}
                  >
                    {profile.activityLevel}
                  </span>
                  <ChevronLeft size={14} style={{ color: 'var(--fs-muted)' }} />
                  <select
                    value={profile.activityLevel}
                    onChange={(e) =>
                      setProfile({ ...profile, activityLevel: e.target.value as ActivityLevel })
                    }
                    aria-label="רמת פעילות"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  >
                    <option>לא פעיל</option>
                    <option>פעיל מעט</option>
                    <option>פעיל מתון</option>
                    <option>פעיל מאוד</option>
                    <option>ספורטאי</option>
                  </select>
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Unit System Card */}
          <SettingsCard>
            <SettingsRow
              icon={
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--fs-heading)',
                  }}
                >
                  KG
                </span>
              }
              label="יחידות מידה"
            >
              <div
                style={{
                  display: 'flex',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-primary)',
                  borderRadius: 0,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => updateSettings({ unitSystem: 'metric' })}
                  style={{
                    padding: '6px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background:
                      settings.unitSystem === 'metric' ? 'var(--fs-primary)' : 'transparent',
                    color:
                      settings.unitSystem === 'metric' ? 'var(--fs-accent)' : 'var(--fs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    transition: 'all 150ms ease',
                  }}
                  aria-pressed={settings.unitSystem === 'metric'}
                >
                  מטרי
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ unitSystem: 'imperial' })}
                  style={{
                    padding: '6px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background:
                      settings.unitSystem === 'imperial' ? 'var(--fs-primary)' : 'transparent',
                    color:
                      settings.unitSystem === 'imperial' ? 'var(--fs-accent)' : 'var(--fs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    transition: 'all 150ms ease',
                  }}
                  aria-pressed={settings.unitSystem === 'imperial'}
                >
                  אימפריאלי
                </button>
              </div>
            </SettingsRow>
          </SettingsCard>

          <div className="mt-3">
            <SaveButton onClick={handleSaveProfile} saved={profileSaved} label="שמור פרופיל" />
          </div>
        </div>

        {/* ── ACCOUNT / AUTH SECTION ──────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="01b" titleEn="ACCOUNT · AUTH">
            חשבון
          </SectionLabel>
          <SettingsCard>
            <SettingsRow
              icon={<User size={15} />}
              label={authEmail ?? 'לא מחובר לחשבון'}
              divider={!!authEmail}
            >
              {authEmail ? (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    letterSpacing: '0.08em',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {authEmail}
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '13px',
                    color: 'var(--fs-muted)',
                  }}
                >
                  לא מחובר
                </span>
              )}
            </SettingsRow>
            {authEmail && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    padding: '12px',
                    borderRadius: 0,
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: '1px solid var(--fs-surface-2)',
                    cursor: 'pointer',
                    color: 'var(--fs-ink)',
                    background: 'var(--fs-surface)',
                  }}
                >
                  התנתק
                </button>
              </div>
            )}
          </SettingsCard>
        </div>

        {/* ── COACHING SECTION ────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="01c" titleEn="COACHING · COACH">
            מאמן
          </SectionLabel>
          <SettingsCard>
            {/* Display name */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                >
                  <User size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  שם תצוגה
                </span>
                <input
                  type="text"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="שם לתצוגה..."
                  aria-label="שם תצוגה"
                  style={{
                    width: '144px',
                    minHeight: '44px',
                    padding: '6px 10px',
                    fontSize: '14px',
                    backgroundColor: 'var(--fs-surface)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 0,
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-hebrew)',
                    outline: 'none',
                    textAlign: 'left',
                  }}
                />
              </div>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
            </div>

            {/* Coach mode toggle */}
            <SettingsRow icon={<UserCog size={15} />} label="מצב מאמן" divider={true}>
              <SettingsToggle checked={isCoach} onChange={handleEnableCoach} label="מצב מאמן" />
            </SettingsRow>

            {/* Navigation to coach + trainee hubs */}
            {(
              [
                { label: 'מרכז המאמן', icon: <UserCog size={15} />, to: '/coach' },
                { label: 'המאמן שלי', icon: <Users size={15} />, to: '/my-coach' },
              ] as const
            ).map((row, i, arr) => (
              <div className="flex flex-col" key={row.to}>
                <button
                  type="button"
                  onClick={() => navigate(row.to)}
                  className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] w-full text-right"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                  >
                    {row.icon}
                  </div>
                  <span
                    className="flex-1"
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {row.label}
                  </span>
                  <ChevronLeft size={16} style={{ color: 'var(--fs-muted)' }} />
                </button>
                {i < arr.length - 1 && (
                  <div
                    style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }}
                  />
                )}
              </div>
            ))}
          </SettingsCard>

          <div className="mt-3">
            <SaveButton
              onClick={handleSaveCoachName}
              saved={coachNameSaved}
              label="שמור שם תצוגה"
            />
          </div>
        </div>

        {/* ── NUTRITION SECTION ───────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="02" titleEn="NUTRITION · GOALS">
            יעדי תזונה
          </SectionLabel>

          {profile.age && profile.height && profile.weightGoal && profile.activityLevel && (
            <button
              type="button"
              onClick={() => {
                const storedProfile = loadFromStorage<{ weight?: number; gender?: string }>(
                  'user_profile',
                  {}
                );
                const weightKg =
                  typeof storedProfile.weight === 'number' ? storedProfile.weight : 70;
                const heightCm = typeof profile.height === 'number' ? profile.height : 175;
                const age = typeof profile.age === 'number' ? profile.age : 25;
                const gender = (storedProfile.gender as 'male' | 'female' | 'other') ?? 'male';
                const tdee = calculateTDEE(weightKg, heightCm, age, gender, profile.activityLevel);
                const macros = getMacroGoalsForGoal(tdee, profile.weightGoal);
                setNutrition({
                  calories: macros.calories,
                  protein: macros.protein,
                  carbs: macros.carbs,
                  fat: macros.fat,
                });
              }}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: '10px 16px',
                background: 'var(--fs-primary)',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fs-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Zap size={13} />
              חשב אוטומטית מהפרופיל (TDEE)
            </button>
          )}

          <SettingsCard>
            <SettingsRow
              icon={<Target size={15} style={{ color: 'var(--fs-warn)' }} />}
              label="קלוריות יומיות"
              divider={true}
            >
              <NumberInput
                value={nutrition.calories}
                onChange={(v) => setNutrition({ ...nutrition, calories: v })}
                min={0}
                placeholder="—"
                unit="קל'"
              />
            </SettingsRow>

            <SettingsRow
              icon={<Dumbbell size={15} style={{ color: 'var(--fs-accent)' }} />}
              label="חלבון"
              divider={true}
            >
              <NumberInput
                value={nutrition.protein}
                onChange={(v) => setNutrition({ ...nutrition, protein: v })}
                min={0}
                placeholder="—"
                unit="גר'"
              />
            </SettingsRow>

            <SettingsRow
              icon={
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: 'var(--fs-accent-2)',
                  }}
                >
                  פח
                </span>
              }
              label="פחמימות"
              divider={true}
            >
              <NumberInput
                value={nutrition.carbs}
                onChange={(v) => setNutrition({ ...nutrition, carbs: v })}
                min={0}
                placeholder="—"
                unit="גר'"
              />
            </SettingsRow>

            <SettingsRow
              icon={
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: 'var(--fs-warn)',
                  }}
                >
                  שמ
                </span>
              }
              label="שומן"
              divider={false}
            >
              <NumberInput
                value={nutrition.fat}
                onChange={(v) => setNutrition({ ...nutrition, fat: v })}
                min={0}
                placeholder="—"
                unit="גר'"
              />
            </SettingsRow>
          </SettingsCard>

          <div className="mt-3">
            <SaveButton
              onClick={handleSaveNutrition}
              saved={nutritionSaved}
              label="שמור יעדי תזונה"
            />
          </div>
        </div>

        {/* ── WORKOUT SETTINGS SECTION ─────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="03" titleEn="TRAINING · PREFS">
            אימון
          </SectionLabel>
          <SettingsCard>
            {/* Rest time pills */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
                >
                  <Dumbbell size={15} />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  זמן מנוחה ברירת מחדל
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pr-11">
                {REST_TIME_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setWorkoutPrefs({ ...workoutPrefs, defaultRestTime: opt.value })}
                    style={{
                      padding: '8px 14px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 0,
                      cursor: 'pointer',
                      border: '1px solid var(--fs-surface-2)',
                      transition: 'all 0.15s ease',
                      ...(workoutPrefs.defaultRestTime === opt.value
                        ? { background: 'var(--fs-primary)', color: 'var(--fs-accent)' }
                        : { background: 'transparent', color: 'var(--fs-muted)' }),
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />

            {/* Auto start rest */}
            <SettingsRow
              icon={<Bell size={15} style={{ color: 'var(--fs-accent)' }} />}
              label="התחלה אוטומטית של טיימר"
              divider={true}
            >
              <SettingsToggle
                checked={workoutPrefs.autoStartRest}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, autoStartRest: !workoutPrefs.autoStartRest })
                }
                label="התחלה אוטומטית"
              />
            </SettingsRow>

            {/* Haptics */}
            <SettingsRow
              icon={<Zap size={15} style={{ color: 'var(--fs-accent)' }} />}
              label="רטט (Haptic Feedback)"
              divider={true}
            >
              <SettingsToggle
                checked={workoutPrefs.hapticsEnabled}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, hapticsEnabled: !workoutPrefs.hapticsEnabled })
                }
                label="רטט"
              />
            </SettingsRow>

            <SettingsRow
              icon={<Bell size={15} style={{ color: 'var(--fs-accent-2)' }} />}
              label="הפחתת אנימציות"
              divider={true}
            >
              <SettingsToggle
                checked={workoutPrefs.reducedAnimations}
                onChange={() =>
                  setWorkoutPrefs({
                    ...workoutPrefs,
                    reducedAnimations: !workoutPrefs.reducedAnimations,
                  })
                }
                label="הפחתת אנימציות"
              />
            </SettingsRow>

            <SettingsRow
              icon={<User size={15} style={{ color: 'var(--fs-accent)' }} />}
              label="טקסט גדול"
              divider={true}
            >
              <SettingsToggle
                checked={workoutPrefs.largeText}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, largeText: !workoutPrefs.largeText })
                }
                label="טקסט גדול"
              />
            </SettingsRow>

            <SettingsRow
              icon={<Zap size={15} style={{ color: 'var(--fs-accent-2)' }} />}
              label="ניגודיות גבוהה"
              divider={false}
            >
              <SettingsToggle
                checked={workoutPrefs.highContrast}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, highContrast: !workoutPrefs.highContrast })
                }
                label="ניגודיות גבוהה"
              />
            </SettingsRow>
          </SettingsCard>

          <div className="mt-3">
            <SaveButton
              onClick={handleSaveWorkout}
              saved={workoutSaved}
              label="שמור הגדרות אימון"
            />
          </div>
        </div>

        {/* ── NOTIFICATION SETTINGS SECTION ─────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="04" titleEn="NOTIFICATIONS · ALERTS">
            התראות
          </SectionLabel>
          <SettingsCard>
            <SettingsRow icon={<Bell size={15} />} label="תזכורת אימון" divider={true}>
              <SettingsToggle
                checked={notificationSettings.workoutReminderEnabled}
                onChange={() => toggleNotification('workoutReminderEnabled')}
                label="תזכורת אימון"
              />
            </SettingsRow>

            <SettingsRow icon={<Bell size={15} />} label="תזכורת תזונה" divider={true}>
              <SettingsToggle
                checked={notificationSettings.nutritionReminderEnabled}
                onChange={() => toggleNotification('nutritionReminderEnabled')}
                label="תזכורת תזונה"
              />
            </SettingsRow>

            <SettingsRow icon={<Bell size={15} />} label="התראת שיא אישי (PR)" divider={false}>
              <SettingsToggle
                checked={notificationSettings.prNotificationEnabled}
                onChange={() => toggleNotification('prNotificationEnabled')}
                label="התראת PR"
              />
            </SettingsRow>
          </SettingsCard>
        </div>

        {/* ── THEME SECTION ───────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="05" titleEn="DISPLAY · THEME">
            תצוגה
          </SectionLabel>
          <SettingsCard>
            <SettingsRow
              icon={
                <div
                  className="w-8 h-8 shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--fs-primary)',
                    border: '2px solid var(--fs-primary)',
                    borderRadius: 0,
                  }}
                >
                  <Moon size={16} style={{ color: 'var(--fs-accent)' }} strokeWidth={2.5} />
                </div>
              }
              label="מצב כהה"
            >
              <SettingsToggle
                checked={settings.darkMode}
                onChange={() => updateSettings({ darkMode: !settings.darkMode })}
                label="מצב כהה"
              />
            </SettingsRow>
          </SettingsCard>
        </div>

        {/* ── DATA SECTION ─────────────────────────────────────────────────── */}
        <SectionLabel num="06" titleEn="DATA · STORAGE">
          נתונים
        </SectionLabel>

        {/* ── ABOUT SECTION ───────────────────────────────────────────────── */}
        <div className="mb-4">
          <SettingsCard>
            <SettingsRow label="גרסה" divider={true}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  color: 'var(--fs-muted)',
                }}
              >
                1.0.0
              </span>
            </SettingsRow>
            <SettingsRow label="SparkOS Fitness" divider={false}>
              <span
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '13px',
                  color: 'var(--fs-muted)',
                }}
              >
                אפליקציית כושר
              </span>
            </SettingsRow>
          </SettingsCard>
        </div>

        {/* ── CLOUD SYNC SECTION ─────────────────────────────────────────── */}
        {isSupabaseConfigured() && (
          <div className="mb-7">
            <p className="section-title mb-3 px-1">§ CLOUD SYNC · סנכרון ענן</p>
            <SettingsCard>
              {/* Connection Status Row */}
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{
                    background: cloudConnected ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                    color: cloudConnected ? 'var(--fs-primary)' : 'var(--fs-muted)',
                    borderRadius: 0,
                  }}
                >
                  {cloudConnected ? <Cloud size={15} /> : <CloudOff size={15} />}
                </div>
                <span
                  className="flex-1 flex items-center gap-2"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {cloudConnected && <span className="breathing-dot signal" />}
                  {cloudConnected ? 'מחובר לענן' : 'לא מחובר'}
                </span>
                {syncMessage && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      color: 'var(--fs-accent)',
                      textTransform: 'uppercase',
                    }}
                    aria-live="polite"
                  >
                    {syncMessage}
                  </span>
                )}
              </div>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />

              {/* Status Info Row */}
              <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
                {/* Pending Sync Count */}
                <div className="flex items-center gap-2">
                  <RefreshCw size={12} style={{ color: 'var(--fs-muted)' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: pendingSyncCount > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                      fontWeight: pendingSyncCount > 0 ? 600 : 400,
                    }}
                  >
                    בהמתנה: {pendingSyncCount}
                  </span>
                </div>

                {/* Last Sync Time */}
                {lastSyncTime && (
                  <div className="flex items-center gap-2">
                    <Check size={12} style={{ color: 'var(--fs-muted)' }} />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      סנכרון אחרון: {lastSyncTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Sync All Button - Primary */}
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                  style={{
                    minHeight: '44px',
                    padding: '12px',
                    fontSize: '13px',
                    borderRadius: 0,
                    fontFamily: 'var(--font-hebrew)',
                    fontWeight: 600,
                    border: 'none',
                    cursor:
                      isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity:
                      isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected ? 0.5 : 1,
                    background: 'var(--fs-primary)',
                    color: 'var(--fs-accent)',
                  }}
                >
                  <ArrowUpFromLine size={14} />
                  סנכרון מלא
                </button>

                {/* Individual Sync Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSyncToCloud}
                    disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '12px',
                      fontSize: '12px',
                      borderRadius: 0,
                      fontFamily: 'var(--font-hebrew)',
                      fontWeight: 600,
                      border: 'none',
                      cursor:
                        isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected
                          ? 'not-allowed'
                          : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity:
                        isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected ? 0.5 : 1,
                      background: 'var(--fs-primary)',
                      color: 'var(--fs-accent)',
                    }}
                  >
                    <RefreshCw size={14} />
                    {isSyncingUp ? 'מעלה...' : 'העלה לענן'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePullFromCloud}
                    disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '12px',
                      fontSize: '12px',
                      borderRadius: 0,
                      fontFamily: 'var(--font-hebrew)',
                      fontWeight: 600,
                      border: '1px solid var(--fs-primary)',
                      cursor:
                        isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected
                          ? 'not-allowed'
                          : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity:
                        isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected ? 0.5 : 1,
                      background: 'transparent',
                      color: 'var(--fs-ink)',
                    }}
                  >
                    <Download size={14} />
                    {isSyncingDown ? 'מביא...' : 'הורד מענן'}
                  </button>
                </div>
              </div>
            </SettingsCard>
          </div>
        )}

        {/* ── EXPORT & SHARE SECTION ────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="section-title mb-3 px-1">§ EXPORT · ייצוא ושיתוף</p>
          <SettingsCard>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { dbGetAll, STORES } = await import('../services/indexedDBCore');
                    const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
                    exportWorkoutHistoryCSV(sessions);
                  } catch (e) {
                    logger.app.error('Export failed', e);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  minHeight: '52px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'right',
                }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--fs-surface-2)',
                    color: 'var(--fs-heading)',
                    borderRadius: '8px',
                  }}
                >
                  <Download size={15} />
                </div>
                <span
                  className="flex-1 text-right"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  ייצוא היסטוריית אימונים (CSV)
                </span>
              </button>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
            </div>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { dbGetAll, STORES } = await import('../services/indexedDBCore');
                    const [sessions, templates, personalExercises, personalRecords] =
                      await Promise.all([
                        dbGetAll(STORES.WORKOUT_SESSIONS),
                        dbGetAll(STORES.WORKOUT_TEMPLATES),
                        dbGetAll(STORES.PERSONAL_EXERCISES),
                        dbGetAll(STORES.PERSONAL_RECORDS),
                      ]);
                    const backup = {
                      version: '1.0.0',
                      exportDate: new Date().toISOString(),
                      data: { sessions, templates, personalExercises, personalRecords },
                      settings: {
                        userProfile: localStorage.getItem('user_profile'),
                        workoutPrefs: localStorage.getItem('workout_prefs'),
                        nutritionGoals: localStorage.getItem('nutrition_goals'),
                      },
                    };
                    const blob = new Blob([JSON.stringify(backup, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sparkos-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    logger.app.error('Backup export failed', e);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  minHeight: '52px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'right',
                }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--fs-surface-2)',
                    color: 'var(--fs-heading)',
                    borderRadius: '8px',
                  }}
                >
                  <FileJson size={15} />
                </div>
                <span
                  className="flex-1 text-right"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  גיבוי מלא (JSON)
                </span>
              </button>
              <div style={{ height: '1px', background: 'var(--fs-surface-2)', margin: '0 16px' }} />
            </div>

            <div className="flex flex-col">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const report = await generateWeeklyReport();
                    setWeeklyReport(report);
                  } catch (e) {
                    logger.app.error('Report generation failed', e);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  minHeight: '52px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'right',
                }}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--fs-surface-2)',
                    color: 'var(--fs-heading)',
                    borderRadius: '8px',
                  }}
                >
                  <Share2 size={15} />
                </div>
                <span
                  className="flex-1 text-right"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--fs-ink)',
                  }}
                >
                  דוח שבועי
                </span>
              </button>
            </div>

            {weeklyReport && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
                <pre
                  className="whitespace-pre-wrap max-h-[300px] overflow-y-auto"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--fs-ink)',
                    background: 'var(--fs-surface-2)',
                    padding: '12px',
                    border: '1px solid var(--fs-primary)',
                    borderRadius: 0,
                  }}
                >
                  {weeklyReport}
                </pre>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => shareReport(weeklyReport)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 0,
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'var(--fs-accent)',
                      color: 'var(--fs-heading)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Share2 size={12} /> שתף
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(weeklyReport);
                      setCopiedReport(true);
                      setTimeout(() => setCopiedReport(false), 2000);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 0,
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'var(--fs-surface-2)',
                      color: 'var(--fs-ink)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Copy size={12} /> {copiedReport ? 'הועתק!' : 'העתק'}
                  </button>
                </div>
              </div>
            )}
          </SettingsCard>
        </div>

        {/* ── DANGER ZONE ─────────────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="section-title mb-3 px-1" style={{ color: 'var(--fs-warn)' }}>
            § DANGER · אזור מסוכן
          </p>
          <SettingsCard>
            <div className="px-4 py-4">
              <p
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  color: 'var(--fs-ink)',
                  marginBottom: '12px',
                }}
              >
                מחיקת כל הנתונים תנקה את כל האימונים, ההעדפות וההגדרות. פעולה זו בלתי הפיכה.
              </p>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '12px',
                    borderRadius: 0,
                    border: '2px solid var(--fs-warn)',
                    background: 'transparent',
                    color: 'var(--fs-warn)',
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  מחק את כל הנתונים
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAllData}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '12px',
                      borderRadius: 0,
                      border: '2px solid var(--fs-warn)',
                      background: 'var(--fs-warn)',
                      color: 'var(--fs-ink)',
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    אשר מחיקה
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '12px',
                      borderRadius: 0,
                      border: '1px solid var(--fs-surface-2)',
                      background: 'transparent',
                      color: 'var(--fs-ink)',
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    ביטול
                  </button>
                </div>
              )}
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
