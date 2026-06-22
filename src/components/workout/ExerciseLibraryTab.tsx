// ExerciseLibraryTab - Fresh Steel / Obsidian
// Clean surface background, no dark gradients.

import { Plus as AddIcon } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WORKOUT } from '../../constants';
import * as dataService from '../../services/dataService';
import type { CreatePersonalExerciseInput, PersonalExercise } from '../../types';
import { logger } from '../../utils/logger';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { ExerciseFilter } from './components/ExerciseFilter';
import { ExerciseForm } from './components/ExerciseForm';
import { ExerciseList } from './components/ExerciseList';

interface ExerciseLibraryTabProps {
  onSelect?: (exercise: PersonalExercise) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
}

interface FormData {
  name: string;
  muscleGroup: string;
  category: string;
  tempo: string;
  tutorialText: string;
  defaultRestTime: number;
  defaultSets: number;
  notes: string;
}

const getInitialFormData = (): FormData => ({
  name: '',
  muscleGroup: '',
  category: 'strength',
  tempo: '',
  tutorialText: '',
  defaultRestTime: WORKOUT.DEFAULT_REST_TIME,
  defaultSets: WORKOUT.DEFAULT_SETS,
  notes: '',
});

const formDataToExerciseInput = (formData: FormData): CreatePersonalExerciseInput =>
  ({
    name: formData.name,
    targetMuscle: formData.muscleGroup || 'Other',
    secondaryMuscles: [],
    equipment: '',
    instructions: '',
    videoUrl: null,
    imageUrl: null,
    isCustom: true,
    isTimed: false,
    muscleGroup: formData.muscleGroup || 'Other',
    category: formData.category || 'strength',
    tempo: formData.tempo || undefined,
    tutorialText: formData.tutorialText || undefined,
    defaultRestTime: formData.defaultRestTime,
    defaultSets: formData.defaultSets,
    notes: formData.notes || undefined,
    userId: '',
    lastWeight: null,
    lastReps: null,
    personalRecords: [],
  }) as CreatePersonalExerciseInput;

const ExerciseLibraryTab: React.FC<ExerciseLibraryTabProps> = ({
  onSelect,
  isSelectionMode = false,
  selectedIds,
}) => {
  const [exercises, setExercises] = useState<PersonalExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [selectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<PersonalExercise | null>(null);
  const [formData, setFormData] = useState<FormData>(getInitialFormData);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = useCallback(async () => {
    try {
      const data = await dataService.getPersonalExercises();
      if (data.length > 0) {
        setExercises(data);
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      const retried = await dataService.getPersonalExercises();
      setExercises(retried);
    } catch (error) {
      // Never leave the selector stuck behind the blur on a fresh/empty load:
      // surface the failure and render an empty (but resolved) list.
      logger.workout.error('Failed to load personal exercises', error);
      setExercises([]);
    }
  }, []);

  const handleDelete = useCallback((exercise: PersonalExercise, e: React.MouseEvent) => {
    e.stopPropagation();
    setExerciseToDelete(exercise);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!exerciseToDelete) return;
    await dataService.deletePersonalExercise(exerciseToDelete.id);
    setExerciseToDelete(null);
    loadExercises();
  }, [exerciseToDelete, loadExercises]);

  const cancelDelete = useCallback(() => {
    setExerciseToDelete(null);
  }, []);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return;
      await dataService.createPersonalExercise(formDataToExerciseInput(formData));
      setFormData(getInitialFormData());
      setShowAddForm(false);
      loadExercises();
    },
    [formData, loadExercises]
  );

  const filteredExercises = useMemo(() => {
    return exercises
      .filter((ex) => {
        const matchesSearch = (ex.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMuscleGroup =
          selectedMuscleGroup === 'all' || ex.muscleGroup === selectedMuscleGroup;
        const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
        return matchesSearch && matchesMuscleGroup && matchesCategory;
      })
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [exercises, searchQuery, selectedMuscleGroup, selectedCategory]);

  return (
    <div className="flex flex-col" style={{ flex: 1, background: 'transparent' }}>
      <ExerciseFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedMuscleGroup={selectedMuscleGroup}
        onMuscleGroupChange={setSelectedMuscleGroup}
        exercises={exercises}
        onSuggestionSelect={onSelect}
      />

      {showAddForm && (
        <div style={{ padding: '0 5px 12px' }}>
          <ExerciseForm
            formData={formData}
            onChange={setFormData}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* In-list "create" affordance. In selection mode the ExerciseSelector
          already shows a sticky bottom "+ צור תרגיל חדש", so this duplicate is
          shown ONLY when the filtered list is empty (the one moment the sticky
          CTA isn't the obvious next action). Standalone (non-selection) keeps it
          always visible. */}
      {!showAddForm && (!isSelectionMode || filteredExercises.length === 0) && (
        <div style={{ padding: '0 5px 12px' }}>
          <AddExerciseButton onClick={() => setShowAddForm(true)} />
        </div>
      )}

      {/* Exercise List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '0 5px 20px',
          paddingLeft: 8,
          minHeight: 0,
        }}
      >
        <ExerciseList
          exercises={filteredExercises}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onExerciseClick={onSelect}
          onDeleteExercise={handleDelete}
        />
      </div>

      <DeleteConfirmDialog
        exercise={exerciseToDelete}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default React.memo(ExerciseLibraryTab);

interface AddExerciseButtonProps {
  onClick: () => void;
}

const AddExerciseButton: React.FC<AddExerciseButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    type="button"
    className="active:scale-[0.98]"
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px 20px',
      background: 'transparent',
      border: '2px dashed var(--color-border-strong)',
      borderRadius: 0,
      cursor: 'pointer',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 13,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fs-muted)',
      transition: 'all 150ms',
    }}
  >
    <AddIcon className="w-4 h-4" />
    צור תרגיל חדש
  </button>
);
