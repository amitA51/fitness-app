// ============================================================================
// TodaysWorkoutCard — coach-scheduled day on the trainee home
// ============================================================================
// "Start" used to wait for a full fetch of every template before navigating,
// and the card opened a Realtime channel for every signed-in user.
// ============================================================================

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  linkState: { coachIds: ['coach-1'] } as { coachIds: string[] } | null,
  subscribeToUserTable: vi.fn(() => () => {}),
  prepareTemplateForStart: vi.fn(async () => 'local' as const),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../../services/supabaseAuth', () => ({ getCurrentUser: async () => ({ id: 'user-1' }) }));
vi.mock('../../services/coach/messageService', () => ({
  getCoachLinkState: async () => mocks.linkState,
}));
vi.mock('../../services/coach/realtime', () => ({
  subscribeToUserTable: mocks.subscribeToUserTable,
}));
vi.mock('../../services/coach/scheduleService', () => ({
  getTodaysScheduledWorkouts: async () => [
    {
      id: 'w1',
      coachId: 'coach-1',
      userId: 'user-1',
      templateId: 't1',
      assignmentId: null,
      scheduledDate: '2026-10-22',
      title: 'רגליים',
      status: 'planned',
      sessionId: null,
      completedAt: null,
    },
  ],
  markScheduleStatus: vi.fn(async () => ({ error: null })),
}));
vi.mock('../../services/supabaseSyncOrchestrator', () => ({
  prepareTemplateForStart: mocks.prepareTemplateForStart,
}));

import { COACH_LINK_STATE_EVENT } from '../../services/coach/coachLinkEvents';
import { TodaysWorkoutCard } from './TodaysWorkoutCard';

const renderCard = () =>
  render(
    <MemoryRouter>
      <TodaysWorkoutCard />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.linkState = { coachIds: ['coach-1'] };
  mocks.prepareTemplateForStart.mockResolvedValue('local');
});

describe('TodaysWorkoutCard', () => {
  it('starts at once when the workout is ready', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole('button', { name: /התחל רגליים/ }));

    expect(mocks.prepareTemplateForStart).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/workout/t1'));
  });

  it('shows an inline error with a retry when the workout cannot be loaded', async () => {
    const user = userEvent.setup();
    mocks.prepareTemplateForStart.mockRejectedValueOnce(new Error('did not settle'));
    renderCard();

    await user.click(await screen.findByRole('button', { name: /התחל רגליים/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'לא הצלחנו לטעון את האימון. בדקו את החיבור ונסו שוב.'
    );
    expect(mocks.navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'נסו שוב' }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/workout/t1'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('subscribes to schedule changes only for a trainee with a coach', async () => {
    renderCard();
    await screen.findByText('רגליים');
    await waitFor(() =>
      expect(mocks.subscribeToUserTable).toHaveBeenCalledWith(
        'workout_schedule',
        'user-1',
        expect.any(Function)
      )
    );
  });

  it('opens no channel when nobody can change the schedule', async () => {
    mocks.linkState = { coachIds: [] };
    renderCard();
    await screen.findByText('רגליים');
    // Give the post-load subscription step a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.subscribeToUserTable).not.toHaveBeenCalled();
  });

  it('opens the schedule channel when a coach link appears after the first load', async () => {
    mocks.linkState = { coachIds: [] };
    renderCard();
    await screen.findByText('רגליים');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.subscribeToUserTable).not.toHaveBeenCalled();

    // An invite accepted on this device (or a failed probe that now has an answer).
    mocks.linkState = { coachIds: ['coach-1'] };
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });

    await waitFor(() =>
      expect(mocks.subscribeToUserTable).toHaveBeenCalledWith(
        'workout_schedule',
        'user-1',
        expect.any(Function)
      )
    );
  });

  it('closes the channel when the coach link ends', async () => {
    const unsubscribe = vi.fn();
    mocks.subscribeToUserTable.mockReturnValueOnce(unsubscribe);
    renderCard();
    await waitFor(() => expect(mocks.subscribeToUserTable).toHaveBeenCalledOnce());

    mocks.linkState = { coachIds: [] };
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
  });
});
