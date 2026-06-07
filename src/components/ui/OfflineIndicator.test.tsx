import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineIndicator } from './OfflineIndicator';

const getQueueDepth = vi.fn();
const processQueue = vi.fn();

vi.mock('../../services/offlineQueue', () => ({
  getQueueDepth: () => getQueueDepth(),
  processQueue: () => processQueue(),
}));

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
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
