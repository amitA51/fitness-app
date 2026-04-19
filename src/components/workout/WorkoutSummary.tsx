// WorkoutSummary - Ultra Premium Post-Workout Summary with Cinematic Stats
// Features: Animated counters, activity rings, confetti celebration, share capabilities, workout comparison
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useCelebration } from '../../hooks/useCelebration';
import { getWorkoutSessions } from '../../services/dataService';
import { exportWorkoutHistoryCSV, isNewPR } from '../../services/prService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
import { CheckCircleIcon } from '../icons';
import { ModalOverlay } from '../ui/ModalOverlay';
import { Confetti } from './components/PRHighlights';
import { type ComparisonData, StatsGrid } from './components/StatsGrid';
import { SummaryExerciseList } from './components/SummaryExerciseList';

// ============================================================
// TYPES
// ============================================================

interface WorkoutSummaryProps {
  isOpen: boolean;
  session: Partial<WorkoutSession>;
  onClose: () => void;
  onSaveAsTemplate?: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
  isOpen,
  session,
  onClose,
  onSaveAsTemplate,
}) => {
  const { triggerConfetti } = useCelebration();
  const [showConfetti, setShowConfetti] = useState(true);
  const [view, setView] = useState<'overview' | 'details'>('overview');
  const [prsCount, setPrsCount] = useState<number | null>(null);
  const [prExercises, setPrExercises] = useState<Set<string>>(new Set());
  const [comparison, setComparison] = useState<ComparisonData | null>(null);

  // Celebrate on mount - trigger confetti for post-workout celebration
  useEffect(() => {
    triggerConfetti();
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, [triggerConfetti]);

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

        const prevExercises = prevSession.exercises || [];
        const prevWorkingSets = prevExercises.flatMap((ex) =>
          (ex.sets || []).filter((s) => !s.isWarmup)
        );

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

        const currentExercises = session.exercises || [];
        const currentWorkingSets = currentExercises.flatMap((ex) =>
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
      } catch {
        // Silently handle comparison loading errors
      }
    };

    if (isOpen) {
      loadComparison();
    }
  }, [isOpen, session]);

  // Calculate stats
  const stats = useMemo(() => {
    const exercises = session.exercises || [];

    const workingSets = (ex: (typeof exercises)[0]) => ex.sets.filter((s) => !s.isWarmup);

    const totalVolume = exercises.reduce(
      (sum, ex) =>
        sum +
        workingSets(ex).reduce(
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
        sum +
        workingSets(ex).reduce(
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

    // RPE comparison: actual vs target
    let rpeActualTotal = 0;
    let rpeActualCount = 0;
    let rpeTargetTotal = 0;
    let rpeTargetCount = 0;

    exercises.forEach((ex) => {
      workingSets(ex).forEach((s) => {
        if (s.completedAt && s.rpe) {
          rpeActualTotal += s.rpe;
          rpeActualCount++;
        }
      });
      if (ex.programExtras?.rpeTarget) {
        const parsed = Number.parseFloat(String(ex.programExtras.rpeTarget));
        if (!isNaN(parsed)) {
          rpeTargetTotal += parsed;
          rpeTargetCount++;
        }
      }
    });

    const avgRpeActual = rpeActualCount > 0 ? +(rpeActualTotal / rpeActualCount).toFixed(1) : null;
    const avgRpeTarget = rpeTargetCount > 0 ? +(rpeTargetTotal / rpeTargetCount).toFixed(1) : null;

    // Calculate exercise-specific stats
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

        return {
          name: ex.name,
          setsCompleted: completedSets.length,
          totalVolume: volume,
          bestSet,
        };
      })
      .filter((e) => e.setsCompleted > 0);

    return {
      totalVolume,
      totalSets,
      totalReps,
      duration,
      exerciseCount,
      exerciseStats,
      avgRpeActual,
      avgRpeTarget,
    };
  }, [session]);

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

        session.exercises.forEach((ex) => {
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

  // Export CSV
  const handleExportCSV = useCallback(() => {
    exportWorkoutHistoryCSV([session as WorkoutSession]);
  }, [session]);

  // Share (if available)
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'סיכום אימון',
          text: `סיימתי אימון! 🏋️\n⏱️ ${stats.duration} דקות\n🔥 ${stats.totalVolume.toLocaleString()} ק״ג נפח\n✅ ${stats.totalSets} סטים\n🏆 ${prsCount || 0} שיאים חדשים!`,
        });
      } catch {
        // Share cancelled or failed — no action needed
      }
    }
  }, [stats, prsCount]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      zLevel="high"
      backdropOpacity={90}
      blur="xl"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="סיכום אימון"
    >
      {showConfetti && <Confetti show={true} />}
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="spark-glass-heavy rounded-[32px] p-6 max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
            className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--cosmos-accent-primary)] to-emerald-500 flex items-center justify-center shadow-lg shadow-[var(--cosmos-accent-primary)]/30"
          >
            <CheckCircleIcon className="w-10 h-10 text-black" />
          </motion.div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">אימון הושלם! 🎉</h2>
          <p className="text-sm text-white/40 font-medium">
            {new Date().toLocaleDateString('he-IL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </motion.div>

        {/* View Toggle */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex premium-card p-1 text-xs"
            style={{ padding: '4px', borderRadius: '16px' }}
          >
            {['overview', 'details'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v as 'overview' | 'details')}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setView(v as 'overview' | 'details');
                }}
                className={`px-5 py-2 rounded-lg font-bold transition-all ${
                  view === v
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {v === 'overview' ? 'סקירה' : 'פרטים'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
          <AnimatePresence mode="sync">
            {view === 'overview' ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="space-y-5"
              >
                {/* Stats Grid */}
                <StatsGrid
                  totalVolume={stats.totalVolume}
                  duration={stats.duration}
                  totalSets={stats.totalSets}
                  prsCount={prsCount}
                  comparison={comparison}
                />

                {/* RPE Comparison */}
                {stats.avgRpeActual !== null && (
                  <RPEComparisonDisplay
                    avgRpeActual={stats.avgRpeActual}
                    avgRpeTarget={stats.avgRpeTarget}
                  />
                )}

                {/* Quick Summary */}
                {stats.exerciseStats.length > 0 && (
                  <SummaryExerciseList
                    exercises={stats.exerciseStats}
                    prExercises={prExercises}
                    maxItems={4}
                    startDelay={0.5}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-4"
              >
                {stats.exerciseStats.map((ex, i) => (
                  <ExerciseSummaryItem
                    key={ex.name ?? ''}
                    name={ex.name ?? ''}
                    setsCompleted={ex.setsCompleted}
                    totalVolume={ex.totalVolume}
                    bestSet={ex.bestSet}
                    isPR={prExercises.has(ex.name ?? '')}
                    delay={i * 0.05}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <motion.div
          className="mt-6 space-y-3 pt-4 border-t border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => onClose()}
            onPointerDown={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="btn-primary w-full shadow-apple-action text-xl mb-3"
          >
            סיום 🎉
          </button>

          <div className="flex gap-3">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleShare();
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                שתף
              </button>
            )}
            <button
              onClick={handleExportCSV}
              onPointerDown={(e) => {
                e.preventDefault();
                handleExportCSV();
              }}
              className="btn-secondary flex-1"
            >
              ייצוא CSV
            </button>
            {onSaveAsTemplate && (
              <button
                onClick={onSaveAsTemplate}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onSaveAsTemplate();
                }}
                className="btn-secondary flex-1"
              >
                שמור תבנית
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </ModalOverlay>
  );
};

// ============================================================
// INLINE COMPONENTS (kept for details view)
// ============================================================

interface RPEComparisonDisplayProps {
  avgRpeActual: number;
  avgRpeTarget: number | null;
}

const RPEComparisonDisplay: React.FC<RPEComparisonDisplayProps> = ({
  avgRpeActual,
  avgRpeTarget,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.45 }}
    className="premium-card p-4"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold text-white/40 uppercase tracking-wider">מאמץ (RPE)</span>
      {avgRpeTarget !== null && (
        <span className="text-[10px] text-white/30">יעד: {avgRpeTarget}</span>
      )}
    </div>
    <div className="flex items-center gap-3">
      <span className="text-2xl font-[800] text-white">{avgRpeActual}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor:
              avgRpeActual <= 6
                ? 'var(--cosmos-success)'
                : avgRpeActual <= 8
                  ? 'var(--cosmos-warning)'
                  : 'var(--cosmos-error)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(avgRpeActual * 10, 100)}%` }}
          transition={{ duration: 1, delay: 0.55 }}
        />
      </div>
      <span className="text-sm">{avgRpeActual <= 6 ? '😊' : avgRpeActual <= 8 ? '😤' : '🔥'}</span>
    </div>
    {avgRpeTarget !== null && (
      <p className="text-[10px] text-white/30 mt-2">
        {avgRpeActual < avgRpeTarget
          ? '📉 מתחת ליעד — אפשר לדחוף יותר!'
          : avgRpeActual > avgRpeTarget
            ? '📈 מעל היעד — מאמץ גבוה!'
            : '✅ בול ביעד!'}
      </p>
    )}
  </motion.div>
);

