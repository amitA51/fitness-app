// ExerciseCard - Sport Annual Editorial Design
// Bone background · Navy border · Mustard selected state
// Sharp corners · IBM Plex Mono labels · Big Shoulders Display
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { memo } from 'react';
import type { PersonalExercise } from '../../../types';
import { TrashIcon } from '../../icons';

const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

interface ExerciseCardProps {
  exercise: PersonalExercise;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onClick?: (exercise: PersonalExercise) => void;
  onDelete?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const NAME_PRIMARY_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--navy)',
  lineHeight: 1.1,
  display: 'block',
};

const NAME_SECONDARY_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--stone)',
  textTransform: 'uppercase',
};

const NAME_SOLO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--navy)',
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
  ({ exercise, isSelectionMode = false, selectedIds, onClick, onDelete }) => {
    const isSelected = selectedIds?.has(exercise.id);

    return (
      <motion.div
        key={exercise.id}
        onClick={() => onClick?.(exercise)}
        style={{
          position: 'relative',
          padding: '14px',
          background: isSelected ? 'var(--mustard)' : 'var(--color-surface)',
          border: `2px solid ${isSelected ? 'var(--navy)' : 'var(--navy)'}`,
          borderRadius: 0,
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
              background: isSelected ? 'var(--navy)' : 'var(--bone-deep)',
              border: `2px solid ${isSelected ? 'var(--navy)' : 'rgba(20,41,61,0.3)'}`,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms',
            }}
          >
            <AnimatePresence>
              {isSelected && (
                <motion.svg
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
                  stroke={isSelected ? 'var(--mustard)' : 'var(--navy)'}
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </motion.svg>
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
                    background: isSelected ? 'rgba(20,41,61,0.15)' : 'var(--bone-deep)',
                    color: isSelected ? 'var(--navy)' : 'var(--stone)',
                    border: 'none',
                    borderRadius: 0,
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
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {exercise.defaultRestTime || 90}s
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                }}
              >
                {exercise.defaultSets || 4} סטים
              </span>
            </div>

            {exercise.notes && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--stone)',
                  marginTop: 6,
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                "{exercise.notes}"
              </p>
            )}
          </div>

          {!isSelectionMode && onDelete && (
            <button
              type="button"
              onClick={(e) => onDelete(exercise, e)}
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
                color: 'var(--stone)',
                transition: 'color 150ms',
                flexShrink: 0,
              }}
              aria-label={`מחק ${exercise.name}`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }
);

ExerciseCard.displayName = 'ExerciseCard';

export { ExerciseCard };
