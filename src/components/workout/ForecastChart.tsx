// ForecastChart - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import {
  calculateStrengthProgression,
  forecastProgress,
  getAllExerciseNames,
} from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';

interface ForecastChartProps {
  sessions: WorkoutSession[];
}

const ForecastChart: React.FC<ForecastChartProps> = ({ sessions }) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const exerciseNames = useMemo(() => {
    return getAllExerciseNames(sessions);
  }, [sessions]);

  const progressionData = useMemo(() => {
    if (!selectedExercise || sessions.length === 0) return null;

    const exerciseId = findExerciseId(sessions, selectedExercise);
    if (!exerciseId) return null;

    const progression = calculateStrengthProgression(sessions, exerciseId);
    const forecast = forecastProgress(sessions, exerciseId);

    return { progression, forecast };
  }, [selectedExercise, sessions]);

  const chartWidth = 300;
  const chartHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };

  const chartPoints = useMemo(() => {
    if (!progressionData || progressionData.progression.length === 0) return [];

    const { progression } = progressionData;
    const volumes = progression.map((p) => p.volume);
    const maxVolume = Math.max(...volumes, 1);

    return progression.map((point, i) => ({
      x: padding.left + (i / Math.max(progression.length - 1, 1)) * (chartWidth - padding.left - padding.right),
      y: chartHeight - padding.bottom - (point.volume / maxVolume) * (chartHeight - padding.top - padding.bottom),
      data: point,
    }));
  }, [progressionData, chartWidth, chartHeight]);

  const forecastPoint = useMemo(() => {
    if (!progressionData || !progressionData.forecast || progressionData.forecast.predicted <= 0)
      return null;
    if (chartPoints.length === 0) return null;

    const volumes = progressionData.progression.map((p) => p.volume);
    const maxVolume = Math.max(...volumes, 1);

    return {
      x: chartWidth - padding.right,
      y: chartHeight - padding.bottom - (progressionData.forecast.predicted / maxVolume) * (chartHeight - padding.top - padding.bottom),
    };
  }, [progressionData, chartPoints, chartWidth, chartHeight]);

  const linePath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    return chartPoints.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const lastPoint = chartPoints[chartPoints.length - 1];
    const firstPoint = chartPoints[0];
    if (!lastPoint || !firstPoint) return '';
    const bottomY = chartHeight - padding.bottom;
    return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
  }, [linePath, chartPoints, chartHeight, padding]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      style={{
        background: 'var(--bone)',
        border: '2px solid var(--navy)',
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
              background: 'var(--mustard)',
            }}
          />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--navy)',
            }}
          >
            חיזוי התקדמות לפי תרגיל
          </h3>
        </div>
      </div>

      {/* Exercise Selector */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bone-deep)',
            border: '2px solid var(--navy)',
            padding: '12px 16px',
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            color: 'var(--navy)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230b293b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left 12px center',
            paddingLeft: 36,
          }}
        >
          <option value="" style={{ background: '#FFFFFF' }}>
            בחר תרגיל...
          </option>
          {exerciseNames.map((name) => (
            <option key={name} value={name} style={{ background: '#FFFFFF' }}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      {selectedExercise && progressionData && chartPoints.length > 0 && (
        <div style={{ position: 'relative' }}>
          <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0, 0.5, 1].map((level, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={padding.top + level * (chartHeight - padding.top - padding.bottom)}
                x2={chartWidth - padding.right}
                y2={padding.top + level * (chartHeight - padding.top - padding.bottom)}
                stroke="var(--bone-deep)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area fill */}
            <motion.path
              d={areaPath}
              fill="url(#forecastGradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ duration: 0.5 }}
            />

            {/* Line */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="var(--navy)"
              strokeWidth={3}
              strokeLinecap="square"
              strokeLinejoin="miter"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            {/* Data points */}
            {chartPoints.map((point, i) => (
              <motion.circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={5}
                fill="var(--mustard)"
                stroke="var(--navy)"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 200 }}
              />
            ))}

            {/* Forecast point */}
            {forecastPoint && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <line
                  x1={chartPoints[chartPoints.length - 1]?.x || 0}
                  y1={chartPoints[chartPoints.length - 1]?.y || 0}
                  x2={forecastPoint.x}
                  y2={forecastPoint.y}
                  stroke="var(--mustard)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <motion.circle
                  cx={forecastPoint.x}
                  cy={forecastPoint.y}
                  r={6}
                  fill="var(--mustard)"
                  stroke="var(--navy)"
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.9, type: 'spring', stiffness: 200 }}
                />
              </motion.g>
            )}

            {/* Gradients */}
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--mustard)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--mustard)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Forecast info */}
          {progressionData.forecast && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '2px solid var(--bone-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--stone)' }}>חיזוי:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: 'var(--navy)',
                  }}
                >
                  {progressionData.forecast.predicted.toLocaleString()} ק״ג
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    color:
                      progressionData.forecast.trend === 'increasing'
                        ? '#22c55e'
                        : progressionData.forecast.trend === 'decreasing'
                          ? '#ef4444'
                          : 'var(--stone)',
                  }}
                >
                  {progressionData.forecast.trend === 'increasing'
                    ? '↑ בעלייה'
                    : progressionData.forecast.trend === 'decreasing'
                      ? '↓ בירידה'
                      : '→ יציב'}
                </span>
                <span style={{ color: 'var(--stone)' }}>
                  {Math.round(progressionData.forecast.confidence * 100)}% ביטחון
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedExercise && (!progressionData || chartPoints.length === 0) && (
        <div
          style={{
            textAlign: 'center',
            paddingTop: 32,
            paddingBottom: 32,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--stone)',
          }}
        >
          אין מספיק נתונים לתרגיל זה
        </div>
      )}
    </motion.div>
  );
};

function findExerciseId(sessions: WorkoutSession[], exerciseName: string): string | null {
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseName === exerciseName) {
        return exercise.exerciseId;
      }
    }
  }
  return null;
}

export default memo(ForecastChart);
