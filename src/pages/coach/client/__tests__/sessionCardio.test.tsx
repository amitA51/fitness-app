import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession } from '../../../../types';
import { buildCardioSession } from '../../../../utils/cardio';
import { TimelineBox } from '../TimelineBox';
import { CardioTotals, cardioExerciseName, sessionCardioView } from '../sessionCardio';

const START = new Date(2026, 9, 9, 6, 30).toISOString();

const run = (): WorkoutSession =>
  buildCardioSession({ activity: 'run', startTime: START, durationSec: 1720, distanceKm: 5.2 });

const bench: WorkoutExercise = {
  id: 'bench',
  exerciseId: 'bench',
  exerciseName: 'Bench Press',
  targetMuscle: 'Chest',
  notes: '',
  restSeconds: 90,
  isCompleted: true,
  order: 1,
  sets: [
    {
      id: 'b1',
      setNumber: 1,
      reps: 8,
      weight: 80,
      rpe: null,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      completedAt: START,
    },
  ],
};

/** Treadmill warm-up (10:00 · 1.5 km) + bench press. */
const gymWithTreadmill = (): WorkoutSession => {
  const warmUp = buildCardioSession({
    activity: 'treadmill',
    startTime: START,
    durationSec: 600,
    distanceKm: 1.5,
  });
  return { ...warmUp, id: 'gym', totalVolume: 4000, exercises: [...warmUp.exercises, bench] };
};

describe('sessionCardioView', () => {
  it('reads a run as its activity, total time/distance and pace', () => {
    const view = sessionCardioView(run());
    expect(view.cardioOnly).toBe(true);
    expect(view.title).toBe('ריצה');
    expect(view.activity).toBe('run');
    expect(view.pieces).toEqual([
      {
        key: 'total',
        label: null,
        effort: { activity: 'run', distanceKm: 5.2, durationSec: 1720 },
        withPace: true,
      },
    ]);
  });

  it('drops the pace when a cardio session mixes two activities', () => {
    const walk = buildCardioSession({
      activity: 'walk',
      startTime: START,
      durationSec: 600,
      distanceKm: 1,
    });
    const both = { ...run(), exercises: [...run().exercises, ...walk.exercises] };
    const view = sessionCardioView(both);
    expect(view.cardioOnly).toBe(true);
    expect(view.pieces[0]?.withPace).toBe(false);
    expect(view.pieces[0]?.effort.durationSec).toBe(2320);
  });

  it('keeps a gym session a gym session and adds its treadmill block', () => {
    const view = sessionCardioView(gymWithTreadmill());
    expect(view.cardioOnly).toBe(false);
    expect(view.title).toBeNull();
    expect(view.pieces).toHaveLength(1);
    expect(view.pieces[0]).toMatchObject({ label: 'הליכון', withPace: false });
  });

  it('returns no cardio for a lifting session', () => {
    const lifting = { ...gymWithTreadmill(), exercises: [bench] };
    expect(sessionCardioView(lifting)).toEqual({
      cardioOnly: false,
      title: null,
      activity: null,
      pieces: [],
    });
  });
});

describe('cardioExerciseName', () => {
  it('shortens a built-in catalog name to the activity label', () => {
    expect(cardioExerciseName(run().exercises[0] as WorkoutExercise)).toBe('ריצה');
  });

  it("keeps the trainee's own name for a custom cardio exercise", () => {
    const custom = { ...bench, exerciseName: 'ריצת בוקר', trackingType: 'cardio' as const };
    expect(cardioExerciseName(custom)).toBe('ריצת בוקר');
  });
});

describe('TimelineBox', () => {
  it('shows a run as time and distance, not as kilograms or exercises', () => {
    const { container } = render(<TimelineBox sessions={[run()]} checkIns={[]} assignments={[]} />);
    const text = container.textContent ?? '';
    expect(screen.getByText('ריצה')).toBeInTheDocument();
    expect(text).toContain('28:40');
    expect(text).toContain('5.2');
    expect(text).toContain('ק״מ');
    expect(text).toContain('דק׳/ק״מ');
    expect(text).not.toContain('ק״ג');
    expect(text).not.toContain('תרגיל');
  });

  it('shows a gym session with its volume plus the treadmill time/distance', () => {
    const { container } = render(
      <TimelineBox sessions={[gymWithTreadmill()]} checkIns={[]} assignments={[]} />
    );
    const text = container.textContent ?? '';
    expect(screen.getByText('אימון הושלם')).toBeInTheDocument();
    expect(text).toContain('4000 ק״ג נפח · 2 תרגילים · הליכון 10:00 · 1.5 ק״מ');
  });

  it("keeps the coach's note as the row title for a run", () => {
    render(
      <TimelineBox sessions={[{ ...run(), notes: 'ריצת נפח' }]} checkIns={[]} assignments={[]} />
    );
    expect(screen.getByText('ריצת נפח')).toBeInTheDocument();
  });
});

describe('CardioTotals', () => {
  it('renders one line per discipline', () => {
    const { container } = render(
      <CardioTotals
        totals={[
          { discipline: 'running', count: 3, distanceKm: 18.4, durationSec: 6520 },
          { discipline: 'other', count: 1, distanceKm: 0, durationSec: 1200 },
        ]}
      />
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe('ריצה: 18.4 ק״מ ב־3 ריצות · 1:48:40');
    expect(items[1]?.textContent).toBe('אירובי אחר: 20:00 באימון אחד');
  });

  it('renders nothing without cardio', () => {
    const { container } = render(<CardioTotals totals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
