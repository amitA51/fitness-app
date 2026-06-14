import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();

vi.mock('../mappers', () => ({
  requireClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
  toMessage: (r: unknown) => r,
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach1' })),
}));

vi.mock('../pushService', () => ({
  sendCoachPush: vi.fn(),
}));

vi.mock('../relationshipService', () => ({
  listClients: vi.fn(),
}));

import { BULK_NUDGE_MAX, sendBulkMessage } from '../messageService';

describe('sendBulkMessage', () => {
  beforeEach(() => {
    mockInsert.mockReset();
  });

  it('sends the same message to every selected client and reports them as sent', async () => {
    mockInsert.mockResolvedValue({ error: null });

    const res = await sendBulkMessage(['c1', 'c2', 'c3'], '  שלום לכולם  ');

    expect(res.sent).toEqual(['c1', 'c2', 'c3']);
    expect(res.failed).toEqual([]);
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it('continues past a single failure and reports per-client outcomes', async () => {
    // c1 ok, c2 fails, c3 ok
    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'boom' } })
      .mockResolvedValueOnce({ error: null });

    const res = await sendBulkMessage(['c1', 'c2', 'c3'], 'תזכורת');

    expect(res.sent).toEqual(['c1', 'c3']);
    expect(res.failed).toEqual([{ clientId: 'c2', error: 'boom' }]);
  });

  it('fails every client without inserting when the message is blank', async () => {
    const res = await sendBulkMessage(['c1', 'c2'], '   ');

    expect(res.sent).toEqual([]);
    expect(res.failed).toEqual([
      { clientId: 'c1', error: 'empty' },
      { clientId: 'c2', error: 'empty' },
    ]);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('caps the fan-out at BULK_NUDGE_MAX clients', async () => {
    mockInsert.mockResolvedValue({ error: null });
    const ids = Array.from({ length: BULK_NUDGE_MAX + 5 }, (_, i) => `c${i}`);

    const res = await sendBulkMessage(ids, 'היי');

    expect(res.sent).toHaveLength(BULK_NUDGE_MAX);
    expect(mockInsert).toHaveBeenCalledTimes(BULK_NUDGE_MAX);
  });
});
