import { describe, expect, it } from 'vitest';
import {
  bestRecentRun,
  bestTimeFor,
  buildCardioSession,
  cardioEffortOf,
  cardioRecords,
  longestInPrior30Days,
  recordsHeldBy,
  runPaceTrend,
  weeklyCardio,
} from '..';
import type { CardioSplit } from '../../../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 12, 0); // Wednesday 2026-10-14

const run = (
  daysAgo: number,
  km: number,
  sec: number,
  splits?: CardioSplit[],
  activity: 'run' | 'treadmill' | 'cycle' = 'run'
) =>
  buildCardioSession({
    activity,
    startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    durationSec: sec,
    distanceKm: km,
    splits,
  });

describe('bestTimeFor', () => {
  it('scales a slightly long effort down to the exact distance', () => {
    const effort = cardioEffortOf(run(1, 5.2, 1560).exercises[0]!)!;
    expect(bestTimeFor(effort, 5)?.seconds).toBe(1500);
  });

  it('never counts a shorter effort, or one far past the distance', () => {
    const short = cardioEffortOf(run(1, 4.9, 1400).exercises[0]!)!;
    const long = cardioEffortOf(run(1, 12, 3600).exercises[0]!)!;
    expect(bestTimeFor(short, 5)).toBeNull();
    expect(bestTimeFor(long, 5)).toBeNull();
  });

  it('finds the fastest window of GPS splits inside a longer run', () => {
    const splits = [320, 310, 280, 285, 290, 300, 330].map((seconds, i) => ({
      index: i + 1,
      distanceKm: 1,
      seconds,
    }));
    const effort = cardioEffortOf(run(1, 7, 2115, splits).exercises[0]!)!;
    expect(bestTimeFor(effort, 1)).toEqual({ seconds: 280, fromSplits: true });
    // fastest five in a row: 310+280+285+290+300 = 1465
    expect(bestTimeFor(effort, 5)?.seconds).toBe(1465);
  });
});

describe('records', () => {
  const sessions = [
    run(20, 5, 1620),
    run(10, 5.05, 1515),
    run(3, 10, 3300),
    run(2, 30, 3600, undefined, 'cycle'),
  ];

  it('keeps the fastest time per distance and the longest run', () => {
    const r = cardioRecords(sessions);
    expect(Math.round(r.fastest.get(5)?.seconds ?? 0)).toBe(1500);
    expect(r.longest?.distanceKm).toBe(10);
    expect(r.fastest.has(1)).toBe(false);
  });

  it('tells a session which records it holds — never on the very first effort', () => {
    expect(recordsHeldBy(sessions[0]!.id, [sessions[0]!])).toEqual([]);
    const held = recordsHeldBy(sessions[2]!.id, sessions);
    expect(held.map((h) => h.kind)).toEqual(['fastest', 'longest']);
    expect(held[0]?.label).toBe('10 ק״מ');
  });

  it('measures the 30-day longest before a run (the spike baseline)', () => {
    expect(longestInPrior30Days(sessions, NOW.getTime() - 2.5 * DAY)).toBe(10);
    expect(longestInPrior30Days(sessions, NOW.getTime() - 15 * DAY)).toBe(5);
  });
});

describe('weekly and trend', () => {
  it('sums distance per Sunday week, oldest first, current week flagged', () => {
    const weeks = weeklyCardio([run(1, 5, 1500), run(8, 8, 2600)], 3, NOW);
    expect(weeks).toHaveLength(3);
    expect(weeks[2]).toMatchObject({ distanceKm: 5, count: 1, isCurrent: true });
    expect(weeks[1]).toMatchObject({ distanceKm: 8, count: 1, isCurrent: false });
  });

  it('can narrow the week to one discipline', () => {
    const weeks = weeklyCardio(
      [run(1, 5, 1500), run(1, 30, 3600, undefined, 'cycle')],
      1,
      NOW,
      'running'
    );
    expect(weeks[0]?.distanceKm).toBe(5);
  });

  it('lists run paces and picks the best recent run for a race estimate', () => {
    const sessions = [run(40, 5, 1650), run(5, 10, 3000), run(2, 1.5, 420)];
    expect(runPaceTrend(sessions).map((p) => Math.round(p.secPerKm))).toEqual([330, 300, 280]);
    expect(bestRecentRun(sessions, NOW)?.distanceKm).toBe(10);
  });
});
