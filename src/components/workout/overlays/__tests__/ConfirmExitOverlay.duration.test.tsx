// T-102: one session, three different durations.
//
// Measured in a real browser, one session, one moment: the finish dialog's `זמן`
// box read 00:17, the live header clock read ~01:09, and the summary reported
// "1 דקות" (correct for ~69s). The dialog was the outlier.
//
// Cause: the dialog rendered `workoutStats.duration`, a string formatted inside
// ActiveWorkoutNew's `workoutStats` useMemo. That memo calls `Date.now()` but
// lists only [startTimestamp, totalPausedTime, exercises, completedSetsCount,
// totalVolume] as dependencies. `Date.now()` is not — and cannot be — a
// dependency, so the formatted duration froze at the last dependency change
// (the last logged set) and then never moved, no matter how long the session ran.
//
// These tests pin the invariant that actually matters: the duration the finish
// dialog shows is the duration the session has really lasted — i.e. the same
// number `buildWorkoutSession` is about to persist. They are written against a
// deliberately STALE `workoutStats.duration` prop ('00:17', the observed value),
// so a regression that starts trusting that prop again fails here immediately.
import { render, screen } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildWorkoutSession } from '../../../../services/workoutSessionBuilder';
import type { ActiveExercise } from '../../../../types';
import { WorkoutStateProvider } from '../../core/WorkoutContext';
import type { WorkoutState } from '../../core/workoutTypes';
import { formatTime } from '../../hooks/useWorkoutTimer';
import ConfirmExitOverlay from '../ConfirmExitOverlay';

vi.mock('../../../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
  HAPTIC_PATTERNS: {},
}));

vi.mock('../../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
  useMotionConfigMode: () => 'user',
}));

/** Fixed wall clock so elapsed maths cannot straddle a second boundary. */
const NOW = new Date('2026-08-30T09:00:00.000Z').getTime();

/** The elapsed time of the observed repro: ~69s → "01:09" → "1 דקות". */
const ELAPSED_SECONDS = 69;

/** The stale string the dialog used to render. Must never appear again. */
const STALE_DURATION = '00:17';

/**
 * Only the three timing fields the overlay reads. Same partial-state cast the
 * other workout-context tests use (see hooks/__tests__/usePersonalRecords.test.tsx).
 */
const mkState = (elapsedSeconds: number, pausedMs = 0): WorkoutState =>
  ({
    startTimestamp: NOW - elapsedSeconds * 1000 - pausedMs,
    totalPausedTime: pausedMs,
    isPaused: false,
  }) as unknown as WorkoutState;

const renderDialog = (state: WorkoutState) =>
  render(
    <LazyMotion features={domMax}>
      <WorkoutStateProvider value={state}>
        <ConfirmExitOverlay
          isOpen
          intent="finish"
          workoutStats={{
            completedSets: 2,
            totalVolume: 400,
            // Deliberately stale — exactly what the frozen parent memo produced.
            duration: STALE_DURATION,
          }}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </WorkoutStateProvider>
    </LazyMotion>
  );

/** The number rendered directly above the `זמן` label in the stats grid. */
const shownDuration = (): string =>
  screen.getByText('זמן').previousElementSibling?.textContent?.trim() ?? '';

describe('ConfirmExitOverlay — the `זמן` box states the real session duration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the elapsed time the session has actually run, not a stale prop', () => {
    renderDialog(mkState(ELAPSED_SECONDS));

    expect(shownDuration()).toBe('01:09');
    // The frozen value from the parent memo must not reach the screen anywhere.
    expect(screen.queryByText(STALE_DURATION)).toBeNull();
  });

  it('agrees with the duration buildWorkoutSession will persist for this session', () => {
    const state = mkState(ELAPSED_SECONDS);
    renderDialog(state);

    // The real builder, same inputs, same instant — this is the number the
    // summary and history will show. The dialog must already be saying it.
    const completedSet = {
      id: 'set-1',
      setNumber: 1,
      reps: 10,
      weight: 40,
      completedAt: new Date(NOW).toISOString(),
    };
    const built = buildWorkoutSession({
      exercises: [
        { id: 'ex-1', name: 'לחיצת חזה', sets: [completedSet] },
      ] as unknown as ActiveExercise[],
      startTimestamp: state.startTimestamp,
      totalPausedTime: state.totalPausedTime,
      itemId: 'item-1',
      now: NOW,
    });

    expect(built).not.toBeNull();
    expect(built?.session.duration).toBe(ELAPSED_SECONDS);
    expect(shownDuration()).toBe(formatTime(built?.session.duration ?? -1));
  });

  it('keeps ticking while the dialog is open', () => {
    renderDialog(mkState(ELAPSED_SECONDS));
    expect(shownDuration()).toBe('01:09');

    // The user reads the dialog for half a minute before confirming. The value
    // must follow the session, not the render that opened the dialog.
    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(shownDuration()).toBe('01:40');
  });

  it('excludes paused time, matching the header clock and the builder', () => {
    // 69s active + 20s paused: elapsed must stay 01:09, not 01:29.
    renderDialog(mkState(ELAPSED_SECONDS, 20_000));

    expect(shownDuration()).toBe('01:09');
  });
});
