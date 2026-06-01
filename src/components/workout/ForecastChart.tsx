// ForecastChart - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { m } from 'framer-motion';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import {
  calculateStrengthProgression,
  forecastProgress,
  getAllExerciseNames,
} from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';
import { GlowAreaChart, type GlowAreaPoint } from '../charts';

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

  const forecastData = useMemo<GlowAreaPoint[]>(() => {
    if (!progressionData || progressionData.progression.length === 0) return [];
    const points: GlowAreaPoint[] = progressionData.progression.map((p) => ({
      x: formatShortDate(p.date),
      y: p.volume,
    }));
    if (progressionData.forecast && progressionData.forecast.predicted > 0 && points.length > 0) {
      points.push({ x: 'תחזית', y: progressionData.forecast.predicted });
    }
    return points;
  }, [progressionData]);

  const hasChartData = forecastData.length >= 2;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="magnetic-card"
      style={{
        background: 'var(--fs-bg)',
        border: '2px solid var(--fs-primary)',
        padding: 20,
        borderRadius: '22px 16px 22px 16px',
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
              color: 'var(--fs-heading)',
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
            background: 'var(--fs-surface-2)',
            border: '2px solid var(--fs-primary)',
            padding: '12px 16px',
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            color: 'var(--fs-heading)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230b293b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left 12px center',
            paddingLeft: 36,
          }}
        >
          <option value="" style={{ background: 'var(--fs-surface)' }}>
            בחר תרגיל...
          </option>
          {exerciseNames.map((name) => (
            <option key={name} value={name} style={{ background: 'var(--fs-surface)' }}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      {selectedExercise && progressionData && hasChartData && (
        <div style={{ position: 'relative' }}>
          <GlowAreaChart
            data={forecastData}
            accent="var(--fs-accent)"
            accent2="var(--fs-accent-2)"
            xAxis
            ariaLabel={`תחזית התקדמות עבור ${selectedExercise}`}
          />

          {/* Forecast info */}
          {progressionData.forecast && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '2px solid var(--fs-surface-2)',
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
                <span style={{ color: 'var(--fs-muted)' }}>חיזוי:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: 'var(--fs-heading)',
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
                          : 'var(--fs-muted)',
                  }}
                >
                  {progressionData.forecast.trend === 'increasing'
                    ? '↑ בעלייה'
                    : progressionData.forecast.trend === 'decreasing'
                      ? '↓ בירידה'
                      : '→ יציב'}
                </span>
                <span style={{ color: 'var(--fs-muted)' }}>
                  {Math.round(progressionData.forecast.confidence * 100)}% ביטחון
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedExercise && (!progressionData || !hasChartData) && (
        <div
          style={{
            textAlign: 'center',
            paddingTop: 32,
            paddingBottom: 32,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
          }}
        >
          אין מספיק נתונים לתרגיל זה
        </div>
      )}
    </m.div>
  );
};

function formatShortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

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
