import { AnimatePresence, Reorder, motion } from 'framer-motion';
// PlanEditorModal - Modal for creating and editing workout plans
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import type React from 'react';
import { useId, useState } from 'react';
import type { PersonalExercise, WorkoutTemplate, WorkoutTemplateExercise } from '../../types';

// In-flight editor shape — minimal subset used only within this modal
type PlanEditorExercise = {
  id: string;
  name: string;
  sets: { reps: number; weight: number }[];
  muscleGroup?: string;
  targetRestTime?: number;
  tempo?: string;
  notes?: string;
};

function templateExToEditorEx(ex: WorkoutTemplateExercise): PlanEditorExercise {
  return {
    id: ex.id,
    name: ex.exerciseName,
    sets: ex.sets ?? [],
    muscleGroup: ex.muscleGroup,
    targetRestTime: ex.targetRestTime ?? ex.restSeconds,
    tempo: ex.tempo,
    notes: ex.notes,
  };
}

function editorExToTemplateEx(ex: PlanEditorExercise, index: number): WorkoutTemplateExercise {
  return {
    id: ex.id,
    exerciseId: ex.id,
    exerciseName: ex.name,
    name: ex.name,
    targetMuscle: ex.muscleGroup ?? '',
    muscleGroup: ex.muscleGroup,
    targetSets: 3,
    targetReps: 10,
    targetWeight: null,
    restSeconds: ex.targetRestTime ?? 90,
    targetRestTime: ex.targetRestTime,
    order: index,
    notes: ex.notes ?? '',
    sets: ex.sets,
    tempo: ex.tempo,
  };
}
import {
  Plus as AddIcon,
  X as CloseIcon,
  Dumbbell as DumbbellIcon,
  Trash as TrashIcon,
} from 'lucide-react';
import { logger } from '../../utils/logger';
import { ModalOverlay } from '../ui/ModalOverlay';
import ExerciseLibraryTab from './ExerciseLibraryTab';

const SaveIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
    />
  </svg>
);

interface PlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: Partial<WorkoutTemplate>) => Promise<void>;
  initialPlan?: WorkoutTemplate | null;
}

