import { describe, expect, it } from 'vitest';
import type { ActiveExercise } from '../../types';
import { buildWorkoutSession } from '../workoutSessionBuilder';
import type { BuildSessionInput } from '../workoutSessionBuilder';

const makeSet = (
  overrides: Partial<import('../../types').WorkoutSet> = {}
): import('../../types').WorkoutSet => ({
  id: 's1',
  setNumber: 1,
  reps: 10,
  weight: 50,
  rpe: null,
  isWarmup: false,
  isCompleted: false,
  notes: '',
  completedAt: null,
  ...overrides,
});

const makeExercise = (overrides: Partial<ActiveExercise> = {}): ActiveExercise => ({
  id: 'ex1',
  name: 'Bench Press',
  targetMuscle: 'Chest',
  sets: [],
  ...overrides,
});

const baseInput: BuildSessionInput = {
  exercises: [],
  startTimestamp: 1000000,
  totalPausedTime: 0,
  itemId: 'item_1',
  goalType: 'hypertrophy',
  now: 1060000, // 60 seconds later
};

describe('buildWorkoutSession', () => {
  it('returns null when no exercises have completed sets', () => {
    const result = buildWorkoutSession({
      ...baseInput,
      exercises: [makeExercise({ sets: [makeSet()] })],
    });
    expect(result).toBeNull();
  });

  it('returns null for empty exercises array', () => {
    expect(buildWorkoutSession(baseInput)).toBeNull();
  });

  it('builds a session from exercises with completed sets', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        id: 'ex1',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        defaultRestTime: 120,
        sets: [
          makeSet({
            id: 's1',
            reps: 10,
            weight: 60,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          }),
          makeSet({
            id: 's2',
            setNumber: 2,
            reps: 8,
            weight: 60,
          }),
        ],
      }),
    ];

    const result = buildWorkoutSession({ ...baseInput, exercises });
    expect(result).not.toBeNull();
    expect(result!.session.status).toBe('completed');
    expect(result!.session.exercises).toHaveLength(1);
    // Only the completed set is included
    expect(result!.session.exercises[0]!.sets).toHaveLength(1);
    expect(result!.session.exercises[0]!.sets[0]!.reps).toBe(10);
  });

  it('calculates duration correctly accounting for paused time', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        sets: [
          makeSet({
            reps: 5,
            weight: 100,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          }),
        ],
      }),
    ];

    const result = buildWorkoutSession({
      ...baseInput,
      exercises,
      startTimestamp: 0,
      totalPausedTime: 10000, // 10s paused
      now: 70000, // 70s total
    });

    // Duration = (70000 - 0 - 10000) / 1000 = 60s
    expect(result!.session.duration).toBe(60);
  });

  it('calculates volume correctly (weight * reps, excludes warmup)', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        sets: [
          makeSet({
            id: 's1',
            reps: 10,
            weight: 100,
            isWarmup: true,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          }),
          makeSet({
            id: 's2',
            setNumber: 2,
            reps: 10,
            weight: 100,
            isCompleted: true,
            completedAt: '2024-01-01T00:01:00Z',
          }),
        ],
      }),
    ];

    const result = buildWorkoutSession({ ...baseInput, exercises });
    // Warmup excluded: only set2 = 10*100 = 1000
    expect(result!.session.totalVolume).toBe(1000);
  });

  it('caps calories at 1500', () => {
    // Create massive volume to push calories over 1500
    const exercises: ActiveExercise[] = [
      makeExercise({
        sets: Array.from({ length: 20 }, (_, i) =>
          makeSet({
            id: `s${i}`,
            setNumber: i + 1,
            reps: 100,
            weight: 500,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          })
        ),
      }),
    ];

    const result = buildWorkoutSession({ ...baseInput, exercises });
    expect(result!.session.caloriesBurned).toBe(1500);
  });

  it('filters out exercises with no completed sets', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        id: 'ex1',
        name: 'Bench',
        sets: [
          makeSet({
            reps: 10,
            weight: 60,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          }),
        ],
      }),
      makeExercise({
        id: 'ex2',
        name: 'Squat',
        sets: [makeSet({ id: 's2', reps: 10, weight: 80 })],
      }),
    ];

    const result = buildWorkoutSession({ ...baseInput, exercises });
    expect(result!.session.exercises).toHaveLength(1);
    expect(result!.session.exercises[0]!.exerciseName).toBe('Bench');
  });

  it('uses itemId and goalType in the session', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        sets: [
          makeSet({
            reps: 5,
            weight: 50,
            isCompleted: true,
            completedAt: '2024-01-01T00:00:00Z',
          }),
        ],
      }),
    ];

    const result = buildWorkoutSession({
      ...baseInput,
      exercises,
      itemId: 'my_item',
      goalType: 'strength',
    });
    expect(result!.session.workoutItemId).toBe('my_item');
    expect(result!.session.goalType).toBe('strength');
  });

  it('assigns correct order to exercises', () => {
    const exercises: ActiveExercise[] = [
      makeExercise({
        id: 'a',
        name: 'A',
        sets: [makeSet({ isCompleted: true, completedAt: '2024-01-01T00:00:00Z' })],
      }),
      makeExercise({
        id: 'b',
        name: 'B',
        sets: [makeSet({ id: 's2', isCompleted: true, completedAt: '2024-01-01T00:00:00Z' })],
      }),
    ];

    const result = buildWorkoutSession({ ...baseInput, exercises });
    expect(result!.session.exercises[0]!.order).toBe(0);
    expect(result!.session.exercises[1]!.order).toBe(1);
  });
});
