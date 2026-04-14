import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Dumbbell, Clock, Star, Play, Trash2, X } from 'lucide-react';
import {
  getWorkoutTemplates,
  createWorkoutTemplate,
  updateWorkoutTemplate,
  deleteWorkoutTemplate,
} from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';

// ============================================================================
// UTILITY
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
// CREATE TEMPLATE MODAL — iOS bottom sheet
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] border-t border-white/[0.08] pt-2 pb-10 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-6">
          {/* Title row */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-barlow-condensed font-bold text-[22px] text-white">
              תבנית חדשה
            </h2>
            <button
              onClick={onClose}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-white/[0.10] text-[#8E8E93] hover:bg-white/[0.15] transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* iOS-style input */}
            <div>
              <label className="block font-barlow text-[13px] text-[#8E8E93] mb-2 pr-1">
                שם התבנית
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: אימון חזה + כתפיים"
                autoFocus
                className="w-full bg-[#2C2C2E] rounded-[14px] px-4 py-3.5 text-white font-barlow text-[16px] placeholder:text-[#48484A] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              {error && (
                <p className="mt-2 font-barlow text-[13px] text-red-400 pr-1">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[52px] py-3.5 rounded-[16px] bg-primary text-white font-barlow font-semibold text-[17px] disabled:opacity-50 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            >
              {isSubmitting ? 'יוצר...' : 'צור תבנית'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TEMPLATE CARD
// ============================================================================

interface TemplateCardProps {
  template: WorkoutTemplate;
  onStart: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onStart, onToggleFavorite, onDelete }: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  };

  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStart();
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite();
  };

  return (
    <div className="relative bg-[#111111] rounded-[20px] border border-white/[0.06] overflow-hidden transition-all duration-200 hover:border-white/[0.12] hover:bg-[#161616]">
      <div className="p-4">
        {/* Main content row */}
        <div className="flex items-center gap-3">
          {/* Left icon block */}
          <div className="w-12 h-12 rounded-[14px] bg-primary/[0.12] flex items-center justify-center shrink-0">
            <Dumbbell size={22} className="text-primary" />
          </div>

          {/* Middle: name + meta */}
          <div className="flex-1 min-w-0">
            <p className="font-barlow-condensed font-bold text-[17px] text-white leading-tight truncate">
              {template.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 font-barlow text-[12px] text-[#8E8E93]">
                <Dumbbell size={11} className="text-[#48484A]" />
                {template.exercises.length} תרגילים
              </span>
              <span className="flex items-center gap-1 font-barlow text-[12px] text-[#8E8E93]">
                <Clock size={11} className="text-[#48484A]" />
                {formatLastUsed(template.lastUsed)}
              </span>
            </div>
          </div>

          {/* Right: favorite + play */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleFavoriteClick}
              className="w-[44px] h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/[0.06] active:scale-90"
              aria-label={template.isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              <Star
                size={18}
                className={
                  template.isFavorite
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-[#48484A]'
                }
              />
            </button>

            <button
              onClick={handleStartClick}
              className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-primary transition-all duration-200 hover:opacity-90 active:scale-90"
              aria-label="התחל אימון"
            >
              <Play size={17} className="text-white fill-white mr-[-2px]" />
            </button>
          </div>
        </div>

        {/* Delete row — appears on confirm */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
          <button
            onClick={handleDeleteClick}
            onBlur={() => setConfirmDelete(false)}
            className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-[10px] font-barlow text-[13px] font-medium transition-all duration-200 ${
              confirmDelete
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-[#48484A] hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Trash2 size={13} />
            {confirmDelete ? 'בטוח? לחץ לאישור' : 'מחק'}
          </button>
          <span className="font-barlow text-[11px] text-[#48484A]">
            {template.timesUsed > 0 ? `${template.timesUsed} פעמים` : 'טרם בוצע'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION HEADER (iOS-style label above card group)
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-barlow text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93] mb-2 px-1">
      {children}
    </p>
  );
}

// ============================================================================
// MAIN COMPONENT
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
      setError('שגיאה בטעינת התבניות. נסה לרענן את הדף.');
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]" dir="rtl">
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-barlow-condensed font-bold text-3xl text-white tracking-wide">
              תבניות
            </h1>
            <div className="w-10 h-10 rounded-full skeleton-shimmer" />
          </div>
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#111111] rounded-[20px] border border-white/[0.06] h-28 skeleton-shimmer"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]" dir="rtl">
        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-barlow-condensed font-bold text-3xl text-white tracking-wide">
              תבניות
            </h1>
          </div>
          <div className="text-center py-16">
            <p className="font-barlow text-red-400 mb-5">{error}</p>
            <button
              onClick={loadTemplates}
              className="min-h-[44px] px-6 py-2.5 bg-primary text-white font-barlow font-semibold rounded-[14px] transition-all hover:opacity-90 active:scale-95"
            >
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasTemplates = templates.length > 0;

  return (
    <>
      <div className="min-h-screen bg-black pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]" dir="rtl">
        <div className="px-4 pt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-barlow-condensed font-bold text-3xl text-white tracking-wide leading-none">
              תבניות
            </h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center transition-all duration-200 hover:opacity-90 active:scale-90"
              aria-label="צור תבנית חדשה"
            >
              <Plus size={20} className="text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Empty state */}
          {!hasTemplates && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-[24px] bg-primary/[0.10] flex items-center justify-center mb-5">
                <Dumbbell size={32} className="text-primary" />
              </div>
              <p className="font-barlow-condensed font-bold text-[22px] text-white mb-1.5">
                אין תבניות עדיין
              </p>
              <p className="font-barlow text-[14px] text-[#8E8E93] mb-7">
                צור תבנית אימון ותתחיל להתאמן
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 min-h-[52px] px-8 py-3.5 bg-primary text-white font-barlow font-semibold text-[17px] rounded-[16px] transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Plus size={20} strokeWidth={2.5} />
                צור תבנית ראשונה
              </button>
            </div>
          )}

          {/* Favorites section */}
          {favorites.length > 0 && (
            <div className="mb-6">
              <SectionLabel>מועדפים</SectionLabel>
              <div className="flex flex-col gap-3">
                {favorites.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All templates section */}
          {regular.length > 0 && (
            <div className="mb-6">
              {favorites.length > 0 && <SectionLabel>כל התבניות</SectionLabel>}
              <div className="flex flex-col gap-3">
                {regular.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onStart={() => navigate(`/workout/${template.id}`)}
                    onToggleFavorite={() => handleToggleFavorite(template)}
                    onDelete={() => handleDelete(template.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}
