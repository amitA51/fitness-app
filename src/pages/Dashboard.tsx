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
  Play,
  RefreshCw,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { InsightCard } from '../components/dashboard/InsightCard';
import { ProgramCard } from '../components/dashboard/ProgramCard';
import { StartWorkoutSheet } from '../components/dashboard/StartWorkoutSheet';
import { TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { TodaysWorkoutCard } from '../components/dashboard/TodaysWorkoutCard';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WorkoutStreak } from '../components/dashboard/WorkoutStreak';
import { pickDashboardInsight } from '../components/dashboard/insightPicker';
import { CoachMark } from '../components/guidance/CoachMark';
import { FadeIn } from '../components/motion/FadeIn';
import { SkeletonBox } from '../components/ui/SkeletonLoader';
import { Z_INDEX } from '../constants/zIndex';
import { useCoach } from '../contexts/CoachContext';
import { useData } from '../contexts/DataContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { listMyCoaches } from '../services/coach/relationshipService';
import { onWorkoutSaved } from '../services/dataEvents';
import { getCurrentUser } from '../services/supabaseAuth';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';
import { logger } from '../utils/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [isStartSheetOpen, setIsStartSheetOpen] = useState(false);
  // First-load skeleton gate: only show the page skeleton on the very first
  // mount-load, never on pull-to-refresh (which keeps the populated page).
  const hasLoadedOnce = useRef(false);

  const { sessions: dataContextSessions, refreshData, loading: dataLoading } = useData();
  const {
    workoutSessions,
    weekOverWeekDeltas,
    muscleGroups,
    error: insightsError,
  } = useFitnessInsights(dataContextSessions);

  // One locally-computed insight (progression → neglected muscle). Pure math
  // over the already-aggregated insights — no AI calls here. Returns null when
  // nothing real qualifies, and InsightCard then renders nothing.
  const dashboardInsight = useMemo(
    () => pickDashboardInsight({ weekOverWeekDeltas, muscleGroups }),
    [weekOverWeekDeltas, muscleGroups]
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

  // Completed only: an abandoned/in-progress session started today must not
  // light up the "פעיל היום" chip or relabel the CTA to "אימון נוסף".
  const hasSessionToday = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return completedSessions.some((s) => {
      const sd = new Date(s.startTime);
      return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
    });
  }, [completedSessions]);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);
  const goToTemplates = useCallback(() => navigate('/templates'), [navigate]);

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
                {/* Play/forward glyph — this opens the workout runner, it is NOT
                    a back affordance (vision QA flagged the arrow as confusing
                    on a home screen). RTL: forward = left. */}
                <Play size={20} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
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
            <DashboardSkeleton hasTemplatesSection={templatesError || sortedTemplates.length > 0} />
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

  // The full populated body (program + streak + templates + calendar + insight
  // + discovery). Extracted so the zero-session / loading branches above stay
  // readable. Closes over the component's memos/handlers.
  function renderPopulatedBody() {
    return (
      <>
        {insightsError && <InsightErrorChip message={insightsError} onRetry={refreshData} />}

        <ProgramCard />

        <WorkoutStreak sessions={workoutSessions} />

        {templatesError ? (
          <section className="section-block">
            <SectionTitle text="תבניות" action={{ label: 'כל התבניות', onClick: goToTemplates }} />
            <InsightErrorChip message="לא הצלחנו לטעון את התבניות" onRetry={loadTemplates} />
          </section>
        ) : sortedTemplates.length > 0 ? (
          <section className="section-block">
            <SectionTitle text="תבניות" />
            <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />
          </section>
        ) : null}

        <section className="section-block">
          {/* Full history is 3 levels deep (Progress → אימונים → היסטוריה) — the
              Strava "You tab" lesson: everything of MINE gets a short path.
              The calendar header links straight there. */}
          <SectionTitle
            text="יומן אימונים"
            action={{
              label: 'כל ההיסטוריה',
              onClick: () =>
                navigate('/progress', { state: { tab: 'workouts', subTab: 'history' } }),
            }}
          />
          <div className="fs-surface-card" style={{ padding: 16 }}>
            <WeeklyGrid
              sessions={workoutSessions}
              weekOffset={selectedWeekOffset}
              onPrevWeek={goToPrevWeek}
              onNextWeek={goToNextWeek}
            />
          </div>
        </section>

        {/* Insight last: analytics inform, they don't gate the path to action
            (Strong/Hevy order — actions before insights). */}
        <InsightCard insight={dashboardInsight} />

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
// Mirrors renderPopulatedBody() block-for-block: program card → streak card →
// templates (heading + strip, only when a templates section will actually
// render) → workout calendar (heading + action, week card). Heights are the
// measured heights of the real blocks so the page doesn't jump on hand-off.
// The old rings circle is gone because the weekly-rings card it stood in for was
// deleted from this screen. Header + CTA + TodaysWorkoutCard stay visible above
// this. Built only from SkeletonBox (premium-shimmer); reduced-motion is handled
// by the shimmer. Outer gap matches .page-stack-loose, inner gap .section-block.
const DashboardSkeleton = memo(function DashboardSkeleton({
  hasTemplatesSection,
}: {
  /** Mirrors the populated body's own gate — a skeleton strip for a section that
      will not render collapses ~100px of layout at hand-off. */
  hasTemplatesSection: boolean;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="טוען את מסך הבית"
      style={{ margin: 0, display: 'grid', gap: 28 }}
    >
      {/* ProgramCard */}
      <SkeletonBox height={117} borderRadius="var(--radius-2xl)" />

      {/* WorkoutStreak */}
      <SkeletonBox height={54} borderRadius="var(--radius-2xl)" />

      {/* Templates: section heading (no action) + horizontal template strip */}
      {hasTemplatesSection && (
        <div style={{ display: 'grid', gap: 12 }}>
          <SkeletonBox height={22} width="28%" />
          <SkeletonBox height={64} borderRadius="var(--radius-2xl)" />
        </div>
      )}

      {/* Workout calendar: section heading + "כל ההיסטוריה" action, then the
          week card (nav row + 7 day cells + rest-day hint). */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonBox height={22} width="34%" />
          <SkeletonBox height={22} width="26%" />
        </div>
        <SkeletonBox height={242} borderRadius="var(--radius-2xl)" />
      </div>
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
