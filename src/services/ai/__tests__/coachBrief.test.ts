import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../../types';
import { buildCoachFacts, generateCoachBrief } from '../coachBrief';
import { resetAIProvider } from '../core';

const session = (id: string, daysAgo: number): WorkoutSession => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 1000,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
    exercises: [
      {
        id: `${id}-bench`,
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        notes: '',
        restSeconds: 120,
        isCompleted: true,
        order: 0,
        sets: [
          {
            id: `${id}-s1`,
            setNumber: 1,
            reps: 5,
            weight: 100,
            rpe: 8,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: `${date}T10:30:00.000Z`,
          },
        ],
      },
    ],
  };
};

describe('coachBrief — deterministic facts, model-ready contract', () => {
  beforeEach(() => {
    resetAIProvider(); // LocalFallbackProvider — no network
  });

  it('buildCoachFacts returns deterministic numbers in range', () => {
    const facts = buildCoachFacts({ sessions: [session('a', 1), session('b', 8)] });
    expect(facts.readinessScore).toBeGreaterThanOrEqual(0);
    expect(facts.readinessScore).toBeLessThanOrEqual(100);
    expect(['push', 'maintain', 'deload', 'rest']).toContain(facts.recommendation);
    expect(['high', 'medium', 'low']).toContain(facts.confidence);
  });

  it('generateCoachBrief never throws and the numbers equal the deterministic facts', async () => {
    const input = { sessions: [session('a', 1), session('b', 8)] };
    const facts = buildCoachFacts(input);
    const brief = await generateCoachBrief('daily-readiness', input);
    // The model never sets the numbers — they must match the deterministic facts.
    expect(brief.facts.readinessScore).toBe(facts.readinessScore);
    expect(brief.facts.recommendation).toBe(facts.recommendation);
    expect(brief.headline.length).toBeGreaterThan(0);
    expect(brief.detail.length).toBeGreaterThan(0);
    expect(['ai', 'deterministic']).toContain(brief.source);
  });

  it('returns a deterministic brief when there are no sessions', async () => {
    const brief = await generateCoachBrief('weekly-review', { sessions: [] });
    expect(brief.source).toBe('deterministic');
    expect(brief.detail.length).toBeGreaterThan(0);
  });
});
