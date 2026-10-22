import { describe, expect, it, vi } from 'vitest';
import type { CardioActivity, CardioSplit, RunType, WorkoutSession } from '../../../../types';
import {
  type CardioEffort,
  buildCardioSession,
  cardioEffortsOf,
  recordsHeldBy,
} from '../../../../utils/cardio';
import {
  insightsForRun,
  isLatestRun,
  partsLabel,
  primaryEffort,
  summarizeEfforts,
} from '../detailModel';

vi.mock('../../../../services/localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

const NOW = new Date('2026-10-20T07:00:00');
const DAY = 24 * 60 * 60 * 1000;

interface PartOpts {
  avgHr?: number;
  maxHr?: number;
  runType?: RunType;
  splits?: CardioSplit[];
  calories?: number;
}

const part = (
  activity: CardioActivity,
  km: number,
  sec: number,
  daysAgo = 0,
  opts: PartOpts = {}
): WorkoutSession =>
  buildCardioSession({
    activity,
    startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    durationSec: sec,
    distanceKm: km,
    ...opts,
  });

const firstEffort = (s: WorkoutSession) => cardioEffortsOf(s)[0] as CardioEffort;

/** One session holding several cardio parts, in order. */
const combined = (...sessions: WorkoutSession[]): WorkoutSession => {
  const [first] = sessions as [WorkoutSession];
  return { ...first, exercises: sessions.flatMap((s) => s.exercises) };
};

describe('primaryEffort', () => {
  it('picks the running part over a longer walk', () => {
    const efforts = cardioEffortsOf(
      combined(part('walk', 4, 50 * 60), part('run', 5, 28 * 60), part('walk', 1, 12 * 60))
    );
    expect(primaryEffort(efforts)?.activity).toBe('run');
  });

  it('picks the longest part when nothing is a run', () => {
    const efforts = cardioEffortsOf(
      combined(part('indoor_cycle', 0, 10 * 60), part('row', 3, 15 * 60))
    );
    expect(primaryEffort(efforts)?.activity).toBe('row');
  });

  it('is null for no parts', () => {
    expect(primaryEffort([])).toBeNull();
  });
});

describe('summarizeEfforts', () => {
  it('adds every part and weights heart rate by time', () => {
    const efforts = cardioEffortsOf(
      combined(
        part('walk', 1, 10 * 60, 0, { avgHr: 100, maxHr: 110 }),
        part('run', 5, 30 * 60, 0, { avgHr: 150, maxHr: 172 })
      )
    );
    const s = summarizeEfforts(efforts, 70);
    expect(s.distanceKm).toBe(6);
    expect(s.durationSec).toBe(40 * 60);
    // (100·10 + 150·30) / 40 = 137.5 → 138
    expect(s.avgHr).toBe(138);
    expect(s.maxHr).toBe(172);
    // A walk and a run do not share one pace.
    expect(s.uniform).toBe(false);
  });

  it('treats two running parts as one kind', () => {
    const efforts = cardioEffortsOf(
      combined(part('run', 3, 15 * 60), part('treadmill', 2, 10 * 60))
    );
    expect(summarizeEfforts(efforts, null).uniform).toBe(true);
  });

  it('says "from the watch" only when every part typed its calories', () => {
    const mixed = cardioEffortsOf(
      combined(part('run', 5, 1800, 0, { calories: 350 }), part('walk', 1, 600))
    );
    expect(summarizeEfforts(mixed, 70).caloriesFromWatch).toBe(false);
    const typed = cardioEffortsOf(part('run', 5, 1800, 0, { calories: 350 }));
    const one = summarizeEfforts(typed, 70);
    expect(one.caloriesFromWatch).toBe(true);
    expect(one.calories).toBe(350);
  });
});

describe('insightsForRun', () => {
  it('does not judge an easy run against paces made from itself', () => {
    // The only run: its own pace would make it look like a hard effort.
    const only = part('run', 5, 25 * 60, 0, { runType: 'easy' });
    const ids = insightsForRun(firstEffort(only), only, [only], null).map((i) => i.id);
    expect(ids).not.toContain('easy_too_fast');
  });

  it('flags an easy run that was faster than the runner’s easy paces', () => {
    // The paces come from a real effort (a race), so they can grade a run.
    const race = part('run', 5, 25 * 60, 7, { runType: 'race' });
    const fast = part('run', 5, 25 * 60, 0, { runType: 'easy' });
    const ids = insightsForRun(firstEffort(fast), fast, [race, fast], null).map((i) => i.id);
    expect(ids).toContain('easy_too_fast');
  });

  it('does not grade by pace from an ordinary run — that is only a first estimate', () => {
    const ordinary = part('run', 5, 25 * 60, 7);
    const same = part('run', 5, 25 * 60, 0, { runType: 'easy' });
    const ids = insightsForRun(firstEffort(same), same, [ordinary, same], null).map((i) => i.id);
    expect(ids).not.toContain('easy_too_fast');
  });

  it('reads the long-run jump from the running part only', () => {
    const prior = part('run', 5, 30 * 60, 10);
    const today = combined(part('walk', 3, 30 * 60), part('run', 5.2, 31 * 60));
    const run = cardioEffortsOf(today).find((e) => e.activity === 'run') as CardioEffort;
    const ids = insightsForRun(run, today, [prior, today], null).map((i) => i.id);
    // 5.2 km vs 5 km is under the 10% line; the walk's 3 km is not added on.
    expect(ids).not.toContain('long_jump');
  });

  it('has nothing to say about a ride', () => {
    const ride = part('cycle', 30, 3600);
    expect(insightsForRun(firstEffort(ride), ride, [ride], null)).toEqual([]);
  });
});

describe('isLatestRun', () => {
  it('is true only when no run came after', () => {
    const older = part('run', 5, 1800, 3);
    const newer = part('run', 6, 2100, 1);
    const rideAfter = part('cycle', 20, 3000, 0);
    const all = [older, newer, rideAfter];
    expect(isLatestRun(newer, all)).toBe(true);
    expect(isLatestRun(older, all)).toBe(false);
  });
});

describe('summarizeEfforts — parts that cannot be added up', () => {
  it('is not uniform when a same-kind part has no distance', () => {
    const efforts = cardioEffortsOf(
      combined(part('cycle', 30, 3600), part('indoor_cycle', 0, 1800))
    );
    expect(summarizeEfforts(efforts, null).uniform).toBe(false);
  });

  it('shows no calories rather than a part-total', () => {
    // No body weight: the walk has no estimate, so the run's typed 350 is not "the session".
    const efforts = cardioEffortsOf(
      combined(part('run', 5, 1800, 0, { calories: 350 }), part('walk', 1, 600))
    );
    expect(summarizeEfforts(efforts, null).calories).toBeNull();
    // The session's own number still wins.
    expect(summarizeEfforts(efforts, null, 420).calories).toBe(420);
  });
});

describe('recordsHeldBy with a discipline', () => {
  it('finds the run’s record even when a walk came first in the session', () => {
    const prior = part('run', 5, 1800, 10);
    const today = combined(part('walk', 1.2, 720), part('run', 6, 1980));
    const hits = recordsHeldBy(today.id, [prior, today], 'running');
    expect(hits.some((h) => h.kind === 'longest' && h.distanceKm === 6)).toBe(true);
  });

  it('claims nothing for the first effort ever in a discipline', () => {
    const only = part('run', 6, 1980);
    expect(recordsHeldBy(only.id, [only], 'running')).toEqual([]);
  });
});

describe('partsLabel', () => {
  it('names the parts once each, in order', () => {
    const efforts = cardioEffortsOf(
      combined(part('walk', 1, 600), part('run', 5, 1500), part('walk', 1, 600))
    );
    expect(partsLabel(efforts)).toBe('הליכה וריצה');
  });

  it('joins three kinds with commas and a final "ו"', () => {
    const efforts = cardioEffortsOf(
      combined(part('treadmill', 3, 900), part('indoor_cycle', 0, 900), part('row', 2, 600))
    );
    expect(partsLabel(efforts)).toBe('הליכון, אופני כושר וחתירה');
  });
});
