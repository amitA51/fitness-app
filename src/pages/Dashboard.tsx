/**
 * SparkOS Fitness — Dashboard (Fresh Steel)
 * Lean home: entry point + one primary CTA + glanceable weekly summary.
 * Deep analytics (consistency, muscle distribution, full history) live in Progress.
 */

import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  Dumbbell,
  RefreshCw,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Keep Dashboard off the charts barrel: unused GSAP chart re-exports are side-effectful.
// This direct import preserves the audit's 72.25 kB GSAP boundary.
import {
  ActivityRings,
  RING_DRAW_DURATION,
  RING_STAGGER,
  ringDelay,
} from '../components/charts/ActivityRings';
import { CoachBriefCard } from '../components/dashboard/CoachBriefCard';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { InsightCard } from '../components/dashboard/InsightCard';
import { ProgramCard } from '../components/dashboard/ProgramCard';
import { StartWorkoutSheet } from '../components/dashboard/StartWorkoutSheet';
import { StreakMilestone } from '../components/dashboard/StreakMilestone';
import { TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { TodaysWorkoutCard } from '../components/dashboard/TodaysWorkoutCard';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WorkoutStreak } from '../components/dashboard/WorkoutStreak';
import { pickDashboardInsight } from '../components/dashboard/insightPicker';
import { deriveRingGoals } from '../components/dashboard/ringGoals';
import { CoachMark } from '../components/guidance/CoachMark';
import { FadeIn } from '../components/motion/FadeIn';
import { Stagger, StaggerItem } from '../components/motion/Stagger';
import { SkeletonBox } from '../components/ui/SkeletonLoader';
import { Z_INDEX } from '../constants/zIndex';
import { useCoach } from '../contexts/CoachContext';
import { useData } from '../contexts/DataContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { useCountUp } from '../hooks/useCountUp';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { listMyCoaches } from '../services/coach/relationshipService';
import { onWorkoutSaved } from '../services/dataEvents';
import { getCurrentUser } from '../services/supabaseAuth';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';
import { getWeekStart } from '../utils/dateUtils';
import { formatThousands } from '../utils/formatThousands';
import { logger } from '../utils/logger';
import { zoneColor } from '../utils/zoneColor';

