import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// Chainable builder, awaitable (thenable) like the one in coachApiReaders.test.ts.
// Awaited chains pull from a FIFO queue; `.maybeSingle()` pulls from its own
// queue so getSeatUsage's parallel count + subscription reads stay deterministic.
//
// These tests pin the SYSTEMIC fix: coach list readers must THROW on a db error
// instead of swallowing it into [] — a swallowed error renders a fake empty
// state (worst case: a failed roster read shows the "no clients yet" onboarding).
const mocks = vi.hoisted(() => {
  const resultQueue: Array<{ data?: unknown; count?: number | null; error: unknown }> = [];
  const maybeSingleQueue: Array<{ data: unknown; error: unknown }> = [];

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of ['select', 'eq', 'in', 'is', 'order', 'limit', 'gte', 'lte']) {
      builder[method] = vi.fn(chain);
    }
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve(maybeSingleQueue.shift() ?? { data: null, error: null })
    );
    // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(resultQueue.shift() ?? { data: [], error: null });
    return builder;
  }

  const mockFrom = vi.fn(() => makeBuilder());
  return { resultQueue, maybeSingleQueue, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

import { listAudit } from '../auditService';
import { listCheckIns, listCoachNotes } from '../checkInService';
import { getGroupMemberIds, listGroups } from '../groupService';
import { listInvites } from '../inviteService';
import { getSeatUsage, listClients } from '../relationshipService';
import { listCoachReminders } from '../reminderService';

const DB_ERROR = { message: 'db boom' };

const queueError = () => mocks.resultQueue.push({ data: null, error: DB_ERROR });
const queueRows = (rows: unknown[]) => mocks.resultQueue.push({ data: rows, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resultQueue.length = 0;
  mocks.maybeSingleQueue.length = 0;
});

describe('coach list readers throw on db error (no swallow-to-[])', () => {
  it('listClients throws', async () => {
    queueError();
    await expect(listClients('active')).rejects.toThrow('db boom');
  });

  it('listClients still resolves rows on success', async () => {
    queueRows([{ id: 'l1', coach_id: 'coach-1', client_id: 'u1', status: 'active' }]);
    const out = await listClients('active');
    expect(out).toHaveLength(1);
    expect(out[0]?.clientId).toBe('u1');
  });

  it('listGroups throws', async () => {
    queueError();
    await expect(listGroups()).rejects.toThrow('db boom');
  });

  it('getGroupMemberIds throws (group editor must not look empty on failure)', async () => {
    queueError();
    await expect(getGroupMemberIds('group-1')).rejects.toThrow('db boom');
  });

  it('getGroupMemberIds resolves member ids on success', async () => {
    queueRows([{ client_id: 'u1' }, { client_id: 'u2' }]);
    await expect(getGroupMemberIds('group-1')).resolves.toEqual(['u1', 'u2']);
  });

  it('listInvites throws', async () => {
    queueError();
    await expect(listInvites()).rejects.toThrow('db boom');
  });

  it('listCheckIns throws', async () => {
    queueError();
    await expect(listCheckIns('u1')).rejects.toThrow('db boom');
  });

  it('listCoachNotes throws', async () => {
    queueError();
    await expect(listCoachNotes('u1')).rejects.toThrow('db boom');
  });

  it('listCoachReminders throws', async () => {
    queueError();
    await expect(listCoachReminders('u1')).rejects.toThrow('db boom');
  });

  it('listAudit throws', async () => {
    queueError();
    await expect(listAudit('u1')).rejects.toThrow('db boom');
  });
});

describe('getSeatUsage', () => {
  it('throws when the active-client count fails (must not read as 0 used / not-full)', async () => {
    mocks.resultQueue.push({ count: null, error: DB_ERROR });
    await expect(getSeatUsage()).rejects.toThrow('db boom');
  });

  it('computes used/limit/full from the count and subscription', async () => {
    mocks.resultQueue.push({ count: 2, error: null });
    mocks.maybeSingleQueue.push({
      data: { coach_id: 'coach-1', plan: 'pro', seat_limit: 2, status: 'active' },
      error: null,
    });
    await expect(getSeatUsage()).resolves.toEqual({ used: 2, limit: 2, full: true });
  });
});
