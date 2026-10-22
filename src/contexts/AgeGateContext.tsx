// ============================================================================
// AGE GATE CONTEXT — loads the user's age-verification status after auth and
// exposes whether DOB collection or an under-age block is required.
// UX gate (server RPC is authoritative). Fail-open for guests / missing backend.
//
// A failed read does not ask a verified user for a date of birth: getAgeStatus
// falls back to the last server answer for this user (with none stored, an
// established account is let in and only a new one is asked), and this context
// re-checks in the background until a read succeeds. The first
// paint uses the stored answer, and a refresh keeps the previous decision until
// the new one lands, so the gate (and the app shell behind it) never flickers.
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
  type AgeStatus,
  type SetBirthDateResult,
  getAgeStatus,
  readCachedAgeStatus,
  setBirthDate,
} from '../services/ageGate';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/** While the status read keeps failing, try again this often (and on reconnect). */
export const AGE_RECHECK_MS = 5 * 60_000;

interface AgeGateContextValue {
  /** True only while the first read is in flight for a user with no stored answer. */
  loading: boolean;
  /** User has no verification record yet — must enter DOB. */
  needsBirthDate: boolean;
  /** User entered DOB but is under the minimum age (and not granted consent). */
  blockedUnderAge: boolean;
  /** Submit a DOB; resolves with the server's verdict. */
  submit: (dobISO: string, country?: string) => Promise<SetBirthDateResult>;
  refresh: () => Promise<void>;
}

const AgeGateContext = createContext<AgeGateContextValue | null>(null);

const needsDob = (s: AgeStatus | null): boolean => s !== null && !s.hasRecord;
const isUnderAge = (s: AgeStatus | null): boolean =>
  s?.hasRecord === true && !s.ageVerified && s.parentalConsentStatus !== 'granted';

export function AgeGateProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = status === 'authenticated' ? (user?.id ?? null) : null;
  const createdAt = user?.created_at;

  const [loading, setLoading] = useState(
    () => userId !== null && readCachedAgeStatus(userId) === null
  );
  const [needsBirthDate, setNeedsBirthDate] = useState(() =>
    needsDob(userId ? readCachedAgeStatus(userId) : null)
  );
  const [blockedUnderAge, setBlockedUnderAge] = useState(() =>
    isUnderAge(userId ? readCachedAgeStatus(userId) : null)
  );
  const [unavailable, setUnavailable] = useState(false);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!userId) {
      setNeedsBirthDate(false);
      setBlockedUnderAge(false);
      setUnavailable(false);
      setLoading(false);
      return;
    }
    try {
      const s = await getAgeStatus({ id: userId, created_at: createdAt });
      if (generation !== generationRef.current) return;
      setNeedsBirthDate(needsDob(s));
      setBlockedUnderAge(isUnderAge(s));
      setUnavailable(Boolean(s.unavailable));
    } catch (err) {
      // Not expected (getAgeStatus reports failures in its result), but a throw
      // must still end the first-load state and start the background re-check.
      logger.app.warn('Age status check failed', err);
      if (generation !== generationRef.current) return;
      setUnavailable(true);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [userId, createdAt]);

  // A different account on this device starts from ITS stored answer.
  const lastUserRef = useRef(userId);
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      const cached = userId ? readCachedAgeStatus(userId) : null;
      setNeedsBirthDate(needsDob(cached));
      setBlockedUnderAge(isUnderAge(cached));
      setUnavailable(false);
      setLoading(userId !== null && cached === null);
    }
    void refresh();
  }, [userId, refresh]);

  // Recover in the background while the read keeps failing.
  useEffect(() => {
    if (!unavailable) return;
    const recheck = () => void refresh();
    const timer = window.setInterval(recheck, AGE_RECHECK_MS);
    window.addEventListener('online', recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', recheck);
    };
  }, [unavailable, refresh]);

  const submit = useCallback(
    async (dobISO: string, country = 'XX') => {
      const result = await setBirthDate(dobISO, country);
      await refresh();
      return result;
    },
    [refresh]
  );

  const value = useMemo<AgeGateContextValue>(
    () => ({ loading, needsBirthDate, blockedUnderAge, submit, refresh }),
    [loading, needsBirthDate, blockedUnderAge, submit, refresh]
  );

  return <AgeGateContext.Provider value={value}>{children}</AgeGateContext.Provider>;
}

export function useAgeGate(): AgeGateContextValue {
  const ctx = useContext(AgeGateContext);
  if (!ctx) throw new Error('useAgeGate must be used within an AgeGateProvider');
  return ctx;
}
