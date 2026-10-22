// ============================================================================
// useUnreadMessages — the BottomNav badge poll
// ============================================================================
// It polled every 30 s in every tab, visible or not, with 3–5 queries a tick,
// for every user — including the majority who have no coach and no group.
// ============================================================================

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  linkState: null as null | {
    links: { coachId: string; clientId: string }[];
    coachIds: string[];
    hasClients: boolean;
    hasGroups: boolean;
  },
  getUnreadCount: vi.fn(async (_links?: unknown) => 2),
  getGroupUnreadCount: vi.fn(async () => 1),
  getCoachLinkState: vi.fn(),
  invalidateCoachLinkStateIfNoLinks: vi.fn(),
}));

vi.mock('../../services/supabaseAuth', () => ({ getCurrentUser: async () => ({ id: 'user-1' }) }));
vi.mock('../../services/coach/messageService', () => ({
  getCoachLinkState: () => mocks.getCoachLinkState(),
  getUnreadCount: (links: unknown) => mocks.getUnreadCount(links),
  invalidateCoachLinkStateIfNoLinks: () => mocks.invalidateCoachLinkStateIfNoLinks(),
  hasMessagingPeers: (s: { links: unknown[]; hasGroups: boolean }) =>
    s.links.length > 0 || s.hasGroups,
}));
vi.mock('../../services/coach/groupMessageService', () => ({
  getGroupUnreadCount: () => mocks.getGroupUnreadCount(),
}));

import { COACH_LINK_STATE_EVENT } from '../../services/coach/coachLinkEvents';
import { UNREAD_POLL_MS, resetUnreadMessagesCache, useUnreadMessages } from '../useUnreadMessages';

const coached = {
  links: [{ coachId: 'coach-1', clientId: 'user-1' }],
  coachIds: ['coach-1'],
  hasClients: false,
  hasGroups: true,
};

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** Let the hook's promise chain settle inside act(). */
const flush = () => act(async () => {});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.clearAllMocks();
  resetUnreadMessagesCache();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  mocks.getCoachLinkState.mockImplementation(async () => mocks.linkState);
  mocks.linkState = coached;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUnreadMessages', () => {
  it('sends no unread queries for a user with no coach and no group', async () => {
    mocks.linkState = { links: [], coachIds: [], hasClients: false, hasGroups: false };

    const { result } = renderHook(() => useUnreadMessages());
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(UNREAD_POLL_MS * 3);
    });
    await flush();

    expect(result.current).toBe(0);
    expect(mocks.getUnreadCount).not.toHaveBeenCalled();
    expect(mocks.getGroupUnreadCount).not.toHaveBeenCalled();
  });

  it('counts direct and group messages, reusing the cached links', async () => {
    const { result } = renderHook(() => useUnreadMessages());
    await flush();

    expect(result.current).toBe(3);
    expect(mocks.getUnreadCount).toHaveBeenCalledWith(coached.links);
  });

  it('polls every few minutes, not every 30 seconds', async () => {
    renderHook(() => useUnreadMessages());
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(UNREAD_POLL_MS);
    });
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('stops while hidden and refreshes on return only when the answer is stale', async () => {
    renderHook(() => useUnreadMessages());
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    await act(async () => {
      vi.advanceTimersByTime(UNREAD_POLL_MS * 4);
    });
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);

    // Back after a long time away: refreshed at once.
    act(() => setVisibility('visible'));
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(2);

    // A quick hide/show right after: the answer is fresh, so no new request.
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('shares one request between instances and across a remount', async () => {
    let release = (_count: number) => {};
    mocks.getUnreadCount.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        })
    );

    const first = renderHook(() => useUnreadMessages());
    const second = renderHook(() => useUnreadMessages());
    await flush();
    await act(async () => release(4));
    await flush();

    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(first.result.current).toBe(5);
    expect(second.result.current).toBe(5);

    // BottomNav remounts after every workout: the fresh answer is reused.
    first.unmount();
    second.unmount();
    renderHook(() => useUnreadMessages());
    await flush();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('refreshes immediately when a thread is opened or read', async () => {
    renderHook(() => useUnreadMessages());
    await flush();

    act(() => {
      window.dispatchEvent(new Event('coach:unread-refresh'));
    });
    await flush();

    // Only a cached "no links" answer is dropped (see invalidateCoachLinkStateIfNoLinks):
    // a thread with messages in it proves a link exists.
    expect(mocks.invalidateCoachLinkStateIfNoLinks).toHaveBeenCalledOnce();
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('counts again when the coach-link state changes (an invite accepted here)', async () => {
    mocks.linkState = { links: [], coachIds: [], hasClients: false, hasGroups: false };
    const { result } = renderHook(() => useUnreadMessages());
    await flush();
    expect(result.current).toBe(0);

    mocks.linkState = coached;
    act(() => {
      window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
    });
    await flush();

    expect(result.current).toBe(3);
  });
});