/** |WoW volume change| below this (%) reads as flat ("ללא שינוי"), not a delta. */
const FLAT_DELTA_PCT = 0.5;

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [isStartSheetOpen, setIsStartSheetOpen] = useState(false);
  /**
   * D4 activation: a first-run user finishing onboarding lands with the
   * start-workout sheet already open — the "ready-to-start beginner workout"
   * instead of a dashboard they must re-interpret. One-shot; dismissed like
   * any other sheet open.
   */
  const [autoOpenedStartSheet, setAutoOpenedStartSheet] = useState(false);
  // Bumped after a pull-to-refresh so the memo'd rings + legend count-ups replay
  // the cascade in lockstep even when the underlying values are unchanged.
  const [refreshTick, setRefreshTick] = useState(0);
  // First-load skeleton gate: only show the page skeleton on the very first
  // mount-load, never on pull-to-refresh (which keeps the populated page).
  const hasLoadedOnce = useRef(false);

  const { sessions: dataContextSessions, refreshData, loading: dataLoading } = useData();
  const {
    workoutSessions,
    weekOverWeekDeltas,
    muscleGroups,
    currentStreak,
    workoutsThisMonth,
    totalWorkouts,
    error: insightsError,
  } = useFitnessInsights(dataContextSessions);

  // One locally-computed insight (progression → neglected muscle →
  // always-fillable fallback). Pure math over the already-aggregated insights —
  // no AI calls here.
  const dashboardInsight = useMemo(
    () =>
      pickDashboardInsight({
        weekOverWeekDeltas,
        muscleGroups,
        currentStreak,
        workoutsThisMonth,
        totalWorkouts,
      }),
    [weekOverWeekDeltas, muscleGroups, currentStreak, workoutsThisMonth, totalWorkouts]
  );

  const [templatesError, setTemplatesError] = useState(false);
  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await getWorkoutTemplates());
      setTemplatesError(false);
    } catch (err) {
      logger.workout.warn('Failed to load templates on dashboard', err);
      setTemplatesError(true);
    }
  }, []);

  const { isPulling, isRefreshing, pullDistance, threshold, handlers } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([refreshData(), loadTemplates()]);
      setRefreshTick((tick) => tick + 1);
    },
    threshold: 80,
  });

  useEffect(() => {
    loadTemplates();
    return onWorkoutSaved(loadTemplates);
  }, [loadTemplates]);

  // Mark the first successful data load so the skeleton only shows on the very
  // first mount, not on subsequent pull-to-refreshes.
  useEffect(() => {
    if (!dataLoading) hasLoadedOnce.current = true;
  }, [dataLoading]);

  // Single source of completed sessions — all derived calcs feed from this so
  // we don't re-filter the same array in several memos.
  const completedSessions = useMemo(
    () => workoutSessions.filter((s) => s.status === 'completed'),
    [workoutSessions]
  );

  // Zero-session trainees get a composed first-run hero instead of the stack of
  // self-hidden cards (avoids the empty-calendar / duplicate "start" collision).
  const hasAnySession = completedSessions.length > 0;
  // Show the dashboard-shaped skeleton only on the first mount-load.
  const showSkeleton = dataLoading && !hasLoadedOnce.current;
  // The zero-session first-run hero owns the start CTA + explanation; when it is
  // showing, the masthead start CTA above would be a second identical mint button.
  const showFirstRunHero = !showSkeleton && !insightsError && !hasAnySession;

  // D4: on the very first render where the FirstRunHero is about to show,
  // open the start-workout sheet once. The hero's numbered steps explain the
  // flow; the sheet puts the recommended path one tap from a workout.
  useEffect(() => {
    if (autoOpenedStartSheet || showSkeleton || insightsError || hasAnySession) return;
    setAutoOpenedStartSheet(true);
    const id = window.setTimeout(() => setIsStartSheetOpen(true), 600);
    return () => window.clearTimeout(id);
  }, [autoOpenedStartSheet, showSkeleton, insightsError, hasAnySession]);

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
    // Skip the PreWorkout welcome and land straight on the exercise selector —
    // "אימון ריק" means "add exercises as you go", so a second start tap is friction.
    navigate('/workout', { state: { startEmpty: true } });
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
        // Keep "no prior data" distinct from "no change": hasPrevWeek lets the
        // chip say "שבוע ראשון" instead of conflating both as a dash.
        hasPrevWeek: prevVolume > 0,
        volDeltaPct: prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : 0,
      };
    },
    [completedSessions]
  );

  const weekData = useMemo(
    () => getWeekData(selectedWeekOffset),
    [getWeekData, selectedWeekOffset]
  );

  // Per-user ring goals from the trailing baseline (independent of the selected
  // week so the targets stay stable while paging history).
  const ringGoals = useMemo(
    () => deriveRingGoals(completedSessions, getWeekStart(new Date())),
    [completedSessions]
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

  // Weekly volume WoW chip. Distinguishes three honest cases instead of dressing
  // a ~0% change as "+0.0%" or conflating "no prior data" with "no change":
  //   • no prior week's volume → "שבוע ראשון" (neutral, no comparison)
  //   • |Δ| < FLAT_DELTA_PCT     → "ללא שינוי" (flat, neutral)
  //   • otherwise               → signed percentage (good up / neutral down)
  const volDeltaChip = useMemo(() => {
    if (!weekData.hasPrevWeek || !Number.isFinite(weekData.volDeltaPct)) {
      // No prior week to compare against — say so rather than show a dash that
      // looks like "no change".
      return { text: 'אין השוואה', zone: 'neutral' as const };
    }
    if (Math.abs(weekData.volDeltaPct) < FLAT_DELTA_PCT) {
      return { text: 'ללא שינוי', zone: 'neutral' as const };
    }
    const sign = weekData.volDeltaPct > 0 ? '+' : '';
    return {
      text: `${sign}${weekData.volDeltaPct.toFixed(1)}%`,
      // A drop is not a win — demote it to neutral instead of celebrating it.
      zone: weekData.volDeltaPct < 0 ? ('neutral' as const) : ('good' as const),
    };
  }, [weekData.hasPrevWeek, weekData.volDeltaPct]);

  // Stabilise rings array so ActivityRings (memo'd) doesn't re-render on parent re-renders.
  const heroRings = useMemo(
    () => [
      {
        value: weekData.workoutsThisWeek,
        max: ringGoals.workouts,
        label: 'אימונים',
        variant: 'accent' as const,
      },
      {
        value: weekData.volume,
        // Cap at the personal goal but never below the actual week (a record week
        // still fills the ring instead of overflowing it).
        max: Math.max(weekData.volume, ringGoals.volume),
        label: 'נפח',
        variant: 'signal' as const,
      },
      {
        value: weekData.totalMinutes,
        max: Math.max(weekData.totalMinutes, ringGoals.minutes),
        label: 'דקות',
        variant: 'warn' as const,
      },
    ],
    [
      weekData.workoutsThisWeek,
      weekData.volume,
      weekData.totalMinutes,
      ringGoals.workouts,
      ringGoals.volume,
      ringGoals.minutes,
    ]
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
          // Floats above the sticky header; uses the shared scale (was an
          // off-scale 9999) and stays below modals/toasts.
          zIndex: Z_INDEX.overlay,
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

      <div className="page-shell" style={{ paddingTop: 8 }}>
        <div className="page-stack-loose">
          {/* 1. Primary CTA — opens the start-workout choice sheet. Suppressed on
              first-run (FirstRunHero owns the start action). */}
          {!showFirstRunHero && (
            <button
              type="button"
              onClick={openStartSheet}
              className="home-start-cta focus-ring"
              aria-haspopup="dialog"
              aria-expanded={isStartSheetOpen}
              aria-label={hasSessionToday ? 'אימון נוסף' : 'התחל אימון'}
            >
              <span style={{ display: 'grid', gap: 4, textAlign: 'start', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 20,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  {hasSessionToday ? 'אימון נוסף' : 'התחל אימון'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    opacity: 0.88,
                    lineHeight: 1.3,
                  }}
                >
                  {hasSessionToday
                    ? 'לחצו לבחירת תבנית או אימון ריק'
                    : 'תבנית מוכנה · או אימון ריק'}
                </span>
              </span>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  background: 'var(--fs-primary)',
                  color: 'var(--color-ink-on-dark)',
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </span>
            </button>
          )}

          {hasAnySession && (
            <CoachMark hintKey="hintDashboard" dismissLabel="הבנתי" dismissAriaLabel="הבנתי, סגירה">
              לחצו על הכפתור למעלה — בחרו תבנית או אימון ריק, והאפליקציה תנחה אתכם בסטים.
            </CoachMark>
          )}

          <TodaysWorkoutCard />

          {showSkeleton ? (
            <DashboardSkeleton />
          ) : insightsError && !hasAnySession ? (
            <InsightErrorChip message={insightsError} onRetry={refreshData} />
          ) : !hasAnySession ? (
            <FirstRunHero onStartTemplate={goToTemplates} onStartEmpty={handleEmptyWorkout} />
          ) : (
            renderPopulatedBody()
          )}
        </div>

        <StartWorkoutSheet
          isOpen={isStartSheetOpen}
          onClose={closeStartSheet}
          lastUsedTemplate={lastUsedTemplate}
          onContinueLast={handleContinueLast}
          onPickTemplate={handlePickTemplate}
          onEmptyWorkout={handleEmptyWorkout}
        />
      </div>
    </div>
  );

  // The full populated body (rings + insight + templates + calendar + history +
  // discovery). Extracted so the zero-session / loading branches above stay
  // readable. Closes over the component's memos/handlers.
  function renderPopulatedBody() {
    return (
      <>
        {/* Order for returning users:
            1) Weekly rings (glance) → 2) readiness/now → 3) program → 4) streak
            → 5) insight → 6) templates → 7) calendar → 8) coach connect */}
        {(weekData.workoutsThisWeek > 0 || weekData.volume > 0) && (
          <section
            className="fs-surface-card-soft fade-rise-in"
            aria-label="סיכום שבועי"
            style={{
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
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-ink)',
                }}
              >
                סיכום שבועי
              </span>
              <Stagger stagger={RING_STAGGER} style={{ display: 'grid', gap: 8 }}>
                <StaggerItem key={`accent-${refreshTick}`}>
                  <BentoRow
                    dot="accent"
                    label="אימונים"
                    value={weekData.workoutsThisWeek}
                    suffix={` / ${ringGoals.workouts}`}
                    ltr
                    delay={ringDelay(0)}
                  />
                </StaggerItem>
                <StaggerItem key={`signal-${refreshTick}`}>
                  <BentoRow
                    dot="signal"
                    label="נפח"
                    value={weekData.volume}
                    format={formatThousands}
                    ltr
                    suffix={' ק״ג'}
                    delay={ringDelay(1)}
                    sub={volDeltaChip.text}
                    subColor={zoneColor(volDeltaChip.zone)}
                  />
                </StaggerItem>
                <StaggerItem key={`warn-${refreshTick}`}>
                  <BentoRow
                    dot="warn"
                    label="זמן"
                    value={weekData.totalMinutes}
                    suffix={`′ / ${ringGoals.minutes}′`}
                    ltr
                    delay={ringDelay(2)}
                  />
                </StaggerItem>
              </Stagger>
              <CoachBriefCard sessions={workoutSessions} kind="weekly-review" compact />
            </div>
          </section>
        )}

        {insightsError && <InsightErrorChip message={insightsError} onRetry={refreshData} />}

        <CoachBriefCard sessions={workoutSessions} kind="daily-readiness" />

        <ProgramCard />

        <WorkoutStreak sessions={workoutSessions} />

        <StreakMilestone sessions={workoutSessions} />

        <InsightCard insight={dashboardInsight} />

        {templatesError ? (
          <section className="section-block">
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <InsightErrorChip message="לא הצלחנו לטעון את התבניות" onRetry={loadTemplates} />
          </section>
        ) : sortedTemplates.length > 0 ? (
          <section className="section-block">
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
          </section>
        ) : null}

        <section className="section-block">
          <SectionTitle text="יומן אימונים" />
          <div className="fs-surface-card" style={{ padding: 16 }}>
            <WeeklyGrid
              sessions={workoutSessions}
              weekOffset={selectedWeekOffset}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </div>
        </section>

        <FindCoachCard />
      </>
    );
  }
}

