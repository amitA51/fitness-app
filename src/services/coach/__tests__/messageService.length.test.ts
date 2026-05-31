import { describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();

vi.mock('../mappers', () => ({
  requireClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
  toMessage: (r: unknown) => r,
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
}));

vi.mock('../pushService', () => ({
  sendCoachPush: vi.fn(),
}));

import { sendMessage } from '../messageService';

describe('sendMessage length validation', () => {
  it('rejects body longer than 5000 chars without calling insert', async () => {
    const longBody = 'a'.repeat(5001);
    const result = await sendMessage('c1', 'u1', longBody);
    expect(result).toEqual({ error: 'message_too_long' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('allows body of exactly 5000 chars', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const body = 'a'.repeat(5000);
    const result = await sendMessage('c1', 'u1', body);
    expect(result).toEqual({ error: null });
    expect(mockInsert).toHaveBeenCalled();
  });
});
