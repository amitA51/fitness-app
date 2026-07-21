// DeleteConfirmDialog — confirm deleting a personal-library exercise.
// Migrated onto the foundation <ConfirmDialog> (danger variant). The public
// `exercise`-based API is preserved so the ExerciseLibraryTab call site is
// unchanged; visibility is driven by `exercise !== null`, the name is folded
// into the description, and the destructive action uses the danger styling.

import type React from 'react';
import type { PersonalExercise } from '../../../types';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

interface DeleteConfirmDialogProps {
  exercise: PersonalExercise | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  errorMessage?: string | null;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  exercise,
  onConfirm,
  onCancel,
  isDeleting = false,
  errorMessage,
}) => (
  <ConfirmDialog
    isOpen={!!exercise}
    onConfirm={onConfirm}
    onCancel={onCancel}
    variant="danger"
    title="למחוק תרגיל?"
    description={`${exercise?.name ?? ''}. המחיקה תסיר את התרגיל מהספרייה לצמיתות.`}
    confirmLabel="מחקו תרגיל"
    cancelLabel="ביטול"
    isPending={isDeleting}
    pendingLabel="מוחק…"
    errorMessage={errorMessage ?? undefined}
  />
);

export default DeleteConfirmDialog;
