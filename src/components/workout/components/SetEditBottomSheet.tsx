// SetEditBottomSheet - Sport Annual Editorial Design
// Sharp corners · Navy header · Bone body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import { CheckCircle as CheckCircleIcon, X as CloseIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import type { WorkoutSet } from '../../../types';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface SetEditBottomSheetProps {
  isOpen: boolean;
  sets: WorkoutSet[];
  exerciseName: string;
  onClose: () => void;
  onUpdateSet: (setIndex: number, updates: Partial<WorkoutSet>) => void;
}

const SHEET_TRANSITION = { type: 'spring' as const, damping: 30, stiffness: 300 };

const getSetKey = (set: WorkoutSet, index: number): string => {
  if (set.completedAt) return `set-${set.completedAt}`;
  return `set-pending-${index}-${set.weight ?? 0}-${set.reps ?? 0}`;
};

const SetEditBottomSheet = memo<SetEditBottomSheetProps>(
  ({ isOpen, sets, exerciseName, onClose, onUpdateSet }) => {
    const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
    const [tempWeight, setTempWeight] = useState<number>(0);
    const [tempReps, setTempReps] = useState<number>(0);

    const handleStartEdit = useCallback(
      (index: number) => {
        const set = sets[index];
        if (set) {
          setEditingSetIndex(index);
          setTempWeight(set.weight || 0);
          setTempReps(set.reps || 0);
        }
      },
      [sets]
    );

    const handleSave = useCallback(() => {
      if (editingSetIndex !== null) {
        onUpdateSet(editingSetIndex, { weight: tempWeight, reps: tempReps });
        setEditingSetIndex(null);
      }
    }, [editingSetIndex, tempWeight, tempReps, onUpdateSet]);

    const handleCancel = useCallback(() => {
      setEditingSetIndex(null);
    }, []);

    const setKeys = useMemo(() => sets.map((set, index) => getSetKey(set, index)), [sets]);

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        variant="none"
        zLevel="ultra"
        backdropOpacity={60}
        blur="none"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel="עריכת סטים"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={SHEET_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          className="glass-surface"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--fs-surface)',
            borderTop: '2px solid var(--fs-primary)',
            maxHeight: '75vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drag Handle */}
          <div
            style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}
          >
            <div
              style={{
                width: 48,
                height: 4,
                background: 'var(--color-drag-handle)',
                borderRadius: 2,
              }}
            />
          </div>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 16px',
              borderBottom: '1px solid var(--fs-surface-2)',
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--fs-heading)',
                  letterSpacing: '-0.01em',
                }}
              >
                עריכת סטים
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}
              >
                {exerciseName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-surface-2)',
                border: '2px solid var(--fs-primary)',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              <CloseIcon style={{ width: 18, height: 18, color: 'var(--fs-heading)' }} />
            </button>
          </div>

          {/* Sets List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {sets.map((set, index) => {
              const isEditing = editingSetIndex === index;
              const isCompleted = !!set.completedAt;

              return (
                <div
                  key={setKeys[index]}
                  style={{
                    background: isEditing
                      ? 'var(--fs-accent)'
                      : isCompleted
                        ? 'rgba(45,139,78,0.08)'
                        : 'var(--fs-surface)',
                    border: `2px solid ${isEditing ? 'var(--fs-primary)' : isCompleted ? '#2F8F58' : 'var(--fs-primary)'}`,
                    borderRadius: 0,
                    padding: 16,
                  }}
                >
                  {isEditing ? (
                    /* Edit Mode */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.15em',
                          color: 'var(--fs-heading)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          borderBottom: '1px solid var(--color-border)',
                          paddingBottom: 8,
                        }}
                      >
                        סט {index + 1} — עריכה
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Weight */}
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              letterSpacing: '0.15em',
                              color: 'var(--fs-heading)',
                              textTransform: 'uppercase',
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            ק"ג
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setTempWeight((w) => Math.max(0, w - 2.5))}
                              style={{
                                width: 40,
                                height: 40,
                                background: 'var(--fs-surface)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-heading)',
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.25"
                              value={tempWeight}
                              onChange={(e) => setTempWeight(Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                flex: 1,
                                height: 40,
                                background: 'var(--fs-surface)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                textAlign: 'center',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-heading)',
                                outline: 'none',
                                minWidth: 0,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setTempWeight((w) => w + 2.5)}
                              style={{
                                width: 40,
                                height: 40,
                                background: 'var(--fs-primary)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-accent)',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Reps */}
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              letterSpacing: '0.15em',
                              color: 'var(--fs-heading)',
                              textTransform: 'uppercase',
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            חזרות
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setTempReps((r) => Math.max(0, r - 1))}
                              style={{
                                width: 40,
                                height: 40,
                                background: 'var(--fs-surface)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-heading)',
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={tempReps}
                              onChange={(e) => setTempReps(Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                flex: 1,
                                height: 40,
                                background: 'var(--fs-surface)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                textAlign: 'center',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-heading)',
                                outline: 'none',
                                minWidth: 0,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setTempReps((r) => r + 1)}
                              style={{
                                width: 40,
                                height: 40,
                                background: 'var(--fs-primary)',
                                border: '2px solid var(--fs-primary)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--fs-accent)',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={handleCancel}
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            background: 'var(--fs-surface)',
                            border: '2px solid var(--fs-primary)',
                            borderRadius: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 13,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--fs-heading)',
                          }}
                        >
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            background: 'var(--fs-primary)',
                            border: '2px solid var(--fs-primary)',
                            borderRadius: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 13,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--fs-accent)',
                          }}
                        >
                          שמור
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        direction: 'rtl',
                      }}
                      onClick={() => handleStartEdit(index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isCompleted && (
                          <CheckCircleIcon
                            style={{ width: 20, height: 20, color: 'var(--color-check)' }}
                          />
                        )}
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 15,
                            color: 'var(--fs-heading)',
                          }}
                        >
                          סט {index + 1}
                        </span>
                        {!isCompleted && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              letterSpacing: '0.1em',
                              color: 'var(--fs-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            (טרם הושלם)
                          </span>
                        )}
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 18,
                            color: 'var(--fs-heading)',
                          }}
                        >
                          {set.weight || 0}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--fs-muted)',
                              marginRight: 3,
                            }}
                          >
                            kg
                          </span>
                        </span>
                        <span style={{ color: 'var(--fs-muted)' }}>×</span>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 18,
                            color: 'var(--fs-heading)',
                          }}
                        >
                          {set.reps || 0}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--fs-muted)',
                              marginRight: 3,
                            }}
                          >
                            reps
                          </span>
                        </span>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            background: 'var(--fs-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--fs-muted)',
                            }}
                          >
                            ✎
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
        </motion.div>
      </ModalOverlay>
    );
  }
);

SetEditBottomSheet.displayName = 'SetEditBottomSheet';

export default SetEditBottomSheet;
