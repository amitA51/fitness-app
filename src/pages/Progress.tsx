import { AnimatePresence, motion } from 'framer-motion';
import { Dumbbell, Heart, Ruler, Scale } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ActivityRingData,
  ActivityRings,
  GlowAreaChart,
  type GlowAreaPoint,
  GradientSparkline,
} from '../components/charts';
import {
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
  getTodayRecoveryLog,
  getWeeklyRecoveryAverage,
} from '../services/bodyStatsService';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  RecoveryLog,
  WeightTrend,
} from '../services/bodyStatsService';
import { getWorkoutSessions } from '../services/dataService';
import { getAllPRs } from '../services/prService';
import type { WorkoutSession } from '../types';
import { formatVolume } from '../utils/dateUtils';
import { safeJsonParse } from '../utils/safeJson';
import { setVolume } from '../utils/workoutMath';
import { ProgressInsightCard } from './progress/components/ProgressInsightCard';
import { WorkoutHistoryList } from './progress/components/WorkoutHistoryList';
import { AddMeasurementModal } from './progress/modals/AddMeasurementModal';
import { AddRecoveryModal } from './progress/modals/AddRecoveryModal';
import { AddWeightModal } from './progress/modals/AddWeightModal';
import { MeasurementsTab } from './progress/tabs/MeasurementsTab';
import { RecoveryTab } from './progress/tabs/RecoveryTab';
import { StrengthTab } from './progress/tabs/StrengthTab';
import { WeightTab } from './progress/tabs/WeightTab';
import type { ProgressTab } from './progress/types';

