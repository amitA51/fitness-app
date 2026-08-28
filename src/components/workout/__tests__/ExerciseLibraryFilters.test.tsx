vi.mock('../../../services/dataService', () => ({
  getPersonalExercises: vi.fn(),
  createPersonalExercise: vi.fn(),
  deletePersonalExercise: vi.fn(),
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dataService from '../../../services/dataService';
import type { PersonalExercise } from '../../../types';
import ExerciseLibraryTab from '../ExerciseLibraryTab';

// A miniature catalog that mirrors how the real one is tagged: arm work lives
// under Biceps/Triceps rather than Arms, and abs work under Core.
const catalog: PersonalExercise[] = [
  {
    id: 'curl',
    name: 'כפיפת מוט | Barbell Curl',
    muscleGroup: 'Biceps',
    equipment: 'barbell',
    mechanic: 'isolation',
    force: 'pull',
    level: 'beginner',
    primaryMuscle: 'biceps',
  },
  {
    id: 'pushdown',
    name: 'פשיטת מרפקים בכבל | Tricep Pushdown',
    muscleGroup: 'Triceps',
    equipment: 'cable',
    mechanic: 'isolation',
    force: 'push',
    level: 'beginner',
    primaryMuscle: 'triceps',
  },
  {
    id: 'squat',
    name: 'סקוואט | Back Squat',
    muscleGroup: 'Legs',
    equipment: 'barbell',
    mechanic: 'compound',
    force: 'push',
    level: 'intermediate',
    primaryMuscle: 'quadriceps',
  },
  {
    id: 'plank',
    name: 'פלאנק | Plank',
    muscleGroup: 'Core',
    equipment: 'bodyweight',
    mechanic: 'isolation',
    force: 'static',
    level: 'beginner',
    primaryMuscle: 'abdominals',
  },
  {
    id: 'sit-up',
    name: 'כפיפות בטן | Crunch',
    muscleGroup: 'Abs',
    equipment: 'bodyweight',
    mechanic: 'isolation',
    force: 'pull',
    level: 'beginner',
    primaryMuscle: 'abdominals',
  },
  {
    id: 'snatch',
    name: 'חטיפה | Power Snatch',
    muscleGroup: 'Shoulders',
    equipment: 'barbell',
    mechanic: 'compound',
    force: 'pull',
    level: 'expert',
    primaryMuscle: 'shoulders',
  },
];

const renderLibrary = () => render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

/** Visible exercise names, in rendered order. */
const visibleNames = () => {
  const list = screen.getByRole('list', { name: 'תרגילים' });
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '');
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dataService.getPersonalExercises).mockResolvedValue(catalog);
});

