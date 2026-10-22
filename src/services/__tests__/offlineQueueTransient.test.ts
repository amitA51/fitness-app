// ============================================================================
// Offline queue under an overloaded server
// ============================================================================
// The database was down or overloaded for hours at a time. Three things made
// that cost data or wedge sync, and these tests pin each fix:
//   1. A network error / timeout / 5xx / 429 used to count toward MAX_RETRIES,
//      so ~45 minutes of outage moved a perfectly good write to the held store.
//   2. One replayed write that never answered held the cross-tab sync lock (and
//      with it every pull and push) indefinitely.
//   3. `queueMutation` waited on an auth lookup that can sit behind a token
//      refresh — the enqueue that stands between a write and its loss.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'user-1' })),
}));
vi.mock('../supabaseAuth', () => ({ getCurrentUser: () => auth.getCurrentUser() }));

const stored = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: null,
  readStoredAuthSession: () => (stored.userId ? { user: { id: stored.userId } } : null),
}));

vi.mock('../../components/ui/GlobalToast', () => ({ showToast: vi.fn() }));
vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(),
  deleteCloudWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
  deleteCloudWorkoutTemplate: vi.fn(),
  syncPersonalExercise: vi.fn(),
  deleteCloudPersonalExercise: vi.fn(),
  syncBodyWeight: vi.fn(),
  deleteCloudBodyWeight: vi.fn(),
  syncBodyMeasurement: vi.fn(),
  deleteCloudBodyMeasurement: vi.fn(),
  syncPersonalRecord: vi.fn(),
  deleteCloudPersonalRecord: vi.fn(),
  syncRecoveryLog: vi.fn(),
  deleteCloudRecoveryLog: vi.fn(),
  syncNutritionLog: vi.fn(),
  deleteCloudNutritionLog: vi.fn(),
  syncUserSetting: vi.fn(),
  syncAIConversation: vi.fn(),
  softDeleteCloudAIConversation: vi.fn(),
}));

import {
  clearMutationQueue,
  getDeadLetterCount,
  getQueueDepth,
  isRetriableError,
  isTransientError,
  listDeadLetters,
  processQueue,
  queueMutation,
  retryOutageDelayedNow,
} from '../offlineQueue';
import { syncWorkoutSession } from '../supabaseSync';

const mockSync = vi.mocked(syncWorkoutSession);

const queueSession = (id: string) => queueMutation('session:update', { id, duration: 60 });

/** A promise plus the function that resolves it — for "wait until X was called". */
const signal = () => {
  let fire = () => {};
  const fired = new Promise<void>((resolve) => {
    fire = resolve;
  });
  return { fire, fired };
};

const MINUTE = 60_000;

beforeEach(async () => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  auth.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  stored.userId = null;
  await clearMutationQueue();
});

afterEach(async () => {
  vi.useRealTimers();
  await clearMutationQueue();
});

