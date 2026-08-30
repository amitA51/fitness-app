import { Check as CheckCheckIcon, Edit as EditIcon, Trash2 as TrashIcon } from 'lucide-react';
import type React from 'react';
import { memo, useId, useState } from 'react';
import type { WorkoutSet } from '../../../types';

export interface SetEditRowProps {
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

export const SetEditRow: React.FC<SetEditRowProps> = memo(
  ({ set, setIndex, exerciseIndex, canDelete, onEditSet, onDeleteSet }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempWeight, setTempWeight] = useState(set.weight || 0);
    const [tempReps, setTempReps] = useState(set.reps || 0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const weightId = useId();
    const repsId = useId();

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
        // biome-ignore lint/a11y/useKeyWithClickEvents: onClick only calls e.stopPropagation(); not an interactive control
        <div
          style={{
            background: 'var(--fs-surface-2)',
            // --fs-edge, not --fs-primary: this 2px rule is the only thing marking
            // "this set is open for editing" against the --fs-surface card behind
            // it. --fs-primary read 1.05:1 there in dark and 1.06:1 in dark+HC, so
            // the whole edit panel had no boundary. --fs-edge is 4.10:1 / 21:1.
            border: '2px solid var(--fs-edge)',
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
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent)',
            }}
          >
            סט {setIndex + 1} — עריכה
          </div>

          {/* minmax(0,1fr), not 1fr: a bare `1fr` is `minmax(auto,1fr)`, so each
              column is floored at its MIN-CONTENT — and a <input type="number">
              carries a wide intrinsic default width. Two of those plus four 36px
              steppers forced the row past the viewport and the ק״ג column ran off
              the screen edge. minmax(0,…) lets the columns actually shrink; the
              `minWidth: 0` chain below lets that shrink reach the inputs. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label
                htmlFor={weightId}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                ק"ג
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
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
                    flexShrink: 0,
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-heading)',
                  }}
                >
                  −
                </button>
                <input
                  id={weightId}
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
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-heading)',
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
                    flexShrink: 0,
                    // Fill stays --fs-primary: the glyph on it is --fs-accent, and
                    // accent ink measures 3.11:1 (dark) / 1.25:1 (both HC) on
                    // --fs-edge and 1.00:1 on --fs-panel over this --fs-surface-2
                    // panel. Converting the fill breaks the label; the 2px --fs-edge
                    // ring below is what restores the button's outer boundary
                    // (1.31:1 -> 3.89:1 in dark).
                    background: 'var(--fs-primary)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-accent)',
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <label
                htmlFor={repsId}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                חזרות
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
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
                    flexShrink: 0,
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-heading)',
                  }}
                >
                  −
                </button>
                <input
                  id={repsId}
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
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-heading)',
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
                    flexShrink: 0,
                    // Fill stays --fs-primary: the glyph on it is --fs-accent, and
                    // accent ink measures 3.11:1 (dark) / 1.25:1 (both HC) on
                    // --fs-edge and 1.00:1 on --fs-panel over this --fs-surface-2
                    // panel. Converting the fill breaks the label; the 2px --fs-edge
                    // ring below is what restores the button's outer boundary
                    // (1.31:1 -> 3.89:1 in dark).
                    background: 'var(--fs-primary)',
                    border: '2px solid var(--fs-edge)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--fs-accent)',
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
                background: 'var(--fs-surface-2)',
                border: '2px solid var(--fs-edge)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
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
                padding: '10px 16px',
                background: 'var(--fs-accent)',
                // --fs-primary, NOT --fs-edge: this button's own fill is the mint,
                // which stays bright in all four states, so the near-black ring
                // reads at 7.16:1 (light) to 15.85:1 (dark+HC) against it. --fs-edge
                // is rgba(255,255,255,.42) in dark and composites to 1.24:1 over the
                // mint — the ring would vanish. Do not sweep this one with the rest.
                border: '2px solid var(--fs-primary)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: '-0.01em',
                color: 'var(--fs-heading)',
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
          background: isCompleted ? 'var(--color-success-muted)' : 'var(--fs-surface)',
          border: `1px solid ${isCompleted ? 'var(--color-success)' : 'var(--fs-surface-2)'}`,
          borderRadius: 12,
          cursor: 'pointer',
          direction: 'rtl',
        }}
        role="button"
        tabIndex={0}
        onClick={handleStartEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStartEdit(e as unknown as React.MouseEvent);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCompleted && (
            <CheckCheckIcon style={{ width: 16, height: 16, color: 'var(--color-check)' }} />
          )}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--fs-heading)',
            }}
          >
            סט {setIndex + 1}
          </span>
          {!isCompleted && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
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
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--fs-heading)',
            }}
          >
            {set.weight || 0}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                marginRight: 2,
              }}
            >
              kg
            </span>
          </span>
          <span style={{ color: 'var(--fs-muted)', fontSize: 12 }}>×</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--fs-heading)',
            }}
          >
            {set.reps || 0}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                marginRight: 2,
              }}
            >
              reps
            </span>
          </span>
          <EditIcon style={{ width: 14, height: 14, color: 'var(--fs-muted)' }} />
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label={deleteConfirm ? 'אישור מחיקת סט' : 'מחק סט'}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: deleteConfirm ? 'rgba(196,43,43,0.12)' : 'transparent',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              <TrashIcon
                style={{
                  width: 14,
                  height: 14,
                  color: deleteConfirm ? 'var(--fs-warn)' : 'var(--fs-muted)',
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
