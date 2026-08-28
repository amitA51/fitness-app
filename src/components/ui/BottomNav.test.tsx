// ============================================================================
// BottomNav — role-branched navigation tests
// Trainee: בית/אימון/התקדמות + sheet(המאמן שלי, הגדרות). The תזונה tab is
//          hidden while NUTRITION_TRAINEE_UI_ENABLED is off (see
//          constants/featureFlags.ts) — an app admin still gets it.
// Coach:   בית/מתאמנים/הודעות/תוכניות + sheet(האימונים שלי, הגדרות);
//          unread badge moves from "עוד" to the הודעות tab.
// ============================================================================

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomNav from './BottomNav';

// BottomNav branches on the SERVER role (isCoach, from profiles.role) — there is
// no client-side view preference. mockIsCoach drives that role here.
let mockIsCoach = false;
vi.mock('../../contexts/CoachContext', () => ({
  useCoach: () => ({
    isCoach: mockIsCoach,
    role: mockIsCoach ? 'coach' : 'trainee',
  }),
}));

// app_admins membership — the only thing that still surfaces the תזונה tab
// while the nutrition surface is hidden.
let mockIsAppAdmin = false;
vi.mock('../../hooks/useIsAppAdmin', () => ({
  useIsAppAdmin: () => ({ isAdmin: mockIsAppAdmin, loading: false }),
}));

let mockUnread = 0;
vi.mock('../../hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => mockUnread,
}));

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

vi.mock('../../utils/routePrefetch', () => ({
  prefetchRoute: vi.fn(),
}));

const renderNav = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCoach = false;
  mockIsAppAdmin = false;
  mockUnread = 0;
});

describe('BottomNav per role', () => {
  it('renders the trainee tab set for trainees, without the hidden תזונה tab', () => {
    renderNav('/');

    expect(screen.getByRole('link', { name: 'בית' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'אימון' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'התקדמות' })).toBeInTheDocument();
    // Hidden while the owner decides whether the nutrition feature stays.
    expect(screen.queryByRole('link', { name: 'תזונה' })).toBeNull();
    expect(screen.queryByRole('link', { name: /מתאמנים/ })).toBeNull();
  });

  it('keeps the תזונה tab for an app admin so the screen stays reachable', () => {
    mockIsAppAdmin = true;
    renderNav('/');

    expect(screen.getByRole('link', { name: 'תזונה' })).toHaveAttribute('href', '/nutrition');
  });

  it('renders the coach tab set for coaches', () => {
    mockIsCoach = true;
    renderNav('/coach');

    expect(screen.getByRole('link', { name: 'בית' })).toHaveAttribute('href', '/coach');
    expect(screen.getByRole('link', { name: 'מתאמנים' })).toHaveAttribute('href', '/coach/clients');
    expect(screen.getByRole('link', { name: /הודעות/ })).toHaveAttribute('href', '/coach/messages');
    expect(screen.getByRole('link', { name: 'תוכניות' })).toHaveAttribute(
      'href',
      '/coach/programs'
    );
    expect(screen.queryByRole('link', { name: 'תזונה' })).toBeNull();
  });

  it('marks the deepest matching coach tab active (clients over home)', () => {
    mockIsCoach = true;
    renderNav('/coach/clients/abc');

    expect(screen.getByRole('link', { name: 'מתאמנים' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'בית' })).not.toHaveAttribute('aria-current');
  });

  it('puts the unread badge on the הודעות tab for coaches, not on עוד', () => {
    mockIsCoach = true;
    mockUnread = 3;
    renderNav('/coach');

    expect(screen.getByRole('link', { name: 'הודעות (3 הודעות שלא נקראו)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'עוד' })).toBeInTheDocument();
  });

  it('keeps the unread badge on עוד for trainees', () => {
    mockUnread = 2;
    renderNav('/');

    expect(screen.getByRole('button', { name: 'עוד (2 הודעות שלא נקראו)' })).toBeInTheDocument();
  });

  it('offers האימונים שלי in the coach sheet and המאמן שלי in the trainee sheet', async () => {
    const user = userEvent.setup();

    // Trainee sheet
    renderNav('/');
    await user.click(screen.getByRole('button', { name: 'עוד' }));
    expect(await screen.findByRole('link', { name: 'המאמן שלי' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'האימונים שלי' })).toBeNull();
  });

  it('coach sheet exposes the personal-training secondary mode at /me', async () => {
    mockIsCoach = true;
    const user = userEvent.setup();

    renderNav('/coach');
    await user.click(screen.getByRole('button', { name: 'עוד' }));
    const personal = await screen.findByRole('link', { name: 'האימונים שלי' });
    expect(personal).toHaveAttribute('href', '/me');
    expect(screen.queryByRole('link', { name: 'המאמן שלי' })).toBeNull();
  });

  it('marks עוד active while a coach is in personal-training mode', () => {
    mockIsCoach = true;
    renderNav('/me');

    expect(screen.getByRole('button', { name: 'עוד' })).toHaveAttribute('aria-current', 'page');
  });
});
