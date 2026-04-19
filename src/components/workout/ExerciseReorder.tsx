// ExerciseReorder - Sport Annual Editorial Design
// Sharp corners · Navy header · Bone body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import {
  AnimatePresence,
  type PanInfo,
  Reorder,
  motion,
  useDragControls,
} from 'framer-motion';
import React, { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, WorkoutSet } from '../../types';
import {
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DragHandleIcon,
  EditIcon,
  TrashIcon,
} from '../icons';

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
  onClose,
}) => {
  const [items, setItems] = useState(exercises);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  React.useEffect(() => {
    setItems((currentItems) => {
      const exercisesMap = new Map(exercises.map((e) => [e.id, e]));
      return currentItems.map((item) => exercisesMap.get(item.id)).filter(Boolean) as Exercise[];
    });
  }, [exercises]);

  const handleReorder = useCallback((newOrder: Exercise[]) => {
    setItems(newOrder);
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
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        onDeleteExercise?.(index);
        setDeleteConfirm(null);
        if (expandedExercise === index) setExpandedExercise(null);
        else if (expandedExercise !== null && expandedExercise > index)
          setExpandedExercise(expandedExercise - 1);
      } else {
        setDeleteConfirm(index);
        setTimeout(() => setDeleteConfirm(null), 3000);
      }
    },
    [deleteConfirm, items, onDeleteExercise, expandedExercise]
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

  const getOriginalExerciseIndex = useCallback(
    (exercise: Exercise) => exercises.findIndex((ex) => ex.id === exercise.id),
    [exercises]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.velocity.y > 500 || info.offset.y > 200) onClose();
    },
    [onClose]
  );

  const sheetContent = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
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
      <motion.div
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
          background: 'var(--bone)',
          maxHeight: '85vh',
          overflow: 'hidden',
          borderTop: '2px solid var(--navy)',
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
              background: 'rgba(20,41,61,0.2)',
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
            background: 'var(--navy)',
            borderBottom: '1px solid rgba(245,241,235,0.1)',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--bone)',
                letterSpacing: '-0.01em',
              }}
            >
              סדר תרגילים
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'rgba(245,241,235,0.5)',
                textTransform: 'uppercase',
              }}
            >
              גרור כדי לשנות סדר
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                background: 'var(--mustard)',
                color: 'var(--navy)',
                border: 'none',
                borderRadius: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              שמור
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(245,241,235,0.1)',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              <CloseIcon style={{ width: 18, height: 18, color: 'var(--bone)' }} />
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
            {items.map((exercise, index) => (
              <ExerciseReorderItem
                key={exercise.id}
                exercise={exercise}
                index={index}
                originalIndex={getOriginalExerciseIndex(exercise)}
                isActive={index === currentIndex}
                isExpanded={expandedExercise === index}
                completedSets={getCompletedSets(exercise)}
                totalSets={getTotalSets(exercise)}
                isDeleteConfirm={deleteConfirm === index}
                onSelect={() => {
                  onSelectExercise(index);
                  onClose();
                }}
                onDelete={(e) => handleDelete(index, e)}
                onToggleExpand={(e) => toggleExpand(index, e)}
                onEditSet={onEditSet}
                onDeleteSet={onDeleteSet}
              />
            ))}
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
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--navy)',
                }}
              >
                אין תרגילים
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--stone)',
                  marginTop: 4,
                }}
              >
                הוסף תרגילים באימון
              </p>
            </div>
          )}
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(sheetContent, document.body);
};

interface ExerciseReorderItemProps {
  exercise: Exercise;
  index: number;
  originalIndex: number;
  isActive: boolean;
  isExpanded: boolean;
  completedSets: number;
  totalSets: number;
  isDeleteConfirm: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  onEditSet?: (
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number }
  ) => void;
  onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
}

const ExerciseReorderItem: React.FC<ExerciseReorderItemProps> = memo(
  ({
    exercise,
    index,
    originalIndex,
    isActive,
    isExpanded,
    completedSets,
    totalSets,
    isDeleteConfirm,
    onSelect,
    onDelete,
    onToggleExpand,
    onEditSet,
    onDeleteSet,
  }) => {
    const dragControls = useDragControls();
    const isComplete = completedSets === totalSets && totalSets > 0;

    return (
      <Reorder.Item
        value={exercise}
        dragListener={false}
        dragControls={dragControls}
        style={{
          position: 'relative',
          borderRadius: 0,
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
            background: isActive ? '#FFFFFF' : 'var(--bone-deep)',
            border: `2px solid ${isActive ? 'var(--mustard)' : 'var(--navy)'}`,
            borderLeft: isActive ? '4px solid var(--mustard)' : '2px solid var(--navy)',
          }}
        >
          {/* Drag Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              dragControls.start(e);
            }}
            style={{
              cursor: 'grab',
              padding: 8,
              marginLeft: -8,
              borderRadius: 0,
            }}
          >
            <DragHandleIcon
              style={{ width: 20, height: 20, color: 'var(--stone)', display: 'block' }}
            />
          </div>

          {/* Number */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isComplete
                ? 'rgba(45,139,78,0.15)'
                : isActive
                  ? 'var(--mustard)'
                  : 'var(--bone)',
              color: isComplete
                ? 'var(--color-success)'
                : isActive
                  ? 'var(--navy)'
                  : 'var(--stone)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
              border: `2px solid ${isComplete ? 'var(--color-success)' : isActive ? 'var(--navy)' : 'var(--bone-deep)'}`,
            }}
          >
            {isComplete ? (
              <CheckCheckIcon style={{ width: 16, height: 16 }} />
            ) : (
              index + 1
            )}
          </div>

          {/* Exercise Info */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect();
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
                fontWeight: 800,
                fontSize: 14,
                color: isActive ? 'var(--navy)' : 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {exercise.name || 'תרגיל ללא שם'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: isComplete ? 'var(--color-success)' : 'var(--stone)',
                  textTransform: 'uppercase',
                }}
              >
                {completedSets}/{totalSets} סטים
              </span>
              {exercise.muscleGroup && (
                <>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--stone)', display: 'inline-block' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: 'var(--stone)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {exercise.muscleGroup}
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
              onToggleExpand(e);
            }}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isExpanded ? 'var(--mustard)' : 'var(--bone)',
              color: isExpanded ? 'var(--navy)' : 'var(--stone)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
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
              onDelete(e);
            }}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDeleteConfirm ? 'rgba(196,43,43,0.15)' : 'var(--bone)',
              color: isDeleteConfirm ? 'var(--color-error)' : 'var(--stone)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
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
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  padding: '8px 16px 16px',
                  background: '#FFFFFF',
                  border: '2px solid var(--navy)',
                  borderTop: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {exercise.sets && exercise.sets.length > 0 ? (
                  exercise.sets.map((set, setIndex) => (
                    <SetEditRow
                      key={`set-${originalIndex}-${setIndex}`}
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
                      color: 'var(--stone)',
                      textTransform: 'uppercase',
                    }}
                  >
                    אין סטים בתרגיל זה
                  </div>
                )}
              </div>
            </motion.div>
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
                color: 'var(--color-error)',
                textTransform: 'uppercase',
                background: 'rgba(196,43,43,0.12)',
                padding: '4px 12px',
                border: '1px solid var(--color-error)',
                borderRadius: 0,
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

