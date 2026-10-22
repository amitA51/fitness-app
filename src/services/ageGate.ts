// ============================================================================
// AGE GATE SERVICE — DOB collection + server-authoritative age verification.
// Age is computed in Postgres (set_birth_date RPC) so a tampered client clock
// cannot bypass the minimum age. computeAge() here is UX-only (instant feedback).
//
// Fail-open: unconfigured Supabase / missing migration => "verified" so the app
// never hard-blocks on a missing backend. Real enforcement starts once
// 20260609000200_age_verification.sql is applied.
//
// A failed READ falls back to the last answer the server gave this user. It
// used to fail closed instead, which asked every already-verified user "מה
// תאריך הלידה?" whenever the database was slow.
// ============================================================================

import { supabase } from '../lib/supabase';
import {
  type AccountRef,
  isNewAccount,
  readLastKnownGood,
  writeLastKnownGood,
} from '../utils/lastKnownGood';
import { logger } from '../utils/logger';
import { getCurrentUser } from './supabaseAuth';

export type ParentalConsentStatus = 'not_required' | 'pending' | 'granted' | 'denied';

export interface AgeStatus {
  /** False only when the user has no verification row yet (must enter DOB). */
  hasRecord: boolean;
  ageVerified: boolean;
  parentalConsentStatus: ParentalConsentStatus | null;
  /** True when the live read failed and this is the last server answer (or
   * the fail-open default when there is none). The caller should re-check. */
  unavailable?: boolean;
}

/** How long a PASSING server answer stands in for a failed age-status read. */
export const AGE_LKG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ageLkgKey = (userId: string): string => `age_status_lkg:${userId}`;

const isAgeStatus = (raw: unknown): raw is AgeStatus =>
  typeof raw === 'object' &&
  raw !== null &&
  typeof (raw as AgeStatus).hasRecord === 'boolean' &&
  typeof (raw as AgeStatus).ageVerified === 'boolean';

/** True when the answer lets the user into the app. */
const passes = (s: AgeStatus): boolean =>
  s.hasRecord && (s.ageVerified || s.parentalConsentStatus === 'granted');

/**
 * This user's last server answer, or null. A passing answer expires after
 * AGE_LKG_TTL_MS; a gating one (no row yet, under-age block) never does — only
 * a live answer may lift it, so neither time nor a moved clock gets past it.
 */
export function readCachedAgeStatus(userId: string): AgeStatus | null {
  const key = ageLkgKey(userId);
  const raw = readLastKnownGood<unknown>(key, Number.POSITIVE_INFINITY);
  if (!isAgeStatus(raw)) return null;
  const status: AgeStatus = {
    hasRecord: raw.hasRecord,
    ageVerified: raw.ageVerified,
    parentalConsentStatus: raw.parentalConsentStatus ?? null,
  };
  if (passes(status) && readLastKnownGood<unknown>(key, AGE_LKG_TTL_MS) === null) return null;
  return status;
}

export interface SetBirthDateResult {
  age: number;
  minAge: number;
  verified: boolean;
}

const FAIL_OPEN: AgeStatus = {
  hasRecord: true,
  ageVerified: true,
  parentalConsentStatus: 'not_required',
};

/** No answer for a NEW account: ask for the date of birth, as a live "no row" would. */
const NO_RECORD: AgeStatus = {
  hasRecord: false,
  ageVerified: false,
  parentalConsentStatus: null,
};

/** Postgres undefined_table — migration not applied yet (only fail-open trigger). */
const PG_UNDEFINED_TABLE = '42P01';

/**
 * The signed-in user's age-verification status. Pass the account when the
 * caller already has it (AgeGateContext does); otherwise it is looked up.
 *
 *   * Server answered → that answer, stored as the last-known-good.
 *   * Read failed (network, timeout, 5xx, RLS) → the last stored server answer.
 *     A verified user stays verified (for 30 days); a user the server had
 *     blocked as under age, or had asked for a date of birth, stays so until a
 *     live answer says otherwise — going offline is no way around it.
 *   * Read failed, nothing stored, account older than a week → let the user in
 *     (fail OPEN), flagged `unavailable` so AgeGateContext re-checks. It was
 *     asked when it was new; see isNewAccount.
 *   * Read failed, nothing stored, NEW account → ask for the date of birth.
 *     Sign-up does not record one, so this account may never have been asked.
 */
export async function getAgeStatus(account?: AccountRef): Promise<AgeStatus> {
  // Unconfigured backend → fail-open so the app never hard-blocks on no backend.
  if (!supabase) return FAIL_OPEN;
  let user: AccountRef | null = account ?? null;
  if (!user) {
    try {
      user = await getCurrentUser();
    } catch (err) {
      // No session answer either: nothing to look up, nothing stored to use.
      logger.db.error('getAgeStatus: could not resolve the user', err);
      return { ...FAIL_OPEN, unavailable: true };
    }
  }
  if (!user) return FAIL_OPEN;

  const askedAt = Date.now();
  let data: { age_verified?: unknown; parental_consent_status?: unknown } | null = null;
  let error: { code?: string; message?: string } | null = null;
  try {
    ({ data, error } = await supabase
      .from('user_age_verification')
      .select('age_verified, parental_consent_status')
      .eq('user_id', user.id)
      .maybeSingle());
  } catch (err) {
    error = { message: err instanceof Error ? err.message : String(err) };
  }

  if (error) {
    // An unapplied migration (undefined_table) is not an outage: fail open.
    if (error.code === PG_UNDEFINED_TABLE) return FAIL_OPEN;
    logger.db.error('getAgeStatus failed', error);
    const fallback = readCachedAgeStatus(user.id) ?? (isNewAccount(user) ? NO_RECORD : FAIL_OPEN);
    return { ...fallback, unavailable: true };
  }

  const status: AgeStatus = data
    ? {
        hasRecord: true,
        ageVerified: Boolean(data.age_verified),
        parentalConsentStatus: (data.parental_consent_status as ParentalConsentStatus) ?? null,
      }
    : { ...NO_RECORD };
  writeLastKnownGood(ageLkgKey(user.id), status, askedAt);
  return status;
}

export async function setBirthDate(dobISO: string, country = 'XX'): Promise<SetBirthDateResult> {
  if (!supabase) return { age: 0, minAge: 0, verified: true };
  const { data, error } = await supabase.rpc('set_birth_date', { _dob: dobISO, _country: country });
  if (error) throw error;
  const r = (data ?? {}) as { age: number; min_age: number; verified: boolean };
  // The server's verdict is an answer in its own right: store it, so a failed
  // re-read right after does not fall back to "no row" and ask again.
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    writeLastKnownGood<AgeStatus>(ageLkgKey(user.id), {
      hasRecord: true,
      ageVerified: Boolean(r.verified),
      parentalConsentStatus: null,
    });
  }
  return { age: r.age, minAge: r.min_age, verified: r.verified };
}

/** Client-side age estimate for instant UX feedback (not authoritative). */
export function computeAge(dobISO: string): number {
  const dob = new Date(dobISO);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}
