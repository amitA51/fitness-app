import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineIndicator } from './OfflineIndicator';

const getQueueDepth = vi.fn();
const processQueue = vi.fn();
const getUnsyncedRecordCounts = vi.fn();
const flushUnsyncedSessions = vi.fn();

vi.mock('../../services/offlineQueue', () => ({
  getQueueDepth: () => getQueueDepth(),
  processQueue: () => processQueue(),
}));

vi.mock('../../services/sessionDb', () => ({
  getUnsyncedRecordCounts: () => getUnsyncedRecordCounts(),
  flushUnsyncedSessions: () => flushUnsyncedSessions(),
}));

/** One ledger, two buckets: workouts and everything else (nutrition/water/body). */
const setUnsynced = (sessions: number, others = 0) =>
  getUnsyncedRecordCounts.mockResolvedValue({
    sessions,
    others,
    total: sessions + others,
  });

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
  setUnsynced(0);
  flushUnsyncedSessions.mockResolvedValue({ pushed: 0, queued: 0 });
});

describe('OfflineIndicator', () => {
  it('surfaces queued changes on first render even when the browser is online', async () => {
    getQueueDepth.mockResolvedValue(2);

    render(<OfflineIndicator />);

    expect(await screen.findByText(/פעולות ממתינות לסנכרון/)).toBeInTheDocument();
    expect(screen.getByText('2')).toHaveAttribute('dir', 'ltr');
  });

  it('refreshes queue depth after a manual sync pass', async () => {
    let depth = 1;
    getQueueDepth.mockImplementation(async () => depth);
    processQueue.mockImplementation(async () => {
      depth = 0;
      return { success: 1, failed: 0 };
    });
    const user = userEvent.setup();

    render(<OfflineIndicator />);

    const button = await screen.findByRole('button', { name: 'סנכרן עכשיו' });
    await act(async () => {
      await user.click(button);
    });

    await waitFor(() => expect(processQueue).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'סנכרן עכשיו' })).toBeNull());
  });

  it('isolates queued-change numbers in the offline status text', async () => {
    setOnline(false);
    getQueueDepth.mockResolvedValue(3);

    render(<OfflineIndicator />);

    expect(await screen.findByText('3')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('מצב סנכרון')).toBeInTheDocument();
  });
});

// ── T-111 · the queue-depth blind spot ──────────────────────────────────────
// A workout written while getCurrentUser() returned null (a 401 during token
// refresh) entered NO queue. This component read only queue depth, so it
// rendered nothing at all — "everything is synced" at the exact moment the one
// copy of that workout was on the device.
describe('OfflineIndicator with an empty queue and an unsynced local workout', () => {
  it('warns about the workout instead of rendering nothing', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(1);

    render(<OfflineIndicator />);

    expect(await screen.findByText('אימון אחד שמור במכשיר בלבד')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'סנכרן עכשיו' })).toBeInTheDocument();
  });

  it('keeps the count out of the Hebrew run when there is more than one', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(4);

    render(<OfflineIndicator />);

    expect(await screen.findByText('4')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText(/אימונים שמורים במכשיר בלבד/)).toBeInTheDocument();
  });

  it('flushes the ledger on "סנכרן עכשיו", since processQueue alone cannot see it', async () => {
    getQueueDepth.mockResolvedValue(0);
    let pending = 1;
    getUnsyncedRecordCounts.mockImplementation(async () => ({
      sessions: pending,
      others: 0,
      total: pending,
    }));
    flushUnsyncedSessions.mockImplementation(async () => {
      pending = 0;
      return { pushed: 1, queued: 0 };
    });
    processQueue.mockResolvedValue({ success: 0, failed: 0 });
    const user = userEvent.setup();

    render(<OfflineIndicator />);

    const button = await screen.findByRole('button', { name: 'סנכרן עכשיו' });
    await act(async () => {
      await user.click(button);
    });

    await waitFor(() => expect(flushUnsyncedSessions).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByText('אימון אחד שמור במכשיר בלבד')).not.toBeInTheDocument()
    );
  });

  it('says nothing extra for a guest, whose data is local by design', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(2);

    const { container } = render(<OfflineIndicator isGuest />);

    await waitFor(() => expect(getQueueDepth).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('names the workout in the offline banner too', async () => {
    setOnline(false);
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(1);

    render(<OfflineIndicator />);

    expect(await screen.findByText(/אימון אחד שמור במכשיר בלבד/)).toBeInTheDocument();
    expect(screen.queryByText(/האפליקציה פועלת במצב לא מקוון/)).not.toBeInTheDocument();
  });
});

// ── T-115 · the same blind spot for nutrition / water / body stats ───────────
// The ledger read its markers against WORKOUT_SESSIONS only, so an orphaned meal,
// glass of water or weigh-in was counted by NOTHING here — and then wiped by the
// sign-out routine's Object.values(STORES) loop.
describe('OfflineIndicator with an unsynced record that is not a workout', () => {
  it('warns instead of rendering nothing when only a non-workout record is at risk', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(0, 1);

    render(<OfflineIndicator />);

    expect(await screen.findByText('רשומה אחת שמורה במכשיר בלבד')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'סנכרן עכשיו' })).toBeInTheDocument();
  });

  it('counts several non-workout records with the digit isolated', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(0, 3);

    render(<OfflineIndicator />);

    expect(await screen.findByText('3')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText(/רשומות שמורות במכשיר בלבד/)).toBeInTheDocument();
  });

  it('reports the combined total when a workout and other records are both at risk', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(1, 2);

    render(<OfflineIndicator />);

    // Mixed kinds, so the honest word is רשומות rather than אימונים — and the
    // total must not silently drop the two non-workout rows.
    expect(await screen.findByText('3')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText(/רשומות שמורות במכשיר בלבד/)).toBeInTheDocument();
  });

  it('names the non-workout record in the offline banner too', async () => {
    setOnline(false);
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(0, 1);

    render(<OfflineIndicator />);

    expect(await screen.findByText(/רשומה אחת שמורה במכשיר בלבד/)).toBeInTheDocument();
    expect(screen.queryByText(/האפליקציה פועלת במצב לא מקוון/)).not.toBeInTheDocument();
  });

  it('still renders nothing when there is genuinely nothing at risk', async () => {
    getQueueDepth.mockResolvedValue(0);
    setUnsynced(0, 0);

    const { container } = render(<OfflineIndicator />);

    await waitFor(() => expect(getQueueDepth).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
