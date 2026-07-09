import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { describe, expect, it, vi } from 'vitest';
import AlternativesSheet from './AlternativesSheet';

vi.mock('../../../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ selection: vi.fn(), impact: vi.fn() }),
}));

// Stub the heavy library tab; expose a button that simulates picking an exercise
// so the swap-from-library wiring can be asserted without the real picker.
vi.mock('../ExerciseLibraryTab', () => ({
  default: ({ onSelect }: { onSelect: (ex: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onSelect({ name: 'מתח | Pull Up', muscleGroup: 'Back', targetMuscle: 'Back' })}
    >
      בחר מהדמה
    </button>
  ),
}));

const renderSheet = (props: Record<string, unknown> = {}) =>
  render(
    <LazyMotion features={domAnimation}>
      <AlternativesSheet
        isOpen
        alternatives={['חלופה א | Alt A', 'חלופה ב | Alt B']}
        exerciseName="לחיצת חזה"
        onSelect={vi.fn()}
        onSelectFromLibrary={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />
    </LazyMotion>
  );

describe('AlternativesSheet', () => {
  it('shows the preset alternatives plus a choose-from-library entry', () => {
    renderSheet();
    expect(screen.getByText('חלופה א | Alt A')).toBeInTheDocument();
    expect(screen.getByText('חלופה ב | Alt B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /בחר מהספרייה/ })).toBeInTheDocument();
  });

  it('selects a preset alternative by name', () => {
    const onSelect = vi.fn();
    renderSheet({ onSelect });
    fireEvent.click(screen.getByText('חלופה א | Alt A'));
    expect(onSelect).toHaveBeenCalledWith('חלופה א | Alt A');
  });

  it('opens the library picker and swaps via onSelectFromLibrary (carries muscle)', () => {
    const onSelectFromLibrary = vi.fn();
    const onClose = vi.fn();
    renderSheet({ onSelectFromLibrary, onClose });

    fireEvent.click(screen.getByRole('button', { name: /בחר מהספרייה/ }));
    expect(screen.getByText('חזרה לחלופות')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'בחר מהדמה' }));
    expect(onSelectFromLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'מתח | Pull Up', muscleGroup: 'Back', targetMuscle: 'Back' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('still offers the library when there are no preset alternatives', () => {
    renderSheet({ alternatives: [] });
    expect(screen.getByText(/אין חלופות מוכנות/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /בחר מהספרייה/ })).toBeInTheDocument();
  });

  it('keeps the dialog accessible name in sync with the visible sub-view', () => {
    renderSheet();
    // Presets view — the accessible name carries the exercise context.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('תרגילים חלופיים ללחיצת חזה');
    fireEvent.click(screen.getByRole('button', { name: /בחר מהספרייה/ }));
    // Library view — the accessible name matches the new visible heading.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('בחירת תרגיל מהספרייה');
  });
});
