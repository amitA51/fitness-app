// ============================================================================
// CONSENT CONTEXT — loads the user's legal-consent status once after auth and
// exposes whether a (re-)acceptance is required. Drives <ConsentGate>.
//
// UX-only gate (like CoachGuard): the server-side audit trail in user_consents
// is the record of truth; this just decides when to prompt. Fail-open: only
// authenticated cloud users are evaluated, and any backend gap → no block.
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
import { acceptPendingConsents, getLegalConsentStatus } from '../services/consent/consentService';
import type { LegalVersionStatus, RecordConsentOptions } from '../services/consent/types';
import { useAuth } from './AuthContext';

interface ConsentContextValue {
  /** True while the initial status fetch is in flight. */
  loading: boolean;
  /** True when the user must accept one or more updated documents. */
  needsConsent: boolean;
  /** The documents awaiting acceptance. */
  pending: LegalVersionStatus[];
  /** Record acceptance for all pending documents, then refresh. */
  accept: (options?: RecordConsentOptions) => Promise<void>;
  /** Re-fetch consent status. */
  refresh: () => Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<LegalVersionStatus[]>([]);

  const refresh = useCallback(async () => {
    // Only cloud-authenticated users have a server-side consent record. Guests
    // (local-only) and unauthenticated states never hard-block here.
    if (status !== 'authenticated') {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const statuses = await getLegalConsentStatus();
    setPending(statuses.filter((s) => s.needsConsent));
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (options?: RecordConsentOptions) => {
      await acceptPendingConsents(pending, options);
      await refresh();
    },
    [pending, refresh]
  );

  const value = useMemo<ConsentContextValue>(
    () => ({ loading, needsConsent: pending.length > 0, pending, accept, refresh }),
    [loading, pending, accept, refresh]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}
