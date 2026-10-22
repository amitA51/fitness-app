// ============================================================================
// "/" (RoleHome) never waits on the role reads.
//
// It used to render a full-page loader until profiles / coach_profiles /
// coach_subscriptions had all answered — with an overloaded database, the home
// screen of EVERY user was a spinner. While CoachContext is still loading,
// `isCoach` is the role cached on the last visit: a trainee (or a brand-new
// account, which has no cache) must get the Dashboard at once.
// ============================================================================

import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let coachState = { isCoach: false, loading: true };

vi.mock('../contexts/CoachContext', () => ({
  CoachProvider: ({ children }: { children: unknown }) => children,
  useCoach: () => coachState,
}));

vi.mock('../pages/Dashboard', () => ({
  default: () => <div>DASHBOARD</div>,
}));

import { RoleHome } from '../AppRouter';

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Suspense fallback={<div>LAZY</div>}>
        <Routes>
          <Route path="/" element={<RoleHome />} />
          <Route path="/coach" element={<div>COACH HOME</div>} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  );
}

beforeEach(() => {
  coachState = { isCoach: false, loading: true };
});

describe('RoleHome', () => {
  it('renders the Dashboard while the role is still loading for a non-coach cached role', async () => {
    // Arrange — reads in flight; the cached role (or none) is not 'coach'.
    coachState = { isCoach: false, loading: true };

    // Act
    renderHome();

    // Assert — the Dashboard, not a loader and not the coach shell.
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
    expect(screen.queryByText('COACH HOME')).not.toBeInTheDocument();
  });

  it('sends a cached coach straight to /coach without waiting for the server', () => {
    coachState = { isCoach: true, loading: true };

    renderHome();

    expect(screen.getByText('COACH HOME')).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('renders the Dashboard for a resolved trainee', async () => {
    coachState = { isCoach: false, loading: false };

    renderHome();

    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
  });
});
