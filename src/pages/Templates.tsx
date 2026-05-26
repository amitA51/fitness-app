/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Copy, Dumbbell, Play, Plus, Star, Trash2, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  getPersonalExercises,
  getWorkoutTemplates,
  updateWorkoutTemplate,
} from '../services/workoutDb';
import type { PersonalExercise, WorkoutTemplate, WorkoutTemplateExercise } from '../types';

// ============================================================================
// Spring Animation Variants
// ============================================================================

const springTransition = { type: 'spring' as const, stiffness: 100, damping: 20 };

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { ...springTransition, opacity: 1, y: 0 },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatLastUsed(lastUsed: string | null): string {
  if (!lastUsed) return 'לא בוצע';
  const date = new Date(lastUsed);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Create Template Modal — Premium Bottom Sheet
// ============================================================================

interface TemplateExerciseInput {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}

interface CreateModalProps {
  onClose: () => void;
  onCreate: (name: string, exercises: TemplateExerciseInput[]) => Promise<void>;
}

function CreateModal({ onClose, onCreate }: CreateModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exercise builder state
  const [exercises, setExercises] = useState<TemplateExerciseInput[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [allExercises, setAllExercises] = useState<any[]>([]);

  useEffect(() => {
    if (showExercisePicker) {
      getPersonalExercises().then((exs) => setAllExercises(exs));
    }
  }, [showExercisePicker]);

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
    const avgSetTime = 45; // seconds per set (including execution)
    const totalRestTime = exercises.reduce(
      (sum, ex) => sum + (ex.targetSets - 1) * ex.restSeconds,
      0
    );
    const transitionTime = exercises.length * 60; // 1 min between exercises
    return Math.round((totalSets * avgSetTime + totalRestTime + transitionTime) / 60);
  }, [exercises]);

  const handleAddExercise = (exercise: PersonalExercise) => {
    const exName = exercise.name || 'תרגיל';
    setExercises((prev) => [
      ...prev,
      {
        exerciseName: exName,
        targetSets: exercise.defaultSets ?? 3,
        targetReps: 10,
        restSeconds: exercise.defaultRestTime ?? 60,
      },
    ]);
    setShowExercisePicker(false);
    setExerciseSearch('');
  };

  const handleRemoveExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
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
      await onCreate(trimmed, exercises);
    } catch {
      setError('שגיאה ביצירת התבנית. נסה שוב.');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ ...springTransition, duration: 0.4 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg pt-3 pb-10 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center mb-5">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
            }}
          />
        </div>

        <div className="px-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-7">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '22px',
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              תבנית חדשה
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                background: 'var(--fs-surface-2)',
                border: 'none',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} style={{ color: 'var(--fs-muted)' }} />
            </motion.button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Input */}
            <div>
              <label
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
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: אימון חזה + כתפיים"
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                  padding: '16px',
                  color: 'var(--fs-ink)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--fs-warn)',
                  }}
                >
                  {error}
                </motion.p>
              )}
            </div>

            {/* Exercise Builder Section */}
            <div>
              <label
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
              </label>

              {/* Added exercise chips */}
              {exercises.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {exercises.map((ex, i) => (
                    <motion.div
                      key={i}
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
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => handleRemoveExercise(i)}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center me-1"
                        style={{ background: 'var(--fs-surface-2)' }}
                        aria-label={`הסר ${ex.exerciseName}`}
                      >
                        <X size={12} style={{ color: 'var(--fs-heading)' }} />
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Add Exercise button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowExercisePicker(true)}
                className="w-full py-3 flex items-center justify-center gap-2"
                style={{
                  border: '1.5px dashed var(--fs-surface-2)',
                  color: 'var(--fs-heading)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: 'transparent',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                הוסף תרגיל
              </motion.button>
            </div>

            {/* Exercise Picker Overlay */}
            <AnimatePresence>
              {showExercisePicker && (
                <motion.div
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
                          fontWeight: 800,
                          color: 'var(--fs-ink)',
                          textTransform: 'uppercase',
                        }}
                      >
                        בחר תרגיל
                      </span>
                      <motion.button
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
                      </motion.button>
                    </div>
                    <input
                      type="text"
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      placeholder="חפש תרגיל..."
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        background: 'var(--fs-surface-2)',
                        border: '1px solid var(--fs-surface-2)',
                        borderRadius: 0,
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
                        <motion.button
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
                            borderRadius: 0,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--fs-surface-2)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span>{ex.name || 'תרגיל'}</span>
                          <Plus size={14} style={{ color: 'var(--fs-heading)' }} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
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
                  borderRadius: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--fs-muted)',
                  }}
                >
                  זמן משוער
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--fs-accent)',
                  }}
                >
                  ~{estimatedMinutes} דק׳
                </span>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              style={{
                width: '100%',
                minHeight: '52px',
                padding: '16px',
                borderRadius: 0,
                background: 'var(--fs-primary)',
                color: 'var(--fs-accent)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '16px',
                textTransform: 'uppercase',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? (
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--fs-surface-2)',
                    borderTopColor: 'var(--fs-accent)',
                    borderRadius: 0,
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              ) : (
                'צור תבנית'
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Template Card — Premium Design
// ============================================================================

interface TemplateCardProps {
  template: WorkoutTemplate;
  index: number;
  onStart: (templateId: string) => void;
  onToggleFavorite: (template: WorkoutTemplate) => void;
  onDuplicate: (template: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  isFavoriting?: boolean;
}

const TemplateCard = memo(function TemplateCard({
  template,
  index,
  onStart,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  isDeleting,
  isFavoriting,
}: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (confirmDelete) {
      onDelete(template.id);
    } else {
      setConfirmDelete(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: index * 0.06 }}
      className="card-outlined template-card magnetic-card"
    >
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-3">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            color: template.isFavorite ? 'var(--fs-accent)' : 'var(--fs-muted)',
            textTransform: 'uppercase',
          }}
        >
          №{String(index + 1).padStart(3, '0')} · {formatLastUsed(template.lastUsed)}
        </span>
        {template.isFavorite && (
          <Star size={14} fill="var(--fs-accent)" style={{ color: 'var(--fs-accent)' }} />
        )}
      </div>

      {/* Display title */}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '28px',
          lineHeight: 0.95,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          marginBottom: '8px',
        }}
      >
        {template.name}
      </h3>

      {/* Mono stats line */}
      <div
        className="flex items-center gap-3 mb-4"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--fs-heading)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Dumbbell size={12} />
          {template.exercises.length} EX
        </span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} />
          {template.timesUsed > 0 ? `${template.timesUsed}×` : 'NEW'}
        </span>
      </div>

      {/* Exercise name chips */}
      {template.exercises.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {template.exercises.slice(0, 3).map((ex, i) => (
            <span key={i} className="chip">
              {ex.exerciseName || 'תרגיל'}
            </span>
          ))}
          {template.exercises.length > 3 && (
            <span className="chip" style={{ background: 'var(--fs-surface-2)' }}>
              +{template.exercises.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Action row */}
      <div
        className="flex items-center gap-2 flex-wrap pt-3"
        style={{ borderTop: '1px solid var(--fs-surface-2)' }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onStart(template.id)}
          className="btn-primary flex items-center justify-center gap-2"
          style={{ flex: 1, minHeight: '44px', padding: '12px 16px' }}
          aria-label="התחל אימון"
        >
          <Play size={14} />
          התחל
        </motion.button>
        <motion.button
          whileTap={{ scale: isFavoriting ? 1 : 0.95 }}
          onClick={() => onToggleFavorite(template)}
          disabled={isFavoriting}
          className="chip"
          style={{
            background: template.isFavorite ? 'var(--fs-accent)' : 'var(--fs-surface)',
            minHeight: '44px',
            padding: '0 14px',
            opacity: isFavoriting ? 0.6 : 1,
          }}
          aria-label={template.isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          aria-busy={isFavoriting}
        >
          {isFavoriting ? (
            <div
              className="w-4 h-4 border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--fs-primary)', borderTopColor: 'transparent' }}
            />
          ) : (
            <Star
              size={14}
              fill={template.isFavorite ? 'var(--fs-primary)' : 'none'}
              style={{ color: template.isFavorite ? 'var(--fs-primary)' : 'var(--fs-primary)' }}
            />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onDuplicate(template)}
          className="chip"
          style={{
            background: 'var(--fs-surface)',
            minHeight: '44px',
            padding: '0 14px',
          }}
          aria-label="שכפל תבנית"
        >
          <Copy size={14} />
        </motion.button>
        <motion.button
          whileTap={{ scale: isDeleting ? 1 : 0.95 }}
          onClick={handleDeleteClick}
          onBlur={() => setConfirmDelete(false)}
          disabled={isDeleting}
          className="chip"
          style={{
            background: confirmDelete ? 'var(--fs-primary)' : 'var(--fs-surface)',
            color: confirmDelete ? 'var(--fs-accent)' : 'var(--fs-primary)',
            minHeight: '44px',
            padding: '0 14px',
            opacity: isDeleting ? 0.6 : 1,
          }}
          aria-label={confirmDelete ? 'אישור מחיקת תבנית' : 'מחק תבנית'}
          aria-busy={isDeleting}
        >
          {isDeleting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <>
              <Trash2 size={14} />
              {confirmDelete && <span className="mr-1">?</span>}
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="pb-[88px]" dir="rtl">
      <div className="px-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="w-32 h-10 rounded-xl skeleton-shimmer" />
          <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-5 h-[140px]"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl skeleton-shimmer" />
                <div className="flex-1 space-y-3">
                  <div className="w-48 h-5 rounded-lg skeleton-shimmer" />
                  <div className="w-32 h-4 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="pb-[88px] flex flex-col items-center justify-center px-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-20 h-20 rounded-2xl bg-error/10 flex items-center justify-center mb-6"
      >
        <Trash2 size={32} className="text-error" />
      </motion.div>
      <p className="mb-2 font-semibold" style={{ color: 'var(--fs-ink)', fontSize: '15px' }}>
        שגיאה בטעינה
      </p>
      <p className="mb-8 text-center" style={{ color: 'var(--fs-muted)', fontSize: '15px' }}>
        לא הצלחנו לטעון את התבניות. נסה שוב.
      </p>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onRetry} className="btn btn-primary">
        נסה שוב
      </motion.button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [favoritingIds, setFavoritingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
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
  }

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

  const handleCreate = async (name: string, templateExercises: TemplateExerciseInput[] = []) => {
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
  };

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
    await createWorkoutTemplate({
      name: `העתק של ${template.name}`,
      description: '',
      exercises,
      updatedAt: new Date().toISOString(),
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    });
    await loadTemplates();
  }, []);

  const handleStartTemplate = useCallback(
    (templateId: string) => {
      navigate(`/workout/${templateId}`);
    },
    [navigate]
  );

  // Loading State
  if (isLoading) {
    return <LoadingState />;
  }

  // Error State
  if (error) {
    return <ErrorState onRetry={loadTemplates} />;
  }

  const hasTemplates = templates.length > 0;

  return (
    <>
      <motion.div
        className="pb-[88px] ambient-mesh ambient-mesh-soft"
        style={{ background: 'var(--fs-bg)' }}
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <header
          style={{
            paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 20px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 20px))',
            paddingBottom: 16,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            background: 'var(--fs-bg)',
            borderBottom: '2px solid var(--fs-accent)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fs-muted)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {templates.length} תבניות אימון
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: 'var(--fs-ink)',
              margin: '4px 0 0',
            }}
          >
            תבניות
          </h1>
        </header>

        <div className="px-5 pt-5">
          {/* Primary CTA */}
          <motion.div variants={itemVariants} className="mb-5">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="btn-primary start-workout-btn accent-glow w-full flex items-center justify-center gap-2"
              aria-label="צור תבנית חדשה"
            >
              <Plus size={18} />+ תבנית חדשה
            </motion.button>
          </motion.div>

          {/* Empty State */}
          {!hasTemplates && (
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springTransition, delay: 0.2 }}
                className="w-20 h-20 mb-6 flex items-center justify-center"
                style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
              >
                <Dumbbell size={36} />
              </motion.div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--fs-ink)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                אין תבניות עדיין
              </p>
              <p className="eyebrow mb-6" style={{ color: 'var(--fs-muted)' }}>
                CREATE YOUR FIRST ROUTINE
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                צור תבנית ראשונה
              </motion.button>
            </motion.div>
          )}

          {/* Favorites Section */}
          {favorites.length > 0 && (
            <motion.div variants={itemVariants} className="mb-6">
              <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
                <span className="left">§01 · FAVORITES</span>
                <span className="right">מועדפים</span>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                {favorites.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onStart={handleStartTemplate}
                    onToggleFavorite={handleToggleFavorite}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    isDeleting={deletingIds.has(template.id)}
                    isFavoriting={favoritingIds.has(template.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* All Templates Section */}
          {regular.length > 0 && (
            <motion.div variants={itemVariants} className="mb-6">
              {favorites.length > 0 && (
                <div
                  className="chapter-break"
                  style={{ marginInline: 'calc(-1 * var(--space-5))' }}
                >
                  <span className="left">§02 · ALL ROUTINES</span>
                  <span className="right">כל התבניות</span>
                </div>
              )}
              <div className="flex flex-col gap-4 mt-4">
                {regular.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={favorites.length + index}
                    onStart={handleStartTemplate}
                    onToggleFavorite={handleToggleFavorite}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    isDeleting={deletingIds.has(template.id)}
                    isFavoriting={favoritingIds.has(template.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </>
  );
}
