// ============================================================================
// AGE GATE CONTEXT — loads the user's age-verification status after auth and
// exposes whether DOB collection or an under-age block is required.
// UX gate (server RPC is authoritative). Fail-open for guests / missing backend.
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
import { type SetBirthDateResult, getAgeStatus, setBirthDate } from '../services/ageGate';
import { useAuth } from './AuthContext';

interface AgeGateContextValue {
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

export function AgeGateProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsBirthDate, setNeedsBirthDate] = useState(false);
  const [blockedUnderAge, setBlockedUnderAge] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setNeedsBirthDate(false);
      setBlockedUnderAge(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const s = await getAgeStatus();
    setNeedsBirthDate(!s.hasRecord);
    setBlockedUnderAge(s.hasRecord && !s.ageVerified && s.parentalConsentStatus !== 'granted');
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
