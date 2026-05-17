/**
 * SparkOS Fitness — Dashboard (Fresh Steel)
 * Clean home layout: CTA, quick templates, metrics row, weekly calendar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
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

      const avgDurationMin =
        weekSessions.length > 0
          ? Math.round(
              weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / weekSessions.length / 60
            )
          : 0;

      return {
        workoutsThisWeek: weekSessions.length,
        volume,
        avgDurationMin,
        volDeltaPct: prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : 0,
      };
    },
    [workoutSessions]
  );

  const weekData = useMemo(
    () => getWeekData(selectedWeekOffset),
    [getWeekData, selectedWeekOffset]
  );

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  // Format helpers
  const volumeLabel =
    Math.round(weekData.volume) >= 1000
      ? Math.round(weekData.volume).toLocaleString('en-US')
      : String(Math.round(weekData.volume));

  const volDelta = (() => {
    if (!Number.isFinite(weekData.volDeltaPct) || weekData.volDeltaPct === 0) return '—';
    const sign = weekData.volDeltaPct > 0 ? '+' : '';
    return `${sign}${weekData.volDeltaPct.toFixed(1)}%`;
  })();

  const metricCards = [
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
  ];

  return (
    <div
      dir="rtl"
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
          style={{
            width: pullDistance > threshold ? 28 : 20,
            height: pullDistance > threshold ? 28 : 20,
            border: '2px solid var(--fs-accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
            opacity: isRefreshing
              ? 1
              : pullDistance > 20
                ? Math.min(pullDistance / threshold, 1)
                : 0,
            transition: 'width 0.2s, height 0.2s, opacity 0.2s',
          }}
        />
      </div>

      <DashboardHeader weekNumber={getWeekNumberForOffset(selectedWeekOffset)} />

      <main style={{ padding: '20px 20px 28px' }}>
        {/* 1. Primary CTA — "התחל אימון חדש" */}
        <button
          type="button"
          onClick={handleQuickStart}
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

        {/* 2. "המשך מהר" — Quick templates */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="המשך מהר" />
          <TemplateQuickStart onQuickStart={handleQuickStart} />
          <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
        </section>

        {/* 3. Metrics row — 3 cards */}
        <section
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

// ── MetricCard — FS panel style ──────────────────────────────────────────────
function MetricCard({
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
      className="fs-accent-rail"
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
        {value}
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
}
