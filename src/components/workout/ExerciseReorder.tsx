// ExerciseReorder - Fresh Steel / Obsidian
// Sharp corners · dark masthead header · surface body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { AnimatePresence, type PanInfo, Reorder, m } from 'framer-motion';
import { Link2 } from 'lucide-react';
import { X as CloseIcon } from 'lucide-react';
import React, { useState, useCallback, memo, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { Exercise } from '../../types';
import type { SupersetGroup } from './core/workoutTypes';
import { ExerciseReorderItem } from './reorder/ExerciseReorderItem';

interface ExerciseReorderProps {
  exercises: Exercise[];
  currentIndex: number;
  onReorder: (exercises: Exercise[]) => void;
  onSelectExercise: (index: number) => void;
  onDeleteExercise?: (index: number) => void;
  onEditSet?: (
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number }
  ) => void;
  onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
  supersetGroups?: SupersetGroup[];
  onCreateSupersetGroup?: (exerciseIds: string[]) => void;
  onClose: () => void;
}

const ExerciseReorder: React.FC<ExerciseReorderProps> = ({
  exercises,
  currentIndex,
  onReorder,
  onSelectExercise,
  onDeleteExercise,
  onEditSet,
  onDeleteSet,
  supersetGroups = [],
  onCreateSupersetGroup,
  onClose,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(exercises);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  // Make this raw createPortal sheet behave like the canonical ModalOverlay:
  // trap Tab focus inside it, lock body scroll, and close on Escape. The
  // component is only mounted while the drawer is open, so isOpen is always true.
  useFocusTrap(sheetRef, {
    isOpen: true,
    onClose,
    closeOnEscape: true,
    restoreFocus: true,
  });

  // Superset multi-select mode
  const [supersetMode, setSupersetMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Map exercise ID → superset membership info for visual labels
  const supersetMembership = useMemo(() => {
    const map = new Map<string, { groupIndex: number; position: number; total: number }>();
    supersetGroups.forEach((group, groupIndex) => {
      group.exercises.forEach((id, position) => {
        map.set(id, { groupIndex, position: position + 1, total: group.exercises.length });
      });
    });
    return map;
  }, [supersetGroups]);

  const toggleSupersetMode = useCallback(() => {
    setSupersetMode((prev) => {
      const next = !prev;
      if (!next) setSelectedIds([]);
      return next;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const confirmSuperset = useCallback(() => {
    if (selectedIds.length < 2 || !onCreateSupersetGroup) return;
    onCreateSupersetGroup(selectedIds);
    setSelectedIds([]);
    setSupersetMode(false);
  }, [selectedIds, onCreateSupersetGroup]);

  React.useEffect(() => {
    setItems((currentItems) => {
      const exercisesMap = new Map(exercises.map((e) => [e.id, e]));
      // Preserve current order for exercises that still exist
      const kept = currentItems
        .map((item) => exercisesMap.get(item.id))
        .filter((e): e is Exercise => e != null);
      const keptIds = new Set(kept.map((e) => e.id));
      // Append any newly added exercises that aren't in the local list yet
      const added = exercises.filter((e) => !keptIds.has(e.id));
      return [...kept, ...added];
    });
  }, [exercises]);

  const handleReorder = useCallback((newOrder: Exercise[]) => {
    setItems(newOrder);
  }, []);

  // Keyboard reorder fallback for the drag handle (framer-motion Reorder has no
  // native keyboard path). Swaps the item with its neighbour immutably.
  const handleMove = useCallback((index: number, direction: 'up' | 'down') => {
    setItems((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index];
      const swapped = next[target];
      if (!moved || !swapped) return prev;
      next[index] = swapped;
      next[target] = moved;
      return next;
    });
  }, []);

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onReorder(items);
      onClose();
    },
    [items, onReorder, onClose]
  );

  const handleClose = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleDelete = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteConfirm === index) {
        const exerciseToDelete = items[index];
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        // Use the original index in the parent's exercises array, not the local reordered index
        if (exerciseToDelete) {
          const originalIdx = exercises.findIndex((ex) => ex.id === exerciseToDelete.id);
          if (originalIdx !== -1) {
            onDeleteExercise?.(originalIdx);
          }
        }
        setDeleteConfirm(null);
        if (expandedExercise === index) setExpandedExercise(null);
        else if (expandedExercise !== null && expandedExercise > index)
          setExpandedExercise(expandedExercise - 1);
      } else {
        setDeleteConfirm(index);
        setTimeout(() => setDeleteConfirm(null), 3000);
      }
    },
    [deleteConfirm, items, exercises, onDeleteExercise, expandedExercise]
  );

  const toggleExpand = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedExercise((prev) => (prev === index ? null : index));
  }, []);

  const getCompletedSets = useCallback((exercise: Exercise) => {
    return exercise.sets?.filter((s) => s.completedAt).length || 0;
  }, []);

  const getTotalSets = useCallback((exercise: Exercise) => {
    return exercise.sets?.length || 0;
  }, []);

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    exercises.forEach((e, i) => m.set(e.id, i));
    return m;
  }, [exercises]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.velocity.y > 500 || info.offset.y > 200) onClose();
    },
    [onClose]
  );

  const handleItemSelect = useCallback(
    (index: number, id: string) => {
      if (supersetMode) {
        toggleSelection(id);
      } else {
        onSelectExercise(index);
        onClose();
      }
    },
    [supersetMode, toggleSelection, onSelectExercise, onClose]
  );

  const handleItemDelete = useCallback(
    (index: number, e: React.MouseEvent) => {
      handleDelete(index, e);
    },
    [handleDelete]
  );

  const handleItemToggleExpand = useCallback(
    (index: number, e: React.MouseEvent) => {
      toggleExpand(index, e);
    },
    [toggleExpand]
  );

  const sheetContent = (
    <AnimatePresence>
      {/* Backdrop */}
      <m.div
        key="reorder-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,26,43,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 9998,
        }}
      />

      {/* Bottom Sheet */}
      <m.div
        ref={sheetRef}
        key="reorder-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={supersetMode ? 'בחר תרגילים לסופרסט' : 'סדר תרגילים'}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--fs-surface)',
          maxHeight: '85vh',
          overflow: 'hidden',
          borderTop: '2px solid var(--fs-primary)',
          boxShadow: '0 -8px 32px rgba(11,26,43,0.25)',
        }}
      >
        {/* Drag Handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 12,
            paddingBottom: 8,
            cursor: 'grab',
          }}
        >
          <div
            style={{
              width: 48,
              height: 4,
              background: 'var(--fs-steel)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Navy Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'var(--fs-primary)',
            borderBottom: '1px solid rgba(var(--text-on-navy-rgb),0.1)',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 18,
                color: 'var(--color-ink-on-dark)',
                letterSpacing: '-0.01em',
              }}
            >
              {supersetMode ? 'בחר תרגילים לסופרסט' : 'סדר תרגילים'}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '-0.01em',
                color: 'rgba(var(--text-on-navy-rgb),0.5)',
              }}
            >
              {supersetMode ? `נבחרו ${selectedIds.length} · מינימום 2` : 'גרור כדי לשנות סדר'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {supersetMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmSuperset();
                }}
                disabled={selectedIds.length < 2}
                style={{
                  padding: '8px 16px',
                  background:
                    selectedIds.length < 2
                      ? 'rgba(var(--text-on-navy-rgb),0.15)'
                      : 'var(--fs-accent)',
                  color:
                    selectedIds.length < 2
                      ? 'rgba(var(--text-on-navy-rgb),0.5)'
                      : 'var(--fs-primary)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: '-0.01em',
                  cursor: selectedIds.length < 2 ? 'not-allowed' : 'pointer',
                }}
              >
                צור סופרסט
              </button>
            ) : (
              <>
                {onCreateSupersetGroup && items.length >= 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSupersetMode();
                    }}
                    aria-label="צור סופרסט"
                    style={{
                      height: 36,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(var(--text-on-navy-rgb),0.1)',
                      color: 'var(--color-ink-on-dark)',
                      border: '1px solid rgba(var(--text-on-navy-rgb),0.25)',
                      borderRadius: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '-0.01em',
                      cursor: 'pointer',
                    }}
                  >
                    <Link2 size={14} strokeWidth={2.25} />
                    סופרסט
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--fs-accent)',
                    color: 'var(--color-ink-on-accent)',
                    border: 'none',
                    borderRadius: 12,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 13,
                    letterSpacing: '-0.01em',
                    cursor: 'pointer',
                  }}
                >
                  שמור
                </button>
              </>
            )}
            <button
              type="button"
              onClick={
                supersetMode
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSupersetMode();
                    }
                  : handleClose
              }
              aria-label={supersetMode ? 'בטל' : 'סגור'}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(var(--text-on-navy-rgb),0.1)',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              <CloseIcon style={{ width: 18, height: 18, color: 'var(--color-ink-on-dark)' }} />
            </button>
          </div>
        </div>

        {/* Exercise List */}
        <div
          style={{
            padding: 16,
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 120px)',
          }}
        >
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={handleReorder}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {items.map((exercise, index) => {
              const membership = exercise.id ? supersetMembership.get(exercise.id) : undefined;
              const isSelected = selectedIds.includes(exercise.id);
              return (
                <ExerciseReorderItem
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  originalIndex={indexById.get(exercise.id) ?? -1}
                  total={items.length}
                  isActive={index === currentIndex}
                  isExpanded={expandedExercise === index}
                  completedSets={getCompletedSets(exercise)}
                  totalSets={getTotalSets(exercise)}
                  isDeleteConfirm={deleteConfirm === index}
                  supersetMembership={membership}
                  selectMode={supersetMode}
                  isSelected={isSelected}
                  onSelect={handleItemSelect}
                  onDelete={handleItemDelete}
                  onToggleExpand={handleItemToggleExpand}
                  onMove={handleMove}
                  onEditSet={onEditSet}
                  onDeleteSet={onDeleteSet}
                />
              );
            })}
          </Reorder.Group>

          {items.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                paddingTop: 48,
                paddingBottom: 48,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 18,
                  color: 'var(--fs-heading)',
                }}
              >
                אין תרגילים
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--fs-muted)',
                  marginTop: 4,
                }}
              >
                הוסף תרגילים באימון
              </p>
            </div>
          )}
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </m.div>
    </AnimatePresence>
  );

  return createPortal(sheetContent, document.body);
};

export default memo(ExerciseReorder);
