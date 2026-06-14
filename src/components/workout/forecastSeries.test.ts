// ============================================================================
// forecastSeries — pins the weekly-scale handling of the forecast chart.
// ============================================================================
// Regression guard for the original ForecastChart bug: the WEEKLY predicted
// volume from forecastProgress was appended onto a PER-SESSION series (~2x
// distortion for exercises trained twice a week). The series must be weekly
// on both sides.

import { describe, expect, it } from 'vitest';
import { forecastProgress } from '../../services/analyticsService';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import {
  FORECAST_POINT_LABEL,
  MIN_SESSIONS_FOR_FORECAST,
  buildForecastSeries,
} from './forecastSeries';

const set = (id: string, weight: number, reps: number): WorkoutSet => ({
  id,
  setNumber: 1,
  reps,
  weight,
  rpe: 8,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-01-01T10:00:00.000Z',
});

const mkSession = (id: string, date: string, sets: WorkoutSet[]): WorkoutSession => {
  const exercise: WorkoutExercise = {
    id: `w-${id}`,
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    targetMuscle: 'Chest',
    sets,
    notes: '',
    restSeconds: 120,
    isCompleted: true,
    order: 0,
  };
  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [exercise],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

describe('buildForecastSeries — weekly scale (the 2x-distortion fix)', () => {
  it('sums same-week sessions into ONE weekly point, not per-session points', () => {
    // Exercise trained 2x/week for 3 weeks (ISO weeks W02, W03, W04 of 2026).
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 5)]), // W02: 500
      mkSession('s2', '2026-01-07', [set('b', 100, 5)]), // W02: 500 → week 1000
      mkSession('s3', '2026-01-12', [set('c', 110, 5)]), // W03: 550
      mkSession('s4', '2026-01-14', [set('d', 110, 5)]), // W03: 550 → week 1100
      mkSession('s5', '2026-01-19', [set('e', 120, 5)]), // W04: 600
      mkSession('s6', '2026-01-21', [set('f', 120, 5)]), // W04: 600 → week 1200
    ];

    const series = buildForecastSeries(sessions, 'Bench Press');

    // 3 weekly actuals + 1 forecast point — NOT 6 per-session points.
    expect(series.points).toHaveLength(4);
    expect(series.points.slice(0, 3).map((p) => p.y)).toEqual([1000, 1100, 1200]);
    expect(series.points[0]!.x).toBe('W02');
    expect(series.hasForecastPoint).toBe(true);
  });

  it('appends the weekly prediction itself, on the same weekly scale', () => {
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 5)]),
      mkSession('s2', '2026-01-07', [set('b', 100, 5)]),
      mkSession('s3', '2026-01-12', [set('c', 110, 5)]),
      mkSession('s4', '2026-01-14', [set('d', 110, 5)]),
      mkSession('s5', '2026-01-19', [set('e', 120, 5)]),
      mkSession('s6', '2026-01-21', [set('f', 120, 5)]),
    ];

    const series = buildForecastSeries(sessions, 'Bench Press');
    const forecast = forecastProgress(sessions, 'bench');
    const last = series.points[series.points.length - 1]!;

    expect(last.x).toBe(FORECAST_POINT_LABEL);
    expect(last.y).toBe(forecast.predicted);
    // Linear trend 1000→1100→1200 predicts the next WEEK at ~1300 — comparable
    // to the weekly actuals, not the ~600 per-session values.
    expect(last.y).toBe(1300);
  });

  it('returns an empty series (with real sessionCount) below the session minimum', () => {
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 5)]),
      mkSession('s2', '2026-01-12', [set('b', 100, 5)]),
    ];
    const series = buildForecastSeries(sessions, 'Bench Press');
    expect(series.sessionCount).toBe(MIN_SESSIONS_FOR_FORECAST - 1);
    expect(series.points).toHaveLength(0);
    expect(series.forecast).toBeNull();
  });

  it('does not append a forecast point with fewer than 2 weekly buckets', () => {
    // 3 sessions, all inside ONE ISO week → regression has nothing to project.
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 5)]),
      mkSession('s2', '2026-01-06', [set('b', 100, 5)]),
      mkSession('s3', '2026-01-07', [set('c', 100, 5)]),
    ];
    const series = buildForecastSeries(sessions, 'Bench Press');
    expect(series.hasForecastPoint).toBe(false);
    expect(series.points).toHaveLength(1);
  });

  it('returns an empty series for an unknown exercise or no selection', () => {
    const sessions = [mkSession('s1', '2026-01-05', [set('a', 100, 5)])];
    expect(buildForecastSeries(sessions, 'Squat').points).toHaveLength(0);
    expect(buildForecastSeries(sessions, null).points).toHaveLength(0);
    expect(buildForecastSeries([], 'Bench Press').points).toHaveLength(0);
  });
});
