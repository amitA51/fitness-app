// ============================================================================
// getCoachLinkState — "can anyone else reach this user?", asked once and cached
// ============================================================================
// The unread badge, the BottomNav chat entry and the Realtime gating all read
// it, so it must cost one probe per user per TTL — never one per caller.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  queries: [] as string[],
  retryFlags: [] as boolean[],
  fail: false,
  links: [] as Array<{ coach_id: string; client_id: string }>,
  groups: [] as unknown[],
  /** When set, every read waits for it — a probe held on the wire. */
  gate: null as Promise<void> | null,
}));

vi.mock('../mappers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mappers')>()),
  requireClient: () => ({
    from: (table: string) => {
      db.queries.push(table);
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'or', 'eq', 'limit']) b[m] = () => b;
      b.retry = (enabled: boolean) => {
        db.retryFlags.push(enabled);
        return b;
      };
      // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
      b.then = (resolve: (v: unknown) => unknown) => {
        // Read when the query is SENT, like the server would.
        const reply = db.fail
          ? { data: null, error: { message: 'PGRST003' } }
          : { data: table === 'coach_clients' ? db.links : db.groups, error: null };
        return (db.gate ?? Promise.resolve()).then(() => reply).then(resolve);
      };
      return b;
    },
  }),
}));
vi.mock('../../supabaseAuth', () => ({ getCurrentUser: async () => ({ id: 'user-1' }) }));

import { COACH_LINK_STATE_EVENT, notifyCoachLinksChanged } from '../coachLinkEvents';
import {
  getCoachLinkState,
  hasMessagingPeers,
  invalidateCoachLinkState,
  invalidateCoachLinkStateIfNoLinks,
} from '../messageService';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.parse('2026-10-22T08:00:00.000Z'));
  invalidateCoachLinkState();
  db.queries = [];
  db.retryFlags = [];
  db.fail = false;
  db.links = [];
  db.groups = [];
  db.gate = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCoachLinkState', () => {
  it('splits links by role and reports no peers for a self-guided user', async () => {
    const alone = await getCoachLinkState();
    expect(alone).toEqual({ links: [], coachIds: [], hasClients: false, hasGroups: false });
    expect(alone && hasMessagingPeers(alone)).toBe(false);

    invalidateCoachLinkState();
    db.links = [
      { coach_id: 'coach-1', client_id: 'user-1' },
      { coach_id: 'user-1', client_id: 'client-9' },
    ];
    const both = await getCoachLinkState();
    expect(both?.coachIds).toEqual(['coach-1']);
    expect(both?.hasClients).toBe(true);
  });

  it('asks the server once for concurrent callers, then serves the cache', async () => {
    await Promise.all([getCoachLinkState(), getCoachLinkState(), getCoachLinkState()]);
    expect(db.queries).toHaveLength(3); // one probe = three tiny reads
    expect(db.retryFlags.every((flag) => flag === false)).toBe(true);

    vi.setSystemTime(Date.now() + 9 * 60_000);
    await getCoachLinkState();
    expect(db.queries).toHaveLength(3);

    vi.setSystemTime(Date.now() + 2 * 60_000);
    await getCoachLinkState();
    expect(db.queries).toHaveLength(6);
  });

  it('answers null after a failed probe and asks again only a minute later', async () => {
    db.fail = true;
    expect(await getCoachLinkState()).toBeNull();
    expect(await getCoachLinkState()).toBeNull();
    expect(db.queries).toHaveLength(3);

    db.fail = false;
    vi.setSystemTime(Date.now() + 61_000);
    expect(await getCoachLinkState()).not.toBeNull();
    expect(db.queries).toHaveLength(6);
  });
});

