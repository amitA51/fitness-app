import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DraftConflictDialog from './DraftConflictDialog';

// THE BUG THIS PINS: the dialog offered "התחל חדש" with no hint of its cost.
// That answer dispatches RESET_ACTIVE_WORKOUT, which sets draft.exercises = []
// — every set the user logged before the reload is deleted — and restarts the
// workout clock. A user who merely refreshed the page was one tap from losing
// real work, and the question they were answering did not say so.
//
// The fix is copy, not another confirmation step: the body names the cost of the
// destructive answer AND states that the safe answer keeps the sets, so the
// dialog stays a single honest question.

const renderDialog = (props: Partial<ComponentProps<typeof DraftConflictDialog>> = {}) =>
  render(
    <LazyMotion features={domAnimation}>
      <DraftConflictDialog isOpen onResume={vi.fn()} onStartNew={vi.fn()} {...props} />
    </LazyMotion>
  );

/** The dialog's explanatory copy, whitespace-normalised (JSX wraps the string). */
const dialogCopy = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');

describe('DraftConflictDialog — the destructive answer declares what it destroys', () => {
  it('states that starting new deletes the logged sets', () => {
    renderDialog();

    const copy = dialogCopy();

    // Names the destructive answer by the exact label on its button…
    expect(copy).toContain('התחל חדש');
    // …and what that answer costs: the logged sets are deleted.
    expect(copy).toMatch(/הסטים שרשמתם יימחקו/);
    // The clock reset is part of the same reducer action, so it is stated too.
    expect(copy).toMatch(/זמן האימון יתחיל מחדש/);
  });

  it('states that continuing keeps the logged sets, so the safe answer is obvious', () => {
    renderDialog();

    const copy = dialogCopy();

    expect(copy).toContain('המשך אימון');
    expect(copy).toMatch(/כל הסטים שרשמתם נשמרים/);
  });

  it('does not add a second confirmation — exactly two answers, safe one focused', () => {
    renderDialog();

    const resume = screen.getByRole('button', { name: 'המשך אימון' });
    const startNew = screen.getByRole('button', { name: 'התחל חדש' });

    expect(screen.getAllByRole('button')).toHaveLength(2);
    // The non-destructive answer is the one marked safe (backdrop/Escape and the
    // initial focus both resolve to it).
    expect(resume).toHaveAttribute('data-safe-action');
    expect(startNew).not.toHaveAttribute('data-safe-action');

    // Touch targets stay tappable at 390px.
    expect(Number.parseInt(resume.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(Number.parseInt(startNew.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('still reports the two answers to their handlers', () => {
    const onResume = vi.fn();
    const onStartNew = vi.fn();
    renderDialog({ onResume, onStartNew });

    fireEvent.click(screen.getByRole('button', { name: 'התחל חדש' }));
    expect(onStartNew).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'המשך אימון' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
