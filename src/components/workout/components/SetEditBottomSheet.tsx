// SetEditBottomSheet — edit completed/pending sets, built on the foundation
// <Sheet>. Migrated off the bespoke ModalOverlay variant="none" + raw motion.div
// sheet: drag handle, header, scroll body, and safe-area come from Sheet. The
// inline edit mode (weight/reps steppers + number inputs) and all save/cancel
// logic are unchanged — this is a chrome + a11y migration, not a behavior change.

import { CheckCircle as CheckCircleIcon, Pencil } from 'lucide-react';
import { memo, useCallback, useId, useMemo, useState } from 'react';
import type { WorkoutSet } from '../../../types';
import { Sheet } from '../../ui/Sheet';

interface SetEditBottomSheetProps {
  isOpen: boolean;
  sets: WorkoutSet[];
  exerciseName: string;
  onClose: () => void;
  onUpdateSet: (setIndex: number, updates: Partial<WorkoutSet>) => void;
}

const getSetKey = (set: WorkoutSet, index: number): string => {
  if (set.completedAt) return `set-${set.completedAt}`;
  return `set-pending-${index}-${set.weight ?? 0}-${set.reps ?? 0}`;
};

const stepperButtonStyle = (accent: boolean): React.CSSProperties => ({
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  background: accent ? 'var(--fs-primary)' : 'var(--fs-surface)',
  border: '2px solid var(--fs-primary)',
  borderRadius: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 18,
  color: accent ? 'var(--fs-accent)' : 'var(--fs-heading)',
});

const SetEditBottomSheet = memo<SetEditBottomSheetProps>(
  ({ isOpen, sets, exerciseName, onClose, onUpdateSet }) => {
    const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
    const [tempWeight, setTempWeight] = useState<number>(0);
    const [tempReps, setTempReps] = useState<number>(0);
    const weightId = useId();
    const repsId = useId();

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
      <Sheet isOpen={isOpen} onClose={onClose} title="עריכת סטים" ariaLabel="עריכת סטים">
        {/* Context line */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
            marginBottom: 12,
            textAlign: 'start',
          }}
        >
          {exerciseName}
        </p>

        {/* Sets List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      ? 'color-mix(in srgb, var(--color-check) 8%, transparent)'
                      : 'var(--fs-surface)',
                  border: `2px solid ${isEditing || !isCompleted ? 'var(--fs-primary)' : 'var(--color-check)'}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                {isEditing ? (
                  /* Edit Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-heading)',
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
                          htmlFor={weightId}
                          style={{
                            display: 'block',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            letterSpacing: '-0.01em',
                            color: 'var(--fs-heading)',
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
                            className="transition-transform active:scale-[0.94]"
                            style={stepperButtonStyle(false)}
                            aria-label="הפחת משקל"
                          >
                            −
                          </button>
                          <input
                            id={weightId}
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            value={tempWeight}
                            onChange={(e) => setTempWeight(Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="משקל בקילוגרמים"
                            style={{
                              flex: 1,
                              height: 44,
                              background: 'var(--fs-surface)',
                              border: '2px solid var(--fs-primary)',
                              borderRadius: 12,
                              textAlign: 'center',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 600,
                              fontSize: 18,
                              color: 'var(--fs-heading)',
                              outline: 'none',
                              minWidth: 0,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setTempWeight((w) => w + 2.5)}
                            className="transition-transform active:scale-[0.94]"
                            style={stepperButtonStyle(true)}
                            aria-label="הגדל משקל"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Reps */}
                      <div>
                        <label
                          htmlFor={repsId}
                          style={{
                            display: 'block',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            letterSpacing: '-0.01em',
                            color: 'var(--fs-heading)',
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
                            className="transition-transform active:scale-[0.94]"
                            style={stepperButtonStyle(false)}
                            aria-label="הפחת חזרות"
                          >
                            −
                          </button>
                          <input
                            id={repsId}
                            type="number"
                            inputMode="numeric"
                            value={tempReps}
                            onChange={(e) => setTempReps(Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="מספר חזרות"
                            style={{
                              flex: 1,
                              height: 44,
                              background: 'var(--fs-surface)',
                              border: '2px solid var(--fs-primary)',
                              borderRadius: 12,
                              textAlign: 'center',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 600,
                              fontSize: 18,
                              color: 'var(--fs-heading)',
                              outline: 'none',
                              minWidth: 0,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setTempReps((r) => r + 1)}
                            className="transition-transform active:scale-[0.94]"
                            style={stepperButtonStyle(true)}
                            aria-label="הגדל חזרות"
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
                          minHeight: 44,
                          padding: '12px 16px',
                          background: 'var(--fs-surface)',
                          border: '2px solid var(--fs-primary)',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 13,
                          letterSpacing: '-0.01em',
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
                          minHeight: 44,
                          padding: '12px 16px',
                          background: 'var(--fs-primary)',
                          border: '2px solid var(--fs-primary)',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 13,
                          letterSpacing: '-0.01em',
                          color: 'var(--fs-accent)',
                        }}
                      >
                        שמור
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      direction: 'rtl',
                    }}
                    onClick={() => handleStartEdit(index)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isCompleted && (
                        <CheckCircleIcon
                          style={{ width: 20, height: 20, color: 'var(--color-check)' }}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 15,
                          color: 'var(--fs-heading)',
                        }}
                      >
                        סט {index + 1}
                      </span>
                      {!isCompleted && (
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            letterSpacing: '-0.01em',
                            color: 'var(--fs-muted)',
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
                          fontWeight: 600,
                          fontSize: 18,
                          color: 'var(--fs-heading)',
                        }}
                      >
                        {set.weight || 0}
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--fs-muted)',
                            marginRight: 3,
                          }}
                        >
                          ק״ג
                        </span>
                      </span>
                      <span style={{ color: 'var(--fs-muted)' }}>×</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
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
                          חזרות
                        </span>
                      </span>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          background: 'var(--fs-surface-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--fs-muted)',
                        }}
                      >
                        <Pencil size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Sheet>
    );
  }
);

SetEditBottomSheet.displayName = 'SetEditBottomSheet';

export default SetEditBottomSheet;
