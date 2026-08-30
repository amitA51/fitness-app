// T-110 — the two silent workout-loss paths that live in WorkoutProvider.
//
// 1. A draft older than MAX_DRAFT_AGE_MS (12h) used to be removeItem'd on load
//    and replaced with an empty workout. The trainee who logged sets at 21:00
//    and opened the app at 10:00 the next morning is inside that window: the
//    sets were gone and nothing ever said so. The clock WAS bogus — that is a
//    clock problem — so the clock is reset and the sets are kept.
// 2. An unwritable store (private mode / quota / iOS storage pressure) made
//    persistState return false, and all five call sites dropped it. Surfaced
//    now via the app's existing toast, exactly ONCE per session.

import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveExercise } from '../../../../types';
import { useWorkoutState } from '../WorkoutContext';
import { WorkoutProvider } from '../WorkoutProvider';
import type { WorkoutState } from '../workoutTypes';

const STORAGE_KEY = 'active_workout_v3_state';
const HOUR = 60 * 60 * 1000;

// ── platform adapter double ───────────────────────────────────────────────
// `writable=false` reproduces Safari private mode / quota: setItem is accepted
// and silently stores nothing, which is exactly what the real webPlatform does
// (it swallows the throw), so a read-back is the only usable failure signal.
const store = new Map<string, string>();
let writable = true;
let visibilityCb: ((hidden: boolean) => void) | null = null;

vi.mock('../../../../platform/web', () => ({
  webPlatform: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (!writable) return;
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    requestWakeLock: async () => null,
    onVisibilityChange: (cb: (hidden: boolean) => void) => {
      visibilityCb = cb;
      return () => {
        visibilityCb = null;
      };
    },
    onBeforeUnload: () => () => {},
    playRestEndSound: () => {},
    setSoundEnabled: () => {},
    hasNotificationPermission: () => false,
    requestNotificationPermission: async () => false,
    showRestEndNotification: () => {},
    clearRestEndNotification: () => {},
  },
}));

const showToast = vi.fn();
vi.mock('../../../ui/GlobalToast', () => ({ showToast: (...a: unknown[]) => showToast(...a) }));

// ── fixtures ──────────────────────────────────────────────────────────────

const loggedExercise = (): ActiveExercise =>
  ({
    id: 'ex-1',
    name: 'סקוואט | Squat',
    sets: [
      { id: 's1', reps: 8, weight: 100, completedAt: 1 },
      { id: 's2', reps: 8, weight: 105, completedAt: 2 },
      { id: 's3', reps: 6, weight: 110, completedAt: 3 },
    ],
  }) as unknown as ActiveExercise;

/** Seed a draft with three logged sets whose last persist was `ageMs` ago. */
const seedDraft = (ageMs: number) => {
  const persistedAt = Date.now() - ageMs;
  store.set(
    STORAGE_KEY,
    JSON.stringify({
      exercises: [loggedExercise()],
      currentExerciseIndex: 0,
      supersetGroups: [],
      startTimestamp: persistedAt - 30 * 60 * 1000,
      totalPausedTime: 0,
      lastPauseTimestamp: null,
      isPaused: false,
      restTimer: { active: false, endTime: null, totalTime: 0, timeLeft: 0 },
      appSettings: {},
      finalized: false,
      lastPersistedAt: persistedAt,
    })
  );
};

let seen: WorkoutState | null = null;
const Probe = () => {
  seen = useWorkoutState();
  return null;
};

const mountProvider = () =>
  render(
    <WorkoutProvider item={{ id: 'w1', exercises: [] }} onUpdate={vi.fn()} onExit={vi.fn()}>
      <Probe />
    </WorkoutProvider>
  );

