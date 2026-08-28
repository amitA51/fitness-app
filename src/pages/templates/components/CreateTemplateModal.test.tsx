import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTemplateModal } from './CreateTemplateModal';

const getPersonalExercises = vi.fn();

vi.mock('../../../services/workoutDb', () => ({
  getPersonalExercises: () => getPersonalExercises(),
}));

describe('CreateTemplateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPersonalExercises.mockResolvedValue([
      {
        id: 'bench-press',
        name: 'Bench Press',
        targetMuscle: 'חזה',
        defaultSets: 4,
        defaultRestTime: 90,
      },
      {
        id: 'squat',
        name: 'Squat',
        targetMuscle: 'רגליים',
        defaultSets: 5,
        defaultRestTime: 120,
      },
    ]);
  });

  // Regression: the sheet used to be a hand-rolled `fixed inset-0` div rendered
  // inside the page's transformed motion container. A transformed ancestor
  // becomes the containing block for `position: fixed`, so the scrim painted a
  // ~247px band and the sheet resolved to top:-143 — heading off-screen, name
  // field sliced in half, page below still bright and clickable. Sheet →
  // ModalOverlay portals to <body>, which is what makes `fixed` viewport-
  // relative again.
  it('pins the sheet to the viewport, blocks the page beneath, and opens at its title', async () => {
    render(
      // Stand-in for the page's motion container — the transform is exactly what
      // used to capture `position: fixed`.
      <div style={{ transform: 'translateY(0px)' }}>
        <CreateTemplateModal onClose={vi.fn()} onCreate={vi.fn()} />
      </div>
    );

    const dialog = screen.getByRole('dialog', { name: 'תבנית חדשה' });
    const scrim = dialog.parentElement as HTMLElement;

    // Escaped the transformed subtree: the scrim is a direct child of <body>.
    expect(scrim.parentElement).toBe(document.body);
    expect(scrim.className).toContain('fixed');
    expect(scrim.className).toContain('inset-0');

    // The page beneath is genuinely inert, not merely dimmed.
    expect(document.body.style.overflow).toBe('hidden');

    // Title and the required first field are both inside the pinned dialog, and
    // the title sits in the non-scrolling header so it cannot scroll away.
    expect(dialog).toContainElement(screen.getByRole('heading', { name: 'תבנית חדשה' }));
    expect(dialog).toContainElement(screen.getByLabelText('שם התבנית'));

    // Focus lands on the first field, not on the page behind the scrim.
    await waitFor(() => expect(screen.getByLabelText('שם התבנית')).toHaveFocus());
  });

  it('closes on Escape, dismissing the exercise picker first', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<CreateTemplateModal onClose={onClose} onCreate={vi.fn()} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /הוסף תרגיל/ }));
    });
    expect(await screen.findByLabelText('חפש תרגיל')).toBeInTheDocument();

    // First Escape closes the picker, not the whole sheet.
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    expect(screen.queryByLabelText('חפש תרגיל')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Second Escape closes the sheet.
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps picked exercise identity when submitting and removes chips by stable id', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreateTemplateModal onClose={vi.fn()} onCreate={onCreate} />);

    await act(async () => {
      await user.type(screen.getByLabelText('שם התבנית'), 'Push');
      await user.click(screen.getByRole('button', { name: /הוסף תרגיל/ }));
    });

    await act(async () => {
      await user.click(await screen.findByRole('button', { name: /Bench Press/ }));
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /הוסף תרגיל/ }));
    });
    await act(async () => {
      await user.click(await screen.findByRole('button', { name: /Squat/ }));
    });

    const removeBench = screen.getByRole('button', { name: /הסר Bench Press/ });
    await act(async () => {
      await user.click(removeBench);
    });

    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();

    const form = screen.getByRole('dialog', { name: 'תבנית חדשה' });
    await act(async () => {
      await user.click(within(form).getByRole('button', { name: 'צור תבנית' }));
    });

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith('Push', [
      {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        targetMuscle: 'רגליים',
        targetSets: 5,
        targetReps: 10,
        restSeconds: 120,
      },
    ]);
  });

  // Editing reuses the same sheet: the user adds exercises to an existing
  // template without leaving the templates screen.
  it('opens pre-filled in edit mode and saves the extended exercise list', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const template = {
      id: 'template-1',
      name: 'Pull',
      description: '',
      exercises: [
        {
          id: 'row-1',
          exerciseId: 'lat-pulldown',
          exerciseName: 'Lat Pulldown',
          targetMuscle: 'גב',
          targetSets: 3,
          targetReps: 12,
          targetWeight: null,
          restSeconds: 60,
          order: 0,
          notes: '',
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    };

    render(<CreateTemplateModal template={template} onClose={vi.fn()} onCreate={onCreate} />);

    const dialog = screen.getByRole('dialog', { name: 'עריכת תבנית' });
    expect(screen.getByLabelText('שם התבנית')).toHaveValue('Pull');
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /הוסף תרגיל/ }));
    });
    await act(async () => {
      await user.click(await screen.findByRole('button', { name: /Bench Press/ }));
    });

    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'שמור תבנית' }));
    });

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate).toHaveBeenCalledWith('Pull', [
      {
        exerciseId: 'lat-pulldown',
        exerciseName: 'Lat Pulldown',
        targetMuscle: 'גב',
        targetSets: 3,
        targetReps: 12,
        restSeconds: 60,
      },
      {
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        targetMuscle: 'חזה',
        targetSets: 4,
        targetReps: 10,
        restSeconds: 90,
      },
    ]);
  });
});
