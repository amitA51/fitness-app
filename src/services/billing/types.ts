// Billing / entitlement shared types. Mirrors the current_entitlement RPC
// and the entitlements table (migration 20260610000100_entitlements.sql).
// Platform-agnostic: the same model serves web (Stripe/Paddle) and native
// (Apple/Google) once those providers are wired in.

export type Plan = 'free' | 'pro_monthly' | 'pro_yearly';

export type EntitlementStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';

export type BillingSource = 'web_stripe' | 'web_paddle' | 'apple' | 'google';

export interface Entitlement {
  plan: Plan;
  status: EntitlementStatus;
  /** ISO timestamp the current paid period ends, or null on free / no row. */
  currentPeriodEnd: string | null;
}

/** The fail-safe default: every user is at least a free, active member. */
export const FREE_ENTITLEMENT: Entitlement = {
  plan: 'free',
  status: 'active',
  currentPeriodEnd: null,
};

/**
 * Feature keys that require a non-free, paying entitlement. A feature absent
 * from this list is always available (free included). Keep keys stable —
 * <PlanGate feature="..."> and any server-side enforcement reference them.
 */
export const PREMIUM_FEATURES = [
  'advanced_progress',
  'ai_coach',
  'unlimited_templates',
  'progress_photos',
  'cloud_sync',
  'data_export',
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** Type guard: is this string a gated premium feature? */
export function isPremiumFeature(feature: string): feature is PremiumFeature {
  return (PREMIUM_FEATURES as readonly string[]).includes(feature);
}
