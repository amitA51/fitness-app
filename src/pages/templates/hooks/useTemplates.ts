import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onTemplatesChanged } from '../../../services/dataEvents';
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  getWorkoutTemplates,
  updateWorkoutTemplate,
} from '../../../services/workoutDb';
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../../../types';
import type { TemplateExerciseInput } from '../components/CreateTemplateModal';

export function useTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [favoritingIds, setFavoritingIds] = useState<Set<string>>(new Set());

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorkoutTemplates();
      setTemplates(data);
    } catch {
      setError('שגיאה בטעינת התבניות');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    return onTemplatesChanged(loadTemplates);
  }, [loadTemplates]);

  const { favorites, regular } = useMemo(() => {
    const sorted = [...templates].sort((a, b) => {
      const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bTime - aTime;
    });
    return {
      favorites: sorted.filter((t) => t.isFavorite),
      regular: sorted.filter((t) => !t.isFavorite),
    };
  }, [templates]);

  const handleCreate = useCallback(
    async (name: string, templateExercises: TemplateExerciseInput[] = []) => {
      const exercises: WorkoutTemplateExercise[] = templateExercises.map((ex, i) => ({
        id: crypto.randomUUID(),
        exerciseId: '',
        exerciseName: ex.exerciseName,
        targetMuscle: '',
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: null,
        restSeconds: ex.restSeconds,
        order: i,
        notes: '',
      }));
      const newTemplate = await createWorkoutTemplate({
        name,
        description: '',
        exercises,
        updatedAt: new Date().toISOString(),
        lastUsed: null,
        timesUsed: 0,
        isFavorite: false,
      });
      setShowCreateModal(false);
      navigate(`/workout/${newTemplate.id}`);
    },
    [navigate]
  );

  const handleToggleFavorite = useCallback(async (template: WorkoutTemplate) => {
    setFavoritingIds((prev) => new Set(prev).add(template.id));
    try {
      const updated = await updateWorkoutTemplate(template.id, {
        isFavorite: !template.isFavorite,
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } finally {
      setFavoritingIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteWorkoutTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleDuplicate = useCallback(async (template: WorkoutTemplate) => {
    const exercises: WorkoutTemplateExercise[] = template.exercises.map((ex, i) => ({
      id: crypto.randomUUID(),
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      targetMuscle: ex.targetMuscle,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetWeight: ex.targetWeight,
      restSeconds: ex.restSeconds,
      order: i,
      notes: ex.notes,
    }));
    const newTemplate = await createWorkoutTemplate({
      name: `העתק של ${template.name}`,
      description: '',
      exercises,
      updatedAt: new Date().toISOString(),
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    });
    setTemplates((prev) => [...prev, newTemplate]);
  }, []);

  const handleStartTemplate = useCallback(
    (templateId: string) => {
      navigate(`/workout/${templateId}`);
    },
    [navigate]
  );

  return {
    templates,
    isLoading,
    error,
    showCreateModal,
    setShowCreateModal,
    deletingIds,
    favoritingIds,
    favorites,
    regular,
    loadTemplates,
    handleCreate,
    handleToggleFavorite,
    handleDelete,
    handleDuplicate,
    handleStartTemplate,
  };
}
