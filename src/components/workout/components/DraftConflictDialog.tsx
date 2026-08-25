// DraftConflictDialog — Fresh Steel / Obsidian
// Shown when the user asked to start a specific program (initialTemplateId)
// but a restored, unfinished draft already owns the active-workout slot.
// Without this, the stale draft silently hijacked the requested template.
// Backdrop/Escape resolve to "resume" — the safe, non-destructive choice.

import { m } from 'framer-motion';
import { Dumbbell as DumbbellIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface DraftConflictDialogProps {
  isOpen: boolean;
  /** Keep the restored draft and ignore the requested template. */
  onResume: () => void;
  /** Discard the draft and load the requested template fresh. */
  onStartNew: () => void;
}

const DraftConflictDialog = memo<DraftConflictDialogProps>(({ isOpen, onResume, onStartNew }) => {
  const handleResume = useCallback(() => {
    triggerHaptic();
    onResume();
  }, [onResume]);

  const handleStartNew = useCallback(() => {
    triggerHaptic();
    onStartNew();
  }, [onStartNew]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={handleResume}
      variant="modal"
      zLevel="extreme"
      backdropOpacity={80}
      blur="xl"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      initialFocusSelector="[data-safe-action]"
      ariaLabel="אימון פעיל קיים"
    >
      <m.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm overflow-hidden glass-surface accent-glow"
        style={{
          backgroundColor: 'var(--fs-surface)',
          border: '2px solid var(--fs-primary)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(11,26,43,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navy masthead */}
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{ backgroundColor: 'var(--fs-primary)' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              backgroundColor: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              borderRadius: 12,
            }}
          >
            <DumbbellIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div
              className=""
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '-0.01em',
                color: 'var(--fs-accent)',
                fontWeight: 600,
              }}
            >
              אימון פעיל
            </div>
            <h3
              className="mt-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--color-ink-on-dark)',
                lineHeight: 0.95,
              }}
            >
              להמשיך או להתחיל מחדש?
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            className="text-center mb-4"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--fs-muted)',
            }}
          >
            יש אימון פעיל שלא הסתיים — להמשיך אותו או להתחיל את התוכנית החדשה?
          </p>

          <div className="flex flex-col gap-2">
            <m.button
              data-safe-action
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                handleResume();
              }}
              className="btn-primary focus-ring"
              style={{ minHeight: 44 }}
            >
              המשך אימון
            </m.button>

            <m.button
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation();
                handleStartNew();
              }}
              className="btn-secondary focus-ring"
              style={{ minHeight: 44 }}
            >
              התחל חדש
            </m.button>
          </div>
        </div>
      </m.div>
    </ModalOverlay>
  );
});

DraftConflictDialog.displayName = 'DraftConflictDialog';

export default DraftConflictDialog;
