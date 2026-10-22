// ============================================================================
// CoachContext — role SSOT tests
// isCoach must derive from profiles.role (server), with coach_profiles as a
// resilience fallback. There is NO client-side view mode and no self-serve
// promotion: nothing local may flip a user's shell or grant coach status.
// ============================================================================

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachProvider, READ_WAIT_MS, useCoach } from '../CoachContext';

const getMyCoachProfile = vi.fn();
const getMySubscription = vi.fn();
const getMyProfile = vi.fn();

vi.mock('../../services/coach', () => ({
  getMyCoachProfile: () => getMyCoachProfile(),
  getMySubscription: () => getMySubscription(),
}));

vi.mock('../../services/coach/profileService', () => ({
  getMyProfile: () => getMyProfile(),
}));

let authStatus = 'authenticated';
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ status: authStatus }),
}));

function Probe() {
  const { isCoach, role, loading } = useCoach();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="isCoach">{String(isCoach)}</span>
    </div>
  );
}

/** Surfaces the context's public surface so a re-introduced view switch fails here. */
function ApiProbe() {
  return <span data-testid="api">{Object.keys(useCoach()).sort().join(' ')}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authStatus = 'authenticated';
  getMySubscription.mockResolvedValue(null);
});

describe('CoachContext role SSOT', () => {
  it('derives isCoach=true from profiles.role even without a loaded coach profile', async () => {
    // Arrange: server says coach; coach_profiles read failed/empty.
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue(null);

    // Act
    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    // Assert
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('coach'));
    expect(screen.getByTestId('isCoach')).toHaveTextContent('true');
  });

  it('derives isCoach=false for a trainee role even when stale coach data exists', async () => {
    getMyProfile.mockResolvedValue({
      id: 'u1',
      displayName: 'x',
      avatarUrl: null,
      role: 'trainee',
    });
    getMyCoachProfile.mockResolvedValue(null);

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('trainee'));
    expect(screen.getByTestId('isCoach')).toHaveTextContent('false');
  });

  it('falls back to coach_profiles existence when the profile read fails', async () => {
    getMyProfile.mockResolvedValue(null);
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('isCoach')).toHaveTextContent('true'));
  });

  it('caches the resolved role for first-paint hints', async () => {
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(localStorage.getItem('cached_role')).toBe('coach'));
  });

  it('treats guests as trainees without hitting the network', async () => {
    authStatus = 'guest';

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('null'));
    expect(screen.getByTestId('isCoach')).toHaveTextContent('false');
    expect(getMyProfile).not.toHaveBeenCalled();
  });
});

describe('CoachContext — a slow or failing server never holds the app', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`stops loading after ${READ_WAIT_MS} ms when the server never answers, keeping the cached role`, async () => {
    vi.useFakeTimers();
    localStorage.setItem('cached_role', 'coach');
    const never = new Promise<never>(() => {});
    getMyProfile.mockReturnValue(never);
    getMyCoachProfile.mockReturnValue(never);
    getMySubscription.mockReturnValue(never);

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(READ_WAIT_MS + 1);
    });

    expect(screen.getByTestId('role')).toHaveTextContent('coach');
    expect(screen.getByTestId('isCoach')).toHaveTextContent('true');
  });

  it('applies a server answer that lands after the cap', async () => {
    vi.useFakeTimers();
    let answer: (v: unknown) => void = () => {};
    getMyProfile.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    getMyCoachProfile.mockResolvedValue(null);

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READ_WAIT_MS + 1);
    });
    expect(screen.getByTestId('role')).toHaveTextContent('null');

    await act(async () => {
      answer({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    });

    expect(screen.getByTestId('role')).toHaveTextContent('coach');
    expect(localStorage.getItem('cached_role')).toBe('coach');
  });

  it('keeps the cached coach role when every read fails (the reads return null on error)', async () => {
    localStorage.setItem('cached_role', 'coach');
    getMyProfile.mockResolvedValue(null);
    getMyCoachProfile.mockResolvedValue(null);

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('coach'));
    expect(localStorage.getItem('cached_role')).toBe('coach');
  });

  it('uses the reads that succeeded when another one throws', async () => {
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockRejectedValue(new Error('503'));

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('isCoach')).toHaveTextContent('true'));
  });
});

describe('CoachContext — no client-side view mode', () => {
  it('exposes no view-switch or self-promotion API (the shell follows the server role only)', async () => {
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <ApiProbe />
      </CoachProvider>
    );

    const api = await screen.findByTestId('api');
    // Exact surface: a re-introduced view-switch or `enable` member fails here.
    expect(api.textContent).toBe('coachProfile disable isCoach loading refresh role subscription');
  });

  it('cannot be promoted by a leftover local view preference (trainee stays trainee)', async () => {
    // A stale key from the old mode switch must never grant the coach shell.
    localStorage.setItem('view_mode', 'coach');
    getMyProfile.mockResolvedValue({
      id: 'u1',
      displayName: 'x',
      avatarUrl: null,
      role: 'trainee',
    });
    getMyCoachProfile.mockResolvedValue(null);

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('trainee'));
    expect(screen.getByTestId('isCoach')).toHaveTextContent('false');
  });

  it('cannot be demoted by a leftover local view preference (coach stays coach)', async () => {
    localStorage.setItem('view_mode', 'trainee');
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('coach'));
    expect(screen.getByTestId('isCoach')).toHaveTextContent('true');
  });

  it('never persists a view preference of its own', async () => {
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('isCoach')).toHaveTextContent('true'));
    expect(localStorage.getItem('view_mode')).toBeNull();
  });
});