const TABS: { key: ProgressTab; label: string; icon: React.ReactNode }[] = [
  { key: 'weight', label: 'משקל', icon: <Scale size={15} /> },
  { key: 'measurements', label: 'מדידות', icon: <Ruler size={15} /> },
  { key: 'recovery', label: 'ריקאברי', icon: <Heart size={15} /> },
  { key: 'strength', label: 'כוח', icon: <Dumbbell size={15} /> },
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
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
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
    const [weights, latest, meas, latestMeas, rec, weekly, loadedSessions] = await Promise.all([
      getBodyWeightsByDateRange(monthAgo, today),
      getLatestWeight(),
      getBodyMeasurementsByDateRange(monthAgo, today),
      getLatestMeasurement(),
      getTodayRecoveryLog(),
      getWeeklyRecoveryAverage(),
      getWorkoutSessions(50),
    ]);

    setWeightEntries(weights);
    setLatestWeight(latest);
    if (weights.length >= 2) setWeightTrend(calculateWeightTrend(weights));
    setMeasurements(meas);
    setLatestMeasurement(latestMeas);
    setTodayRecovery(rec);
    if (rec) setRecoveryScore(getLegacyRecoveryScore(rec));
    setWeeklyRecovery(weekly);
    setSessions(loadedSessions.filter((s) => s.status === 'completed'));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bmi = useMemo(
    () => (latestWeight ? calculateBMI(latestWeight.weight, userHeight) : null),
    [latestWeight, userHeight]
  );
  const bmiCategory = useMemo(() => (bmi ? getBMICategory(bmi) : null), [bmi]);

  // Compute auto metrics for insight row
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions]
  );

  const [prCount, setPRCount] = useState(0);
  useEffect(() => {
    if (sessions.length === 0) return;
    let cancelled = false;
    getAllPRs()
      .then((all) => {
        if (!cancelled) setPRCount(all.length);
      })
      .catch(() => {
        // Non-fatal — score just won't show PR count
      });
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  const metrics = useMemo(() => {
    const count = completedSessions.length;
    const volume = completedSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    return { count, volume, prs: prCount };
  }, [completedSessions, prCount]);

  // Weekly hero rings — past 7 days
  const heroRings = useMemo<ActivityRingData[]>(() => {
    const sevenDaysAgoMs = Date.now() - 7 * 86400000;
    const weekSessions = completedSessions.filter(
      (s) => new Date(s.startTime).getTime() >= sevenDaysAgoMs
    );
    const weekVol = weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const weekTimeMin = Math.round(
      weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60
    );
    const weekCount = weekSessions.length;
    return [
      { value: weekVol, max: Math.max(20000, weekVol), label: 'נפח', variant: 'accent' },
      { value: weekTimeMin, max: Math.max(240, weekTimeMin), label: 'זמן', variant: 'signal' },
      { value: weekCount, max: Math.max(5, weekCount), label: 'אימונים', variant: 'warn' },
    ];
  }, [completedSessions]);

  const hasHeroData = heroRings.some((r) => r.value > 0);

  // Volume over time — last 14 sessions for glow area chart
  const volumeData = useMemo<GlowAreaPoint[]>(() => {
    const ordered = [...completedSessions]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(-14);
    return ordered.map((s) => {
      const d = new Date(s.startTime);
      const label = Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      return { x: label, y: s.totalVolume || 0 };
    });
  }, [completedSessions]);

  // Per-exercise best-set sparklines — top 4 most-tracked lifts
  const prSparklines = useMemo(() => {
    const byExercise = new Map<string, number[]>();
    for (const session of completedSessions) {
      for (const ex of session.exercises ?? []) {
        const name = ex.exerciseName || ex.name;
        if (!name) continue;
        let bestSetVolume = 0;
        for (const set of ex.sets ?? []) {
          if (!set.isCompleted) continue;
          const vol = setVolume(set);
          if (vol > bestSetVolume) bestSetVolume = vol;
        }
        if (bestSetVolume === 0) continue;
        const existing = byExercise.get(name) ?? [];
        existing.push(bestSetVolume);
        byExercise.set(name, existing);
      }
    }
    const rows: { name: string; data: number[]; latest: number }[] = [];
    for (const [name, data] of byExercise) {
      if (data.length < 2) continue;
      rows.push({ name, data: data.slice(-12), latest: data[data.length - 1] ?? 0 });
    }
    rows.sort((a, b) => b.data.length - a.data.length);
    return rows.slice(0, 4);
  }, [completedSessions]);

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

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    []
  );

  return (
    <div
      className="ambient-mesh ambient-mesh-soft pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header */}
      <header
        className="masthead sticky top-0 z-20"
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          background: 'var(--fs-bg)',
        }}
      >
        <div
          className="kicker"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'var(--fs-muted)',
          }}
        >
          §05 · PROGRESS · {todayISO}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(44px, 12vw, 72px)',
            lineHeight: 0.9,
            marginTop: '8px',
            color: 'var(--fs-ink)',
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
            color: 'var(--fs-accent-2)',
            textTransform: 'uppercase',
          }}
        >
          {todayLabel}
        </p>
      </header>

      {/* Insight Card */}
      <div className="px-5 pt-4">
        <ProgressInsightCard sessions={completedSessions} />
      </div>

      {/* Premium hero — activity rings + glow volume + lift sparklines */}
      {hasHeroData && (
        <div className="px-5 pt-4">
          <section
            className="section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in"
            aria-label="סיכום שבועי"
            style={{
              padding: '18px',
              borderRadius: '24px 18px 24px 18px',
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr)',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <ActivityRings size={148} rings={heroRings} />
            <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                § 7-DAY · CYCLE
              </span>
              {heroRings.map((r) => {
                const pct = r.max > 0 ? Math.min(100, Math.round((r.value / r.max) * 100)) : 0;
                const dotColor =
                  r.variant === 'signal'
                    ? 'var(--fs-signal)'
                    : r.variant === 'warn'
                      ? 'var(--fs-warn)'
                      : 'var(--fs-accent)';
                return (
                  <div
                    key={r.label}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                      borderBottom: '1px solid var(--fs-surface-2)',
                      paddingBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--fs-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: dotColor,
                        }}
                      />
                      {r.label}
                    </span>
                    <span
                      className="kinetic-number"
                      style={{
                        color: 'var(--fs-ink)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Volume trajectory — glow area chart */}
      {volumeData.length >= 3 && (
        <div className="px-5 pt-4">
          <div
            className="magnetic-card glass-surface scrim-noise fs-accent-rail"
            style={{
              padding: 16,
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--fs-muted)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              § VOLUME · TRAJECTORY
            </div>
            <GlowAreaChart data={volumeData} height={160} xAxis />
          </div>
        </div>
      )}

      {/* Per-lift sparklines */}
      {prSparklines.length > 0 && (
        <div className="px-5 pt-4">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--fs-muted)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            § TOP · LIFTS
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {prSparklines.map((row) => (
              <div
                key={row.name}
                className="magnetic-card glass-surface fs-accent-rail"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1.4fr)',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: '20px 14px 20px 14px',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {row.name}
                </span>
                <span
                  className="kinetic-number"
                  style={{
                    direction: 'ltr',
                    color: 'var(--fs-accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {Math.round(row.latest).toLocaleString('en-US')}
                </span>
                <GradientSparkline data={row.data} width={160} height={36} live />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      {metrics.count > 0 && (
        <div
          className="px-5 pt-3"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
        >
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '12px 10px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 20,
                color: 'var(--fs-ink)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metrics.count}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
                marginTop: 4,
                textTransform: 'uppercase',
              }}
            >
              אימונים
            </div>
          </div>
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '12px 10px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 26,
                color: 'var(--fs-ink)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatVolume(metrics.volume)}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
                marginTop: 4,
                textTransform: 'uppercase',
              }}
            >
              נפח (ק"ג)
            </div>
          </div>
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '12px 10px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 20,
                color: 'var(--fs-ink)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metrics.prs}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
                marginTop: 4,
                textTransform: 'uppercase',
              }}
            >
              PRs
            </div>
          </div>
        </div>
      )}

      {/* Editorial Tab Bar — compact */}
      <div className="px-5 pt-4 pb-2">
        <div
          className="flex gap-1"
          style={{
            borderBottom: '1px solid var(--fs-surface-2)',
            gap: 0,
          }}
          role="tablist"
          aria-label="התקדמות"
        >
          {TABS.map((tab, idx) => (
            <button
              type="button"
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
                  const next = TABS[(idx + 1) % TABS.length];
                  if (!next) return;
                  setActiveTab(next.key);
                  document.getElementById(`progress-tab-${next.key}`)?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                  if (!prev) return;
                  setActiveTab(prev.key);
                  document.getElementById(`progress-tab-${prev.key}`)?.focus();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? 'var(--fs-ink)' : 'var(--fs-muted)',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeTab === tab.key ? '2px solid var(--fs-accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                textTransform: 'uppercase',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
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
          {activeTab === 'strength' && (
            <motion.div
              key="strength"
              id="progress-panel-strength"
              role="tabpanel"
              aria-labelledby="progress-tab-strength"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StrengthTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Workout History at Bottom */}
      <div className="px-5 pt-6">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--fs-surface-2)' }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            היסטוריית אימונים
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--fs-surface-2)' }} />
        </div>
        <WorkoutHistoryList sessions={completedSessions} />
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
