// ============================================================================
// forecastSeries — pure series builder for ForecastChart.
// ============================================================================
// Fixes the original chart's scale bug: forecastProgress() predicts the next
// WEEK's volume, but the old chart appended that weekly prediction onto a
// PER-SESSION volume series (calculateStrengthProgression) — a ~2x distortion
// for exercises trained twice a week. Here the actual series is built from the
// same weekly buckets the forecast regression runs on, so the appended
// projection point is on an identical scale by construction.

import { type ForecastData, forecastProgress } from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';
import type { GlowAreaPoint } from '../charts/GlowAreaChart';

/** Minimum completed sessions containing the exercise before a forecast shows. */
export const MIN_SESSIONS_FOR_FORECAST = 3;

/** X-axis label for the appended projection point. */
export const FORECAST_POINT_LABEL = 'תחזית';

export interface ForecastSeries {
  /** Weekly actual volumes, plus the projected next week on the same scale. */
  points: GlowAreaPoint[];
  forecast: ForecastData | null;
  /** Completed sessions that include the selected exercise. */
  sessionCount: number;
  /** Whether the last point in `points` is the projection. */
  hasForecastPoint: boolean;
}

const EMPTY_SERIES: ForecastSeries = {
  points: [],
  forecast: null,
  sessionCount: 0,
  hasForecastPoint: false,
};

export function findExerciseId(sessions: WorkoutSession[], exerciseName: string): string | null {
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseName === exerciseName) {
        return exercise.exerciseId;
      }
    }
  }
  return null;
}

/** "2026-W07" → "W07" (compact LTR week label for the x-axis). */
function formatWeekLabel(isoWeek: string): string {
  const idx = isoWeek.indexOf('W');
  return idx >= 0 ? isoWeek.slice(idx) : isoWeek;
}

/**
 * Build the weekly volume series (+ projection point) for one exercise.
 * Returns an empty series with the real sessionCount when there is not enough
 * history, so the UI can render composed guidance ("X more sessions").
 */
export function buildForecastSeries(
  sessions: WorkoutSession[],
  exerciseName: string | null
): ForecastSeries {
  if (!exerciseName || sessions.length === 0) return EMPTY_SERIES;

  const exerciseId = findExerciseId(sessions, exerciseName);
  if (!exerciseId) return EMPTY_SERIES;

  const sessionCount = sessions.filter(
    (s) => s.status === 'completed' && s.exercises.some((e) => e.exerciseId === exerciseId)
  ).length;
  if (sessionCount < MIN_SESSIONS_FOR_FORECAST) {
    return { ...EMPTY_SERIES, sessionCount };
  }

  const forecast = forecastProgress(sessions, exerciseId);
  const points: GlowAreaPoint[] = forecast.dataPoints.map((dp) => ({
    x: formatWeekLabel(dp.week),
    y: dp.actual,
  }));

  // The regression needs ≥2 weekly buckets to be a projection rather than an
  // echo of the last value (forecastProgress returns confidence 0 below that).
  const hasForecastPoint = forecast.dataPoints.length >= 2 && forecast.predicted > 0;
  if (hasForecastPoint) {
    points.push({ x: FORECAST_POINT_LABEL, y: forecast.predicted });
  }

  return { points, forecast, sessionCount, hasForecastPoint };
}
