import { m } from 'framer-motion';
import { X as CloseIcon, Dumbbell as DumbbellIcon } from 'lucide-react';
// ConfirmExitOverlay - Confirmation dialog for finishing/canceling workout
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
// Fresh Steel / Obsidian: primary masthead + surface body, sharp corners, editorial typography
import { memo, useCallback } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { ModalOverlay } from '../../ui/ModalOverlay';

// ============================================================
// TYPES
// ============================================================

interface ConfirmExitOverlayProps {
  isOpen: boolean;
  intent: 'finish' | 'cancel';
  workoutStats: {
    completedSets: number;
    totalVolume: number;
    duration: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  onSaveAsTemplate?: () => void;
  onCooldown?: () => void;
  isSaving?: boolean;
  saveError?: string | null;
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * ConfirmExitOverlay - Confirmation for finishing/canceling workout
 * Features:
 * - Shows workout stats
 * - Option to save as template
 * - Cancel protection
 * - Portal rendering with focus trap and scroll lock
 */
const ConfirmExitOverlay = memo<ConfirmExitOverlayProps>(
  ({
    isOpen,
    intent,
    workoutStats,
    onConfirm,
    onCancel,
    onSaveAsTemplate,
    onCooldown,
    isSaving = false,
    saveError = null,
  }) => {
    const handleConfirm = useCallback(() => {
      if (isSaving) {
        return; // Prevent double-click
      }
      triggerHaptic();
      onConfirm();
    }, [onConfirm, isSaving]);

    const handleCancel = useCallback(() => {
      triggerHaptic();
      onCancel();
    }, [onCancel]);

    const handleCooldown = useCallback(() => {
      triggerHaptic();
      onCooldown?.();
    }, [onCooldown]);

    const isFinishing = intent === 'finish';

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={handleCancel}
        variant="modal"
        zLevel="extreme"
        backdropOpacity={80}
        blur="xl"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        // Destructive confirm (cancel intent): focus lands on the safe "חזור"
        // so Enter doesn't discard the session by default.
        initialFocusSelector={isFinishing ? undefined : '[data-safe-action]'}
        ariaLabel={isFinishing ? 'סיום אימון' : 'ביטול אימון'}
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
            borderRadius: 0,
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
                backgroundColor: isFinishing ? 'var(--fs-accent)' : 'var(--fs-warn)',
                color: 'var(--color-ink-on-accent)',
                borderRadius: 0,
              }}
            >
              {isFinishing ? (
                <DumbbellIcon className="w-6 h-6" />
              ) : (
                <CloseIcon className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  color: 'var(--fs-accent)',
                  fontWeight: 600,
                }}
              >
                {isFinishing ? 'סיום · אימון' : 'ביטול · אימון'}
              </div>
              <h3
                className="uppercase mt-1"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                  // ink-on-dark, not fs-ink — fs-ink is 1.07:1 on the navy masthead in light
                  color: 'var(--color-ink-on-dark)',
                  lineHeight: 0.95,
                }}
              >
                {isFinishing ? 'סיים אימון?' : 'לבטל אימון?'}
              </h3>
            </div>
          </div>

          {/* Bone body */}
          <div className="px-6 py-5">
            {/* Description */}
            <p
              className="text-center mb-4"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--fs-muted)',
              }}
            >
              {isFinishing ? 'האימון יישמר בהיסטוריה שלך' : 'כל ההתקדמות תאבד'}
            </p>

            {/* Stats (only for finishing) */}
            {isFinishing && (
              <div
                className="grid grid-cols-3 mb-4"
                style={{
                  border: '2px solid var(--fs-primary)',
                  backgroundColor: 'var(--fs-surface)',
                }}
              >
                <div
                  className="text-center p-3"
                  style={{ borderRight: '2px solid var(--fs-primary)' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '32px',
                      fontWeight: 800,
                      color: 'var(--fs-heading)',
                      lineHeight: 0.9,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {workoutStats.completedSets}
                  </div>
                  <div
                    className="uppercase mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    סטים
                  </div>
                </div>
                <div
                  className="text-center p-3"
                  style={{ borderRight: '2px solid var(--fs-primary)' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '32px',
                      fontWeight: 800,
                      color: 'var(--fs-heading)',
                      lineHeight: 0.9,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {workoutStats.totalVolume.toLocaleString()}
                  </div>
                  <div
                    className="uppercase mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    ק״ג
                  </div>
                </div>
                <div className="text-center p-3">
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '32px',
                      fontWeight: 800,
                      color: 'var(--fs-heading)',
                      lineHeight: 0.9,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {workoutStats.duration}
                  </div>
                  <div
                    className="uppercase mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    זמן
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div
                role="alert"
                className="p-3 mb-4"
                style={{
                  backgroundColor: 'var(--color-warning-muted)',
                  border: '1px solid var(--fs-warn)',
                  borderRadius: 0,
                }}
              >
                <p
                  className="text-center uppercase"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    color: 'var(--fs-warn)',
                    fontWeight: 600,
                  }}
                >
                  {saveError}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <m.button
                whileHover={!isSaving ? { scale: 1.005 } : undefined}
                whileTap={!isSaving ? { scale: 0.98 } : undefined}
                onClick={(e) => {
                  if (!isSaving) {
                    e.stopPropagation();
                    handleConfirm();
                  }
                }}
                disabled={isSaving}
                className="btn-primary focus-ring flex items-center justify-center gap-2"
                style={{
                  backgroundColor: isFinishing ? 'var(--fs-primary)' : 'var(--color-error)',
                  color: isFinishing ? 'var(--fs-accent)' : 'var(--color-ink-on-error)',
                  opacity: isSaving ? 0.7 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  minHeight: 44,
                }}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>שומר...</span>
                  </>
                ) : isFinishing ? (
                  'סיים ושמור'
                ) : (
                  'בטל אימון'
                )}
              </m.button>

              {isFinishing && onCooldown && (
                <m.button
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCooldown();
                  }}
                  className="btn-secondary focus-ring"
                  style={{ minHeight: 44 }}
                >
                  צינון מודרך לפני סיום
                </m.button>
              )}

              {isFinishing && onSaveAsTemplate && (
                <m.button
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsTemplate();
                  }}
                  className="btn-secondary focus-ring"
                  style={{ minHeight: 44 }}
                >
                  שמור כתבנית
                </m.button>
              )}

              <m.button
                data-safe-action
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="focus-ring uppercase transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--fs-muted)',
                  padding: '14px 24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                חזור
              </m.button>
            </div>
          </div>
        </m.div>
      </ModalOverlay>
    );
  }
);

ConfirmExitOverlay.displayName = 'ConfirmExitOverlay';

export default ConfirmExitOverlay;
