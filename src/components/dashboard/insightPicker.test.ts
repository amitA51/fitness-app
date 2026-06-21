// ============================================================================
// insightPicker — priority + threshold logic for the dashboard insight card.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { MuscleGroupLastTrained, ProgressDelta } from '../../services/analyticsService';
import {
  BALANCED_SPLIT_MIN_MUSCLES,
  MIN_PROGRESSION_PCT,
  MIN_STREAK_DAYS,
  NEGLECT_MAX_DAYS,
  NEGLECT_MIN_DAYS,
  pickDashboardInsight,
} from './insightPicker';

const delta = (
  exerciseName: string,
  currentVolume: number,
  previousVolume: number,
  change: number
): ProgressDelta => ({
  exerciseName,
  exerciseId: exerciseName.toLowerCase(),
  currentVolume,
  previousVolume,
  change,
});

const muscle = (name: string, daysSince: number): MuscleGroupLastTrained => ({
  muscle: name,
  lastDate: '2026-01-01',
  daysSince,
});

// Zero-data baseline: no workouts ever, so the fallback tier stays off and the
// existing threshold-miss cases still resolve to null. Tiered tests override.
const base = {
  weekOverWeekDeltas: [],
  muscleGroups: [],
  currentStreak: 0,
  workoutsThisMonth: 0,
  totalWorkouts: 0,
};

describe('pickDashboardInsight', () => {
  it('returns null when nothing crosses a threshold', () => {
    expect(pickDashboardInsight(base)).toBeNull();
    expect(
      pickDashboardInsight({
        ...base,
        weekOverWeekDeltas: [delta('Bench Press', 1000, 950, MIN_PROGRESSION_PCT - 1)],
        muscleGroups: [muscle('Shoulders', NEGLECT_MIN_DAYS - 1)],
        currentStreak: MIN_STREAK_DAYS - 1,
      })
    ).toBeNull();
  });

  it('picks the HIGHEST qualifying progression first, over everything else', () => {
    const result = pickDashboardInsight({
      ...base,
      weekOverWeekDeltas: [
        delta('Bench Press', 1100, 1000, 10),
        delta('Squat', 1500, 1200, 25),
        delta('Deadlift', 900, 800, 12),
      ],
      muscleGroups: [muscle('Shoulders', 10)],
      currentStreak: 5,
    });
    expect(result).toEqual({ kind: 'progression', exerciseName: 'Squat', changePct: 25 });
  });

  it('ignores progression without volume in BOTH weeks (first appearance is not a trend)', () => {
    const result = pickDashboardInsight({
      ...base,
      weekOverWeekDeltas: [
        delta('New Exercise', 1000, 0, 0), // previousVolume 0
        delta('Dropped Exercise', 0, 1000, -100), // currentVolume 0
      ],
    });
    expect(result).toBeNull();
  });

  it('falls back to the most-neglected NON-major muscle', () => {
    const result = pickDashboardInsight({
      ...base,
      muscleGroups: [muscle('Shoulders', 9), muscle('Arms', 14), muscle('Core', 8)],
      currentStreak: 5,
    });
    expect(result).toEqual({ kind: 'neglected', muscle: 'Arms', daysSince: 14 });
  });

  it('surfaces a neglected MAJOR muscle (no ForecastNudge to defer to)', () => {
    const result = pickDashboardInsight({
      ...base,
      muscleGroups: [muscle('Chest', 12), muscle('Back', 20), muscle('Legs', 9)],
    });
    expect(result).toEqual({ kind: 'neglected', muscle: 'Back', daysSince: 20 });
  });

  it('ignores stale neglect beyond the max window', () => {
    const result = pickDashboardInsight({
      ...base,
      muscleGroups: [muscle('Shoulders', NEGLECT_MAX_DAYS + 1)],
    });
    expect(result).toBeNull();
  });

  it('falls back to the streak nudge last', () => {
    const result = pickDashboardInsight({
      ...base,
      totalWorkouts: 10,
      currentStreak: MIN_STREAK_DAYS,
    });
    expect(result).toEqual({ kind: 'streak', days: MIN_STREAK_DAYS });
  });

  it('stays null on true zero-data (no workouts ever)', () => {
    expect(pickDashboardInsight({ ...base, totalWorkouts: 0, workoutsThisMonth: 0 })).toBeNull();
  });

  it('fills the slot with this-month consistency when all thresholds miss', () => {
    const result = pickDashboardInsight({ ...base, totalWorkouts: 8, workoutsThisMonth: 5 });
    expect(result).toEqual({ kind: 'consistency', workoutsThisMonth: 5 });
  });

  it('affirms a balanced split when no workouts this month but a recent spread exists', () => {
    // Muscles trained recently (below the neglect window) so tier-2 stays off,
    // yet still count toward the balanced spread (within NEGLECT_MAX_DAYS).
    const recent = NEGLECT_MIN_DAYS - 1;
    const result = pickDashboardInsight({
      ...base,
      totalWorkouts: 12,
      workoutsThisMonth: 0,
      muscleGroups: [muscle('Shoulders', recent), muscle('Arms', recent), muscle('Core', recent)],
    });
    expect(result).toEqual({ kind: 'balanced', muscleCount: BALANCED_SPLIT_MIN_MUSCLES });
  });

  it('falls back to lifetime consistency when month is empty and split is thin', () => {
    const result = pickDashboardInsight({
      ...base,
      totalWorkouts: 3,
      workoutsThisMonth: 0,
      // Single recently-trained muscle: too few for a balanced split, not stale
      // enough to be neglected.
      muscleGroups: [muscle('Arms', NEGLECT_MIN_DAYS - 1)],
    });
    expect(result).toEqual({ kind: 'consistency', workoutsThisMonth: 0 });
  });
});