describe('isTransientError', () => {
  it.each([
    ['a Chrome network failure', new TypeError('Failed to fetch')],
    ['a Safari network failure', new TypeError('Load failed')],
    // supabase.ts refuses to send a call as anon while a session is stored,
    // and holds the token refresh back after a server failure.
    [
      'a call held back after a failed token refresh',
      {
        code: '',
        message:
          'TypeError: The session could not be refreshed; not sending this request as a guest',
      },
    ],
    [
      'the refresh back-off',
      new TypeError('Token refresh is backing off after a server failure; keeping the session'),
    ],
    [
      'the base fetch timeout, as postgrest-js reports it',
      { message: 'TimeoutError: The server did not answer in time', code: '' },
    ],
    [
      'our own cap (withTimeout)',
      Object.assign(new Error('x did not settle'), { name: 'TimeoutError' }),
    ],
    ['HTTP 503', { status: 503 }],
    ['HTTP 429', { status: 429 }],
    [
      'an exhausted connection pool',
      { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool.' },
    ],
    ['a statement timeout', { code: '57014', message: 'canceling statement due to timeout' }],
    ['an expired access token', { code: 'PGRST303', message: 'JWT expired' }],
    ['a gateway error page', { message: '<html><title>504 Gateway Time-out</title></html>' }],
  ])('treats %s as transient (retried, never counted)', (_label, err) => {
    expect(isTransientError(err)).toBe(true);
    expect(isRetriableError(err)).toBe(true);
  });

  // postgrest-js hands a non-2xx JSON body back AS the error, without the HTTP
  // status — so on an overloaded day these arrive with only a message, or with
  // a SQLSTATE, and used to be counted as refusals until the write was held.
  it.each([
    // Overload and connection SQLSTATEs
    ['57014 statement timeout', { code: '57014', message: 'canceling statement' }],
    ['53300 too many connections', { code: '53300', message: 'sorry, too many clients' }],
    ['53400 configuration limit exceeded (class 53)', { code: '53400', message: 'limit' }],
    ['53200 out of memory', { code: '53200', message: 'out of memory' }],
    ['08006 connection failure', { code: '08006', message: 'connection failure' }],
    ['08P01 protocol violation (class 08)', { code: '08P01', message: 'protocol violation' }],
    ['57P01 admin shutdown', { code: '57P01', message: 'terminating connection' }],
    ['57P02 crash shutdown', { code: '57P02', message: 'terminating connection' }],
    ['57P03 cannot connect now', { code: '57P03', message: 'the database system is starting up' }],
    ['40001 serialization failure', { code: '40001', message: 'could not serialize access' }],
    ['40P01 deadlock', { code: '40P01', message: 'deadlock detected' }],
    // Gateway / proxy JSON bodies with no code
    ['a Kong 502 body', { message: 'An invalid response was received from the upstream server' }],
    [
      'an Envoy 503 body',
      {
        message:
          'upstream connect error or disconnect/reset before headers. reset reason: overflow',
      },
    ],
    ['a "temporarily unavailable" body', { message: 'Service is temporarily unavailable' }],
    ['an "overloaded" body', { message: 'The server is overloaded, please retry' }],
    ['a "connection terminated" body', { message: 'Connection terminated unexpectedly' }],
    ['a "connection refused" body', { message: 'connect ECONNREFUSED 10.0.0.1:5432' }],
    ['a "connection reset" body', { message: 'read ECONNRESET' }],
    ['a "too many connections" body', { message: 'remaining connection slots are reserved' }],
    ['a rate-limit body', { message: 'API rate limit exceeded' }],
    ['a body that words it in `error`', { error: 'upstream request timeout' }],
    ['an empty code with a gateway message', { code: '', message: 'Bad Gateway' }],
    // A status the gateway put in `code` / `statusCode`, as a number or a string
    ['a numeric 503 in code', { code: 503, message: 'Service Unavailable' }],
    ['a string 504 in code', { code: '504', message: 'Gateway Timeout' }],
    ['a string 502 in statusCode', { statusCode: '502', error: 'Bad Gateway' }],
    ['a 429 in code', { code: 429, message: 'Too Many Requests' }],
  ])('treats %s as transient', (_label, err) => {
    expect(isTransientError(err)).toBe(true);
    expect(isRetriableError(err)).toBe(true);
  });

  it.each([
    ['a validation rejection', { status: 400, message: 'Bad Request' }],
    ['an RLS rejection', { code: '42501', message: 'violates row-level security policy' }],
    ['a unique violation', { code: '23505' }],
    ['an unrecognised error', new Error('something odd')],
    ['a programming error', new TypeError("Cannot read properties of undefined (reading 'id')")],
  ])('does not treat %s as transient', (_label, err) => {
    expect(isTransientError(err)).toBe(false);
  });

  // The code decides, whatever the message says: these never succeed on retry.
  it.each([
    ['42501 RLS, even with a "timeout" message', { code: '42501', message: 'timeout' }],
    ['23505 unique violation, even "unavailable"', { code: '23505', message: 'unavailable' }],
    ['23502 not-null violation', { code: '23502', message: 'null value in column' }],
    ['22P02 invalid text representation', { code: '22P02', message: 'invalid input syntax' }],
    ['22007 invalid datetime', { code: '22007', message: 'invalid input syntax for type' }],
    ['PGRST116 not one row', { code: 'PGRST116', message: 'JSON object requested' }],
    ['PGRST204 unknown column', { code: 'PGRST204', message: 'Could not find the column' }],
    ['PGRST301 invalid JWT (not expired)', { code: 'PGRST301', message: 'JWSError' }],
    ['a 400 status with an "upstream" message', { status: 400, message: 'upstream said no' }],
    ['a string 404 in code', { code: '404', message: 'no Route matched' }],
    ['a numeric 422 in code', { code: 422, message: 'Unprocessable' }],
  ])('treats %s as a permanent refusal', (_label, err) => {
    expect(isTransientError(err)).toBe(false);
    expect(isRetriableError(err)).toBe(false);
  });
});

describe('processQueue during an outage', () => {
  it('keeps a write queued through an outage far longer than the old 45-minute budget', async () => {
    mockSync.mockRejectedValue(new TypeError('Failed to fetch'));
    await queueSession('s-outage');

    const start = Date.now();
    for (let hour = 0; hour < 12; hour++) {
      vi.setSystemTime(start + hour * 60 * MINUTE);
      await processQueue();
    }

    expect(mockSync).toHaveBeenCalledTimes(12);
    expect(await getQueueDepth()).toBe(1);
    expect(await getDeadLetterCount()).toBe(0);

    // The server comes back: the very same write goes through.
    mockSync.mockResolvedValue(undefined);
    vi.setSystemTime(start + 13 * 60 * MINUTE);
    await processQueue();
    expect(await getQueueDepth()).toBe(0);
  });

  it.each([
    ['HTTP 503', { status: 503 }],
    ['HTTP 429', { status: 429 }],
    ['PGRST003', { code: 'PGRST003', message: 'Timed out acquiring connection' }],
  ])('does not hold a write after repeated %s answers', async (_label, err) => {
    mockSync.mockRejectedValue(err);
    await queueSession('s-busy');

    const start = Date.now();
    for (let i = 0; i < 7; i++) {
      vi.setSystemTime(start + i * 60 * MINUTE);
      await processQueue();
    }

    expect(await getQueueDepth()).toBe(1);
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('never waits longer than 30 minutes between attempts', async () => {
    mockSync.mockRejectedValue({ status: 503 });
    await queueSession('s-cap');

    let now = Date.now();
    for (let i = 0; i < 8; i++) {
      vi.setSystemTime(now);
      await processQueue();
      now += 31 * MINUTE;
    }
    expect(mockSync).toHaveBeenCalledTimes(8);

    // Still backing off right after the last failure...
    const lastFailure = now - 31 * MINUTE;
    vi.setSystemTime(lastFailure + 29 * MINUTE);
    await processQueue();
    expect(mockSync).toHaveBeenCalledTimes(8);

    // ...but tried again once the 30-minute window has passed.
    vi.setSystemTime(lastFailure + 30 * MINUTE + 1_000);
    await processQueue();
    expect(mockSync).toHaveBeenCalledTimes(9);
  });

  it('retries writes delayed by the outage in the same pass once the server answers', async () => {
    // Two writes fail through a long outage, so their backoff has grown.
    mockSync.mockRejectedValue(new TypeError('Failed to fetch'));
    await queueSession('s-old-1');
    await queueSession('s-old-2');
    const start = Date.now();
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(start + i * 31 * MINUTE);
      await processQueue();
    }

    // The server is back. A few minutes later — well inside their 30-minute
    // backoff — a new write is queued and goes through...
    vi.setSystemTime(start + 5 * 31 * MINUTE + 5 * MINUTE);
    mockSync.mockReset();
    mockSync.mockResolvedValue(undefined);
    await queueSession('s-new');
    const result = await processQueue();

    // ...and the delayed ones go with it, instead of waiting out the backoff.
    expect(result).toEqual({ success: 3, failed: 0 });
    expect(await getQueueDepth()).toBe(0);
  });

  it('retries an outage-delayed write as soon as a pull shows the server is back', async () => {
    // The only queued write is deep in its backoff, so no replay is due that
    // could prove the server answers again.
    mockSync.mockRejectedValue({ status: 503 });
    await queueSession('s-alone');
    const start = Date.now();
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(start + i * 31 * MINUTE);
      await processQueue();
    }
    vi.setSystemTime(start + 5 * 31 * MINUTE + 2 * MINUTE);
    mockSync.mockReset();
    mockSync.mockResolvedValue(undefined);
    await processQueue();
    expect(mockSync).not.toHaveBeenCalled(); // still backing off

    // A pull succeeded: that is the server answering.
    await retryOutageDelayedNow();

    expect(mockSync).toHaveBeenCalledOnce();
    expect(await getQueueDepth()).toBe(0);
  });

  it('leaves the queue alone when nothing is waiting on an outage', async () => {
    mockSync.mockRejectedValueOnce(new Error('unexpected replay failure'));
    await queueSession('s-refused-wait');
    await processQueue();
    mockSync.mockClear();

    await retryOutageDelayedNow();

    // A refused write keeps its backoff; no pass is run for it.
    expect(mockSync).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(1);
  });

  it('keeps the backoff for a write the server REFUSED, even when others go through', async () => {
    mockSync.mockRejectedValueOnce(new Error('unexpected replay failure'));
    await queueSession('s-refused-once');
    await processQueue();

    mockSync.mockResolvedValue(undefined);
    await queueSession('s-fresh');
    const result = await processQueue();

    expect(result).toEqual({ success: 1, failed: 0 });
    expect(await getQueueDepth()).toBe(1);
  });

  it('stops a pass after two transient failures in a row instead of replaying everything', async () => {
    mockSync.mockRejectedValue(new TypeError('Failed to fetch'));
    for (const id of ['a', 'b', 'c', 'd']) await queueSession(id);

    const result = await processQueue();

    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: 0, failed: 2 });
    // Nothing was dropped: the untried writes wait for the next pass.
    expect(await getQueueDepth()).toBe(4);
  });

  it('holds a write the server has not answered for a week, so the user is told', async () => {
    mockSync.mockRejectedValue(new TypeError('Failed to fetch'));
    await queueSession('s-week');

    // Tried every half hour or so for eight days: never refused, never answered.
    const start = Date.now();
    for (let day = 0; day <= 8; day++) {
      vi.setSystemTime(start + day * 24 * 60 * MINUTE);
      await processQueue();
    }

    const held = await listDeadLetters();
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ reason: 'unreachable', payload: { id: 's-week' } });
    // Measured from the FIRST failure (day 0), not from the latest attempt.
    expect(held[0]?.firstFailedAt).toBeGreaterThanOrEqual(start);
    expect(held[0]?.firstFailedAt).toBeLessThan(start + MINUTE);
    expect(mockSync).toHaveBeenCalledTimes(8); // held on day 7, nothing left for day 8
    expect(await getQueueDepth()).toBe(0);
  });

  it('does not hold a write after only two unanswered attempts a week apart', async () => {
    // Failed once, then the app was not opened for a week: try again, do not hold.
    mockSync.mockRejectedValue({ status: 503 });
    await queueSession('s-away');
    const start = Date.now();
    await processQueue();
    vi.setSystemTime(start + 8 * 24 * 60 * MINUTE);
    await processQueue();

    expect(mockSync).toHaveBeenCalledTimes(2);
    expect(await getDeadLetterCount()).toBe(0);
    expect(await getQueueDepth()).toBe(1);
  });

  it('still holds a write the server keeps refusing for an unrecognised reason', async () => {
    mockSync.mockRejectedValue(new Error('unexpected replay failure'));
    await queueSession('s-refused');

    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(start + i * 60 * MINUTE);
      await processQueue();
    }

    const held = await listDeadLetters();
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ reason: 'max_retries', payload: { id: 's-refused' } });
  });
});

