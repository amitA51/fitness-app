// WorkoutSummary - Fresh Steel / Obsidian design language
// Primary masthead · surface body · Bricolage Grotesque typography · Sharp corners

import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { gsap, useGSAP } from '@/lib/gsap';
import { fireSparks } from '@/lib/gsapSparks';
import { DUR } from '@/lib/motionTokens';
import { levelFromXp } from '@/utils/workoutLevels';
import { computeWorkoutXp } from '@/utils/workoutXp';
import { awardSessionXp, getTotalXp } from '@/utils/xpStore';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle as CheckCircleIcon, RotateCcw, Trophy, Zap } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { HABIT_HAPTIC_PATTERNS } from '../../hooks/useHaptics';
import { calculateStreak } from '../../services/achievementService';
import {
  getAllWorkoutSessions,
  getWorkoutSessions,
  saveWorkoutSession,
} from '../../services/dataService';
import { exportWorkoutHistoryCSV } from '../../services/exportService';
import { calculatePRsFromHistory, countSessionPRs } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { triggerHapticEffect, vibratePattern } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { HE_NOUNS, pluralizeHe } from '../../utils/pluralizeHe';
import { formatDuration } from '../../utils/workoutFormatters';
import { computeSessionStats, setVolume } from '../../utils/workoutMath';
import { shareWorkoutCard } from '../../utils/workoutShareCard';
import { MuscleMap } from '../fitness/MuscleMap';
import { showToast } from '../ui/GlobalToast';
import { ModalOverlay } from '../ui/ModalOverlay';
import { type ComparisonData, StatsGrid } from './components/StatsGrid';
import { SummaryExerciseList } from './components/SummaryExerciseList';

interface WorkoutSummaryProps {
  isOpen: boolean;
  session: Partial<WorkoutSession>;
  onClose: () => void;
  onSaveAsTemplate?: () => void;
  /**
   * "חזרו על האימון" — repeat this session as a starting template, closing the
   * retention loop. When provided, a secondary footer action invokes it and
   * then closes the summary. Omitted ⇒ the action isn't rendered.
   */
  onRepeatWorkout?: () => void;
  /**
   * Forward loop-closer — "צפו בהתקדמות" → Progress (Workouts tab). Rendered as
   * the SECOND-tier footer action directly under the primary "סיום": at the end
   * of a workout the default intent is "I'm done", not "browse my progress", so
   * "סיום" owns the mint fill in BOTH branches and this stays the opt-in detour
   * onto the trend the session just moved. Omitted ⇒ the action isn't rendered
   * and the footer simply loses its second tier.
   */
  onViewProgress?: () => void;
}

// ============================================================
// STATS CALCULATION
// ============================================================

interface ComputedStats {
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  /** Duration in MINUTES (for the StatsGrid count-up number). */
  duration: number;
  /** Canonical duration in SECONDS (for the human formatDuration label). */
  durationSec: number;
  exerciseCount: number;
  exerciseStats: {
    name: string | undefined;
    setsCompleted: number;
    totalVolume: number;
    bestSet?: { weight: number; reps: number };
  }[];
}

const computeStats = (session: Partial<WorkoutSession>): ComputedStats => {
  // Warmup sets are excluded and volume/reps require completed sets — see
  // computeSessionStats options for the exact rules.
  const { totalVolume, totalSets, totalReps, exerciseCount, exerciseStats } = computeSessionStats(
    session,
    { excludeWarmup: true }
  );

  // Duration is read from the canonical `session.duration` (SECONDS) — NOT
  // recomputed from start/end, which produced absurd values when a stale
  // persisted startTime leaked in. `durationMin` feeds the StatsGrid number;
  // the subtitle/share text use formatDuration for the human label.
  const durationSec = session.duration && session.duration > 0 ? session.duration : 0;
  const duration = Math.round(durationSec / 60);

  return { totalVolume, totalSets, totalReps, duration, durationSec, exerciseCount, exerciseStats };
};

// ============================================================
// MAIN COMPONENT
// ============================================================

