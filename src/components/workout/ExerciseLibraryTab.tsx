// ExerciseLibraryTab - fast, Hebrew-first exercise discovery.

import { AlertCircle, Plus, RotateCcw } from 'lucide-react';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { WORKOUT } from '../../constants';
import { translateEquipment } from '../../constants/equipmentNames';
import {
  levelRank,
  mechanicRank,
  translateForce,
  translateLevel,
  translateMechanic,
  translatePrimaryMuscle,
} from '../../constants/exerciseClassification';
import {
  matchesMuscleFilter,
  resolveMuscleKey,
  translateMuscle,
} from '../../constants/muscleNames';
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

/**
 * How the result list is ordered.
 * `smart`  — while searching, best name match first; otherwise the order you would
 *            actually program a session in: compound lifts before isolation, and
 *            easier variations before harder ones.
 * `name`   — plain Hebrew alphabetical, for when you know what you are looking for.
 * `level`  — easiest first, so a beginner can start at the top of the list.
 */
type SortMode = 'smart' | 'name' | 'level';

const SORT_LABELS: Record<SortMode, string> = {
  smart: 'מומלץ',
  name: 'שם',
  level: 'רמה',
};

const SORT_MODES = Object.keys(SORT_LABELS) as SortMode[];

const ExerciseLibraryTab: React.FC<ExerciseLibraryTabProps> = ({
  onSelect,
  isSelectionMode = false,
  selectedIds,
}) => {
  const [exercises, setExercises] = useState<PersonalExercise[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // At 90 cards, translating, filtering, and sorting on every controlled
  // keystroke produced a measured 107 ms task on a throttled Pixel 5. Keep the
  // input urgent and let React schedule only the catalog derivation behind it.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [selectedMechanic, setSelectedMechanic] = useState('all');
  const [selectedForce, setSelectedForce] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('smart');
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
    const query = normalizeSearch(deferredSearchQuery);

    return exercises
      .filter((exercise) => {
        const muscleKey = resolveMuscleKey(exercise);
        const searchableText = normalizeSearch(
          [
            exercise.name,
            muscleKey,
            translateMuscle(muscleKey),
            exercise.equipment,
            translateEquipment(exercise.equipment),
            exercise.category,
            exercise.notes,
            // Classification is searchable in Hebrew too, so typing "מורכב" or
            // "מתחיל" narrows the library without opening the filter panel.
            translatePrimaryMuscle(exercise.primaryMuscle),
            translateMechanic(exercise.mechanic),
            translateForce(exercise.force),
            translateLevel(exercise.level),
          ]
            .filter(Boolean)
            .join(' ')
        );
        const matchesSearch = !query || searchableText.includes(query);
        const matchesMuscle = matchesMuscleFilter(selectedMuscleGroup, exercise);
        const matchesEquipment =
          selectedEquipment === 'all' || exercise.equipment === selectedEquipment;
        const matchesMechanic =
          selectedMechanic === 'all' || exercise.mechanic === selectedMechanic;
        const matchesForce = selectedForce === 'all' || exercise.force === selectedForce;
        const matchesLevel = selectedLevel === 'all' || exercise.level === selectedLevel;
        return (
          matchesSearch &&
          matchesMuscle &&
          matchesEquipment &&
          matchesMechanic &&
          matchesForce &&
          matchesLevel
        );
      })
      .sort((a, b) => {
        const aName = normalizeSearch(a.name);
        const bName = normalizeSearch(b.name);
        const byName = () => aName.localeCompare(bName, 'he');

        if (sortMode === 'name') return byName();
        if (sortMode === 'level') {
          const byLevel = levelRank(a.level) - levelRank(b.level);
          return byLevel !== 0 ? byLevel : byName();
        }

        // smart: a query means the user is aiming at a specific exercise, so a
        // name that STARTS with the query wins over one that merely contains it.
        if (query) {
          const aStarts = aName.startsWith(query);
          const bStarts = bName.startsWith(query);
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          return byName();
        }
        // No query: present the list the way a session is built.
        const byMechanic = mechanicRank(a.mechanic) - mechanicRank(b.mechanic);
        if (byMechanic !== 0) return byMechanic;
        const byLevel = levelRank(a.level) - levelRank(b.level);
        if (byLevel !== 0) return byLevel;
        return byName();
      });
  }, [
    exercises,
    deferredSearchQuery,
    selectedMuscleGroup,
    selectedEquipment,
    selectedMechanic,
    selectedForce,
    selectedLevel,
    sortMode,
  ]);

  // Sort is deliberately NOT counted here. It is a view preference, not a filter,
  // and including it made "נקה סינון" appear after merely reordering the list.
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedMuscleGroup !== 'all' ||
    selectedEquipment !== 'all' ||
    selectedMechanic !== 'all' ||
    selectedForce !== 'all' ||
    selectedLevel !== 'all';

  // The deferred query means the visible list can lag the input by a frame or
  // two on a slow device. Rather than let it silently show the previous query's
  // results, mark the pass as in-flight so the list can recede slightly. It stays
  // fully interactive while stale — an Apple-style transition never locks input.
  const isFilterStale = searchQuery !== deferredSearchQuery;

  // The toolbar floats above the list, so anything the browser scrolls to —
  // a card reached by Tab, a focused input — would otherwise land underneath it.
  // Publishing the live toolbar height lets CSS reserve that strip via
  // scroll-padding. Measured rather than hardcoded because the height changes
  // when the equipment panel expands or the quick-picks row appears.
  const sectionRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const section = sectionRef.current;
    if (!toolbar || !section) return;

    const publishHeight = () => {
      section.style.setProperty(
        '--exercise-toolbar-block-size',
        `${Math.round(toolbar.getBoundingClientRect().height)}px`
      );
    };
    publishHeight();

    // jsdom and older Safari lack ResizeObserver; the one-shot measure above
    // still covers the common case, so this stays an enhancement, not a require.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publishHeight);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  // A new result set must start at its first result. Without this the scroll
  // offset survives the filter change, so narrowing a 90-card catalog can leave
  // the user parked in the middle of the new matches with the best ones above the
  // fold. Set directly rather than smooth-scrolling: this is a content
  // replacement, not a spatial move, so animating it would only add latency.
  const filterSignature = `${deferredSearchQuery}\u0000${selectedMuscleGroup}\u0000${selectedEquipment}`;
  const lastFilterSignatureRef = useRef(filterSignature);

  useEffect(() => {
    if (lastFilterSignatureRef.current === filterSignature) return;
    lastFilterSignatureRef.current = filterSignature;
    const section = sectionRef.current;
    if (section) section.scrollTop = 0;
  }, [filterSignature]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedMuscleGroup('all');
    setSelectedEquipment('all');
    setSelectedMechanic('all');
    setSelectedForce('all');
    setSelectedLevel('all');
    setSortMode('smart');
  }, []);

  // How many dimensions are narrowing the list. Drives empty-state copy that says
  // something useful ("loosen one condition") instead of a generic shrug.
  const activeFilterCount = [
    selectedMuscleGroup,
    selectedEquipment,
    selectedMechanic,
    selectedForce,
    selectedLevel,
  ].filter((value) => value !== 'all').length;

  const emptyTitle = searchQuery.trim() ? 'לא מצאנו תרגיל מתאים' : 'אין תרגילים בסינון הזה';
  const emptyDescription = searchQuery.trim()
    ? 'נסו שם קצר יותר, שריר או סוג ציוד.'
    : activeFilterCount > 1
      ? 'הסינון צר מדי - נסו להסיר אחד מהתנאים.'
      : 'נקו את הסינון או צרו תרגיל חדש.';

  return (
    <section
      ref={sectionRef}
      className="exercise-library"
      aria-label="ספריית תרגילים"
      aria-busy={loadStatus === 'loading'}
    >
      <div className="exercise-library__toolbar" ref={toolbarRef}>
        <ExerciseFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedMuscleGroup={selectedMuscleGroup}
          onMuscleGroupChange={setSelectedMuscleGroup}
          selectedEquipment={selectedEquipment}
          onEquipmentChange={setSelectedEquipment}
          selectedMechanic={selectedMechanic}
          onMechanicChange={setSelectedMechanic}
          selectedForce={selectedForce}
          onForceChange={setSelectedForce}
          selectedLevel={selectedLevel}
          onLevelChange={setSelectedLevel}
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
          <div className="exercise-library__summary-actions">
            {/* Sort sits next to the count because that is the value it reorders. */}
            <label className="exercise-library__sort">
              <span className="exercise-library__sort-label">מיון</span>
              <select
                className="exercise-library__sort-select"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                {SORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {SORT_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="exercise-library__reset" onClick={clearFilters}>
                <RotateCcw aria-hidden="true" />
                נקה סינון
              </button>
            )}
          </div>
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

      <div className="exercise-library__scroll" data-stale={isFilterStale}>
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
