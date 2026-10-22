import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoredSession = vi.hoisted(() => ({ current: null as { user: { id: string } } | null }));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  readStoredAuthSession: () => mockStoredSession.current,
}));
vi.mock('../errorReporter', () => ({ reportError: vi.fn() }));
// Keep the real isRetriableError classifier (syncEngine now imports it) and
// only stub the queue write.
vi.mock('../offlineQueue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offlineQueue')>()),
  queueMutation: vi.fn(),
  discardWritesObsoletedBy: vi.fn(async () => 0),
}));

import { isSupabaseConfigured } from '../../lib/supabase';
import { discardWritesObsoletedBy, queueMutation } from '../offlineQueue';
import { syncWithRetry } from '../syncEngine';

const mockIsConfigured = isSupabaseConfigured as ReturnType<typeof vi.fn>;
const mockQueueMutation = queueMutation as ReturnType<typeof vi.fn>;
const mockDiscard = discardWritesObsoletedBy as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('syncWithRetry', () => {
  it('returns true on immediate success', async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const result = await syncWithRetry(syncFn, 'test-ok');
    expect(result).toBe(true);
    expect(syncFn).toHaveBeenCalledOnce();
  });

  it('retries on transient failure then succeeds', async () => {
    const syncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    const promise = syncWithRetry(syncFn, 'test-retry', 3);
    // Advance past backoff sleep for attempt 0
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;

    expect(result).toBe(true);
    expect(syncFn).toHaveBeenCalledTimes(2);
  });

  it('queues mutation after retries exhausted', async () => {
    const syncFn = vi.fn().mockRejectedValue(new Error('fail'));
    const queue = { type: 'session:create' as const, payload: { id: 'x' } };

    const promise = syncWithRetry(syncFn, 'test-exhaust', 2, queue);
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await promise;

    expect(result).toBe(false);
    expect(syncFn).toHaveBeenCalledTimes(2);
    expect(mockQueueMutation).toHaveBeenCalledWith('session:create', { id: 'x' });
  });

  it('stamps the account signed in when the push started, not when the enqueue runs', async () => {
    // The fallback enqueue runs only after every retry failed; a sign-out in
    // between must not turn the write into guest data the next account adopts.
    mockStoredSession.current = { user: { id: 'account-a' } };
    const syncFn = vi.fn().mockRejectedValue(new Error('fail'));
    const queue = { type: 'template:update' as const, payload: { id: 't1' } };

    const promise = syncWithRetry(syncFn, 'test-owner', 2, queue);
    mockStoredSession.current = null; // signed out while the retries ran
    await vi.advanceTimersByTimeAsync(120_000);
    await promise;

    expect(mockQueueMutation).toHaveBeenCalledWith(
      'template:update',
      { id: 't1' },
      { ownerId: 'account-a' }
    );
  });

  it('short-circuits non-retriable errors (4xx) without retrying', async () => {
    const syncFn = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });
    const queue = { type: 'session:create' as const, payload: { id: 'x' } };

    // No timer advancement needed — a permanent error must skip backoff.
    const result = await syncWithRetry(syncFn, 'test-permanent', 3, queue);

    expect(result).toBe(false);
    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(mockQueueMutation).toHaveBeenCalledWith('session:create', { id: 'x' });
  });

  it('short-circuits Postgres-coded errors (22007) without retrying', async () => {
    const syncFn = vi.fn().mockRejectedValue({ code: '22007', message: 'invalid timestamp' });

    const result = await syncWithRetry(syncFn, 'test-pgcode', 3);

    expect(result).toBe(false);
    expect(syncFn).toHaveBeenCalledTimes(1);
  });

  it('returns false immediately when supabase is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);
    const syncFn = vi.fn();

    const result = await syncWithRetry(syncFn, 'test-no-config');

    expect(result).toBe(false);
    expect(syncFn).not.toHaveBeenCalled();
  });

  it('queues the fallback under the owner the caller pushed for', async () => {
    // The enqueue runs after the retries, possibly after a sign-out: the owner
    // must come from the caller, not from whoever auth names by then.
    const syncFn = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });
    const queue = { type: 'session:update' as const, payload: { id: 'x' }, ownerId: 'user-1' };

    await syncWithRetry(syncFn, 'test-owner', 3, queue);

    expect(mockQueueMutation).toHaveBeenCalledWith(
      'session:update',
      { id: 'x' },
      { ownerId: 'user-1' }
    );
  });

  it('drops the queued writes a directly-pushed delete makes obsolete', async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);

    await syncWithRetry(syncFn, 'test-delete', 3, { type: 'session:delete', payload: 's1' });
    await vi.waitFor(() => expect(mockDiscard).toHaveBeenCalledWith('session:delete', 's1'));
    // The push itself starts at once, not after the queue has been cleaned.
    expect(syncFn).toHaveBeenCalledOnce();
  });

  it('leaves the queue alone for anything but a delete', async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);

    await syncWithRetry(syncFn, 'test-update', 3, {
      type: 'session:update',
      payload: { id: 's1' },
    });

    expect(mockDiscard).not.toHaveBeenCalled();
  });
});
