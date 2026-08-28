import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PersonalExercise } from '../../../types';
import { ExerciseCard } from './ExerciseCard';

const build = (overrides: Partial<PersonalExercise> = {}): PersonalExercise => ({
  id: 'row',
  name: 'משיכת פולי עליון | Lat Pulldown',
  muscleGroup: 'Back',
  equipment: 'cable',
  mechanic: 'compound',
  force: 'pull',
  level: 'beginner',
  primaryMuscle: 'lats',
  defaultRestTime: 75,
  ...overrides,
});

describe('ExerciseCard classification', () => {
  it('names the precise prime mover rather than the filing category', () => {
    render(<ExerciseCard exercise={build()} onClick={vi.fn()} />);

    // 'Back' would render "גב", which only says which tab it lives in.
    expect(screen.getByText('גב רחב')).toBeInTheDocument();
    expect(screen.queryByText('גב')).not.toBeInTheDocument();
  });

  it('shows the movement pattern the filter selects on', () => {
    render(<ExerciseCard exercise={build()} onClick={vi.fn()} />);
    expect(screen.getByText('מורכב')).toBeInTheDocument();
  });

  it('falls back to the coarse muscle for unclassified user exercises', () => {
    render(
      <ExerciseCard
        exercise={build({ primaryMuscle: undefined, mechanic: undefined, isCustom: true })}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('גב')).toBeInTheDocument();
  });

  it('badges a level only when it is beyond beginner', () => {
    const { unmount } = render(<ExerciseCard exercise={build()} onClick={vi.fn()} />);
    // Two thirds of the catalog is beginner, so labelling it would be noise.
    expect(screen.queryByText('מתחיל')).not.toBeInTheDocument();
    unmount();

    render(<ExerciseCard exercise={build({ level: 'expert' })} onClick={vi.fn()} />);
    expect(screen.getByText('מתקדם')).toBeInTheDocument();
  });

  it('gives screen readers the same classification the card shows', () => {
    render(<ExerciseCard exercise={build({ level: 'intermediate' })} onClick={vi.fn()} />);

    const card = screen.getByRole('button');
    const label = card.getAttribute('aria-label') ?? '';
    expect(label).toContain('גב רחב');
    expect(label).toContain('מורכב');
    expect(label).toContain('בינוני');
    expect(label).toContain('כבל');
  });
});

describe('ExerciseCard bilingual name row', () => {
  it('puts the Hebrew and English halves in one row container', () => {
    render(<ExerciseCard exercise={build()} onClick={vi.fn()} />);

    const hebrew = screen.getByText('משיכת פולי עליון');
    const english = screen.getByText('Lat Pulldown');
    // Same parent => same row. Stacked halves are what made the row two lines
    // tall and cost the picker a third of its visible exercises.
    expect(hebrew.parentElement).toBe(english.parentElement);
    expect(hebrew.parentElement?.className).toContain('exercise-card__name--pair');
  });

  it('pins the English half to LTR so its punctuation is not mangled in the RTL row', () => {
    render(<ExerciseCard exercise={build({ name: 'לחיצת חזה בשיפוע | (45°) Incline Press' })} />);

    const english = screen.getByText('(45°) Incline Press');
    // `dir="auto"` sniffs the FIRST strong character; a leading bracket/digit has
    // none, so the label could adopt the surrounding RTL and move the bracket.
    expect(english).toHaveAttribute('dir', 'ltr');
    expect(english).toHaveAttribute('lang', 'en');
  });

  it('leaves a Hebrew-only pair on auto direction', () => {
    render(<ExerciseCard exercise={build({ name: 'סקוואט | מכונה' })} />);

    const second = screen.getByText('מכונה');
    expect(second).toHaveAttribute('dir', 'auto');
    expect(second).not.toHaveAttribute('lang');
  });
});
