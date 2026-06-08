// ============================================================================
// ENTITLEMENT CONTEXT — loads the user's entitlement once after auth and
// exposes premium status + a <PlanGate> for feature gating. Mirrors
// ConsentContext: only cloud-authenticated users are evaluated, and any
// backend gap → FREE (fail-open, never blocks).
//
// The gate is UX-only. Real enforcement of expensive actions (e.g. AI calls)
// must also happen server-side in RLS / edge functions.
// ============================================================================

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  isPremium as computeIsPremium,
  getEntitlement,
} from '../services/billing/entitlementService';
import type { Entitlement } from '../services/billing/types';
import { FREE_ENTITLEMENT, isPremiumFeature } from '../services/billing/types';
import { useAuth } from './AuthContext';

interface EntitlementContextValue {
  /** True while the initial entitlement fetch is in flight. */
  loading: boolean;
  /** The user's effective entitlement (FREE_ENTITLEMENT until loaded / on free). */
  entitlement: Entitlement;
  /** True when the entitlement grants paid access. */
  isPremium: boolean;
  /** Re-fetch the entitlement (call after a successful purchase / restore). */
  refresh: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);

  const refresh = useCallback(async () => {
    // Only cloud-authenticated users can have a paid entitlement. Guests
    // (local-only) and unauthenticated states stay on the free plan.
    if (status !== 'authenticated') {
      setEntitlement(FREE_ENTITLEMENT);
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await getEntitlement();
    setEntitlement(next);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<EntitlementContextValue>(
    () => ({ loading, entitlement, isPremium: computeIsPremium(entitlement), refresh }),
    [loading, entitlement, refresh]
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error('useEntitlement must be used within an EntitlementProvider');
  return ctx;
}

interface PlanGateProps {
  /** A premium feature key (see PREMIUM_FEATURES). Non-premium keys are never gated. */
  feature: string;
  /** Rendered when the feature is gated and the user is not entitled. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only when the user may access `feature`. A feature that is
 * not in PREMIUM_FEATURES is always allowed. A premium feature is allowed only
 * for a premium (active/trialing paid) entitlement; otherwise `fallback` (or a
 * minimal locked notice) renders.
 */
export function PlanGate({ feature, fallback, children }: PlanGateProps) {
  const { isPremium, loading } = useEntitlement();

  // Free features, and everything while the entitlement is still loading, pass
  // through — we never flash a paywall over content the user may well own.
  if (!isPremiumFeature(feature) || loading || isPremium) {
    return <>{children}</>;
  }

  return <>{fallback ?? <DefaultLockedNotice />}</>;
}

/** Minimal Fresh Steel fallback when a gated feature has no custom paywall yet. */
function DefaultLockedNotice() {
  return (
    <div
      role="note"
      style={{
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--color-separator)',
        background: 'var(--fs-surface)',
        color: 'var(--fs-ink)',
        textAlign: 'center',
      }}
    >
      תכונה זו זמינה במנוי הפרימיום.
    </div>
  );
}
