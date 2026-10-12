import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutExercise, WorkoutSession } from '../../../../types';
import { buildCardioSession, isCardioSession } from '../../../../utils/cardio';
import { EditSessionSheet, buildExercises, toEditableExercises } from '../EditSessionSheet';

const { updateClientSession, createClientSession } = vi.hoisted(() => ({
  updateClientSession: vi.fn(),
  createClientSession: vi.fn(),
}));

vi.mock('../../../../services/coach', () => ({ updateClientSession, createClientSession }));
vi.mock('../../../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));

const START = new Date(2026, 9, 9, 6, 30).toISOString();

const run = (): WorkoutSession => ({
  ...buildCardioSession({
    activity: 'run',
    startTime: START,
    durationSec: 1720,
    distanceKm: 5.2,
    avgHr: 150,
  }),
  id: 'run-1',
});

const bench: WorkoutExercise = {
  id: 'bench-row',
  exerciseId: 'lib-bench',
  exerciseName: 'Bench Press',
  targetMuscle: 'Chest',
  notes: 'tempo 3-1-1',
  restSeconds: 90,
  isCompleted: true,
  order: 1,
  sets: [
    {
      id: 'b1',
      setNumber: 1,
      reps: 8,
      weight: 80,
      rpe: 8,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      completedAt: START,
    },
  ],
};

const gymWithTreadmill = (): WorkoutSession => {
  const warmUp = buildCardioSession({
    activity: 'treadmill',
    startTime: START,
    durationSec: 600,
    distanceKm: 1.5,
  });
  return { ...warmUp, id: 'gym-1', totalVolume: 640, exercises: [...warmUp.exercises, bench] };
};

const renderSheet = (initial: WorkoutSession) =>
  render(
    <LazyMotion features={domAnimation}>
      <EditSessionSheet
        clientId="c1"
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
        initial={initial}
      />
    </LazyMotion>
  );

describe('EditSessionSheet — buildExercises round trip', () => {
  it('saves a cardio exercise back exactly as logged', () => {
    const session = run();
    const [saved] = buildExercises(toEditableExercises(session));
    expect(saved).toEqual({ ...session.exercises[0], order: 0 });
  });

  it('keeps the stored fields of an edited lift (library id, RPE, completion time)', () => {
    const editable = toEditableExercises(gymWithTreadmill());
    const [, liftRow] = editable;
    const edited = editable.map((ex) =>
      ex === liftRow ? { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '85' })) } : ex
    );
    const [treadmill, lift] = buildExercises(edited);
    expect(treadmill?.trackingType).toBe('cardio');
    expect(treadmill?.sets[0]).toMatchObject({ duration: 600, distanceKm: 1.5 });
    expect(lift).toMatchObject({
      exerciseId: 'lib-bench',
      exerciseName: 'Bench Press',
      notes: 'tempo 3-1-1',
      order: 1,
    });
    expect(lift?.sets[0]).toMatchObject({ weight: 85, reps: 8, rpe: 8, completedAt: START });
  });
});

describe('EditSessionSheet — corrections that change the movement', () => {
  it('a renamed lift drops the old movement identity (no squat sets under bench press)', () => {
    const editable = toEditableExercises(gymWithTreadmill());
    const renamed = editable.map((ex) => (ex.cardio ? ex : { ...ex, name: 'Squat' }));
    const [, lift] = buildExercises(renamed);
    expect(lift?.exerciseName).toBe('Squat');
    expect(lift?.exerciseId).not.toBe('lib-bench');
    expect(lift?.targetMuscle).toBe('');
  });

  it('stamps sets the coach adds as completed, so a lift added to a run counts as lifting', () => {
    const session = run();
    const editable = [
      ...toEditableExercises(session),
      { id: 'added', name: 'Squat', sets: [{ id: 's-new', reps: '8', weight: '80' }] },
    ];
    const built = buildExercises(editable, '2026-10-09T07:00:00.000Z');
    expect(built[1]?.sets[0]?.completedAt).toBe('2026-10-09T07:00:00.000Z');
    expect(isCardioSession({ exercises: built })).toBe(false);
  });
});

describe('EditSessionSheet — cardio rows', () => {
  beforeEach(() => {
    updateClientSession.mockReset().mockResolvedValue({ error: null });
    createClientSession.mockReset();
  });

  it('shows a run read-only — time/distance, no reps or weight inputs', () => {
    renderSheet(run());
    expect(screen.queryByLabelText('חזרות')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('משקל')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /הוספת סט/ })).not.toBeInTheDocument();
    expect(screen.getByText('ריצה')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('28:40');
    expect(dialog.textContent).toContain('5.2');
  });

  it('keeps reps/weight inputs for the lift of a gym session with a treadmill', () => {
    renderSheet(gymWithTreadmill());
    expect(screen.getAllByLabelText('חזרות')).toHaveLength(1);
    expect(screen.getByText('הליכון')).toBeInTheDocument();
  });

  it('saving a retitled run keeps its time, duration and data untouched', async () => {
    const session = run();
    renderSheet(session);
    fireEvent.change(screen.getByLabelText('כותרת'), { target: { value: 'ריצה קלה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(updateClientSession).toHaveBeenCalledTimes(1));
    const [, id, patch] = updateClientSession.mock.calls[0] as [
      string,
      string,
      Partial<WorkoutSession>,
    ];
    expect(id).toBe('run-1');
    expect(patch.notes).toBe('ריצה קלה');
    expect(patch.startTime).toBe(session.startTime);
    expect(patch.endTime).toBe(session.endTime);
    expect(patch.duration).toBe(1720);
    expect(patch.exercises).toEqual([{ ...session.exercises[0], order: 0 }]);
  });

  it('a removed run exercise is dropped from the save', async () => {
    renderSheet(gymWithTreadmill());
    fireEvent.click(screen.getByRole('button', { name: 'מחיקת הליכון' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(updateClientSession).toHaveBeenCalledTimes(1));
    const patch = updateClientSession.mock.calls[0]?.[2] as Partial<WorkoutSession>;
    expect(patch.exercises?.map((e) => e.exerciseId)).toEqual(['lib-bench']);
  });
});
