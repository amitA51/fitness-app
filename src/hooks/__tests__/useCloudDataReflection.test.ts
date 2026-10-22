// ============================================================================
// useCloudDataReflection — trainee-side reflection of coach edits
// ============================================================================
// It used to pull every table in full on every mount, open seven Realtime
// channels for EVERY user, and refetch a whole table on every row event. Now:
// a throttled incremental pull, channels only for a coach-linked user, and a
// refetch of just the rows an event names.
// ============================================================================

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTableChange } from '../../services/coach/realtime';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'user-1' } as { id: string } | null, isGuest: false },
  linkState: null as null | { coachIds: string[] },
  subscriptions: [] as Array<{ table: string; onChange: (c: UserTableChange) => void }>,
  unsubscribe: vi.fn(),
  pullAllDataIfStale: vi.fn(async () => ({ success: true, skipped: true })),
  pullAllData: vi.fn(async () => ({ success: true })),
  pullTableRows: vi.fn(async (_table: string, _ids?: string[]) => 1),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../services/coach/messageService', () => ({
  getCoachLinkState: async () => mocks.linkState,
}));
vi.mock('../../services/coach/realtime', () => ({
  subscribeToUserTable: (
    table: string,
    _userId: string,
    onChange: (c: UserTableChange) => void
  ) => {
    mocks.subscriptions.push({ table, onChange });
    return mocks.unsubscribe;
  },
}));
vi.mock('../../services/supabaseSyncOrchestrator', () => ({
  pullAllDataIfStale: () => mocks.pullAllDataIfStale(),
  pullAllData: () => mocks.pullAllData(),
  pullTableRows: (table: string, ids?: string[]) => mocks.pullTableRows(table, ids),
}));
vi.mock('../../services/dataEvents', () => ({
  emitWorkoutSaved: vi.fn(),
  emitTemplatesChanged: vi.fn(),
}));

import { COACH_LINK_STATE_EVENT } from '../../services/coach/coachLinkEvents';
import { useCloudDataReflection } from '../useCloudDataReflection';

const flush = () => act(async () => {});
const fire = (table: string, change: UserTableChange) => {
  for (const sub of mocks.subscriptions.filter((s) => s.table === table)) sub.onChange(change);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  mocks.auth = { user: { id: 'user-1' }, isGuest: false };
  mocks.linkState = { coachIds: ['coach-1'] };
  mocks.subscriptions = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCloudDataReflection', () => {
  it('runs the throttled routine pull on mount, never an unconditional full pull', async () => {
    renderHook(() => useCloudDataReflection());
    await flush();

    expect(mocks.pullAllDataIfStale).toHaveBeenCalledOnce();
    expect(mocks.pullAllData).not.toHaveBeenCalled();
  });

  it('opens no Realtime channel for a user without a coach', async () => {
    mocks.linkState = { coachIds: [] };
    renderHook(() => useCloudDataReflection());
    await flush();

    expect(mocks.subscriptions).toEqual([]);
  });

  it('opens no channel while the coach link is unknown (offline)', async () => {
    mocks.linkState = null;
    renderHook(() => useCloudDataReflection());
    await flush();

    expect(mocks.subscriptions).toEqual([]);
  });

  it('subscribes to the coach-writable tables for a coach-linked user, and cleans up', async () => {
    const { unmount } = renderHook(() => useCloudDataReflection());
    await flush();

    expect(mocks.subscriptions.map((s) => s.table)).toHaveLength(7);
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(7);
  });

  it('opens the channels as soon as an invite is accepted, and closes them on a disconnect', async () => {
    mocks.linkState = { coachIds: [] };
    renderHook(() => useCloudDataReflection());
    await flush();
    expect(mocks.subscriptions).toEqual([]);

    // acceptInvite → notifyCoachLinksChanged → COACH_LINK_STATE_EVENT
    mocks.linkState = { coachIds: ['coach-1'] };
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });
    await flush();
    expect(mocks.subscriptions).toHaveLength(7);

    mocks.linkState = { coachIds: [] };
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });
    await flush();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(7);
  });

  it('stops listening for link changes once unmounted', async () => {
    mocks.linkState = { coachIds: [] };
    const { unmount } = renderHook(() => useCloudDataReflection());
    await flush();
    unmount();

    mocks.linkState = { coachIds: ['coach-1'] };
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });
    await flush();
    expect(mocks.subscriptions).toEqual([]);
  });

  it('refetches only the rows the events named, once per burst', async () => {
    renderHook(() => useCloudDataReflection());
    await flush();

    fire('workout_sessions', { eventType: 'UPDATE', id: 's1' });
    fire('workout_sessions', { eventType: 'UPDATE', id: 's2' });
    await act(async () => {
      vi.advanceTimersByTime(1_200);
    });
    await flush();

    expect(mocks.pullTableRows).toHaveBeenCalledOnce();
    expect(mocks.pullTableRows).toHaveBeenCalledWith('workout_sessions', ['s1', 's2']);
  });

  it('falls back to a catch-up of the table when an event names no row', async () => {
    renderHook(() => useCloudDataReflection());
    await flush();

    fire('nutrition_logs', { eventType: 'DELETE', id: null });
    await act(async () => {
      vi.advanceTimersByTime(1_200);
    });
    await flush();

    expect(mocks.pullTableRows).toHaveBeenCalledWith('nutrition_logs', undefined);
  });

  it('does nothing for a guest', async () => {
    mocks.auth = { user: null, isGuest: true };
    renderHook(() => useCloudDataReflection());
    await flush();

    expect(mocks.pullAllDataIfStale).not.toHaveBeenCalled();
    expect(mocks.subscriptions).toEqual([]);
  });
});

describe('toUserTableChange', () => {
  it('reads the id from the new row, or from the old one for a delete', async () => {
    // The module is mocked above for the hook; this checks the real parser.
    const { toUserTableChange } = await vi.importActual<
      typeof import('../../services/coach/realtime')
    >('../../services/coach/realtime');
    expect(toUserTableChange({ eventType: 'UPDATE', new: { id: 'a' }, old: {} })).toEqual({
      eventType: 'UPDATE',
      id: 'a',
    });
    expect(toUserTableChange({ eventType: 'DELETE', new: {}, old: { id: 'b' } })).toEqual({
      eventType: 'DELETE',
      id: 'b',
    });
    expect(toUserTableChange(undefined)).toEqual({ eventType: 'UNKNOWN', id: null });
  });
});
