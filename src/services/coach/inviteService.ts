// ============================================================================
// COACH PLATFORM — Invite + consent service
// ============================================================================
// Coach creates invites (email + shareable code). The trainee accepts by code,
// which routes through the `coach-invite-accept` edge function (service role):
// RLS hides other coaches' invite rows, and the function is the trusted place
// to validate the code, enforce seats, and record consent atomically.

import type { CoachInvite } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toInvite } from './mappers';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 30 chars, no ambiguous
const REJECT_THRESHOLD = 240; // 30 * 8 = 240; reject bytes >= 240 to eliminate modulo bias
const generateCode = (len = 8): string => {
  let out = '';
  while (out.length < len) {
    const bytes = new Uint8Array(len - out.length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < len; i++) {
      if (bytes[i]! < REJECT_THRESHOLD) out += ALPHABET[bytes[i]! % ALPHABET.length];
    }
  }
  return out;
};

const DEFAULT_TTL_DAYS = 14;

/** Coach creates an invite. Returns the invite (with its shareable code). */
export const createInvite = async (email?: string): Promise<CoachInvite> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');

  const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 86_400_000).toISOString();

  // Retry once on the (extremely unlikely) code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('coach_invites')
      .insert({
        coach_id: user.id,
        email: email?.trim() || null,
        code,
        expires_at: expiresAt,
      })
      .select('*')
      .single();
    if (!error && data) return toInvite(data);
    // Server-side seat enforcement (trg_enforce_invite_seat_limit): a full
    // coach may not mint new pending codes. Surface a typed error the UI maps
    // to a specific message instead of the generic create-failure toast.
    if (error?.message?.includes('invite_seat_limit_reached')) {
      throw new Error('seat_limit');
    }
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation
  }
  throw new Error('could_not_generate_invite_code');
};

export const listInvites = async (): Promise<CoachInvite[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('coach_invites')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listInvites failed', error);
    // Throw so the invites screen shows its error state, not a fake empty list.
    throw new Error(error.message);
  }
  return (data ?? []).map(toInvite);
};

export const revokeInvite = async (id: string): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('coach_invites').update({ status: 'revoked' }).eq('id', id);
  return { error: error?.message ?? null };
};

export interface AcceptResult {
  ok: boolean;
  error?:
    | 'invalid'
    | 'expired'
    | 'seat_limit'
    | 'already'
    | 'offline'
    | 'server'
    | 'rate_limited'
    | 'unauthenticated'
    | 'unknown'
    | 'coaches_cannot_join';
  coachId?: string;
}

/**
 * Trainee accepts an invite by code, granting the coach access (consent).
 * Delegates to the edge function which validates + records consent atomically.
 */
export const acceptInvite = async (code: string): Promise<AcceptResult> => {
  const supabase = requireClient();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: 'invalid' };

  // Offline guard before the round-trip so a known-offline accept doesn't
  // collapse into the misleading 'קוד לא תקין'.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }

  const { data, error } = await supabase.functions.invoke('coach-invite-accept', {
    body: { code: normalized },
  });
  if (error) {
    logger.db.error('acceptInvite failed', error);
    // A transport-level failure (network drop / non-2xx) is NOT an invalid code:
    // map it to 'offline' when the connection is gone, otherwise 'server'.
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, error: isOffline ? 'offline' : 'server' };
  }
  const res = data as AcceptResult;
  return res?.ok
    ? { ok: true, coachId: res.coachId }
    : { ok: false, error: res?.error ?? 'unknown' };
};

/** Build a shareable invite link for the given code. */
export const inviteLink = (code: string): string =>
  `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
