import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../types';
import WorkoutCalendar from './WorkoutCalendar';

// Two completed sessions on distinct days of the CURRENT month (the calendar
// opens on today's month), so the heatmap has workout days to highlight.
const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const sessions = [
  { id: 's1', date: `${ym}-05`, startTime: `${ym}-05T09:00:00.000Z`, status: 'completed' },
  { id: 's2', date: `${ym}-06`, startTime: `${ym}-06T09:00:00.000Z`, status: 'completed' },
] as unknown as WorkoutSession[];

const renderCalendar = (data: WorkoutSession[]) =>
  render(
    <MemoryRouter>
      <LazyMotion features={domAnimation}>
        <WorkoutCalendar sessions={data} />
      </LazyMotion>
    </MemoryRouter>
  );

describe('WorkoutCalendar', () => {
  it('renders the calendar with its header and monthly stat', () => {
    renderCalendar(sessions);
    expect(screen.getByText('לוח אימונים')).toBeInTheDocument();
    expect(screen.getByText('אימונים החודש')).toBeInTheDocument();
  });

  it('marks exactly the days that have a workout', () => {
    renderCalendar(sessions);
    // Current-month cells with a session carry ", N אימונים" in their aria-label.
    const workoutDays = screen
      .getAllByRole('gridcell')
      .filter((cell) => /אימונים/.test(cell.getAttribute('aria-label') ?? ''));
    expect(workoutDays.length).toBe(2);
  });

  it('renders no workout days for an empty history', () => {
    renderCalendar([]);
    const workoutDays = screen
      .getAllByRole('gridcell')
      .filter((cell) => /אימונים/.test(cell.getAttribute('aria-label') ?? ''));
    expect(workoutDays.length).toBe(0);
  });
});
