import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../../../types';
import { buildCardioSession } from '../../../../utils/cardio';
import CardioPage from '../../CardioPage';
import RunningCoachPage from '../../RunningCoachPage';

const authUser: { id: string } | null = { id: 'u1' };
const clearGuest = vi.fn();
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser, clearGuest }),
}));
vi.mock('../../../../services/localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));

let sessions: WorkoutSession[] = [];
vi.mock('../../../../contexts/DataContext', () => ({
  useData: () => ({
    sessions,
    loading: false,
    isFirstLoad: false,
    error: null,
    refreshData: vi.fn(),
  }),
}));

const DAY = 24 * 60 * 60 * 1000;
const run = (daysAgo: number, km: number, sec: number) =>
  buildCardioSession({
    activity: 'run',
    startTime: new Date(Date.now() - daysAgo * DAY).toISOString(),
    durationSec: sec,
    distanceKm: km,
  });

const isoIn = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cardio" element={<CardioPage />} />
        <Route path="/cardio/coach" element={<RunningCoachPage />} />
        <Route path="/cardio/live" element={<p>מסך ריצה חיה</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('RunningCoachPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessions = [];
  });
  afterEach(() => localStorage.clear());

  it('starts a new runner with run-walk and invites a goal', () => {
    renderAt('/cardio/coach');

    expect(screen.getByRole('heading', { name: 'הריצה הראשונה' })).toBeInTheDocument();
    expect(screen.getByText('ריצה-הליכה כ-25 דקות')).toBeInTheDocument();
    expect(screen.getByText(/הקצבים האישיים יופיעו אחרי ריצה של 3 ק״מ/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'הגדירו מטרה' }));
    expect(screen.getByRole('dialog', { name: 'מטרה חדשה' })).toBeInTheDocument();
  });

  it('sends the runner to the live tracker from the next-run card', () => {
    renderAt('/cardio/coach');
    fireEvent.click(screen.getByRole('button', { name: 'התחילו ריצה' }));
    expect(screen.getByText('מסך ריצה חיה')).toBeInTheDocument();
  });

  it('shows the goal, the prediction and personal paces once there are runs', () => {
    sessions = [run(2, 5, 25 * 60), run(5, 8, 48 * 60), run(9, 6, 36 * 60)];
    localStorage.setItem(
      'running_goal_v1',
      JSON.stringify({
        distanceKm: 10,
        label: '10 ק״מ',
        raceDate: isoIn(60),
        targetSec: 50 * 60,
        createdAt: new Date().toISOString(),
      })
    );
    renderAt('/cardio/coach');

    expect(screen.getByRole('heading', { name: 'הריצה הבאה' })).toBeInTheDocument();
    const goal = screen.getByRole('region', { name: 'המטרה' });
    expect(within(goal).getByText('10 ק״מ')).toBeInTheDocument();
    expect(within(goal).getByText('תחזית היום')).toBeInTheDocument();
    expect(within(goal).getByText(/עוד \d+ שבועות/)).toBeInTheDocument();

    const paces = screen.getByRole('region', { name: 'הקצבים שלכם' });
    expect(within(paces).getByText('קל וארוך')).toBeInTheDocument();
    expect(within(paces).getByText('טמפו (סף)')).toBeInTheDocument();
  });

  it('offers a new goal once the race date has passed', () => {
    localStorage.setItem(
      'running_goal_v1',
      JSON.stringify({
        distanceKm: 5,
        label: '5 ק״מ',
        raceDate: isoIn(-3),
        targetSec: null,
        createdAt: new Date().toISOString(),
      })
    );
    renderAt('/cardio/coach');
    expect(screen.getByRole('heading', { name: 'המרוץ עבר — מה הלאה?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'מטרה חדשה' }));
    expect(screen.getByRole('dialog', { name: 'מטרה חדשה' })).toBeInTheDocument();
  });
});

describe('the coach card on /cardio', () => {
  beforeEach(() => {
    localStorage.clear();
    sessions = [];
  });

  it('shows the next run and opens the coach', () => {
    renderAt('/cardio');
    const card = screen.getByRole('button', { name: /מאמן הריצה/ });
    expect(card).toHaveTextContent('ריצה-הליכה כ-25 דקות');
    expect(card).toHaveTextContent('עוד אין מטרה · הגדירו אחת');

    fireEvent.click(card);
    expect(screen.getByRole('heading', { name: 'הריצה הראשונה' })).toBeInTheDocument();
  });

  it('counts only completed sessions in the week line', () => {
    const done = run(0, 5, 30 * 60);
    const abandoned = { ...run(0, 7, 40 * 60), status: 'cancelled' } as WorkoutSession;
    sessions = [done, abandoned];
    renderAt('/cardio');
    expect(screen.getByText(/השבוע:/)).toHaveTextContent(/5\s*ק״מ/);
    expect(screen.getByText(/השבוע:/)).toHaveTextContent(/1\s*פעילות/);
  });
});
