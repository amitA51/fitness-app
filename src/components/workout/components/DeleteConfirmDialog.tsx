import React from 'react';
import { TrashIcon } from '../../icons';
import { PersonalExercise } from '../../../types';

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[13000] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[var(--bg-secondary)] border border-white/10 rounded-3xl p-6 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <TrashIcon className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">למחוק תרגיל?</h3>
        <p className="text-sm text-white/70 mb-1 font-medium">{exercise.name}</p>
        <p className="text-xs text-white/40 mb-6">
          המחיקה תסיר את התרגיל מהספרייה לצמיתות.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-12 rounded-xl bg-red-600/90 text-white font-bold hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all"
          >
            מחק
          </button>
        </div>
      </div>
    </div>
  );
};
