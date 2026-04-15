/**
 * SparkOS Fitness - Templates Page (Premium Design System)
 * Double-Bezel Cards, Spring Physics, Staggered Reveals
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Dumbbell, Clock, Star, Play, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getWorkoutTemplates,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
} from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';

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

interface CreateModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

function CreateModal({ onClose, onCreate }: CreateModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onCreate(trimmed);
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
        className="w-full max-w-lg bg-[#18181C] rounded-t-3xl border-t border-white/[0.08] pt-3 pb-10"
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
            {/* Label */}
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
}

function TemplateCard({ template, index, onStart, onToggleFavorite, onDelete }: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className="card-interactive overflow-hidden"
    >
      <div className="p-5">
        {/* Main Content Row */}
        <div className="flex items-center gap-4">
          {/* Icon Block */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"
          >
            <Dumbbell size={24} className="text-primary" />
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-condensed font-bold text-[18px] text-white leading-tight truncate">
                {template.name}
              </p>
              {template.isFavorite && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Star size={16} className="text-warning fill-warning flex-shrink-0" />
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[12px] text-label-secondary">
                <Dumbbell size={12} className="text-label-tertiary" />
                {template.exercises.length} תרגילים
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-label-secondary">
                <Clock size={12} className="text-label-tertiary" />
                {formatLastUsed(template.lastUsed)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={onToggleFavorite}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/6"
              aria-label={template.isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              <Star
                size={18}
                className={
                  template.isFavorite
                    ? 'text-warning fill-warning'
                    : 'text-label-tertiary'
                }
              />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={onStart}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center"
              aria-label="התחל אימון"
            >
              <Play size={18} className="text-white me-[-2px]" />
            </motion.button>
          </div>
        </div>

        {/* Delete Row */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.04]">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDeleteClick}
            onBlur={() => setConfirmDelete(false)}
            className={`
              flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl 
              text-[13px] font-medium transition-all duration-200
              ${confirmDelete
                ? 'bg-error/15 text-error border border-error/30'
                : 'text-label-tertiary hover:text-error hover:bg-error/10'
              }
            `}
          >
            <Trash2 size={14} />
            {confirmDelete ? 'בטוח? לחץ לאישור' : 'מחק'}
          </motion.button>
          
          <span className="text-[11px] text-label-tertiary">
            {template.timesUsed > 0 ? `${template.timesUsed} פעמים` : 'טרם בוצע'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Section Label
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="section-title mb-3"
    >
      {children}
    </motion.p>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="min-h-screen pb-[100px]" dir="rtl">
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
    <div className="min-h-screen pb-[100px] flex flex-col items-center justify-center px-6" dir="rtl">
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
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        className="btn btn-primary"
      >
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

  const handleCreate = async (name: string) => {
    const newTemplate = await createWorkoutTemplate({
      name,
      description: '',
      exercises: [],
      updatedAt: new Date().toISOString(),
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    });
    setShowCreateModal(false);
    navigate(`/workout/${newTemplate.id}`);
  };

  const handleToggleFavorite = async (template: WorkoutTemplate) => {
    const updated = await updateWorkoutTemplate(template.id, {
      isFavorite: !template.isFavorite,
    });
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  const handleDelete = async (id: string) => {
    await deleteWorkoutTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
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
        className="min-h-screen pb-[100px]"
        dir="rtl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="px-5 pt-6">
          {/* Header */}
          <motion.div 
            variants={itemVariants}
            className="flex items-center justify-between mb-8"
          >
            <h1 className="font-condensed font-bold text-[28px] text-white leading-none tracking-tight">
              תבניות
            </h1>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowCreateModal(true)}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center"
              aria-label="צור תבנית חדשה"
            >
              <Plus size={20} className="text-white" />
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
                className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6"
              >
                <Dumbbell size={40} className="text-primary" />
              </motion.div>
              <p className="font-condensed font-bold text-[22px] text-white mb-2">
                אין תבניות עדיין
              </p>
              <p className="text-[14px] text-label-secondary mb-8 max-w-[260px]">
                צור תבנית אימון ותתחיל להתאמן
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-pill gap-2"
              >
                <Plus size={18} />
                צור תבנית ראשונה
              </motion.button>
            </motion.div>
          )}

          {/* Favorites Section */}
          {favorites.length > 0 && (
            <motion.div variants={itemVariants} className="mb-8">
              <SectionLabel>מועדפים</SectionLabel>
              <div className="flex flex-col gap-4">
                {favorites.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* All Templates Section */}
          {regular.length > 0 && (
            <motion.div variants={itemVariants} className="mb-8">
              {favorites.length > 0 && <SectionLabel>כל התבניות</SectionLabel>}
              <div className="flex flex-col gap-4">
                {regular.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={favorites.length + index}
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
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
          <CreateModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </>
  );
}