// ============================================================
// FINISH-LINE CHOREOGRAPHY TIMINGS (seconds)
// Headline hero count-up lands as the screen settles, then the stat cards
// stagger in (StatsGrid drives its own scoped stagger via startDelay), then a
// restrained spark puff punctuates the landing — only when the session had a PR.
// ============================================================
const HEADLINE_DELAY = 0.15;
const STATS_START = 0.5;
const EXERCISES_START = 0.78;
const SPARKS_DELAY = 1.0;

// Streak thresholds worth celebrating in the summary. Crossing one of these
// (streak grew from below the milestone to at/above it this session) fires the
// milestone strip + sparks + the streakMilestone haptic.
const STREAK_MILESTONES = [7, 21, 30, 66] as const;

// The highest milestone newly crossed when the streak moved from `before` to
// `after` this session. null when no milestone boundary was crossed.
const crossedMilestone = (before: number, after: number): number | null => {
  let crossed: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (before < m && after >= m) crossed = m;
  }
  return crossed;
};

// Primary footer action — the single mint-fill CTA. Always "סיום": finishing is
// the user's default intent at the end of a workout. Kept extracted so the
// summary can re-point which action is primary without duplicating the
// press-feedback styling.
function PrimaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="start-workout-btn focus-ring">
      {label}
    </button>
  );
}

