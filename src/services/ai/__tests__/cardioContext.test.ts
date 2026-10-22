import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardioActivity, WorkoutSession } from '../../../types';
import { buildCardioSession } from '../../../utils/cardio';
import { toLocalDateStr } from '../../../utils/dateUtils';
import { buildCardioSummary, describeCardioForPrompt } from '../cardioContext';
import { buildContext, buildSystemPrompt } from '../contextBuilder';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 12, 0); // Wednesday 2026-10-14, local

const cardio = (
  daysAgo: number,
  activity: CardioActivity,
  km: number,
  minutes: number
): WorkoutSession =>
  buildCardioSession(
    {
      activity,
      startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      durationSec: minutes * 60,
      distanceKm: km,
    },
    NOW.getTime()
  );

const run = (daysAgo: number, km: number, minutes: number) => cardio(daysAgo, 'run', km, minutes);

/** A completed lifting session: one exercise per [muscle, weight] pair, 3×10. */
const lift = (id: string, daysAgo: number, muscles: Array<[string, number]>): WorkoutSession => {
  const start = new Date(NOW.getTime() - daysAgo * DAY);
  const date = toLocalDateStr(start);
  return {
    id,
    date,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 3600_000).toISOString(),
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    exercises: muscles.map(([muscle, weight], i) => ({
      id: `${id}-ex-${i}`,
      exerciseId: `${muscle.toLowerCase()}-lift`,
      exerciseName: `${muscle} Lift`,
      targetMuscle: muscle,
      muscleGroup: muscle,
      notes: '',
      restSeconds: 90,
      isCompleted: true,
      order: i,
      sets: [1, 2, 3].map((n) => ({
        id: `${id}-ex-${i}-s${n}`,
        setNumber: n,
        reps: 10,
        weight,
        rpe: null,
        isWarmup: false,
        isCompleted: true,
        notes: '',
        completedAt: start.toISOString(),
      })),
    })),
  };
};

describe('buildCardioSummary', () => {
  it('is null for a trainee who only lifts — no empty cardio heading', () => {
    const sessions = [lift('a', 1, [['Chest', 80]])];
    expect(buildCardioSummary(sessions, NOW)).toBeNull();
    expect(describeCardioForPrompt(null)).toBe('');
  });

  it('ignores cardio older than the 4-week window', () => {
    expect(buildCardioSummary([run(40, 10, 55)], NOW)).toBeNull();
  });

  it('sums distance, time and efforts per discipline, plus the last 7 days', () => {
    const summary = buildCardioSummary(
      [run(1, 10, 50), run(9, 8, 44), cardio(3, 'swim', 1.5, 35), cardio(12, 'cycle', 30, 70)],
      NOW
    );
    expect(summary).not.toBeNull();
    expect(summary?.disciplines.map((d) => d.discipline)).toEqual([
      'running',
      'cycling',
      'swimming',
    ]);
    const running = summary?.disciplines.find((d) => d.discipline === 'running');
    expect(running).toMatchObject({ efforts: 2, distanceKm: 18, durationSec: 94 * 60 });
    // Last 7 days: the 10 km run and the swim.
    expect(summary?.last7Days).toMatchObject({ efforts: 2, durationSec: 85 * 60 });
  });

  it('reports the run pace getting faster when the newer runs are quicker', () => {
    // 6:00 → 6:00 → 5:30 → 5:30 per km over 10 km runs.
    const pace = buildCardioSummary(
      [run(20, 10, 60), run(15, 10, 60), run(8, 10, 55), run(2, 10, 55)],
      NOW
    )?.runPace;
    expect(pace?.avgSecPerKm).toBeCloseTo(345, 5);
    expect(pace?.direction).toBe('faster');
    expect(pace?.changeSecPerKm).toBe(-30);
  });

  it('calls a tiny pace change steady, and claims no direction from too few runs', () => {
    const steady = buildCardioSummary(
      [run(20, 10, 55), run(15, 10, 55), run(8, 10, 55.5), run(2, 10, 55.5)],
      NOW
    )?.runPace;
    expect(steady?.direction).toBe('steady');

    const few = buildCardioSummary([run(8, 10, 60), run(2, 10, 50)], NOW)?.runPace;
    expect(few?.direction).toBeNull();
    expect(few?.runs).toBe(2);
  });

  it('finds the longest run in the window', () => {
    const summary = buildCardioSummary([run(10, 14, 80), run(2, 6, 32)], NOW);
    expect(summary?.longestRun).toMatchObject({ distanceKm: 14, daysAgo: 10 });
  });

  it('warns when the latest run is >10% longer than the 30-day longest before it', () => {
    const summary = buildCardioSummary([run(20, 10, 55), run(12, 8, 44), run(1, 12.5, 70)], NOW);
    expect(summary?.longRunSpike).toMatchObject({
      distanceKm: 12.5,
      priorLongestKm: 10,
      overPercent: 25,
      daysAgo: 1,
    });
  });

  it('does not warn below the 10% line, or without an earlier run to compare', () => {
    expect(buildCardioSummary([run(20, 10, 55), run(1, 10.5, 58)], NOW)?.longRunSpike).toBeNull();
    expect(buildCardioSummary([run(1, 21, 120)], NOW)?.longRunSpike).toBeNull();
  });
});

