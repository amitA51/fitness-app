// DeleteConfirmDialog - Sport Annual Editorial Design
// Sharp corners · Navy header · Bone body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import type React from 'react';
import type { PersonalExercise } from '../../../types';
import { TrashIcon } from '../../icons';

interface DeleteConfirmDialogProps {
  exercise: PersonalExercise | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  exercise,
  onConfirm,
  onCancel,
}) => {
  if (!exercise) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,26,43,0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 13000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bone)',
          border: '2px solid var(--navy)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            background: 'rgba(196,43,43,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <TrashIcon style={{ width: 32, height: 32, color: 'var(--color-error)' }} />
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 20,
            color: 'var(--navy)',
            marginBottom: 8,
          }}
        >
          למחוק תרגיל?
        </h3>

        {/* Name */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            color: 'var(--ink)',
            marginBottom: 4,
          }}
        >
          {exercise.name}
        </p>

        {/* Description */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--stone)',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          המחיקה תסיר את התרגיל מהספרייה לצמיתות.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'var(--bone-deep)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--navy)',
              minHeight: 48,
            }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'var(--color-error)',
              border: '2px solid var(--color-error)',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              minHeight: 48,
            }}
          >
            מחק
          </button>
        </div>
      </div>
    </div>
  );
};