describe('exercise library filtering', () => {
  it('reaches biceps and triceps exercises through the ידיים chip', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    // Regression guard: the catalog tags arm work Biceps/Triceps while the chip
    // is the coarse "ידיים", so an exact-match filter matched NOTHING here.
    await user.click(screen.getByRole('button', { name: 'ידיים' }));

    const names = visibleNames();
    expect(names).toHaveLength(2);
    expect(names.join(' ')).toContain('כפיפת מוט');
    expect(names.join(' ')).toContain('פשיטת מרפקים');
  });

  it('covers both Core and Abs under one בטן chip', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'בטן' }));

    const names = visibleNames();
    expect(names).toHaveLength(2);
    expect(names.join(' ')).toContain('פלאנק');
    expect(names.join(' ')).toContain('כפיפות בטן');
  });

  it('offers each muscle chip exactly once', async () => {
    renderLibrary();
    await screen.findByText('סקוואט');

    const group = screen.getByRole('group', { name: 'סינון לפי קבוצת שריר' });
    const labels = within(group)
      .getAllByRole('button')
      .map((chip) => chip.textContent);
    // Core and Abs both translate to בטן, so offering both produced two chips
    // with the same Hebrew label.
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('filters by movement pattern', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'סינון' }));
    const mechanicGroup = await screen.findByRole('group', { name: 'סינון לפי סוג תרגיל' });
    await user.click(within(mechanicGroup).getByRole('button', { name: 'מורכב' }));

    const names = visibleNames().join(' ');
    expect(names).toContain('סקוואט');
    expect(names).toContain('חטיפה');
    expect(names).not.toContain('פלאנק');
  });

  it('filters by required level', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'סינון' }));
    const levelGroup = await screen.findByRole('group', { name: 'סינון לפי רמת קושי' });
    await user.click(within(levelGroup).getByRole('button', { name: 'מתקדם' }));

    const names = visibleNames();
    expect(names).toHaveLength(1);
    expect(names[0]).toContain('חטיפה');
  });

  it('finds exercises by their Hebrew classification terms', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    // "מורכב" is not in any exercise name — it only exists as classification.
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש לפי שם, שריר או ציוד' }), 'מורכב');

    const names = visibleNames().join(' ');
    expect(names).toContain('סקוואט');
    expect(names).not.toContain('פלאנק');
  });
  it('filters by resistance direction for push-pull splits', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'סינון' }));
    const forceGroup = await screen.findByRole('group', { name: 'סינון לפי כיוון התנגדות' });
    await user.click(within(forceGroup).getByRole('button', { name: 'משיכה' }));

    const names = visibleNames().join(' ');
    expect(names).toContain('כפיפת מוט');
    expect(names).toContain('חטיפה');
    expect(names).not.toContain('סקוואט');
    expect(names).not.toContain('פלאנק');
  });

  it('explains סוג תרגיל in visible text rather than a tooltip', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'סינון' }));

    // A `title` tooltip is unreachable on a touch device, so the hint must be
    // real visible text.
    expect(await screen.findByText(/מתאים לתחילת האימון/)).toBeInTheDocument();
  });
  it('tells the user which way out when several filters narrow to nothing', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    // Legs + expert matches nothing in this catalog.
    await user.click(screen.getByRole('button', { name: 'רגליים' }));
    await user.click(screen.getByRole('button', { name: 'סינון' }));
    const levelGroup = await screen.findByRole('group', { name: 'סינון לפי רמת קושי' });
    await user.click(within(levelGroup).getByRole('button', { name: 'מתקדם' }));

    // Generic "clear the filter" is unhelpful once several conditions are stacked.
    expect(await screen.findByText(/הסינון צר מדי/)).toBeInTheDocument();
  });
});

describe('exercise library sorting', () => {
  it('leads with compound work when nothing is being searched', async () => {
    renderLibrary();
    await screen.findByText('סקוואט');

    // Default 'smart' order with no query: compound before isolation, then by
    // level — the order you would actually build a session in.
    const names = visibleNames();
    const firstTwo = `${names[0]} ${names[1]}`;
    expect(firstTwo).toContain('סקוואט');
    expect(firstTwo).toContain('חטיפה');
  });

  it('orders easiest first when sorting by level', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    // Sort is a view preference, so it lives in the סינון drawer rather than in
    // permanent chrome above the list.
    await user.click(screen.getByRole('button', { name: 'סינון' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'מיון' }), 'level');

    const names = visibleNames();
    // Beginners fill the top; the expert lift is last.
    expect(names[names.length - 1]).toContain('חטיפה');
  });

  it('does not present a sort change as an active filter', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    expect(screen.queryByRole('button', { name: /נקה סינון/ })).not.toBeInTheDocument();

    // Sorting is a view preference. Offering "clear filters" after merely
    // reordering told the user something was filtered when nothing was.
    await user.click(screen.getByRole('button', { name: 'סינון' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'מיון' }), 'name');
    expect(screen.queryByRole('button', { name: /נקה סינון/ })).not.toBeInTheDocument();

    // A real filter still surfaces the reset.
    await user.click(screen.getByRole('button', { name: 'ידיים' }));
    expect(screen.getByRole('button', { name: /נקה סינון/ })).toBeInTheDocument();
  });

  it('orders alphabetically when sorting by name', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText('סקוואט');

    await user.click(screen.getByRole('button', { name: 'סינון' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'מיון' }), 'name');

    const names = visibleNames();
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'he'));
    expect(names).toEqual(sorted);
  });
});
