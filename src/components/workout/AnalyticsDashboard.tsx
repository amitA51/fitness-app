// AnalyticsDashboard - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { type StreakInfo, calculateStreak } from '../../services/achievementService';
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
import ForecastChart from './ForecastChart';
import WorkoutCalendar from './WorkoutCalendar';
import MuscleRadarChart from './components/MuscleRadarChart';
import TrendLineOverlay from './components/TrendLineOverlay';

const MUSCLE_COLORS: Record<string, string> = {
  חזה: 'var(--fs-warn)',
  גב: 'var(--fs-accent-2)',
  כתפיים: 'var(--fs-accent)',
  רגליים: 'var(--fs-accent)',
  ביצפס: 'var(--fs-signal)',
  טריצפס: 'var(--fs-accent-2)',
  אמות: 'var(--fs-steel)',
  בטן: 'var(--fs-warn)',
  Core: 'var(--fs-warn)',
  Chest: 'var(--fs-warn)',
  Back: 'var(--fs-accent-2)',
  Shoulders: 'var(--fs-accent)',
  Legs: 'var(--fs-accent)',
  Arms: 'var(--fs-signal)',
  Biceps: 'var(--fs-accent-2)',
  Triceps: 'var(--fs-steel)',
};

function getMuscleColor(muscle: string, index: number): string {
  return MUSCLE_COLORS[muscle] || `hsl(${(index * 60) % 360}, 70%, 60%)`;
}

/**
 * StatCard - Sport Annual Editorial Style
 */
