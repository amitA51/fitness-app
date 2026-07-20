import { AnimatePresence, Reorder, m, useDragControls } from 'framer-motion';
import {
  Check as CheckCheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  GripVertical as DragHandleIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import { translateMuscle } from '../../../constants/muscleNames';
import type { Exercise } from '../../../types';
import { SetEditRow } from './SetEditRow';

export interface ExerciseReorderItemProps {
  exercise: Exercise;
  index: number;
  originalIndex: number;
  /** Total number of items in the list — used for the reorder handle a11y label. */
  total: number;
  isActive: boolean;
  isExpanded: boolean;
  completedSets: number;
  totalSets: number;
  isDeleteConfirm: boolean;
  supersetMembership?: { groupIndex: number; position: number; total: number };
  selectMode?: boolean;
  isSelected?: boolean;
  onSelect: (index: number, id: string) => void;
  onDelete: (index: number, e: React.MouseEvent) => void;
  onToggleExpand: (index: number, e: React.MouseEvent) => void;
  /** Keyboard reorder fallback: framer-motion Reorder has no native keyboard path. */
  onMove: (index: number, direction: 'up' | 'down') => void;
  onEditSet?: (
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number }
  ) => void;
  onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
}

export const ExerciseReorderItem: React.FC<ExerciseReorderItemProps> = memo(
  ({
    exercise,
    index,
    originalIndex,
    total,
    isActive,
    isExpanded,
    completedSets,
    totalSets,
    isDeleteConfirm,
    supersetMembership,
    selectMode,
    isSelected,
    onSelect,
    onDelete,
    onToggleExpand,
    onMove,
    onEditSet,
    onDeleteSet,
  }) => {
    const dragControls = useDragControls();
    const isComplete = completedSets === totalSets && totalSets > 0;
    const inSuperset = !!supersetMembership;

    return (
      <Reorder.Item
        value={exercise}
        dragListener={false}
        dragControls={dragControls}
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        whileDrag={{
          scale: 1.02,
          boxShadow: '0 8px 24px rgba(11,26,43,0.2)',
          zIndex: 50,
        }}
        layout
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background:
              selectMode && isSelected
                ? 'color-mix(in srgb, var(--fs-accent) 14%, transparent)'
                : isActive
                  ? 'var(--fs-surface)'
                  : 'var(--fs-surface-2)',
            border: `2px solid ${(selectMode && isSelected) || isActive || inSuperset ? 'var(--fs-accent)' : 'var(--fs-primary)'}`,
          }}
        >
          {/* Drag Handle — also the keyboard reorder control (Arrow Up/Down),
              since framer-motion Reorder offers no native keyboard path. */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              dragControls.start(e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (index > 0) onMove(index, 'up');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (index < total - 1) onMove(index, 'down');
              }
            }}
            aria-label={`גרור או השתמש בחצים לשינוי סדר — תרגיל ${index + 1} מתוך ${total}`}
            style={{
              cursor: 'grab',
              padding: 8,
              marginLeft: -8,
              borderRadius: 12,
              background: 'transparent',
              border: 'none',
              touchAction: 'none',
            }}
          >
            <DragHandleIcon
              style={{ width: 20, height: 20, color: 'var(--fs-muted)', display: 'block' }}
            />
          </button>

          {/* Number */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isComplete
                ? 'color-mix(in srgb, var(--color-success) 16%, transparent)'
                : isActive
                  ? 'var(--fs-accent)'
                  : 'var(--fs-surface)',
              color: isComplete
                ? 'var(--color-success)'
                : isActive
                  ? 'var(--fs-primary)'
                  : 'var(--fs-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              flexShrink: 0,
              border: `2px solid ${isComplete ? 'var(--color-success)' : isActive ? 'var(--fs-primary)' : 'var(--fs-surface-2)'}`,
            }}
          >
            {isComplete ? <CheckCheckIcon style={{ width: 16, height: 16 }} /> : index + 1}
          </div>

          {/* Exercise Info */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(index, exercise.id);
            }}
            style={{
              flex: 1,
              textAlign: 'right',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              direction: 'rtl',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                // --fs-link, not --fs-primary: primary is the near-black obsidian
                // used for borders and for ink ON the accent fill (see the badge
                // above). As a bare text color it is #0a0a0a on #111 in dark =
                // 1.05:1, invisible; in light it is 15.1:1 vs 16.2:1 for --fs-ink,
                // so the active state never read at all. --fs-link is the AA-safe
                // accent-text token (6.6:1 light / 11.0:1 dark).
                color: isActive ? 'var(--fs-link)' : 'var(--fs-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {exercise.name || 'תרגיל ללא שם'}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 2,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: isComplete ? 'var(--color-success)' : 'var(--fs-muted)',
                }}
              >
                {completedSets}/{totalSets} סטים
              </span>
              {exercise.muscleGroup && (
                <>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--fs-muted)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {translateMuscle(exercise.muscleGroup)}
                  </span>
                </>
              )}
              {supersetMembership && (
                <>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--fs-accent)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-heading)',
                      background: 'var(--fs-accent)',
                      padding: '1px 6px',
                      fontWeight: 700,
                    }}
                  >
                    סופרסט {supersetMembership.position}/{supersetMembership.total}
                  </span>
                </>
              )}
            </div>
          </button>

          {/* Expand */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand(index, e);
            }}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isExpanded ? 'var(--fs-accent)' : 'var(--fs-surface)',
              color: isExpanded ? 'var(--fs-primary)' : 'var(--fs-muted)',
              border: '2px solid var(--fs-primary)',
              borderRadius: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label={isExpanded ? 'כווץ' : 'הרחב'}
          >
            {isExpanded ? (
              <ChevronUpIcon style={{ width: 18, height: 18 }} />
            ) : (
              <ChevronDownIcon style={{ width: 18, height: 18 }} />
            )}
          </button>

          {/* Delete */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(index, e);
            }}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDeleteConfirm ? 'rgba(196,43,43,0.15)' : 'var(--fs-surface)',
              color: isDeleteConfirm ? 'var(--fs-warn)' : 'var(--fs-muted)',
              border: '2px solid var(--fs-primary)',
              borderRadius: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="מחק תרגיל"
          >
            <TrashIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Expanded Sets */}
        <AnimatePresence>
          {isExpanded && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  padding: '8px 16px 16px',
                  background: 'var(--fs-surface)',
                  border: '2px solid var(--fs-primary)',
                  borderTop: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {exercise.sets && exercise.sets.length > 0 ? (
                  exercise.sets.map((set, setIndex) => (
                    <SetEditRow
                      key={set.id}
                      set={set}
                      setIndex={setIndex}
                      exerciseIndex={originalIndex}
                      canDelete={(exercise.sets?.length || 0) > 1}
                      onEditSet={onEditSet}
                      onDeleteSet={onDeleteSet}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      paddingTop: 12,
                      paddingBottom: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    אין סטים בתרגיל זה
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Delete confirm overlay */}
        {isDeleteConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(196,43,43,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-warn)',
                background: 'rgba(196,43,43,0.12)',
                padding: '4px 12px',
                border: '1px solid var(--fs-warn)',
                borderRadius: 12,
              }}
            >
              לחץ שוב למחיקה
            </span>
          </div>
        )}
      </Reorder.Item>
    );
  }
);

ExerciseReorderItem.displayName = 'ExerciseReorderItem';
