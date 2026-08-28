import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const createWorkoutTemplate = vi.fn();
const updateWorkoutTemplate = vi.fn();
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

// Load path: skip first-run seeding so the hook's list state comes purely from
// the mocked template reads.
vi.mock('../../../services/templateDb', () => ({
  getWorkoutTemplateCount: vi.fn(async () => 1),
  isFreeTemplateLimitError: () => false,
}));

vi.mock('../../../services/dataService', () => ({
  initializeBuiltInWorkoutTemplates: vi.fn(),
}));

vi.mock('../../../services/workoutDb', () => ({
  createWorkoutTemplate: (...args: unknown[]) => createWorkoutTemplate(...args),
  deleteWorkoutTemplate: vi.fn(),
  getWorkoutTemplates: () => getWorkoutTemplates(),
  updateWorkoutTemplate: (...args: unknown[]) => updateWorkoutTemplate(...args),
}));

vi.mock('../../../components/ui/GlobalToast', () => ({
  showToast: vi.fn(),
}));

import { useTemplates } from './useTemplates';

describe('useTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkoutTemplates.mockResolvedValue([]);
    createWorkoutTemplate.mockResolvedValue({ id: 'template-new', name: 'Push', exercises: [] });
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
  });

  // Saving a template keeps the user on the templates screen: the created
  // template lands in the list instead of hijacking them into a live workout.
  it('keeps the user on the templates screen after creating a template', async () => {
    const { result } = renderHook(() => useTemplates());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleCreate('Push', []);
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.showCreateModal).toBe(false);
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0]).toMatchObject({ id: 'template-new' });
  });

  it('saves added exercises back onto an existing template', async () => {
    const existing = {
      id: 'template-1',
      name: 'Pull',
      exercises: [],
    };
    updateWorkoutTemplate.mockImplementation(async (id: string, updates: object) => ({
      ...existing,
      id,
      ...updates,
    }));
    getWorkoutTemplates.mockResolvedValue([existing]);

    const { result } = renderHook(() => useTemplates());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setEditingTemplate(existing as never);
    });

    await act(async () => {
      await result.current.handleUpdate('Pull A', [
        {
          exerciseId: 'lat-pulldown',
          exerciseName: 'Lat Pulldown',
          targetMuscle: 'גב',
          targetSets: 3,
          targetReps: 12,
          restSeconds: 60,
        },
      ]);
    });

    expect(updateWorkoutTemplate).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ name: 'Pull A' })
    );
    const updates = updateWorkoutTemplate.mock.calls[0]?.[1];
    expect(updates.exercises[0]).toMatchObject({
      exerciseId: 'lat-pulldown',
      exerciseName: 'Lat Pulldown',
      targetSets: 3,
      targetReps: 12,
      restSeconds: 60,
      order: 0,
    });
    expect(result.current.editingTemplate).toBeNull();
    expect(result.current.templates[0]).toMatchObject({ name: 'Pull A' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
