import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';

// WorkoutSummary pulls in GSAP, the spark burst, and haptics — none of which is
// relevant to the muscles-worked recap render under test. Stub them out (the
// SlideToComplete suite establishes this same pattern) so the render is free of
// animation/canvas side effects and deterministic. useGSAP mirrors the real
// dependency-gated hook so any registered callback still runs once.
vi.mock('../../lib/gsap', () => {
  const tween = { kill: () => {} };
  return {
    DUR: { fast: 0, micro: 0, base: 0, slow: 0, count: 0 },
    EASE: { out: 'none', pop: 'none', popHard: 'none' },
    formatInt: (v: number) => String(Math.round(v)),
    gsap: {
      to: () => tween,
      set: () => {},
      delayedCall: () => ({ kill: () => {} }),
      killTweensOf: () => {},
      timeline: () => {
        const tl: Record<string, unknown> = {};
        const chain = () => tl;
        tl.to = chain;
        tl.fromTo = chain;
        tl.set = chain;
        tl.add = (fn: unknown) => {
          if (typeof fn === 'function') (fn as () => void)();
          return tl;
        };
        return tl;
      },
    },
    useGSAP: (cb: () => void, config?: { dependencies?: unknown[] }) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: deps mirror the real hook's array.
      useEffect(() => {
        cb();
      }, config?.dependencies ?? []);
    },
  };
});
vi.mock('../../lib/gsapSparks', () => ({ fireSparks: vi.fn() }));
vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('../../utils/haptics', () => ({
  triggerHapticEffect: vi.fn(),
  vibratePattern: vi.fn(),
  triggerHaptic: vi.fn(),
}));

import WorkoutSummary from './WorkoutSummary';

const makeSet = (setNumber: number, reps: number, weight: number): WorkoutSet => ({
  id: `set-${setNumber}`,
  setNumber,
  reps,
  weight,
  rpe: null,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: new Date().toISOString(),
});

const makeExercise = (id: string, name: string, targetMuscle: string): WorkoutExercise => ({
  id,
  exerciseId: id,
  exerciseName: name,
  name,
  targetMuscle,
  sets: [makeSet(1, 8, 60), makeSet(2, 8, 60)],
  notes: '',
  restSeconds: 90,
  isCompleted: true,
  order: 0,
});

const makeSession = (exercises: WorkoutExercise[]): Partial<WorkoutSession> => ({
  id: 'test-session',
  startTime: new Date().toISOString(),
  duration: 1800,
  exercises,
});

// Single-set exercise — the n = 1 shape that exposed the "1 סטים" defect.
const makeSingleSetExercise = (id: string, name: string): WorkoutExercise => ({
  ...makeExercise(id, name, 'Chest'),
  sets: [makeSet(1, 8, 60)],
});

const renderSummary = (session: Partial<WorkoutSession>) =>
  render(
    <LazyMotion features={domAnimation}>
      <WorkoutSummary isOpen session={session} onClose={() => {}} />
    </LazyMotion>
  );

describe('WorkoutSummary — muscles-worked recap', () => {
  it('renders the muscle map for a session with tagged muscles', async () => {
    renderSummary(
      makeSession([
        makeExercise('bench', 'Bench Press', 'Chest'),
        makeExercise('squat', 'Squat', 'Legs'),
      ])
    );

    // The recap section heading is present...
    expect(await screen.findByText('שרירים שעבדת')).toBeInTheDocument();
    // ...and the MuscleMap (an aria-labelled role="img") rendered with it.
    const map = screen.getByRole('img', { name: /שריר/ });
    expect(map).toBeInTheDocument();
  });

  it('hides the recap for an untagged (e.g. cardio) session', async () => {
    renderSummary(
      makeSession([
        // Empty targetMuscle + no muscleGroup ⇒ no muscles to show.
        makeExercise('run', 'Treadmill', ''),
      ])
    );

    // Give the async summary effects a tick to settle, then assert absence.
    expect(await screen.findByText('איך היה האימון?')).toBeInTheDocument();
    expect(screen.queryByText('שרירים שעבדת')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Hebrew count agreement at n = 1.
// Hebrew keeps the noun SINGULAR for a cardinal of 1 — "דקה אחת", "סט אחד" —
// never "1 דקות" / "1 סטים". This app has shipped that defect more than once,
// so the summary's own count-plus-noun strings are pinned here.
//
// These assert the WORD only. The duration VALUE is whatever the session
// reports: 69s → one minute is arithmetically right, and nothing here recomputes
// or corrects it.
// ============================================================================
describe('WorkoutSummary — Hebrew count agreement', () => {
  it('reads "דקה אחת" for a one-minute session, never "1 דקות"', async () => {
    renderSummary({
      ...makeSession([makeSingleSetExercise('bench', 'Bench Press')]),
      // ~69 seconds — rounds to one minute.
      duration: 69,
    });

    expect(await screen.findByText(/דקה אחת/)).toBeInTheDocument();
    expect(screen.queryByText(/1 דקות/)).not.toBeInTheDocument();
  });

  it('reads "סט אחד" for a single completed set, never "1 סטים"', async () => {
    renderSummary({
      ...makeSession([makeSingleSetExercise('bench', 'Bench Press')]),
      duration: 69,
    });

    expect(await screen.findByText('סט אחד')).toBeInTheDocument();
    expect(screen.queryByText(/1 סטים/)).not.toBeInTheDocument();
  });

  it('reads "תרגיל אחד" for a single exercise, never "1 תרגילים"', async () => {
    renderSummary({
      ...makeSession([makeSingleSetExercise('bench', 'Bench Press')]),
      duration: 69,
    });

    expect(await screen.findByText(/תרגיל אחד/)).toBeInTheDocument();
    expect(screen.queryByText(/1 תרגילים/)).not.toBeInTheDocument();
  });

  it('keeps the plural for multi-minute, multi-set sessions', async () => {
    renderSummary(
      makeSession([
        makeExercise('bench', 'Bench Press', 'Chest'),
        makeExercise('squat', 'Squat', 'Legs'),
      ])
    );

    // 1800s ⇒ "30 דקות"; 2 exercises × 2 sets ⇒ "4 סטים", "2 תרגילים".
    const subtitle = await screen.findByText(/30 דקות/);
    expect(subtitle).toHaveTextContent('2 תרגילים');
    expect(subtitle).toHaveTextContent('4 סטים');
  });
});
