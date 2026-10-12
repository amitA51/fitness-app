import { describe, expect, it } from 'vitest';
import {
  EMPTY_TRACK,
  type GeoFix,
  type TrackState,
  applyFix,
  finalSplit,
  haversineM,
  rollingPaceSecPerKm,
  simplifyRoute,
} from '../geo';

/** ~1 m of latitude in degrees. */
const M = 1 / 111_195;

const fix = (northM: number, t: number, overrides: Partial<GeoFix> = {}): GeoFix => ({
  lat: 32 + northM * M,
  lng: 34.8,
  accuracy: 5,
  altitude: null,
  t,
  ...overrides,
});

/** Feed fixes 10 m apart every 3 s (≈ 3.3 m/s, a 5:00/km run). */
function runTrack(meters: number): TrackState {
  let state = EMPTY_TRACK;
  for (let m = 0, i = 0; m <= meters; m += 10, i++) {
    state = applyFix(state, fix(m, i * 3000), 'run', i * 3).state;
  }
  return state;
}

describe('haversineM', () => {
  it('measures one degree of latitude as ~111 km', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) / 1000).toBeCloseTo(111.2, 0);
  });
});

describe('applyFix', () => {
  it('anchors on the first good fix and ignores inaccurate ones', () => {
    expect(applyFix(EMPTY_TRACK, fix(0, 0, { accuracy: 80 }), 'run', 0).verdict).toBe('inaccurate');
    const { state, verdict } = applyFix(EMPTY_TRACK, fix(0, 0), 'run', 0);
    expect(verdict).toBe('start');
    expect(state.distanceM).toBe(0);
    expect(state.points).toHaveLength(1);
  });

  it('does not grow distance while standing still (GPS wander)', () => {
    let state = applyFix(EMPTY_TRACK, fix(0, 0), 'run', 0).state;
    for (let i = 1; i < 20; i++) {
      const r = applyFix(state, fix(i % 2 === 0 ? 1 : -1, i * 1000), 'run', i);
      expect(r.verdict).toBe('jitter');
      state = r.state;
    }
    expect(state.distanceM).toBe(0);
  });

  it("treats a step inside a poor fix's error circle as wander, not distance", () => {
    const state = applyFix(EMPTY_TRACK, fix(0, 0), 'run', 0).state;
    // 8 m "moved" with 20 m accuracy — a phone standing still does this all the time
    expect(applyFix(state, fix(8, 3000, { accuracy: 20 }), 'run', 3).verdict).toBe('jitter');
    // the same 8 m with a sharp 5 m fix is real movement
    expect(applyFix(state, fix(8, 3000, { accuracy: 5 }), 'run', 3).verdict).toBe('accepted');
  });

  it('rejects a fix that carries no accuracy at all', () => {
    const nan = { ...fix(0, 0), accuracy: Number.NaN };
    expect(applyFix(EMPTY_TRACK, nan, 'run', 0).verdict).toBe('inaccurate');
  });

  it('keeps the anchor so slow movement still accumulates', () => {
    let state = applyFix(EMPTY_TRACK, fix(0, 0), 'walk', 0).state;
    state = applyFix(state, fix(2, 1000), 'walk', 1).state; // 2 m — jitter, anchor stays at 0
    const r = applyFix(state, fix(4, 2000), 'walk', 2); // 4 m from the anchor
    expect(r.verdict).toBe('accepted');
    expect(r.state.distanceM).toBeCloseTo(4, 0);
  });

  it('drops a GPS jump that implies an impossible speed', () => {
    const state = applyFix(EMPTY_TRACK, fix(0, 0), 'run', 0).state;
    expect(applyFix(state, fix(500, 2000), 'run', 2).verdict).toBe('jump');
  });

  it('records a split at each kilometre with the time it took', () => {
    const state = runTrack(2100);
    expect(state.distanceM).toBeCloseTo(2100, -1);
    expect(state.splits).toHaveLength(2);
    // 1000 m at 10 m / 3 s = 300 s per km
    expect(state.splits[0]).toMatchObject({ index: 1, distanceKm: 1 });
    expect(state.splits[0]?.seconds).toBeGreaterThanOrEqual(299);
    expect(state.splits[0]?.seconds).toBeLessThanOrEqual(301);
  });

  it('adds the partial last split at finish', () => {
    const state = runTrack(2100);
    const last = finalSplit(state, 630);
    expect(last?.index).toBe(3);
    expect(last?.distanceKm).toBeCloseTo(0.1, 1);
  });

  it('counts climb only once it clears the altitude noise', () => {
    let state = applyFix(EMPTY_TRACK, fix(0, 0, { altitude: 100 }), 'hike', 0).state;
    state = applyFix(state, fix(10, 5000, { altitude: 102 }), 'hike', 5).state; // noise
    state = applyFix(state, fix(20, 10000, { altitude: 101 }), 'hike', 10).state;
    expect(state.elevationGainM).toBe(0);
    state = applyFix(state, fix(30, 15000, { altitude: 110 }), 'hike', 15).state;
    expect(state.elevationGainM).toBe(10);
  });
});

describe('rollingPaceSecPerKm', () => {
  it('reads the pace over the recent window', () => {
    const samples = [
      { sec: 0, distanceM: 0 },
      { sec: 15, distanceM: 50 },
      { sec: 30, distanceM: 100 },
    ];
    expect(rollingPaceSecPerKm(samples)).toBe(300);
  });

  it('says nothing until there is real movement', () => {
    expect(rollingPaceSecPerKm([{ sec: 0, distanceM: 0 }])).toBeNull();
    expect(
      rollingPaceSecPerKm([
        { sec: 0, distanceM: 0 },
        { sec: 10, distanceM: 4 },
      ])
    ).toBeNull();
  });
});

describe('simplifyRoute', () => {
  it('collapses a straight line to its ends and caps the size', () => {
    const line: [number, number][] = Array.from({ length: 500 }, (_, i) => [32 + i * 10 * M, 34.8]);
    expect(simplifyRoute(line)).toHaveLength(2);
    const zigzag: [number, number][] = Array.from({ length: 2000 }, (_, i) => [
      32 + i * 10 * M,
      34.8 + (i % 2) * 0.001,
    ]);
    expect(simplifyRoute(zigzag, 300).length).toBeLessThanOrEqual(300);
  });
});
