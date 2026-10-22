import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalSheet } from '../../components/GoalSheet';
import { goalTimeError, goalTimeFrom } from '../../components/goalForm';

vi.mock('../../../../services/localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

const stored = () => JSON.parse(localStorage.getItem('running_goal_v1') || 'null');

describe('goal time reading', () => {
  it('reads clocks, and short forms as hours when minutes would be impossible', () => {
    expect(goalTimeFrom('50:00', 10)).toBe(3000);
    expect(goalTimeFrom('1:55:00', 21.0975)).toBe(6900);
    // "1:55" for a half marathon is 1:55:00, not 1 min 55 s.
    expect(goalTimeFrom('1:55', 21.0975)).toBe(6900);
    expect(goalTimeFrom('25', 5)).toBe(1500);
  });

  it('explains what is wrong with a time', () => {
    expect(goalTimeError('', 10)).toBeNull();
    expect(goalTimeError('5:99', 10)).toBe('כתבו זמן כמו 50:00 או 1:55:00.');
    expect(goalTimeError('10:00', 10)).toBe('הזמן הזה מהיר מדי למרחק. בדקו אותו.');
    expect(goalTimeError('9:00:00', 5)).toBe('הזמן הזה ארוך מדי למרחק. בדקו אותו.');
  });
});

describe('GoalSheet', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('validates the time inline and saves a goal with its pace', () => {
    const onClose = vi.fn();
    render(<GoalSheet isOpen goal={null} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '10 ק״מ' }));
    const time = screen.getByLabelText('זמן יעד (לא חובה)');
    fireEvent.change(time, { target: { value: '5:99' } });
    fireEvent.blur(time);
    expect(screen.getByRole('alert')).toHaveTextContent('כתבו זמן כמו 50:00 או 1:55:00.');
    expect(time).toHaveAttribute('aria-invalid', 'true');

    // Saving with an error keeps the sheet open and stores nothing.
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המטרה' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(stored()).toBeNull();

    fireEvent.change(time, { target: { value: '50:00' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('5:00').closest('span')).toHaveTextContent('קצב יעד 5:00');

    fireEvent.click(screen.getByRole('button', { name: 'שמירת המטרה' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stored()).toMatchObject({
      distanceKm: 10,
      label: '10 ק״מ',
      raceDate: null,
      targetSec: 3000,
    });
    expect(typeof stored().createdAt).toBe('string');
  });

  it('takes any distance under "אחר"', () => {
    render(<GoalSheet isOpen goal={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'אחר' }));
    fireEvent.change(screen.getByLabelText('כמה קילומטרים?'), { target: { value: '7,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המטרה' }));
    expect(stored()).toMatchObject({ distanceKm: 7.5, label: '7.5 ק״מ', targetSec: null });
  });

  it('refuses a date in the past', () => {
    render(<GoalSheet isOpen goal={null} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('תאריך המרוץ (לא חובה)'), {
      target: { value: '2020-01-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המטרה' }));
    expect(screen.getByRole('alert')).toHaveTextContent('בחרו תאריך מהיום והלאה.');
    expect(stored()).toBeNull();
  });

  it('removes a goal only after a confirm, keeping when changed mind', () => {
    const goal = {
      distanceKm: 5,
      label: '5 ק״מ',
      raceDate: null,
      targetSec: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    localStorage.setItem('running_goal_v1', JSON.stringify(goal));
    const onClose = vi.fn();
    render(<GoalSheet isOpen goal={goal} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'עריכת המטרה' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הסרת המטרה' }));
    const keep = screen.getByRole('button', { name: 'להשאיר' });
    expect(keep).toHaveFocus();
    fireEvent.click(keep);
    expect(stored()).toMatchObject({ distanceKm: 5 });

    fireEvent.click(screen.getByRole('button', { name: 'הסרת המטרה' }));
    fireEvent.click(screen.getByRole('button', { name: 'כן, להסיר' }));
    expect(localStorage.getItem('running_goal_v1')).toBe('null');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the original createdAt when editing', () => {
    const goal = {
      distanceKm: 5,
      label: '5 ק״מ',
      raceDate: null,
      targetSec: null,
      createdAt: '2026-10-01T00:00:00.000Z',
    };
    render(<GoalSheet isOpen goal={goal} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('זמן יעד (לא חובה)'), { target: { value: '28:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירת המטרה' }));
    expect(stored()).toMatchObject({ targetSec: 1680, createdAt: '2026-10-01T00:00:00.000Z' });
  });
});
