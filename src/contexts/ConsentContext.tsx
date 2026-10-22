// ============================================================================
// CONSENT CONTEXT — loads the user's legal-consent status once after auth and
// exposes whether a (re-)acceptance is required. Drives <ConsentGate>.
//
// The server-side audit trail in user_consents is the record of truth; this
// decides when to prompt. Only authenticated cloud users are evaluated, and a
// backend that is not deployed yet never blocks.
//
// A failed WRITE is never treated as consent: `accept()` resolves false and the
// gate stays up. A failed READ is a different matter — the server being slow or
// down says nothing about whether this user accepted. It falls back to the last
// answer the server gave this user; with none stored, an established account is
// let in and a new one is held, while this keeps re-checking in the background
// (see getConsentGateStatus). It used to put the full-screen "terms updated"
// wall in front of everyone, every time the database was overloaded.
//
// The gate also never flickers on a re-check: `loading` is only true for the
// very first read of a user with no stored answer, and a refresh keeps showing
// the previous decision until the new one lands. Flipping the gate unmounts and
// remounts the whole app shell behind it, repeating every start-up request.
// ============================================================================

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  acceptPendingConsents,
  cacheConsentPending,
  getConsentGateStatus,
  readCachedConsentPending,
} from '../services/consent/consentService';
import type { LegalVersionStatus, RecordConsentOptions } from '../services/consent/types';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/** While the status read keeps failing, try again this often (and on reconnect). */
export const CONSENT_RECHECK_MS = 5 * 60_000;

interface ConsentContextValue {
  /** True while the first status read is in flight for a user with no stored answer. */
  loading: boolean;
  /** True when the user must accept one or more updated documents. */
  needsConsent: boolean;
  /** The documents awaiting acceptance. */
  pending: LegalVersionStatus[];
  /**
   * True when the live status read failed. The decision then rests on the last
   * server answer (see getConsentGateStatus) and is re-checked in the background.
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
  const { status, user } = useAuth();
  // Only cloud-authenticated users have a server-side consent record. Guests
  // (local-only) and unauthenticated states never hard-block here.
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;
  const createdAt = user?.created_at;

  // First paint uses the stored answer, so a returning user is decided at once.
  const [pending, setPending] = useState<LegalVersionStatus[]>(() =>
    userId ? (readCachedConsentPending(userId) ?? []) : []
  );
  const [loading, setLoading] = useState(
    () => userId !== null && readCachedConsentPending(userId) === null
  );
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [unverified, setUnverified] = useState(false);
  // Bumped per read, so a slow answer for a previous account (or an older
  // read) cannot overwrite a newer one.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!userId) {
      setPending([]);
      setStatusUnavailable(false);
      setUnverified(false);
      setLoading(false);
      return;
    }
    try {
      const result = await getConsentGateStatus({ id: userId, created_at: createdAt });
      if (generation !== generationRef.current) return;
      setStatusUnavailable(result.unavailable);
      setUnverified(result.unverified);
      setPending(result.pending);
    } catch (err) {
      // Not expected (the service reports failures in its result), but a throw
      // must still end the first-load state and start the background re-check.
      logger.app.warn('Consent status check failed', err);
      if (generation !== generationRef.current) return;
      setStatusUnavailable(true);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [userId, createdAt]);

  // A different account on this device starts from ITS stored answer.
  const lastUserRef = useRef(userId);
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      const cached = userId ? readCachedConsentPending(userId) : null;
      setPending(cached ?? []);
      setLoading(userId !== null && cached === null);
      setStatusUnavailable(false);
      setUnverified(false);
    }
    void refresh();
  }, [userId, refresh]);

  // Recover in the background while the read keeps failing.
  useEffect(() => {
    if (!statusUnavailable) return;
    const recheck = () => void refresh();
    const timer = window.setInterval(recheck, CONSENT_RECHECK_MS);
    window.addEventListener('online', recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', recheck);
    };
  }, [statusUnavailable, refresh]);

  const accept = useCallback(
    async (options?: RecordConsentOptions) => {
      // Held without knowing WHICH documents (no answer yet for a new account):
      // there is nothing that could be recorded, so only try to get an answer.
      if (pending.length === 0) {
        await refresh();
        return false;
      }
      const recorded = await acceptPendingConsents(pending, options);
      // Stamped AFTER the write: a read asked before this moment may not see it.
      const askedAt = Date.now();
      if (recorded && userId) {
        // Every listed document was persisted server-side, so the gate drops and
        // the stored answer becomes "nothing pending" — otherwise a failed
        // re-read below would bring back the old list and wall off a user whose
        // consent is already recorded. If the list came from the stored fallback
        // it may miss a document the server added since; the next LIVE read
        // replaces this answer and asks for it then.
        cacheConsentPending(userId, [], askedAt);
        setPending([]);
      }
      await refresh();
      return recorded;
    },
    [pending, refresh, userId]
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      loading,
      // Only documents the server listed (now, or at its last answer) block —
      // plus a new account the server has never answered for.
      needsConsent: pending.length > 0 || unverified,
      pending,
      statusUnavailable,
      accept,
      refresh,
    }),
    [loading, pending, unverified, statusUnavailable, accept, refresh]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within a ConsentProvider');
  return ctx;
}
