import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression guard for the tombstone fix in waterService.syncWaterEntryToCloud.
// A live save must NOT include `deleted_at` in the upserted payload — a PostgREST
// upsert sending deleted_at:null would CLEAR a tombstone set on another device and
// resurrect a row that was deleted there. Only an actual delete may stamp it.

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockUpsert = vi.fn();

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(() => ({ upsert: mockUpsert })),
  },
}));

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { type WaterEntry, syncWaterEntryToCloud } from '../waterService';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);

function makeEntry(overrides: Partial<WaterEntry> = {}): WaterEntry {
  return {
    id: 'water-1',
    date: '2026-06-09',
    amountMl: 250,
    createdAt: '2026-06-09T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockUpsert.mockResolvedValue({ error: null });
});

describe('syncWaterEntryToCloud — tombstone resurrection guard', () => {
  it('OMITS the deleted_at key entirely when the entry has no deletedAt', async () => {
    // Arrange
    const entry = makeEntry({ deletedAt: undefined });

    // Act
    await syncWaterEntryToCloud('user-1', entry);

    // Assert — the key must be ABSENT, not present-and-null
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, 'deleted_at')).toBe(false);
    expect(payload).toMatchObject({
      id: 'water-1',
      user_id: 'user-1',
      date: '2026-06-09',
      amount_ml: 250,
      created_at: '2026-06-09T08:00:00.000Z',
    });
    expect(vi.mocked(supabase!.from)).toHaveBeenCalledWith('water_logs');
    expect(mockUpsert).toHaveBeenCalledWith(expect.anything(), { onConflict: 'id' });
  });

  it('omits deleted_at when deletedAt is explicitly null (a live, non-deleted save)', async () => {
    // Arrange
    const entry = makeEntry({ deletedAt: null });

    // Act
    await syncWaterEntryToCloud('user-1', entry);

    // Assert
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, 'deleted_at')).toBe(false);
  });

  it('writes deleted_at with the entry value when the entry is tombstoned', async () => {
    // Arrange
    const deletedAt = '2026-06-09T09:30:00.000Z';
    const entry = makeEntry({ deletedAt });

    // Act
    await syncWaterEntryToCloud('user-1', entry);

    // Assert
    const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.deleted_at).toBe(deletedAt);
  });

  it('does not throw and does not upsert when Supabase is unconfigured', async () => {
    // Arrange
    mockIsConfigured.mockReturnValue(false);

    // Act / Assert
    await expect(syncWaterEntryToCloud('user-1', makeEntry())).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the upsert returns an error', async () => {
    // Arrange
    mockUpsert.mockResolvedValue({ error: { message: 'duplicate key' } });

    // Act / Assert
    await expect(syncWaterEntryToCloud('user-1', makeEntry())).rejects.toThrow(
      'water sync failed: duplicate key'
    );
  });
});
