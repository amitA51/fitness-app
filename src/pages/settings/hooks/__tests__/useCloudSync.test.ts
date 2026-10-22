import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression guard: sync failures must surface friendly Hebrew, never the raw
// internal English error string (e.g. "fetch failed: recoveryLogs ..."). The
// raw string is logged for debugging instead.

const RAW_ERROR = 'fetch failed: recoveryLogs schema mismatch';

type MockSyncResult = { success: boolean; error: string | null; syncedItems: number };

const { syncAllDataSpy, pullAllDataSpy } = vi.hoisted(() => ({
  syncAllDataSpy: vi.fn(
    async (): Promise<{ success: boolean; error: string | null; syncedItems: number }> => ({
      success: false,
      error: 'fetch failed: recoveryLogs schema mismatch',
      syncedItems: 0,
    })
  ),
  pullAllDataSpy: vi.fn(
    async (): Promise<{ success: boolean; error: string | null; syncedItems: number }> => ({
      success: false,
      error: 'fetch failed: recoveryLogs schema mismatch',
      syncedItems: 0,
    })
  ),
}));

vi.mock('../../../../lib/supabase', () => ({ isSupabaseConfigured: vi.fn(() => true) }));
vi.mock('../../../../services/supabaseSync', () => ({
  testConnection: vi.fn(async () => true),
  syncAllData: syncAllDataSpy,
  pullAllData: pullAllDataSpy,
}));
vi.mock('../../../../services/offlineQueue', () => ({
  getQueueDepth: vi.fn(async () => 0),
}));

import { testConnection } from '../../../../services/supabaseSync';
import { CONNECTION_CHECK_TIMEOUT_MS, useCloudSync } from '../useCloudSync';

beforeEach(() => {
  vi.clearAllMocks();
  const failure: MockSyncResult = { success: false, error: RAW_ERROR, syncedItems: 0 };
  syncAllDataSpy.mockResolvedValue(failure);
  pullAllDataSpy.mockResolvedValue(failure);
});

async function renderConnectedHook() {
  const hook = renderHook(() => useCloudSync());
  await waitFor(() => expect(hook.result.current.cloudConnected).toBe(true));
  return hook;
}

describe('useCloudSync — friendly Hebrew error mapping', () => {
  it('upload failure shows Hebrew copy, not the raw internal error', async () => {
    const { result, unmount } = await renderConnectedHook();

    await act(async () => {
      await result.current.handleSyncToCloud();
    });

    expect(result.current.syncMessage).toBe('שגיאה בהעלאה לענן — נסו שוב');
    expect(result.current.syncMessage).not.toContain('fetch failed');
    unmount();
  });

  it('pull failure shows Hebrew copy, not the raw internal error', async () => {
    const { result, unmount } = await renderConnectedHook();

    await act(async () => {
      await result.current.handlePullFromCloud();
    });

    expect(result.current.syncMessage).toBe('שגיאה בטעינה מהענן — נסו שוב');
    unmount();
  });

  it('sync-all failure (upload phase) shows Hebrew copy', async () => {
    const { result, unmount } = await renderConnectedHook();

    await act(async () => {
      await result.current.handleSyncAll();
    });

    expect(result.current.syncMessage).toBe('שגיאה בסנכרון — נסו שוב');
    unmount();
  });

  it('sync-all failure (pull phase) shows Hebrew copy', async () => {
    syncAllDataSpy.mockResolvedValue({ success: true, error: null, syncedItems: 3 });
    const { result, unmount } = await renderConnectedHook();

    await act(async () => {
      await result.current.handleSyncAll();
    });

    expect(result.current.syncMessage).toBe('שגיאה בסנכרון — נסו שוב');
    unmount();
  });
});

describe('useCloudSync — connection status never waits on a slow server', () => {
  it('starts from local knowledge (configured + online), not "לא מחובר"', () => {
    // The check never answers — the first render must not depend on it.
    vi.mocked(testConnection).mockImplementationOnce(() => new Promise<boolean>(() => {}));

    const { result, unmount } = renderHook(() => useCloudSync());

    expect(result.current.cloudConnected).toBe(true);
    unmount();
  });

  it('keeps the status when the check is merely slow (past the cap)', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(testConnection).mockImplementationOnce(() => new Promise<boolean>(() => {}));
      const { result, unmount } = renderHook(() => useCloudSync());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CONNECTION_CHECK_TIMEOUT_MS + 1);
      });

      expect(result.current.cloudConnected).toBe(true);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows disconnected when the server answers that it is unreachable', async () => {
    vi.mocked(testConnection).mockResolvedValueOnce(false);

    const { result, unmount } = renderHook(() => useCloudSync());

    await waitFor(() => expect(result.current.cloudConnected).toBe(false));
    unmount();
  });

  it('follows the device network: offline at once, online re-checks', async () => {
    const { result, unmount } = renderHook(() => useCloudSync());
    await waitFor(() => expect(testConnection).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.cloudConnected).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.cloudConnected).toBe(true));
    expect(testConnection).toHaveBeenCalledTimes(2);
    unmount();
  });
});
