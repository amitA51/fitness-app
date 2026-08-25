import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LevelCard } from './LevelCard';

// The card reads the persistent XP pool directly (same source WorkoutSummary
// awards into), so tests seed the same localStorage key.

beforeEach(() => {
  localStorage.clear();
});

describe('LevelCard', () => {
  it('renders nothing before any XP exists', () => {
    const { container } = render(<LevelCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows level 1 with progress toward level 2 for a fresh lifter', () => {
    // Ladder: reaching L2 costs 100 XP (T(n) = 50·n·(n−1)). 60 XP → level 1,
    // 60 of 100 XP into the level.
    localStorage.setItem('gamification_xp_total', '60');
    render(<LevelCard />);
    expect(screen.getByRole('status')).toHaveTextContent('רמה 1');
    expect(screen.getByRole('status')).toHaveTextContent('60 / 100 XP');
  });

  it('advances to level 2 past the first threshold', () => {
    localStorage.setItem('gamification_xp_total', '220');
    render(<LevelCard />);
    // T(3) = 300, so 220 XP sits 120 into a 200-XP level span.
    expect(screen.getByRole('status')).toHaveTextContent('רמה 2');
    expect(screen.getByRole('status')).toHaveTextContent('120 / 200 XP');
  });
});
