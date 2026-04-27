/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Dumbbell, Play, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
        className="w-full max-w-lg bg-[#18181C] rounded-t-3xl border-t border-white/[0.08] pt-3 pb-10 max-h-[90vh] overflow-y-auto"
      >
        {/* Drag Handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-7">
            <h2 className="font-condensed font-bold text-[22px] text-white leading-tight">
              תבנית חדשה
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <X size={16} className="text-label-secondary" />
            </motion.button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Input */}
            <div>
              <label className="block text-[12px] font-semibold text-label-secondary mb-2 me-1">
                שם התבנית
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: אימון חזה + כתפיים"
                autoFocus
                className="
                  w-full bg-surface-input rounded-xl 
                  px-4 py-4 text-[16px] text-white
                  placeholder:text-label-tertiary
                  border border-white/6
                  focus:outline-none 
                  focus:border-primary/50 
                  focus:ring-2 focus:ring-primary/15
                  transition-all duration-200
                "
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[13px] text-error"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {/* Exercise Builder Section */}
            <div>
              <label className="block text-[12px] font-semibold text-label-secondary mb-2 me-1">
                תרגילים
                <span
                  className="ms-2"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    color: 'var(--stone)',
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
                        background: 'var(--bone)',
                        border: '1px solid var(--bone-deep)',
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Dumbbell size={14} style={{ color: 'var(--navy)' }} />
                        <span
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-hebrew)',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--ink)',
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
                            color: 'var(--navy)',
                          }}
                        >
                          {ex.targetSets}×{ex.targetReps}
                        </span>
                        <span
                          className="whitespace-nowrap"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--stone)',
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
                        style={{ background: 'var(--bone-deep)' }}
                        aria-label={`הסר ${ex.exerciseName}`}
                      >
                        <X size={12} style={{ color: 'var(--navy)' }} />
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
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2"
                style={{
                  border: '1.5px dashed var(--bone-deep)',
                  color: 'var(--navy)',
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  fontWeight: 600,
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
                    background: 'var(--bone)',
                    border: '1px solid var(--bone-deep)',
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        style={{
                          fontFamily: 'var(--font-hebrew)',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--ink)',
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
                        style={{ background: 'var(--bone-deep)' }}
                      >
                        <X size={12} style={{ color: 'var(--navy)' }} />
                      </motion.button>
                    </div>
                    <input
                      type="text"
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      placeholder="חפש תרגיל..."
                      autoFocus
                      className="w-full rounded-lg px-3 py-2.5 text-[14px]"
                      style={{
                        background: 'var(--bone-deep)',
                        border: '1px solid var(--bone-deep)',
                        color: 'var(--ink)',
                        fontFamily: 'var(--font-hebrew)',
                      }}
                    />
                    <div
                      className="mt-2 flex flex-col gap-1 max-h-[200px] overflow-y-auto"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'var(--bone-deep) transparent',
                      }}
                    >
                      {filteredExercises.length === 0 && (
                        <p
                          className="text-center py-4"
                          style={{
                            fontFamily: 'var(--font-hebrew)',
                            fontSize: '13px',
                            color: 'var(--stone)',
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
                          className="w-full text-right px-3 py-2.5 rounded-lg flex items-center justify-between"
                          style={{
                            fontFamily: 'var(--font-hebrew)',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--ink)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--bone-deep)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span>{ex.name || 'תרגיל'}</span>
                          <Plus size={14} style={{ color: 'var(--navy)' }} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className="
                w-full min-h-[52px] py-4 rounded-xl 
                bg-primary text-white font-semibold text-[16px]
                disabled:opacity-50
                transition-all duration-200
                hover:brightness-110
              "
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
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
  onStart: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  isFavoriting?: boolean;
}

function TemplateCard({
  template,
  index,
  onStart,
  onToggleFavorite,
  onDelete,
  isDeleting,
  isFavoriting,
}: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: index * 0.06 }}
      className="card-outlined"
    >
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-3">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            color: template.isFavorite ? 'var(--mustard)' : 'var(--stone)',
            textTransform: 'uppercase',
          }}
        >
          №{String(index + 1).padStart(3, '0')} · {formatLastUsed(template.lastUsed)}
        </span>
        {template.isFavorite && (
          <Star size={14} fill="var(--mustard)" style={{ color: 'var(--mustard)' }} />
        )}
      </div>

      {/* Display title */}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '28px',
          lineHeight: 0.95,
          color: 'var(--ink)',
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
          color: 'var(--navy)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Dumbbell size={12} />
          {template.exercises.length} EX
        </span>
        <span style={{ color: 'var(--stone)' }}>·</span>
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
            <span className="chip" style={{ background: 'var(--bone-deep)' }}>
              +{template.exercises.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Action row */}
      <div
        className="flex items-center gap-2 flex-wrap pt-3"
        style={{ borderTop: '1px solid var(--bone-deep)' }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="btn-primary flex items-center justify-center gap-2"
          style={{ flex: 1, minHeight: '44px', padding: '12px 16px' }}
          aria-label="התחל אימון"
        >
          <Play size={14} />
          התחל
        </motion.button>
        <motion.button
          whileTap={{ scale: isFavoriting ? 1 : 0.95 }}
          onClick={onToggleFavorite}
          disabled={isFavoriting}
          className="chip"
          style={{
            background: template.isFavorite ? 'var(--mustard)' : 'var(--bone)',
            minHeight: '44px',
            padding: '0 14px',
            opacity: isFavoriting ? 0.6 : 1,
          }}
          aria-label={template.isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          aria-busy={isFavoriting}
        >
          {isFavoriting ? (
            <div className="w-4 h-4 border-2 border-navy border-t-transparent animate-spin" />
          ) : (
            <Star
              size={14}
              fill={template.isFavorite ? 'var(--color-on-mustard)' : 'none'}
              style={{ color: template.isFavorite ? 'var(--color-on-mustard)' : 'var(--navy)' }}
            />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: isDeleting ? 1 : 0.95 }}
          onClick={handleDeleteClick}
          onBlur={() => setConfirmDelete(false)}
          disabled={isDeleting}
          className="chip"
          style={{
            background: confirmDelete ? 'var(--navy)' : 'var(--bone)',
            color: confirmDelete ? 'var(--mustard)' : 'var(--navy)',
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
}

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
      <p className="text-[17px] text-white mb-2 font-semibold">שגיאה בטעינה</p>
      <p className="text-[14px] text-label-secondary mb-8 text-center">
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
  const [_creatingId, setCreatingId] = useState<string | null>(null);
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
    setCreatingId('temp');
    try {
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
    } finally {
      setCreatingId(null);
    }
  };

  const handleToggleFavorite = async (template: WorkoutTemplate) => {
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
  };

  const handleDelete = async (id: string) => {
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
  };

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
        className="pb-[88px]"
        style={{ background: 'var(--bone)' }}
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Masthead */}
        <header
          className="masthead sticky top-0 z-20"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
        >
          <div className="kicker">§06 · TEMPLATES · {templates.length} ROUTINES</div>
          <h1
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: 'clamp(44px, 12vw, 72px)',
              lineHeight: 0.9,
              marginTop: '8px',
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
              className="btn-primary w-full flex items-center justify-center gap-2"
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
                style={{ background: 'var(--navy)', color: 'var(--mustard)' }}
              >
                <Dumbbell size={36} />
              </motion.div>
              <p
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                אין תבניות עדיין
              </p>
              <p className="eyebrow mb-6" style={{ color: 'var(--stone)' }}>
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
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
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
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
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