describe('processQueue never holds the sync lock through a hung request', () => {
  it('gives up on a replayed write that never answers and keeps it queued', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const started = signal();
    mockSync.mockImplementation(() => {
      started.fire();
      return new Promise<void>(() => {});
    });
    await queueSession('s-hang');

    const pass = processQueue();
    await started.fired;
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(pass).resolves.toEqual({ success: 0, failed: 1 });
    expect(await getQueueDepth()).toBe(1);
    expect(await getDeadLetterCount()).toBe(0);

    // The lock was released: the next pass runs (and succeeds) normally.
    vi.useRealTimers();
    mockSync.mockReset();
    mockSync.mockResolvedValue(undefined);
    vi.setSystemTime(Date.now() + 60 * MINUTE);
    await expect(processQueue()).resolves.toEqual({ success: 1, failed: 0 });
  });

  it('defers the pass when auth does not name the user in time', async () => {
    await queueSession('s-wait');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const asked = signal();
    auth.getCurrentUser.mockImplementationOnce(() => {
      asked.fire();
      return new Promise(() => {});
    });

    const pass = processQueue();
    await asked.fired;
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pass).resolves.toEqual({ success: 0, failed: 0 });
    expect(mockSync).not.toHaveBeenCalled();
    expect(await getQueueDepth()).toBe(1);
  });
});

