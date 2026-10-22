import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RunningGoal,
  daysUntil,
  goalLabelFor,
  goalPhase,
  goalProgress,
  longRunTargetKm,
  nextRun,
  paceBandsFrom,
  paceEffort,
  paceReference,
  parseRunningGoal,
  readRunningGoal,
  runInsights,
  runningLoad,
  writeRunningGoal,
} from '..';
import type { CardioSplit, RunType } from '../../../types';
import { buildCardioSession, cardioEffortOf } from '../../../utils/cardio';

vi.mock('../../localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

const NOW = new Date('2026-10-22T08:00:00');
const DAY = 24 * 60 * 60 * 1000;

interface RunOpts {
  avgHr?: number;
  runType?: RunType;
  splits?: CardioSplit[];
}

const run = (daysAgo: number, km: number, sec: number, opts: RunOpts = {}) =>
  buildCardioSession({
    activity: 'run',
    startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    durationSec: sec,
    distanceKm: km,
    avgHr: opts.avgHr,
    runType: opts.runType,
    splits: opts.splits,
  });

const kmSplits = (secs: number[], hrs?: number[]): CardioSplit[] =>
  secs.map((seconds, i) => ({ index: i + 1, distanceKm: 1, seconds, avgHr: hrs?.[i] }));

const goal = (over: Partial<RunningGoal> = {}): RunningGoal => ({
  distanceKm: 10,
  label: '10 ק״מ',
  raceDate: null,
  targetSec: null,
  createdAt: NOW.toISOString(),
  ...over,
});

const dateIn = (days: number) => {
  const d = new Date(NOW.getTime() + days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('pace bands', () => {
  it('scales with the runner like the VDOT tables do', () => {
    // A 25:00 5K (5:00/km): easy ~6:15–7:21, threshold ~5:16–5:23, interval ~4:46–4:57.
    const bands = paceBandsFrom(25 * 60);
    const easy = bands.find((b) => b.id === 'easy')!;
    const threshold = bands.find((b) => b.id === 'threshold')!;
    const interval = bands.find((b) => b.id === 'interval')!;
    expect(easy.fastSec).toBe(375);
    expect(easy.slowSec).toBe(441);
    // Threshold ≈ 5K pace + 16 s/km at every level (Daniels–Gilbert).
    expect(threshold.fastSec).toBe(316);
    expect(threshold.slowSec).toBe(323);
    expect(interval.slowSec).toBe(297);
    // Faster runner, faster bands, same order.
    const fast = paceBandsFrom(20 * 60);
    expect(fast.find((b) => b.id === 'easy')!.fastSec).toBeLessThan(easy.fastSec);
  });

  it('reads an average pace against the bands', () => {
    const bands = paceBandsFrom(25 * 60);
    expect(paceEffort(420, bands)).toBe('easy');
    expect(paceEffort(350, bands)).toBe('steady');
    expect(paceEffort(320, bands)).toBe('threshold');
    expect(paceEffort(290, bands)).toBe('hard');
  });

  it('trusts the reference only when it was a real effort', () => {
    // Every run at the same pace: the "best" run is just a run → a first estimate.
    const sameEveryDay = [run(2, 6, 2100), run(4, 6, 2100), run(6, 6, 2100), run(8, 6, 2100)];
    expect(paceReference(sameEveryDay, NOW)?.confidence).toBe('low');
    // A clearly faster run among ordinary ones → trusted.
    const withHardRun = [...sameEveryDay, run(1, 5, 1500)];
    expect(paceReference(withHardRun, NOW)?.confidence).toBe('high');
    // Marked as a race, or a high heart rate → trusted even alone.
    expect(paceReference([run(3, 5, 1500, { runType: 'race' })], NOW)?.confidence).toBe('high');
    expect(paceReference([run(3, 5, 1500, { avgHr: 172 })], NOW, 190)?.confidence).toBe('high');
  });

  it('does not trust a run that is too fast to be real, or one dated in the future', () => {
    const usual = [run(2, 6, 2400), run(4, 6, 2400), run(6, 6, 2400), run(8, 6, 2400)];
    // 6 km at 2:40/km among 6:40/km runs: a GPS jump, not a breakthrough.
    // It is skipped, and the paces come from the real runs.
    const ref = paceReference([...usual, run(1, 6, 960)], NOW);
    expect(ref?.durationSec).toBe(2400);
    expect(ref?.confidence).toBe('low');
    // A run with a future date (a wrong clock) is not the reference.
    expect(paceReference([...usual, run(-2, 5, 1200)], NOW)?.durationSec).toBe(2400);
  });

  it('takes the reference from the best recent run, as a 5K equivalent', () => {
    const ref = paceReference([run(5, 10, 3000), run(10, 5, 1650)], NOW);
    expect(ref?.distanceKm).toBe(10);
    // 10K in 50:00 ≈ 5K in ~24:00 by Riegel.
    expect(ref!.fiveKSec).toBeGreaterThan(1400);
    expect(ref!.fiveKSec).toBeLessThan(1460);
  });
});

describe('goals', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('names standard distances and formats the rest', () => {
    expect(goalLabelFor(21.0975)).toBe('חצי מרתון');
    expect(goalLabelFor(7)).toBe('7 ק״מ');
    expect(goalLabelFor(7.5)).toBe('7.5 ק״מ');
  });

  it('round-trips a goal and treats anything malformed as none', () => {
    writeRunningGoal(goal({ targetSec: 3300, raceDate: dateIn(60) }));
    expect(readRunningGoal()).toMatchObject({ distanceKm: 10, targetSec: 3300 });
    expect(parseRunningGoal('{"distanceKm":-3}')).toBeNull();
    expect(parseRunningGoal('not json')).toBeNull();
    writeRunningGoal(null);
    expect(readRunningGoal()).toBeNull();
    // Stored as JSON null, so the cloud copy carries the removal.
    expect(localStorage.getItem('running_goal_v1')).toBe('null');
  });

  it('counts days and places the runner in a phase', () => {
    expect(daysUntil(dateIn(30), NOW)).toBe(30);
    expect(goalPhase(goal(), NOW)).toBe('open');
    expect(goalPhase(goal({ raceDate: dateIn(120) }), NOW)).toBe('base');
    expect(goalPhase(goal({ raceDate: dateIn(50) }), NOW)).toBe('build');
    expect(goalPhase(goal({ raceDate: dateIn(20) }), NOW)).toBe('peak');
    expect(goalPhase(goal({ raceDate: dateIn(6) }), NOW)).toBe('race_week');
    expect(goalPhase(goal({ raceDate: dateIn(-1) }), NOW)).toBe('past');
    // A half marathon tapers for about ten days.
    expect(goalPhase(goal({ distanceKm: 21.0975, raceDate: dateIn(9) }), NOW)).toBe('taper');
  });

  it('sets a sensible longest run per distance', () => {
    expect(longRunTargetKm(5)).toBe(8);
    expect(longRunTargetKm(10)).toBe(12);
    expect(longRunTargetKm(21.0975)).toBe(18);
    expect(longRunTargetKm(42.195)).toBe(32);
  });
});

describe('running load', () => {
  it('measures the ramp against the last four weeks', () => {
    const sessions = [
      run(28, 5, 1800),
      run(21, 5, 1800),
      run(14, 5, 1800),
      run(8, 5, 1800),
      run(2, 8, 2880),
      run(1, 8, 2880),
    ];
    const load = runningLoad(sessions, { bands: null, hrMax: null, now: NOW });
    expect(load.runsLast7Days).toBe(2);
    expect(load.kmLast7Days).toBe(16);
    expect(load.rampFraction).not.toBeNull();
    expect(load.rampFraction!).toBeGreaterThan(0.3);
    expect(load.daysSinceLastRun).toBe(1);
  });

  it('calls a run easy by heart rate before pace', () => {
    const load = runningLoad([run(1, 8, 2400, { avgHr: 140 }), run(3, 8, 2400, { avgHr: 180 })], {
      bands: paceBandsFrom(25 * 60),
      hrMax: 190,
      now: NOW,
    });
    expect(load.recentRuns.map((r) => r.intensity)).toEqual(['hard', 'easy']);
    expect(load.daysSinceHardRun).toBe(3);
  });

  it('counts days by the calendar: last night is yesterday, not today', () => {
    const lastNight = buildCardioSession({
      activity: 'run',
      startTime: new Date(NOW.getTime() - 9 * 60 * 60 * 1000).toISOString(),
      durationSec: 2400,
      distanceKm: 6,
    });
    const load = runningLoad([lastNight], { bands: null, hrMax: null, now: NOW });
    expect(load.daysSinceLastRun).toBe(1);
  });

  it('calls a run long against the runner’s own usual run', () => {
    const sessions = [run(1, 5, 1800), run(3, 5, 1800), run(5, 5, 1800), run(8, 9, 3300)];
    const load = runningLoad(sessions, { bands: null, hrMax: null, now: NOW });
    expect(load.medianRunKm).toBe(5);
    expect(load.daysSinceLongRun).toBe(8);
  });
});

describe('next run', () => {
  const coach = (sessions: ReturnType<typeof run>[], g: RunningGoal | null = null) => {
    const bands = paceBandsFrom(25 * 60);
    const load = runningLoad(sessions, { bands, hrMax: 190, now: NOW });
    return nextRun({ load, bands, hrMax: 190, goal: g, now: NOW });
  };

  it('starts a new runner with run-walk', () => {
    expect(coach([]).kind).toBe('run_walk');
  });

  it('rests after running today', () => {
    expect(coach([run(0, 6, 2100)]).kind).toBe('rest');
  });

  it('keeps it easy the day after a hard run', () => {
    expect(coach([run(1, 6, 1800, { runType: 'tempo' }), run(3, 12, 4500)]).kind).toBe('easy');
  });

  // Three weeks of 6 km easy runs, about three a week — a runner with a base.
  const base = () => [1, 3, 5, 8, 12, 15, 17, 19, 22, 24, 26].map((d) => run(d, 6, 2400));

  it('asks for the long run when it is overdue, capped by the goal', () => {
    const next = coach([...base(), run(10, 11, 4400)], goal());
    expect(next.kind).toBe('long');
    // 11 km +10% = 12.1, and a 10K needs about 12.
    expect(next.title).toBe('ריצה ארוכה 12 ק״מ');
  });

  it('does not prescribe a long run before there is a base', () => {
    const next = coach([run(2, 5, 2000), run(9, 10, 4200)], goal({ distanceKm: 21.0975 }));
    expect(next.kind).toBe('easy');
  });

  // Four steady weeks: easy, long, easy — an established runner.
  const steadyMonth = () =>
    [0, 1, 2, 3].flatMap((w) => [
      run(w * 7 + 1, 6, 2500),
      run(w * 7 + 3, 12, 4800),
      run(w * 7 + 5, 6, 2500),
    ]);

  it('adds quality when an established week has room for it', () => {
    const next = coach(steadyMonth(), goal({ raceDate: dateIn(40) }));
    expect(next.kind).toBe('tempo');
    expect(next.pace).not.toBeNull();
    expect(next.hr).toEqual({ low: 165, high: 175 });
  });

  it('does not put the fast session the day after the long run', () => {
    const next = coach([...steadyMonth(), run(1, 13, 5200)], goal({ raceDate: dateIn(40) }));
    expect(['tempo', 'intervals']).not.toContain(next.kind);
  });

  it('keeps a new runner on easy runs, no fast work', () => {
    const next = coach([run(1, 4, 1800), run(3, 4, 1800), run(5, 6, 2700)], goal());
    expect(next.kind).toBe('easy');
  });

  it('never stretches the long run more than 10% past the longest of the month', () => {
    const next = coach([...base(), run(9, 10, 4200)], goal({ distanceKm: 21.0975 }));
    expect(next.kind).toBe('long');
    expect(next.title).toBe('ריצה ארוכה 11 ק״מ');
  });

  it('counts the prescribed long run as done, so the next one waits a week', () => {
    const before = coach([...base(), run(10, 7, 2800)]);
    expect(before.title).toBe('ריצה ארוכה 7.5 ק״מ');
    // Done two days ago: no new long run yet.
    expect(coach([...base(), run(10, 7, 2800), run(2, 7.5, 3000)]).kind).not.toBe('long');
  });

  it('eases back in after a break', () => {
    const afterTwoWeeks = coach([run(20, 6, 2400), run(22, 6, 2400)]);
    expect(afterTwoWeeks.kind).toBe('easy');
    expect(afterTwoWeeks.title).toBe('ריצה קלה 20 דקות');
    expect(coach([run(70, 10, 3600)]).kind).toBe('run_walk');
  });

  it('stops steering by a goal whose date has passed', () => {
    const sessions = [...base(), run(10, 11, 4400)];
    expect(coach(sessions, goal({ raceDate: dateIn(-3) }))).toEqual(coach(sessions));
  });

  it('keeps race week light', () => {
    expect(coach([run(2, 6, 2400)], goal({ raceDate: dateIn(4) })).kind).toBe('race_week');
    expect(coach([run(2, 6, 2400)], goal({ raceDate: dateIn(0) })).title).toBe('היום המרוץ');
  });
});

describe('goal progress', () => {
  it('compares today’s equivalent time with the target', () => {
    const sessions = [run(5, 10, 3000), run(12, 12, 4320)];
    const load = runningLoad(sessions, { bands: null, hrMax: null, now: NOW });
    const ref = paceReference(sessions, NOW);
    const onTrack = goalProgress(goal({ targetSec: 3060 }), ref, load, NOW);
    expect(onTrack.verdict).toBe('on_track');
    const stretch = goalProgress(goal({ targetSec: 2700 }), ref, load, NOW);
    expect(stretch.verdict).toBe('stretch');
    expect(stretch.longRun.longestKm).toBe(12);
    expect(stretch.longRun.share).toBe(1);
  });

  it('does not predict a marathon from short runs', () => {
    const sessions = [run(5, 10, 3000)];
    const load = runningLoad(sessions, { bands: null, hrMax: null, now: NOW });
    const p = goalProgress(
      goal({ distanceKm: 42.195, label: 'מרתון', targetSec: 14400 }),
      paceReference(sessions, NOW),
      load,
      NOW
    );
    expect(p.predictedSec).toBeNull();
    expect(p.verdict).toBeNull();
  });
});

describe('run insights', () => {
  const insightsFor = (
    session: ReturnType<typeof run>,
    extra: { longestPrior30Km?: number | null; month?: number } = {}
  ) =>
    runInsights({
      effort: cardioEffortOf(session.exercises[0]!)!,
      bands: paceBandsFrom(25 * 60),
      hrMax: 190,
      longestPrior30Km: extra.longestPrior30Km ?? null,
      at: new Date(2026, (extra.month ?? 10) - 1, 15),
    });

  it('spots a run that faded', () => {
    const ids = insightsFor(
      run(1, 6, 2040, { splits: kmSplits([320, 325, 330, 350, 355, 360]) })
    ).map((i) => i.id);
    expect(ids).toContain('faded');
  });

  it('praises a negative split', () => {
    const ids = insightsFor(
      run(1, 6, 1890, { splits: kmSplits([325, 320, 318, 312, 310, 305]) })
    ).map((i) => i.id);
    expect(ids).toContain('negative_split');
  });

  it('flags an easy run that was not easy, first', () => {
    const insights = insightsFor(run(1, 8, 2560, { avgHr: 170, runType: 'easy' }));
    expect(insights[0]?.id).toBe('easy_too_fast');
    expect(insights[0]?.tone).toBe('warn');
  });

  it('notes heart-rate drift on a steady run of 40+ minutes, with a heat reason in summer', () => {
    const splits = kmSplits(
      [330, 330, 330, 330, 330, 330, 330, 330],
      [140, 141, 143, 145, 150, 154, 157, 160]
    );
    const winter = insightsFor(run(1, 8, 2640, { splits }), { month: 1 });
    const summer = insightsFor(run(1, 8, 2640, { splits }), { month: 7 });
    const short = insightsFor(run(1, 6, 1980, { splits: splits.slice(0, 6) }), { month: 1 });
    expect(short.find((i) => i.id === 'drift')).toBeUndefined();
    expect(winter.find((i) => i.id === 'drift')?.body).toContain('הבסיס האירובי');
    expect(summer.find((i) => i.id === 'drift')?.body).toContain('בחום');
  });

  it('warns about a big jump in distance', () => {
    const insights = insightsFor(run(1, 14, 5600), { longestPrior30Km: 10 });
    const jump = insights.find((i) => i.id === 'long_jump');
    expect(jump?.tone).toBe('warn');
  });

  it('says nothing about other sports', () => {
    const ride = buildCardioSession({
      activity: 'cycle',
      startTime: NOW.toISOString(),
      durationSec: 3600,
      distanceKm: 30,
    });
    expect(
      runInsights({
        effort: cardioEffortOf(ride.exercises[0]!)!,
        bands: null,
        hrMax: null,
        longestPrior30Km: null,
        at: NOW,
      })
    ).toEqual([]);
  });
});