interface ExerciseSummaryItemProps {
  name: string;
  setsCompleted: number;
  totalVolume: number;
  bestSet?: { weight: number; reps: number };
  isPR?: boolean;
  delay?: number;
}

const ExerciseSummaryItem: React.FC<ExerciseSummaryItemProps> = ({
  name,
  setsCompleted,
  totalVolume,
  bestSet,
  isPR,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, type: 'spring', stiffness: 200 }}
    className="relative premium-card p-4"
  >
    {isPR && (
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400 }}
        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
      >
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </motion.div>
    )}

    <div className="flex justify-between items-start mb-3">
      <h4 className="text-base font-bold text-white leading-tight">{name}</h4>
      <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg font-mono">
        {setsCompleted} sets
      </span>
    </div>

    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 23c-3.6 0-9-2.7-9-8 0-4.4 5.1-10.8 7.9-13.4.4-.4 1.1-.4 1.4 0C15.9 4.2 21 10.6 21 15c0 5.3-5.4 8-9 8z" />
        </svg>
        <span className="text-white/70 font-medium">{totalVolume.toLocaleString()} kg</span>
      </div>
      {bestSet && (
        <div className="flex items-center gap-1.5">
          <span className="text-white/30">Best:</span>
          <span className="text-[var(--cosmos-accent-primary)] font-bold">
            {bestSet.weight}kg × {bestSet.reps}
          </span>
        </div>
      )}
    </div>
  </motion.div>
);

// Import calculatePRsFromHistory that was missing
import { calculatePRsFromHistory } from '../../services/prService';

export default React.memo(WorkoutSummary);
