import { useState, useEffect } from 'react';
import { User, Target, Dumbbell, Save, Check, Bell, Zap, ChevronLeft, Download, Share2, Copy, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { exportWorkoutHistoryCSV, generateWeeklyReport, shareReport, copyToClipboard } from '../services/exportService';
import { syncAllData, pullAllData, testConnection } from '../services/supabaseSync';
import { isSupabaseConfigured } from '../lib/supabase';

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
}

interface SettingsProps {
  theme: string;
  onThemeChange: (theme: string) => void;
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
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
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

/** iOS-style section label — uppercase, small, above the card */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-barlow text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93] mb-2 px-1">
      {children}
    </p>
  );
}

/** iOS-style settings card wrapper */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] overflow-hidden">
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

function SettingsRow({ icon, iconBg, label, children, divider = true }: SettingsRowProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
        {icon && (
          <div
            className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${iconBg ?? 'bg-primary/20'}`}
          >
            {icon}
          </div>
        )}
        <span className="flex-1 font-barlow text-[15px] text-white">{label}</span>
        <div className="shrink-0">{children}</div>
      </div>
      {divider && <div className="h-px bg-white/[0.06] mx-4" />}
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
    <label className="toggle-switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track" />
      <span className="toggle-thumb" />
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
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : Number(e.target.value))
        }
        placeholder={placeholder}
        className="w-20 bg-[#2C2C2E] rounded-[10px] px-2.5 py-1.5 text-white font-barlow text-[14px] text-left focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
      />
      {unit && (
        <span className="font-barlow text-[13px] text-[#8E8E93]">{unit}</span>
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
      onClick={onClick}
      className={`w-full min-h-[52px] py-3.5 rounded-[16px] font-barlow font-semibold text-[16px] flex items-center justify-center gap-2 transition-all duration-200 ${
        saved
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-primary text-white hover:opacity-90 active:scale-[0.98]'
      }`}
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
      <div className="w-20 h-20 rounded-full bg-primary/[0.15] border-2 border-primary/30 flex items-center justify-center mb-3">
        {initials ? (
          <span className="font-barlow-condensed font-bold text-[28px] text-primary leading-none">
            {initials}
          </span>
        ) : (
          <User size={32} className="text-primary/60" />
        )}
      </div>
      {name.trim() && (
        <p className="font-barlow-condensed font-bold text-[20px] text-white">
          {name.trim()}
        </p>
      )}
      <p className="font-barlow text-[13px] text-[#8E8E93] mt-0.5">פרופיל אישי</p>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================

export default function Settings({ theme, onThemeChange }: SettingsProps) {
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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
  }, []);

  // Cloud sync handlers
  const handleSyncToCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncing(true);
    setSyncMessage('מסנכרן לענן...');
    try {
      const result = await syncAllData();
      if (result.success) {
        setSyncMessage('הסנכרון הושלם בהצלחה!');
      } else {
        setSyncMessage(result.error || 'שגיאה בסנכרון');
      }
    } catch {
      setSyncMessage('שגיאה בסנכרון');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handlePullFromCloud = async () => {
    if (!cloudConnected) {
      setSyncMessage('חיבור לענן לא פעיל');
      return;
    }
    setIsSyncing(true);
    setSyncMessage('מביא נתונים מהענן...');
    try {
      const result = await pullAllData();
      if (result.success) {
        setSyncMessage('הנתונים התעדכנו!');
      } else {
        setSyncMessage(result.error || 'שגיאה בטעינה');
      }
    } catch {
      setSyncMessage('שגיאה בטעינה');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  useEffect(() => {
    setProfile(loadFromStorage<UserProfile>('user_profile', DEFAULT_PROFILE));
    setNutrition(loadFromStorage<NutritionGoals>('nutrition_goals', DEFAULT_NUTRITION));
    setWorkoutPrefs(loadFromStorage<WorkoutPrefs>('workout_prefs', DEFAULT_WORKOUT_PREFS));
  }, []);

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
    setWorkoutSaved(true);
    setTimeout(() => setWorkoutSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-black pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]" dir="rtl">
      <div className="px-4 pt-6">

        {/* Page title */}
        <h1 className="font-barlow-condensed font-bold text-3xl text-white tracking-wide leading-none mb-6">
          הגדרות
        </h1>

        {/* ── PROFILE SECTION ─────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel>פרופיל</SectionLabel>

          {/* Avatar card */}
          <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] mb-3">
            <ProfileAvatar name={profile.name} />
          </div>

          <SettingsCard>
            {/* Name */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div className="w-8 h-8 rounded-[8px] bg-blue-500/20 flex items-center justify-center shrink-0">
                  <User size={15} className="text-blue-400" />
                </div>
                <span className="font-barlow text-[15px] text-white flex-1">שם</span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="הכנס שם..."
                  className="w-36 bg-[#2C2C2E] rounded-[10px] px-2.5 py-1.5 text-white font-barlow text-[14px] text-right focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-[#48484A]"
                />
              </div>
              <div className="h-px bg-white/[0.06] mx-4" />
            </div>

            {/* Age */}
            <SettingsRow
              icon={<span className="font-barlow-condensed font-bold text-[13px] text-orange-400">גיל</span>}
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
              icon={<span className="font-barlow-condensed font-bold text-[13px] text-teal-400">גב'</span>}
              iconBg="bg-teal-500/20"
              label='גובה'
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
                <div className="w-8 h-8 rounded-[8px] bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Target size={15} className="text-purple-400" />
                </div>
                <span className="font-barlow text-[15px] text-white flex-1">מטרת משקל</span>
                <div className="relative flex items-center gap-1">
                  <span className="font-barlow text-[14px] text-[#8E8E93]">{profile.weightGoal}</span>
                  <ChevronLeft size={14} className="text-[#48484A]" />
                  <select
                    value={profile.weightGoal}
                    onChange={(e) => setProfile({ ...profile, weightGoal: e.target.value as WeightGoal })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  >
                    <option>ירידה במשקל</option>
                    <option>שמירה על משקל</option>
                    <option>עלייה במסה</option>
                  </select>
                </div>
              </div>
              <div className="h-px bg-white/[0.06] mx-4" />
            </div>

            {/* Activity level */}
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div className="w-8 h-8 rounded-[8px] bg-green-500/20 flex items-center justify-center shrink-0">
                  <Zap size={15} className="text-green-400" />
                </div>
                <span className="font-barlow text-[15px] text-white flex-1">רמת פעילות</span>
                <div className="relative flex items-center gap-1">
                  <span className="font-barlow text-[14px] text-[#8E8E93]">{profile.activityLevel}</span>
                  <ChevronLeft size={14} className="text-[#48484A]" />
                  <select
                    value={profile.activityLevel}
                    onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value as ActivityLevel })}
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
            <SaveButton
              onClick={handleSaveProfile}
              saved={profileSaved}
              label="שמור פרופיל"
            />
          </div>
        </div>

        {/* ── NUTRITION SECTION ───────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel>יעדי תזונה</SectionLabel>
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
              icon={<span className="font-barlow-condensed font-bold text-[12px] text-yellow-400">פח</span>}
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
              icon={<span className="font-barlow-condensed font-bold text-[12px] text-orange-400">שמ</span>}
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
          <SectionLabel>הגדרות אימון</SectionLabel>
          <SettingsCard>
            {/* Rest time pills */}
            <div className="px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-[8px] bg-primary/20 flex items-center justify-center shrink-0">
                  <Dumbbell size={15} className="text-primary" />
                </div>
                <span className="font-barlow text-[15px] text-white">זמן מנוחה ברירת מחדל</span>
              </div>
              <div className="flex flex-wrap gap-2 pr-11">
                {REST_TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setWorkoutPrefs({ ...workoutPrefs, defaultRestTime: opt.value })
                    }
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-full font-barlow text-[13px] font-medium transition-all duration-200 ${
                      workoutPrefs.defaultRestTime === opt.value
                        ? 'bg-primary text-white'
                        : 'bg-white/[0.06] text-[#8E8E93] hover:bg-white/[0.10] border border-white/[0.06]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/[0.06] mx-4" />

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
              divider={false}
            >
              <Toggle
                checked={workoutPrefs.hapticsEnabled}
                onChange={() =>
                  setWorkoutPrefs({ ...workoutPrefs, hapticsEnabled: !workoutPrefs.hapticsEnabled })
                }
                label="רטט"
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
          <SectionLabel>ערכת נושא</SectionLabel>
          <SettingsCard>
            {THEMES.map((t, idx) => (
              <div key={t.id} className="flex flex-col">
                <button
                  onClick={() => onThemeChange(t.id)}
                  className="flex items-center gap-3 px-4 py-3.5 min-h-[56px] transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                >
                  {/* Color circle */}
                  <div
                    className="w-8 h-8 rounded-full shrink-0 border-[2.5px] transition-all duration-200"
                    style={
                      theme === t.id
                        ? { backgroundColor: t.color, borderColor: 'rgba(255,255,255,0.5)' }
                        : { backgroundColor: t.color, borderColor: 'transparent' }
                    }
                  />
                  <span className="font-barlow text-[15px] text-white flex-1 text-right">
                    {t.name}
                  </span>
                  {theme === t.id && (
                    <Check size={17} className="text-primary shrink-0" strokeWidth={2.5} />
                  )}
                </button>
                {idx < THEMES.length - 1 && (
                  <div className="h-px bg-white/[0.06] mx-4" />
                )}
              </div>
            ))}
          </SettingsCard>
        </div>

        {/* ── ABOUT SECTION ───────────────────────────────────────────────── */}
        <div className="mb-4">
          <SectionLabel>אודות</SectionLabel>
          <SettingsCard>
            <SettingsRow
              label="גרסה"
              divider={true}
            >
              <span className="font-barlow text-[14px] text-[#8E8E93]">1.0.0</span>
            </SettingsRow>
            <SettingsRow
              label="SparkOS Fitness"
              divider={true}
            >
              <span className="font-barlow text-[14px] text-[#8E8E93]">אפליקציית כושר אישית</span>
            </SettingsRow>
          </SettingsCard>
        </div>

        {/* ── CLOUD SYNC SECTION ─────────────────────────────────────────── */}
        {isSupabaseConfigured() && (
          <div className="mb-7">
            <SectionLabel>סנכרון ענן</SectionLabel>
            <SettingsCard>
              <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
                <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
                  cloudConnected ? 'bg-green-500/20' : 'bg-gray-500/20'
                }`}>
                  {cloudConnected ? (
                    <Cloud size={15} className="text-green-400" />
                  ) : (
                    <CloudOff size={15} className="text-gray-400" />
                  )}
                </div>
                <span className="flex-1 font-barlow text-[15px] text-white">
                  {cloudConnected ? 'מחובר לענן' : 'לא מחובר'}
                </span>
                {syncMessage && (
                  <span className="font-barlow text-[12px] text-[#8E8E93] animate-pulse">
                    {syncMessage}
                  </span>
                )}
              </div>
              <div className="h-px bg-white/[0.06] mx-4" />
              <div className="flex gap-2 px-4 py-3">
                <button
                  onClick={handleSyncToCloud}
                  disabled={isSyncing || !cloudConnected}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary/20 text-primary font-barlow text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  העלה לענן
                </button>
                <button
                  onClick={handlePullFromCloud}
                  disabled={isSyncing || !cloudConnected}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] bg-white/[0.06] text-white font-barlow text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  הורד מהענן
                </button>
              </div>
            </SettingsCard>
          </div>
        )}

        {/* ── EXPORT & SHARE SECTION ────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionLabel>ייצוא ושיתוף</SectionLabel>
          <SettingsCard>
            <div className="flex flex-col">
              <button
                onClick={async () => {
                  try {
                    const { dbGetAll, STORES } = await import('../services/indexedDBCore');
                    const sessions = await dbGetAll<any>(STORES.WORKOUT_SESSIONS);
                    exportWorkoutHistoryCSV(sessions);
                  } catch (e) {
                    console.error('Export failed:', e);
                  }
                }}
                className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-[8px] bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Download size={15} className="text-blue-400" />
                </div>
                <span className="font-barlow text-[15px] text-white flex-1 text-right">
                  ייצוא היסטוריית אימונים (CSV)
                </span>
              </button>
              <div className="h-px bg-white/[0.06] mx-4" />
            </div>

            <div className="flex flex-col">
              <button
                onClick={async () => {
                  try {
                    const report = await generateWeeklyReport();
                    setWeeklyReport(report);
                  } catch (e) {
                    console.error('Report generation failed:', e);
                  }
                }}
                className="flex items-center gap-3 px-4 py-3.5 min-h-[52px] transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              >
                <div className="w-8 h-8 rounded-[8px] bg-green-500/20 flex items-center justify-center shrink-0">
                  <Share2 size={15} className="text-green-400" />
                </div>
                <span className="font-barlow text-[15px] text-white flex-1 text-right">
                  דוח שבועי
                </span>
              </button>
              <div className="h-px bg-white/[0.06] mx-4" />
            </div>

            {weeklyReport && (
              <div className="px-4 py-3">
                <pre className="whitespace-pre-wrap font-barlow text-[13px] text-[#8E8E93] bg-[#0A0A0A] rounded-[12px] p-3 border border-white/[0.04] max-h-[300px] overflow-y-auto">
                  {weeklyReport}
                </pre>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => shareReport(weeklyReport)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-primary/20 text-primary font-barlow text-[13px]"
                  >
                    <Share2 size={13} /> שתף
                  </button>
                  <button
                    onClick={() => {
                      copyToClipboard(weeklyReport);
                      setCopiedReport(true);
                      setTimeout(() => setCopiedReport(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white/[0.06] text-[#8E8E93] font-barlow text-[13px]"
                  >
                    <Copy size={13} /> {copiedReport ? 'הועתק!' : 'העתק'}
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
