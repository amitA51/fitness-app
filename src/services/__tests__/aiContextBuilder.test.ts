import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../types';
import { buildContext, buildSystemPrompt } from '../ai/contextBuilder';
import type { RecoveryLog } from '../bodyStatsService';
import { calculateRecoveryScore } from '../bodyStatsService';

const dateDaysAgo = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0] ?? '';
};

const session = (id: string, daysAgo: number, totalVolume: number): WorkoutSession => {
  const date = dateDaysAgo(daysAgo);

  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [
      {
        id: `${id}-exercise`,
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        sets: [],
        notes: '',
        restSeconds: 120,
        isCompleted: true,
        order: 0,
      },
    ],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

const recoveryLog = (overrides: Partial<RecoveryLog> = {}): RecoveryLog => ({
  id: 'rec-1',
  date: dateDaysAgo(0),
  createdAt: new Date().toISOString(),
  sleepHours: 8,
  sleepQuality: 5,
  sorenessLevel: 5,
  energyLevel: 5,
  stressLevel: 5,
  tightAreas: [],
  notes: '',
  ...overrides,
});

describe('buildContext deterministic fitness math', () => {
  it('uses the canonical recovery score calculation', () => {
    const log = recoveryLog({ stressLevel: 5 });
    const context = buildContext([session('s-1', 1, 1000)], [log]);

    expect(context.recoveryScore).toBe(calculateRecoveryScore(log).overall);
  });

  it('calculates weekly volume change and readiness from workout load', () => {
    const context = buildContext([
      session('this-week-1', 1, 2000),
      session('this-week-2', 2, 2000),
      session('prev-week', 9, 2000),
    ]);

    expect(context.weeklyVolume).toBe(4000);
    expect(context.previousWeeklyVolume).toBe(2000);
    expect(context.volumeChangePercent).toBe(100);
    expect(context.readinessScore).toBeLessThan(80);
    expect(context.primaryConstraint).toBe('load_spike');
  });

  it('puts the deterministic readiness score into the AI system prompt', () => {
    const context = buildContext([session('s-1', 1, 1000)], [recoveryLog()]);
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain(`ציון מוכנות מתמטי: ${context.readinessScore}/100`);
    expect(prompt).toContain('שינוי נפח שבועי');
  });
});
