import { m } from 'framer-motion';
// PerformanceAnalytics - Real-time workout performance tracking
// Live stats, volume tracking, and workout insights
import { memo, useMemo } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { computeSessionStats, setVolume } from '../../../utils/workoutMath';

// ============================================================
// TYPES
// ============================================================

interface SetData {
  weight: number;
  reps: number;
  completed: boolean;
  rpe?: number;
}

interface ExerciseData {
  name: string;
  sets: SetData[];
  targetSets: number;
}

interface PerformanceAnalyticsProps {
  /** All exercises in the workout */
  exercises: ExerciseData[];
  /** Workout start time */
  startTime: Date;
  /** Current time (for duration calculation) */
  currentTime?: Date;
  /** Previous workout data for comparison */
  previousWorkout?: {
    totalVolume: number;
    totalSets: number;
    duration: number;
  };
  /** Compact mode */
  compact?: boolean;
  /** Custom class */
  className?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Combined calculation for all exercise stats in a single pass
 * Avoids multiple array iterations over the same data
 */
interface ExerciseStats {
  volume: number;
  completedSets: number;
  totalSets: number;
  avgRPE: number | null;
  completedExercises: number;
}

const calculateAllStats = (exercises: ExerciseData[]): ExerciseStats => {
  // Live in-workout shape: completion is the `completed` boolean, totalSets is
  // the sum of planned targetSets, and there is no warmup/weight gating.
  const {
    totalVolume: volume,
    completedSets,
    totalSets,
    avgRPE,
  } = computeSessionStats(
    { exercises },
    { excludeWarmup: false, requireWeightAndReps: false, totalSetsMode: 'target' }
  );

  // "Fully completed" exercises (completed sets === targetSets) is a live-only
  // notion the shared stats fn does not model, so it stays inline.
  const completedExercises = exercises.filter(
    (exercise) => exercise.sets.filter((s) => s.completed).length === exercise.targetSets
  ).length;

  return { volume, completedSets, totalSets, avgRPE, completedExercises };
};

// Legacy exports for backwards compatibility (if used elsewhere)
const calculateVolume = (exercises: ExerciseData[]): number => {
  return calculateAllStats(exercises).volume;
};

const calculateCompletedSets = (exercises: ExerciseData[]): number => {
  return calculateAllStats(exercises).completedSets;
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Individual stat card */
const StatCard = memo<StatCardProps>(
  ({ label, value, suffix = '', trend, trendValue, color = 'var(--fs-accent)' }) => (
    <m.div
      className="rounded-2xl p-4 flex flex-col"
      style={{ background: 'var(--fs-surface-shine)' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: 'var(--fs-text-on-dark)' }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {suffix && (
          <span className="text-sm" style={{ color: 'var(--fs-text-on-dark)' }}>
            {suffix}
          </span>
        )}
      </div>

      {trend && trendValue && (
        <div
          className={`flex items-center gap-1 mt-1 text-xs ${
            trend === 'up'
              ? 'text-[var(--color-success-fg)]'
              : trend === 'down'
                ? 'text-[var(--color-error-fg)]'
                : 'text-[var(--fs-text-on-dark)]'
          }`}
        >
          <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </m.div>
  )
);

StatCard.displayName = 'StatCard';

/** Mini circular progress */
const MiniProgress = memo<{ progress: number; size?: number; color?: string }>(
  ({ progress, size = 40, color = 'var(--fs-accent)' }) => {
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(progress, 1));

    return (
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bar-track)"
          strokeWidth={strokeWidth}
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </svg>
    );
  }
);

MiniProgress.displayName = 'MiniProgress';

/** Volume comparison bar */
const VolumeComparisonBar = memo<{
  current: number;
  previous: number;
  target?: number;
}>(({ current, previous, target }) => {
  const maxValue = Math.max(current, previous, target || 0, 1) * 1.2;
  const currentPercent = (current / maxValue) * 100;
  const previousPercent = (previous / maxValue) * 100;
  const targetPercent = target ? (target / maxValue) * 100 : null;

  return (
    <div className="space-y-2">
      {/* Current workout */}
      <div className="flex items-center gap-3">
        <span className="text-xs w-16" style={{ color: 'var(--fs-text-on-dark)' }}>
          היום
        </span>
        <div
          className="flex-1 h-3 rounded-full overflow-hidden relative"
          style={{ background: 'var(--color-bar-track)' }}
        >
          <m.div
            className="h-full w-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
              // RTL: fill from the reading start (right).
              transformOrigin: 'right center',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: currentPercent / 100 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          {targetPercent && (
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ right: `${targetPercent}%`, background: 'var(--fs-text-on-dark)' }}
            />
          )}
        </div>
        <span
          className="text-xs font-medium tabular-nums w-16 text-right"
          style={{ color: 'var(--color-ink-on-dark)' }}
        >
          {current.toLocaleString()}
        </span>
      </div>

      {/* Previous workout */}
      <div className="flex items-center gap-3">
        <span className="text-xs w-16" style={{ color: 'var(--fs-text-on-dark)' }}>
          קודם
        </span>
        <div
          className="flex-1 h-3 rounded-full overflow-hidden"
          style={{ background: 'var(--color-bar-track)' }}
        >
          <m.div
            className="h-full w-full rounded-full"
            style={{ transformOrigin: 'right center', background: 'var(--fs-border-on-dark)' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: previousPercent / 100 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
          />
        </div>
        <span
          className="text-xs tabular-nums w-16 text-right"
          style={{ color: 'var(--fs-text-on-dark)' }}
        >
          {previous.toLocaleString()}
        </span>
      </div>
    </div>
  );
});

VolumeComparisonBar.displayName = 'VolumeComparisonBar';

/** Exercise progress row */
const ExerciseProgressRow = memo<{ exercise: ExerciseData; index: number }>(
  ({ exercise, index }) => {
    const completedSets = exercise.sets.filter((s) => s.completed).length;
    const progress = completedSets / exercise.targetSets;
    const volume = exercise.sets
      .filter((s) => s.completed)
      .reduce((total, s) => total + setVolume(s), 0);

    return (
      <m.div
        className="flex items-center gap-3 py-2"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <MiniProgress
          progress={progress}
          size={36}
          color={progress >= 1 ? 'var(--fs-signal)' : 'var(--fs-accent)'}
        />

        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-ink-on-dark)' }}
          >
            {exercise.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--fs-text-on-dark)' }}>
            {completedSets}/{exercise.targetSets} סטים • {volume.toLocaleString()} ק״ג
          </div>
        </div>

        {progress >= 1 && (
          <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg">
            ✓
          </m.span>
        )}
      </m.div>
    );
  }
);

ExerciseProgressRow.displayName = 'ExerciseProgressRow';

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * PerformanceAnalytics - Real-time workout performance dashboard
 *
 * Features:
 * - Live volume tracking
 * - Set completion progress
 * - Duration tracking
 * - Previous workout comparison
 * - Per-exercise breakdown
 * - Average RPE tracking
 */
const PerformanceAnalytics = memo<PerformanceAnalyticsProps>(
  ({ exercises, startTime, currentTime, previousWorkout, compact = false, className = '' }) => {
    const shouldReduce = useReducedMotion();
    // Calculate current stats - uses combined single-pass calculation
    const stats = useMemo(() => {
      // Single pass through all exercises for all metrics
      const { volume, completedSets, totalSets, avgRPE, completedExercises } =
        calculateAllStats(exercises);
      const now = currentTime ?? new Date();
      const duration = now.getTime() - startTime.getTime();

      // Calculate trends compared to previous workout
      let volumeTrend: 'up' | 'down' | 'neutral' = 'neutral';
      let volumeTrendValue = '';

      if (previousWorkout && previousWorkout.totalVolume > 0) {
        const volumeDiff = volume - previousWorkout.totalVolume;
        const volumePercent = Math.abs(
          Math.round((volumeDiff / previousWorkout.totalVolume) * 100)
        );
        if (volumeDiff > 0) {
          volumeTrend = 'up';
          volumeTrendValue = `+${volumePercent}%`;
        } else if (volumeDiff < 0) {
          volumeTrend = 'down';
          volumeTrendValue = `-${volumePercent}%`;
        }
      }

      return {
        volume,
        completedSets,
        totalSets,
        avgRPE,
        duration,
        completedExercises,
        volumeTrend,
        volumeTrendValue,
        progress: totalSets > 0 ? completedSets / totalSets : 0,
      };
    }, [exercises, startTime, currentTime, previousWorkout]);

    // Compact mode - single row of stats
    if (compact) {
      return (
        <m.div
          className={`flex items-center justify-around backdrop-blur-md rounded-2xl p-3 ${className}`}
          style={{ background: 'var(--color-scrim)' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-ink-on-dark)' }}
            >
              {stats.volume.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase" style={{ color: 'var(--fs-text-on-dark)' }}>
              נפח
            </div>
          </div>

          <div className="w-px h-8" style={{ background: 'var(--fs-border-on-dark)' }} />

          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-ink-on-dark)' }}
            >
              {stats.completedSets}/{stats.totalSets}
            </div>
            <div className="text-[10px] uppercase" style={{ color: 'var(--fs-text-on-dark)' }}>
              סטים
            </div>
          </div>

          <div className="w-px h-8" style={{ background: 'var(--fs-border-on-dark)' }} />

          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-ink-on-dark)' }}
            >
              {formatDuration(stats.duration)}
            </div>
            <div className="text-[10px] uppercase" style={{ color: 'var(--fs-text-on-dark)' }}>
              זמן
            </div>
          </div>
        </m.div>
      );
    }

    return (
      <m.div
        className={`premium-card p-5 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium" style={{ color: 'var(--fs-text-on-dark)' }}>
            ביצועים בזמן אמת
          </h3>
          <div className="flex items-center gap-2">
            <m.div
              className="w-2 h-2 rounded-full bg-[var(--color-live)]"
              animate={shouldReduce ? { opacity: 1 } : { opacity: [1, 0.5, 1] }}
              transition={
                shouldReduce ? { duration: 0 } : { duration: 1.5, repeat: Number.POSITIVE_INFINITY }
              }
            />
            <span className="text-xs" style={{ color: 'var(--fs-text-on-dark)' }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="נפח כולל"
            value={stats.volume}
            suffix="ק״ג"
            color="var(--fs-accent)"
            trend={stats.volumeTrend}
            trendValue={stats.volumeTrendValue}
          />

          <StatCard
            label="זמן אימון"
            value={formatDuration(stats.duration)}
            color="var(--fs-warn)"
          />

          <StatCard
            label="סטים"
            value={`${stats.completedSets}/${stats.totalSets}`}
            color="var(--color-success-fg)"
          />

          <StatCard
            label="RPE ממוצע"
            value={stats.avgRPE !== null ? stats.avgRPE.toFixed(1) : '—'}
            color="var(--fs-signal)"
          />
        </div>

        {/* Volume Comparison */}
        {previousWorkout && (
          <div className="mb-4 pt-4 border-t" style={{ borderColor: 'var(--fs-border-on-dark)' }}>
            <div className="text-xs mb-3" style={{ color: 'var(--fs-text-on-dark)' }}>
              השוואה לאימון הקודם
            </div>
            <VolumeComparisonBar current={stats.volume} previous={previousWorkout.totalVolume} />
          </div>
        )}

        {/* Exercise Breakdown */}
        <div className="pt-4 border-t" style={{ borderColor: 'var(--fs-border-on-dark)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--fs-text-on-dark)' }}>
            התקדמות תרגילים
          </div>
          <div className="space-y-1">
            {exercises.map((exercise, index) => (
              <ExerciseProgressRow key={exercise.name} exercise={exercise} index={index} />
            ))}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--fs-border-on-dark)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--fs-text-on-dark)' }}>
              התקדמות כללית
            </span>
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: 'var(--color-ink-on-dark)' }}
            >
              {Math.round(stats.progress * 100)}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--color-bar-track)' }}
          >
            <m.div
              className="h-full w-full rounded-full"
              style={{
                background:
                  stats.progress >= 1
                    ? 'linear-gradient(90deg, var(--fs-signal), var(--fs-accent))'
                    : 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
                transformOrigin: 'right center',
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(stats.progress, 1) }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
      </m.div>
    );
  }
);

PerformanceAnalytics.displayName = 'PerformanceAnalytics';

export default PerformanceAnalytics;
export { calculateVolume, calculateCompletedSets, formatDuration };
