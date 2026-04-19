import { AnimatePresence, motion } from 'framer-motion';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  type Achievement,
  type StreakInfo,
  calculateStreak,
  getAchievements,
} from '../../services/achievementService';
import {
  type ForecastData,
  type MuscleBalanceData,
  type MuscleGroupData,
  type VolumeDataPoint,
  type WeeklyVolume,
  calculateMuscleBalance,
  calculateMuscleGroupDistribution,
  calculateVolumeHistory,
  calculateWeeklyVolumes,
  forecastProgress,
  getAverageVolume,
} from '../../services/analyticsService';
import { getWorkoutSessions } from '../../services/dataService';
import type { WorkoutSession } from '../../types';
import { FlameIcon, TrophyIcon } from '../icons';
import ForecastChart from './ForecastChart';
import WorkoutCalendar from './WorkoutCalendar';
import MuscleRadarChart from './components/MuscleRadarChart';
import TrendLineOverlay from './components/TrendLineOverlay';

const MUSCLE_COLORS: Record<string, string> = {
  חזה: '#ef4444',
  גב: '#3b82f6',
  כתפיים: '#a855f7',
  רגליים: '#22c55e',
  ביצפס: '#f59e0b',
  טריצפס: '#ec4899',
  אמות: '#14b8a6',
  בטן: '#f97316',
  Core: '#f97316',
  Chest: '#ef4444',
  Back: '#3b82f6',
  Shoulders: '#a855f7',
  Legs: '#22c55e',
  Arms: '#f59e0b',
  Biceps: '#ec4899',
  Triceps: '#14b8a6',
};

function getMuscleColor(muscle: string, index: number): string {
  return MUSCLE_COLORS[muscle] || `hsl(${(index * 60) % 360}, 70%, 60%)`;
}

/**
 * Premium Stat Card Component
 */
