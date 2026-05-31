// WorkoutSummary - Sport Annual Editorial Design
// Navy masthead · Bone body · Big Shoulders typography · Sharp corners

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle as CheckCircleIcon } from 'lucide-react';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  getAllWorkoutSessions,
  getWorkoutSessions,
  saveWorkoutSession,
} from '../../services/dataService';
import { exportWorkoutHistoryCSV } from '../../services/exportService';
import { calculatePRsFromHistory, isNewPR } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
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
  duration: number;
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

  const duration =
    session.startTime && session.endTime
      ? Math.round(
          (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000 / 60
        )
      : 0;

  return { totalVolume, totalSets, totalReps, duration, exerciseCount, exerciseStats };
};

// ============================================================
// MAIN COMPONENT
// ============================================================

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
        const prevDuration =
          prevSession.startTime && prevSession.endTime
            ? Math.round(
                (new Date(prevSession.endTime).getTime() -
                  new Date(prevSession.startTime).getTime()) /
                  1000 /
                  60
              )
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
          session.startTime && session.endTime
            ? Math.round(
                (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) /
                  1000 /
                  60
              )
            : 0;
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

  const handleExportCSV = useCallback(() => {
    exportWorkoutHistoryCSV([session as WorkoutSession]);
  }, [session]);

  // Persist rating when user selects one
  useEffect(() => {
    if (!workoutRating || !session.id) return;
    const updated = { ...session, rating: workoutRating } as WorkoutSession;
    saveWorkoutSession(updated).catch((err) => {
      logger.workout.warn('Failed to save workout rating', err);
    });
  }, [workoutRating, session]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'סיכום אימון',
          text: `אימון · ${stats.duration} דקות · ${stats.totalVolume.toLocaleString()} ק"ג · ${stats.totalSets} סטים`,
        });
      } catch (err) {
        logger.workout.warn('Failed to send workout completion notification', err);
      }
    }
  }, [stats]);

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
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
        }
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
        <div className="premium-dark-surface scrim-noise" style={{ flexShrink: 0 }}>
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
                color: '#FFFFFF',
                lineHeight: 0.88,
                letterSpacing: '-0.02em',
                direction: 'ltr',
                textAlign: 'left',
              }}
            >
              {prsCount > 0 ? (
                <>
                  <span
                    className="kinetic-number"
                    style={{
                      color: 'var(--fs-accent)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 56,
                      fontWeight: 900,
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
              {stats.exerciseCount} תרגילים · {stats.totalSets} סטים ·{' '}
              {stats.totalVolume > 0 ? `${stats.totalVolume.toLocaleString()} ק"ג` : '—'} ·{' '}
              {stats.duration > 0 ? `${stats.duration} דקות` : '—'}
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
              <motion.div
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
                    startDelay={0.3}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="details"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2"
              >
                {stats.exerciseStats.map((ex, i) => (
                  <motion.div
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
                          style={{ color: 'var(--fs-heading)', flexShrink: 0 }}
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
                        {ex.setsCompleted} סטים
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
                  </motion.div>
                ))}
              </motion.div>
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
              color: 'var(--fs-heading)',
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
      </motion.div>
    </ModalOverlay>
  );
};

export default React.memo(WorkoutSummary);
