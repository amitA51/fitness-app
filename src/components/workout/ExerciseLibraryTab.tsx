// ExerciseLibraryTab - fast, Hebrew-first exercise discovery.

import { AlertCircle, Plus, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WORKOUT } from '../../constants';
import { translateEquipment } from '../../constants/equipmentNames';
import { resolveMuscleKey, translateMuscle } from '../../constants/muscleNames';
import * as dataService from '../../services/dataService';
import type { CreatePersonalExerciseInput, PersonalExercise } from '../../types';
import { logger } from '../../utils/logger';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { ExerciseFilter } from './components/ExerciseFilter';
import { ExerciseForm } from './components/ExerciseForm';
import { ExerciseList } from './components/ExerciseList';
import './exercise-library.css';

interface ExerciseLibraryTabProps {
  onSelect?: (exercise: PersonalExercise) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
}

interface FormData {
  name: string;
  muscleGroup: string;
  category: string;
  equipment: string;
  tempo: string;
  tutorialText: string;
  defaultRestTime: number;
  defaultSets: number;
  notes: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

const getInitialFormData = (): FormData => ({
  name: '',
  muscleGroup: '',
  category: 'strength',
  equipment: '',
  tempo: '',
  tutorialText: '',
  defaultRestTime: WORKOUT.DEFAULT_REST_TIME,
  defaultSets: WORKOUT.DEFAULT_SETS,
  notes: '',
});

const formDataToExerciseInput = (formData: FormData): CreatePersonalExerciseInput =>
  ({
    name: formData.name.trim(),
    targetMuscle: formData.muscleGroup || 'Other',
    secondaryMuscles: [],
    equipment: formData.equipment,
    instructions: '',
    videoUrl: null,
    imageUrl: null,
    isCustom: true,
    isTimed: false,
    muscleGroup: formData.muscleGroup || 'Other',
    category: formData.category || 'strength',
    tempo: formData.tempo.trim() || undefined,
    tutorialText: formData.tutorialText.trim() || undefined,
    defaultRestTime: formData.defaultRestTime,
    defaultSets: formData.defaultSets,
    notes: formData.notes.trim() || undefined,
    userId: '',
    lastWeight: null,
    lastReps: null,
    personalRecords: [],
  }) as CreatePersonalExerciseInput;

const normalizeSearch = (value: string | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase('he');

const ExerciseLibraryTab: React.FC<ExerciseLibraryTabProps> = ({
  onSelect,
  isSelectionMode = false,
  selectedIds,
}) => {
  const [exercises, setExercises] = useState<PersonalExercise[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<PersonalExercise | null>(null);
  const [formData, setFormData] = useState<FormData>(getInitialFormData);

  const loadExercises = useCallback(async () => {
    setLoadStatus('loading');
    setOperationError(null);
    try {
      const data = await dataService.getPersonalExercises();
      setExercises(data);
      setLoadStatus('ready');
    } catch (error) {
      logger.workout.error('Failed to load personal exercises', error);
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const handleDelete = useCallback((exercise: PersonalExercise, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setExerciseToDelete(exercise);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!exerciseToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await dataService.deletePersonalExercise(exerciseToDelete.id);
      setExercises((current) => current.filter((exercise) => exercise.id !== exerciseToDelete.id));
      setExerciseToDelete(null);
    } catch (error) {
      logger.workout.error('Failed to delete personal exercise', error);
      setDeleteError('לא הצלחנו למחוק את התרגיל. נסו שוב.');
    } finally {
      setIsDeleting(false);
    }
  }, [exerciseToDelete, isDeleting]);

  const cancelDelete = useCallback(() => {
    if (isDeleting) return;
    setDeleteError(null);
    setExerciseToDelete(null);
  }, [isDeleting]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || isSaving) return;

      setIsSaving(true);
      setOperationError(null);
      try {
        const created = await dataService.createPersonalExercise(formDataToExerciseInput(formData));
        setExercises((current) => [created, ...current]);
        setFormData(getInitialFormData());
        setShowAddForm(false);
      } catch (error) {
        logger.workout.error('Failed to create personal exercise', error);
        setOperationError('לא הצלחנו לשמור את התרגיל. הפרטים נשארו בטופס.');
      } finally {
        setIsSaving(false);
      }
    },
    [formData, isSaving]
  );

  const filteredExercises = useMemo(() => {
    const query = normalizeSearch(searchQuery);

    return exercises
      .filter((exercise) => {
        const muscleKey = resolveMuscleKey(exercise);
        const muscleLabel = translateMuscle(muscleKey);
        const equipmentLabel = translateEquipment(exercise.equipment);
        const searchableText = normalizeSearch(
          [
            exercise.name,
            muscleKey,
            muscleLabel,
            exercise.equipment,
            equipmentLabel,
            exercise.category,
            exercise.notes,
          ]
            .filter(Boolean)
            .join(' ')
        );
        const matchesSearch = !query || searchableText.includes(query);
        const matchesMuscle = selectedMuscleGroup === 'all' || muscleKey === selectedMuscleGroup;
        const matchesEquipment =
          selectedEquipment === 'all' || exercise.equipment === selectedEquipment;
        return matchesSearch && matchesMuscle && matchesEquipment;
      })
      .sort((a, b) => {
        if (!query) return 0;
        const aName = normalizeSearch(a.name);
        const bName = normalizeSearch(b.name);
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return aName.localeCompare(bName, 'he');
      });
  }, [exercises, searchQuery, selectedMuscleGroup, selectedEquipment]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || selectedMuscleGroup !== 'all' || selectedEquipment !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedMuscleGroup('all');
    setSelectedEquipment('all');
  }, []);

  const emptyTitle = searchQuery.trim() ? 'לא מצאנו תרגיל מתאים' : 'אין תרגילים בסינון הזה';
  const emptyDescription = searchQuery.trim()
    ? 'נסו שם קצר יותר, שריר או סוג ציוד.'
    : 'נקו את הסינון או צרו תרגיל חדש.';

  return (
    <section
      className="exercise-library"
      aria-label="ספריית תרגילים"
      aria-busy={loadStatus === 'loading'}
    >
      <div className="exercise-library__toolbar">
        <ExerciseFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedMuscleGroup={selectedMuscleGroup}
          onMuscleGroupChange={setSelectedMuscleGroup}
          selectedEquipment={selectedEquipment}
          onEquipmentChange={setSelectedEquipment}
          exercises={exercises}
          onSuggestionSelect={onSelect}
        />
      </div>

      {operationError && (
        <div className="exercise-library__notice" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{operationError}</span>
        </div>
      )}

      {showAddForm && (
        <div className="exercise-library__create-wrap">
          <ExerciseForm
            formData={formData}
            onChange={setFormData}
            onSubmit={handleCreate}
            onCancel={() => {
              if (!isSaving) setShowAddForm(false);
            }}
            isSubmitting={isSaving}
          />
        </div>
      )}

      {loadStatus === 'ready' && (
        <div className="exercise-library__summary">
          <p className="exercise-library__result-count" role="status" aria-live="polite">
            <bdi dir="ltr">{filteredExercises.length}</bdi>{' '}
            {filteredExercises.length === 1 ? 'תרגיל' : 'תרגילים'}
          </p>
          {hasActiveFilters && (
            <button type="button" className="exercise-library__reset" onClick={clearFilters}>
              <RotateCcw aria-hidden="true" />
              נקה סינון
            </button>
          )}
        </div>
      )}

      {!showAddForm &&
        (!isSelectionMode || (loadStatus === 'ready' && filteredExercises.length === 0)) && (
          <div className="exercise-library__create-wrap">
            <button
              type="button"
              className="exercise-library__create-button"
              onClick={() => {
                setOperationError(null);
                setShowAddForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              צרו תרגיל חדש
            </button>
          </div>
        )}

      <div className="exercise-library__scroll">
        {loadStatus === 'loading' && <ExerciseLibrarySkeleton />}

        {loadStatus === 'error' && (
          <div className="exercise-library-empty" role="alert">
            <div className="exercise-library-empty__icon">
              <AlertCircle aria-hidden="true" />
            </div>
            <h2>הספרייה לא נטענה</h2>
            <p>התרגילים השמורים לא נמחקו. נסו לטעון את הספרייה שוב.</p>
            <button type="button" className="exercise-library__retry" onClick={loadExercises}>
              נסו שוב
            </button>
          </div>
        )}

        {loadStatus === 'ready' && (
          <ExerciseList
            exercises={filteredExercises}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onExerciseClick={onSelect}
            onDeleteExercise={handleDelete}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        )}
      </div>

      <DeleteConfirmDialog
        exercise={exerciseToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isDeleting={isDeleting}
        errorMessage={deleteError}
      />
    </section>
  );
};

const SKELETON_ROWS = ['row-a', 'row-b', 'row-c', 'row-d'] as const;

const ExerciseLibrarySkeleton = () => (
  <div className="exercise-library-skeleton" role="status" aria-label="טוען תרגילים">
    {SKELETON_ROWS.map((row) => (
      <div className="exercise-library-skeleton__row" key={row} aria-hidden="true" />
    ))}
  </div>
);

export default React.memo(ExerciseLibraryTab);
