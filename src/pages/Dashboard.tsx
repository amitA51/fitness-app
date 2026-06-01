/**
 * SparkOS Fitness — Dashboard (Fresh Steel)
 * Lean home: entry point + one primary CTA + glanceable weekly summary.
 * Deep analytics (consistency, muscle distribution, full history) live in Progress.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityRings } from '../components/charts';
import { RING_DRAW_DURATION, ringDelay } from '../components/charts/ActivityRings';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { ForecastNudge } from '../components/dashboard/ForecastNudge';
import { RecentPRBanner } from '../components/dashboard/RecentPRBanner';
import { StartWorkoutSheet } from '../components/dashboard/StartWorkoutSheet';
import { TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WorkoutStreak } from '../components/dashboard/WorkoutStreak';
import { WorkoutHistory } from '../components/workout/history/WorkoutHistory';
import { useData } from '../contexts/DataContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { useCountUp } from '../hooks/useCountUp';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { formatThousands } from '../lib/gsap';
import { onWorkoutSaved } from '../services/dataEvents';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';
import { getWeekStart } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [isStartSheetOpen, setIsStartSheetOpen] = useState(false);
  // Bumped after a pull-to-refresh so the memo'd rings + legend count-ups replay
  // the cascade in lockstep even when the underlying values are unchanged.
  const [refreshTick, setRefreshTick] = useState(0);

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
      setRefreshTick((tick) => tick + 1);
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
    return onWorkoutSaved(load);
  }, []);

  // Single source of completed sessions — all derived calcs feed from this so
  // we don't re-filter the same array in several memos.
  const completedSessions = useMemo(
    () => workoutSessions.filter((s) => s.status === 'completed'),
    [workoutSessions]
  );

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

  // ── Start-workout flow ──────────────────────────────────────────────────────
  // One primary CTA opens a choice sheet (continue last / pick template / empty).
  const openStartSheet = useCallback(() => setIsStartSheetOpen(true), []);
  const closeStartSheet = useCallback(() => setIsStartSheetOpen(false), []);

  const handleContinueLast = useCallback(() => {
    setIsStartSheetOpen(false);
    if (lastUsedTemplate) navigate(`/workout/${lastUsedTemplate.id}`);
  }, [lastUsedTemplate, navigate]);

  const handlePickTemplate = useCallback(() => {
    setIsStartSheetOpen(false);
    navigate('/templates');
  }, [navigate]);

  const handleEmptyWorkout = useCallback(() => {
    setIsStartSheetOpen(false);
    navigate('/workout');
  }, [navigate]);

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

      const completed = completedSessions;

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
    [completedSessions]
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
  const goToTemplates = useCallback(() => navigate('/templates'), [navigate]);

  // Format helpers
  const volDelta = useMemo(() => {
    if (!Number.isFinite(weekData.volDeltaPct) || weekData.volDeltaPct === 0) return '—';
    const sign = weekData.volDeltaPct > 0 ? '+' : '';
    return `${sign}${weekData.volDeltaPct.toFixed(1)}%`;
  }, [weekData.volDeltaPct]);

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

      <DashboardHeader hasSessionToday={hasSessionToday} />

      <main style={{ padding: '20px 20px 32px' }}>
        {/* 1. Single primary CTA — opens the start-workout choice sheet */}
        <button
          type="button"
          onClick={openStartSheet}
          className="accent-glow"
          aria-haspopup="dialog"
          aria-expanded={isStartSheetOpen}
          aria-label="התחל אימון"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
            border: '2px solid var(--fs-accent)',
            borderRadius: 'var(--radius-asymmetric)',
            cursor: 'pointer',
            color: 'var(--color-ink-on-accent)',
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
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--fs-accent)',
              color: 'var(--fs-heading)',
              fontFamily: 'var(--font-mono)',
              fontSize: 20,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            ←
          </span>
          <span>התחל אימון</span>
        </button>

        {/* Workout streak */}
        <div style={{ marginTop: 16 }}>
          <WorkoutStreak sessions={workoutSessions} />
        </div>

        {/* 2. Forecast nudge — moved up so it isn't missed at the bottom */}
        <ForecastNudge sessions={workoutSessions} />

        {/* 3. Hero bento — weekly activity rings (the glanceable summary) */}
        {(weekData.workoutsThisWeek > 0 || weekData.volume > 0) && (
          <section
            className="section-spotlight magnetic-card glass-surface scrim-noise fade-rise-in"
            aria-label="סיכום שבועי"
            style={{
              marginTop: 20,
              padding: '20px 20px 24px',
              borderRadius: '24px 16px 24px 16px',
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr)',
              gap: 18,
              alignItems: 'center',
            }}
          >
            <ActivityRings size={156} rings={heroRings} trigger={refreshTick} />
            <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--fs-ink)',
                }}
              >
                סיכום שבועי
              </span>
              <div style={{ display: 'grid', gap: 6 }}>
                <BentoRow
                  key={`accent-${refreshTick}`}
                  dot="accent"
                  label="אימונים"
                  value={weekData.workoutsThisWeek}
                  suffix=" / 4"
                  delay={ringDelay(0)}
                />
                <BentoRow
                  key={`signal-${refreshTick}`}
                  dot="signal"
                  label="נפח"
                  value={weekData.volume}
                  format={formatThousands}
                  ltr
                  suffix={' ק״ג'}
                  delay={ringDelay(1)}
                  sub={volDelta !== '—' ? volDelta : undefined}
                />
                <BentoRow
                  key={`warn-${refreshTick}`}
                  dot="warn"
                  label="זמן"
                  value={weekData.totalMinutes}
                  suffix="′ / 240′"
                  delay={ringDelay(2)}
                />
              </div>
            </div>
          </section>
        )}

        {/* 4. Templates — quick strip + library affordance */}
        {sortedTemplates.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
          </section>
        )}

        {/* 5. Weekly calendar */}
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

        {/* 6. Recent workouts — unified compact history */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="אימונים אחרונים" />
          <WorkoutHistory sessions={workoutSessions} mode="compact" isLoading={dataLoading} />
        </section>

        {/* 7. PR highlights (compact) */}
        <RecentPRBanner />

        <div style={{ height: 24 }} />
      </main>

      <StartWorkoutSheet
        isOpen={isStartSheetOpen}
        onClose={closeStartSheet}
        lastUsedTemplate={lastUsedTemplate}
        onContinueLast={handleContinueLast}
        onPickTemplate={handlePickTemplate}
        onEmptyWorkout={handleEmptyWorkout}
      />
    </div>
  );
}

