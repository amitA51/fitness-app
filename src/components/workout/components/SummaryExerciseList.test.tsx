// SummaryExerciseList — Hebrew singular agreement at n = 1.
//
// Hebrew keeps a noun SINGULAR for a cardinal of 1: "סט אחד", never "1 סטים".
// This app has shipped that exact defect more than once ("1 אימונים",
// "1 סטים"), so every count-plus-noun string this list renders is pinned here
// at n = 1 AND at n > 1 — a fix that only special-cased 1 while breaking the
// plural would still fail.

import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { describe, expect, it, vi } from 'vitest';
import { SummaryExerciseList } from './SummaryExerciseList';

// Reduced motion keeps framer-motion from staging opacity/transform, so text is
// queryable immediately and the assertions stay about COPY, not animation.
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const exercise = (name: string, setsCompleted: number) => ({
  name,
  setsCompleted,
  totalVolume: setsCompleted * 60,
  bestSet: { weight: 60, reps: 8 },
});

const renderList = (exercises: ReturnType<typeof exercise>[], props: { maxItems?: number } = {}) =>
  render(
    <LazyMotion features={domAnimation}>
      <SummaryExerciseList exercises={exercises} prExercises={new Set<string>()} {...props} />
    </LazyMotion>
  );

describe('SummaryExerciseList — Hebrew count agreement', () => {
  it('renders a single set as "סט אחד", never "1 סטים"', () => {
    renderList([exercise('לחיצת חזה', 1)]);

    expect(screen.getByText('סט אחד')).toBeInTheDocument();
    expect(screen.queryByText('1 סטים')).not.toBeInTheDocument();
  });

  it('still renders the plural for more than one set', () => {
    renderList([exercise('סקוואט', 4)]);

    expect(screen.getByText('4 סטים')).toBeInTheDocument();
  });

  it('renders zero sets as the plural "0 סטים"', () => {
    // Hebrew takes the plural at zero — "0 סטים" is correct, not "סט אחד".
    renderList([exercise('מתח', 0)]);

    expect(screen.getByText('0 סטים')).toBeInTheDocument();
  });

  it('renders one overflow exercise as "תרגיל נוסף", never "1 תרגילים נוספים"', () => {
    // 3 exercises capped at 2 ⇒ exactly one hidden.
    renderList([exercise('א', 3), exercise('ב', 3), exercise('ג', 3)], { maxItems: 2 });

    expect(screen.getByText('+ תרגיל נוסף')).toBeInTheDocument();
    expect(screen.queryByText(/1 תרגילים נוספים/)).not.toBeInTheDocument();
  });

  it('still renders the plural overflow for more than one hidden exercise', () => {
    renderList([exercise('א', 3), exercise('ב', 3), exercise('ג', 3), exercise('ד', 3)], {
      maxItems: 2,
    });

    expect(screen.getByText('+ 2 תרגילים נוספים')).toBeInTheDocument();
  });
});
