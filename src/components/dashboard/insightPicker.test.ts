// ============================================================================
// insightPicker — priority + threshold logic for the dashboard insight card.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type { MuscleGroupLastTrained, ProgressDelta } from '../../services/analyticsService';
import {
  MIN_PROGRESSION_PCT,
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

const base = {
  weekOverWeekDeltas: [],
  muscleGroups: [],
};

describe('pickDashboardInsight', () => {
  it('returns null when nothing crosses a threshold', () => {
    expect(pickDashboardInsight(base)).toBeNull();
    expect(
      pickDashboardInsight({
        ...base,
        weekOverWeekDeltas: [delta('Bench Press', 1000, 950, MIN_PROGRESSION_PCT - 1)],
        muscleGroups: [muscle('Shoulders', NEGLECT_MIN_DAYS - 1)],
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

  it('never surfaces a streak insight (it would duplicate WorkoutStreak)', () => {
    // A long streak is not an input at all any more: only progression and
    // neglect can fill the slot, so a streak alone yields nothing.
    expect(pickDashboardInsight(base)).toBeNull();
  });

  it('returns null instead of a this-month consistency affirmation', () => {
    // A month count is already on the page; restating it under the label
    // "תובנה" was an always-fillable placeholder, not an insight.
    expect(pickDashboardInsight({ ...base, muscleGroups: [muscle('Arms', 1)] })).toBeNull();
  });

  it('returns null instead of affirming a balanced split', () => {
    // Three muscles trained recently: below the neglect window, so nothing
    // qualifies and the slot stays dark.
    const recent = NEGLECT_MIN_DAYS - 1;
    const result = pickDashboardInsight({
      ...base,
      muscleGroups: [muscle('Shoulders', recent), muscle('Arms', recent), muscle('Core', recent)],
    });
    expect(result).toBeNull();
  });

  it('returns null when there are no workouts at all', () => {
    expect(pickDashboardInsight(base)).toBeNull();
  });

  it('prefers progression over a neglected muscle when both qualify', () => {
    const result = pickDashboardInsight({
      weekOverWeekDeltas: [delta('Row', 1200, 1000, 20)],
      muscleGroups: [muscle('Legs', NEGLECT_MIN_DAYS + 5)],
    });
    expect(result).toEqual({ kind: 'progression', exerciseName: 'Row', changePct: 20 });
  });
});
