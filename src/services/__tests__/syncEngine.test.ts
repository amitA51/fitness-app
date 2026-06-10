import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: vi.fn(() => true) }));
vi.mock('../errorReporter', () => ({ reportError: vi.fn() }));
// Keep the real isRetriableError classifier (syncEngine now imports it) and
// only stub the queue write.
vi.mock('../offlineQueue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offlineQueue')>()),
  queueMutation: vi.fn(),
}));

import { isSupabaseConfigured } from '../../lib/supabase';
import { queueMutation } from '../offlineQueue';
import { syncWithRetry } from '../syncEngine';

const mockIsConfigured = isSupabaseConfigured as ReturnType<typeof vi.fn>;
const mockQueueMutation = queueMutation as ReturnType<typeof vi.fn>;

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
});
