// ============================================================================
// CoachContext — role SSOT tests
// isCoach must derive from profiles.role (server), with coach_profiles as a
// resilience fallback; pending guest coach intent promotes via enableCoachMode.
// ============================================================================

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachProvider, useCoach } from '../CoachContext';

const getMyCoachProfile = vi.fn();
const getMySubscription = vi.fn();
const enableCoachMode = vi.fn();
const getMyProfile = vi.fn();

vi.mock('../../services/coach', () => ({
  getMyCoachProfile: () => getMyCoachProfile(),
  getMySubscription: () => getMySubscription(),
  enableCoachMode: (name?: string) => enableCoachMode(name),
}));

vi.mock('../../services/coach/profileService', () => ({
  getMyProfile: () => getMyProfile(),
}));

let authStatus = 'authenticated';
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ status: authStatus }),
}));

function Probe() {
  const { isCoach, role, loading, viewMode, isCoachView, canSwitchView, setViewMode } = useCoach();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="isCoach">{String(isCoach)}</span>
      <span data-testid="viewMode">{viewMode}</span>
      <span data-testid="isCoachView">{String(isCoachView)}</span>
      <span data-testid="canSwitchView">{String(canSwitchView)}</span>
      <button type="button" onClick={() => void setViewMode('coach')}>
        toCoach
      </button>
      <button type="button" onClick={() => void setViewMode('trainee')}>
        toTrainee
      </button>
    </div>
  );
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

  it('honors a pending guest coach intent by promoting once after sign-in', async () => {
    localStorage.setItem('pending_coach_intent', 'true');
    getMyProfile.mockResolvedValue({
      id: 'u1',
      displayName: 'x',
      avatarUrl: null,
      role: 'trainee',
    });
    getMyCoachProfile.mockResolvedValue(null);
    enableCoachMode.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(enableCoachMode).toHaveBeenCalledOnce());
    expect(localStorage.getItem('pending_coach_intent')).toBeNull();
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

describe('CoachContext active view mode', () => {
  it('defaults the active view to the resolved role (coach → coach view)', async () => {
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('viewMode')).toHaveTextContent('coach'));
    expect(screen.getByTestId('isCoachView')).toHaveTextContent('true');
  });

  it('defaults a trainee to the trainee view but lets anyone switch (demo)', async () => {
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

    await waitFor(() => expect(screen.getByTestId('viewMode')).toHaveTextContent('trainee'));
    expect(screen.getByTestId('isCoachView')).toHaveTextContent('false');
    expect(screen.getByTestId('canSwitchView')).toHaveTextContent('true');
  });

  it('lazily enables coach mode and persists the choice when a trainee switches to coach view', async () => {
    getMyProfile.mockResolvedValue({
      id: 'u1',
      displayName: 'x',
      avatarUrl: null,
      role: 'trainee',
    });
    getMyCoachProfile.mockResolvedValue(null);
    enableCoachMode.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('viewMode')).toHaveTextContent('trainee'));

    fireEvent.click(screen.getByRole('button', { name: 'toCoach' }));

    await waitFor(() => expect(screen.getByTestId('isCoachView')).toHaveTextContent('true'));
    expect(enableCoachMode).toHaveBeenCalled();
    expect(localStorage.getItem('view_mode')).toBe('coach');
  });

  it('respects an explicit stored view choice over the resolved role', async () => {
    // A coach who previously stepped into their personal trainee side.
    localStorage.setItem('view_mode', 'trainee');
    getMyProfile.mockResolvedValue({ id: 'u1', displayName: 'x', avatarUrl: null, role: 'coach' });
    getMyCoachProfile.mockResolvedValue({ id: 'u1', businessName: null, bio: null, settings: {} });

    render(
      <CoachProvider>
        <Probe />
      </CoachProvider>
    );

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('coach'));
    expect(screen.getByTestId('viewMode')).toHaveTextContent('trainee');
    expect(screen.getByTestId('isCoachView')).toHaveTextContent('false');
  });
});