describe('moving a refused write to the held store', () => {
  /** Replay the queue, and while its request is in flight run `meanwhile`, then refuse it. */
  const refuseAfter = async (meanwhile: () => Promise<void>) => {
    const started = signal();
    let refuse = () => {};
    mockSync.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          refuse = () => reject({ status: 401, message: 'JWT invalid' });
          started.fire();
        })
    );
    const pass = processQueue();
    await started.fired;
    await meanwhile();
    refuse();
    await pass;
  };

  it('does not write a change back after the queue was wiped under the pass', async () => {
    // Sign-out gives up on a slow flush and wipes the stores; the abandoned pass
    // keeps running and its 401 lands afterwards.
    await queueSession('s-wiped');

    await refuseAfter(() => clearMutationQueue());

    expect(await getDeadLetterCount()).toBe(0);
    expect(await getQueueDepth()).toBe(0);
  });

  it('keeps a newer revision queued instead of holding the stale one', async () => {
    await queueSession('s-edited');

    // The user edits the same workout while the old revision is replaying.
    await refuseAfter(() => queueMutation('session:update', { id: 's-edited', duration: 90 }));

    expect(await getDeadLetterCount()).toBe(0);
    expect(await getQueueDepth()).toBe(1);

    mockSync.mockResolvedValue(undefined);
    await processQueue();
    expect(mockSync).toHaveBeenLastCalledWith('user-1', { id: 's-edited', duration: 90 });
  });
});

