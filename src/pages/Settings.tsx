import {
  Bell,
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Dumbbell,
  RefreshCw,
  ArrowRightLeft,
  ArrowUpFromLine,
  User,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  copyToClipboard,
  exportWorkoutHistoryCSV,
  generateWeeklyReport,
  shareReport,
} from '../services/exportService';
import { STORES } from '../services/indexedDBCore';
import { pullAllData, syncAllData, testConnection } from '../services/supabaseSync';
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { safeJsonParseOr } from '../utils/safeJson';

// ============================================================================
// CONSTANTS
// ============================================================================

const THEMES = [
  { id: 'deepCosmos', name: 'יקום עמוק', color: '#6366f1' },
  { id: 'fireEnergy', name: 'אנרגיית אש', color: '#f97316' },
  { id: 'neonPulse', name: 'פולס ניאון', color: '#22d3ee' },
  { id: 'oceanWave', name: 'גל אוקיינוס', color: '#0ea5e9' },
  { id: 'forestGrove', name: 'יער ירוק', color: '#22c55e' },
];

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
// SUBCOMPONENTS
// ============================================================================

/** Editorial chapter-break section header */
function SectionLabel({
  children,
  num,
  titleEn,
}: {
  children: React.ReactNode;
  num?: string;
  titleEn?: string;
}) {
  if (num) {
    return (
      <div className="chapter-break mb-3" style={{ marginInline: 'calc(-1 * 1rem)' }}>
        <span className="left">
          §{num} · {titleEn}
        </span>
        <span className="right">{children}</span>
      </div>
    );
  }
  return <p className="section-title mb-3 px-1">{children}</p>;
}

/** Editorial settings card wrapper */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'var(--bone)',
        border: '2px solid var(--navy)',
      }}
    >
      {children}
    </div>
  );
}

/** A single row inside a settings card */
interface SettingsRowProps {
  icon?: React.ReactNode;
  iconBg?: string;
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}

function SettingsRow({ icon, label, children, divider = true }: SettingsRowProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
        {icon && (
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
          >
            {icon}
          </div>
        )}
        <span
          className="flex-1"
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--ink)',
          }}
        >
          {label}
        </span>
        <div className="shrink-0">{children}</div>
      </div>
      {divider && (
        <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />
      )}
    </div>
  );
}

/** iOS-style toggle switch — fully CSS, no inline styles */
interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label
      aria-label={label}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '52px',
        height: '28px',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: checked ? 'var(--mustard)' : 'var(--bone-deep)',
          border: '2px solid var(--navy)',
          transition: 'background 150ms ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '26px' : '2px',
          width: '20px',
          height: '20px',
          background: 'var(--navy)',
          transition: 'left 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          pointerEvents: 'none',
        }}
      />
    </label>
  );
}

/** Inline number input, right-aligned, #2C2C2E bg */
interface NumberInputProps {
  value: number | '';
  onChange: (val: number | '') => void;
  min?: number;
  max?: number;
  placeholder?: string;
  unit?: string;
}

function NumberInput({ value, onChange, min, max, placeholder, unit }: NumberInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder}
        className="input"
        style={{
          width: '80px',
          minHeight: '36px',
          padding: '6px 10px',
          textAlign: 'left',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
        }}
      />
      {unit && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            color: 'var(--stone)',
            textTransform: 'uppercase',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

/** Full-width save button */
interface SaveButtonProps {
  onClick: () => void;
  saved: boolean;
  label: string;
  savedLabel?: string;
}

function SaveButton({ onClick, saved, label, savedLabel = 'נשמר!' }: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={saved ? 'btn-secondary' : 'btn-primary'}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...(saved ? { color: 'var(--navy)', background: 'var(--mustard)' } : {}),
      }}
    >
      {saved ? (
        <>
          <Check size={17} />
          {savedLabel}
        </>
      ) : (
        <>
          <Save size={17} />
          {label}
        </>
      )}
    </button>
  );
}

// ============================================================================
// AVATAR — initials circle at top of profile section
// ============================================================================

function ProfileAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col items-center py-6">
      <div
        className="w-20 h-20 flex items-center justify-center mb-3"
        style={{ background: 'var(--navy)', color: 'var(--mustard)' }}
      >
        {initials ? (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '32px',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </span>
        ) : (
          <User size={32} />
        )}
      </div>
      {name.trim() && (
        <p
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontWeight: 800,
            fontSize: '22px',
            color: 'var(--ink)',
            textTransform: 'uppercase',
          }}
        >
          {name.trim()}
        </p>
      )}
      <p className="eyebrow mt-1" style={{ color: 'var(--stone)' }}>
        § PERSONAL PROFILE
      </p>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [nutrition, setNutrition] = useState<NutritionGoals>(DEFAULT_NUTRITION);
  const [workoutPrefs, setWorkoutPrefs] = useState<WorkoutPrefs>(DEFAULT_WORKOUT_PREFS);
  const [profileSaved, setProfileSaved] = useState(false);
  const [nutritionSaved, setNutritionSaved] = useState(false);
  const [workoutSaved, setWorkoutSaved] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

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
      // First sync local to cloud, then pull from cloud
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
  }, [settings.workoutSettings]);

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

  return (
    <div
      className="min-h-screen pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]"
      style={{ background: 'var(--bone)' }}
      dir="rtl"
    >
      {/* Masthead */}
      <header className="masthead safe-area-top">
        <div className="kicker">§07 · SETTINGS · CONFIG</div>
        <h1
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 'clamp(44px, 12vw, 72px)',
            lineHeight: 0.9,
            marginTop: '8px',
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
            color: 'var(--stone)',
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
            style={{ background: 'var(--bone)', border: '2px solid var(--navy)' }}
          >
            <ProfileAvatar name={profile.name} />
          </div>

          <SettingsCard>
            {/* Name */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <User size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
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
                  className="input"
                  style={{
                    width: '144px',
                    minHeight: '36px',
                    padding: '6px 10px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />
            </div>

            {/* Age */}
            <SettingsRow
              icon={
                <span className="font-barlow-condensed font-bold text-[13px] text-orange-400">
                  גיל
                </span>
              }
              iconBg="bg-orange-500/20"
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
                <span className="font-barlow-condensed font-bold text-[13px] text-teal-400">
                  גב'
                </span>
              }
              iconBg="bg-teal-500/20"
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
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <Target size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  מטרת משקל
                </span>
                <div className="relative flex items-center gap-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--navy)',
                      fontWeight: 600,
                    }}
                  >
                    {profile.weightGoal}
                  </span>
                  <ChevronLeft size={14} style={{ color: 'var(--stone)' }} />
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
              <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />
            </div>

            {/* Activity level */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <Zap size={15} />
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  רמת פעילות
                </span>
                <div className="relative flex items-center gap-1">
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--navy)',
                      fontWeight: 600,
                    }}
                  >
                    {profile.activityLevel}
                  </span>
                  <ChevronLeft size={14} style={{ color: 'var(--stone)' }} />
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

          <div className="mt-3">
            <SaveButton onClick={handleSaveProfile} saved={profileSaved} label="שמור פרופיל" />
          </div>
        </div>

        {/* ── NUTRITION SECTION ───────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="02" titleEn="NUTRITION · GOALS">
            יעדי תזונה
          </SectionLabel>
          <SettingsCard>
            <SettingsRow
              icon={<Target size={15} className="text-red-400" />}
              iconBg="bg-red-500/20"
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
              icon={<Dumbbell size={15} className="text-blue-400" />}
              iconBg="bg-blue-500/20"
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
                <span className="font-barlow-condensed font-bold text-[12px] text-yellow-400">
                  פח
                </span>
              }
              iconBg="bg-yellow-500/20"
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
                <span className="font-barlow-condensed font-bold text-[12px] text-orange-400">
                  שמ
                </span>
              }
              iconBg="bg-orange-500/20"
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
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <Dumbbell size={15} />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
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
                    className={`tab-item ${workoutPrefs.defaultRestTime === opt.value ? 'active' : ''}`}
                    style={{
                      border: '2px solid var(--navy)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />

            {/* Auto start rest */}
            <SettingsRow
              icon={<Bell size={15} className="text-green-400" />}
              iconBg="bg-green-500/20"
              label="התחלה אוטומטית של טיימר"
              divider={true}
            >
              <Toggle
                checked={workoutPrefs.autoStartRest}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, autoStartRest: !workoutPrefs.autoStartRest })
                }
                label="התחלה אוטומטית"
              />
            </SettingsRow>

            {/* Haptics */}
            <SettingsRow
              icon={<Zap size={15} className="text-yellow-400" />}
              iconBg="bg-yellow-500/20"
              label="רטט (Haptic Feedback)"
              divider={true}
            >
              <Toggle
                checked={workoutPrefs.hapticsEnabled}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, hapticsEnabled: !workoutPrefs.hapticsEnabled })
                }
                label="רטט"
              />
            </SettingsRow>

            <SettingsRow
              icon={<Bell size={15} className="text-blue-400" />}
              iconBg="bg-blue-500/20"
              label="הפחתת אנימציות"
              divider={true}
            >
              <Toggle
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
              icon={<User size={15} className="text-purple-400" />}
              iconBg="bg-purple-500/20"
              label="טקסט גדול"
              divider={true}
            >
              <Toggle
                checked={workoutPrefs.largeText}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, largeText: !workoutPrefs.largeText })
                }
                label="טקסט גדול"
              />
            </SettingsRow>

            <SettingsRow
              icon={<Zap size={15} className="text-orange-400" />}
              iconBg="bg-orange-500/20"
              label="ניגודיות גבוהה"
              divider={false}
            >
              <Toggle
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

        {/* ── THEME SECTION ───────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel num="04" titleEn="DISPLAY · THEME">
            תצוגה
          </SectionLabel>
          <SettingsCard>
            {THEMES.map((t, idx) => (
              <div key={t.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: t.id as typeof settings.theme })}
                  aria-pressed={settings.theme === t.id}
                  className="flex items-center gap-3 px-4 py-3.5 min-h-[56px] transition-colors"
                  style={{
                    background: settings.theme === t.id ? 'var(--bone-deep)' : 'transparent',
                  }}
                >
                  {/* Color square (editorial hard edge) */}
                  <div
                    className="w-8 h-8 shrink-0 transition-all duration-200"
                    style={{
                      backgroundColor: t.color,
                      border:
                        settings.theme === t.id ? '2px solid var(--navy)' : '2px solid transparent',
                    }}
                  />
                  <span
                    className="flex-1 text-right"
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '15px',
                      fontWeight: settings.theme === t.id ? 700 : 500,
                      color: 'var(--ink)',
                    }}
                  >
                    {t.name}
                  </span>
                  {settings.theme === t.id && (
                    <Check size={17} style={{ color: 'var(--navy)' }} strokeWidth={2.5} />
                  )}
                </button>
                {idx < THEMES.length - 1 && (
                  <div
                    style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }}
                  />
                )}
              </div>
            ))}
          </SettingsCard>
        </div>

        {/* ── DATA SECTION ─────────────────────────────────────────────────── */}
        <SectionLabel num="05" titleEn="DATA · STORAGE">
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
                  color: 'var(--stone)',
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
                  color: 'var(--stone)',
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
                    background: cloudConnected ? 'var(--mustard)' : 'var(--bone-deep)',
                    color: 'var(--navy)',
                  }}
                >
                  {cloudConnected ? <Cloud size={15} /> : <CloudOff size={15} />}
                </div>
                <span
                  className="flex-1"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  {cloudConnected ? 'מחובר לענן' : 'לא מחובר'}
                </span>
                {syncMessage && (
                  <span
                    className="animate-pulse"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      color: 'var(--navy)',
                      textTransform: 'uppercase',
                    }}
                    aria-live="polite"
                  >
                    {syncMessage}
                  </span>
                )}
              </div>
              <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />

              {/* Status Info Row */}
              <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
                {/* Pending Sync Count */}
                <div className="flex items-center gap-2">
                  <RefreshCw size={12} style={{ color: 'var(--stone)' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: pendingSyncCount > 0 ? 'var(--mustard)' : 'var(--stone)',
                      fontWeight: pendingSyncCount > 0 ? 600 : 400,
                    }}
                  >
                    בהמתנה: {pendingSyncCount}
                  </span>
                </div>

                {/* Last Sync Time */}
                {lastSyncTime && (
                  <div className="flex items-center gap-2">
                    <Check size={12} style={{ color: 'var(--stone)' }} />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--stone)',
                      }}
                    >
                      סנכרון אחרון: {lastSyncTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />
              <div
                className="btn-row"
                style={{ padding: '12px 16px', flexDirection: 'column', gap: '10px' }}
              >
                {/* Sync All Button - Primary */}
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                  className="btn-primary flex items-center justify-center gap-2"
                  style={{ minHeight: '44px', padding: '12px', fontSize: '13px' }}
                >
                  <ArrowUpFromLine size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                  סנכרון מלא
                </button>

                {/* Individual Sync Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSyncToCloud}
                    disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                    className="btn-primary flex items-center justify-center gap-2 flex-1"
                    style={{ minHeight: '44px', padding: '12px', fontSize: '12px' }}
                  >
                    <RefreshCw size={14} className={isSyncingUp ? 'animate-spin' : ''} />
                    {isSyncingUp ? 'מעלה...' : 'העלה לענן'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePullFromCloud}
                    disabled={isSyncingAll || isSyncingUp || isSyncingDown || !cloudConnected}
                    className="btn-secondary flex items-center justify-center gap-2 flex-1"
                    style={{ minHeight: '44px', padding: '12px', fontSize: '12px' }}
                  >
                    <Download size={14} className={isSyncingDown ? 'animate-spin' : ''} />
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
                className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors"
              >
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <Download size={15} />
                </div>
                <span
                  className="flex-1 text-right"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  ייצוא היסטוריית אימונים (CSV)
                </span>
              </button>
              <div style={{ height: '1px', background: 'var(--bone-deep)', margin: '0 16px' }} />
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
                className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors"
              >
                <div
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bone-deep)', color: 'var(--navy)' }}
                >
                  <Share2 size={15} />
                </div>
                <span
                  className="flex-1 text-right"
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  דוח שבועי
                </span>
              </button>
            </div>

            {weeklyReport && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--bone-deep)' }}>
                <pre
                  className="whitespace-pre-wrap max-h-[300px] overflow-y-auto"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--ink)',
                    background: 'var(--bone-deep)',
                    padding: '12px',
                    border: '1px solid var(--navy)',
                  }}
                >
                  {weeklyReport}
                </pre>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => shareReport(weeklyReport)}
                    className="chip"
                    style={{ background: 'var(--mustard)' }}
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
                    className="chip"
                  >
                    <Copy size={12} /> {copiedReport ? 'הועתק!' : 'העתק'}
                  </button>
                </div>
              </div>
            )}
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
