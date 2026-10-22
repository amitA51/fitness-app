// The running-coach conversation: answered turns (kept in sessionStorage, so
// the chat survives leaving the screen), the question in flight, and a failed
// question that can be sent again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { humanizeAIError } from '../../../services/ai/errorMessages';
import { type CoachTurn, askRunningCoach } from '../../../services/ai/runningCoach';
import { logger } from '../../../utils/logger';

/** Wiped with the rest of the account's data on sign-out (userScopedLocalData). */
export const COACH_CHAT_KEY = 'running_coach_chat_v1';
/** Turns kept across navigation (five questions and their answers). */
const KEEP_TURNS = 10;

const isTurn = (v: unknown): v is CoachTurn =>
  typeof v === 'object' &&
  v !== null &&
  ((v as CoachTurn).role === 'user' || (v as CoachTurn).role === 'assistant') &&
  typeof (v as CoachTurn).content === 'string';

export function readCoachChat(): CoachTurn[] {
  try {
    const raw = sessionStorage.getItem(COACH_CHAT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTurn).slice(-KEEP_TURNS) : [];
  } catch {
    return [];
  }
}

function writeCoachChat(turns: readonly CoachTurn[]): void {
  try {
    if (turns.length)
      sessionStorage.setItem(COACH_CHAT_KEY, JSON.stringify(turns.slice(-KEEP_TURNS)));
    else sessionStorage.removeItem(COACH_CHAT_KEY);
  } catch {
    // Storage blocked: the chat lives only while the screen is open.
  }
}

export interface CoachChat {
  turns: CoachTurn[];
  /** The question being answered, or the one that failed. */
  pending: string | null;
  asking: boolean;
  error: string | null;
  ask: (question: string) => Promise<void>;
  retry: () => void;
  clear: () => void;
}

/** `getBrief` is called at send time, so the numbers are always current. */
export function useCoachChat(getBrief: () => string): CoachChat {
  const [turns, setTurns] = useState<CoachTurn[]>(readCoachChat);
  const [pending, setPending] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const askingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => writeCoachChat(turns), [turns]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || askingRef.current) return;
      askingRef.current = true;
      setPending(q);
      setAsking(true);
      setError(null);
      try {
        const answer = await askRunningCoach(q, getBrief(), turnsRef.current);
        if (!mounted.current) {
          // Left the screen mid-answer: keep the answer for when they come back.
          writeCoachChat([
            ...turnsRef.current,
            { role: 'user', content: q },
            { role: 'assistant', content: answer },
          ]);
          return;
        }
        setTurns((prev) =>
          [
            ...prev,
            { role: 'user' as const, content: q },
            { role: 'assistant' as const, content: answer },
          ].slice(-KEEP_TURNS)
        );
        setPending(null);
      } catch (e) {
        logger.ai.warn('Running coach question failed', e);
        if (mounted.current) setError(humanizeAIError(e));
      } finally {
        askingRef.current = false;
        if (mounted.current) setAsking(false);
      }
    },
    [getBrief]
  );

  const retry = useCallback(() => {
    if (pending) void ask(pending);
  }, [ask, pending]);

  const clear = useCallback(() => {
    if (askingRef.current) return;
    setTurns([]);
    setPending(null);
    setError(null);
  }, []);

  return { turns, pending, asking, error, ask, retry, clear };
}
