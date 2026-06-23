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
import { ActivityRings } from '../components/charts';
import { RING_DRAW_DURATION, RING_STAGGER, ringDelay } from '../components/charts/ActivityRings';
import { CoachBriefCard } from '../components/dashboard/CoachBriefCard';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { InsightCard } from '../components/dashboard/InsightCard';
import { ProgramCard } from '../components/dashboard/ProgramCard';
import { RecentPRBanner } from '../components/dashboard/RecentPRBanner';
import { StartWorkoutSheet } from '../components/dashboard/StartWorkoutSheet';
import { TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { TodaysWorkoutCard } from '../components/dashboard/TodaysWorkoutCard';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WorkoutStreak } from '../components/dashboard/WorkoutStreak';
import { pickDashboardInsight } from '../components/dashboard/insightPicker';
import { CoachMark } from '../components/guidance/CoachMark';
import { FadeIn } from '../components/motion/FadeIn';
import { Stagger, StaggerItem } from '../components/motion/Stagger';
import { Card } from '../components/ui/Card';
import { SkeletonBox } from '../components/ui/SkeletonLoader';
import { WorkoutHistory } from '../components/workout/history/WorkoutHistory';
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

// ── Ring-goal baselines ──────────────────────────────────────────────────────
// When the user has <2 weeks of history we can't derive a personal baseline, so
// fall back to these sensible defaults (mirror the previous hardcoded maxima).
const DEFAULT_WEEKLY_WORKOUT_GOAL = 4;
const DEFAULT_WEEKLY_VOLUME_GOAL = 8000;
const DEFAULT_WEEKLY_MINUTES_GOAL = 240;
/** Trailing window (weeks) used to derive personal ring goals. */
const BASELINE_WEEKS = 4;
/** Min distinct active weeks before we trust a personal baseline. */
const MIN_BASELINE_WEEKS = 2;
/** Clamp range for the per-user weekly-workout goal. */
const WORKOUT_GOAL_MIN = 3;
const WORKOUT_GOAL_MAX = 6;
/** |WoW volume change| below this (%) reads as flat ("no change"), not a delta. */
const FLAT_DELTA_PCT = 0.5;

interface RingGoals {
  workouts: number;
  volume: number;
  minutes: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
};

/**
 * Derive per-user ring goals from the trailing BASELINE_WEEKS of completed
 * sessions (excluding the current in-progress week). Goals reflect the user's
 * own rhythm: workouts = clamped avg sessions/wk, volume + minutes = trailing
 * weekly medians. Falls back to named defaults when history is too thin.
 */
