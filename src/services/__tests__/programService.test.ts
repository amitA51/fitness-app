import { beforeEach, describe, expect, it } from 'vitest';
import {
  enDashRange,
  getExerciseOptions,
  getProgramDay,
  parseRestRange,
  parseWarmupCount,
  restRangeHe,
  startProgramDay,
} from '../programCatalogService';
import {
  PROGRAM_DAY_TEMPLATE_ID,
  TRAINING_DAYS,
  getProgress,
  getSwaps,
  reconcileProgramOnSessionSave,
  resetProgram,
  setSwap,
  startProgram,
} from '../programProgressService';
import { getWorkoutTemplate, getWorkoutTemplates } from '../templateDb';

const completeCurrentDay = async (idSuffix: number) => {
  await startProgramDay(); // materialize current day + set pending
  reconcileProgramOnSessionSave({
    startTime: new Date().toISOString(),
    status: 'completed',
    id: `session-${idSuffix}`,
    templateId: PROGRAM_DAY_TEMPLATE_ID,
  });
};

describe('programService progression', () => {
  beforeEach(() => {
    resetProgram();
    localStorage.clear();
  });

  it('starts at week 1, day 0 (Upper)', () => {
    const p = startProgram();
    expect(p.currentWeek).toBe(1);
    expect(p.currentDayIndex).toBe(0);
    expect(TRAINING_DAYS[p.currentDayIndex]).toBe('Upper');
    expect(p.status).toBe('active');
  });

  it('advances to the next day after a completed session', async () => {
    startProgram();
    await completeCurrentDay(1);
    const p = getProgress();
    expect(p?.currentWeek).toBe(1);
    expect(p?.currentDayIndex).toBe(1); // Lower
    expect(p?.completed).toHaveLength(1);
    expect(p?.completed[0]).toMatchObject({ week: 1, dayType: 'Upper' });
    expect(p?.pending).toBeNull();
  });

  it('rolls over to the next week after the 5th day', async () => {
    startProgram();
    for (let i = 0; i < TRAINING_DAYS.length; i++) {
      await completeCurrentDay(i);
    }
    const p = getProgress();
    expect(p?.currentWeek).toBe(2);
    expect(p?.currentDayIndex).toBe(0); // back to Upper
    expect(p?.completed).toHaveLength(5);
  });

  it('does not advance when the session started before the day was begun', async () => {
    startProgram();
    await startProgramDay(); // sets pending.startedAt = now
    reconcileProgramOnSessionSave({
      // a workout that began well before we started this program day
      startTime: new Date(Date.now() - 5 * 60_000).toISOString(),
      status: 'completed',
      id: 'stale',
      templateId: PROGRAM_DAY_TEMPLATE_ID,
    });
    const p = getProgress();
    expect(p?.currentDayIndex).toBe(0);
    expect(p?.completed).toHaveLength(0);
    expect(p?.pending).not.toBeNull();
  });

  it('does NOT advance when a different workout (other template) completes', async () => {
    // Regression: abandoning a program day then doing any free/other workout
    // must not falsely mark the program day done and advance the 12-week pointer.
    startProgram();
    await startProgramDay();
    reconcileProgramOnSessionSave({
      startTime: new Date().toISOString(),
      status: 'completed',
      id: 'unrelated',
      templateId: 'some-other-template-id',
    });
    const p = getProgress();
    expect(p?.currentDayIndex).toBe(0);
    expect(p?.completed).toHaveLength(0);
    expect(p?.pending).not.toBeNull();
  });

  it('does NOT advance for a free workout (no templateId)', async () => {
    startProgram();
    await startProgramDay();
    reconcileProgramOnSessionSave({
      startTime: new Date().toISOString(),
      status: 'completed',
      id: 'free',
      templateId: null,
    });
    expect(getProgress()?.currentDayIndex).toBe(0);
    expect(getProgress()?.completed).toHaveLength(0);
  });

  it('advances at most once for the same completed session id', async () => {
    startProgram();
    await startProgramDay();
    const session = {
      startTime: new Date().toISOString(),
      status: 'completed',
      id: 'dup',
      templateId: PROGRAM_DAY_TEMPLATE_ID,
    };
    reconcileProgramOnSessionSave(session);
    reconcileProgramOnSessionSave(session); // second fire must be a no-op
    const p = getProgress();
    expect(p?.currentDayIndex).toBe(1);
    expect(p?.completed).toHaveLength(1);
  });

  it('ignores non-completed sessions', async () => {
    startProgram();
    await startProgramDay();
    reconcileProgramOnSessionSave({
      startTime: new Date().toISOString(),
      status: 'cancelled',
      id: 'x',
    });
    expect(getProgress()?.currentDayIndex).toBe(0);
    expect(getProgress()?.pending).not.toBeNull();
  });

  it('materializes a hidden, by-id-loadable template carrying programExtras', async () => {
    startProgram();
    await startProgramDay(1, 'Upper');

    // The runner loads by id (the list getter hides program templates), so the
    // hidden template must be retrievable by id with its rich program data.
    const tmpl = await getWorkoutTemplate(PROGRAM_DAY_TEMPLATE_ID);
    expect(tmpl).not.toBeNull();
    expect(tmpl?.isProgramHidden).toBe(true);
    expect(tmpl?.exercises.length).toBeGreaterThan(0);

    const first = tmpl?.exercises[0];
    // 45° Incline Barbell Press — 2 working sets, target reps from the "6-8" range.
    expect(first?.sets?.length).toBe(first?.targetSets);
    expect(first?.programExtras?.alternatives?.length).toBeGreaterThan(0);
    expect(first?.programExtras?.rpeTarget).toBeTypeOf('number');
    expect(first?.exerciseName).toContain('|'); // bilingual "Hebrew | English"

    // …but it must NOT show up in the user-facing template list.
    const list = await getWorkoutTemplates();
    expect(list.some((t) => t.id === PROGRAM_DAY_TEMPLATE_ID)).toBe(false);
  });

  it('marks the program completed after all 12 weeks', async () => {
    startProgram();
    for (let i = 0; i < 12 * TRAINING_DAYS.length; i++) {
      await completeCurrentDay(i);
    }
    const p = getProgress();
    expect(p?.status).toBe('completed');
    expect(p?.completed).toHaveLength(60);
  }, 20_000);
});