describe('queueMutation when auth is slow', () => {
  it('stamps the account stored on this device instead of waiting on auth', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stored.userId = 'user-1';
    const asked = signal();
    auth.getCurrentUser.mockImplementationOnce(() => {
      asked.fire();
      return new Promise(() => {});
    });

    const enqueue = queueSession('s-slow-auth');
    await asked.fired;
    await vi.advanceTimersByTimeAsync(2_000);
    await enqueue;
    vi.useRealTimers();

    expect(await getQueueDepth()).toBe(1);
    // It replays into that account — not into quarantine.
    mockSync.mockResolvedValue(undefined);
    await processQueue();
    expect(mockSync).toHaveBeenCalledWith('user-1', { id: 's-slow-auth', duration: 60 });
    expect(await getDeadLetterCount()).toBe(0);
  });

  it('quarantines the entry when auth is slow and no session is stored', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const asked = signal();
    auth.getCurrentUser.mockImplementationOnce(() => {
      asked.fire();
      return new Promise(() => {});
    });

    const enqueue = queueSession('s-nobody');
    await asked.fired;
    await vi.advanceTimersByTimeAsync(2_000);
    await enqueue;
    vi.useRealTimers();

    await processQueue();
    const held = await listDeadLetters();
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ reason: 'ownerless', payload: { id: 's-nobody' } });
  });
});
