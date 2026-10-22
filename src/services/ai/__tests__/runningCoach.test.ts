import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunType } from '../../../types';
import { buildCardioSession, cardioEffortOf } from '../../../utils/cardio';
import {
  type RunningGoal,
  goalProgress,
  nextRun,
  paceBandsFrom,
  paceReference,
  runInsights,
  runningLoad,
} from '../../running';
import {
  askRunningCoach,
  fitContext,
  reviewRun,
  runForReview,
  runningBrief,
} from '../runningCoach';

vi.mock('../../localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

const chat = vi.fn(async (_messages: { role: string; content: string }[]) => 'תשובה');
vi.mock('../core', () => ({ getAIProvider: () => ({ chat }) }));

const NOW = new Date('2026-10-22T08:00:00');
const DAY = 24 * 60 * 60 * 1000;

const run = (daysAgo: number, km: number, sec: number, runType?: RunType, avgHr?: number) =>
  buildCardioSession({
    activity: 'run',
    startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    durationSec: sec,
    distanceKm: km,
    runType,
    avgHr,
    splits: Array.from({ length: Math.floor(km) }, (_, i) => ({
      index: i + 1,
      distanceKm: 1,
      seconds: Math.round(sec / km),
      avgHr,
    })),
  });

const goal: RunningGoal = {
  distanceKm: 10,
  label: '10 ק״מ',
  raceDate: '2026-12-12',
  targetSec: 3000,
  createdAt: NOW.toISOString(),
};

function briefFor(sessions: ReturnType<typeof run>[], g: RunningGoal | null = goal) {
  const reference = paceReference(sessions, NOW);
  const bands = reference ? paceBandsFrom(reference.fiveKSec) : null;
  const load = runningLoad(sessions, { bands, hrMax: 186, now: NOW });
  return runningBrief({
    goal: g,
    progress: g ? goalProgress(g, reference, load, NOW) : null,
    reference,
    bands,
    hrMax: { hrMax: 186, measured: false },
    load,
    next: nextRun({ load, bands, hrMax: 186, goal: g, now: NOW }),
    weeklyGoalKm: 30,
    now: NOW,
  });
}

describe('runningBrief', () => {
  it('carries the goal, fitness, paces, load and the suggested next run', () => {
    const text = briefFor([run(2, 10, 3000, 'long', 150), run(5, 6, 2100, 'easy', 140)]);
    expect(text).toContain('מטרה: 10 ק״מ');
    expect(text).toContain('2026-12-12');
    expect(text).toContain('זמן יעד 50:00');
    expect(text).toContain('שווה ערך ל-5 ק״מ');
    expect(text).toContain('קצבים אישיים');
    expect(text).toContain('דופק מקסימלי 186');
    expect(text).toContain('יעד שבועי: 30');
    expect(text).toContain('ההמלצה של האפליקציה לריצה הבאה');
  });

  it('says plainly what is missing for a new runner', () => {
    const text = briefFor([], null);
    expect(text).toContain('מטרה: לא הוגדרה');
    expect(text).toContain('אין עדיין ריצה של 3 ק״מ');
  });

  it('always fits one ai-chat message, even with a long history', () => {
    const many = Array.from({ length: 28 }, (_, i) => run(i, 8, 2800, 'easy', 145));
    expect(fitContext(`${'x'.repeat(1500)}\n${briefFor(many)}`).length).toBeLessThanOrEqual(3900);
  });
});

describe('fitContext', () => {
  it('drops the oldest run lines first', () => {
    const text = ['head', '  - newest', '  - middle', '  - oldest', 'tail'].join('\n');
    expect(fitContext(text, text.length - 5)).not.toContain('oldest');
    expect(fitContext(text, text.length - 5)).toContain('newest');
  });
});

describe('askRunningCoach / reviewRun', () => {
  beforeEach(() => {
    chat.mockClear();
  });

  it('sends the rules and the brief as context, then the question', async () => {
    await askRunningCoach('  איך רצים בחום?\n', 'BRIEF', [
      { role: 'user', content: 'שאלה קודמת' },
      { role: 'assistant', content: 'תשובה קודמת' },
    ]);
    const messages = chat.mock.calls[0]![0];
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('אתה מאמן הריצה');
    expect(messages[0]?.content).toContain('BRIEF');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'איך רצים בחום?' });
    expect(messages).toHaveLength(4);
  });

  it('refuses an empty question', async () => {
    await expect(askRunningCoach('   ', 'BRIEF')).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });

  it('reviews one run with its splits and what the app noticed', async () => {
    const session = run(1, 6, 2100, 'easy', 172);
    const effort = cardioEffortOf(session.exercises[0]!)!;
    const insights = runInsights({
      effort,
      bands: paceBandsFrom(1500),
      hrMax: 186,
      longestPrior30Km: null,
      at: NOW,
    });
    const text = runForReview(effort, 'אתמול', insights);
    expect(text).toContain('6 ק״מ');
    expect(text).toContain('קצב לכל ק״מ');
    expect(text).toContain('הריצה הקלה לא הייתה קלה');
    await reviewRun(text, 'BRIEF');
    const messages = chat.mock.calls[0]![0];
    expect(messages[0]?.content).toContain('הריצה לניתוח');
    expect(messages[1]?.content).toContain('מה היה טוב');
  });
});
