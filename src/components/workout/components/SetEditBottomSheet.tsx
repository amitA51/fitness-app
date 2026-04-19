// SetEditBottomSheet - Sport Annual Editorial Design
// Sharp corners · Navy header · Bone body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import { memo, useCallback, useMemo, useState } from 'react';
import type { WorkoutSet } from '../../../types';
import { CheckCircleIcon, CloseIcon } from '../../icons';
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
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bone)',
            borderTop: '2px solid var(--navy)',
            maxHeight: '75vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drag Handle */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 48, height: 4, background: 'rgba(20,41,61,0.2)', borderRadius: 2 }} />
          </div>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 16px',
              borderBottom: '1px solid var(--bone-deep)',
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--navy)',
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
                  color: 'var(--stone)',
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
                background: 'var(--bone-deep)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              <CloseIcon style={{ width: 18, height: 18, color: 'var(--navy)' }} />
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
                      ? 'var(--mustard)'
                      : isCompleted
                        ? 'rgba(45,139,78,0.08)'
                        : '#FFFFFF',
                    border: `2px solid ${isEditing ? 'var(--navy)' : isCompleted ? 'var(--color-success)' : 'var(--navy)'}`,
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
                          color: 'var(--navy)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          borderBottom: '1px solid rgba(20,41,61,0.2)',
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
                              color: 'var(--navy)',
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
                                background: 'var(--bone)',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--navy)',
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
                                background: '#FFFFFF',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                textAlign: 'center',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--navy)',
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
                                background: 'var(--navy)',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--mustard)',
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
                              color: 'var(--navy)',
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
                                background: 'var(--bone)',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--navy)',
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
                                background: '#FFFFFF',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                textAlign: 'center',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--navy)',
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
                                background: 'var(--navy)',
                                border: '2px solid var(--navy)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 800,
                                fontSize: 18,
                                color: 'var(--mustard)',
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
                            background: 'var(--bone)',
                            border: '2px solid var(--navy)',
                            borderRadius: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 13,
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
                            padding: '12px 16px',
                            background: 'var(--navy)',
                            border: '2px solid var(--navy)',
                            borderRadius: 0,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 13,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--mustard)',
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
                          <CheckCircleIcon style={{ width: 20, height: 20, color: 'var(--color-success)' }} />
                        )}
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 15,
                            color: 'var(--navy)',
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
                              color: 'var(--stone)',
                              textTransform: 'uppercase',
                            }}
                          >
                            (טרם הושלם)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 18,
                            color: 'var(--navy)',
                          }}
                        >
                          {set.weight || 0}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--stone)',
                              marginRight: 3,
                            }}
                          >
                            kg
                          </span>
                        </span>
                        <span style={{ color: 'var(--stone)' }}>×</span>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 18,
                            color: 'var(--navy)',
                          }}
                        >
                          {set.reps || 0}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: 'var(--stone)',
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
                            background: 'var(--bone-deep)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--stone)',
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
