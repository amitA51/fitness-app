// ExerciseCard - Fresh Steel / Obsidian
// Surface background · steel border · accent selected state
// Sharp corners · IBM Plex Mono labels · Bricolage display.

import { AnimatePresence, m } from 'framer-motion';
import { Trash as TrashIcon } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import type { PersonalExercise } from '../../../types';

const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

interface ExerciseCardProps {
  exercise: PersonalExercise;
  isSelectionMode?: boolean;
  /**
   * Selection state as a primitive boolean (NOT the whole `selectedIds` Set).
   * Passing the Set broke `memo` — every card re-rendered whenever ANY card's
   * selection changed because the Set reference was new each time. A boolean
   * lets memo skip cards whose own selection is unchanged.
   */
  isSelected?: boolean;
  onClick?: (exercise: PersonalExercise) => void;
  onDelete?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const NAME_PRIMARY_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--fs-heading)',
  lineHeight: 1.1,
  display: 'block',
};

const NAME_SECONDARY_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--fs-muted)',
  textTransform: 'uppercase',
};

const NAME_SOLO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--fs-heading)',
  lineHeight: 1.1,
};

// Hoisted out of the component body — pure function of `name`. Avoids
// re-creating a closure for every card on every scroll repaint.
function renderExerciseName(name: string) {
  if (name.includes('|')) {
    const [first = '', second = ''] = name.split('|').map((s) => s.trim());
    const firstIsHebrew = hasHebrew(first);
    return (
      <div style={{ textAlign: 'right' }}>
        <span style={NAME_PRIMARY_STYLE}>{firstIsHebrew ? first : second}</span>
        <span style={NAME_SECONDARY_STYLE}>{firstIsHebrew ? second : first}</span>
      </div>
    );
  }
  return <span style={NAME_SOLO_STYLE}>{name}</span>;
}

const ExerciseCard: React.FC<ExerciseCardProps> = memo(
  ({ exercise, isSelectionMode = false, isSelected = false, onClick, onDelete }) => {
    return (
      <m.div
        key={exercise.id}
        onClick={() => onClick?.(exercise)}
        className="magnetic-card glass-surface"
        aria-pressed={isSelectionMode ? isSelected : undefined}
        style={{
          position: 'relative',
          padding: '14px',
          background: isSelected
            ? 'var(--fs-accent)'
            : 'linear-gradient(135deg, var(--fs-surface-shine), transparent 48%), var(--fs-surface)',
          border: '1px solid var(--fs-steel)',
          borderRadius: '22px 16px 22px 16px',
          cursor: 'pointer',
          transition: 'all 150ms',
          marginBottom: 0,
          touchAction: 'manipulation',
        }}
        whileTap={{ scale: 0.98 }}
        aria-label={`תרגיל: ${exercise.name ?? ''}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(exercise);
          }
        }}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 24,
              height: 24,
              background: isSelected ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
              border: `2px solid ${isSelected ? 'var(--fs-primary)' : 'var(--fs-steel)'}`,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms',
            }}
          >
            <AnimatePresence>
              {isSelected && (
                <m.svg
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="נבחר"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  width="14"
                  height="14"
                  fill="none"
                  stroke={isSelected ? 'var(--fs-accent)' : 'var(--fs-primary)'}
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </m.svg>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Content */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingLeft: isSelectionMode ? 40 : 0 }}>
            {renderExerciseName(exercise.name ?? '')}

            {/* Meta chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 8,
                direction: 'ltr',
              }}
            >
              {exercise.muscleGroup && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--fs-primary) 15%, transparent)'
                      : 'var(--fs-surface-2)',
                    color: isSelected ? 'var(--fs-primary)' : 'var(--fs-muted)',
                    border: 'none',
                    borderRadius: 999,
                  }}
                >
                  {exercise.muscleGroup}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {exercise.defaultRestTime || 90}s
              </span>
            </div>

            {exercise.notes && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--fs-muted)',
                  marginTop: 6,
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {exercise.notes}
              </p>
            )}
          </div>

          {!isSelectionMode && onDelete && (
            <button
              type="button"
              className="active:scale-[0.92]"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(exercise, e);
              }}
              style={{
                padding: 8,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fs-muted)',
                transition: 'color 150ms, transform 150ms',
                flexShrink: 0,
              }}
              aria-label={`מחק ${exercise.name}`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </m.div>
    );
  }
);

ExerciseCard.displayName = 'ExerciseCard';

export { ExerciseCard };
