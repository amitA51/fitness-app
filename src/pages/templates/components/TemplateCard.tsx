import { m } from 'framer-motion';
import { Clock, Copy, Dumbbell, Play, Star, Trash2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import type { WorkoutTemplate } from '../../../types';
import { formatLastUsed, springTransition } from '../constants';

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

  return (
    <m.div
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
          fontVariantNumeric: 'tabular-nums',
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
          whileTap={{ scale: 0.95 }}
          onClick={() => onStart(template.id)}
          className="btn-primary flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
          style={{ flex: 1, minHeight: '44px', padding: '12px 16px' }}
          aria-label={`התחל אימון: ${template.name}`}
        >
          <Play size={14} />
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
