import { motion } from 'framer-motion';
// PerformanceAnalytics - Real-time workout performance tracking
// Live stats, volume tracking, and workout insights
import { memo, useMemo } from 'react';

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
  let volume = 0;
  let completedSets = 0;
  let totalSets = 0;
  let completedExercises = 0;
  const rpes: number[] = [];

  // Single pass through all exercises and sets
  for (const exercise of exercises) {
    totalSets += exercise.targetSets;
    let exerciseCompletedSets = 0;

    for (const set of exercise.sets) {
      if (set.completed) {
        completedSets++;
        exerciseCompletedSets++;
        volume += set.weight * set.reps;

        if (set.rpe !== undefined) {
          rpes.push(set.rpe);
        }
      }
    }

    // Check if exercise is fully completed
    if (exerciseCompletedSets === exercise.targetSets) {
      completedExercises++;
    }
  }

  const avgRPE = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

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
    <motion.div
      className="bg-white/5 rounded-2xl p-4 flex flex-col"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {suffix && <span className="text-sm text-white/40">{suffix}</span>}
      </div>

      {trend && trendValue && (
        <div
          className={`flex items-center gap-1 mt-1 text-xs ${
            trend === 'up'
              ? 'text-[var(--color-success-fg)]'
              : trend === 'down'
                ? 'text-[var(--color-error-fg)]'
                : 'text-white/40'
          }`}
        >
          <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
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
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
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
  const maxValue = Math.max(current, previous, target || 0) * 1.2;
  const currentPercent = (current / maxValue) * 100;
  const previousPercent = (previous / maxValue) * 100;
  const targetPercent = target ? (target / maxValue) * 100 : null;

  return (
    <div className="space-y-2">
      {/* Current workout */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50 w-16">היום</span>
        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${currentPercent}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
          {targetPercent && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/50"
              style={{ left: `${targetPercent}%` }}
            />
          )}
        </div>
        <span className="text-xs text-white font-medium tabular-nums w-16 text-right">
          {current.toLocaleString()}
        </span>
      </div>

      {/* Previous workout */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/40 w-16">קודם</span>
        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-white/30"
            initial={{ width: 0 }}
            animate={{ width: `${previousPercent}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.1 }}
          />
        </div>
        <span className="text-xs text-white/40 tabular-nums w-16 text-right">
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
      .reduce((total, s) => total + s.weight * s.reps, 0);

    return (
      <motion.div
        className="flex items-center gap-3 py-2"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <MiniProgress
          progress={progress}
          size={36}
          color={progress >= 1 ? '#30D158' : 'var(--fs-accent)'}
        />

        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">{exercise.name}</div>
          <div className="text-xs text-white/40">
            {completedSets}/{exercise.targetSets} סטים • {volume.toLocaleString()} ק״ג
          </div>
        </div>

        {progress >= 1 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg">
            ✓
          </motion.span>
        )}
      </motion.div>
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
  ({
    exercises,
    startTime,
    currentTime = new Date(),
    previousWorkout,
    compact = false,
    className = '',
  }) => {
    // Calculate current stats - uses combined single-pass calculation
    const stats = useMemo(() => {
      // Single pass through all exercises for all metrics
      const { volume, completedSets, totalSets, avgRPE, completedExercises } =
        calculateAllStats(exercises);
      const duration = currentTime.getTime() - startTime.getTime();

      // Calculate trends compared to previous workout
      let volumeTrend: 'up' | 'down' | 'neutral' = 'neutral';
      let volumeTrendValue = '';

      if (previousWorkout) {
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
        <motion.div
          className={`flex items-center justify-around bg-black/40 backdrop-blur-md rounded-2xl p-3 ${className}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center">
            <div className="text-lg font-bold text-white tabular-nums">
              {stats.volume.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/40 uppercase">נפח</div>
          </div>

          <div className="w-px h-8 bg-white/10" />

          <div className="text-center">
            <div className="text-lg font-bold text-white tabular-nums">
              {stats.completedSets}/{stats.totalSets}
            </div>
            <div className="text-[10px] text-white/40 uppercase">סטים</div>
          </div>

          <div className="w-px h-8 bg-white/10" />

          <div className="text-center">
            <div className="text-lg font-bold text-white tabular-nums">
              {formatDuration(stats.duration)}
            </div>
            <div className="text-[10px] text-white/40 uppercase">זמן</div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`premium-card p-5 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-white/60 font-medium">ביצועים בזמן אמת</h3>
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-[var(--color-live)]"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            />
            <span className="text-xs text-white/40">LIVE</span>
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

          <StatCard label="זמן אימון" value={formatDuration(stats.duration)} color="#FF9F0A" />

          <StatCard
            label="סטים"
            value={`${stats.completedSets}/${stats.totalSets}`}
            color="#30D158"
          />

          <StatCard
            label="RPE ממוצע"
            value={stats.avgRPE !== null ? stats.avgRPE.toFixed(1) : '—'}
            color="#BF5AF2"
          />
        </div>

        {/* Volume Comparison */}
        {previousWorkout && (
          <div className="mb-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/50 mb-3">השוואה לאימון הקודם</div>
            <VolumeComparisonBar current={stats.volume} previous={previousWorkout.totalVolume} />
          </div>
        )}

        {/* Exercise Breakdown */}
        <div className="pt-4 border-t border-white/10">
          <div className="text-xs text-white/50 mb-2">התקדמות תרגילים</div>
          <div className="space-y-1">
            {exercises.map((exercise, index) => (
              <ExerciseProgressRow key={exercise.name} exercise={exercise} index={index} />
            ))}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">התקדמות כללית</span>
            <span className="text-xs text-white font-medium tabular-nums">
              {Math.round(stats.progress * 100)}%
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  stats.progress >= 1
                    ? 'linear-gradient(90deg, #30D158, #34C759)'
                    : 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress * 100}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
      </motion.div>
    );
  }
);

PerformanceAnalytics.displayName = 'PerformanceAnalytics';

export default PerformanceAnalytics;
export { calculateVolume, calculateCompletedSets, formatDuration };
