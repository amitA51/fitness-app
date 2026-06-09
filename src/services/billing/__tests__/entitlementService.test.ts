import { beforeEach, describe, expect, it, vi } from 'vitest';

// entitlementService is the gate for paid access. getEntitlement() is fail-open
// (any failure resolves to FREE), and toPlan/toStatus normalize untrusted RPC
// strings. isPremium() is the pure grant/deny decision. Both normalizers and the
// grant matrix are tested exhaustively because a wrong default here either locks
// out paying users or gives away premium for free.

// ── Supabase mock (chainable: supabase.rpc) ─────────────────────────────────
const mockRpc = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-123' })),
}));

import { getCurrentUser } from '../../supabaseAuth';
import { getEntitlement, isPremium } from '../entitlementService';
import { FREE_ENTITLEMENT } from '../types';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue({ id: 'user-123' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('getEntitlement', () => {
  it('returns FREE_ENTITLEMENT when Supabase is not configured (supabase === null)', async () => {
    // Arrange — re-mock the module so `supabase` is null, then re-import the SUT
    // in an isolated registry so this null binding is the one it closes over.
    vi.resetModules();
    vi.doMock('../../../lib/supabase', () => ({
      isSupabaseConfigured: vi.fn(() => false),
      supabase: null,
    }));
    const { getEntitlement: getEntitlementNoSupabase } = await import('../entitlementService');

    // Act
    const result = await getEntitlementNoSupabase();

    // Assert
    expect(result).toEqual(FREE_ENTITLEMENT);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();

    // Cleanup — restore the default (truthy) supabase mock for the rest of the suite
    vi.doUnmock('../../../lib/supabase');
    vi.resetModules();
  });

  it('returns FREE_ENTITLEMENT when there is no current user', async () => {
    // Arrange
    mockGetCurrentUser.mockResolvedValue(null);

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result).toEqual(FREE_ENTITLEMENT);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns FREE_ENTITLEMENT and does not throw when the RPC errors', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result).toEqual(FREE_ENTITLEMENT);
  });

  it('returns FREE_ENTITLEMENT when the RPC data is null', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result).toEqual(FREE_ENTITLEMENT);
  });

  it('returns FREE_ENTITLEMENT when the RPC returns zero rows', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: [], error: null });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result).toEqual(FREE_ENTITLEMENT);
  });

  it('maps a valid pro_monthly/active row to an Entitlement', async () => {
    // Arrange
    mockRpc.mockResolvedValue({
      data: [
        {
          plan: 'pro_monthly',
          status: 'active',
          current_period_end: '2026-07-09T00:00:00.000Z',
        },
      ],
      error: null,
    });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result).toEqual({
      plan: 'pro_monthly',
      status: 'active',
      currentPeriodEnd: '2026-07-09T00:00:00.000Z',
    });
    expect(mockRpc).toHaveBeenCalledWith('current_entitlement');
  });

  it('falls back to plan "free" when the row plan is an unknown string', async () => {
    // Arrange
    mockRpc.mockResolvedValue({
      data: [{ plan: 'enterprise_lifetime', status: 'active', current_period_end: null }],
      error: null,
    });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result.plan).toBe('free');
  });

  it('falls back to status "active" when the row status is an unknown string', async () => {
    // Arrange
    mockRpc.mockResolvedValue({
      data: [{ plan: 'pro_yearly', status: 'frozen', current_period_end: null }],
      error: null,
    });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result.status).toBe('active');
  });

  it('passes current_period_end through, including a null value', async () => {
    // Arrange
    mockRpc.mockResolvedValue({
      data: [{ plan: 'pro_yearly', status: 'trialing', current_period_end: null }],
      error: null,
    });

    // Act
    const result = await getEntitlement();

    // Assert
    expect(result.currentPeriodEnd).toBeNull();
  });
});

describe('isPremium — grant/deny matrix', () => {
  it('denies the free plan regardless of status', () => {
    expect(isPremium({ plan: 'free', status: 'active', currentPeriodEnd: null })).toBe(false);
  });

  it('grants pro_monthly + active', () => {
    expect(isPremium({ plan: 'pro_monthly', status: 'active', currentPeriodEnd: null })).toBe(true);
  });

  it('grants pro_yearly + trialing', () => {
    expect(isPremium({ plan: 'pro_yearly', status: 'trialing', currentPeriodEnd: null })).toBe(
      true
    );
  });

  it('denies a paid plan in past_due', () => {
    expect(isPremium({ plan: 'pro_monthly', status: 'past_due', currentPeriodEnd: null })).toBe(
      false
    );
  });

  it('denies a paid plan that is canceled', () => {
    expect(isPremium({ plan: 'pro_monthly', status: 'canceled', currentPeriodEnd: null })).toBe(
      false
    );
  });

  it('denies a paid plan that is expired', () => {
    expect(isPremium({ plan: 'pro_yearly', status: 'expired', currentPeriodEnd: null })).toBe(
      false
    );
  });
});
