import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgramCard } from './ProgramCard';

// ProgramCard lazily dynamic-imports the heavy 12-week program data + service
// (kept out of the Dashboard's eager bundle). These tests lock in that the card
// renders an aria-busy skeleton first, then resolves to the real view derived
// from localStorage progress.

const PROGRESS_KEY = 'bbt_program_progress_v1';

afterEach(() => {
  localStorage.clear();
});

const renderCard = () =>
  render(
    <MemoryRouter>
      <ProgramCard />
    </MemoryRouter>
  );

describe('ProgramCard — lazy program data', () => {
  it('shows an aria-busy skeleton region before the program data resolves', () => {
    renderCard();
    const region = screen.getByRole('region', { name: 'תוכנית האימון' });
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('resolves to the not-started invitation when there is no saved progress', async () => {
    renderCard();
    expect(
      await screen.findByRole('button', { name: 'התחל את תוכנית האימון בת 12 השבועות' })
    ).toBeInTheDocument();
  });

  it('resolves to the active state when progress is saved', async () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        programId: 'bbt',
        startedAt: new Date().toISOString(),
        currentWeek: 1,
        currentDayIndex: 0,
        completed: [],
        pending: null,
        status: 'active',
      })
    );
    renderCard();
    expect(
      await screen.findByRole('button', { name: 'המשך לתוכנית האימון' })
    ).toBeInTheDocument();
  });
});
