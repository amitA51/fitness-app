import React, { memo, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { WorkoutSession } from '../../types';
import { getAllExerciseNames, calculateStrengthProgression, forecastProgress } from '../../services/analyticsService';

interface ForecastChartProps {
  sessions: WorkoutSession[];
}

/**
 * ForecastChart - Shows exercise progress with forecasting
 */
const ForecastChart: React.FC<ForecastChartProps> = ({ sessions }) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  
  // Get all exercise names
  const exerciseNames = useMemo(() => {
    return getAllExerciseNames(sessions);
  }, [sessions]);

  // Get progression data for selected exercise
  const progressionData = useMemo(() => {
    if (!selectedExercise || sessions.length === 0) return null;
    
    // Find exercise ID
    const exerciseId = findExerciseId(sessions, selectedExercise);
    if (!exerciseId) return null;
    
    const progression = calculateStrengthProgression(sessions, exerciseId);
    const forecast = forecastProgress(sessions, exerciseId);
    
    return { progression, forecast };
  }, [selectedExercise, sessions]);

  // Calculate chart dimensions
  const chartWidth = 300;
  const chartHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };

  // Calculate points for line chart
  const chartPoints = useMemo(() => {
    if (!progressionData || progressionData.progression.length === 0) return [];
    
    const { progression } = progressionData;
    const volumes = progression.map(p => p.volume);
    const maxVolume = Math.max(...volumes, 1);
    
    return progression.map((point, i) => ({
      x: padding.left + (i / Math.max(progression.length - 1, 1)) * (chartWidth - padding.left - padding.right),
      y: chartHeight - padding.bottom - (point.volume / maxVolume) * (chartHeight - padding.top - padding.bottom),
      data: point,
    }));
  }, [progressionData, chartWidth, chartHeight]);

  // Calculate forecast point
  const forecastPoint = useMemo(() => {
    if (!progressionData || !progressionData.forecast || progressionData.forecast.predicted <= 0) return null;
    if (chartPoints.length === 0) return null;
    
    const volumes = progressionData.progression.map(p => p.volume);
    const maxVolume = Math.max(...volumes, 1);
    
    return {
      x: chartWidth - padding.right,
      y: chartHeight - padding.bottom - (progressionData.forecast.predicted / maxVolume) * (chartHeight - padding.top - padding.bottom),
    };
  }, [progressionData, chartPoints, chartWidth, chartHeight]);

  // Build SVG path
  const linePath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    
    return chartPoints.map((point, i) => 
      `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ');
  }, [chartPoints]);

  // Build area path
  const areaPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    
    const bottomY = chartHeight - padding.bottom;
    return `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${bottomY} L ${chartPoints[0].x} ${bottomY} Z`;
  }, [linePath, chartPoints, chartHeight, padding]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="workout-glass-card rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          חיזוי התקדמות לפי תרגיל
        </h3>
      </div>

      {/* Exercise Selector */}
      <div className="mb-4">
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:border-[var(--cosmos-accent-primary)]"
        >
          <option value="" className="bg-[#1a1a1a]">בחר תרגיל...</option>
          {exerciseNames.map((name) => (
            <option key={name} value={name} className="bg-[#1a1a1a]">
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      {selectedExercise && progressionData && chartPoints.length > 0 && (
        <div className="relative">
          <svg width={chartWidth} height={chartHeight} className="overflow-visible">
            {/* Grid lines */}
            {[0, 0.5, 1].map((level, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={padding.top + level * (chartHeight - padding.top - padding.bottom)}
                x2={chartWidth - padding.right}
                y2={padding.top + level * (chartHeight - padding.top - padding.bottom)}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area fill */}
            <motion.path
              d={areaPath}
              fill="url(#forecastGradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 0.5 }}
            />

            {/* Line */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
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
                r={4}
                fill="var(--cosmos-accent-primary)"
                stroke="white"
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
                  stroke="rgba(251, 191, 36, 0.5)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <motion.circle
                  cx={forecastPoint.x}
                  cy={forecastPoint.y}
                  r={6}
                  fill="rgba(251, 191, 36, 0.3)"
                  stroke="#fbbf24"
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
                <stop offset="0%" stopColor="var(--cosmos-accent-primary)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--cosmos-accent-primary)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--cosmos-accent-primary)" />
                <stop offset="100%" stopColor="var(--cosmos-accent-cyan)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Forecast info */}
          {progressionData.forecast && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-white/40">חיזוי:</span>
                <span className="text-yellow-400 font-medium">
                  {progressionData.forecast.predicted.toLocaleString()} ק״ג
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`${
                  progressionData.forecast.trend === 'increasing' ? 'text-green-400' :
                  progressionData.forecast.trend === 'decreasing' ? 'text-red-400' : 'text-white/40'
                }`}>
                  {progressionData.forecast.trend === 'increasing' ? '↑ בעלייה' :
                   progressionData.forecast.trend === 'decreasing' ? '↓ בירידה' : '→ יציב'}
                </span>
                <span className="text-white/30">
                  {Math.round(progressionData.forecast.confidence * 100)}% ביטחון
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedExercise && (!progressionData || chartPoints.length === 0) && (
        <div className="text-center py-8 text-white/40 text-sm">
          אין מספיק נתונים לתרגיל זה
        </div>
      )}
    </motion.div>
  );
};

// Helper function to find exercise ID by name
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