describe('programService substitutions', () => {
  beforeEach(() => {
    resetProgram();
    localStorage.clear();
  });

  it('exposes the original movement plus its listed alternatives as options', async () => {
    const day = await getProgramDay(1, 'Upper');
    const first = day?.exercises[0];
    expect(first).toBeDefined();
    if (!first) return;
    const options = getExerciseOptions(first);
    // Original + (up to) two alternatives, deduped, all non-empty.
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]?.he).toBe(first.nameHe);
    expect(options.every((o) => o.label.length > 0)).toBe(true);
  });

  it('materializes the swapped movement (keeping the prescription) and can restore it', async () => {
    startProgram();
    const day = await getProgramDay(1, 'Upper');
    const first = day?.exercises[0];
    if (!first || !day) throw new Error('fixture missing');
    const options = getExerciseOptions(first);
    const orig = options[0];
    const alt = options[1]; // the first listed alternative
    if (!orig || !alt) throw new Error('options missing');

    // Swap the first slot to its alternative, then start the day.
    setSwap(1, 'Upper', first.order, alt.label);
    await startProgramDay(1, 'Upper');
    let tmpl = await getWorkoutTemplate(PROGRAM_DAY_TEMPLATE_ID);
    const swapped = tmpl?.exercises[0];
    expect(swapped?.name).toBe(alt.label);
    expect(swapped?.exerciseName).toBe(alt.label);
    // Prescription is unchanged — only the movement differs.
    expect(swapped?.targetSets).toBe(first.workingSets);
    expect(swapped?.targetReps).toBe(first.targetReps);
    // The original is now offered as an alternative (swap-back path).
    expect(swapped?.programExtras?.alternatives).toContain(orig.label);

    // Clearing restores the original movement.
    setSwap(1, 'Upper', first.order, null);
    expect(getSwaps()[`1-Upper-${first.order}`]).toBeUndefined();
    await startProgramDay(1, 'Upper');
    tmpl = await getWorkoutTemplate(PROGRAM_DAY_TEMPLATE_ID);
    expect(tmpl?.exercises[0]?.name).toBe(orig.label);
  });

  it('clears swaps on program reset', () => {
    setSwap(1, 'Upper', 1, 'Anything | Anything');
    expect(Object.keys(getSwaps())).toHaveLength(1);
    resetProgram();
    expect(Object.keys(getSwaps())).toHaveLength(0);
  });
});

describe('programService prescription parsing helpers', () => {
  it('enDashRange converts an ASCII hyphen range to an en-dash', () => {
    expect(enDashRange('8-10')).toBe('8–10');
    expect(enDashRange('6 - 8')).toBe('6–8');
    expect(enDashRange('12')).toBe('12'); // single value untouched
  });

  it('parseRestRange returns {min,max} seconds, defaulting to minutes', () => {
    expect(parseRestRange('3-5 min')).toEqual({ min: 180, max: 300 });
    expect(parseRestRange('1-2 min')).toEqual({ min: 60, max: 120 });
    expect(parseRestRange('2 min')).toEqual({ min: 120, max: 120 });
    expect(parseRestRange('90-120 sec')).toEqual({ min: 90, max: 120 });
  });

  it('parseWarmupCount takes the low end, capped at 4', () => {
    expect(parseWarmupCount('2-3')).toBe(2);
    expect(parseWarmupCount('1-2')).toBe(1);
    expect(parseWarmupCount('0')).toBe(0);
    expect(parseWarmupCount('5-6')).toBe(4); // capped
    expect(parseWarmupCount('')).toBe(0);
  });

  it('restRangeHe formats the numeric range with an en-dash and Hebrew unit', () => {
    expect(restRangeHe('3-5 min')).toBe("3–5 דק'");
    expect(restRangeHe('2 min')).toBe("2 דק'");
    expect(restRangeHe('90-120 sec')).toBe("90–120 שנ'");
  });
});

describe('programService prescription fields', () => {
  beforeEach(() => {
    resetProgram();
    localStorage.clear();
  });

  it('populates the structured prescription fields with LOW-end rest', async () => {
    startProgram();
    await startProgramDay(1, 'Upper');
    const tmpl = await getWorkoutTemplate(PROGRAM_DAY_TEMPLATE_ID);
    const first = tmpl?.exercises[0];
    expect(first).toBeDefined();
    const pe = first?.programExtras;
    // 45° Incline Barbell Press — reps "6-8", rest "3-5 min", warmup "2-3".
    expect(pe?.repRange).toBe('6–8');
    expect(pe?.restRange).toBe("3–5 דק'");
    expect(pe?.restSecondsMin).toBe(180);
    expect(pe?.restSecondsMax).toBe(300);
    expect(pe?.warmupSets).toBe(2);
    expect(pe?.earlyRpe).toBe('~6-7');
    expect(pe?.lastRpe).toBe('~7-8');
    expect(typeof pe?.coachingNote).toBe('string');
    expect((pe?.coachingNote as string).length).toBeGreaterThan(0);
    // The rest timer target + fallback fields now use the LOW end (shorter rest).
    expect(pe?.restTime).toBe(180);
    expect(first?.restSeconds).toBe(180);
    expect(first?.targetRestTime).toBe(180);
  });
});
