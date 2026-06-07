import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const createWorkoutTemplate = vi.fn();
const getWorkoutTemplates = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../../services/dataEvents', () => ({
  onTemplatesChanged: vi.fn(() => vi.fn()),
}));

vi.mock('../../../services/exerciseDb', () => ({
  removeDuplicateExercises: vi.fn(),
}));

vi.mock('../../../services/workoutDb', () => ({
  createWorkoutTemplate: (...args: unknown[]) => createWorkoutTemplate(...args),
  deleteWorkoutTemplate: vi.fn(),
  getWorkoutTemplates: () => getWorkoutTemplates(),
  updateWorkoutTemplate: vi.fn(),
}));

vi.mock('../../../components/ui/GlobalToast', () => ({
  showToast: vi.fn(),
}));

import { useTemplates } from './useTemplates';

describe('useTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkoutTemplates.mockResolvedValue([]);
    createWorkoutTemplate.mockResolvedValue({ id: 'template-new' });
  });

  it('preserves the selected catalog exercise id when creating a template', async () => {
    const { result } = renderHook(() => useTemplates());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleCreate('Push', [
        {
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
          targetMuscle: 'חזה',
          targetSets: 4,
          targetReps: 8,
          restSeconds: 90,
        },
      ]);
    });

    const payload = createWorkoutTemplate.mock.calls[0]?.[0];
    expect(payload.exercises[0]).toMatchObject({
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      targetMuscle: 'חזה',
      targetSets: 4,
      targetReps: 8,
      restSeconds: 90,
    });
    expect(navigate).toHaveBeenCalledWith('/workout/template-new');
  });
});
