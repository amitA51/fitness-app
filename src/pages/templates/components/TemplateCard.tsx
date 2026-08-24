import { m } from 'framer-motion';
import { Clock, Copy, Dumbbell, Play, Star, Trash2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import type { WorkoutTemplate } from '../../../types';
import { formatLastUsed, springTransition } from '../constants';

/** English muscle-group key → Hebrew label (subset the templates use). */
const MUSCLE_HE: Record<string, string> = {
  Chest: 'חזה',
  Back: 'גב',
  Legs: 'רגליים',
  Shoulders: 'כתפיים',
  Arms: 'ידיים',
  Core: 'ליבה',
  Abs: 'בטן',
  Cardio: 'אירובי',
};

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

export const TemplateCard = memo(function TemplateCard({
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

  // Unique muscle groups in template order, Hebrew labels, max two shown —
  // "חזה · גב" tells the lifter what this session is at a glance without
  // reading every chip.
  const muscleSummary = (() => {
    const seen: string[] = [];
    for (const ex of template.exercises) {
      const he = MUSCLE_HE[ex.muscleGroup ?? ex.targetMuscle ?? ''];
      if (he && !seen.includes(he)) seen.push(he);
      if (seen.length >= 2) break;
    }
    return seen.join(' · ');
  })();

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: index * 0.05 }}
      className="template-card"
      style={{ marginBottom: 14 }}
    >
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: template.isFavorite ? 'var(--fs-accent-2)' : 'var(--fs-muted)',
          }}
        >
          {formatLastUsed(template.lastUsed)}
        </span>
        {template.isFavorite && (
          <Star size={14} fill="var(--fs-accent)" style={{ color: 'var(--fs-accent)' }} />
        )}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 22,
          lineHeight: 1.15,
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
          marginBottom: 6,
        }}
      >
        {template.name}
      </h3>

      {/* Stats line */}
      <div
        className="flex items-center gap-3 mb-3"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--fs-muted)',
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Dumbbell size={12} />
          {template.exercises.length} תרגילים
        </span>
        {muscleSummary && (
          <>
            <span style={{ color: 'var(--fs-muted)' }}>·</span>
            <span>{muscleSummary}</span>
          </>
        )}
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} />
          {template.timesUsed > 0 ? `${template.timesUsed}×` : 'חדש'}
        </span>
      </div>

      {/* Exercise name chips */}
      {template.exercises.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {template.exercises.slice(0, 3).map((ex) => (
            <span key={ex.id} className="chip">
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
        <m.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onStart(template.id)}
          className="start-workout-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
          style={{
            flex: 1,
            minHeight: 48,
            fontSize: 15,
            boxShadow: '0 6px 18px color-mix(in srgb, var(--fs-accent) 24%, transparent)',
          }}
          aria-label={`התחל אימון: ${template.name}`}
        >
          <Play size={14} strokeWidth={2.5} />
          התחל אימון
        </m.button>
        <m.button
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
        </m.button>
        <m.button
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
        </m.button>
        <m.button
          whileTap={{ scale: isDeleting ? 1 : 0.95 }}
          onClick={handleDeleteClick}
          onBlur={() => setConfirmDelete(false)}
          disabled={isDeleting}
          className="chip"
          style={{
            background: confirmDelete ? 'var(--color-error)' : 'var(--fs-surface)',
            color: confirmDelete ? 'var(--color-ink-on-error)' : 'var(--fs-primary)',
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
              {confirmDelete && <span className="me-1">?</span>}
            </>
          )}
        </m.button>
      </div>
    </m.div>
  );
});
