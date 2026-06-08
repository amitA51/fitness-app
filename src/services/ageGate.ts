// ============================================================================
// AGE GATE SERVICE — DOB collection + server-authoritative age verification.
// Age is computed in Postgres (set_birth_date RPC) so a tampered client clock
// cannot bypass the minimum age. computeAge() here is UX-only (instant feedback).
//
// Fail-open: unconfigured Supabase / missing migration => "verified" so the app
// never hard-blocks on a missing backend. Real enforcement starts once
// 20260609000200_age_verification.sql is applied.
// ============================================================================

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getCurrentUser } from './supabaseAuth';

export type ParentalConsentStatus = 'not_required' | 'pending' | 'granted' | 'denied';

export interface AgeStatus {
  /** False only when the user has no verification row yet (must enter DOB). */
  hasRecord: boolean;
  ageVerified: boolean;
  parentalConsentStatus: ParentalConsentStatus | null;
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

export async function getAgeStatus(): Promise<AgeStatus> {
  if (!supabase) return FAIL_OPEN;
  const user = await getCurrentUser();
  if (!user) return FAIL_OPEN;
  const { data, error } = await supabase
    .from('user_age_verification')
    .select('age_verified, parental_consent_status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    // Table may not exist yet (migration unapplied) → fail-open, don't block.
    logger.db.error('getAgeStatus failed', error);
    return FAIL_OPEN;
  }
  if (!data) return { hasRecord: false, ageVerified: false, parentalConsentStatus: null };
  return {
    hasRecord: true,
    ageVerified: Boolean(data.age_verified),
    parentalConsentStatus: (data.parental_consent_status as ParentalConsentStatus) ?? null,
  };
}

export async function setBirthDate(dobISO: string, country = 'XX'): Promise<SetBirthDateResult> {
  if (!supabase) return { age: 0, minAge: 0, verified: true };
  const { data, error } = await supabase.rpc('set_birth_date', { _dob: dobISO, _country: country });
  if (error) throw error;
  const r = (data ?? {}) as { age: number; min_age: number; verified: boolean };
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