beforeEach(() => {
  store.clear();
  writable = true;
  visibilityCb = null;
  seen = null;
  showToast.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

// ══════════════════════════════════════════════════════════════════════════
// DEFECT 1 — a stale clock must not cost the sets
// ══════════════════════════════════════════════════════════════════════════

describe('T-110 defect 1 — a 13-hour-old draft keeps its logged sets', () => {
  it('restores all three logged sets from a 13h-old draft instead of discarding them', () => {
    seedDraft(13 * HOUR);

    mountProvider();

    // FAILS on the old code: loadState removeItem'd the draft and returned null,
    // so the provider mounted an empty workout — three logged sets, gone.
    expect(seen?.exercises).toHaveLength(1);
    const sets = seen?.exercises[0]?.sets ?? [];
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.weight)).toEqual([100, 105, 110]);
    expect(sets.every((s) => s.completedAt)).toBe(true);
  });

  it('does not delete the stored draft off disk while restoring it', () => {
    seedDraft(13 * HOUR);

    mountProvider();

    // FAILS on the old code: the snapshot was removeItem'd during load.
    expect(store.has(STORAGE_KEY)).toBe(true);
  });

  it('resets ONLY the clock — startTimestamp is now, paused time is zero', () => {
    seedDraft(13 * HOUR);
    const before = Date.now();

    mountProvider();

    // The old startTimestamp was 13.5h in the past; reusing it opened the live
    // timer at hours-elapsed. That is what gets thrown away — not the sets.
    expect(seen?.startTimestamp).toBeGreaterThanOrEqual(before);
    expect(seen?.totalPausedTime).toBe(0);
    expect(seen?.finalized).toBe(false);
  });

  it('still folds closed-app time into totalPausedTime for a FRESH draft', () => {
    seedDraft(2 * HOUR); // inside the window — ordinary restore path

    mountProvider();

    expect(seen?.exercises[0]?.sets).toHaveLength(3);
    // ~2h of closed-app time is credited as paused, and the original
    // startTimestamp is preserved (the clock was never stale).
    expect(seen?.totalPausedTime).toBeGreaterThanOrEqual(2 * HOUR - 1000);
    expect(seen?.startTimestamp).toBeLessThan(Date.now());
  });

  it('still refuses to restore a draft flagged _completed', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        exercises: [loggedExercise()],
        _completed: true,
        lastPersistedAt: Date.now(),
      })
    );

    mountProvider();

    expect(seen?.exercises).toHaveLength(0);
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// DEFECT 2 — an unwritable store is surfaced, ONCE
// ══════════════════════════════════════════════════════════════════════════

describe('T-110 defect 2 — an unwritable store is surfaced once per session', () => {
  const flushDebounce = () => {
    act(() => {
      vi.advanceTimersByTime(600);
    });
  };

  it('toasts once when the store silently refuses the write', () => {
    writable = false;

    mountProvider();
    flushDebounce();

    // FAILS on the old code: persistState's false was discarded at every call
    // site, so nothing was ever shown.
    expect(showToast).toHaveBeenCalledTimes(1);
    const [text, opts] = showToast.mock.calls[0] as [string, { variant?: string }];
    expect(text).toContain('לא נשמר');
    expect(opts.variant).toBe('error');
  });

  it('names what to do, in plural imperative', () => {
    writable = false;

    mountProvider();
    flushDebounce();

    const [, opts] = showToast.mock.calls[0] as [string, { description?: string }];
    expect(opts.description).toContain('סיימו את האימון');
  });

  it('stays at ONE toast across repeated persist paths (never one per set)', () => {
    writable = false;

    mountProvider();
    flushDebounce();

    // Every other persist path: the 30s backup interval twice, plus a
    // background/visibility flush. Each one fails again; none may re-toast.
    act(() => {
      seen = null;
      vi.advanceTimersByTime(30_000);
      vi.advanceTimersByTime(30_000);
      visibilityCb?.(true);
    });

    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('says nothing at all while the store is writable', () => {
    mountProvider();
    flushDebounce();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(store.has(STORAGE_KEY)).toBe(true);
  });
});
