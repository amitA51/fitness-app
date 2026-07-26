// ============================================================================
// CONSENT CONTEXT — loads the user's legal-consent status once after auth and
// exposes whether a (re-)acceptance is required. Drives <ConsentGate>.
//
// The server-side audit trail in user_consents is the record of truth; this
// decides when to prompt. Only authenticated cloud users are evaluated, and a
// backend that is not deployed yet never blocks.
//
// It does NOT, however, fail open on a real error any more. Previously a failed
// status read returned an empty list that read as "nothing to accept", and a
// failed write still dismissed the gate — so a user could end up having accepted
// nothing while the app behaved as though they had. Both states are now visible:
// `statusUnavailable` and a rejected `accept()`.
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
  /**
   * True when consent status could not be read. Treated as "unknown", never as
   * "nothing to accept" — the gate stays up and offers a retry.
   */
  statusUnavailable: boolean;
  /**
   * Record acceptance for all pending documents, then refresh.
   * Resolves false when at least one acceptance was not persisted, so the caller
   * keeps the gate up instead of letting the user through unrecorded.
   */
  accept: (options?: RecordConsentOptions) => Promise<boolean>;
  /** Re-fetch consent status. */
  refresh: () => Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<LegalVersionStatus[]>([]);
  const [statusUnavailable, setStatusUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    // Only cloud-authenticated users have a server-side consent record. Guests
    // (local-only) and unauthenticated states never hard-block here.
    if (status !== 'authenticated') {
      setPending([]);
      setStatusUnavailable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { statuses, unavailable } = await getLegalConsentStatus();
    setStatusUnavailable(unavailable);
    setPending(statuses.filter((s) => s.needsConsent));
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (options?: RecordConsentOptions) => {
      const recorded = await acceptPendingConsents(pending, options);
      await refresh();
      return recorded;
    },
    [pending, refresh]
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      loading,
      // An unreadable status is a reason to prompt, not a reason to proceed.
      needsConsent: pending.length > 0 || statusUnavailable,
      pending,
      statusUnavailable,
      accept,
      refresh,
    }),
    [loading, pending, statusUnavailable, accept, refresh]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}
