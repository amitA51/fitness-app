import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';
import { WeeklyGrid } from './WeeklyGrid';

const todayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const completedToday = (): WorkoutSession => ({
  id: 'session-today',
  date: todayKey(),
  startTime: `${todayKey()}T07:00:00.000Z`,
  endTime: `${todayKey()}T08:00:00.000Z`,
  exercises: [],
  duration: 3600,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: `${todayKey()}T08:00:00.000Z`,
  updatedAt: `${todayKey()}T08:00:00.000Z`,
});

const renderGrid = (sessions: WorkoutSession[]) =>
  render(
    <WeeklyGrid sessions={sessions} weekOffset={0} onPrevWeek={vi.fn()} onNextWeek={vi.fn()} />
  );

describe('WeeklyGrid trained-day contrast', () => {
  // Regression: `.day-cell.done` pins its fill to --fs-primary, which is #16292d
  // in Fresh Steel (11.83:1 against the #dbe6e3 empty cell) but #0a0a0a in
  // Obsidian — DARKER than the #262626 empty cell at 1.31:1, with the polarity
  // inverted. --nav-pill-* is the token pair that flips with the theme (navy +
  // white in light, mint + near-black in dark), so a trained day stays the most
  // prominent cell in the row in BOTH themes.
  it('fills a trained day with the theme-flipping prominent-fill tokens', () => {
    renderGrid([completedToday()]);

    const trained = screen.getByRole('button', { name: /אימון הושלם/ });
    expect(trained.className).toContain('done');
    expect(trained.style.background).toBe('var(--nav-pill-bg)');
    expect(trained.style.color).toBe('var(--nav-pill-text)');
  });

  // The today ring is --fs-accent, which IS the dark trained fill. On a filled
  // cell it has to be redrawn in the fill's ink or "today" disappears.
  it('draws the today ring in the fill ink once the day is trained', () => {
    renderGrid([completedToday()]);

    const trained = screen.getByRole('button', { name: /אימון הושלם/ });
    expect(trained.className).toContain('today');
    expect(trained.style.boxShadow).toBe('inset 0 0 0 1.5px var(--nav-pill-text)');
  });

  it('leaves untrained days to the stylesheet so light mode is unchanged', () => {
    renderGrid([]);

    const cells = screen.getAllByRole('button', { name: /^יום/ });
    expect(cells).toHaveLength(7);
    for (const cell of cells) {
      expect(cell.className).not.toContain('done');
      expect(cell.style.background).toBe('');
      expect(cell.style.color).toBe('');
    }
  });
});
