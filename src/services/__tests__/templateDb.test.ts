import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutTemplate } from '../../types';
import { STORES, clearDatabase, dbPut } from '../indexedDBCore';
import { loadWorkoutFromTemplate } from '../templateDb';

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));

vi.mock('../supabaseSync', () => ({
  syncWorkoutTemplate: vi.fn(),
}));

const makeTemplate = (): WorkoutTemplate => ({
  id: 'template-1',
  name: 'Push day',
  description: 'Chest and triceps',
  createdAt: '2026-06-06T10:00:00.000Z',
  updatedAt: '2026-06-06T10:00:00.000Z',
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
  exercises: [
    {
      id: 'template-exercise-row-1',
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      targetMuscle: 'chest',
      targetSets: 3,
      targetReps: 8,
      targetWeight: 100,
      restSeconds: 120,
      order: 0,
      notes: 'Pause on chest',
      muscleGroup: 'Chest',
      sets: [{ reps: 8, weight: 100 }],
    },
  ],
});

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('loadWorkoutFromTemplate', () => {
  it('creates fresh active exercise ids while preserving the catalog exerciseId', async () => {
    await dbPut(STORES.WORKOUT_TEMPLATES, makeTemplate());

    const firstWorkout = await loadWorkoutFromTemplate('template-1');
    const secondWorkout = await loadWorkoutFromTemplate('template-1');

    const firstExercise = firstWorkout.exercises?.[0];
    const secondExercise = secondWorkout.exercises?.[0];

    expect(firstExercise?.id).not.toBe('template-exercise-row-1');
    expect(secondExercise?.id).not.toBe('template-exercise-row-1');
    expect(firstExercise?.id).not.toBe(secondExercise?.id);
    expect(firstExercise?.exerciseId).toBe('bench-press');
    expect(secondExercise?.exerciseId).toBe('bench-press');
  });
});
