import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Battery,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Heart,
  Minus,
  Moon,
  Plus,
  Ruler,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ActivityRingData,
  ActivityRings,
  GlowAreaChart,
  type GlowAreaPoint,
  GradientSparkline,
} from '../components/charts';
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
import { getWorkoutSessions } from '../services/dataService';
import { getAllPRs } from '../services/prService';
import type { WorkoutSession } from '../types';
import { formatDuration, formatVolume } from '../utils/dateUtils';
import { safeJsonParse } from '../utils/safeJson';
import { setVolume } from '../utils/workoutMath';

type ProgressTab = 'weight' | 'measurements' | 'recovery' | 'strength';

const TABS: { key: ProgressTab; label: string; icon: React.ReactNode }[] = [
  { key: 'weight', label: 'משקל', icon: <Scale size={15} /> },
  { key: 'measurements', label: 'מדידות', icon: <Ruler size={15} /> },
  { key: 'recovery', label: 'ריקאברי', icon: <Heart size={15} /> },
  { key: 'strength', label: 'כוח', icon: <Dumbbell size={15} /> },
];

// ============================================================================
// Workout History Sub-Component — embedded at bottom of Progress page
// ============================================================================

const WorkoutHistoryList = memo(function WorkoutHistoryList({
  sessions,
}: { sessions: WorkoutSession[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (sessions.length === 0) {
    return (
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          padding: '20px',
          textAlign: 'center',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Dumbbell size={24} style={{ color: 'var(--fs-muted)', marginBottom: 8 }} />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
          }}
        >
          עדיין אין אימונים
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const completedSets = session.exercises.reduce(
          (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
          0
        );
        const topExercises = session.exercises.slice(0, 4);
        const dateStr = new Date(session.date || session.startTime).toLocaleDateString('he-IL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

        return (
          <motion.div
            key={session.id}
            layout
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Accent side bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />

            <div
              onClick={() => toggleExpand(session.id)}
              style={{
                padding: '14px 16px 14px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--fs-ink)',
                    letterSpacing: '0.02em',
                    lineHeight: 1.2,
                  }}
                >
                  {session.exercises[0]?.exerciseName || 'אימון'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fs-muted)',
                    letterSpacing: '0.05em',
                    marginTop: 2,
                  }}
                >
                  {dateStr}
                </div>
              </div>

              {/* Stats chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fs-muted)',
                  }}
                >
                  <Clock size={10} style={{ verticalAlign: 'middle', marginLeft: 2 }} />
                  {formatDuration(session.duration)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fs-muted)',
                  }}
                >
                  {completedSets} סטים
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fs-accent)',
                  }}
                >
                  {formatVolume(session.totalVolume)} ק"ג
                </span>
                {isExpanded ? (
                  <ChevronUp size={14} style={{ color: 'var(--fs-muted)' }} />
                ) : (
                  <ChevronDown size={14} style={{ color: 'var(--fs-muted)' }} />
                )}
              </div>
            </div>

            {/* Expanded exercises */}
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  borderTop: '1px solid var(--fs-surface-2)',
                  padding: '10px 16px 14px 20px',
                }}
              >
                {topExercises.map((ex, i) => {
                  const bestSet = ex.sets
                    .filter((s) => s.isCompleted)
                    .reduce(
                      (best, s) => {
                        const vol = setVolume(s);
                        return vol > best.volume
                          ? { weight: s.weight || 0, reps: s.reps || 0, volume: vol }
                          : best;
                      },
                      { weight: 0, reps: 0, volume: 0 }
                    );
                  return (
                    <div
                      key={ex.id || i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom:
                          i < topExercises.length - 1 ? '1px solid var(--fs-surface-2)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--fs-ink)',
                        }}
                      >
                        {ex.exerciseName || ex.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--fs-muted)',
                        }}
                      >
                        {bestSet.weight > 0
                          ? `${bestSet.weight}ק"ג × ${bestSet.reps}`
                          : `${ex.sets.filter((s) => s.isCompleted).length} סטים`}
                      </span>
                    </div>
                  );
                })}

                {session.exercises.length > 4 && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--fs-muted)',
                      textAlign: 'center',
                      padding: '6px 0',
                    }}
                  >
                    +{session.exercises.length - 4} תרגילים נוספים
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/detail/${session.id}`);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 8,
                    padding: '8px',
                    background: 'var(--fs-bg)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.05em',
                    color: 'var(--fs-accent-2)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  לפרטים מלאים →
                </button>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
});

// ============================================================================
// AI Insight Card (embedded, lightweight)
// ============================================================================

const ProgressInsightCard = memo(function ProgressInsightCard({
  sessions,
}: { sessions: WorkoutSession[] }) {
  const { completedCount, totalVolume, totalPRs } = useMemo(() => {
    let cc = 0;
    let tv = 0;
    let tp = 0;
    for (const s of sessions) {
      if (s.status === 'completed') cc += 1;
      tv += s.totalVolume || 0;
      if (s.rating && s.rating >= 4) tp += 1;
    }
    return { completedCount: cc, totalVolume: tv, totalPRs: tp };
  }, [sessions]);

  if (completedCount === 0) return null;

  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent side bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'var(--fs-accent)',
          borderTopLeftRadius: '22px',
          borderBottomLeftRadius: '16px',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={14} style={{ color: 'var(--fs-signal)' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          תובנה אוטומטית
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--fs-ink)',
        }}
      >
        {completedCount === 1
          ? 'התחלת את המסע! כל אימון מקרב אותך למטרה.'
          : `ביצעת ${completedCount} אימונים עם נפח כולל של ${formatVolume(totalVolume)} ק"ג. ${totalPRs > 0 ? `יש לך ${totalPRs} אימונים מצטיינים! ` : ''}המשך כך!`}
      </div>
    </div>
  );
});

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
  }, [sessions.length]);

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
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--fs-ink)',
                lineHeight: 1,
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
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--fs-ink)',
                lineHeight: 1,
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
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--fs-ink)',
                lineHeight: 1,
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

      {/* Hero stat block */}
      {latestWeight ? (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
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
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              background: 'var(--fs-signal)',
              color: 'var(--fs-heading)',
              padding: '3px 8px',
            }}
          >
            BMI {bmi ?? '—'}
          </span>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              marginTop: 12,
              textTransform: 'uppercase',
            }}
          >
            משקל נוכחי · CURRENT
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 48,
              color: 'var(--fs-ink)',
              lineHeight: 0.9,
              marginTop: 4,
            }}
          >
            {latestWeight.weight}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            KG
          </div>
          {bmiCategory && (
            <div
              className="mt-3 inline-block"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: 'var(--fs-primary)',
                color: 'var(--fs-signal)',
                padding: '4px 10px',
              }}
            >
              {bmiCategory.label}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--fs-muted)' }} />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
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
              style={{
                color: weightTrend.direction === 'ירידה' ? 'var(--fs-primary)' : 'var(--fs-ink)',
              }}
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
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="section-title flex items-center gap-2"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
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
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {entry.weight}
                  </span>
                  <motion.div
                    className="w-full"
                    style={{
                      backgroundColor: isLast ? 'var(--fs-signal)' : 'var(--fs-surface-2)',
                      border: isLast ? '2px solid var(--fs-primary)' : 'none',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
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

      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
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
            width: 4,
            background: 'var(--fs-accent)',
            borderTopLeftRadius: '22px',
            borderBottomLeftRadius: '16px',
          }}
        />
        <div className="flex items-center justify-between mb-4">
          <h2
            className="section-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            § LATEST UPDATE · עדכון אחרון
          </h2>
          <button
            onClick={onAdd}
            className="chip"
            style={{ background: 'var(--fs-signal)', color: 'var(--fs-heading)' }}
          >
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
                    borderBottom: '1px solid var(--fs-surface-2)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--fs-ink)',
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
                          color: diff < 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                          background: diff < 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
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
                        color: 'var(--fs-ink)',
                      }}
                    >
                      {curr ? `${curr}` : '—'}
                    </span>
                    <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
                      CM
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Ruler size={36} style={{ color: 'var(--fs-muted)' }} className="mb-3" />
            <p
              className="mb-5"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '16px',
                color: 'var(--fs-ink)',
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

  const scoreColor = recoveryScore?.color ?? 'var(--fs-muted)';
  const scorePct = recoveryScore ? recoveryScore.score : 0;

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§03 · RECOVERY</span>
        <span className="right">ריקאברי</span>
      </div>

      {/* Recovery score */}
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
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
            width: 4,
            background: 'var(--fs-accent)',
            borderTopLeftRadius: '22px',
            borderBottomLeftRadius: '16px',
          }}
        />
        <div className="flex items-center justify-between mb-5">
          <h2
            className="section-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            § TODAY · ציון ריקאברי
          </h2>
          <button
            onClick={onAdd}
            className="chip"
            style={{ background: 'var(--fs-signal)', color: 'var(--fs-heading)' }}
          >
            <Plus size={12} />
            עדכן
          </button>
        </div>

        {recoveryScore ? (
          <div>
            <div className="flex items-center gap-6 mb-5">
              {/* CSS circle score */}
              <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--fs-surface-2)' }}
                />
                <div
                  className="absolute inset-2 rounded-full"
                  style={{ backgroundColor: `${scoreColor}18` }}
                />
                <div className="relative z-10 text-center">
                  <div className="text-3xl font-black leading-none" style={{ color: scoreColor }}>
                    {recoveryScore.score}
                  </div>
                  <div className="text-[11px] mt-1 font-mono" style={{ color: 'var(--fs-muted)' }}>
                    {recoveryScore.label}
                  </div>
                </div>
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
                    stroke="var(--fs-surface-2)"
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
                  color="var(--fs-accent)"
                />
                <RecoveryBar
                  label="כאב"
                  value={recoveryScore.sorenessScore}
                  max={25}
                  color="var(--fs-warn)"
                />
                <RecoveryBar
                  label="אנרגיה"
                  value={recoveryScore.energyScore}
                  max={25}
                  color="var(--fs-signal)"
                />
                <RecoveryBar
                  label="לחץ"
                  value={recoveryScore.stressScore}
                  max={25}
                  color="var(--fs-accent)"
                />
              </div>
            </div>

            {todayRecovery && todayRecovery.tightAreas && todayRecovery.tightAreas.length > 0 && (
              <div className="pt-4" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
                <p className="text-[11px]" style={{ color: 'var(--fs-muted)', marginBottom: 8 }}>
                  אזורים תפוסים
                </p>
                <div className="flex flex-wrap gap-2">
                  {todayRecovery.tightAreas.map((area) => (
                    <span
                      key={area}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'var(--fs-surface-2)',
                        color: 'var(--fs-ink)',
                        border: '1px solid var(--fs-surface-2)',
                      }}
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
            <Heart size={30} style={{ color: 'var(--fs-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
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
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
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
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <h3
            className="section-title mb-4 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            <Activity size={14} />§ WEEKLY AVG · ממוצע שבועי
          </h3>
          <div className="data-strip">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={12} style={{ color: 'var(--fs-heading)' }} />
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
                <Battery size={12} style={{ color: 'var(--fs-heading)' }} />
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
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
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
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <h3
            className="section-title mb-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            § HISTORY · היסטוריית ריקאברי
          </h3>
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
                    style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
                  >
                    <span style={{ color: 'var(--fs-muted)', fontSize: 13 }}>
                      {new Date(log.date).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, fontWeight: 500, color: score.color }}>
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

// ============================================================================
// Strength Progress Tab
// ============================================================================

interface StrengthDataPoint {
  date: string;
  value: number;
  volume: number;
}

interface ExerciseStrengthCurve {
  exerciseName: string;
  data: StrengthDataPoint[];
  latestWeight: number;
  change: number;
  changePct: number;
}

const StrengthTab = memo(function StrengthTab() {
  const [curves, setCurves] = useState<ExerciseStrengthCurve[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    const loadStrengthData = async () => {
      try {
        setIsLoading(true);
        const sessions = await getWorkoutSessions(100);

        // Build a map of exercise name -> array of {date, maxWeight x reps (volume per set)}
        const exerciseMap = new Map<string, StrengthDataPoint[]>();

        for (const session of sessions) {
          if (session.status !== 'completed') continue;
          const date = session.date || session.startTime?.slice(0, 10);
          if (!date) continue;

          for (const exercise of session.exercises) {
            const name = exercise.exerciseName || exercise.name;
            if (!name) continue;

            // Find the best set (highest weight x reps) for this exercise in this session
            let bestWeight = 0;
            let bestVolume = 0;
            for (const set of exercise.sets || []) {
              if (!set.isCompleted) continue;
              const vol = setVolume(set);
              if (vol > bestVolume) {
                bestVolume = vol;
                bestWeight = set.weight || 0;
              }
            }

            if (bestVolume === 0) continue;

            const existing = exerciseMap.get(name) || [];
            existing.push({ date, value: bestWeight, volume: bestVolume });
            exerciseMap.set(name, existing);
          }
        }

        // Convert to curves and compute changes
        const result: ExerciseStrengthCurve[] = [];
        for (const [name, points] of exerciseMap.entries()) {
          // Sort by date ascending
          points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Deduplicate: keep best per date
          const deduped = new Map<string, StrengthDataPoint>();
          for (const p of points) {
            const existing = deduped.get(p.date);
            if (!existing || p.value > existing.value) {
              deduped.set(p.date, p);
            }
          }
          const uniquePoints = [...deduped.values()];

          if (uniquePoints.length < 2) continue;

          const latest = uniquePoints[uniquePoints.length - 1]!;
          const earliest = uniquePoints[0]!;
          const change = latest.value - earliest.value;
          const changePct = earliest.value > 0 ? Math.round((change / earliest.value) * 100) : 0;

          result.push({
            exerciseName: name,
            data: uniquePoints.slice(-15), // last 15 data points
            latestWeight: latest.value,
            change,
            changePct,
          });
        }

        // Sort by number of data points (most tracked first)
        result.sort((a, b) => b.data.length - a.data.length);
        setCurves(result);
        if (result.length > 0 && !selectedExercise) {
          setSelectedExercise(result[0]!.exerciseName);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadStrengthData();
  }, []);

  const activeCurve = curves.find((c) => c.exerciseName === selectedExercise);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
          <span className="left">§04 · STRENGTH</span>
          <span className="right">כוח</span>
        </div>
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--fs-signal)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      </div>
    );
  }

  if (curves.length === 0) {
    return (
      <div className="space-y-4">
        <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
          <span className="left">§04 · STRENGTH</span>
          <span className="right">כוח</span>
        </div>
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
          }}
        >
          <div className="flex flex-col items-center py-12 text-center gap-3">
            <Dumbbell size={36} style={{ color: 'var(--fs-muted)' }} />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              אין נתוני כוח עדיין
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              COMPLETE WORKOUTS TO TRACK STRENGTH PROGRESS
            </p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = activeCurve ? Math.max(...activeCurve.data.map((d) => d.value), 1) : 1;
  const minValue = activeCurve ? Math.min(...activeCurve.data.map((d) => d.value)) : 0;
  const range = maxValue - minValue || 1;

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§04 · STRENGTH</span>
        <span className="right">כוח</span>
      </div>

      {/* PR Leaderboard */}
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '16px 20px',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          לוח שיאים · PR BOARD
        </h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {curves.slice(0, 6).map((curve, i) => (
            <div
              key={curve.exerciseName}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background:
                  i === 0
                    ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
                    : 'var(--fs-surface-2)',
                borderRadius: 10,
                borderInlineStart: i === 0 ? '3px solid var(--fs-accent)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 800,
                    color: i === 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                    width: 20,
                  }}
                >
                  #{i + 1}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {curve.exerciseName.split('|')[0]?.trim() || curve.exerciseName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 18,
                    color: 'var(--fs-ink)',
                    direction: 'ltr',
                  }}
                >
                  {curve.latestWeight}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--fs-muted)',
                    letterSpacing: '0.08em',
                  }}
                >
                  KG
                </span>
                {curve.change > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fs-accent)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    +{curve.changePct}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise selector */}
      <div className="flex gap-2 flex-wrap">
        {curves.slice(0, 8).map((curve) => (
          <button
            key={curve.exerciseName}
            onClick={() => setSelectedExercise(curve.exerciseName)}
            className="chip"
            style={{
              background:
                selectedExercise === curve.exerciseName
                  ? 'var(--fs-signal)'
                  : 'var(--fs-surface-2)',
              color:
                selectedExercise === curve.exerciseName ? 'var(--fs-primary)' : 'var(--fs-ink)',
              borderColor:
                selectedExercise === curve.exerciseName ? 'var(--fs-primary)' : 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <span style={{ fontFamily: 'var(--font-hebrew)', fontSize: '13px', fontWeight: 600 }}>
              {curve.exerciseName.split('|')[0]?.trim() || curve.exerciseName}
            </span>
          </button>
        ))}
      </div>

      {/* Active exercise curve */}
      {activeCurve && (
        <>
          {/* Hero stat */}
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
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
                width: 4,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              משקל מקסימלי · TOP WEIGHT
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 48,
                color: 'var(--fs-ink)',
                lineHeight: 0.9,
                marginTop: 4,
              }}
            >
              {activeCurve.latestWeight}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                letterSpacing: '0.12em',
              }}
            >
              KG
            </div>
            {activeCurve.change !== 0 && (
              <div
                className="mt-3 inline-flex items-center gap-1.5"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  background: activeCurve.change > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                  color: activeCurve.change > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                  padding: '4px 10px',
                }}
              >
                {activeCurve.change > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {activeCurve.change > 0 ? '+' : ''}
                {activeCurve.change}KG ({activeCurve.changePct > 0 ? '+' : ''}
                {activeCurve.changePct}%)
              </div>
            )}
          </div>

          {/* Line chart */}
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="section-title flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                }}
              >
                <BarChart3 size={14} />§ STRENGTH CURVE
              </h3>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.12em',
                }}
              >
                {activeCurve.data.length} DATA POINTS
              </span>
            </div>

            {/* SVG Line Chart */}
            <div className="relative" style={{ height: '160px' }}>
              <svg viewBox="0 0 300 140" className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1="0"
                    y1={140 - pct * 120}
                    x2="300"
                    y2={140 - pct * 120}
                    stroke="var(--fs-surface-2)"
                    strokeWidth="1"
                  />
                ))}

                {/* Area fill */}
                <path
                  d={
                    activeCurve.data
                      .map((point, i) => {
                        const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                        const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ') + ` L 300 140 L 0 140 Z`
                  }
                  fill="color-mix(in srgb, var(--fs-accent) 10%, transparent)"
                />

                {/* Line */}
                <path
                  d={activeCurve.data
                    .map((point, i) => {
                      const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                      const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="var(--fs-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots */}
                {activeCurve.data.map((point, i) => {
                  const x = (i / Math.max(activeCurve.data.length - 1, 1)) * 300;
                  const y = 140 - ((point.value - minValue) / range) * 110 - 10;
                  const isLast = i === activeCurve.data.length - 1;
                  return (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isLast ? 5 : 3}
                        fill={isLast ? 'var(--fs-accent)' : 'var(--fs-primary)'}
                        stroke={isLast ? 'var(--fs-primary)' : 'var(--fs-accent)'}
                        strokeWidth={isLast ? 2 : 1}
                      />
                      {isLast && (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fill="var(--fs-accent)"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            fontWeight: 700,
                          }}
                        >
                          {point.value}kg
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Date labels */}
            <div className="flex justify-between mt-2">
              {activeCurve.data.length > 0 && (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {new Date(activeCurve.data[0]!.date).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {new Date(
                      activeCurve.data[activeCurve.data.length - 1]!.date
                    ).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Session-by-session detail */}
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
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
                width: 4,
                background: 'var(--fs-accent)',
                borderTopLeftRadius: '22px',
                borderBottomLeftRadius: '16px',
              }}
            />
            <h3
              className="section-title mb-3"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              § HISTORY · היסטוריית משקל
            </h3>
            <div className="space-y-1">
              {activeCurve.data
                .slice()
                .reverse()
                .slice(0, 10)
                .map((point, i) => {
                  const prevPoint = activeCurve.data[activeCurve.data.length - 1 - i - 1];
                  const diff = prevPoint ? point.value - prevPoint.value : null;
                  return (
                    <div
                      key={point.date}
                      className="flex items-center justify-between py-2.5"
                      style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
                    >
                      <span style={{ color: 'var(--fs-muted)', fontSize: 13 }}>
                        {new Date(point.date).toLocaleDateString('he-IL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        {diff !== null && diff !== 0 && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: diff > 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                              background: diff > 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
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
                            fontSize: '18px',
                            color: 'var(--fs-ink)',
                          }}
                        >
                          {point.value}
                        </span>
                        <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
                          KG
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
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
        <span className="font-semibold" style={{ color: 'var(--fs-muted)' }}>
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--fs-surface-2)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{ height: '100%', borderRadius: '9999px', backgroundColor: color }}
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
        className="w-full max-w-lg p-6"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
            }}
          />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            עדכון משקל
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
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
              style={{
                width: '144px',
                textAlign: 'center',
                background: 'transparent',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '48px',
                borderBottom: '2px solid var(--fs-accent)',
                outline: 'none',
              }}
              step="0.1"
              inputMode="decimal"
            />
            <div
              style={{
                fontSize: '18px',
                color: 'var(--fs-muted)',
                marginTop: '8px',
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
              }}
            >
              ק״ג
            </div>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
            style={{
              width: '100%',
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 0,
              padding: '14px 16px',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <motion.button
            onClick={async () => {
              if (!weight) return;
              setSaving(true);
              await onSave(Number.parseFloat(weight), notes);
              setSaving(false);
            }}
            disabled={!weight || saving}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              background: !weight || saving ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
              color: !weight || saving ? 'var(--fs-muted)' : 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: !weight || saving ? 'not-allowed' : 'pointer',
              opacity: !weight || saving ? 0.4 : 1,
            }}
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
        className="w-full max-w-lg p-6 max-h-[82vh] overflow-y-auto"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
            }}
          />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            עדכון מידות
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.label}>
              <label
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--fs-muted)',
                  marginBottom: '6px',
                  display: 'block',
                  fontWeight: 500,
                }}
              >
                {f.label} (ס״מ)
              </label>
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                placeholder="—"
                style={{
                  width: '100%',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                  padding: '12px 16px',
                  color: 'var(--fs-ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  outline: 'none',
                  textAlign: 'center',
                }}
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
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 0,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '16px',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            marginTop: '20px',
          }}
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
        className="w-full max-w-lg p-6 max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
            }}
          />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            דיווח ריקאברי
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
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
            color="var(--fs-accent)"
          />
          <SliderInput
            label="איכות שינה"
            value={sleepQuality}
            onChange={(v) => setSleepQuality(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="var(--fs-accent)"
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
            color="var(--fs-warn)"
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
            color="var(--fs-signal)"
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
            color="var(--fs-accent)"
            labels={['מלחיץ מאוד', 'מלחיץ', 'בסדר', 'רגוע', 'רגוע לחלוטין']}
          />

          <div>
            <label
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--fs-muted)',
                marginBottom: '12px',
                display: 'block',
                fontWeight: 500,
              }}
            >
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
                  style={{
                    padding: '8px 14px',
                    borderRadius: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: tightAreas.includes(area)
                      ? 'var(--fs-primary)'
                      : 'var(--fs-surface-2)',
                    color: tightAreas.includes(area) ? 'var(--fs-accent)' : 'var(--fs-muted)',
                  }}
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
            style={{
              width: '100%',
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 0,
              padding: '14px 16px',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              outline: 'none',
            }}
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
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              background: 'var(--fs-primary)',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
            }}
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
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '16px', color }}
        >
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
        className="w-full h-2 appearance-none cursor-pointer"
        style={{ accentColor: color, borderRadius: 0 }}
      />
      {labels && (
        <div
          className="flex justify-between"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            color: 'var(--fs-muted)',
            marginTop: '6px',
          }}
        >
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
});