describe('describeCardioForPrompt', () => {
  it('writes Hebrew units with geresh/gershayim and tells the model cardio is training', () => {
    const text = describeCardioForPrompt(
      buildCardioSummary(
        [
          run(20, 10, 55),
          run(12, 8, 44),
          run(6, 9, 50),
          run(1, 12.5, 70),
          cardio(3, 'swim', 1.5, 35),
        ],
        NOW
      )
    );
    expect(text).toContain('--- אירובי ב-4 השבועות האחרונים (חישוב מתמטי) ---');
    expect(text).toContain('• ריצה: 4 אימונים | 39.5 ק״מ | 219 דק׳');
    expect(text).toContain('• שחייה: אימון אחד | 1,500 מ׳ | 35 דק׳');
    expect(text).toContain('דק׳/ק״מ על פני 4 ריצות');
    expect(text).toContain('• הריצה הארוכה ביותר: 12.5 ק״מ ב-70 דק׳, אתמול');
    expect(text).toContain('ארוכה ב-25% מהריצה הארוכה ביותר ב-30 הימים שלפניה (10 ק״מ)');
    expect(text).toContain('אינו שבוע מנוחה');
    // ASCII quotes are not Hebrew unit marks.
    expect(text).not.toMatch(/ק"מ|דק'/);
  });

  it('omits distance for a cardio discipline that logged only time', () => {
    const text = describeCardioForPrompt(buildCardioSummary([cardio(2, 'elliptical', 0, 30)], NOW));
    expect(text).toContain('• אירובי אחר: אימון אחד | 30 דק׳');
    expect(text).not.toContain('קצב ריצה');
  });
});

describe('buildContext with cardio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a running-only trainee gets a cardio block and is not called inactive', () => {
    const sessions = [run(1, 10, 52), run(3, 8, 42), run(5, 12, 66)];
    const context = buildContext(sessions);
    const prompt = buildSystemPrompt(context);

    expect(context.cardio?.last7Days.efforts).toBe(3);
    expect(context.weakMuscles).toEqual([]);
    expect(context.neglectedMuscles).toEqual([]);
    expect(context.muscleCoverage).toEqual([]);
    expect(context.dataSufficiency.sessionCount).toBe(3);
    expect(prompt).toContain('• 7 הימים האחרונים: 3 אימונים | 160 דק׳');
    expect(prompt).toContain('נפח 0 ק״ג בשבוע עם אירובי אינו שבוע מנוחה');
  });

  it('cardio never becomes a weak, neglected or covered "muscle"', () => {
    const warmUp = lift('gym', 2, [
      ['Chest', 100],
      ['Back', 100],
    ]);
    const withTreadmill: WorkoutSession = {
      ...warmUp,
      exercises: [...warmUp.exercises, ...cardio(2, 'treadmill', 2, 12).exercises],
    };
    const sessions = [withTreadmill, run(10, 10, 55)];
    const context = buildContext(sessions);

    expect([...context.muscleCoverage].sort()).toEqual(['Back', 'Chest']);
    expect(context.weakMuscles).not.toContain('Cardio');
    expect(context.weakMuscles).toEqual([]);
    expect(context.neglectedMuscles).not.toContain('Cardio');
    expect(context.muscleRecovery.map((m) => m.muscle)).not.toContain('Cardio');
  });

  it('a lifting-only prompt carries no cardio heading', () => {
    const prompt = buildSystemPrompt(buildContext([lift('a', 1, [['Chest', 80]])]));
    expect(prompt).not.toContain('אירובי');
  });
});

