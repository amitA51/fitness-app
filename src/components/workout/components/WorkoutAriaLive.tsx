// WorkoutAriaLive - Screen-reader announcements for workout events
// Subscribes to workout state and announces key transitions (set complete,
// rest start, rest end, PR celebration) via an aria-live polite region.
//
// Throttled to one announcement per ANNOUNCE_THROTTLE_MS to avoid drowning
// the SR queue when multiple state changes fire in the same tick.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkoutDerived, useWorkoutState } from '../core/WorkoutContext';

const ANNOUNCE_THROTTLE_MS = 800;

const MESSAGES = {
  SET_COMPLETE: 'סט הושלם',
  REST_START: (seconds: number) => `מנוחה התחילה: ${seconds} שניות`,
  REST_END: 'מנוחה הסתיימה, התחל סט',
  PR: (exerciseName: string) => (exerciseName ? `שיא חדש! ${exerciseName}` : 'שיא חדש!'),
} as const;

function WorkoutAriaLive(): JSX.Element {
  const state = useWorkoutState();
  const derived = useWorkoutDerived();
  const [message, setMessage] = useState<string>('');

  // Track last-known values to derive transitions
  const lastCompletedCountRef = useRef<number>(derived.completedSetsCount);
  const lastRestActiveRef = useRef<boolean>(state.restTimer.active);
  const lastPRIdRef = useRef<string | null>(state.showPRCelebration?.id ?? null);

  // Throttle bookkeeping
  const lastAnnouncedAtRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessageRef = useRef<string | null>(null);

  // Stable announce function with throttling (latest-wins within window)
  const announce = useMemo(() => {
    const flush = (msg: string): void => {
      // Toggle to empty first so SR re-reads identical consecutive messages
      setMessage('');
      // Defer the new value to next frame so the cleared state commits first
      requestAnimationFrame(() => {
        setMessage(msg);
      });
      lastAnnouncedAtRef.current = Date.now();
      pendingMessageRef.current = null;
    };

    return (next: string): void => {
      if (!next) return;
      const now = Date.now();
      const sinceLast = now - lastAnnouncedAtRef.current;

      if (sinceLast >= ANNOUNCE_THROTTLE_MS) {
        flush(next);
        return;
      }

      // Within throttle window — queue (latest wins)
      pendingMessageRef.current = next;
      if (pendingTimeoutRef.current) return;

      const wait = ANNOUNCE_THROTTLE_MS - sinceLast;
      pendingTimeoutRef.current = setTimeout(() => {
        pendingTimeoutRef.current = null;
        const queued = pendingMessageRef.current;
        if (queued) flush(queued);
      }, wait);
    };
  }, []);

  // Cleanup pending timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    };
  }, []);

  // Set completion — derive from completedSetsCount increase
  useEffect(() => {
    const prev = lastCompletedCountRef.current;
    const current = derived.completedSetsCount;
    if (current > prev) {
      announce(MESSAGES.SET_COMPLETE);
    }
    lastCompletedCountRef.current = current;
  }, [derived.completedSetsCount, announce]);

  // Rest timer transitions (start / end)
  useEffect(() => {
    const wasActive = lastRestActiveRef.current;
    const isActive = state.restTimer.active;

    if (!wasActive && isActive) {
      const seconds = Math.max(0, Math.round(state.restTimer.totalTime));
      // Rest start often coincides with set complete — throttle queues latest
      announce(MESSAGES.REST_START(seconds));
    } else if (wasActive && !isActive) {
      announce(MESSAGES.REST_END);
    }

    lastRestActiveRef.current = isActive;
  }, [state.restTimer.active, state.restTimer.totalTime, announce]);

  // PR celebration
  useEffect(() => {
    const currentId = state.showPRCelebration?.id ?? null;
    const prevId = lastPRIdRef.current;

    if (currentId && currentId !== prevId) {
      const name = state.showPRCelebration?.exerciseName?.trim() ?? '';
      announce(MESSAGES.PR(name));
    }

    lastPRIdRef.current = currentId;
  }, [state.showPRCelebration, announce]);

  // role="status" + aria-live="polite" is the most predictable SR announcement
  // surface across NVDA / VoiceOver / JAWS / TalkBack. <output> is not yet as
  // well-supported for live regions, so we keep the explicit ARIA pattern.
  return (
    // biome-ignore lint/a11y/useSemanticElements: see note above; <output> live-region support is uneven
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export default WorkoutAriaLive;
