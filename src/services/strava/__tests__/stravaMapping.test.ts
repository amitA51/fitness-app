import { describe, expect, it } from 'vitest';
import { cardioEffortOf, isCardioSession } from '../../../utils/cardio';
import {
  type StravaActivityDetail,
  type StravaActivitySummary,
  activityForStrava,
  decodePolyline,
  pendingStravaDetailId,
  splitsFromStrava,
  stravaSessionFrom,
  withStravaDetail,
} from '../stravaMapping';

const NOW = Date.UTC(2026, 9, 21, 12, 0);

const summary = (over: Partial<StravaActivitySummary> = {}): StravaActivitySummary => ({
  id: 12_345_678_901,
  sessionId: '5d1b7c2e-0f3a-5b11-8c22-0123456789ab',
  name: 'ריצת בוקר',
  sportType: 'Run',
  startDate: '2026-10-20T04:30:00Z',
  startEpoch: Date.UTC(2026, 9, 20, 4, 30) / 1000,
  distanceM: 10_050,
  movingSec: 3000,
  elapsedSec: 3120,
  elevationGainM: 42,
  avgHr: 151.4,
  maxHr: 172,
  trainer: false,
  workoutType: null,
  kilojoules: null,
  // Google's documented example: (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
  polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
  ...over,
});

const detail = (over: Partial<StravaActivityDetail> = {}): StravaActivityDetail => ({
  id: 12_345_678_901,
  calories: 702,
  splits: [
    { distanceM: 1001.2, movingSec: 300, elapsedSec: 305, avgHr: 140 },
    { distanceM: 998.9, movingSec: 296, elapsedSec: 296, avgHr: 150 },
    { distanceM: 50, movingSec: 14, elapsedSec: 14, avgHr: 155 },
  ],
  ...over,
});

describe('activityForStrava', () => {
  it('maps Strava sports onto the app activities', () => {
    expect(activityForStrava({ sportType: 'Run', trainer: false })).toBe('run');
    expect(activityForStrava({ sportType: 'TrailRun', trainer: false })).toBe('run');
    expect(activityForStrava({ sportType: 'Ride', trainer: false })).toBe('cycle');
    expect(activityForStrava({ sportType: 'VirtualRide', trainer: false })).toBe('indoor_cycle');
    expect(activityForStrava({ sportType: 'Swim', trainer: false })).toBe('swim');
    expect(activityForStrava({ sportType: 'Hike', trainer: false })).toBe('hike');
  });

  it('turns an indoor run or ride into the treadmill or the bike', () => {
    expect(activityForStrava({ sportType: 'Run', trainer: true })).toBe('treadmill');
    expect(activityForStrava({ sportType: 'Ride', trainer: true })).toBe('indoor_cycle');
  });

  it('skips strength, yoga and the generic watch workout', () => {
    expect(activityForStrava({ sportType: 'WeightTraining', trainer: false })).toBeNull();
    expect(activityForStrava({ sportType: 'Yoga', trainer: false })).toBeNull();
    expect(activityForStrava({ sportType: 'Workout', trainer: false })).toBeNull();
    expect(activityForStrava({ sportType: '', trainer: false })).toBeNull();
  });
});