interface SetEditRowProps {
  set: WorkoutSet;
  setIndex: number;
  exerciseIndex: number;
  canDelete: boolean;
  onEditSet?: (
    exerciseIndex: number,
    setIndex: number,
    updates: { weight?: number; reps?: number }
  ) => void;
  onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
}

const SetEditRow: React.FC<SetEditRowProps> = memo(
  ({ set, setIndex, exerciseIndex, canDelete, onEditSet, onDeleteSet }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempWeight, setTempWeight] = useState(set.weight || 0);
    const [tempReps, setTempReps] = useState(set.reps || 0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const isCompleted = !!set.completedAt;

    const handleStartEdit = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTempWeight(set.weight || 0);
      setTempReps(set.reps || 0);
      setIsEditing(true);
    };

    const handleSave = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onEditSet?.(exerciseIndex, setIndex, { weight: tempWeight, reps: tempReps });
      setIsEditing(false);
    };

    const handleCancel = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteConfirm) {
        onDeleteSet?.(exerciseIndex, setIndex);
        setDeleteConfirm(false);
      } else {
        setDeleteConfirm(true);
        setTimeout(() => setDeleteConfirm(false), 3000);
      }
    };

    if (isEditing) {
      return (
        <div
          style={{
            background: 'var(--bone-deep)',
            border: '2px solid var(--navy)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--mustard)',
              textTransform: 'uppercase',
            }}
          >
            סט {setIndex + 1} — עריכה
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                ק"ג
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTempWeight((w) => Math.max(0, w - 2.5));
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--bone)',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--navy)',
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={tempWeight}
                  onChange={(e) => {
                    e.stopPropagation();
                    setTempWeight(Number(e.target.value) || 0);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: 36,
                    background: '#FFFFFF',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--navy)',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTempWeight((w) => w + 2.5);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--navy)',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--mustard)',
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                חזרות
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTempReps((r) => Math.max(0, r - 1));
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--bone)',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--navy)',
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={tempReps}
                  onChange={(e) => {
                    e.stopPropagation();
                    setTempReps(Number(e.target.value) || 0);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: 36,
                    background: '#FFFFFF',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--navy)',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTempReps((r) => r + 1);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--navy)',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    color: 'var(--mustard)',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'var(--bone-deep)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--navy)',
              }}
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'var(--mustard)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--navy)',
              }}
            >
              שמור
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: isCompleted ? 'rgba(45,139,78,0.08)' : 'var(--bone)',
          border: `1px solid ${isCompleted ? 'var(--color-success)' : 'var(--bone-deep)'}`,
          borderRadius: 0,
          cursor: 'pointer',
          direction: 'rtl',
        }}
        onClick={handleStartEdit}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCompleted && (
            <CheckCheckIcon style={{ width: 16, height: 16, color: 'var(--color-success)' }} />
          )}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              color: 'var(--navy)',
            }}
          >
            סט {setIndex + 1}
          </span>
          {!isCompleted && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.1em',
                color: 'var(--stone)',
                textTransform: 'uppercase',
              }}
            >
              (טרם הושלם)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, direction: 'ltr' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--navy)',
            }}
          >
            {set.weight || 0}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--stone)',
                marginRight: 2,
              }}
            >
              kg
            </span>
          </span>
          <span style={{ color: 'var(--stone)', fontSize: 12 }}>×</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--navy)',
            }}
          >
            {set.reps || 0}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--stone)',
                marginRight: 2,
              }}
            >
              reps
            </span>
          </span>
          <EditIcon style={{ width: 14, height: 14, color: 'var(--stone)' }} />
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: deleteConfirm ? 'rgba(196,43,43,0.12)' : 'transparent',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              <TrashIcon
                style={{
                  width: 14,
                  height: 14,
                  color: deleteConfirm ? 'var(--color-error)' : 'var(--stone)',
                }}
              />
            </button>
          )}
        </div>
      </div>
    );
  }
);

SetEditRow.displayName = 'SetEditRow';

export default memo(ExerciseReorder);
