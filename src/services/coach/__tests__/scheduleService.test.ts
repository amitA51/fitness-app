import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// A flexible query-builder mock: every chainable method returns the builder, and
// the builder is awaitable (then) resolving to whatever the test queues. Each
// `from()` call pulls the next queued result so a single test can drive a read
// then a write. `update().eq()` and `upsert()` also resolve via the builder.
const mocks = vi.hoisted(() => {
  // Queue of results that awaiting the builder will resolve to, in FIFO order.
  const resultQueue: Array<{ data: unknown; error: unknown }> = [];
  // Captured payloads for assertions.
  const captured: {
    upserts: Array<{ rows: unknown; options: unknown }>;
    updates: unknown[];
    inserts: unknown[];
    deletes: number;
  } = { upserts: [], updates: [], inserts: [], deletes: 0 };

  const nextResult = () => resultQueue.shift() ?? { data: [], error: null };

  function makeBuilder() {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.insert = vi.fn((row: unknown) => {
      captured.inserts.push(row);
      return builder;
    });
    builder.upsert = vi.fn((rows: unknown, options: unknown) => {
      captured.upserts.push({ rows, options });
      return builder;
    });
    builder.update = vi.fn((row: unknown) => {
      captured.updates.push(row);
      return builder;
    });
    builder.delete = vi.fn(() => {
      captured.deletes += 1;
      return builder;
    });
    builder.single = vi.fn(() => Promise.resolve(nextResult()));
    // Make the builder awaitable.
    // biome-ignore lint/suspicious/noThenProperty: mock of PostgREST's thenable query builder; production code awaits the chain.
    builder.then = (resolve: (v: unknown) => unknown) => resolve(nextResult());
    return builder;
  }

  const mockFrom = vi.fn((_table: string) => makeBuilder());

  return { resultQueue, captured, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-self' })),
}));

// Audit is best-effort and irrelevant to these tests — stub it to a no-op.
vi.mock('../auditService', () => ({
  writeAudit: vi.fn(async () => ({ error: null })),
}));

import {
  getMySchedule,
  reconcileScheduleOnSessionSave,
  scheduleProgramWeek,
} from '../scheduleService';

