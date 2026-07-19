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
            border: '2px solid var(--fs-primary)',
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
              color: 'var(--fs-accent)',
            }}
          >
            סט {setIndex + 1} — עריכה
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label
                htmlFor={weightId}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: 'var(--fs-muted)',
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
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-primary)',
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
                    border: '2px solid var(--fs-primary)',
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
                    background: 'var(--fs-primary)',
                    border: '2px solid var(--fs-primary)',
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
            <div>
              <label
                htmlFor={repsId}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  color: 'var(--fs-muted)',
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
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-primary)',
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
                    border: '2px solid var(--fs-primary)',
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
                    background: 'var(--fs-primary)',
                    border: '2px solid var(--fs-primary)',
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
                border: '2px solid var(--fs-primary)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: '0.06em',
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
                border: '2px solid var(--fs-primary)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: '0.06em',
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
                letterSpacing: '0.1em',
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
