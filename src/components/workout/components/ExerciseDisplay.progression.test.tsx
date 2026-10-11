import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Exercise, WorkoutSet } from '../../../types';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestion';
import ExerciseDisplay from './ExerciseDisplay';

const previous = vi.hoisted(() => ({
  set: undefined as WorkoutSet | undefined,
}));
const chip = vi.hoisted(() => ({
  value: null as ProgressionSuggestion | null,
}));

vi.mock('../hooks/usePreviousSetData', () => ({
  usePreviousSetData: () => ({
    previousSet: previous.set,
    showGhostWeight: false,
    showGhostReps: false,
    isLoading: false,
  }),
}));

vi.mock('../hooks/useProgressionSuggestion', () => ({
  useProgressionSuggestion: () => chip.value,
}));

// Haptics read the Settings context; the chip only needs the call to exist.
vi.mock('../../../hooks/useHapticFeedback', () => {
  const haptics = {
    tap: vi.fn(),
    selection: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    impact: vi.fn(),
  };
  return { default: () => haptics, useHapticFeedback: () => haptics };
});

const mkSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 'set-1',
  setNumber: 1,
  reps: 0,
  weight: 0,
  rpe: null,
  isWarmup: false,
  isCompleted: false,
  notes: '',
  completedAt: null,
  ...overrides,
});

const increase: ProgressionSuggestion = {
  kind: 'increase',
  weight: 62.5,
  reps: null,
  value: '62.5 ק״ג',
  reason: '8 חזרות בכל הסטים: הזמן לעלות במשקל',
  ariaLabel: 'להעלות ל-62.5 ק״ג. 8 חזרות בכל הסטים: הזמן לעלות במשקל. לחיצה ממלאת את הסט הנוכחי',
};

const renderDisplay = (sets: WorkoutSet[], onUpdateSet = vi.fn()) => {
  const exercise = { id: 'ex-live', name: 'Bench Press', sets } as Exercise;
  render(
    <ExerciseDisplay
      exercise={exercise}
      displaySetIndex={0}
      currentSet={sets[0] ?? mkSet()}
      prInfo=""
      onUpdateSet={onUpdateSet}
      onCompleteSet={vi.fn()}
      onOpenNumpad={vi.fn()}
    />
  );
  return onUpdateSet;
};

describe('ExerciseDisplay · progression chip in the "אימון קודם" strip', () => {
  beforeEach(() => {
    previous.set = mkSet({ weight: 60, reps: 8, isCompleted: true, completedAt: 'x' });
    chip.value = increase;
  });

  it('shows last time and the engine target, and no fixed "+2.5" nudge', () => {
    renderDisplay([mkSet(), mkSet({ id: 'set-2' })]);
    expect(screen.getByText('אימון קודם:')).toBeInTheDocument();
    const button = screen.getByTestId('progression-chip');
    expect(button).toHaveAttribute('data-kind', 'increase');
    expect(button).toHaveTextContent('62.5 ק״ג');
    expect(button).toHaveAccessibleName(increase.ariaLabel);
    expect(screen.getByText(increase.reason)).toBeInTheDocument();
    expect(screen.queryByText(/\+2\.5/)).not.toBeInTheDocument();
  });

  it('a tap fills the current set (weight, and reps when the target names them)', () => {
    const onUpdateSet = renderDisplay([mkSet()]);
    fireEvent.click(screen.getByTestId('progression-chip'));
    expect(onUpdateSet).toHaveBeenCalledTimes(1);
    expect(onUpdateSet).toHaveBeenCalledWith('weight', 62.5);
  });

  it('fills the rep target too for a hold that waits on reps', () => {
    chip.value = {
      kind: 'hold',
      weight: 62.5,
      reps: 8,
      value: '62.5 ק״ג',
      reason: 'קודם 8 חזרות בכל הסטים, אחר כך עולים',
      ariaLabel: 'להישאר על 62.5 ק״ג',
    };
    const onUpdateSet = renderDisplay([mkSet()]);
    fireEvent.click(screen.getByTestId('progression-chip'));
    expect(onUpdateSet).toHaveBeenNthCalledWith(1, 'weight', 62.5);
    expect(onUpdateSet).toHaveBeenNthCalledWith(2, 'reps', 8);
  });

  it('reads as already applied once the current set carries the target', () => {
    renderDisplay([mkSet({ weight: 62.5 })]);
    expect(screen.getByTestId('progression-chip')).toHaveAccessibleName(
      `כבר בסט הנוכחי: 62.5 ק״ג. ${increase.reason}`
    );
  });

  it('steps aside while a warmup set is open', () => {
    renderDisplay([mkSet({ isWarmup: true }), mkSet({ id: 'set-2' })]);
    expect(screen.queryByTestId('progression-chip')).not.toBeInTheDocument();
    expect(screen.getByText('אימון קודם:')).toBeInTheDocument();
  });

  it('shows the target alone when last session had no set at this index', () => {
    previous.set = undefined;
    renderDisplay([mkSet()]);
    expect(screen.queryByText('אימון קודם:')).not.toBeInTheDocument();
    expect(screen.getByTestId('progression-chip')).toBeInTheDocument();
  });

  it('renders nothing (and no stray "0") for a 0 × 0 previous set with no target', () => {
    previous.set = mkSet({ weight: 0, reps: 0, isCompleted: true, completedAt: 'x' });
    chip.value = null;
    const { container } = render(
      <ExerciseDisplay
        exercise={{ id: 'ex-live', name: 'Bench Press', sets: [mkSet()] } as Exercise}
        displaySetIndex={0}
        currentSet={mkSet()}
        prInfo=""
        onUpdateSet={vi.fn()}
        onCompleteSet={vi.fn()}
        onOpenNumpad={vi.fn()}
      />
    );
    expect(screen.queryByText('אימון קודם:')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progression-chip')).not.toBeInTheDocument();
    const strayZero = Array.from(container.querySelectorAll('div')).some((d) =>
      Array.from(d.childNodes).some((n) => n.nodeType === 3 && n.textContent === '0')
    );
    expect(strayZero).toBe(false);
  });
});
