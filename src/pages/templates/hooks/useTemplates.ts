import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../../components/ui/GlobalToast';
import { onTemplatesChanged } from '../../../services/dataEvents';
import { initializeBuiltInWorkoutTemplates } from '../../../services/dataService';
import { removeDuplicateExercises } from '../../../services/exerciseDb';
import { getWorkoutTemplateCount, isFreeTemplateLimitError } from '../../../services/templateDb';
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  getWorkoutTemplates,
  updateWorkoutTemplate,
} from '../../../services/workoutDb';
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../../../types';
import { logger } from '../../../utils/logger';
import type { TemplateExerciseInput } from '../components/CreateTemplateModal';

/** Legacy: the free-quota trigger was dropped (2026-08). Kept only so a stale server rejection still maps to an honest message. */
const FREE_TEMPLATE_LIMIT_MESSAGE = 'לא הצלחנו לשמור את התבנית. בדקו את החיבור ונסו שוב.';

export function useTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [favoritingIds, setFavoritingIds] = useState<Set<string>>(new Set());
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // First-run seeding: a brand-new library gets the built-in Hebrew
      // starter templates, so the home screen's recommended path ("בחרו תבנית
      // מוכנה") always lands on real content instead of a dead end. Safe since
      // the free-quota trigger was dropped (20260824000000) — the loop can no
      // longer fail halfway against a 3-template cap. Idempotent: it checks
      // for existing built-ins first and is skipped once any template exists.
      if ((await getWorkoutTemplateCount()) === 0) {
        await initializeBuiltInWorkoutTemplates();
      }
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
        exerciseId: ex.exerciseId ?? '',
        exerciseName: ex.exerciseName,
        targetMuscle: ex.targetMuscle ?? '',
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
      }).catch((err) => {
        // Free-plan quota is a product decision, not a bug: route the user to
        // the upgrade screen instead of failing silently or throwing to the
        // error boundary.
        if (isFreeTemplateLimitError(err)) {
          showToast(FREE_TEMPLATE_LIMIT_MESSAGE, 'error');
          setShowCreateModal(false);
          navigate('/paywall');
          return null;
        }
        throw err;
      });
      if (!newTemplate) return;
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
    }).catch((err) => {
      // Legacy quota rejections (trigger dropped) still map to an honest
      // message instead of the old paywall redirect.
      if (isFreeTemplateLimitError(err)) {
        showToast(FREE_TEMPLATE_LIMIT_MESSAGE, 'error');
        setShowCreateModal(false);
        return null;
      }
      throw err;
    });
    if (!newTemplate) return;
    setTemplates((prev) => [...prev, newTemplate]);
  }, []);

  const handleStartTemplate = useCallback(
    (templateId: string) => {
      navigate(`/workout/${templateId}`);
    },
    [navigate]
  );

  // Library maintenance — merge duplicate personal exercises (folded in from the
  // former WorkoutTemplates "ניקוי" action). Confirmation is handled by the UI
  // via ConfirmDialog; this just performs the work and reports the result.
  const requestCleanup = useCallback(() => setShowCleanupConfirm(true), []);
  const cancelCleanup = useCallback(() => setShowCleanupConfirm(false), []);

  const confirmCleanup = useCallback(async () => {
    setShowCleanupConfirm(false);
    setIsCleaning(true);
    try {
      const removed = await removeDuplicateExercises();
      showToast(removed > 0 ? `נוקו ${removed} תרגילים כפולים` : 'לא נמצאו כפילויות', {
        variant: 'success',
      });
    } catch (err) {
      logger.workout.error('Template library cleanup failed', err);
      showToast('שגיאה בניקוי הספרייה', { variant: 'error' });
    } finally {
      setIsCleaning(false);
    }
  }, []);

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
    showCleanupConfirm,
    isCleaning,
    requestCleanup,
    cancelCleanup,
    confirmCleanup,
  };
}