// ── InsightErrorChip — compact inline error for the insight/rings cluster ─────
// Surfaces useFitnessInsights.error (previously never read) with a retry that
// re-runs refreshData() instead of silently rendering nothing.
const InsightErrorChip = memo(function InsightErrorChip({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <AlertTriangle
        size={18}
        aria-hidden="true"
        style={{ color: 'var(--fs-warn)', flexShrink: 0 }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--fs-ink)',
          lineHeight: 1.3,
        }}
      >
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="focus-ring active:scale-[0.98]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          minHeight: 44,
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
          color: 'var(--fs-accent-2)',
        }}
      >
        <RefreshCw size={14} aria-hidden="true" />
        נסו שוב
      </button>
    </div>
  );
});

// ── FirstRunHero — composed zero-session guidance (replaces the self-hidden
// card stack for brand-new users). Answers "what do I do now?" with numbered
// steps + a recommended primary path (template library) and a secondary empty
// start. ────────────────────────────────────────────────────────────────────
const FIRST_RUN_STEPS = [
  { n: '1', label: 'בחרו תבנית מוכנה (מומלץ)' },
  { n: '2', label: 'הזינו משקל וחזרות בכל סט' },
  { n: '3', label: 'סיימו — ותראו התקדמות כאן' },
] as const;

