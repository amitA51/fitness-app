import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Battery,
  Heart,
  Minus,
  Moon,
  Plus,
  Ruler,
  Scale,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  TIGHTNESS_AREAS,
  addBodyMeasurement,
  addBodyWeight,
  addRecoveryLog,
  calculateBMI,
  calculateWeightTrend,
  getBMICategory,
  getBodyMeasurementsByDateRange,
  getBodyWeightsByDateRange,
  getLatestMeasurement,
  getLatestWeight,
  getLegacyRecoveryScore,
  getRecoveryLogsByDateRange,
  getTodayRecoveryLog,
  getWeeklyRecoveryAverage,
} from '../services/bodyStatsService';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  RecoveryLog,
  WeightTrend,
} from '../services/bodyStatsService';
import { safeJsonParse } from '../utils/safeJson';

type ProgressTab = 'weight' | 'measurements' | 'recovery';

const TABS: { key: ProgressTab; label: string; icon: React.ReactNode }[] = [
  { key: 'weight', label: 'משקל', icon: <Scale size={15} /> },
  { key: 'measurements', label: 'מדידות', icon: <Ruler size={15} /> },
  { key: 'recovery', label: 'ריקאברי', icon: <Heart size={15} /> },
];

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<ProgressTab>('weight');
  const [weightEntries, setWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<BodyWeightEntry | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [todayRecovery, setTodayRecovery] = useState<RecoveryLog | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<ReturnType<
    typeof getLegacyRecoveryScore
  > | null>(null);
  const [weeklyRecovery, setWeeklyRecovery] = useState({
    avgSleep: 0,
    avgEnergy: 0,
    avgSoreness: 0,
    avgStress: 0,
    avgScore: 0,
  });
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [userHeight] = useState(() => {
    try {
      const raw = localStorage.getItem('user_profile');
      if (!raw) return 175;
      const parsed = safeJsonParse<{ height?: number }>(raw);
      if (!parsed) return 175;
      return typeof parsed.height === 'number' && parsed.height > 0 ? parsed.height : 175;
    } catch {
      return 175;
    }
  });

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    // Parallel data loading for better performance
    const [weights, latest, meas, latestMeas, rec, weekly] = await Promise.all([
      getBodyWeightsByDateRange(monthAgo, today),
      getLatestWeight(),
      getBodyMeasurementsByDateRange(monthAgo, today),
      getLatestMeasurement(),
      getTodayRecoveryLog(),
      getWeeklyRecoveryAverage(),
    ]);

    setWeightEntries(weights);
    setLatestWeight(latest);
    if (weights.length >= 2) setWeightTrend(calculateWeightTrend(weights));
    setMeasurements(meas);
    setLatestMeasurement(latestMeas);
    setTodayRecovery(rec);
    if (rec) setRecoveryScore(getLegacyRecoveryScore(rec));
    setWeeklyRecovery(weekly);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bmi = useMemo(
    () => (latestWeight ? calculateBMI(latestWeight.weight, userHeight) : null),
    [latestWeight, userHeight]
  );
  const bmiCategory = useMemo(() => (bmi ? getBMICategory(bmi) : null), [bmi]);

  const handleShowAddWeight = useCallback(() => setShowAddWeight(true), []);
  const handleShowAddMeasurement = useCallback(() => setShowAddMeasurement(true), []);
  const handleShowAddRecovery = useCallback(() => setShowAddRecovery(true), []);
  const handleCloseAddWeight = useCallback(() => setShowAddWeight(false), []);
  const handleCloseAddMeasurement = useCallback(() => setShowAddMeasurement(false), []);
  const handleCloseAddRecovery = useCallback(() => setShowAddRecovery(false), []);

  const handleSaveWeight = useCallback(
    async (weight: number, notes: string) => {
      await addBodyWeight({ date: new Date().toISOString().slice(0, 10), weight, notes });
      setShowAddWeight(false);
      loadData();
    },
    [loadData]
  );
  const handleSaveMeasurement = useCallback(
    async (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => {
      await addBodyMeasurement(m);
      setShowAddMeasurement(false);
      loadData();
    },
    [loadData]
  );
  const handleSaveRecovery = useCallback(
    async (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => {
      await addRecoveryLog(r);
      setShowAddRecovery(false);
      loadData();
    },
    [loadData]
  );

  const todayISO = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]" style={{ background: 'var(--bone)' }} dir="rtl">
      <header className="masthead sticky top-0 z-20" style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}>
        <div className="kicker">§05 · PROGRESS · {todayISO}</div>
        <h1
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 'clamp(44px, 12vw, 72px)',
            lineHeight: 0.9,
            marginTop: '8px',
          }}
        >
          התקדמות
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            color: 'var(--mustard)',
            textTransform: 'uppercase',
          }}
        >
          {todayLabel}
        </p>
      </header>

      {/* Editorial Tab Bar */}
      <div className="px-5 pt-5 pb-3">
        <div
          className="flex gap-1"
          style={{ borderBottom: '2px solid var(--navy)' }}
          role="tablist"
          aria-label="התקדמות"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              role="tab"
              id={`progress-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`progress-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const nextIdx = (idx + 1) % TABS.length;
                  setActiveTab(TABS[nextIdx].key);
                  document.getElementById(`progress-tab-${TABS[nextIdx].key}`)?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prevIdx = (idx - 1 + TABS.length) % TABS.length;
                  setActiveTab(TABS[prevIdx].key);
                  document.getElementById(`progress-tab-${TABS[prevIdx].key}`)?.focus();
                }
              }}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''} flex items-center gap-1.5`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        <AnimatePresence mode="sync">
          {activeTab === 'weight' && (
            <motion.div
              key="weight"
              id="progress-panel-weight"
              role="tabpanel"
              aria-labelledby="progress-tab-weight"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <WeightTab
                latestWeight={latestWeight}
                weightTrend={weightTrend}
                bmi={bmi}
                bmiCategory={bmiCategory}
                weightEntries={weightEntries}
                onAdd={handleShowAddWeight}
              />
            </motion.div>
          )}
          {activeTab === 'measurements' && (
            <motion.div
              key="measurements"
              id="progress-panel-measurements"
              role="tabpanel"
              aria-labelledby="progress-tab-measurements"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MeasurementsTab
                latestMeasurement={latestMeasurement}
                measurements={measurements}
                onAdd={handleShowAddMeasurement}
              />
            </motion.div>
          )}
          {activeTab === 'recovery' && (
            <motion.div
              key="recovery"
              id="progress-panel-recovery"
              role="tabpanel"
              aria-labelledby="progress-tab-recovery"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <RecoveryTab
                todayRecovery={todayRecovery}
                recoveryScore={recoveryScore}
                weeklyRecovery={weeklyRecovery}
                onAdd={handleShowAddRecovery}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddWeight && (
          <AddWeightModal onSave={handleSaveWeight} onClose={handleCloseAddWeight} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddMeasurement && (
          <AddMeasurementModal
            onSave={handleSaveMeasurement}
            onClose={handleCloseAddMeasurement}
            latest={latestMeasurement}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddRecovery && (
          <AddRecoveryModal onSave={handleSaveRecovery} onClose={handleCloseAddRecovery} />
        )}
      </AnimatePresence>
    </div>
  );
}

const WeightTab = memo(function WeightTab({
  latestWeight,
  weightTrend,
  bmi,
  bmiCategory,
  weightEntries,
  onAdd,
}: {
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  weightEntries: BodyWeightEntry[];
  onAdd: () => void;
}) {
  const last7 = useMemo(() => weightEntries.slice(-7), [weightEntries]);
  const maxW = useMemo(() => Math.max(...last7.map((w) => w.weight), 1), [last7]);
  const minW = useMemo(() => Math.min(...last7.map((w) => w.weight)), [last7]);
  const range = useMemo(() => maxW - minW || 1, [maxW, minW]);

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§01 · WEIGHT</span>
        <span className="right">משקל</span>
      </div>

      {/* Hero stat block — mustard */}
      {latestWeight ? (
        <div className="block-hero">
          <span className="ribbon">BMI {bmi ?? '—'}</span>
          <div className="label">משקל נוכחי · CURRENT</div>
          <div className="number">{latestWeight.weight}</div>
          <div className="sub">KG</div>
          {bmiCategory && (
            <div
              className="mt-3 inline-block"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: 'var(--navy)',
                color: 'var(--mustard)',
                padding: '4px 10px',
              }}
            >
              {bmiCategory.label}
            </div>
          )}
        </div>
      ) : (
        <div className="card-outlined">
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--stone)' }} />
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              עדיין לא תיעדת משקל
            </p>
            <button onClick={onAdd} className="btn-primary">
              הוסף משקל
            </button>
          </div>
        </div>
      )}

      {/* Trend data strip */}
      {weightTrend && (
        <div className="data-strip">
          <div>
            <div
              className="val"
              style={{ color: weightTrend.direction === 'ירידה' ? 'var(--navy)' : 'var(--ink)' }}
            >
              {weightTrend.change > 0 ? '+' : ''}
              {weightTrend.change}
              <em>KG</em>
            </div>
            <div className="lbl flex items-center gap-1.5">
              {weightTrend.direction === 'עלייה' && <TrendingUp size={11} />}
              {weightTrend.direction === 'ירידה' && <TrendingDown size={11} />}
              {weightTrend.direction === 'יציב' && <Minus size={11} />}
              {weightTrend.direction}
            </div>
          </div>
          <div>
            <div className="val">
              30<em>D</em>
            </div>
            <div className="lbl">TRAILING WINDOW</div>
          </div>
        </div>
      )}

      {/* 7-bar chart */}
      {last7.length > 1 && (
        <div className="card-outlined">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <BarChart3 size={14} />§ 7-DAY TREND
            </h3>
          </div>
          <div className="h-28 flex items-end gap-2">
            {last7.map((entry, i) => {
              const heightPct = ((entry.weight - minW) / range) * 65 + 20;
              const isLast = i === last7.length - 1;
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-1.5">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--stone)',
                    }}
                  >
                    {entry.weight}
                  </span>
                  <motion.div
                    className="w-full"
                    style={{
                      backgroundColor: isLast ? 'var(--mustard)' : 'var(--bone-deep)',
                      border: isLast ? '2px solid var(--navy)' : 'none',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--stone)',
                    }}
                  >
                    {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add weight button */}
      {latestWeight && (
        <button
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          הוסף משקל
        </button>
      )}
    </div>
  );
});

const MEASUREMENT_LABELS: Record<string, string> = {
  chest: 'חזה',
  waist: 'מותניים',
  hips: 'אגן',
  arms: 'זרועות',
  thighs: 'ירכיים',
  neck: 'צוואר',
};

const MeasurementsTab = memo(function MeasurementsTab({
  latestMeasurement,
  measurements,
  onAdd,
}: {
  latestMeasurement: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  onAdd: () => void;
}) {
  const prev = useMemo(
    () => (measurements.length > 1 ? measurements[measurements.length - 2] : null),
    [measurements]
  );

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§02 · MEASUREMENTS</span>
        <span className="right">מידות</span>
      </div>

      <div className="card-outlined">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">§ LATEST UPDATE · עדכון אחרון</h2>
          <button onClick={onAdd} className="chip" style={{ background: 'var(--mustard)' }}>
            <Plus size={12} />
            עדכן
          </button>
        </div>

        {latestMeasurement ? (
          <div>
            {Object.entries(MEASUREMENT_LABELS).map(([key, label]) => {
              const curr = latestMeasurement[key as keyof BodyMeasurement] as number | undefined;
              const prevVal = prev?.[key as keyof BodyMeasurement] as number | undefined;
              const diff = curr && prevVal ? +(curr - prevVal).toFixed(1) : null;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between"
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid var(--bone-deep)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-3">
                    {diff !== null && diff !== 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          color: diff < 0 ? 'var(--navy)' : 'var(--mustard)',
                          background: diff < 0 ? 'var(--mustard)' : 'var(--navy)',
                          padding: '2px 8px',
                        }}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: '20px',
                        color: 'var(--ink)',
                      }}
                    >
                      {curr ? `${curr}` : '—'}
                    </span>
                    <span className="eyebrow" style={{ color: 'var(--stone)' }}>
                      CM
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Ruler size={36} style={{ color: 'var(--stone)' }} className="mb-3" />
            <p
              className="mb-5"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '16px',
                color: 'var(--ink)',
              }}
            >
              עדיין לא תיעדת מידות
            </p>
            <button onClick={onAdd} className="btn-primary">
              הוסף מידות ראשונות
            </button>
          </div>
        )}
      </div>

      {latestMeasurement && (
        <button
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          הוסף מדידה
        </button>
      )}
    </div>
  );
});

const RecoveryTab = memo(function RecoveryTab({
  todayRecovery,
  recoveryScore,
  weeklyRecovery,
  onAdd,
}: {
  todayRecovery: RecoveryLog | null;
  recoveryScore: ReturnType<typeof getLegacyRecoveryScore> | null;
  weeklyRecovery: {
    avgSleep: number;
    avgEnergy: number;
    avgSoreness: number;
    avgStress: number;
    avgScore: number;
  };
  onAdd: () => void;
}) {
  const [history, setHistory] = useState<RecoveryLog[]>([]);
  useEffect(() => {
    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const logs = await getRecoveryLogsByDateRange(weekAgo, today);
      setHistory(logs);
    };
    load();
  }, []);

  const scoreColor = recoveryScore?.color ?? 'var(--color-text-secondary)';
  const scorePct = recoveryScore ? recoveryScore.score : 0;

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§03 · RECOVERY</span>
        <span className="right">ריקאברי</span>
      </div>

      {/* Recovery score */}
      <div className="card-outlined">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">§ TODAY · ציון ריקאברי</h2>
          <button onClick={onAdd} className="chip" style={{ background: 'var(--mustard)' }}>
            <Plus size={12} />
            עדכן
          </button>
        </div>

        {recoveryScore ? (
          <div>
            <div className="flex items-center gap-6 mb-5">
              {/* CSS circle score */}
              <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
                <div
                  className="absolute inset-2 rounded-full"
                  style={{ backgroundColor: `${scoreColor}18` }}
                />
                <div className="relative z-10 text-center">
                  <div className="text-3xl font-black leading-none" style={{ color: scoreColor }}>
                    {recoveryScore.score}
                  </div>
                  <div className="text-[11px] mt-1 font-mono" style={{ color: 'var(--stone)' }}>
                    {recoveryScore.label}
                  </div>
                </div>
                {/* Arc indicator */}
                {/*
                  Circle math: r=50, so circumference = 2 * π * 50 ≈ 314.16.
                  We use 314 as the integer approximation for strokeDasharray calculations.
                  The first value is the filled portion (scorePct * 3.14 ≈ scorePct% of the circumference).
                  The second value is the remaining unfilled portion.
                */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 112 112"
                  aria-label={`ציון ריקאברי: ${scorePct}%`}
                  role="img"
                >
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="50"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${scorePct * 3.14} ${314 - scorePct * 3.14}`}
                    initial={{ strokeDasharray: `0 ${2 * Math.PI * 50}` }}
                    animate={{ strokeDasharray: `${scorePct * 3.14} ${314 - scorePct * 3.14}` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </svg>
              </div>

              <div className="flex-1 space-y-3">
                <RecoveryBar
                  label="שינה"
                  value={recoveryScore.sleepScore}
                  max={25}
                  color="#a855f7"
                />
                <RecoveryBar
                  label="כאב"
                  value={recoveryScore.sorenessScore}
                  max={25}
                  color="#f59e0b"
                />
                <RecoveryBar
                  label="אנרגיה"
                  value={recoveryScore.energyScore}
                  max={25}
                  color="#22c55e"
                />
                <RecoveryBar
                  label="לחץ"
                  value={recoveryScore.stressScore}
                  max={25}
                  color="#3b82f6"
                />
              </div>
            </div>

            {todayRecovery && todayRecovery.tightAreas && todayRecovery.tightAreas.length > 0 && (
              <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">אזורים תפוסים</p>
                <div className="flex flex-wrap gap-2">
                  {todayRecovery.tightAreas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Heart size={30} className="text-[var(--color-text-secondary)]" />
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              עדיין לא דיווחת על ההתאוששות שלך
            </p>
            <button onClick={onAdd} className="btn-primary">
              התחל דיווח
            </button>
          </div>
        )}
      </div>

      {/* Weekly avg */}
      {weeklyRecovery.avgScore > 0 && (
        <div className="card-outlined">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <Activity size={14} />§ WEEKLY AVG · ממוצע שבועי
          </h3>
          <div className="data-strip">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={12} style={{ color: 'var(--navy)' }} />
                <span className="eyebrow">SLEEP</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgSleep}
                <em>H</em>
              </div>
              <div className="lbl">שינה ממוצעת</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Battery size={12} style={{ color: 'var(--navy)' }} />
                <span className="eyebrow">ENERGY</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgEnergy}
                <em>/10</em>
              </div>
              <div className="lbl">אנרגיה ממוצעת</div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card-outlined">
          <h3 className="section-title mb-3">§ HISTORY · היסטוריית ריקאברי</h3>
          <div className="space-y-1">
            {history
              .slice()
              .reverse()
              .slice(0, 7)
              .map((log) => {
                const score = getLegacyRecoveryScore(log);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <span className="text-[var(--color-text-secondary)] text-[13px]">
                      {new Date(log.date).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium" style={{ color: score.color }}>
                        {score.label}
                      </span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px]"
                        style={{ backgroundColor: `${score.color}18`, color: score.color }}
                      >
                        {score.score}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
});

const RecoveryBar = memo(function RecoveryBar({
  label,
  value,
  max,
  color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = useMemo(() => Math.round((value / max) * 100), [value, max]);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold" style={{ color: 'var(--stone)' }}>{label}</span>
        <span className="font-semibold" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
});

const AddWeightModal = memo(function AddWeightModal({
  onSave,
  onClose,
}: { onSave: (weight: number, notes: string) => Promise<void>; onClose: () => void }) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[var(--color-surface-elevated)] rounded-t-[28px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">עדכון משקל</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-5">
          <div className="text-center py-4">
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.0"
              className="w-36 text-center bg-transparent text-white font-black text-6xl border-b-2 border-[var(--color-primary)] focus:outline-none"
              step="0.1"
              inputMode="decimal"
            />
            <div className="text-lg text-[var(--color-text-secondary)] mt-2 font-medium">ק״ג</div>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
            className="w-full bg-[var(--color-surface-input)] rounded-[14px] py-3.5 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40"
          />
          <motion.button
            onClick={async () => {
              if (!weight) return;
              setSaving(true);
              await onSave(Number.parseFloat(weight), notes);
              setSaving(false);
            }}
            disabled={!weight || saving}
            className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base disabled:opacity-40"
            whileTap={{ scale: weight ? 0.98 : 1 }}
          >
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});

const AddMeasurementModal = memo(function AddMeasurementModal({
  onSave,
  onClose,
  latest,
}: {
  onSave: (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
  latest: BodyMeasurement | null;
}) {
  const [chest, setChest] = useState(latest?.chest?.toString() || '');
  const [waist, setWaist] = useState(latest?.waist?.toString() || '');
  const [hips, setHips] = useState(latest?.hips?.toString() || '');
  const [arms, setArms] = useState(latest?.arms?.toString() || '');
  const [thighs, setThighs] = useState(latest?.thighs?.toString() || '');
  const [neck, setNeck] = useState(latest?.neck?.toString() || '');

  const fields = useMemo(
    () => [
      { label: 'חזה', value: chest, setter: setChest },
      { label: 'מותניים', value: waist, setter: setWaist },
      { label: 'אגן', value: hips, setter: setHips },
      { label: 'זרועות', value: arms, setter: setArms },
      { label: 'ירכיים', value: thighs, setter: setThighs },
      { label: 'צוואר', value: neck, setter: setNeck },
    ],
    [chest, waist, hips, arms, thighs, neck]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[var(--color-surface-elevated)] rounded-t-[28px] p-6 max-h-[82vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">עדכון מידות</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.label}>
              <label className="text-[11px] text-[var(--color-text-secondary)] mb-1.5 block font-medium">
                {f.label} (ס״מ)
              </label>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                placeholder="—"
                className="w-full bg-[var(--color-surface-input)] rounded-[14px] py-3 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40 text-center"
                step="0.1"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>
        <motion.button
          onClick={async () => {
            await onSave({
              date: new Date().toISOString().slice(0, 10),
              chest: chest ? Number.parseFloat(chest) : undefined,
              waist: waist ? Number.parseFloat(waist) : undefined,
              hips: hips ? Number.parseFloat(hips) : undefined,
              arms: arms ? Number.parseFloat(arms) : undefined,
              thighs: thighs ? Number.parseFloat(thighs) : undefined,
              neck: neck ? Number.parseFloat(neck) : undefined,
              notes: '',
            });
          }}
          className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base mt-5"
          whileTap={{ scale: 0.98 }}
        >
          שמור מידות
        </motion.button>
      </motion.div>
    </motion.div>
  );
});

const AddRecoveryModal = memo(function AddRecoveryModal({
  onSave,
  onClose,
}: { onSave: (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => Promise<void>; onClose: () => void }) {
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sorenessLevel, setSorenessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tightAreas, setTightAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[var(--color-surface-elevated)] rounded-t-[28px] p-6 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">דיווח ריקאברי</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-6">
          <SliderInput
            label="שעות שינה"
            value={sleepHours}
            onChange={setSleepHours}
            min={0}
            max={12}
            step={0.5}
            unit=" ש"
            color="#BF5AF2"
          />
          <SliderInput
            label="איכות שינה"
            value={sleepQuality}
            onChange={(v) => setSleepQuality(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="#BF5AF2"
            labels={['גרוע', 'עלוב', 'בסדר', 'טוב', 'מעולה']}
          />
          <SliderInput
            label="רמת כאב"
            value={sorenessLevel}
            onChange={(v) => setSorenessLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="#FF9F0A"
            labels={['כואב מאוד', 'כואב', 'בסדר', 'טוב', 'רענן']}
          />
          <SliderInput
            label="רמת אנרגיה"
            value={energyLevel}
            onChange={(v) => setEnergyLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="#30D158"
            labels={['מותש', 'נמוכה', 'בסדר', 'טובה', 'מלא אנרגיה']}
          />
          <SliderInput
            label="רמת לחץ"
            value={stressLevel}
            onChange={(v) => setStressLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="#0A84FF"
            labels={['מלחיץ מאוד', 'מלחיץ', 'בסדר', 'רגוע', 'רגוע לחלוטין']}
          />

          <div>
            <label className="text-sm text-[var(--color-text-secondary)] mb-3 block font-medium">
              אזורים תפוסים
            </label>
            <div className="flex flex-wrap gap-2">
              {TIGHTNESS_AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() =>
                    setTightAreas((prev) =>
                      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
                    )
                  }
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-150 ${
                    tightAreas.includes(area)
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white/[0.08] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
            className="w-full bg-[var(--color-surface-input)] rounded-[14px] py-3.5 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40"
          />

          <motion.button
            onClick={async () => {
              await onSave({
                date: new Date().toISOString().slice(0, 10),
                sleepHours,
                sleepQuality,
                sorenessLevel,
                energyLevel,
                stressLevel,
                tightAreas,
                notes,
              });
            }}
            className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base"
            whileTap={{ scale: 0.98 }}
          >
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});

const SliderInput = memo(function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  color,
  labels,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  labels?: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--color-text-secondary)] font-medium">{label}</span>
        <span className="font-black text-base" style={{ color }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
      {labels && (
        <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)] mt-1.5">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
});
