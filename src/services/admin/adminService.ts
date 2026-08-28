// ============================================================================
// ADMIN SERVICE — the operator-only surface behind /admin.
//
// Schema: 20260828000000_admin_coach_assignment.sql. Two RPCs, both gated
// SERVER-SIDE by is_app_admin():
//   admin_list_users(_query, _limit)        → { user_id, email, display_name, role }
//   admin_set_coach(_target, _business_name) → void
//
// The database is the authorization boundary; this module is a thin, typed
// wrapper. A refusal arrives from PostgREST as code 42501
// (insufficient_privilege) carrying the message 'not_app_admin' — it is mapped
// to the 'not_admin' code here so no raw Postgres error text ever reaches the
// UI. Every function resolves (never rejects): a thrown network/parse failure
// becomes { ok: false, error: 'server' }.
// ============================================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

const log = logger.db;

/** Default page size for the search. An internal tool needs no pagination. */
export const ADMIN_USER_LIMIT = 25;

export type AdminUserRole = 'coach' | 'trainee';

export interface AdminUser {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: AdminUserRole;
}

/**
 * `not_admin`    — the DB refused: the caller is not in app_admins.
 * `unavailable`  — Supabase is not configured (local-only build).
 * `server`       — anything else (network, missing RPC, unexpected shape).
 */
export type AdminErrorCode = 'not_admin' | 'unavailable' | 'server';

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: AdminErrorCode };

type Row = Record<string, unknown>;

const asString = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/**
 * True when a PostgREST error is the admin gate refusing the call. Both RPCs
 * `RAISE EXCEPTION 'not_app_admin' USING ERRCODE = 'insufficient_privilege'`,
 * which PostgREST reports as code '42501'; the message is checked too so a
 * client that surfaces the SQLSTATE name instead still maps correctly.
 */
function isNotAppAdmin(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42501' || error.code === 'insufficient_privilege') return true;
  return (error.message ?? '').includes('not_app_admin');
}

/** An unknown role string must never read as 'coach' — default to trainee. */
function toRole(value: unknown): AdminUserRole {
  return value === 'coach' ? 'coach' : 'trainee';
}

function toAdminUser(row: Row): AdminUser {
  return {
    userId: asString(row.user_id) ?? '',
    email: asString(row.email),
    displayName: asString(row.display_name),
    role: toRole(row.role),
  };
}

/**
 * Search users by email or display name. An empty query returns recent users
 * (the RPC treats a null `_query` as "no filter"), so the screen has content
 * before the operator types anything.
 */
export async function listAdminUsers(
  query: string,
  limit: number = ADMIN_USER_LIMIT
): Promise<AdminResult<AdminUser[]>> {
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'unavailable' };

  const trimmed = query.trim();

  try {
    const { data, error } = await supabase.rpc('admin_list_users', {
      _query: trimmed.length > 0 ? trimmed : null,
      _limit: limit,
    });

    if (error) {
      log.error('admin_list_users failed', error);
      return { ok: false, error: isNotAppAdmin(error) ? 'not_admin' : 'server' };
    }

    const rows = (data ?? []) as Row[];
    return { ok: true, data: rows.map(toAdminUser).filter((u) => u.userId !== '') };
  } catch (err) {
    log.error('admin_list_users threw', err);
    return { ok: false, error: 'server' };
  }
}

/**
 * Promote a user to coach. The ONLY coach-creation path in the app — the
 * legacy self-service become_coach() RPC is no longer executable by
 * `authenticated`. Idempotent server-side, so a double tap is harmless.
 * A blank business name is sent as null rather than an empty string.
 */
export async function setUserAsCoach(
  userId: string,
  businessName?: string | null
): Promise<AdminResult<null>> {
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'unavailable' };

  const name = (businessName ?? '').trim();

  try {
    const { error } = await supabase.rpc('admin_set_coach', {
      _target: userId,
      _business_name: name.length > 0 ? name : null,
    });

    if (error) {
      log.error('admin_set_coach failed', error);
      return { ok: false, error: isNotAppAdmin(error) ? 'not_admin' : 'server' };
    }

    return { ok: true, data: null };
  } catch (err) {
    log.error('admin_set_coach threw', err);
    return { ok: false, error: 'server' };
  }
}
