import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { RunningCoach } from '../../../hooks/useRunningCoach';
import { RunningNextRow } from '../RunningNextRow';

// A runner sees the coach's next run on the home screen; a lifter's home stays
// exactly as it was.

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

let coach: Partial<RunningCoach>;
vi.mock('../../../hooks/useRunningCoach', () => ({ useRunningCoach: () => coach }));

const runs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ at: Date.now() - (i + 1) * 24 * 60 * 60 * 1000 }));

const base = (recent: number): Partial<RunningCoach> => ({
  goal: null,
  progress: null,
  load: { recentRuns: runs(recent) } as unknown as RunningCoach['load'],
  next: { kind: 'easy', title: 'ריצה קלה 35 דקות', detail: '', pace: null, hr: null, reasons: [] },
});

describe('RunningNextRow', () => {
  it('stays hidden for someone who does not run', () => {
    coach = base(1);
    const { container } = render(
      <MemoryRouter>
        <RunningNextRow />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the next run to a runner and opens the coach', () => {
    coach = base(3);
    render(
      <MemoryRouter>
        <RunningNextRow />
      </MemoryRouter>
    );
    const row = screen.getByRole('button', { name: /הריצה הבאה: ריצה קלה 35 דקות/ });
    fireEvent.click(row);
    expect(navigate).toHaveBeenCalledWith('/cardio/coach');
  });

  it('names the goal and the days left', () => {
    coach = {
      ...base(0),
      goal: {
        distanceKm: 10,
        label: '10 ק״מ',
        raceDate: '2026-12-12',
        targetSec: null,
        createdAt: '',
      },
      progress: { daysLeft: 51, phase: 'build' } as RunningCoach['progress'],
    };
    render(
      <MemoryRouter>
        <RunningNextRow />
      </MemoryRouter>
    );
    expect(screen.getByText('10 ק״מ · עוד 7 שבועות')).toBeInTheDocument();
  });

  it('drops a goal whose date has passed', () => {
    coach = {
      ...base(0),
      goal: {
        distanceKm: 10,
        label: '10 ק״מ',
        raceDate: '2026-09-01',
        targetSec: null,
        createdAt: '',
      },
      progress: { daysLeft: -50, phase: 'past' } as RunningCoach['progress'],
    };
    const { container } = render(
      <MemoryRouter>
        <RunningNextRow />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a rest day as the answer itself', () => {
    coach = {
      ...base(3),
      next: { kind: 'rest', title: 'היום: מנוחה', detail: '', pace: null, hr: null, reasons: [] },
    };
    render(
      <MemoryRouter>
        <RunningNextRow />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /^מאמן הריצה\s*היום: מנוחה$/ })).toBeInTheDocument();
  });
});
