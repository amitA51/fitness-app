import { beforeEach, describe, expect, it, vi } from 'vitest';

// adminService wraps the two operator-only RPCs. The DATABASE is the
// authorization boundary, so the contract that matters here is failure
// handling: a 42501 / 'not_app_admin' refusal must surface as a clean
// { ok: false, error: 'not_admin' } result — never a throw, and never raw
// Postgres text on its way to the UI.

// ── Supabase mock (supabase.rpc) ─────────────────────────────────────────────
const mockRpc = vi.fn();
let configured = true;

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: () => configured,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { ADMIN_USER_LIMIT, listAdminUsers, setUserAsCoach } from '../adminService';

const NOT_ADMIN = { code: '42501', message: 'not_app_admin' };

beforeEach(() => {
  vi.clearAllMocks();
  configured = true;
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('listAdminUsers', () => {
  it('sends a null _query for an empty search so the RPC returns recent users', async () => {
    await listAdminUsers('   ');

    expect(mockRpc).toHaveBeenCalledWith('admin_list_users', {
      _query: null,
      _limit: ADMIN_USER_LIMIT,
    });
  });

  it('sends the trimmed query and the requested limit', async () => {
    await listAdminUsers('  dana@example.com  ', 5);

    expect(mockRpc).toHaveBeenCalledWith('admin_list_users', {
      _query: 'dana@example.com',
      _limit: 5,
    });
  });

  it('maps RPC rows to AdminUser', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'dana@example.com', display_name: 'דנה', role: 'trainee' },
        { user_id: 'u2', email: null, display_name: null, role: 'coach' },
      ],
      error: null,
    });

    const result = await listAdminUsers('');

    expect(result).toEqual({
      ok: true,
      data: [
        { userId: 'u1', email: 'dana@example.com', displayName: 'דנה', role: 'trainee' },
        { userId: 'u2', email: null, displayName: null, role: 'coach' },
      ],
    });
  });

  it('never reads an unknown role string as coach', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'u1', email: null, display_name: null, role: 'superuser' }],
      error: null,
    });

    const result = await listAdminUsers('');

    expect(result.ok && result.data.map((u) => u.role)).toEqual(['trainee']);
  });

  it('surfaces a 42501 / not_app_admin refusal as a clean not_admin failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: NOT_ADMIN });

    const result = await listAdminUsers('dana');

    expect(result).toEqual({ ok: false, error: 'not_admin' });
  });

  it('maps any other RPC error to server without leaking the Postgres message', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function admin_list_users does not exist' },
    });

    const result = await listAdminUsers('dana');

    expect(result).toEqual({ ok: false, error: 'server' });
  });

  it('resolves to server instead of throwing when the RPC rejects', async () => {
    mockRpc.mockRejectedValue(new Error('network down'));

    await expect(listAdminUsers('dana')).resolves.toEqual({ ok: false, error: 'server' });
  });

  it('reports unavailable when Supabase is not configured', async () => {
    configured = false;

    const result = await listAdminUsers('dana');

    expect(result).toEqual({ ok: false, error: 'unavailable' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('setUserAsCoach', () => {
  it('passes the target id and the trimmed business name', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await setUserAsCoach('u1', '  סטודיו דנה  ');

    expect(mockRpc).toHaveBeenCalledWith('admin_set_coach', {
      _target: 'u1',
      _business_name: 'סטודיו דנה',
    });
    expect(result).toEqual({ ok: true, data: null });
  });

  it('sends null rather than an empty string for a blank business name', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await setUserAsCoach('u1', '   ');

    expect(mockRpc).toHaveBeenCalledWith('admin_set_coach', {
      _target: 'u1',
      _business_name: null,
    });
  });

  it('surfaces a 42501 / not_app_admin refusal as a clean not_admin failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: NOT_ADMIN });

    const result = await setUserAsCoach('u1', 'סטודיו');

    expect(result).toEqual({ ok: false, error: 'not_admin' });
  });

  it('maps a refusal reported by SQLSTATE name to not_admin too', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'insufficient_privilege', message: 'permission denied' },
    });

    const result = await setUserAsCoach('u1');

    expect(result).toEqual({ ok: false, error: 'not_admin' });
  });

  it('resolves to server instead of throwing when the RPC rejects', async () => {
    mockRpc.mockRejectedValue(new Error('boom'));

    await expect(setUserAsCoach('u1')).resolves.toEqual({ ok: false, error: 'server' });
  });

  it('reports unavailable when Supabase is not configured', async () => {
    configured = false;

    const result = await setUserAsCoach('u1');

    expect(result).toEqual({ ok: false, error: 'unavailable' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
