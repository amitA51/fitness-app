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
  // Previously this pinned an INLINE background/color on the trained cell, put
  // there because `.day-cell.done` fixed its fill to --fs-primary — #16292d in
  // Fresh Steel (11.83:1 against the empty cell) but #0a0a0a in Obsidian, DARKER
  // than the empty cell at 1.31:1 with the polarity inverted. That rule now uses
  // the theme-flipping --nav-pill-* pair itself, so the inline override is gone
  // and the stylesheet is the single source of truth. This test pins the new
  // contract: the component contributes the CLASS and nothing else.
  it('marks a trained day with .done and leaves its fill to the stylesheet', () => {
    renderGrid([completedToday()]);

    const trained = screen.getByRole('button', { name: /אימון הושלם/ });
    expect(trained.className).toContain('done');
    expect(trained.style.background).toBe('');
    expect(trained.style.backgroundColor).toBe('');
    expect(trained.style.color).toBe('');
  });

  // The today ring is the one thing that CANNOT move to `.day-cell.today`:
  // that rule draws the ring in --fs-accent, which IS the dark trained fill
  // (1.00:1 — the ring vanishes). On a filled cell it is redrawn in the fill's
  // own ink: 15.12:1 light / 10.98:1 dark.
  it('draws the today ring in the fill ink once the day is trained', () => {
    renderGrid([completedToday()]);

    const trained = screen.getByRole('button', { name: /אימון הושלם/ });
    expect(trained.className).toContain('today');
    expect(trained.style.boxShadow).toBe('inset 0 0 0 1.5px var(--nav-pill-text)');
  });

  // An untrained today keeps the plain `.day-cell.today` accent ring — the
  // fill-ink override must NOT leak onto cells that have no fill.
  it('leaves an untrained today to the stylesheet accent ring', () => {
    renderGrid([]);

    const today = screen.getByRole('button', { name: /היום/ });
    expect(today.className).toContain('today');
    expect(today.className).not.toContain('done');
    expect(today.style.boxShadow).toBe('');
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