describe('per-run detail for the model', () => {
  /** A run with whole-km splits: `paces` s/km and `hrs` bpm per km. */
  const splitRun = (daysAgo: number, paces: number[], hrs: number[]): WorkoutSession =>
    buildCardioSession(
      {
        activity: 'run',
        startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
        durationSec: paces.reduce((a, b) => a + b, 0),
        distanceKm: paces.length,
        avgHr: 150,
        maxHr: 171,
        elevationGainM: 35,
        splits: paces.map((seconds, i) => ({
          index: i + 1,
          distanceKm: 1,
          seconds,
          avgHr: hrs[i],
        })),
      },
      NOW.getTime()
    );

  it('lists the latest efforts newest first, with fastest/slowest km and heart-rate drift', () => {
    const summary = buildCardioSummary(
      [run(5, 8, 44), splitRun(1, [300, 305, 310, 320], [140, 144, 152, 156])],
      NOW
    );
    const [latest, older] = summary?.recentEfforts ?? [];
    expect(latest).toMatchObject({
      daysAgo: 1,
      distanceKm: 4,
      fastestKmSec: 300,
      slowestKmSec: 320,
      hrDriftBpm: 12,
      avgHr: 150,
      maxHr: 171,
    });
    expect(older).toMatchObject({ daysAgo: 5, fastestKmSec: null, hrDriftBpm: null });

    const text = describeCardioForPrompt(summary);
    expect(text).toContain('האימונים האחרונים, מהחדש לישן');
    expect(text).toContain('ק״מ מהיר 5:00, איטי 5:20');
    expect(text).toContain('סחף +12');
    expect(text).toContain('דופק 150 (שיא 171)');
    expect(text).toContain('אתמול: ריצה 4 ק״מ ב-');
  });

  it('caps the list at the latest five efforts', () => {
    const runs = Array.from({ length: 9 }, (_, i) => run(i + 1, 5, 27));
    expect(buildCardioSummary(runs, NOW)?.recentEfforts).toHaveLength(5);
  });

  it('keeps a busy runner cardio block well inside the 4,000-character ai-chat message cap', () => {
    // Worst realistic case: a run every other day for 8 weeks, every one with
    // 21 km splits and heart rate, plus the spike warning.
    const heavy = Array.from({ length: 28 }, (_, i) =>
      splitRun(
        i * 2 + 1,
        Array.from({ length: 21 }, (_, k) => 280 + k),
        Array.from({ length: 21 }, (_, k) => 140 + k)
      )
    );
    const text = describeCardioForPrompt(buildCardioSummary([...heavy, run(0, 30, 160)], NOW));
    expect(text.length).toBeLessThan(1400);
  });

  it('shows the weekly running trend beyond the 4-week window, only with 2+ weeks of runs', () => {
    const summary = buildCardioSummary([run(1, 10, 55), run(40, 6, 33)], NOW);
    expect(summary?.weeklyRunKm).toHaveLength(8);
    expect(summary?.weeklyRunKm?.[7]).toBe(10);
    expect(describeCardioForPrompt(summary)).toContain('ק״מ ריצה בשבוע');

    expect(buildCardioSummary([run(1, 10, 55)], NOW)?.weeklyRunKm).toBeNull();
  });
});