function deriveRingGoals(
  completed: ReadonlyArray<{ startTime: string; totalVolume?: number; duration?: number }>,
  currentWeekStart: Date
): RingGoals {
  const counts: number[] = [];
  const volumes: number[] = [];
  const minutes: number[] = [];

  for (let i = 1; i <= BASELINE_WEEKS; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSessions = completed.filter((s) => {
      const d = new Date(s.startTime);
      return d >= weekStart && d < weekEnd;
    });
    if (weekSessions.length === 0) continue;

    counts.push(weekSessions.length);
    volumes.push(weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0));
    minutes.push(Math.round(weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60));
  }

  if (counts.length < MIN_BASELINE_WEEKS) {
    return {
      workouts: DEFAULT_WEEKLY_WORKOUT_GOAL,
      volume: DEFAULT_WEEKLY_VOLUME_GOAL,
      minutes: DEFAULT_WEEKLY_MINUTES_GOAL,
    };
  }

  const avgSessions = counts.reduce((a, b) => a + b, 0) / counts.length;
  return {
    workouts: clamp(Math.round(avgSessions), WORKOUT_GOAL_MIN, WORKOUT_GOAL_MAX),
    volume: Math.max(median(volumes), 1),
    minutes: Math.max(median(minutes), 1),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [isStartSheetOpen, setIsStartSheetOpen] = useState(false);
  // Bumped after a pull-to-refresh so the memo'd rings + legend count-ups replay
  // the cascade in lockstep even when the underlying values are unchanged.
  const [refreshTick, setRefreshTick] = useState(0);
  // First-load skeleton gate: only show the page skeleton on the very first
  // mount-load, never on pull-to-refresh (which keeps the populated page).
  const hasLoadedOnce = useRef(false);

  const {
    sessions: dataContextSessions,
    refreshData,
    loading: dataLoading,
    error: dataError,
  } = useData();
  const {
    workoutSessions,
    weekOverWeekDeltas,
    muscleGroups,
    currentStreak,
    workoutsThisMonth,
    totalWorkouts,
    error: insightsError,
  } = useFitnessInsights(dataContextSessions);

  // One locally-computed insight (progression → neglected muscle → streak →
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

      <div style={{ padding: '20px 20px 32px' }}>
        {/* 1. Primary CTA — opens the start-workout choice sheet. Suppressed on
            the zero-session first run, where the FirstRunHero below already
            carries the start action (avoids two stacked identical mint CTAs). */}
        {!showFirstRunHero && (
        <button
          type="button"
          onClick={openStartSheet}
          className="magnetic-card active:scale-[0.98]"
          aria-haspopup="dialog"
          aria-expanded={isStartSheetOpen}
          aria-label="התחל אימון"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '20px 24px',
            // Sharper mint→teal stop: mint holds to 55% then transitions to the
            // accent-2 so the gradient reads as a deliberate two-tone, not a wash.
            background:
              'linear-gradient(135deg, var(--fs-accent) 0%, var(--fs-accent) 42%, var(--fs-accent-2) 100%)',
            border: '2px solid var(--fs-accent)',
            borderRadius: 'var(--radius-asymmetric)',
            cursor: 'pointer',
            // Near-black ink (#071412 in both modes) passes AA on both the mint
            // and the teal end of the gradient.
            color: 'var(--color-ink-on-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 24,
            textAlign: 'right',
            lineHeight: 1,
            letterSpacing: '-0.01em',
            // Lifted depth + a subtle inset top highlight so the surface reads as
            // a raised, tactile slab rather than a flat fill.
            boxShadow:
              '0 12px 24px color-mix(in srgb, var(--fs-accent) 32%, transparent), inset 0 1px 0 color-mix(in srgb, #ffffff 28%, transparent)',
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
              // Primary (navy / near-black) pill on the mint gradient: reads in
              // both modes. The previous accent-on-accent pill vanished in light
              // and put light ink on bright mint in dark (contrast fail).
              background: 'var(--fs-primary)',
              color: 'var(--color-ink-on-dark)',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </span>
          <span>התחל אימון</span>
        </button>
        )}

        {/* First-visit hint under the primary CTA — returning users only. The
            zero-session FirstRunHero below already leads with this same guidance
            ("בחרו תרגילים…"), so showing both stacked the identical instruction
            twice on the literal first-run home. Gate keeps one explainer per state. */}
        {hasAnySession && (
          <div style={{ marginTop: 12 }}>
            <CoachMark hintKey="hintDashboard" dismissLabel="הבנתי" dismissAriaLabel="הבנתי, סגירה">
              מתחילים מכאן — בחרו תרגילים והאפליקציה תנחה אתכם דרך הסטים.
            </CoachMark>
          </div>
        )}

        {/* Coach-scheduled workout for today (invisible for guests / when empty) */}
        <TodaysWorkoutCard />

        {/* First load: dashboard-shaped skeleton so the page doesn't flash empty
            then pop. Header + CTA above stay visible. */}
        {showSkeleton ? (
          <DashboardSkeleton />
        ) : insightsError && !hasAnySession ? (
          /* Load failed and we have nothing to show — surface the error with a
             retry instead of a misleading "no workouts yet" first-run hero. */
          <InsightErrorChip message={insightsError} onRetry={refreshData} />
        ) : !hasAnySession ? (
          /* Zero-session trainees: one composed first-run hero instead of the
             stack of self-hidden cards (WeeklyGrid + empty history hidden). */
          <FirstRunHero onStart={openStartSheet} />
        ) : (
          renderPopulatedBody()
        )}

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
        {/* 1. Hero — weekly activity rings: the single glanceable "this week"
            summary, promoted to the top so the eye lands on it first. */}
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
              <Stagger stagger={RING_STAGGER} style={{ display: 'grid', gap: 6 }}>
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
                    // Zone-color the WoW delta: a drop is not a win — demote it to
                    // neutral/muted instead of celebrating it in accent.
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
              {/* Weekly review merged in as the rings' verdict/caption line
                  instead of a second standalone twin card (compact mode). */}
              <CoachBriefCard sessions={workoutSessions} kind="weekly-review" compact />
            </div>
          </section>
        )}

        {/* useFitnessInsights error (data still present) — surface it with a
            retry instead of rendering nothing. */}
        {insightsError && <InsightErrorChip message={insightsError} onRetry={refreshData} />}

        {/* 2. Today's readiness — the "now" protagonist. */}
        <CoachBriefCard sessions={workoutSessions} kind="daily-readiness" />

        {/* 2b. Built-in 12-week program — surfaces the self-guided plan on home
            (active/continue, not-started invite, or completed). Self-managed
            states; reads progress without enrolling. */}
        <ProgramCard />

        {/* 3. Streak — quiet supporting status, demoted below the hero. */}
        <div style={{ marginTop: 16 }}>
          <WorkoutStreak sessions={workoutSessions} />
        </div>

        {/* 4. One smart insight — the single trend line. */}
        <InsightCard insight={dashboardInsight} />

        {/* 4. Templates — quick strip + library affordance. On a load failure,
            surface the error + retry instead of silently vanishing into the
            "no templates" empty (mirrors the recent-workouts pattern below). */}
        {templatesError ? (
          <section style={{ marginTop: 24 }}>
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <InsightErrorChip message="לא הצלחנו לטעון את התבניות" onRetry={loadTemplates} />
          </section>
        ) : sortedTemplates.length > 0 ? (
          <section style={{ marginTop: 24 }}>
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
          </section>
        ) : null}

        {/* 5. Weekly calendar */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="יומן אימונים" />
          <Card asymmetric style={{ padding: 20 }}>
            <WeeklyGrid
              sessions={workoutSessions}
              weekOffset={selectedWeekOffset}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </Card>
        </section>

        {/* 6. Recent workouts — unified compact history. On a sessions-load
            failure, surface the error + retry instead of a silent "אין אימונים"
            (mirrors how Progress.tsx handles its load error). */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle text="אימונים אחרונים" />
          {dataError ? (
            <InsightErrorChip
              message="לא הצלחנו לטעון את האימונים האחרונים"
              onRetry={refreshData}
            />
          ) : (
            <WorkoutHistory sessions={workoutSessions} mode="compact" isLoading={dataLoading} />
          )}
        </section>

        {/* 7. PR highlights (compact) */}
        <RecentPRBanner />

        {/* Connect-a-coach prompt — self-hides once the trainee has a coach. */}
        <FindCoachCard />

        <div style={{ height: 24 }} />
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
        borderRadius: '22px 16px 22px 16px',
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
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
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
// card stack for brand-new users) ────────────────────────────────────────────
const FirstRunHero = memo(function FirstRunHero({ onStart }: { onStart: () => void }) {
  return (
    <FadeIn style={{ marginTop: 16 }}>
      <section
        aria-label="התחלה מהירה"
        className="magnetic-card glass-surface scrim-noise"
        style={{
          padding: '24px 20px',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '24px 16px 24px 16px',
          display: 'grid',
          gap: 14,
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
            borderRadius: 14,
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
          }}
        >
          <Sparkles size={24} />
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 22,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
            margin: 0,
          }}
        >
          האימון הראשון שלכם מתחיל כאן
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--fs-muted)',
            margin: 0,
          }}
        >
          בחרו תרגילים, והאפליקציה תנחה אתכם דרך הסטים. אחרי האימון הראשון יופיעו כאן הטבעות,
          התובנות והרצף שלכם.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="active:scale-[0.98] focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            minHeight: 52,
            padding: '14px 20px',
            background: 'var(--fs-accent)',
            border: '2px solid var(--fs-accent)',
            borderRadius: 'var(--radius-asymmetric)',
            cursor: 'pointer',
            color: 'var(--color-ink-on-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 17,
          }}
        >
          <Dumbbell size={18} aria-hidden="true" />
          התחילו אימון
        </button>
        <Link
          to="/my-coach"
          className="focus-ring"
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fs-accent-2)',
            textDecoration: 'none',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
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
      aria-label="טוען את לוח הבית"
      style={{ marginTop: 20, display: 'grid', gap: 16 }}
    >
      {/* Rings-shaped block: ~156px circle + 3 legend bars */}
      <div
        className="glass-surface"
        style={{
          padding: '20px 20px 24px',
          borderRadius: '24px 16px 24px 16px',
          border: '1px solid var(--fs-surface-2)',
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
      <SkeletonBox height={64} borderRadius="var(--radius-asymmetric)" />

      {/* 2-3 history rows */}
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonBox
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count skeleton placeholders, never reordered
          key={i}
          height={82}
          borderRadius="var(--radius-asymmetric)"
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
    <section style={{ marginTop: 24 }}>
      <Link
        to="/my-coach"
        aria-label="התחברות למאמן"
        className="magnetic-card focus-ring active:scale-[0.99]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '18px 20px',
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          boxShadow: 'var(--shadow-card)',
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
            borderRadius: 14,
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
            flexShrink: 0,
          }}
        >
          <UserPlus size={24} />
        </span>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 17,
              color: 'var(--fs-ink)',
              lineHeight: 1.2,
            }}
          >
            התחברות למאמן
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              lineHeight: 1.4,
            }}
          >
            יש לך קוד הזמנה ממאמן? התחבר כדי לקבל תוכניות ומעקב.
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
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--fs-accent-2)',
          }}
        >
          {action.label}
          <ChevronLeft size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
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
        {valueGroup}
        {sub && <span style={{ color: subColor ?? 'var(--fs-accent)', fontSize: 10 }}>{sub}</span>}
      </span>
    </div>
  );
});
