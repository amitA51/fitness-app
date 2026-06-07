import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockUpsert = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(() => ({ upsert: mockUpsert })),
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-123' })),
}));

import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../supabaseAuth';
import { updateMyCoachProfile } from '../profileService';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockGetCurrentUser.mockResolvedValue({ id: 'user-123' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);
  mockUpsert.mockResolvedValue({ error: null });
});

describe('updateMyCoachProfile', () => {
  it('returns {error:"offline"} when Supabase is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);

    const result = await updateMyCoachProfile({ businessName: 'My Gym' });

    expect(result).toEqual({ error: 'offline' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns {error:"unauthenticated"} when there is no current user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await updateMyCoachProfile({ businessName: 'My Gym' });

    expect(result).toEqual({ error: 'unauthenticated' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts with snake_case keys and returns {error:null} on success', async () => {
    const result = await updateMyCoachProfile({
      businessName: 'Iron Temple',
      bio: 'Strength coach',
    });

    expect(result).toEqual({ error: null });
    expect(vi.mocked(supabase!.from)).toHaveBeenCalledWith('coach_profiles');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123',
        business_name: 'Iron Temple',
        bio: 'Strength coach',
      })
    );
    // Confirm camelCase key is NOT present in the upserted row
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('businessName');
  });
});