const PlanEditorModal: React.FC<PlanEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPlan,
}) => {
  const [name, setName] = useState(initialPlan?.name || '');
  const [exercises, setExercises] = useState<PlanEditorExercise[]>(
    (initialPlan?.exercises ?? []).map(templateExToEditorEx)
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const planNameId = useId();

  const handleAddExercise = (personalExercise: PersonalExercise) => {
    const newExercise: PlanEditorExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: personalExercise.name ?? '',
      sets: Array.from({ length: personalExercise.defaultSets || 3 }, () => ({
        reps: 10,
        weight: 0,
      })),
      muscleGroup: personalExercise.muscleGroup,
      targetRestTime: personalExercise.defaultRestTime || 90,
      tempo: personalExercise.tempo,
      notes: personalExercise.notes,
    };

    setExercises([...exercises, newExercise]);
    setShowLibrary(false);
  };

  const handleRemoveExercise = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExercises(exercises.filter((ex) => ex.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        name,
        exercises: exercises.map((ex, idx) => editorExToTemplateEx(ex, idx)),
        muscleGroups: Array.from(
          new Set(exercises.map((e) => e.muscleGroup).filter(Boolean) as string[])
        ),
      });
      onClose();
    } catch (error) {
      logger.workout.error('Failed to save plan', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="fullscreen"
      zLevel="extreme"
      backdropOpacity={95}
      blur="md"
      trapFocus
      lockScroll
      closeOnBackdropClick={false}
      closeOnEscape
      ariaLabel={initialPlan ? 'עריכת תוכנית' : 'תוכנית חדשה'}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '100%',
          maxWidth: '896px',
          height: '100%',
          maxHeight: '85vh',
          background: 'var(--fs-bg)',
          borderRadius: 0,
          border: '0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottom: '1px solid var(--fs-surface-2)',
            background: 'var(--fs-surface)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="focus-ring"
            style={{
              padding: 8,
              borderRadius: 0,
              color: 'var(--fs-muted)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon className="w-6 h-6" />
          </button>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '20px',
              textTransform: 'uppercase',
              color: 'var(--fs-ink)',
            }}
          >
            {initialPlan ? 'עריכת תוכנית' : 'תוכנית חדשה'}
          </h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="focus-ring"
            style={{
              padding: 8,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              background: name.trim() ? 'var(--fs-primary)' : 'transparent',
              color: name.trim() ? 'var(--fs-accent)' : 'var(--fs-muted)',
              border: name.trim() ? 'none' : '1px solid var(--fs-surface-2)',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              paddingLeft: 16,
              paddingRight: 16,
              minHeight: 44,
            }}
          >
            <span className="hidden sm:inline">{isSaving ? 'שומר...' : 'שמור'}</span>
            <SaveIcon className="w-5 h-5" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Main Form */}
          <div
            style={{
              flex: 1,
              display: showLibrary ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: 24,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Name Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  htmlFor={planNameId}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--fs-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  שם התוכנית
                </label>
                <input
                  id={planNameId}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: יום חזה מפלצתי"
                  className="focus-ring"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    fontFamily: 'var(--font-display)',
                    fontSize: '30px',
                    fontWeight: 800,
                    color: 'var(--fs-ink)',
                    border: 'none',
                    borderBottom: '1px solid var(--fs-surface-2)',
                    padding: '8px 0',
                    minHeight: 48,
                  }}
                  autoFocus={!initialPlan}
                />
              </div>

              {/* Exercises List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--fs-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    תרגילים ({exercises.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLibrary(true)}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: 'var(--fs-accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AddIcon className="w-4 h-4" />
                    הוסף תרגיל
                  </button>
                </div>

                {exercises.length === 0 ? (
                  <div
                    onClick={() => setShowLibrary(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowLibrary(true);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{
                      height: 160,
                      borderRadius: 0,
                      border: '2px dashed var(--fs-surface-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--fs-muted)',
                      cursor: 'pointer',
                      gap: 8,
                    }}
                  >
                    <DumbbellIcon className="w-8 h-8" />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      לחץ כאן להוספת תרגילים
                    </span>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={exercises}
                    onReorder={setExercises}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    {exercises.map((exercise) => (
                      <Reorder.Item key={exercise.id} value={exercise}>
                        <div
                          style={{
                            background: 'var(--fs-surface)',
                            border: '1px solid var(--fs-surface-2)',
                            borderRadius: 0,
                            padding: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            boxShadow: 'var(--shadow-card)',
                          }}
                        >
                          <div
                            style={{
                              cursor: 'grab',
                              color: 'var(--fs-steel)',
                              display: 'flex',
                            }}
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 8h16M4 16h16"
                              />
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <h4
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                color: 'var(--fs-ink)',
                                fontSize: '16px',
                              }}
                            >
                              {exercise.name}
                            </h4>
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                color: 'var(--fs-muted)',
                                fontSize: '12px',
                                marginTop: 4,
                              }}
                            >
                              <span>{(exercise.sets || []).length} סטים</span>
                              <span>•</span>
                              <span>{exercise.muscleGroup || 'כללי'}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveExercise(exercise.id, e)}
                            style={{
                              padding: 8,
                              borderRadius: 0,
                              color: 'var(--fs-muted)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </div>
            </div>
          </div>

          {/* Library Sidebar / Drawer */}
          <AnimatePresence>
            {showLibrary && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--fs-bg)',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid var(--fs-surface-2)',
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderBottom: '1px solid var(--fs-surface-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--fs-surface)',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: '16px',
                      textTransform: 'uppercase',
                      color: 'var(--fs-ink)',
                    }}
                  >
                    בחר תרגיל להוספה
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowLibrary(false)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--fs-muted)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    סגור
                  </button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', padding: 8 }}>
                  <ExerciseLibraryTab
                    onSelect={(ex) => handleAddExercise(ex)}
                    isSelectionMode={true}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </ModalOverlay>
  );
};

export default PlanEditorModal;