const StatCard = memo(
  ({
    icon,
    label,
    value,
    sublabel,
    gradient,
    iconColor,
    delay = 0,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sublabel: string;
    gradient: string;
    iconColor: string;
    delay?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className={`bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 ${gradient} rounded-2xl p-4 relative overflow-hidden group`}
    >
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className={iconColor}>{icon}</span>
          <span className="text-[10px] text-[var(--cosmos-text-muted)] uppercase tracking-wider font-semibold">
            {label}
          </span>
        </div>
        <div className="text-3xl font-black text-white">{value}</div>
        <div className="text-[10px] text-white/40 mt-1">{sublabel}</div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors" />
    </motion.div>
  )
);
StatCard.displayName = 'StatCard';

const AnalyticsDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
  const [muscleGroupData, setMuscleGroupData] = useState<MuscleGroupData[]>([]);
  const [weeklyVolumes, setWeeklyVolumes] = useState<WeeklyVolume[]>([]);
  const [muscleBalanceData, setMuscleBalanceData] = useState<MuscleBalanceData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [avgVolume, setAvgVolume] = useState(0);
  const [streakInfo, setStreakInfo] = useState<StreakInfo>({
    currentStreak: 0,
    longestStreak: 0,
    lastWorkoutDate: null,
    workoutsThisWeek: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<number | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      const workoutSessions = await getWorkoutSessions();

      const volume = calculateVolumeHistory(workoutSessions);
      const avg = getAverageVolume(workoutSessions);
      const streak = calculateStreak(workoutSessions);
      const achieves = await getAchievements(workoutSessions, streak);
      const muscleGroups = calculateMuscleGroupDistribution(workoutSessions);

      // New analytics data
      const weekly = calculateWeeklyVolumes(workoutSessions, 12);
      const balance = calculateMuscleBalance(workoutSessions, 12);
      const forecast = forecastProgress(workoutSessions);

      setSessions(workoutSessions);
      setVolumeData(volume);
      setMuscleGroupData(muscleGroups);
      setAvgVolume(avg);
      setStreakInfo(streak);
      setAchievements(achieves);
      setWeeklyVolumes(weekly);
      setMuscleBalanceData(balance);
      setForecastData(forecast);
      setLoading(false);
    };
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          className="w-8 h-8 border-2 border-[var(--cosmos-accent-primary)] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const recentVolume = useMemo(() => volumeData.slice(-10), [volumeData]);
  const maxVolume = useMemo(
    () => Math.max(...recentVolume.map((d) => d.volume), 1),
    [recentVolume]
  );
  const maxWeeklyVolume = useMemo(
    () => Math.max(...weeklyVolumes.map((d) => d.totalVolume), 1),
    [weeklyVolumes]
  );
  const unlockedAchievements = useMemo(
    () => achievements.filter((a) => a.progress === 100),
    [achievements]
  );

  const handleTrendPointHover = useCallback((idx: number | null) => {
    setHoveredTrendPoint(idx);
  }, []);

  return (
    <div className="space-y-6 -mr-2 pr-2 overflow-y-auto custom-scrollbar max-h-[60vh]">
      {/* Header Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<span className="text-2xl">🔥</span>}
          label="רצף נוכחי"
          value={streakInfo.currentStreak}
          sublabel="ימים רצופים"
          gradient="bg-gradient-to-br from-orange-500/10 to-red-500/5"
          iconColor="text-orange-400"
          delay={0}
        />
        <StatCard
          icon={<TrophyIcon className="w-5 h-5" />}
          label="הישגים"
          value={`${unlockedAchievements.length}/${achievements.length}`}
          sublabel="פתוחים"
          gradient="bg-gradient-to-br from-purple-500/10 to-pink-500/5"
          iconColor="text-purple-400"
          delay={0.05}
        />
      </div>

      {/* Achievements Grid */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5"
        >
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full workout-pulse-glow" />
            הישגים
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {achievements.slice(0, 6).map((achievement, i) => {
              const isUnlocked = achievement.progress === 100;
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`p-3 rounded-xl border transition-all ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className={`text-2xl mb-1 ${isUnlocked ? 'workout-fire-effect' : 'opacity-30 grayscale'}`}
                  >
                    {achievement.icon}
                  </div>
                  <div
                    className={`text-xs font-bold ${isUnlocked ? 'text-yellow-300' : 'text-white/60'}`}
                  >
                    {achievement.name}
                  </div>
                  {!isUnlocked && (
                    <div className="mt-2">
                      <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${achievement.progress}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-[var(--cosmos-accent-primary)] to-[var(--cosmos-accent-cyan)]"
                        />
                      </div>
                      <div className="text-[9px] text-white/30 mt-1">{achievement.progress}%</div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stats Cards Row 2 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<FlameIcon className="w-5 h-5" />}
          label="נפח ממוצע"
          value={avgVolume.toLocaleString()}
          sublabel="ק״ג לאימון"
          gradient="bg-gradient-to-br from-[var(--cosmos-accent-primary)]/10 to-[var(--cosmos-accent-primary)]/5"
          iconColor="text-[var(--cosmos-accent-primary)]"
          delay={0.15}
        />
        <StatCard
          icon={<TrophyIcon className="w-5 h-5" />}
          label="סה״כ אימונים"
          value={volumeData.length}
          sublabel="אימונים הושלמו"
          gradient="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5"
          iconColor="text-cyan-400"
          delay={0.2}
        />
      </div>

      {/* Enhanced Volume Chart with Trend Line */}
      {weeklyVolumes.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--cosmos-accent-primary)] rounded-full" />
              מגמת נפח שבועית
            </h3>
            <div className="flex items-center gap-3 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-gradient-to-r from-[var(--cosmos-accent-primary)] to-[var(--cosmos-accent-cyan)] rounded" />
                <span className="text-white/40">נפח</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-yellow-400/80 rounded" />
                <span className="text-white/40">מגמה</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-0.5 bg-yellow-400/50 rounded"
                  style={{ borderTop: '2px dashed rgba(251, 191, 36, 0.5)' }}
                />
                <span className="text-white/40">חיזוי</span>
              </div>
            </div>
          </div>

          <div className="h-48 relative">
            {/* SVG Chart with Trend Line */}
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${weeklyVolumes.length * 60} 180`}
              preserveAspectRatio="xMidYMid meet"
              className="overflow-visible"
            >
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`grid-${i}`}
                  x1="0"
                  y1={i * 45}
                  x2={weeklyVolumes.length * 60}
                  y2={i * 45}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Trend Line Overlay */}
              <TrendLineOverlay
                data={weeklyVolumes}
                forecast={forecastData}
                maxVolume={maxWeeklyVolume}
                hoveredIndex={hoveredTrendPoint}
                onHover={handleTrendPointHover}
                svgWidth={weeklyVolumes.length * 60}
                chartHeight={180}
                barWidth={40}
                barGap={20}
              />

              {/* Bars */}
              {weeklyVolumes.map((week, i) => {
                const height = (week.totalVolume / maxWeeklyVolume) * 140;
                const barX = 10 + i * 60 + 20;
                const isHovered = hoveredTrendPoint === i;

                return (
                  <g key={i}>
                    <motion.rect
                      x={barX}
                      y={170 - height}
                      width={40}
                      height={height}
                      rx={4}
                      fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                      initial={{ height: 0, y: 170 }}
                      animate={{ height, y: 170 - height }}
                      transition={{
                        delay: 0.2 + i * 0.05,
                        type: 'spring',
                        stiffness: 200,
                        damping: 15,
                      }}
                      onMouseEnter={() => setHoveredTrendPoint(i)}
                      onMouseLeave={() => setHoveredTrendPoint(null)}
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Week Label */}
                    <text
                      x={barX + 20}
                      y={185}
                      textAnchor="middle"
                      fontSize={8}
                      fill="rgba(255, 255, 255, 0.4)"
                    >
                      {week.weekLabel.split('-W')[1] || week.weekLabel.slice(-2)}
                    </text>
                  </g>
                );
              })}

              {/* Gradients */}
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cosmos-accent-cyan)" />
                  <stop offset="100%" stopColor="var(--cosmos-accent-primary)" />
                </linearGradient>
                <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cosmos-accent-cyan)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="var(--cosmos-accent-primary)" stopOpacity="0.9" />
                </linearGradient>
              </defs>
            </svg>

            {/* Enhanced Tooltip */}
            <AnimatePresence>
              {hoveredTrendPoint !== null && weeklyVolumes[hoveredTrendPoint] && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20"
                >
                  <div className="bg-black/95 text-white text-[10px] px-3 py-2 rounded-lg whitespace-nowrap shadow-lg border border-white/10">
                    <div className="font-bold text-sm mb-1">
                      {weeklyVolumes[hoveredTrendPoint].totalVolume.toLocaleString()} ק״ג
                    </div>
                    <div className="text-white/50 text-[8px] mb-1">
                      שבוע {weeklyVolumes[hoveredTrendPoint].weekLabel}
                    </div>
                    {weeklyVolumes[hoveredTrendPoint].changeFromPrevious !== null && (
                      <div
                        className={`text-[9px] ${
                          weeklyVolumes[hoveredTrendPoint].changeFromPrevious! >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {weeklyVolumes[hoveredTrendPoint].changeFromPrevious! >= 0 ? '↑' : '↓'}{' '}
                        {Math.abs(weeklyVolumes[hoveredTrendPoint].changeFromPrevious!)}% מהשבוע
                        הקודם
                      </div>
                    )}
                    <div className="text-white/40 text-[8px] mt-1">
                      {weeklyVolumes[hoveredTrendPoint].sessionCount} אימונים
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Forecast Summary */}
          {forecastData && forecastData.predicted > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-2">
                <span className="text-white/40">חיזוי לשבוע הבא:</span>
                <span className="text-yellow-400 font-medium">
                  {forecastData.predicted.toLocaleString()} ק״ג
                </span>
                <span
                  className={`${
                    forecastData.trend === 'increasing'
                      ? 'text-green-400'
                      : forecastData.trend === 'decreasing'
                        ? 'text-red-400'
                        : 'text-white/40'
                  }`}
                >
                  (
                  {forecastData.trend === 'increasing'
                    ? '↑ בעלייה'
                    : forecastData.trend === 'decreasing'
                      ? '↓ בירידה'
                      : '→ יציב'}
                  )
                </span>
              </div>
              <div className="text-white/30">
                {Math.round(forecastData.confidence * 100)}% ביטחון
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Legacy Volume Chart (for when no weekly data) */}
      {weeklyVolumes.length < 2 && recentVolume.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5"
        >
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[var(--cosmos-accent-primary)] rounded-full" />
            מגמת נפח (10 אימונים אחרונים)
          </h3>

          <div className="h-40 flex items-end justify-between gap-1.5 relative">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-t border-dashed border-white/5 w-full" />
              ))}
            </div>

            {recentVolume.map((point, i) => {
              const height = (point.volume / maxVolume) * 100;
              const isHovered = hoveredBar === i;
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{
                    delay: 0.3 + i * 0.05,
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                  }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className={`flex-1 rounded-t-lg min-w-[12px] relative transition-all duration-200 cursor-pointer ${
                    isHovered ? 'brightness-125' : ''
                  }`}
                  style={{
                    background: `linear-gradient(to top, var(--cosmos-accent-primary), var(--cosmos-accent-cyan))`,
                  }}
                >
                  <div
                    className={`absolute inset-0 rounded-t-lg bg-gradient-to-t from-[var(--cosmos-accent-primary)] to-[var(--cosmos-accent-cyan)] blur-md transition-opacity ${isHovered ? 'opacity-50' : 'opacity-0'}`}
                  />
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20"
                      >
                        <div className="bg-black/95 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg border border-white/10">
                          <div className="font-bold">{point.volume.toLocaleString()} ק״ג</div>
                          <div className="text-white/50 text-[8px]">{point.date}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-[9px] text-white/30">
            <span>עבר</span>
            <span>אחרון</span>
          </div>
        </motion.div>
      )}

      {/* Workout Calendar - Monthly Heatmap */}
      {sessions.length > 0 && <WorkoutCalendar sessions={sessions} />}

      {/* Forecast Chart - Progress Forecasting */}
      {sessions.length > 0 && <ForecastChart sessions={sessions} />}

      {/* Muscle Balance - Radar Chart */}
      {muscleBalanceData.length >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5"
        >
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
            איזון קבוצות שרירים
          </h3>

          <div className="flex gap-6 items-start">
            {/* Radar Chart */}
            <div className="flex-shrink-0">
              <MuscleRadarChart data={muscleBalanceData} size={180} maxDisplay={8} />
            </div>

            {/* Enhanced Legend with Trends */}
            <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
              {muscleBalanceData.slice(0, 6).map((muscle, i) => (
                <motion.div
                  key={muscle.muscle}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: muscle.isWeak
                        ? '#ef4444'
                        : muscle.trend === 'up'
                          ? '#22c55e'
                          : muscle.trend === 'down'
                            ? '#ef4444'
                            : '#fbbf24',
                    }}
                  />
                  <span className="text-xs text-white/70 flex-1 truncate group-hover:text-white transition-colors">
                    {muscle.muscle}
                  </span>
                  <div className="flex items-center gap-1">
                    {muscle.trend === 'up' && <span className="text-green-400 text-[9px]">↑</span>}
                    {muscle.trend === 'down' && <span className="text-red-400 text-[9px]">↓</span>}
                    <span className="text-xs font-bold text-white/90">{muscle.percentage}%</span>
                  </div>
                  {muscle.isWeak && (
                    <span className="text-[8px] text-red-400 bg-red-400/10 px-1 py-0.5 rounded">
                      מוזנח
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Legacy Muscle Group Distribution (fallback) */}
      {muscleBalanceData.length < 3 && muscleGroupData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-2xl p-5"
        >
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
            התפלגות קבוצות שרירים
          </h3>

          <div className="flex gap-6">
            {/* Pie Chart */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  let cumulativePercentage = 0;
                  return muscleGroupData.map((group, i) => {
                    const strokeDasharray = `${group.percentage * 2.51327} ${251.327 - group.percentage * 2.51327}`;
                    const strokeDashoffset = -cumulativePercentage * 2.51327;
                    cumulativePercentage += group.percentage;
                    return (
                      <motion.circle
                        key={group.muscle}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={getMuscleColor(group.muscle, i)}
                        strokeWidth="20"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="cursor-pointer hover:brightness-125 transition-all"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{muscleGroupData.length}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2">
              {muscleGroupData.slice(0, 5).map((group, i) => (
                <motion.div
                  key={group.muscle}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: getMuscleColor(group.muscle, i) }}
                  />
                  <span className="text-xs text-white/70 flex-1 truncate group-hover:text-white transition-colors">
                    {group.muscle}
                  </span>
                  <span className="text-xs font-bold text-white/90">{group.percentage}%</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Workout Calendar - Monthly Heatmap */}
      {sessions.length > 0 && <WorkoutCalendar sessions={sessions} />}

      {/* Forecast Chart - Progress Forecasting */}
      {sessions.length > 0 && <ForecastChart sessions={sessions} />}
    </div>
  );
};

export default React.memo(AnalyticsDashboard);