describe('getCoachLinkState after a link changes on this device', () => {
  it('asks the server again at once, instead of serving "no coach" for ten minutes', async () => {
    const before = await getCoachLinkState();
    expect(before?.coachIds).toEqual([]);

    // The trainee accepts an invite (inviteService.acceptInvite announces it).
    db.links = [{ coach_id: 'coach-1', client_id: 'user-1' }];
    const heard = vi.fn();
    window.addEventListener(COACH_LINK_STATE_EVENT, heard);
    notifyCoachLinksChanged();
    window.removeEventListener(COACH_LINK_STATE_EVENT, heard);

    expect(heard).toHaveBeenCalledOnce();
    expect((await getCoachLinkState())?.coachIds).toEqual(['coach-1']);
    expect(db.queries).toHaveLength(6);
  });

  it('does not hand out a probe that started before the change', async () => {
    // A probe is on the wire (held at the server) when the link changes.
    let answer = () => {};
    db.gate = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const stale = getCoachLinkState();
    await vi.waitFor(() => expect(db.queries).toHaveLength(3));
    db.gate = null;
    db.links = [{ coach_id: 'coach-1', client_id: 'user-1' }];
    notifyCoachLinksChanged();

    const fresh = await getCoachLinkState();
    answer();
    await stale;

    expect(fresh?.coachIds).toEqual(['coach-1']);
    expect(db.queries).toHaveLength(6);
    // The late, stale answer did not overwrite the fresh one.
    expect((await getCoachLinkState())?.coachIds).toEqual(['coach-1']);
    expect(db.queries).toHaveLength(6);
  });
});

describe('invalidateCoachLinkStateIfNoLinks', () => {
  it('keeps a cached answer that already lists links', async () => {
    db.links = [{ coach_id: 'coach-1', client_id: 'user-1' }];
    await getCoachLinkState();

    invalidateCoachLinkStateIfNoLinks();
    await getCoachLinkState();

    expect(db.queries).toHaveLength(3);
  });

  it('drops a cached "no links" answer', async () => {
    await getCoachLinkState();

    invalidateCoachLinkStateIfNoLinks();
    await getCoachLinkState();

    expect(db.queries).toHaveLength(6);
  });
});

describe('a failed probe is asked again on its own while the page is visible', () => {
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    // Re-installed from scratch: a second useFakeTimers() on top of the outer
    // Date-only one does not take over setTimeout.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(Date.parse('2026-10-22T08:00:00.000Z'));
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    invalidateCoachLinkState();
  });

  afterEach(() => {
    invalidateCoachLinkState();
  });

  it('retries after a minute and tells the surfaces once it has an answer', async () => {
    db.fail = true;
    expect(await getCoachLinkState()).toBeNull();
    db.fail = false;
    const heard = vi.fn();
    window.addEventListener(COACH_LINK_STATE_EVENT, heard);

    await vi.advanceTimersByTimeAsync(60_000);
    window.removeEventListener(COACH_LINK_STATE_EVENT, heard);

    expect(db.queries).toHaveLength(6);
    expect(heard).toHaveBeenCalledOnce();
    expect(await getCoachLinkState()).not.toBeNull();
    expect(db.queries).toHaveLength(6); // the answer is cached now
  });

  it('backs off 1, 2, then 5 minutes while the server keeps failing', async () => {
    db.fail = true;
    await getCoachLinkState();
    await vi.advanceTimersByTimeAsync(60_000); // 2nd probe
    expect(db.queries).toHaveLength(6);

    await vi.advanceTimersByTimeAsync(119_000);
    expect(db.queries).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(1_000); // 3rd probe, two minutes on
    expect(db.queries).toHaveLength(9);

    await vi.advanceTimersByTimeAsync(299_000);
    expect(db.queries).toHaveLength(9);
    await vi.advanceTimersByTimeAsync(1_000); // 4th probe, five minutes on
    expect(db.queries).toHaveLength(12);
  });

  it('does not probe from the background', async () => {
    db.fail = true;
    await getCoachLinkState();
    visibility = 'hidden';

    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(db.queries).toHaveLength(3);
  });
});
