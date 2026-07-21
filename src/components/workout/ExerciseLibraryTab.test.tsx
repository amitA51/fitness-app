import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dataService from '../../services/dataService';
import type { PersonalExercise } from '../../types';
import ExerciseLibraryTab from './ExerciseLibraryTab';

vi.mock('../../services/dataService', () => ({
  getPersonalExercises: vi.fn(),
  createPersonalExercise: vi.fn(),
  deletePersonalExercise: vi.fn(),
}));

const exercises: PersonalExercise[] = [
  {
    id: 'bench',
    name: 'לחיצת חזה | Bench Press',
    muscleGroup: 'Chest',
    targetMuscle: 'Chest',
    equipment: 'barbell',
    defaultRestTime: 120,
    useCount: 8,
  },
  {
    id: 'squat',
    name: 'סקוואט',
    muscleGroup: 'Legs',
    targetMuscle: 'Legs',
    equipment: 'barbell',
    defaultRestTime: 90,
  },
  {
    id: 'row',
    name: 'חתירה בכבל',
    muscleGroup: 'Back',
    targetMuscle: 'Back',
    equipment: 'cable',
    defaultRestTime: 75,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dataService.getPersonalExercises).mockResolvedValue(exercises);
});

describe('ExerciseLibraryTab', () => {
  it('searches by translated equipment and clears the query immediately', async () => {
    const user = userEvent.setup();
    render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    const search = await screen.findByRole('searchbox', {
      name: 'חיפוש לפי שם, שריר או ציוד',
    });
    await user.type(search, 'כבל');

    expect(screen.getByText('חתירה בכבל')).toBeInTheDocument();
    expect(screen.queryByText('סקוואט')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'נקה את החיפוש' }));
    expect(screen.getByText('סקוואט')).toBeInTheDocument();
  });

  it('filters by muscle group and exposes a single reset action', async () => {
    const user = userEvent.setup();
    render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    await screen.findByText('סקוואט');
    await user.click(screen.getByRole('button', { name: 'רגליים' }));

    expect(screen.getByText('סקוואט')).toBeInTheDocument();
    expect(screen.queryByText('חתירה בכבל')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'נקה סינון' })).toBeInTheDocument();
  });

  it('announces selection state and forwards the selected exercise', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ExerciseLibraryTab isSelectionMode onSelect={onSelect} selectedIds={new Set(['bench'])} />
    );

    const selectedCard = await screen.findByRole('button', {
      name: /לחיצת חזה.*נבחר/,
    });
    expect(selectedCard).toHaveAttribute('aria-pressed', 'true');

    const squatCard = screen.getByRole('button', { name: /סקוואט.*לא נבחר/ });
    await user.click(squatCard);
    expect(onSelect).toHaveBeenCalledWith(exercises[1]);
  });

  it('keeps saved data messaging visible when loading fails and retries', async () => {
    const user = userEvent.setup();
    vi.mocked(dataService.getPersonalExercises)
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce(exercises);

    render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    expect(await screen.findByText('הספרייה לא נטענה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'נסו שוב' }));

    await waitFor(() => expect(screen.getByText('סקוואט')).toBeInTheDocument());
    expect(dataService.getPersonalExercises).toHaveBeenCalledTimes(2);
  });

  it('keeps every exercise in a large catalog reachable in the DOM', async () => {
    const largeCatalog: PersonalExercise[] = Array.from({ length: 18 }, (_, index) => ({
      id: `exercise-${index + 1}`,
      name: `תרגיל ${index + 1}`,
      muscleGroup: 'Chest',
      targetMuscle: 'Chest',
      equipment: 'barbell',
    }));
    vi.mocked(dataService.getPersonalExercises).mockResolvedValue(largeCatalog);

    render(<ExerciseLibraryTab isSelectionMode onSelect={vi.fn()} />);

    const list = await screen.findByRole('list', { name: 'תרגילים' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(18);
    expect(screen.getByRole('button', { name: /תרגיל 18/ })).toBeInTheDocument();
  });

  it('creates a personal exercise and inserts it without reloading the catalog', async () => {
    const user = userEvent.setup();
    const created: PersonalExercise = {
      id: 'custom',
      name: 'תרגיל מותאם',
      muscleGroup: 'Other',
      targetMuscle: 'Other',
      isCustom: true,
    };
    vi.mocked(dataService.createPersonalExercise).mockResolvedValue(created);

    render(<ExerciseLibraryTab />);

    await screen.findByText('סקוואט');
    await user.click(screen.getByRole('button', { name: 'צרו תרגיל חדש' }));
    await user.type(screen.getByRole('textbox', { name: /שם התרגיל/ }), 'תרגיל מותאם');
    await user.click(screen.getByRole('button', { name: 'שמרו תרגיל' }));

    await waitFor(() => expect(screen.getByText('תרגיל מותאם')).toBeInTheDocument());
    expect(dataService.createPersonalExercise).toHaveBeenCalledTimes(1);
    expect(dataService.getPersonalExercises).toHaveBeenCalledTimes(1);
  });

  it('shows a delete failure inside the open confirmation dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(dataService.deletePersonalExercise).mockRejectedValue(new Error('delete failed'));

    render(<ExerciseLibraryTab />);

    await screen.findByText('סקוואט');
    await user.click(screen.getByRole('button', { name: 'מחקו את סקוואט' }));
    await user.click(screen.getByRole('button', { name: 'מחקו תרגיל' }));

    expect(await screen.findByText('לא הצלחנו למחוק את התרגיל. נסו שוב.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
