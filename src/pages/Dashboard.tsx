/**
 * SparkOS Fitness — Dashboard (Fresh Steel)
 * Clean home layout: CTA, quick templates, metrics row, weekly calendar.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityRings } from '../components/charts';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { ForecastNudge } from '../components/dashboard/ForecastNudge';
import { RecentPRBanner } from '../components/dashboard/RecentPRBanner';
import { RecentWorkouts } from '../components/dashboard/RecentWorkouts';
import { TemplateQuickStart, TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { useData } from '../contexts/DataContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';
import { getWeekStart } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

  const { sessions: dataContextSessions, refreshData, loading: dataLoading } = useData();
  const { workoutSessions } = useFitnessInsights(dataContextSessions);

  const { isPulling, isRefreshing, pullDistance, threshold, handlers } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        refreshData(),
        getWorkoutTemplates()
          .then(setTemplates)
          .catch((err) => logger.workout.warn('Failed to refresh templates', err)),
      ]);
    },
    threshold: 80,
  });

  useEffect(() => {
    async function load() {
      try {
        const rawTemplates = await getWorkoutTemplates();
        setTemplates(rawTemplates);
      } catch (err) {
        logger.workout.warn('Failed to load templates on dashboard', err);
      }
    }
    load();
    window.addEventListener('WORKOUT_SAVED', load);
    return () => window.removeEventListener('WORKOUT_SAVED', load);
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...templates.filter((t) => t.isFavorite), ...templates.filter((t) => !t.isFavorite)];
  }, [templates]);

  const lastUsedTemplate = useMemo(() => {
    const completed = [...templates].filter((t) => t.lastUsed);
    if (completed.length === 0) return null;
    completed.sort((a, b) => {
      const ta = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const tb = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return tb - ta;
    });
    return completed[0] ?? null;
  }, [templates]);

  const handleQuickStart = useCallback(() => {
    if (lastUsedTemplate) navigate(`/workout/${lastUsedTemplate.id}`);
    else navigate('/workout');
  }, [lastUsedTemplate, navigate]);

  const goToPrevWeek = useCallback(() => {
    setSelectedWeekOffset((prev) => prev - 1);
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedWeekOffset((prev) => Math.min(prev + 1, 0));
  }, []);

  // Week calculation
  const getWeekData = useCallback(
    (offset: number) => {
      const now = new Date();
      const currentWeekStart = getWeekStart(now);
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(targetWeekStart.getDate() + offset * 7);
      const targetWeekEnd = new Date(targetWeekStart);
      targetWeekEnd.setDate(targetWeekEnd.getDate() + 7);

      const completed = workoutSessions.filter((s) => s.status === 'completed');

      const weekSessions = completed.filter((s) => {
        const d = new Date(s.startTime);
        return d >= targetWeekStart && d < targetWeekEnd;
      });

      const volume = weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
      const prevWeekStart = new Date(targetWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevSessions = completed.filter((s) => {
        const d = new Date(s.startTime);
        return d >= prevWeekStart && d < targetWeekStart;
      });
      const prevVolume = prevSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);

      const totalMinutes = Math.round(
        weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60
      );

      const avgDurationMin =
        weekSessions.length > 0 ? Math.round(totalMinutes / weekSessions.length) : 0;

      return {
        workoutsThisWeek: weekSessions.length,
        volume,
        avgDurationMin,
        totalMinutes,
        volDeltaPct: prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : 0,
      };
    },
    [workoutSessions]
  );

  const weekData = useMemo(
    () => getWeekData(selectedWeekOffset),
    [getWeekData, selectedWeekOffset]
  );

  const hasSessionToday = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return workoutSessions.some((s) => {
      const sd = new Date(s.startTime);
      return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
    });
  }, [workoutSessions]);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  // Format helpers
  const volumeLabel = useMemo(
    () =>
      Math.round(weekData.volume) >= 1000
        ? Math.round(weekData.volume).toLocaleString('en-US')
        : String(Math.round(weekData.volume)),
    [weekData.volume]
  );

  const volDelta = useMemo(() => {
    if (!Number.isFinite(weekData.volDeltaPct) || weekData.volDeltaPct === 0) return '—';
    const sign = weekData.volDeltaPct > 0 ? '+' : '';
    return `${sign}${weekData.volDeltaPct.toFixed(1)}%`;
  }, [weekData.volDeltaPct]);

  const metricCards = useMemo(
    () => [
      {
        val: String(weekData.workoutsThisWeek),
        lbl: 'אימונים השבוע',
      },
      {
        val: volumeLabel || '—',
        sub: volDelta !== '—' ? volDelta : null,
        lbl: 'נפח (ק"ג)',
      },
      {
        val: weekData.avgDurationMin > 0 ? `${weekData.avgDurationMin}′` : '—',
        lbl: 'משך ממוצע',
      },
    ],
    [weekData.workoutsThisWeek, weekData.avgDurationMin, volumeLabel, volDelta]
  );

  // Stabilise rings array so ActivityRings (memo'd) doesn't re-render on parent re-renders.
  const heroRings = useMemo(
    () => [
      {
        value: weekData.workoutsThisWeek,
        max: 4,
        label: 'אימונים',
        variant: 'accent' as const,
      },
      {
        value: weekData.volume,
        max: Math.max(weekData.volume, 8000),
        label: 'נפח',
        variant: 'signal' as const,
      },
      {
        value: weekData.totalMinutes,
        max: 240,
        label: 'דקות',
        variant: 'warn' as const,
      },
    ],
    [weekData.workoutsThisWeek, weekData.volume, weekData.totalMinutes]
  );

  return (
    <div
      dir="rtl"
      className="ambient-mesh ambient-mesh-soft"
      style={{
        background: 'var(--fs-bg)',
        minHeight: '100dvh',
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'max(7rem, calc(4rem + env(safe-area-inset-bottom)))',
      }}
      {...handlers}
    >
      {/* Pull-to-refresh indicator */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: pullDistance > 0 ? Math.min(pullDistance, threshold * 1.5) : 0,
          overflow: 'hidden',
          transition: isPulling && !isRefreshing ? 'none' : 'height 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className={`glass-surface ${pullDistance > threshold || isRefreshing ? 'accent-glow' : ''}`}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            opacity: isRefreshing
              ? 1
              : pullDistance > 20
                ? Math.min(pullDistance / threshold, 1)
                : 0,
            transform: `scale(${isRefreshing ? 1 : Math.min(pullDistance / (threshold * 0.8), 1)})`,
            transition: 'opacity 0.2s, transform 0.2s',
            animation: isRefreshing ? 'spin 1.2s linear infinite' : 'none',
          }}
        >
          <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden="true">
            <circle className="ring-track" cx={22} cy={22} r={18} fill="none" strokeWidth={4} />
            <circle
              className="ring-progress"
              cx={22}
              cy={22}
              r={18}
              fill="none"
              strokeWidth={4}
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={
                2 * Math.PI * 18 * (1 - (isRefreshing ? 1 : Math.min(pullDistance / threshold, 1)))
              }
              transform="rotate(-90 22 22)"
            />
          </svg>
        </div>
      </div>

      <DashboardHeader
        weekNumber={getWeekNumberForOffset(selectedWeekOffset)}
        hasSessionToday={hasSessionToday}
      />

      <main style={{ padding: '20px 20px 28px' }}>
        {/* 1. Primary CTA — "התחל אימון חדש" */}
        <button
          type="button"
          onClick={handleQuickStart}
          className="accent-glow"
          aria-label={
            lastUsedTemplate ? `התחל מחדש אימון ${lastUsedTemplate.name}` : 'התחל אימון חדש'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
            border: '2px solid var(--fs-accent)',
            borderRadius: '22px 16px 22px 16px',
            cursor: 'pointer',
            color: '#071412',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 24,
            textAlign: 'right',
            lineHeight: 1,
            letterSpacing: '-0.01em',
            boxShadow: 'var(--shadow-card)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--fs-accent)',
              color: 'var(--fs-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 20,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            →
          </span>
          <span>התחל אימון חדש</span>
        </button>

        {/* 2. Hero bento — weekly activity rings */}
        <section
          className="section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in"
          aria-label="סיכום שבועי"
          style={{
            marginTop: 24,
            padding: '20px 18px 22px',
            borderRadius: '24px 18px 24px 18px',
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <ActivityRings size={156} rings={heroRings} />
          <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
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
              § WEEKLY · SUMMARY
            </span>
            <div style={{ display: 'grid', gap: 6 }}>
              <BentoRow dot="accent" label="אימונים" value={`${weekData.workoutsThisWeek} / 4`} />
              <BentoRow
                dot="signal"
                label="נפח"
                value={`${volumeLabel} ק״ג`}
                sub={volDelta !== '—' ? volDelta : undefined}
              />
              <BentoRow dot="warn" label="זמן" value={`${weekData.totalMinutes}′ / 240′`} />
            </div>
          </div>
        </section>

        {/* 3. "המשך מהר" — Quick templates */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="המשך מהר" />
          <TemplateQuickStart onQuickStart={handleQuickStart} />
          <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
        </section>

        {/* 3. Metrics row — 3 cards */}
        <section
          className="fade-rise-in"
          style={{
            marginTop: 24,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}
        >
          {metricCards.map((m) => (
            <MetricCard key={m.lbl} value={m.val} label={m.lbl} sub={m.sub} />
          ))}
        </section>

        {/* 4. Weekly calendar */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="יומן אימונים" />
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              padding: 20,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <WeeklyGrid
              sessions={workoutSessions}
              weekOffset={selectedWeekOffset}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </div>
        </section>

        {/* 5. Recent workouts */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="אימונים אחרונים" />
          <RecentWorkouts sessions={workoutSessions} loading={dataLoading} />
        </section>

        {/* 6. PR highlights (compact) */}
        <RecentPRBanner />

        {/* 7. Forecast nudge — overdue muscle / declining volume */}
        <ForecastNudge sessions={workoutSessions} />

        <div style={{ height: 24 }} />
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekNumberForOffset(offset: number): number {
  const now = new Date();
  const start = getWeekStart(now);
  start.setDate(start.getDate() + offset * 7);
  const temp = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const dayNum = (temp.getUTCDay() + 6) % 7; // Monday=0
  temp.setUTCDate(temp.getUTCDate() - dayNum + 3);
  const firstThursday = temp.getTime();
  temp.setUTCMonth(0, 1);
  if (temp.getUTCDay() !== 4) {
    temp.setUTCMonth(0, 1 + ((4 - temp.getUTCDay() + 7) % 7));
  }
  return 1 + Math.round((firstThursday - temp.getTime()) / 604800000);
}

// ── SectionTitle ─────────────────────────────────────────────────────────────
function SectionTitle({ text }: { text: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 800,
        fontSize: 11,
        lineHeight: 1,
        color: 'var(--fs-muted)',
        marginBottom: 12,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </h2>
  );
}

// ── BentoRow — single legend line under hero rings ───────────────────────────
const BentoRow = memo(function BentoRow({
  dot,
  label,
  value,
  sub,
}: {
  dot: 'accent' | 'signal' | 'warn';
  label: string;
  value: string;
  sub?: string;
}) {
  const dotColor =
    dot === 'signal' ? 'var(--fs-signal)' : dot === 'warn' ? 'var(--fs-warn)' : 'var(--fs-accent)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        borderBottom: '1px solid var(--fs-surface-2)',
        paddingBottom: 6,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          color: 'var(--fs-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }}
        />
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
          color: 'var(--fs-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        <span className="kinetic-number">{value}</span>
        {sub && <span style={{ color: 'var(--fs-accent)', fontSize: 10 }}>{sub}</span>}
      </span>
    </div>
  );
});

// ── MetricCard — FS panel style ──────────────────────────────────────────────
const MetricCard = memo(function MetricCard({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string | null;
}) {
  return (
    <div
      className="magnetic-card fs-accent-rail"
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        padding: '14px 12px',
        boxShadow: 'var(--shadow-card)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: 22,
          lineHeight: 1,
          color: 'var(--fs-ink)',
          letterSpacing: '-0.01em',
        }}
      >
        <span className="kinetic-number">{value}</span>
      </div>
      {sub && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--fs-accent)',
            marginTop: 2,
            letterSpacing: '0.04em',
          }}
        >
          {sub}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fs-muted)',
          marginTop: sub ? 0 : 4,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
});
