import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent cloud/auth side effects from running in tests.
vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));
vi.mock('../festoreService', () => ({
  deleteBodyWeight: vi.fn(),
  deletePersonalExercise: vi.fn(),
  deleteWorkoutSession: vi.fn(),
  deleteWorkoutTemplate: vi.fn(),
  syncBodyWeight: vi.fn(),
  syncPersonalExercise: vi.fn(),
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import type { WorkoutSession } from '../../types';
import { clearDatabase } from '../indexedDBCore';
import {
  deleteWorkoutSession,
  getWorkoutSession,
  getWorkoutSessions,
  saveWorkoutSession,
} from '../workoutDb';

const makeSession = (id: string, overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  date: '2026-04-19',
  startTime: new Date('2026-04-19T10:00:00Z').toISOString(),
  endTime: null,
  exercises: [],
  duration: 0,
  status: 'active',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: new Date('2026-04-19T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-19T10:00:00Z').toISOString(),
  ...overrides,
});

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('workoutDb sessions', () => {
  it('creates a session retrievable by id', async () => {
    const session = makeSession('s-1', { notes: 'leg day' });
    await saveWorkoutSession(session);

    const fetched = await getWorkoutSession('s-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe('s-1');
    expect(fetched?.notes).toBe('leg day');
  });

  it('lists all saved sessions', async () => {
    await saveWorkoutSession(makeSession('s-1', { startTime: '2026-04-18T10:00:00Z' }));
    await saveWorkoutSession(makeSession('s-2', { startTime: '2026-04-19T10:00:00Z' }));

    const list = await getWorkoutSessions();
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe('s-2');
    expect(list[1]!.id).toBe('s-1');
  });

  it('persists updates via re-save', async () => {
    await saveWorkoutSession(makeSession('s-1', { totalVolume: 100 }));
    await saveWorkoutSession(makeSession('s-1', { totalVolume: 250, status: 'completed' }));

    const fetched = await getWorkoutSession('s-1');
    expect(fetched?.totalVolume).toBe(250);
    expect(fetched?.status).toBe('completed');
  });

  it('deletes a session', async () => {
    await saveWorkoutSession(makeSession('s-1'));
    await deleteWorkoutSession('s-1');

    const fetched = await getWorkoutSession('s-1');
    expect(fetched).toBeNull();
  });
});
