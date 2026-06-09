// WorkoutSummary - Fresh Steel / Obsidian design language
// Primary masthead · surface body · Bricolage Grotesque typography · Sharp corners

import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, gsap, useGSAP } from '@/lib/gsap';
import { fireSparks } from '@/lib/gsapSparks';
import { AnimatePresence, m } from 'framer-motion';
import { CheckCircle as CheckCircleIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { HABIT_HAPTIC_PATTERNS } from '../../hooks/useHaptics';
import { calculateStreak } from '../../services/achievementService';
import {
  getAllWorkoutSessions,
  getWorkoutSessions,
  saveWorkoutSession,
} from '../../services/dataService';
import { exportWorkoutHistoryCSV } from '../../services/exportService';
import { calculatePRsFromHistory, isNewPR } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { triggerHapticEffect, vibratePattern } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { HE_NOUNS, pluralizeHe } from '../../utils/pluralizeHe';
import { formatDuration } from '../../utils/workoutFormatters';
import { computeSessionStats, setVolume } from '../../utils/workoutMath';
import { ModalOverlay } from '../ui/ModalOverlay';
import { type ComparisonData, StatsGrid } from './components/StatsGrid';
import { SummaryExerciseList } from './components/SummaryExerciseList';

interface WorkoutSummaryProps {
  isOpen: boolean;
  session: Partial<WorkoutSession>;
  onClose: () => void;
  onSaveAsTemplate?: () => void;
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

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
  isOpen,
  session,
  onClose,
  onSaveAsTemplate,
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
        let count = 0;
        const prNames = new Set<string>();

        session.exercises?.forEach((ex) => {
          const hasNewPr = ex.sets?.some(
            (set) => isNewPR(ex.exerciseId || ex.id, set.weight, set.reps, basePrMap).isWeightPR
          );
          if (hasNewPr) {
            count += 1;
            prNames.add(ex.name ?? '');
          }
        });

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
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'סיכום אימון',
          text: `אימון · ${formatDuration(stats.durationSec)} · ${stats.totalVolume.toLocaleString()} ק"ג · ${pluralizeHe(stats.totalSets, HE_NOUNS.set)}`,
        });
      } catch (err) {
        logger.workout.warn('Failed to send workout completion notification', err);
      }
    }
  }, [stats]);

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
  const hasCelebration = prsCount > 0 || isFirstSession || streakMilestone !== null;
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
      gsap.delayedCall(SPARKS_DELAY, () => {
        fireSparks(cont, {
          count: 18,
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
    { scope: rootRef, dependencies: [isOpen, hasCelebration, reduced] }
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
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 48,
                color: 'var(--color-ink-on-dark)',
                lineHeight: 0.88,
                letterSpacing: '-0.02em',
                direction: 'ltr',
                textAlign: 'left',
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
                      fontWeight: 900,
                      display: 'inline-block',
                    }}
                  >
                    {prsCount}
                  </span>
                  <br />
                  <span style={{ fontSize: 24, color: 'rgba(var(--text-on-navy-rgb), 0.7)' }}>
                    שיאים חדשים
                  </span>
                </>
              ) : (
                'אימון הושלם'
              )}
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
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
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
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
                  comparison={comparison}
                  startDelay={STATS_START}
                />

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
                    borderRadius: '18px 12px 18px 12px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      color: 'var(--fs-muted)',
                      textTransform: 'uppercase',
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
                          transition: 'all 150ms ease',
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
                        letterSpacing: '0.06em',
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
                          fontWeight: 800,
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
                          letterSpacing: '0.1em',
                          color: prExercises.has(ex.name ?? '')
                            ? 'var(--fs-primary)'
                            : 'var(--fs-muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {pluralizeHe(ex.setsCompleted, HE_NOUNS.set)}
                      </span>
                      {ex.bestSet && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            letterSpacing: '0.05em',
                            color: prExercises.has(ex.name ?? '')
                              ? 'var(--fs-primary)'
                              : 'var(--fs-ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {ex.bestSet.weight}kg × {ex.bestSet.reps}
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
            background: 'var(--fs-bg)',
            borderTop: '2px solid var(--fs-surface-2)',
            flexShrink: 0,
          }}
        >
          {/* Main action */}
          <button
            type="button"
            onClick={onClose}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-accent)]"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.style.background = 'var(--color-primary-hover)';
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              background: 'var(--fs-accent)',
              // ink-on-accent: --fs-heading resolves near-white in dark and
              // fails AA on the mint fill.
              color: 'var(--color-ink-on-accent)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'background 150ms',
              minHeight: 52,
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.background = 'var(--fs-accent)';
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.background = 'var(--fs-accent)';
            }}
          >
            סיום
          </button>

          {/* Secondary actions */}
          <div className="flex gap-2">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleShare}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fs-accent)]"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px 16px',
                  background: 'var(--fs-surface-2)',
                  color: 'var(--fs-heading)',
                  border: '2px solid var(--fs-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  transition: 'all 150ms',
                  minHeight: 44,
                }}
              >
                שתף
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 16px',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-heading)',
                border: '2px solid var(--fs-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transition: 'all 150ms',
                minHeight: 44,
              }}
            >
              ייצוא CSV
            </button>
            {onSaveAsTemplate && (
              <button
                type="button"
                onClick={onSaveAsTemplate}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px 16px',
                  background: 'var(--fs-surface-2)',
                  color: 'var(--fs-heading)',
                  border: '2px solid var(--fs-primary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  transition: 'all 150ms',
                  minHeight: 44,
                }}
              >
                שמור תבנית
              </button>
            )}
          </div>
        </div>
      </m.div>
    </ModalOverlay>
  );
};

export default React.memo(WorkoutSummary);