describe('decodePolyline', () => {
  it("decodes Google's reference example", () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('stops cleanly on a truncated string', () => {
    expect(decodePolyline('_p~iF~ps|U_ulL')).toEqual([[38.5, -120.2]]);
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('splitsFromStrava', () => {
  it('rounds near-1000 m splits to an exact km and keeps the partial last one', () => {
    expect(splitsFromStrava('run', detail().splits)).toEqual([
      { index: 1, distanceKm: 1, seconds: 300, avgHr: 140 },
      { index: 2, distanceKm: 1, seconds: 296, avgHr: 150 },
      { index: 3, distanceKm: 0.05, seconds: 14, avgHr: 155 },
    ]);
  });

  it('gives no km splits for a ride or a swim', () => {
    expect(splitsFromStrava('cycle', detail().splits)).toEqual([]);
    expect(splitsFromStrava('swim', detail().splits)).toEqual([]);
  });

  it('drops empty splits and falls back to elapsed time', () => {
    const out = splitsFromStrava('run', [
      { distanceM: 0, movingSec: 10, elapsedSec: 10, avgHr: null },
      { distanceM: 1000, movingSec: 0, elapsedSec: 320, avgHr: null },
      { distanceM: 400, movingSec: 120, elapsedSec: 120, avgHr: null },
    ]);
    expect(out).toEqual([
      { index: 1, distanceKm: 1, seconds: 320 },
      { index: 2, distanceKm: 0.4, seconds: 120 },
    ]);
  });
});

describe('stravaSessionFrom', () => {
  it('builds a completed cardio session from the list alone', () => {
    const s = stravaSessionFrom(summary(), null, 75, NOW);
    expect(s).not.toBeNull();
    if (!s) return;
    // The id the edge function minted — the same on every device.
    expect(s.id).toBe('5d1b7c2e-0f3a-5b11-8c22-0123456789ab');
    expect(s.status).toBe('completed');
    expect(s.startTime).toBe('2026-10-20T04:30:00.000Z');
    // Wall clock: start + elapsed (pauses included); duration: moving time.
    expect(s.endTime).toBe('2026-10-20T05:22:00.000Z');
    expect(s.duration).toBe(3000);
    expect(s.notes).toBe('ריצת בוקר');
    expect(isCardioSession(s)).toBe(true);

    const ex = s.exercises[0];
    expect(ex?.cardioActivity).toBe('run');
    expect(ex?.external).toEqual({
      provider: 'strava',
      activityId: 12_345_678_901,
      detailed: false,
    });
    expect(ex?.route?.source).toBe('strava');
    expect(ex?.route?.points).toHaveLength(3);

    const effort = ex ? cardioEffortOf(ex) : null;
    expect(effort?.distanceKm).toBeCloseTo(10.05);
    expect(effort?.avgHr).toBe(151);
    expect(effort?.maxHr).toBe(172);
    expect(effort?.elevationGainM).toBe(42);
    // No Strava calories yet → the app's MET estimate.
    expect(s.caloriesBurned).toBeGreaterThan(0);
  });

  it('uses the detail for calories and splits, and marks it detailed', () => {
    const s = stravaSessionFrom(summary(), detail(), 75, NOW);
    const set = s?.exercises[0]?.sets[0];
    expect(set?.calories).toBe(702);
    expect(set?.splits).toHaveLength(3);
    expect(s?.caloriesBurned).toBe(702);
    expect(s?.exercises[0]?.external?.detailed).toBe(true);
  });

  it('reads race and long-run flags as run types', () => {
    expect(
      stravaSessionFrom(summary({ workoutType: 1 }), null, 75, NOW)?.exercises[0]?.runType
    ).toBe('race');
    expect(
      stravaSessionFrom(summary({ workoutType: 2 }), null, 75, NOW)?.exercises[0]?.runType
    ).toBe('long');
    expect(
      stravaSessionFrom(summary({ workoutType: 3 }), null, 75, NOW)?.exercises[0]?.runType
    ).toBeUndefined();
  });

  it("takes a ride's work in kJ as its calories when Strava gave none", () => {
    const s = stravaSessionFrom(
      summary({ sportType: 'Ride', kilojoules: 640, polyline: null }),
      null,
      75,
      NOW
    );
    expect(s?.exercises[0]?.cardioActivity).toBe('cycle');
    expect(s?.exercises[0]?.sets[0]?.calories).toBe(640);
    expect(s?.exercises[0]?.route).toBeUndefined();
  });

  it('skips sports the app does not track and activities with no time', () => {
    expect(stravaSessionFrom(summary({ sportType: 'WeightTraining' }), null, 75, NOW)).toBeNull();
    expect(stravaSessionFrom(summary({ movingSec: 0, elapsedSec: 0 }), null, 75, NOW)).toBeNull();
  });
});

describe('withStravaDetail / pendingStravaDetailId', () => {
  it('folds the detail into a session imported without it', () => {
    const s = stravaSessionFrom(summary(), null, 75, NOW);
    if (!s) throw new Error('expected a session');
    expect(pendingStravaDetailId(s)).toBe(12_345_678_901);

    const next = withStravaDetail(s, detail(), NOW + 1000);
    expect(pendingStravaDetailId(next)).toBeNull();
    expect(next.caloriesBurned).toBe(702);
    expect(next.exercises[0]?.sets[0]?.splits).toHaveLength(3);
    expect(next.updatedAt).toBe(new Date(NOW + 1000).toISOString());
    // The original is untouched.
    expect(pendingStravaDetailId(s)).toBe(12_345_678_901);
  });

  it('marks a vanished activity detailed so it is not asked for again', () => {
    const s = stravaSessionFrom(summary(), null, 75, NOW);
    if (!s) throw new Error('expected a session');
    const next = withStravaDetail(s, {
      id: 12_345_678_901,
      calories: null,
      splits: [],
      missing: true,
    });
    expect(pendingStravaDetailId(next)).toBeNull();
    expect(next.caloriesBurned).toBe(s.caloriesBurned);
    expect(next.exercises[0]?.sets[0]?.splits).toBeUndefined();
  });

  it('leaves app-recorded sessions alone', () => {
    const s = stravaSessionFrom(summary(), null, 75, NOW);
    if (!s) throw new Error('expected a session');
    const own = { ...s, exercises: s.exercises.map(({ external: _e, ...ex }) => ex) };
    expect(pendingStravaDetailId(own)).toBeNull();
  });
});