const StatCard = memo(
  ({
    icon,
    label,
    value,
    sublabel,
    delay = 0,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sublabel: string;
    delay?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      style={{
        background: 'var(--fs-surface)',
        border: '2px solid var(--fs-primary)',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 32,
          color: 'var(--fs-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fs-muted)',
          letterSpacing: '0.08em',
          marginTop: 4,
        }}
      >
        {sublabel}
      </div>
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
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const loadAnalytics = async () => {
      const workoutSessions = await getWorkoutSessions();

      const volume = calculateVolumeHistory(workoutSessions);
      const avg = getAverageVolume(workoutSessions);
      const streak = calculateStreak(workoutSessions);
      const muscleGroups = calculateMuscleGroupDistribution(workoutSessions);

      const weekly = calculateWeeklyVolumes(workoutSessions, 12);
      const balance = calculateMuscleBalance(workoutSessions, 12);
      const forecast = forecastProgress(workoutSessions);

      setSessions(workoutSessions);
      setVolumeData(volume);
      setMuscleGroupData(muscleGroups);
      setAvgVolume(avg);
      setStreakInfo(streak);
      setWeeklyVolumes(weekly);
      setMuscleBalanceData(balance);
      setForecastData(forecast);
      setLoading(false);
    };
    loadAnalytics();
  }, []);

  const recentVolume = useMemo(() => volumeData.slice(-10), [volumeData]);
  const maxVolume = useMemo(
    () => Math.max(...recentVolume.map((d) => d.volume), 1),
    [recentVolume]
  );
  const maxWeeklyVolume = useMemo(
    () => Math.max(...weeklyVolumes.map((d) => d.totalVolume), 1),
    [weeklyVolumes]
  );

  const handleTrendPointHover = useCallback((idx: number | null) => {
    setHoveredTrendPoint(idx);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 256,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--fs-primary)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        marginRight: 8,
        paddingRight: 8,
        overflowY: 'auto',
        maxHeight: '60vh',
      }}
    >
      {/* Stats Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <StatCard
          icon={<span>·</span>}
          label="השבוע"
          value={streakInfo.workoutsThisWeek}
          sublabel="אימונים"
          delay={0}
        />
        <StatCard
          icon={<span>·</span>}
          label="נפח ממוצע"
          value={avgVolume.toLocaleString()}
          sublabel='ק"ג'
          delay={0.05}
        />
        <StatCard
          icon={<span>·</span>}
          label="סה״כ"
          value={volumeData.length}
          sublabel="אימונים"
          delay={0.1}
        />
      </div>

      {/* Enhanced Volume Chart with Trend Line */}
      {weeklyVolumes.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: 'var(--fs-accent)',
                }}
              />
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--fs-primary)',
                }}
              >
                מגמת נפח שבועית
              </h3>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fs-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 12,
                    height: 3,
                    background: 'var(--fs-accent)',
                  }}
                />
                <span>נפח</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 12,
                    height: 3,
                    background: 'var(--fs-primary)',
                  }}
                />
                <span>מגמה</span>
              </div>
            </div>
          </div>

          <div style={{ height: 192, position: 'relative' }}>
            {/* SVG Chart with Trend Line */}
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${weeklyVolumes.length * 60} 180`}
              preserveAspectRatio="xMidYMid meet"
              style={{ overflow: 'visible' }}
              role="img"
              aria-label="מגמת נפח שבועית"
            >
              <title>מגמת נפח שבועית</title>
              <desc>גרף עמודות המציג את הנפח הכולל לפי שבועות עם קו מגמה</desc>
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={`grid-${i}`}
                  x1="0"
                  y1={i * 45}
                  x2={weeklyVolumes.length * 60}
                  y2={i * 45}
                  stroke="var(--fs-surface-2)"
                  strokeWidth="1"
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
                      initial={shouldReduceMotion ? false : { height: 0, y: 170 }}
                      animate={{ height, y: 170 - height }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { delay: 0.2 + i * 0.05, type: 'spring', stiffness: 200, damping: 15 }
                      }
                      onMouseEnter={() => setHoveredTrendPoint(i)}
                      onMouseLeave={() => setHoveredTrendPoint(null)}
                      style={{
                        cursor: 'pointer',
                        fill: isHovered ? 'var(--fs-primary)' : 'var(--fs-accent)',
                      }}
                      role="img"
                      aria-label={`שבוע ${i + 1}: ${week.totalVolume.toLocaleString()} ק״ג`}
                    />

                    {/* Week Label */}
                    <text
                      x={barX + 20}
                      y={185}
                      textAnchor="middle"
                      fontSize={8}
                      fill="var(--fs-muted)"
                      fontFamily="var(--font-mono)"
                    >
                      {week.weekLabel.split('-W')[1] || week.weekLabel.slice(-2)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Enhanced Tooltip */}
            <AnimatePresence>
              {hoveredTrendPoint !== null && weeklyVolumes[hoveredTrendPoint] && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    zIndex: 20,
                    background: 'var(--fs-primary)',
                    padding: '8px 12px',
                    minWidth: 120,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 14,
                      color: 'var(--fs-accent)',
                      marginBottom: 4,
                    }}
                  >
                    {weeklyVolumes[hoveredTrendPoint].totalVolume.toLocaleString()} ק״ג
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: 'rgba(var(--text-on-navy-rgb),0.5)',
                      marginBottom: 4,
                    }}
                  >
                    שבוע {weeklyVolumes[hoveredTrendPoint].weekLabel}
                  </div>
                  {weeklyVolumes[hoveredTrendPoint].changeFromPrevious !== null && (
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color:
                          weeklyVolumes[hoveredTrendPoint].changeFromPrevious! >= 0
                            ? 'var(--fs-accent)'
                            : 'var(--fs-warn)',
                      }}
                    >
                      {weeklyVolumes[hoveredTrendPoint].changeFromPrevious! >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(weeklyVolumes[hoveredTrendPoint].changeFromPrevious!)}%
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: 'rgba(var(--text-on-navy-rgb),0.4)',
                      marginTop: 4,
                    }}
                  >
                    {weeklyVolumes[hoveredTrendPoint].sessionCount} אימונים
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Forecast Summary */}
          {forecastData && forecastData.predicted > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '2px solid var(--fs-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--fs-muted)' }}>חיזוי לשבוע הבא:</span>
                <span
                  style={{
                    color: 'var(--fs-primary)',
                    fontWeight: 700,
                  }}
                >
                  {forecastData.predicted.toLocaleString()} ק״ג
                </span>
                <span
                  style={{
                    color:
                      forecastData.trend === 'increasing'
                        ? 'var(--fs-accent)'
                        : forecastData.trend === 'decreasing'
                          ? 'var(--fs-warn)'
                          : 'var(--fs-muted)',
                  }}
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
              <span style={{ color: 'var(--fs-muted)' }}>
                {Math.round(forecastData.confidence * 100)}% ביטחון
              </span>
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
          style={{
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            padding: 20,
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--fs-primary)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: 'var(--fs-accent)',
              }}
            />
            מגמת נפח (10 אימונים אחרונים)
          </h3>

          <div
            style={{
              height: 160,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 6,
              position: 'relative',
            }}
          >
            {/* Grid Lines */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    borderTop: '1px dashed var(--fs-surface-2)',
                    width: '100%',
                  }}
                />
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
                  style={{
                    flex: 1,
                    minWidth: 12,
                    background: isHovered ? 'var(--fs-primary)' : 'var(--fs-accent)',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                    position: 'relative',
                  }}
                >
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: 8,
                          zIndex: 20,
                          background: 'var(--fs-primary)',
                          padding: '6px 10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 12,
                            color: 'var(--fs-accent)',
                          }}
                        >
                          {point.volume.toLocaleString()} ק״ג
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 8,
                            color: 'rgba(var(--text-on-navy-rgb),0.5)',
                          }}
                        >
                          {point.date}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
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
          style={{
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            padding: 20,
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--fs-primary)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: 'var(--fs-accent)',
              }}
            />
            איזון קבוצות שרירים
          </h3>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* Radar Chart */}
            <div style={{ flexShrink: 0 }}>
              <MuscleRadarChart data={muscleBalanceData} size={180} maxDisplay={8} />
            </div>

            {/* Enhanced Legend with Trends */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {muscleBalanceData.slice(0, 6).map((muscle, i) => (
                <motion.div
                  key={muscle.muscle}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: muscle.isWeak
                        ? 'var(--fs-warn)'
                        : muscle.trend === 'up'
                          ? 'var(--fs-accent)'
                          : muscle.trend === 'down'
                            ? 'var(--fs-warn)'
                            : 'var(--fs-accent)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--fs-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {muscle.muscle}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {muscle.trend === 'up' && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--fs-accent)',
                        }}
                      >
                        ↑
                      </span>
                    )}
                    {muscle.trend === 'down' && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--fs-warn)',
                        }}
                      >
                        ↓
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 12,
                        color: 'var(--fs-primary)',
                      }}
                    >
                      {muscle.percentage}%
                    </span>
                  </div>
                  {muscle.isWeak && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8,
                        color: 'var(--fs-warn)',
                        background: 'rgba(226,110,63,0.1)',
                        padding: '2px 6px',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
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
          style={{
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            padding: 20,
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--fs-primary)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: 'var(--fs-accent)',
              }}
            />
            התפלגות קבוצות שרירים
          </h3>

          <div style={{ display: 'flex', gap: 24 }}>
            {/* Pie Chart */}
            <div
              style={{
                position: 'relative',
                width: 128,
                height: 128,
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 100 100"
                style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
              >
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
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  });
                })()}
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 18,
                    color: 'var(--fs-primary)',
                  }}
                >
                  {muscleGroupData.length}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {muscleGroupData.slice(0, 5).map((group, i) => (
                <motion.div
                  key={group.muscle}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: getMuscleColor(group.muscle, i),
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--fs-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.muscle}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 12,
                      color: 'var(--fs-primary)',
                    }}
                  >
                    {group.percentage}%
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default React.memo(AnalyticsDashboard);