const FirstRunHero = memo(function FirstRunHero({
  onStartTemplate,
  onStartEmpty,
}: {
  /** Recommended path: open template library with ready exercises. */
  onStartTemplate: () => void;
  /** Secondary path: blank workout (add exercises as you go). */
  onStartEmpty: () => void;
}) {
  return (
    <FadeIn>
      <section
        aria-label="התחלה מהירה — האימון הראשון"
        className="fs-surface-card-soft"
        style={{
          padding: '28px 22px',
          display: 'grid',
          gap: 20,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: 9999,
            background: 'color-mix(in srgb, var(--fs-accent) 16%, transparent)',
            color: 'var(--fs-accent)',
          }}
        >
          <Sparkles size={24} strokeWidth={1.75} />
        </span>
        <div style={{ display: 'grid', gap: 8 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.12,
              letterSpacing: '-0.022em',
              color: 'var(--fs-ink)',
              margin: 0,
            }}
          >
            מה עושים עכשיו?
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              lineHeight: 1.47,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
              margin: 0,
            }}
          >
            התחילו באימון ראשון — מומלץ תבנית מוכנה עם תרגילים. אחרי שתסיימו יופיעו כאן הטבעות, הרצף
            והתובנות.
          </p>
        </div>

        {/* Numbered steps — explicit mental model before any tap */}
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 12,
          }}
        >
          {FIRST_RUN_STEPS.map((step) => (
            <li
              key={step.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 999,
                  /* Accent-tinted ring instead of a flat surface fill — the
                     circle reads on BOTH themes without glare in dark. */
                  background: 'color-mix(in srgb, var(--fs-accent) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--fs-accent) 45%, transparent)',
                  color: 'var(--fs-accent-2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {step.n}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--fs-ink)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        {/* Primary: recommended template path */}
        <button
          type="button"
          onClick={onStartTemplate}
          className="start-workout-btn active:scale-[0.98] focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            minHeight: 56,
            padding: '14px 22px',
            marginTop: 0,
          }}
        >
          <Dumbbell size={18} aria-hidden="true" strokeWidth={2} />
          בחרו תבנית מוכנה
        </button>

        {/* Secondary: empty workout */}
        <button type="button" onClick={onStartEmpty} className="cta-secondary focus-ring">
          התחילו בלי תבנית
        </button>

        <Link
          to="/my-coach"
          className="cta-ghost focus-ring"
          style={{ width: '100%', textDecoration: 'none' }}
        >
          יש לכם קוד מאמן?
          <ChevronLeft size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
        </Link>
      </section>
    </FadeIn>
  );
});

