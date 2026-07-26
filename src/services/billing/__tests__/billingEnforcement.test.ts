// ============================================================================
// isPremium — billing period enforcement
// ============================================================================
// isPremium() previously looked only at plan + status, so a missed or delayed
// "subscription ended" webhook left a lapsed entitlement reading as premium
// indefinitely. A 24h grace window keeps a genuine payer from being cut off by
// webhook lag; the same window is applied server-side in has_paid_entitlement()
// and current_entitlement() (migration 20260726100000_billing_core.sql).
// ============================================================================

import { describe, expect, it } from 'vitest';
import { isPremium } from '../entitlementService';
import type { Entitlement } from '../types';

const HOUR = 60 * 60 * 1000;

const base: Entitlement = {
  plan: 'pro_monthly',
  status: 'active',
  currentPeriodEnd: null,
};

describe('isPremium — billing period enforcement', () => {
  it('grants access with no period end recorded', () => {
    expect(isPremium(base)).toBe(true);
  });

  it('grants access while the period is still open', () => {
    const future = new Date(Date.now() + 5 * 24 * HOUR).toISOString();
    expect(isPremium({ ...base, currentPeriodEnd: future })).toBe(true);
  });

  it('keeps access inside the 24h webhook-lag grace window', () => {
    const justEnded = new Date(Date.now() - 2 * HOUR).toISOString();
    expect(isPremium({ ...base, currentPeriodEnd: justEnded })).toBe(true);
  });

  it('revokes access once the period end plus grace has passed', () => {
    const longGone = new Date(Date.now() - 72 * HOUR).toISOString();
    expect(isPremium({ ...base, currentPeriodEnd: longGone })).toBe(false);
  });

  it('does not revoke access on an unparseable period end', () => {
    expect(isPremium({ ...base, currentPeriodEnd: 'not-a-date' })).toBe(true);
  });

  it('still refuses a free plan regardless of period', () => {
    const future = new Date(Date.now() + 30 * 24 * HOUR).toISOString();
    expect(isPremium({ plan: 'free', status: 'active', currentPeriodEnd: future })).toBe(false);
  });

  it('refuses a non-usable status even inside an open period', () => {
    const future = new Date(Date.now() + 30 * 24 * HOUR).toISOString();
    expect(isPremium({ ...base, status: 'past_due', currentPeriodEnd: future })).toBe(false);
    expect(isPremium({ ...base, status: 'canceled', currentPeriodEnd: future })).toBe(false);
  });
});
