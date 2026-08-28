import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RecoveryLog } from '../../../services/bodyStatsService';
import { calculateTrainingLoad } from '../../../services/trainingLoadService';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../../types';
import { ReadinessReadingCard } from './ReadinessReadingCard';

// Fixtures mirror services/__tests__/trainingLoadService.test.ts so the card is
// tested against REAL engine output — the flags under test are the engine's own
// hasRecoveryData / hasRpeData / hasChronicBaseline, not hand-written booleans.

const NOW = new Date('2026-04-26T12:00:00.000Z');

const dateDaysAgo = (daysAgo: number): string => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0] ?? '';
};

const set = (id: string, rpe: number | null): WorkoutSet => ({
  id,
  setNumber: 1,
  reps: 5,
  weight: 100,
  rpe,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: `${dateDaysAgo(0)}T10:00:00.000Z`,
});

const exercise = (id: string, rpe: number | null): WorkoutExercise => ({
  id: `workout-${id}`,
  exerciseId: id,
  exerciseName: id,
  targetMuscle: 'חזה',
  muscleGroup: 'חזה',
  sets: [set(`${id}-1`, rpe), set(`${id}-2`, rpe)],
  notes: '',
  restSeconds: 120,
  isCompleted: true,
  order: 0,
});

const session = (id: string, daysAgo: number, rpe: number | null): WorkoutSession => {
  const date = dateDaysAgo(daysAgo);
  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [exercise(`ex-${id}`, rpe)],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 1000,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

const recoveryLog = (overrides: Partial<RecoveryLog> = {}): RecoveryLog => ({
  id: 'rec-1',
  date: dateDaysAgo(0),
  createdAt: `${dateDaysAgo(0)}T08:00:00.000Z`,
  sleepHours: 8,
  sleepQuality: 5,
  sorenessLevel: 5,
  energyLevel: 5,
  stressLevel: 5,
  tightAreas: [],
  notes: '',
  ...overrides,
});

/** Acute week + a 3-week baseline, all with logged RPE. */
const fullHistory = (rpe: number | null = 7): WorkoutSession[] => [
  session('acute-1', 1, rpe),
  session('acute-2', 3, rpe),
  session('base-1', 9, rpe),
  session('base-2', 16, rpe),
  session('base-3', 23, rpe),
];

/** Same Hebrew mapping the card renders — asserted, not guessed. */
const RECOMMENDATION_TEXT = {
  push: 'העלו עומס באימון הבא',
  maintain: 'שמרו על העומס הנוכחי',
  deload: 'הפחיתו עומס באימון הבא',
  rest: 'קחו יום מנוחה',
} as const;

describe('ReadinessReadingCard', () => {
  describe('thin data — no recovery log (the flag that got the old card deleted)', () => {
    const load = calculateTrainingLoad(fullHistory(), [], { now: NOW });

    it('reports hasRecoveryData=false for this input', () => {
      expect(load.hasRecoveryData).toBe(false);
    });

    it('renders the hedge instead of a confident number', () => {
      render(<ReadinessReadingCard load={load} />);

      expect(screen.getByText('אין עדיין קריאת מוכנות')).toBeInTheDocument();
      // The engine still produced a figure — the card must NOT print it.
      expect(screen.queryByText(String(load.readinessScore))).not.toBeInTheDocument();
      expect(screen.queryByText('/ 100')).not.toBeInTheDocument();
    });

    it('withholds the recommendation too, since it rides the same default penalty', () => {
      render(<ReadinessReadingCard load={load} />);

      for (const text of Object.values(RECOMMENDATION_TEXT)) {
        expect(screen.queryByText(text)).not.toBeInTheDocument();
      }
    });

    it('names the one action that creates a reading', () => {
      render(<ReadinessReadingCard load={load} />);
      expect(screen.getByText(/מלאו דיווח התאוששות/)).toBeInTheDocument();
    });
  });

  describe('full data — recovery log + RPE + chronic baseline', () => {
    const load = calculateTrainingLoad(fullHistory(7), [recoveryLog()], { now: NOW });

    it('has all three sufficiency flags set', () => {
      expect(load.hasRecoveryData).toBe(true);
      expect(load.hasRpeData).toBe(true);
      expect(load.hasChronicBaseline).toBe(true);
    });

    it('renders the engine reading, the recommendation and the constraint reason', () => {
      render(<ReadinessReadingCard load={load} />);

      const score = screen.getByText(String(load.readinessScore));
      expect(score).toBeInTheDocument();
      // Numbers stay LTR-isolated inside the RTL layout.
      expect(score).toHaveAttribute('dir', 'ltr');

      // This fixture spikes volume week-over-week, so the engine returns
      // load_spike / maintain — assert exactly what it returned.
      expect(load.primaryConstraint).toBe('load_spike');
      expect(screen.getByText(RECOMMENDATION_TEXT[load.recommendation])).toBeInTheDocument();
      expect(
        screen.getByText('מה שמגביל אתכם עכשיו זה זינוק בנפח האימון מול השבוע הקודם.')
      ).toBeInTheDocument();
    });

    it('shows no hedge badge and no caveat notes', () => {
      render(<ReadinessReadingCard load={load} />);

      expect(screen.queryByText('קריאה חלקית')).not.toBeInTheDocument();
      expect(screen.queryByText(/לא רשמתם RPE/)).not.toBeInTheDocument();
      expect(screen.queryByText(/אין עדיין שבוע היסטוריה/)).not.toBeInTheDocument();
    });

    it('shows the load-vs-baseline ratio', () => {
      render(<ReadinessReadingCard load={load} />);
      expect(screen.getByText(load.acuteChronicRatio.toFixed(2))).toBeInTheDocument();
    });
  });

  describe('partial data — recovery log but no RPE', () => {
    const load = calculateTrainingLoad(fullHistory(null), [recoveryLog()], { now: NOW });

    it('reports hasRpeData=false with recovery data present', () => {
      expect(load.hasRecoveryData).toBe(true);
      expect(load.hasRpeData).toBe(false);
    });

    it('still shows the reading, but badged partial and naming the assumed effort', () => {
      render(<ReadinessReadingCard load={load} />);

      expect(screen.getByText(String(load.readinessScore))).toBeInTheDocument();
      expect(screen.getByText('קריאה חלקית')).toBeInTheDocument();
      expect(screen.getByText(/לא רשמתם RPE באימוני השבוע/)).toBeInTheDocument();
      expect(screen.getByText(/רשמו RPE בסטים/)).toBeInTheDocument();
    });
  });

  describe('partial data — recovery log but no chronic baseline', () => {
    // Acute week only: nothing in [-28d, -7d).
    const load = calculateTrainingLoad(
      [session('acute-1', 1, 7), session('acute-2', 3, 7)],
      [recoveryLog()],
      { now: NOW }
    );

    it('reports hasChronicBaseline=false', () => {
      expect(load.hasRecoveryData).toBe(true);
      expect(load.hasChronicBaseline).toBe(false);
    });

    it('shows the reading, badges it partial and suppresses the baseline comparison', () => {
      render(<ReadinessReadingCard load={load} />);

      expect(screen.getByText(String(load.readinessScore))).toBeInTheDocument();
      expect(screen.getByText('קריאה חלקית')).toBeInTheDocument();
      expect(screen.getByText(/אין עדיין שבוע היסטוריה/)).toBeInTheDocument();
      expect(screen.queryByText(/עומס השבוע מול הבסיס/)).not.toBeInTheDocument();
    });
  });
});
