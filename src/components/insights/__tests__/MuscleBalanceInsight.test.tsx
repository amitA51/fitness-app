import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../../types';
import { MuscleBalanceInsight } from '../MuscleBalanceInsight';

// A completed working set worth weight*reps volume.
const set = (id: string, weight: number, reps: number): WorkoutSet => ({
  id,
  setNumber: 1,
  reps,
  weight,
  rpe: 8,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-05-01T10:00:00.000Z',
});

const exercise = (id: string, muscle: string, sets: WorkoutSet[]): WorkoutExercise => ({
  id: `w-${id}`,
  exerciseId: id,
  exerciseName: id,
  targetMuscle: muscle,
  sets,
  notes: '',
  restSeconds: 120,
  isCompleted: true,
  order: 0,
});

// Each session: heavy Chest (3000) + tiny Quads (50) → Quads is far below the
// cross-muscle average, so it is flagged isWeak.
const imbalancedSession = (id: string, date: string): WorkoutSession => ({
  id,
  date,
  startTime: `${date}T10:00:00.000Z`,
  endTime: `${date}T11:00:00.000Z`,
  exercises: [
    exercise(`bench-${id}`, 'Chest', [
      set(`c1-${id}`, 100, 10),
      set(`c2-${id}`, 100, 10),
      set(`c3-${id}`, 100, 10),
    ]),
    exercise(`squat-${id}`, 'Quads', [set(`q1-${id}`, 10, 5)]),
  ],
  duration: 3600,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: `${date}T10:00:00.000Z`,
  updatedAt: `${date}T11:00:00.000Z`,
});

const sessions = (n: number): WorkoutSession[] =>
  Array.from({ length: n }, (_, i) =>
    imbalancedSession(`s${i}`, `2026-05-${String(i + 1).padStart(2, '0')}`)
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MuscleBalanceInsight', () => {
  it('renders nothing below the minimum completed-session threshold', () => {
    const { container } = render(<MuscleBalanceInsight sessions={sessions(4)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('surfaces the imbalance once there are enough completed sessions', () => {
    render(<MuscleBalanceInsight sessions={sessions(8)} />);
    expect(screen.getByText('איזון שרירים')).toBeInTheDocument();
    // The nudge copy is present (gender-safe, dugri register).
    expect(screen.getByText(/שווה להוסיף/)).toBeInTheDocument();
  });

  it('renders nothing when every muscle is trained evenly (no weak group)', () => {
    const balanced: WorkoutSession[] = sessions(8).map((s) => ({
      ...s,
      exercises: [
        exercise(`a-${s.id}`, 'Chest', [set(`a-${s.id}`, 100, 10)]),
        exercise(`b-${s.id}`, 'Quads', [set(`b-${s.id}`, 100, 10)]),
      ],
    }));
    const { container } = render(<MuscleBalanceInsight sessions={balanced} />);
    expect(container).toBeEmptyDOMElement();
  });
});