// ── DashboardSkeleton — first-load placeholder matching the page shape ────────
// Compact rings-shaped block + streak bar + history rows so the first paint
// doesn't flash empty then pop. Header + CTA stay visible above this. Built only
// from SkeletonBox (premium-shimmer); reduced-motion is handled by the shimmer.
const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="טוען את מסך הבית"
      style={{ margin: 0, display: 'grid', gap: 16 }}
    >
      {/* Rings-shaped block: ~156px circle + 3 legend bars */}
      <div
        className="fs-surface-card-soft"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 18,
          alignItems: 'center',
        }}
      >
        <SkeletonBox width={156} height={156} borderRadius="full" />
        <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
          <SkeletonBox height={14} width="50%" />
          <SkeletonBox height={12} width="100%" />
          <SkeletonBox height={12} width="100%" />
          <SkeletonBox height={12} width="80%" />
        </div>
      </div>

      {/* Streak bar */}
      <SkeletonBox height={64} borderRadius="var(--radius-2xl)" />

      {/* 2-3 history rows */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonBox
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count skeleton placeholders, never reordered
          key={i}
          height={82}
          borderRadius="var(--radius-2xl)"
        />
      ))}
    </div>
  );
});

// ── FindCoachCard — discovery affordance for signed-in trainees with no coach ─
// Joining is invite-code only (no coach search), so the copy points at the code
// entry on /my-coach rather than promising a directory. Shown only when we can
// CONFIRM the viewer is a signed-in trainee with zero active coaches; any
// uncertainty (coach, guest, offline, lookup error) hides the card so it never
// prompts someone who can't act on it.
const FindCoachCard = memo(function FindCoachCard() {
  const { isCoach, loading: roleLoading } = useCoach();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isCoach || roleLoading) {
      setShow(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return; // guests can't accept an invite — don't prompt
        const coaches = await listMyCoaches('active');
        if (!cancelled) setShow(coaches.length === 0);
      } catch {
        // Offline / unconfigured / lookup error — stay hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoach, roleLoading]);

  if (!show) return null;

  return (
    <section>
      <Link
        to="/my-coach"
        aria-label="התחברות למאמן"
        className="fs-surface-card focus-ring active:scale-[0.99]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 20px',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 9999,
            background: 'color-mix(in srgb, var(--fs-accent) 16%, transparent)',
            color: 'var(--fs-accent)',
            flexShrink: 0,
          }}
        >
          <UserPlus size={22} strokeWidth={1.75} />
        </span>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 17,
              letterSpacing: '-0.015em',
              color: 'var(--fs-ink)',
              lineHeight: 1.2,
            }}
          >
            התחברות למאמן
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-muted)',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
            }}
          >
            יש לכם קוד הזמנה ממאמן? התחברו כדי לקבל תוכניות ומעקב.
          </span>
        </span>
        <ArrowLeft
          size={20}
          aria-hidden="true"
          style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
        />
      </Link>
    </section>
  );
});

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
    <div className="section-heading">
      <h2 className="section-heading-title">{text}</h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="section-heading-action focus-ring"
        >
          {action.label}
          <ChevronLeft size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
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
  subColor,
  delay,
  format,
  ltr,
}: {
  dot: 'accent' | 'signal' | 'warn';
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  /** Zone color for the sub chip (defaults to accent for positive trends). */
  subColor?: string;
  delay: number;
  format?: (value: number) => string;
  ltr?: boolean;
}) {
  const dotColor =
    dot === 'signal' ? 'var(--fs-signal)' : dot === 'warn' ? 'var(--fs-warn)' : 'var(--fs-accent)';

  const numberRef = useRef<HTMLSpanElement>(null);
  // pop: a back.out scale settle the instant the count finishes — lands together
  // with the matching ring's goal-met pulse. useCountUp guards reduced-motion.
  useCountUp(numberRef, value, { delay, duration: RING_DRAW_DURATION, format, pop: true });

  const fallback = format ? format(value) : String(Math.round(value));
  const numberSpan = (
    <span ref={numberRef} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {fallback}
    </span>
  );

  // In LTR mode wrap the number AND its suffix together so fraction-style
  // suffixes ("1 / 4", "12′ / 240′") don't bidi-reorder into "4 /1" inside the
  // RTL card. Otherwise only the number was isolated and the suffix reordered.
  const valueGroup = ltr ? (
    <span className="kinetic-number" dir="ltr">
      {numberSpan}
      {suffix}
    </span>
  ) : (
    <span className="kinetic-number">
      {numberSpan}
      {suffix}
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
          fontWeight: 600,
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
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '3ch',
          textAlign: 'end',
        }}
      >
        {valueGroup}
        {sub && <span style={{ color: subColor ?? 'var(--fs-accent)', fontSize: 10 }}>{sub}</span>}
      </span>
    </div>
  );
});
