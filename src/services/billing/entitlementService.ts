// ============================================================================
// ENTITLEMENT SERVICE — wraps the current_entitlement RPC (migration
// 20260610000100_entitlements.sql).
//
// Fail-open: when Supabase is unconfigured, the user is unauthenticated, the
// migration isn't applied, or the RPC errors, getEntitlement() resolves to the
// FREE plan. The app must fully work on free — gating never throws or blocks
// because the backend is missing. Real paywalling turns on once a payment
// provider writes a non-free row.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type { Entitlement, EntitlementStatus, Plan } from './types';
import { FREE_ENTITLEMENT } from './types';

interface CurrentEntitlementRow {
  plan: string;
  status: string;
  current_period_end: string | null;
}

const VALID_PLANS: readonly Plan[] = ['free', 'pro_monthly', 'pro_yearly'];
const VALID_STATUSES: readonly EntitlementStatus[] = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'expired',
];

function toPlan(value: string): Plan {
  return (VALID_PLANS as readonly string[]).includes(value) ? (value as Plan) : 'free';
}

function toStatus(value: string): EntitlementStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
    ? (value as EntitlementStatus)
    : 'active';
}

/**
 * The signed-in user's effective entitlement. Returns FREE_ENTITLEMENT for
 * guests, unconfigured backends, and any error — never rejects.
 */
export async function getEntitlement(): Promise<Entitlement> {
  if (!supabase) return FREE_ENTITLEMENT;

  const user = await getCurrentUser();
  if (!user) return FREE_ENTITLEMENT;

  const { data, error } = await supabase.rpc('current_entitlement');
  if (error) {
    logger.db.error('current_entitlement failed', error);
    return FREE_ENTITLEMENT;
  }

  const rows = (data ?? []) as CurrentEntitlementRow[];
  const row = rows[0];
  if (!row) return FREE_ENTITLEMENT;

  return {
    plan: toPlan(row.plan),
    status: toStatus(row.status),
    currentPeriodEnd: row.current_period_end,
  };
}

/**
 * Whether an entitlement grants paid (premium) access. A non-free plan counts
 * only while it is in a usable state (active or trialing); past_due / canceled
 * / expired fall back to free access.
 */
export function isPremium(entitlement: Entitlement): boolean {
  if (entitlement.plan === 'free') return false;
  return entitlement.status === 'active' || entitlement.status === 'trialing';
}
