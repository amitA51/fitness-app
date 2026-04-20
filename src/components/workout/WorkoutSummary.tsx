// WorkoutSummary - Sport Annual Editorial Design
// Navy masthead · Bone body · Big Shoulders typography · Sharp corners

import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getWorkoutSessions } from '../../services/dataService';
import { exportWorkoutHistoryCSV, isNewPR, calculatePRsFromHistory } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
import { CheckCircleIcon } from '../icons';
import { ModalOverlay } from '../ui/ModalOverlay';
import { SummaryExerciseList } from './components/SummaryExerciseList';
import { type ComparisonData, StatsGrid } from './components/StatsGrid';

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
  const exercises = session.exercises || [];
  const workingSets = (ex: (typeof exercises)[0]) => (ex.sets || []).filter((s) => !s.isWarmup);

  const totalVolume = exercises.reduce(
    (sum, ex) =>
      sum + workingSets(ex).reduce(
        (setSum, set) =>
          set.completedAt && set.weight && set.reps ? setSum + set.weight * set.reps : setSum,
        0
      ),
    0
  );

  const totalSets = exercises.reduce(
    (sum, ex) => sum + workingSets(ex).filter((s) => s.completedAt).length,
    0
  );

  const totalReps = exercises.reduce(
    (sum, ex) =>
      sum + workingSets(ex).reduce(
        (setSum, set) => (set.completedAt && set.reps ? setSum + set.reps : setSum),
        0
      ),
    0
  );

  const duration =
    session.startTime && session.endTime
      ? Math.round(
          (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) /
            1000 /
            60
        )
      : 0;

  const exerciseCount = exercises.filter((ex) =>
    workingSets(ex).some((s) => s.completedAt)
  ).length;

  const exerciseStats = exercises
    .map((ex) => {
      const completedSets = workingSets(ex).filter((s) => s.completedAt);
      const volume = completedSets.reduce(
        (sum, s) => (s.weight && s.reps ? sum + s.weight * s.reps : sum),
        0
      );
      const bestSet = completedSets.reduce<{ weight: number; reps: number } | undefined>(
        (best, s) => {
          if (!s.weight || !s.reps) return best;
          const current = s.weight * s.reps;
          const bestVolume = best ? best.weight * best.reps : 0;
          return current > bestVolume ? { weight: s.weight, reps: s.reps } : best;
        },
        undefined
      );
      return { name: ex.name, setsCompleted: completedSets.length, totalVolume: volume, bestSet };
    })
    .filter((e) => e.setsCompleted > 0);

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
            (a, b) =>
              new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
          );

        if (previousSessions.length === 0) return;
        const prevSession = previousSessions[0];
        if (!prevSession) return;

        const prevEx = prevSession.exercises || [];
        const prevWorkingSets = prevEx.flatMap((ex) => (ex.sets || []).filter((s) => !s.isWarmup));
        const prevVolume = prevWorkingSets.reduce(
          (sum, s) => (s.completedAt ? sum + (s.weight || 0) * (s.reps || 0) : sum),
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
          (sum, s) => (s.completedAt ? sum + (s.weight || 0) * (s.reps || 0) : sum),
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
        const allSessions = await getWorkoutSessions();
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

    computePRs();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleExportCSV = useCallback(() => {
    exportWorkoutHistoryCSV([session as WorkoutSession]);
  }, [session]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'סיכום אימון',
          text: `סיימתי אימון!\n⏱️ ${stats.duration} דקות\n🔥 ${stats.totalVolume.toLocaleString()} ק"ג נפח\n✅ ${stats.totalSets} סטים`,
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
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden flex flex-col"
        style={{
          background: 'var(--bone)',
          border: '2px solid var(--navy)',
          borderRadius: 0,
          boxShadow: '0 8px 24px rgba(11,26,43,0.25)',
          maxHeight: '90dvh',
        }}
      >
        {/* ── NAVY MASTHEAD ── */}
        <div style={{ background: 'var(--navy)', flexShrink: 0 }}>
          {/* Chapter strip */}
          <div
            className="chapter-break"
            style={{ borderBottom: '1px solid rgba(245,241,235,0.1)' }}
          >
            <span className="left" style={{ color: 'var(--mustard)' }}>
              §99 · סיכום
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
                color: 'var(--bone)',
                lineHeight: 0.88,
                letterSpacing: '-0.02em',
                direction: 'ltr',
                textAlign: 'left',
              }}
            >
              {prsCount > 0 ? (
                <>
                  <span style={{ color: 'var(--mustard)' }}>{prsCount}</span>
                  <br />
                  <span style={{ fontSize: 24, color: 'rgba(245,241,235,0.7)' }}>
                    שיאים חדשים!
                  </span>
                </>
              ) : (
                'אימון הושלם!'
              )}
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'rgba(245,241,235,0.4)',
                textTransform: 'uppercase',
                marginTop: 8,
              }}
            >
              {stats.exerciseCount} תרגילים · {stats.totalSets} סטים ·{' '}
              {stats.totalVolume > 0 ? `${stats.totalVolume.toLocaleString()} ק"ג` : '—'} ·{' '}
              {stats.duration > 0 ? `${stats.duration} דקות` : '—'}
            </p>
          </div>
        </div>

        {/* ── VIEW TABS ── */}
        <div
          className="flex"
          style={{
            background: 'var(--bone)',
            borderBottom: '2px solid var(--bone-deep)',
            flexShrink: 0,
          }}
        >
          {(['overview', 'details'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              onPointerDown={(e) => {
                e.preventDefault();
                setView(v);
              }}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: view === v ? 'var(--navy)' : 'transparent',
                color: view === v ? 'var(--mustard)' : 'var(--stone)',
                border: 'none',
                borderBottom: view === v ? '2px solid var(--mustard)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                transition: 'all 150ms',
              }}
            >
              {v === 'overview' ? 'סקירה' : 'פרטים'}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-5"
          style={{ background: 'var(--bone)' }}
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
                        ? 'var(--mustard)'
                        : 'var(--bone-deep)',
                      border: '2px solid var(--navy)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {prExercises.has(ex.name ?? '') && (
                        <CheckCircleIcon
                          size={16}
                          strokeWidth={2.5}
                          style={{ color: 'var(--navy)', flexShrink: 0 }}
                        />
                      )}
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 14,
                          color: prExercises.has(ex.name ?? '') ? 'var(--navy)' : 'var(--ink)',
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
                          color: prExercises.has(ex.name ?? '') ? 'var(--navy)' : 'var(--stone)',
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
                            color: prExercises.has(ex.name ?? '') ? 'var(--navy)' : 'var(--ink)',
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
            background: 'var(--bone)',
            borderTop: '2px solid var(--bone-deep)',
            flexShrink: 0,
          }}
        >
          {/* Main action */}
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.style.background = 'var(--navy-deep)';
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              background: 'var(--navy)',
              color: 'var(--mustard)',
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
              e.currentTarget.style.background = 'var(--navy)';
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.background = 'var(--navy)';
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
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px 16px',
                  background: 'var(--bone-deep)',
                  color: 'var(--navy)',
                  border: '2px solid var(--navy)',
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
                background: 'var(--bone-deep)',
                color: 'var(--navy)',
                border: '2px solid var(--navy)',
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
                  background: 'var(--bone-deep)',
                  color: 'var(--navy)',
                  border: '2px solid var(--navy)',
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