// Third-tier utility action (share / export / save-as-template). Quiet by
// design: no fill, no border — weight alone separates it from the primary CTA
// and the secondary repeat action. minHeight keeps the 44px touch target that
// the borderless look would otherwise lose. Tokens only, so both themes read.
const utilityActionStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '0 8px',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-full)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
  cursor: 'pointer',
};

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
  isOpen,
  session,
  onClose,
  onSaveAsTemplate,
  onRepeatWorkout,
  onViewProgress,
}) => {
  const [view, setView] = useState<'overview' | 'details'>('overview');
  const [prsCount, setPrsCount] = useState<number>(0);
  const [prExercises, setPrExercises] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [workoutRating, setWorkoutRating] = useState<number | null>(null);
  // True when this is the user's first ever completed session — the highest
  // activation moment, which otherwise falls through to the flat headline.
  const [isFirstSession, setIsFirstSession] = useState<boolean>(false);
  // The streak milestone newly crossed by completing this session (7/21/30/66),
  // or null when no boundary was crossed.
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);

  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mastheadRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLSpanElement>(null);

  const stats = useMemo(() => computeStats(session), [session]);

  // Session XP — derived from the same stats the grid shows, so the number on
  // screen always reconciles with what the user can count themselves.
  const xp = useMemo(
    () =>
      computeWorkoutXp({
        totalVolumeKg: stats.totalVolume,
        completedSets: stats.totalSets,
        personalRecords: prsCount,
      }),
    [stats.totalVolume, stats.totalSets, prsCount]
  );

  // Award once per session on mount; derive the resulting level + progress.
  // isSessionCounted inside awardSessionXp guards re-opened summaries.
  const [xpTotal, setXpTotal] = useState<number>(() => getTotalXp());
  useEffect(() => {
    if (xp <= 0) return;
    setXpTotal(awardSessionXp(xp, session.id));
  }, [xp, session.id]);
  const { level, intoLevel, levelSpan } = useMemo(() => levelFromXp(xpTotal), [xpTotal]);

  // Unique primary muscles the session touched — drives the "muscles worked"
  // recap map. WorkoutExercise carries no secondary muscles, so this is the
  // primary set only (matching the workout-detail breakdown). Cardio / untagged
  // sessions yield an empty set and the recap self-hides.
  const workedMuscles = useMemo(
    () =>
      Array.from(
        new Set(
          (session.exercises ?? [])
            .map((ex) => ex.targetMuscle || ex.muscleGroup || '')
            .filter((m) => m.length > 0)
        )
      ),
    [session]
  );

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  // Load comparison data
  useEffect(() => {
    const loadComparison = async () => {
      try {
        const allSessions = await getWorkoutSessions();
        if (allSessions.length < 2) return;

        const currentStartMs = session.startTime ? new Date(session.startTime).getTime() : null;
        const previousSessions = allSessions
          .filter((s) => !currentStartMs || new Date(s.startTime || 0).getTime() < currentStartMs)
          .sort(
            (a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
          );

        if (previousSessions.length === 0) return;
        const prevSession = previousSessions[0];
        if (!prevSession) return;

        const prevEx = prevSession.exercises || [];
        const prevWorkingSets = prevEx.flatMap((ex) => (ex.sets || []).filter((s) => !s.isWarmup));
        const prevVolume = prevWorkingSets.reduce(
          (sum, s) => (s.completedAt ? sum + setVolume(s) : sum),
          0
        );
        // Minutes from the canonical duration (SECONDS), matching computeStats.
        const prevDuration =
          prevSession.duration && prevSession.duration > 0
            ? Math.round(prevSession.duration / 60)
            : 0;
        const prevSets = prevWorkingSets.filter((s) => s.completedAt).length;

        const currentEx = session.exercises || [];
        const currentWorkingSets = currentEx.flatMap((ex) =>
          (ex.sets || []).filter((s) => !s.isWarmup)
        );
        const currentVolume = currentWorkingSets.reduce(
          (sum, s) => (s.completedAt ? sum + setVolume(s) : sum),
          0
        );
        const currentDuration =
          session.duration && session.duration > 0 ? Math.round(session.duration / 60) : 0;
        const currentSets = currentWorkingSets.filter((s) => s.completedAt).length;

        setComparison({
          prevVolume,
          prevDuration,
          prevSets,
          volumeChange: currentVolume - prevVolume,
          durationChange: currentDuration - prevDuration,
          setsChange: currentSets - prevSets,
        });
      } catch (err) {
        logger.workout.warn('Failed to load session comparison', err);
      }
    };

    if (isOpen) loadComparison();
  }, [isOpen, session]);

  // Compute PRs
  useEffect(() => {
    let cancelled = false;
    const computePRs = async () => {
      if (!session.exercises || session.exercises.length === 0) {
        if (!cancelled) {
          setPrsCount(0);
          setPrExercises(new Set());
        }
        return;
      }

      try {
        // PR comparison must consider the user's full history, not just the
        // most recent 20 sessions — otherwise long-standing records get
        // flagged as new PRs again.
        const allSessions = await getAllWorkoutSessions();
        const currentStartMs = session.startTime ? new Date(session.startTime).getTime() : null;
        const historyBefore = currentStartMs
          ? allSessions.filter((s) => {
              if (!s.startTime) return true;
              return new Date(s.startTime).getTime() < currentStartMs;
            })
          : allSessions;

        const basePrMap = calculatePRsFromHistory(historyBefore);
        // Shared counter (prService.countSessionPRs): name-keyed identity,
        // warmup + uncompleted sets excluded, and the SAME weight/volume/reps
        // rules as the live in-workout detector — the headline can no longer
        // shout "N שיאים חדשים" for ordinary sets.
        const { count, prNames } = countSessionPRs(session.exercises ?? [], basePrMap);

        if (!cancelled) {
          setPrsCount(count);
          setPrExercises(prNames);
        }
      } catch (error) {
        logger.workout.error('Failed to compute PR count for summary', error);
        if (!cancelled) {
          setPrsCount(0);
          setPrExercises(new Set());
        }
      }
    };

    // Only compute PRs (which fetches the full workout history) when the
    // summary is actually visible — avoids an expensive full-history scan on
    // every session change while the summary is closed.
    if (isOpen) computePRs();
    return () => {
      cancelled = true;
    };
  }, [isOpen, session]);

  // First-session detection + streak-milestone crossing. Both lean on the full
  // history (tombstones already excluded by getAllWorkoutSessions) and run only
  // while the summary is open so we don't scan history needlessly.
  useEffect(() => {
    let cancelled = false;
    const detectMoments = async () => {
      try {
        const allSessions = await getAllWorkoutSessions();

        // Sessions other than the one being summarized. Dedup by id covers the
        // case where the current session is already persisted; the startTime
        // guard covers the not-yet-saved case.
        const currentStartMs = session.startTime ? new Date(session.startTime).getTime() : null;
        const others = allSessions.filter((s) => {
          if (session.id && s.id === session.id) return false;
          if (currentStartMs && s.startTime) {
            return new Date(s.startTime).getTime() !== currentStartMs;
          }
          return true;
        });

        // First-session: no other completed session exists yet.
        const priorCompleted = others.filter((s) => s.status === 'completed');
        const firstSession = priorCompleted.length === 0;

        // Streak crossing: compare the streak WITHOUT this session against the
        // streak WITH it merged in. A merged completed copy of the current
        // session is used so detection works whether or not it's persisted yet.
        const withCurrent: WorkoutSession[] = [
          ...others,
          { ...(session as WorkoutSession), status: 'completed' },
        ];
        const before = calculateStreak(others).currentStreak;
        const after = calculateStreak(withCurrent).currentStreak;
        const milestone = crossedMilestone(before, after);

        if (!cancelled) {
          setIsFirstSession(firstSession);
          setStreakMilestone(milestone);
        }
      } catch (error) {
        logger.workout.warn('Failed to detect first-session / streak milestone', error);
        if (!cancelled) {
          setIsFirstSession(false);
          setStreakMilestone(null);
        }
      }
    };

    if (isOpen) detectMoments();
    return () => {
      cancelled = true;
    };
  }, [isOpen, session]);

  const handleExportCSV = useCallback(() => {
    exportWorkoutHistoryCSV([session as WorkoutSession]);
  }, [session]);

  // "חזור על האימון" — fire the repeat handler, then close the summary so the
  // user lands back in the start flow with this session pre-seeded.
  const handleRepeat = useCallback(() => {
    triggerHapticEffect('success');
    onRepeatWorkout?.();
    onClose();
  }, [onRepeatWorkout, onClose]);

  // Persist rating when the user selects one. Trigger ONLY on the rating change
  // (read the latest session through a ref) — depending on the whole `session`
  // object re-ran this on every parent re-render, re-saving the session and
  // churning a needless cloud sync each time.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    const current = sessionRef.current;
    if (!workoutRating || !current.id) return;
    const updated = { ...current, rating: workoutRating } as WorkoutSession;
    saveWorkoutSession(updated).catch((err) => {
      logger.workout.warn('Failed to save workout rating', err);
    });
  }, [workoutRating]);

  const handleShare = useCallback(async () => {
    if (!navigator.share) return;
    // Lead with the WIN when there is one — a PR count, a streak milestone, or
    // the session's standout best-set — instead of a bare receipt line. The
    // receipt (duration · volume · sets) always follows so the share still
    // carries the full numbers.
    const receipt = `אימון · ${formatDuration(stats.durationSec)} · ${stats.totalVolume.toLocaleString()} ק"ג · ${pluralizeHe(stats.totalSets, HE_NOUNS.set)}`;

    let headline: string | null = null;
    if (prsCount > 0) {
      headline = `${prsCount} ${prsCount === 1 ? 'שיא חדש' : 'שיאים חדשים'}`;
    } else if (streakMilestone !== null) {
      headline = `${streakMilestone} ימי אימון ברצף`;
    } else {
      // Standout best-set from a PR exercise, else the heaviest best-set logged.
      const top =
        stats.exerciseStats.find((ex) => ex.name && prExercises.has(ex.name) && ex.bestSet) ??
        stats.exerciseStats
          .filter((ex) => ex.bestSet)
          .sort((a, b) => (b.bestSet?.weight ?? 0) - (a.bestSet?.weight ?? 0))[0];
      if (top?.bestSet && top.name) {
        headline = `${top.name} · ${top.bestSet.weight} ק"ג × ${top.bestSet.reps}`;
      }
    }

    const text = headline ? `${headline}\n${receipt}` : receipt;
    try {
      await navigator.share({ title: 'סיכום אימון', text });
    } catch (err) {
      // User-cancelled shares also reject here; log at warn for diagnosability.
      logger.workout.warn('Failed to share workout summary', err);
    }
  }, [stats, prsCount, prExercises, streakMilestone]);

  // Image share (Strava share-card pattern): render the summary as a designed
  // PNG and hand it to the OS share sheet. Falls back to the text share ONLY
  // when the browser can't share files — never after a user cancellation.
  const handleShareCard = useCallback(async () => {
    const result = await shareWorkoutCard({
      totalVolume: stats.totalVolume,
      totalSets: stats.totalSets,
      durationSec: stats.durationSec,
      prsCount,
    });
    if (result === 'unsupported') {
      await handleShare();
      return;
    }
    if (result === 'shared') {
      // Same canonical success effect the save path uses (Quiet-Luxury).
      triggerHapticEffect('success');
    }
  }, [stats, prsCount, handleShare]);

  // Hero count-up: the giant PR number in the masthead rolls up and lands with
  // a settle pop as the screen settles. RAF-driven (no React re-render) and
  // RTL-neutral. useCountUp snaps to the final value under reduced m. Only
  // active when there's a PR to celebrate (otherwise the headline is text).
  // This is the SINGLE place the PR number animates — StatsGrid's PR cell
  // renders it static to avoid double-animating the same number.
  useCountUp(headlineRef, prsCount, {
    delay: HEADLINE_DELAY,
    duration: DUR.slow,
    pop: true,
    enabled: isOpen && prsCount > 0,
  });

  // Celebration haptics — gated through utils/haptics so the Settings toggle
  // owns them. A PR or first-ever session earns a success buzz; crossing a
  // streak milestone gets the dedicated streakMilestone pattern. Fires once per
  // open, only when there's something to celebrate.
  const hapticsFiredRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hapticsFiredRef.current = false;
      return;
    }
    if (hapticsFiredRef.current) return;
    const hasCelebration = prsCount > 0 || isFirstSession || streakMilestone !== null;
    if (!hasCelebration) return;
    hapticsFiredRef.current = true;
    if (streakMilestone !== null) {
      vibratePattern([...HABIT_HAPTIC_PATTERNS.streakMilestone]);
    } else {
      triggerHapticEffect('success', 'medium');
    }
  }, [isOpen, prsCount, isFirstSession, streakMilestone]);

  // Restrained spark puff — fires from the hero number after the stat cards
  // have staggered in, for any celebratory moment (PR, first-ever session, or a
  // streak milestone crossing). Upward fan (240-300°) is vertically symmetric,
  // so RTL-neutral. Reduced motion / nothing to celebrate: skipped.
  //
  // A TRUE PR (prsCount > 0) is the one place lime celebration is earned: the
  // burst recolors to --fs-signal (lime). First-session / streak crossings keep
  // the default mint-family palette — lime stays exclusive to the PR moment.
  const isPrCelebration = prsCount > 0;
  const hasCelebration = isPrCelebration || isFirstSession || streakMilestone !== null;
  useGSAP(
    () => {
      if (reduced || !isOpen || !hasCelebration) return;
      const cont = mastheadRef.current;
      if (!cont) return;
      const head = headlineRef.current;
      let originX = cont.clientWidth / 2;
      let originY = cont.clientHeight / 2;
      if (head) {
        const cr = cont.getBoundingClientRect();
        const hr = head.getBoundingClientRect();
        originX = hr.left - cr.left + hr.width / 2;
        originY = hr.top - cr.top + hr.height / 2;
      }
      // Resolve the lime token at runtime (no hardcoded hex) so the burst stays
      // on-brand in both modes. Only the PR moment gets the lime palette.
      let prColors: string[] | undefined;
      if (isPrCelebration) {
        const signal = getComputedStyle(cont).getPropertyValue('--fs-signal').trim();
        if (signal) prColors = [signal, '#F5F1EB', signal];
      }
      gsap.delayedCall(SPARKS_DELAY, () => {
        fireSparks(cont, {
          count: 18,
          ...(prColors ? { colors: prColors } : {}),
          originX,
          originY,
          angleMin: 240,
          angleMax: 300,
          minVelocity: 220,
          maxVelocity: 420,
          gravity: 700,
          duration: 1.1,
        });
      });
    },
    { scope: rootRef, dependencies: [isOpen, hasCelebration, isPrCelebration, reduced] }
  );

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      zLevel="high"
      backdropOpacity={60}
      blur="md"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="סיכום אימון"
    >
      <m.div
        ref={rootRef}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden flex flex-col scale-pop-in"
        style={{
          background: 'var(--fs-bg)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '24px 18px 24px 18px',
          boxShadow: 'var(--shadow-deep)',
          maxHeight: '90dvh',
        }}
      >
        {/* ── PREMIUM DARK MASTHEAD ── */}
        <div
          ref={mastheadRef}
          className="premium-dark-surface scrim-noise"
          style={{ flexShrink: 0, position: 'relative', overflow: 'visible' }}
        >
          {/* Chapter strip */}
          <div
            className="chapter-break"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="left" style={{ color: 'var(--fs-accent)' }}>
              סיכום
            </span>
            <span className="right">{dateLabel}</span>
          </div>

          {/* Title area */}
          <div className="px-5 pt-6 pb-5">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 48,
                color: 'var(--color-ink-on-dark)',
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                // RTL: the screen title starts at the reading start — the RIGHT
                // edge. This heading used to force `direction: ltr` +
                // `textAlign: left`, which pinned both the Hebrew title and the
                // PR count to the LEFT edge (measured 280px away from the start
                // at 390px wide). The PR number keeps its own dir="ltr" on the
                // inner span, so digits stay LTR without dragging the heading.
                textAlign: 'start',
              }}
            >
              {prsCount > 0 ? (
                <>
                  <span
                    ref={headlineRef}
                    dir="ltr"
                    className="kinetic-number"
                    style={{
                      color: 'var(--fs-accent)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 56,
                      fontWeight: 700,
                      // Display tracking for a display-size number. Without this it
                      // inherited -0.01em from .kinetic-number, a body value; the
                      // graded display scale (-0.022em @48px → -0.028em @88px)
                      // puts 56px at -0.023em.
                      letterSpacing: '-0.023em',
                      display: 'inline-block',
                    }}
                  >
                    {prsCount}
                  </span>
                  <br />
                  <span style={{ fontSize: 24, color: 'rgba(var(--text-on-navy-rgb), 0.7)' }}>
                    {prsCount === 1 ? 'שיא חדש' : 'שיאים חדשים'}
                  </span>
                </>
              ) : (
                'אימון הושלם'
              )}
            </h2>

            {/* Reduced-motion fallback for the earned-PR celebration: the lime
                spark burst is suppressed under prefers-reduced-motion, so a
                static lime (--fs-signal) badge stands in. Lime here is correct —
                this is the PR celebration moment. */}
            {prsCount > 0 && reduced && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 12,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'var(--fs-signal)',
                  color: 'var(--fs-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                <Trophy size={13} strokeWidth={2.5} aria-hidden="true" />
                שיא חדש
              </div>
            )}

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.8)',
                marginTop: 8,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pluralizeHe(stats.exerciseCount, HE_NOUNS.exercise)} ·{' '}
              {pluralizeHe(stats.totalSets, HE_NOUNS.set)} ·{' '}
              {stats.totalVolume > 0 ? (
                <span dir="ltr">{stats.totalVolume.toLocaleString()} ק"ג</span>
              ) : (
                '—'
              )}{' '}
              · {stats.durationSec > 0 ? formatDuration(stats.durationSec) : '—'}
            </p>
          </div>
        </div>

        {/* ── VIEW TABS ── */}
        <div className="tab-row" style={{ margin: '12px 20px 0', flexShrink: 0 }} role="tablist">
          {(['overview', 'details'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              onPointerDown={(e) => {
                e.preventDefault();
                setView(v);
              }}
              className={`tab${view === v ? ' active' : ''}`}
              style={{
                letterSpacing: '-0.01em',
              }}
            >
              {v === 'overview' ? 'סקירה' : 'פרטים'}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-5"
          style={{ background: 'var(--fs-bg)' }}
        >
          <AnimatePresence mode="sync">
            {view === 'overview' ? (
              <m.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-5"
              >
                {/* Stats Grid */}
                <StatsGrid
                  totalVolume={stats.totalVolume}
                  duration={stats.duration}
                  totalSets={stats.totalSets}
                  prsCount={prsCount}
                  caloriesBurned={session.caloriesBurned}
                  comparison={comparison}
                  startDelay={STATS_START}
                />

                {/* Muscles worked — visual recap of the session. Self-hides for
                    cardio / untagged sessions (empty muscle set). */}
                {workedMuscles.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '14px 16px',
                      background: 'var(--fs-surface)',
                      border: '1px solid var(--fs-surface-2)',
                      borderRadius: 'var(--radius-inset)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-muted)',
                        textAlign: 'start',
                      }}
                    >
                      שרירים שעבדת
                    </span>
                    <MuscleMap primary={workedMuscles} />
                  </div>
                )}

                {/* Session XP — the earned number, right under the stats. The
                    formula is legible by design (volume + sets + PRs), so the
                    figure reads as deserved rather than arbitrary. Hidden for
                    empty sessions. */}
                {xp > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '14px 18px',
                      background: 'color-mix(in srgb, var(--fs-accent) 10%, var(--fs-surface))',
                      border: '1px solid color-mix(in srgb, var(--fs-accent) 30%, transparent)',
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{ color: 'var(--fs-accent)', display: 'inline-flex' }}
                        aria-hidden="true"
                      >
                        <Zap size={16} strokeWidth={2.5} />
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 18,
                          color: 'var(--fs-ink)',
                          letterSpacing: '-0.02em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                        dir="ltr"
                      >
                        +{xp}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--fs-muted)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        XP נצברו
                      </span>
                    </div>
                    {/* Level progress — thin accent bar under the XP line.
                        intoLevel/levelSpan come from the ladder; the level chip
                        anchors the inline-start edge. */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--color-ink-on-accent)',
                          background: 'var(--fs-accent)',
                          borderRadius: 999,
                          padding: '1px 9px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        דרגה {level}
                      </span>
                      <div
                        role="progressbar"
                        tabIndex={-1}
                        aria-valuenow={Math.round((intoLevel / levelSpan) * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`התקדמות לדרגה ${level + 1}`}
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 999,
                          background: 'color-mix(in srgb, var(--fs-accent) 18%, transparent)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, (intoLevel / levelSpan) * 100)}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'var(--fs-accent)',
                            transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Workout Rating */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 16px',
                    background: 'var(--fs-surface)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 'var(--radius-inset)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-muted)',
                      // Section label starts at the reading start. alignSelf
                      // overrides the card's `alignItems: center` for this label
                      // only — the 1-5 button row stays centred.
                      alignSelf: 'stretch',
                      textAlign: 'start',
                    }}
                  >
                    איך היה האימון?
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: 'קשה מאוד', value: 1 },
                      { label: 'קשה', value: 2 },
                      { label: 'טוב', value: 3 },
                      { label: 'מעולה', value: 4 },
                      { label: 'אגדי', value: 5 },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setWorkoutRating(r.value)}
                        aria-label={r.label}
                        title={r.label}
                        style={{
                          width: 48,
                          height: 48,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 22,
                          background:
                            workoutRating === r.value ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                          border:
                            workoutRating === r.value
                              ? '2px solid var(--fs-primary)'
                              : '1px solid var(--fs-steel)',
                          borderRadius: 12,
                          cursor: 'pointer',
                          // The selected state only needs color and press-scale feedback.
                          // Border width deliberately snaps so it never drives a layout animation.
                          transition:
                            'background 150ms var(--ease-out), border-color 150ms var(--ease-out), transform 150ms var(--ease-out)',
                          transform: workoutRating === r.value ? 'scale(1.1)' : 'scale(1)',
                        }}
                      >
                        {r.value}
                      </button>
                    ))}
                  </div>
                  {workoutRating && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--fs-accent)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {
                        ['', 'קשה מאוד', 'קשה', 'אימון טוב!', 'אימון מעולה!', 'אימון אגדי!'][
                          workoutRating
                        ]
                      }
                    </span>
                  )}
                </div>

                {/* Exercise list */}
                {stats.exerciseStats.length > 0 && (
                  <SummaryExerciseList
                    exercises={stats.exerciseStats}
                    prExercises={prExercises}
                    maxItems={4}
                    startDelay={EXERCISES_START}
                  />
                )}
              </m.div>
            ) : (
              <m.div
                key="details"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2"
              >
                {stats.exerciseStats.map((ex, i) => (
                  <m.div
                    key={ex.name ?? ''}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: prExercises.has(ex.name ?? '')
                        ? 'var(--fs-accent)'
                        : 'var(--fs-surface-2)',
                      border: '2px solid var(--fs-primary)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {prExercises.has(ex.name ?? '') && (
                        <CheckCircleIcon
                          size={16}
                          strokeWidth={2.5}
                          style={{ color: 'var(--color-ink-on-accent)', flexShrink: 0 }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 14,
                          color: prExercises.has(ex.name ?? '')
                            ? 'var(--fs-primary)'
                            : 'var(--fs-ink)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {ex.name || 'תרגיל ללא שם'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          letterSpacing: '-0.01em',
                          color: prExercises.has(ex.name ?? '')
                            ? 'var(--fs-primary)'
                            : 'var(--fs-muted)',
                        }}
                      >
                        {pluralizeHe(ex.setsCompleted, HE_NOUNS.set)}
                      </span>
                      {ex.bestSet && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            letterSpacing: '-0.01em',
                            color: prExercises.has(ex.name ?? '')
                              ? 'var(--fs-primary)'
                              : 'var(--fs-ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {ex.bestSet.weight} ק״ג × {ex.bestSet.reps}
                        </span>
                      )}
                    </div>
                  </m.div>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div
          className="flex flex-col gap-2 px-5 py-4"
          style={{
            // The summary sheet already establishes the elevation context. A solid
            // footer preserves its action boundary without sampling the backdrop again.
            background: 'var(--fs-bg)',
            borderTop: '0.5px solid var(--color-separator)',
            flexShrink: 0,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Tier 1 — "סיום" owns the mint fill unconditionally. At the end of a
              workout the default intent is "I'm done"; the forward detour to
              Progress is tier 2 below, and self-hides when not wired. */}
          <PrimaryAction label="סיום" onClick={onClose} />

          {onViewProgress && (
            <button type="button" onClick={onViewProgress} className="cta-ghost focus-ring w-full">
              צפו בהתקדמות
            </button>
          )}

          {onRepeatWorkout && (
            <button
              type="button"
              onClick={handleRepeat}
              className="cta-secondary focus-ring w-full"
            >
              <RotateCcw size={15} strokeWidth={2.5} aria-hidden="true" />
              חזרו על האימון
            </button>
          )}

          {/* Utilities — deliberately the quietest tier. These three are
              "maybe later" actions (share / export / keep as a template); the
              user's actual next step is one of the two buttons above. Rendering
              them as filled/outlined `cta-secondary` pills put SIX actions at
              near-equal weight in one footer, which is not a hierarchy. Quiet
              text buttons keep them reachable (44px targets) without competing
              with the primary CTA. */}
          <div className="flex gap-1">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleShareCard}
                className="focus-ring"
                style={utilityActionStyle}
              >
                שתפו כרטיס
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              className="focus-ring"
              style={utilityActionStyle}
            >
              ייצאו CSV
            </button>
            {onSaveAsTemplate && (
              <button
                type="button"
                onClick={() => {
                  // The handler may be async; a rejected promise must not become
                  // an unhandled rejection — surface it as the save-failure toast.
                  const result = onSaveAsTemplate();
                  Promise.resolve(result).catch(() => {
                    showToast('שמירת התבנית נכשלה. בדקו את החיבור ונסו שוב.', { variant: 'error' });
                  });
                }}
                className="focus-ring"
                style={utilityActionStyle}
              >
                שמרו תבנית
              </button>
            )}
          </div>
        </div>
      </m.div>
    </ModalOverlay>
  );
};

export default React.memo(WorkoutSummary);