function queueResult(data: unknown, error: unknown = null) {
  mocks.resultQueue.push({ data, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resultQueue.length = 0;
  mocks.captured.upserts.length = 0;
  mocks.captured.updates.length = 0;
  mocks.captured.inserts.length = 0;
  mocks.captured.deletes = 0;
});

// ---------------------------------------------------------------------------
// reconcileScheduleOnSessionSave
// ---------------------------------------------------------------------------

describe('reconcileScheduleOnSessionSave', () => {
  it('marks the matching planned row done when templateId and date match', async () => {
    // Arrange — getMySchedule read returns one planned row for the session date.
    const sessionDate = '2026-06-07';
    queueResult([
      {
        id: 'sched-1',
        user_id: 'user-self',
        template_id: 'tpl-1',
        scheduled_date: sessionDate,
        status: 'planned',
      },
    ]);
    // The markScheduleStatus update resolves with no error.
    queueResult(null, null);

    // Act
    await reconcileScheduleOnSessionSave({
      id: 'session-9',
      templateId: 'tpl-1',
      startTime: new Date(`${sessionDate}T18:00:00`).toISOString(),
      status: 'completed',
    });

    // Assert — exactly one update flipping status to done with the session id.
    expect(mocks.captured.updates).toHaveLength(1);
    const update = mocks.captured.updates[0] as Record<string, unknown>;
    expect(update.status).toBe('done');
    expect(update.session_id).toBe('session-9');
    expect(update.completed_at).not.toBeNull();
  });

  it('is a no-op when the session is not completed', async () => {
    // Act
    await reconcileScheduleOnSessionSave({
      id: 'session-9',
      templateId: 'tpl-1',
      startTime: new Date('2026-06-07T18:00:00').toISOString(),
      status: 'in_progress',
    });

    // Assert — no read, no update.
    expect(mocks.mockFrom).not.toHaveBeenCalled();
    expect(mocks.captured.updates).toHaveLength(0);
  });

  it('is a no-op when there is no templateId', async () => {
    // Act
    await reconcileScheduleOnSessionSave({
      id: 'session-9',
      templateId: null,
      startTime: new Date('2026-06-07T18:00:00').toISOString(),
      status: 'completed',
    });

    // Assert
    expect(mocks.mockFrom).not.toHaveBeenCalled();
    expect(mocks.captured.updates).toHaveLength(0);
  });

  it('does not re-mark a row that is already done (idempotent)', async () => {
    // Arrange — the only row for that date is already done.
    const sessionDate = '2026-06-07';
    queueResult([
      {
        id: 'sched-1',
        user_id: 'user-self',
        template_id: 'tpl-1',
        scheduled_date: sessionDate,
        status: 'done',
      },
    ]);

    // Act
    await reconcileScheduleOnSessionSave({
      id: 'session-9',
      templateId: 'tpl-1',
      startTime: new Date(`${sessionDate}T18:00:00`).toISOString(),
      status: 'completed',
    });

    // Assert — read happened, but no update.
    expect(mocks.captured.updates).toHaveLength(0);
  });

  it('is a no-op when no scheduled row matches the templateId', async () => {
    // Arrange — a planned row exists but for a different template.
    queueResult([
      {
        id: 'sched-1',
        user_id: 'user-self',
        template_id: 'tpl-OTHER',
        scheduled_date: '2026-06-07',
        status: 'planned',
      },
    ]);

    // Act
    await reconcileScheduleOnSessionSave({
      id: 'session-9',
      templateId: 'tpl-1',
      startTime: new Date('2026-06-07T18:00:00').toISOString(),
      status: 'completed',
    });

    // Assert
    expect(mocks.captured.updates).toHaveLength(0);
  });

  it('never throws even when the read rejects', async () => {
    // Arrange — make the builder.then throw by queuing a getCurrentUser that is
    // fine, but force getMySchedule to surface an error result (handled to []).
    queueResult(null, { message: 'boom' });

    // Act / Assert — resolves without throwing, no update issued.
    await expect(
      reconcileScheduleOnSessionSave({
        id: 'session-9',
        templateId: 'tpl-1',
        startTime: new Date('2026-06-07T18:00:00').toISOString(),
        status: 'completed',
      })
    ).resolves.toBeUndefined();
    expect(mocks.captured.updates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scheduleProgramWeek
// ---------------------------------------------------------------------------

describe('scheduleProgramWeek', () => {
  it('expands a 3-day map over 2 weeks into 6 upserted rows with the conflict key', async () => {
    // Arrange — upsert resolves with no error.
    queueResult(null, null);

    // Act
    const result = await scheduleProgramWeek('client-1', {
      weekStart: '2026-06-07', // a Sunday
      weeks: 2,
      dayMap: [
        { templateId: 'tpl-A', name: 'יום A', weekday: 0 },
        { templateId: 'tpl-B', name: 'יום B', weekday: 2 },
        { templateId: 'tpl-C', name: 'יום C', weekday: 4 },
      ],
    });

    // Assert — count and conflict key.
    expect(result.error).toBeNull();
    expect(result.count).toBe(6);
    expect(mocks.captured.upserts).toHaveLength(1);
    const { rows, options } = mocks.captured.upserts[0]!;
    expect(rows).toHaveLength(6);
    expect(options).toEqual({ onConflict: 'user_id,scheduled_date,template_id' });
  });

  it('computes concrete dates from weekStart + weekday offsets (week 1 and week 2)', async () => {
    // Arrange
    queueResult(null, null);

    // Act
    await scheduleProgramWeek('client-1', {
      weekStart: '2026-06-07',
      weeks: 2,
      dayMap: [{ templateId: 'tpl-A', name: 'יום A', weekday: 2 }], // Tuesday offset
    });

    // Assert — week 1 Tuesday = Jun 9, week 2 Tuesday = Jun 16.
    const rows = mocks.captured.upserts[0]!.rows as Array<Record<string, unknown>>;
    const dates = rows.map((r) => r.scheduled_date);
    expect(dates).toContain('2026-06-09');
    expect(dates).toContain('2026-06-16');
  });

  it('defaults to a single week when weeks is omitted', async () => {
    // Arrange
    queueResult(null, null);

    // Act
    const result = await scheduleProgramWeek('client-1', {
      weekStart: '2026-06-07',
      dayMap: [
        { templateId: 'tpl-A', name: 'A', weekday: 1 },
        { templateId: 'tpl-B', name: 'B', weekday: 3 },
      ],
    });

    // Assert
    expect(result.count).toBe(2);
  });

  it('returns count 0 without an upsert when the dayMap is empty', async () => {
    // Act
    const result = await scheduleProgramWeek('client-1', {
      weekStart: '2026-06-07',
      dayMap: [],
    });

    // Assert
    expect(result).toEqual({ error: null, count: 0 });
    expect(mocks.captured.upserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getMySchedule (read window + offline)
// ---------------------------------------------------------------------------

describe('getMySchedule', () => {
  it('maps rows scoped to the current user', async () => {
    // Arrange
    queueResult([
      {
        id: 'sched-1',
        user_id: 'user-self',
        template_id: 'tpl-1',
        scheduled_date: '2026-06-07',
        status: 'planned',
      },
    ]);

    // Act
    const result = await getMySchedule('2026-06-01', '2026-06-08');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('sched-1');
    expect(result[0]!.templateId).toBe('tpl-1');
    expect(result[0]!.status).toBe('planned');
  });

  it('returns [] on a query error (graceful)', async () => {
    // Arrange
    queueResult(null, { message: 'network' });

    // Act
    const result = await getMySchedule('2026-06-01', '2026-06-08');

    // Assert
    expect(result).toEqual([]);
  });
});
