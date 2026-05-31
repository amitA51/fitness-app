import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase } from '../indexedDBCore';
import { getQueueDepth, queueMutation } from '../offlineQueue';

beforeEach(async () => {
  await clearDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── offlineQueue dedup race fix ─────────────────────────────────────────────

describe('queueMutation dedup (single-transaction fix)', () => {
  it('does not create duplicates when called concurrently with same payload', async () => {
    const payload = { id: 'rec-1', name: 'Bench Press' };

    // Fire multiple concurrent calls targeting the same record
    await Promise.all([
      queueMutation('template:update', payload),
      queueMutation('template:update', payload),
      queueMutation('template:update', payload),
    ]);

    const depth = await getQueueDepth();
    // Should have exactly 1 entry (deduped), not 3
    expect(depth).toBe(1);
  });

  it('allows different records to coexist', async () => {
    await queueMutation('template:update', { id: 'rec-1', name: 'A' });
    await queueMutation('template:update', { id: 'rec-2', name: 'B' });

    const depth = await getQueueDepth();
    expect(depth).toBe(2);
  });
});
