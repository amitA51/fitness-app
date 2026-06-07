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
});
