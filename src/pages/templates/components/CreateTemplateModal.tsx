import { AnimatePresence, m } from 'framer-motion';
import { Dumbbell, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { getPersonalExercises } from '../../../services/workoutDb';
import type { PersonalExercise } from '../../../types';
import { springTransition } from '../constants';

export interface TemplateExerciseInput {
  exerciseId?: string;
  exerciseName: string;
  targetMuscle?: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}

type DraftTemplateExercise = TemplateExerciseInput & { clientId: string };

interface CreateTemplateModalProps {
  onClose: () => void;
  onCreate: (name: string, exercises: TemplateExerciseInput[]) => Promise<void>;
}

export function CreateTemplateModal({ onClose, onCreate }: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateNameId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Trap Tab focus inside the sheet so it can't leak to the page behind the
  // backdrop. Escape stays owned by the handler below (it closes the picker
  // first, then the sheet); the input keeps its own autoFocus.
  useFocusTrap(sheetRef, {
    isOpen: true,
    closeOnEscape: false,
    autoFocus: false,
    restoreFocus: true,
    lockScroll: false,
  });

  const [exercises, setExercises] = useState<DraftTemplateExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [allExercises, setAllExercises] = useState<PersonalExercise[]>([]);

  useEffect(() => {
    if (showExercisePicker) {
      getPersonalExercises().then((exs) => setAllExercises(exs));
    }
  }, [showExercisePicker]);

  // Keyboard dismissal: Escape closes the picker first, then the whole sheet —
  // backdrop tap was the only exit, which left keyboard users stuck.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showExercisePicker) {
        setShowExercisePicker(false);
        setExerciseSearch('');
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExercisePicker, onClose]);

  const filteredExercises = useMemo(
    () =>
      allExercises.filter((ex) =>
        (ex.name || '').toLowerCase().includes(exerciseSearch.toLowerCase())
      ),
    [allExercises, exerciseSearch]
  );

  const estimatedMinutes = useMemo(() => {
    if (exercises.length === 0) return 0;
    const totalSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
    const avgSetTime = 45;
    const totalRestTime = exercises.reduce(
      (sum, ex) => sum + (ex.targetSets - 1) * ex.restSeconds,
      0
    );
    const transitionTime = exercises.length * 60;
    return Math.round((totalSets * avgSetTime + totalRestTime + transitionTime) / 60);
  }, [exercises]);

  const handleAddExercise = (exercise: PersonalExercise) => {
    const exName = exercise.name || 'תרגיל';
    setExercises((prev) => [
      ...prev,
      {
        clientId: crypto.randomUUID(),
        exerciseId: exercise.id,
        exerciseName: exName,
        targetMuscle: exercise.targetMuscle ?? exercise.muscleGroup ?? '',
        targetSets: exercise.defaultSets ?? 3,
        targetReps: 10,
        restSeconds: exercise.defaultRestTime ?? 60,
      },
    ]);
    setShowExercisePicker(false);
    setExerciseSearch('');
  };

  const handleRemoveExercise = (clientId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.clientId !== clientId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('יש להזין שם לתבנית');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate(
        trimmed,
        exercises.map(({ clientId: _clientId, ...exercise }) => exercise)
      );
    } catch {
      setError('שגיאה ביצירת התבנית. נסה שוב.');
      setIsSubmitting(false);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      dir="rtl"
    >
      <m.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ ...springTransition, duration: 0.4 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg pt-3 pb-10 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--fs-surface)',
          borderTop: '0.5px solid var(--color-separator)',
          borderTopLeftRadius: 'var(--radius-2xl)',
          borderTopRightRadius: 'var(--radius-2xl)',
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center mb-5">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--color-drag-handle)',
              borderRadius: 999,
            }}
          />
        </div>

        <div className="px-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-7">
            <h2
              id={titleId}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '22px',
                letterSpacing: '-0.02em',
                color: 'var(--fs-ink)',
              }}
            >
              תבנית חדשה
            </h2>
            <m.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              aria-label="סגור"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
              style={{
                width: '36px',
                height: '36px',
                background: 'var(--fs-surface-2)',
                border: 'none',
                borderRadius: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} style={{ color: 'var(--fs-ink)' }} />
            </m.button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Input */}
            <div>
              <label
                htmlFor={templateNameId}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fs-muted)',
                  marginBottom: '8px',
                  display: 'block',
                }}
              >
                שם התבנית
              </label>
              <input
                id={templateNameId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: אימון חזה + כתפיים"
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 12,
                  padding: '16px',
                  color: 'var(--fs-ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
              {error && (
                <m.p
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-error)',
                  }}
                >
                  {error}
                </m.p>
              )}
            </div>

            {/* Exercise Builder Section */}
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fs-muted)',
                  marginBottom: '8px',
                  display: 'block',
                }}
              >
                תרגילים
                <span
                  className="ms-2"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {exercises.length > 0 ? `${exercises.length} EXERCISES` : 'OPTIONAL'}
                </span>
              </span>

              {/* Added exercise chips */}
              {exercises.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {exercises.map((ex) => (
                    <m.div
                      key={ex.clientId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{
                        background: 'var(--fs-surface)',
                        border: '1px solid var(--fs-surface-2)',
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Dumbbell size={14} style={{ color: 'var(--fs-heading)' }} />
                        <span
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--fs-ink)',
                          }}
                        >
                          {ex.exerciseName}
                        </span>
                        <span
                          className="whitespace-nowrap"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            letterSpacing: '0.04em',
                            color: 'var(--fs-heading)',
                          }}
                        >
                          {ex.targetSets}×{ex.targetReps}
                        </span>
                        <span
                          className="whitespace-nowrap"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--fs-muted)',
                          }}
                        >
                          {ex.restSeconds}s
                        </span>
                      </div>
                      <m.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => handleRemoveExercise(ex.clientId)}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center me-1"
                        style={{ background: 'var(--fs-surface-2)' }}
                        aria-label={`הסר ${ex.exerciseName}`}
                      >
                        <X size={12} style={{ color: 'var(--fs-heading)' }} />
                      </m.button>
                    </m.div>
                  ))}
                </div>
              )}

              {/* Add Exercise button */}
              <m.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowExercisePicker(true)}
                className="w-full py-3 flex items-center justify-center gap-2"
                style={{
                  border: '1.5px dashed var(--fs-surface-2)',
                  color: 'var(--fs-heading)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 600,
                                    background: 'transparent',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                הוסף תרגיל
              </m.button>
            </div>

            {/* Exercise Picker Overlay */}
            <AnimatePresence>
              {showExercisePicker && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl"
                  style={{
                    background: 'var(--fs-surface)',
                    border: '1px solid var(--fs-surface-2)',
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--fs-ink)',
                                                  }}
                      >
                        בחר תרגיל
                      </span>
                      <m.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => {
                          setShowExercisePicker(false);
                          setExerciseSearch('');
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--fs-surface-2)' }}
                      >
                        <X size={12} style={{ color: 'var(--fs-heading)' }} />
                      </m.button>
                    </div>
                    <input
                      type="text"
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      placeholder="חפשו תרגיל…"
                      aria-label="חפש תרגיל"
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        background: 'var(--fs-surface-2)',
                        border: '1px solid var(--fs-surface-2)',
                        borderRadius: 12,
                        color: 'var(--fs-ink)',
                        fontFamily: 'var(--font-body)',
                        outline: 'none',
                      }}
                    />
                    <div
                      className="mt-2 flex flex-col gap-1 max-h-[200px] overflow-y-auto"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'var(--fs-surface-2) transparent',
                      }}
                    >
                      {filteredExercises.length === 0 && (
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '13px',
                            color: 'var(--fs-muted)',
                            textAlign: 'center',
                            padding: '16px',
                          }}
                        >
                          לא נמצאו תרגילים
                        </p>
                      )}
                      {filteredExercises.map((ex) => (
                        <m.button
                          key={ex.id}
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAddExercise(ex)}
                          className="w-full text-right px-3 py-2.5 flex items-center justify-between"
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--fs-ink)',
                            transition: 'background 0.15s',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 12,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--fs-surface-2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span>{ex.name || 'תרגיל'}</span>
                          <Plus size={14} style={{ color: 'var(--fs-heading)' }} />
                        </m.button>
                      ))}
                    </div>
                  </div>
                </m.div>
              )}
            </AnimatePresence>

            {exercises.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--fs-surface-2)',
                  borderRadius: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                                        color: 'var(--fs-muted)',
                  }}
                >
                  זמן משוער
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '18px',
                    color: 'var(--fs-accent)',
                  }}
                >
                  ~{estimatedMinutes} דק׳
                </span>
              </div>
            )}

            <m.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className="start-workout-btn"
              style={{
                opacity: isSubmitting ? 0.5 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid color-mix(in srgb, var(--color-ink-on-accent) 30%, transparent)',
                    borderTopColor: 'var(--color-ink-on-accent)',
                    borderRadius: 999,
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              ) : (
                'צור תבנית'
              )}
            </m.button>
          </form>
        </div>
      </m.div>
    </m.div>
  );
}