// ── SectionTitle ─────────────────────────────────────────────────────────────
interface SectionTitleAction {
  label: string;
  onClick: () => void;
}

const SectionTitle = memo(function SectionTitle({
  text,
  action,
}: {
  text: string;
  action?: SectionTitleAction;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          lineHeight: 1.2,
          color: 'var(--fs-ink)',
          margin: 0,
        }}
      >
        {text}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="focus-ring"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--fs-accent-2)',
          }}
        >
          {action.label} →
        </button>
      )}
    </div>
  );
});

// ── BentoRow — single legend line under hero rings ───────────────────────────
// Each number counts up in lockstep with its matching ring: it STARTS at the
// ring's stagger delay and runs for RING_DRAW_DURATION, so ring + number finish
// together. useCountUp already guards reduced-motion (snaps to final).
const BentoRow = memo(function BentoRow({
  dot,
  label,
  value,
  suffix,
  sub,
  delay,
  format,
  ltr,
}: {
  dot: 'accent' | 'signal' | 'warn';
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  delay: number;
  format?: (value: number) => string;
  ltr?: boolean;
}) {
  const dotColor =
    dot === 'signal' ? 'var(--fs-signal)' : dot === 'warn' ? 'var(--fs-warn)' : 'var(--fs-accent)';

  const numberRef = useRef<HTMLSpanElement>(null);
  useCountUp(numberRef, value, { delay, duration: RING_DRAW_DURATION, format });

  const fallback = format ? format(value) : String(Math.round(value));
  const numberSpan = (
    <span ref={numberRef} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {fallback}
    </span>
  );

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
          fontVariantNumeric: 'tabular-nums',
          minWidth: '3ch',
          textAlign: 'end',
        }}
      >
        <span className="kinetic-number">
          {ltr ? <span dir="ltr">{numberSpan}</span> : numberSpan}
          {suffix}
        </span>
        {sub && <span style={{ color: 'var(--fs-accent)', fontSize: 10 }}>{sub}</span>}
      </span>
    </div>
  );
});
