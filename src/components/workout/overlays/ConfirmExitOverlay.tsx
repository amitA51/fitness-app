// ConfirmExitOverlay - Confirmation dialog for finishing/canceling workout
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DumbbellIcon, CloseIcon } from '../../icons';
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
const ConfirmExitOverlay = memo<ConfirmExitOverlayProps>(({
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
            ariaLabel={isFinishing ? 'סיום אימון' : 'ביטול אימון'}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-sm bg-[var(--cosmos-bg-primary)] border border-[var(--cosmos-glass-border)] rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isFinishing
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                        }`}>
                        {isFinishing ? (
                            <DumbbellIcon className="w-8 h-8" />
                        ) : (
                            <CloseIcon className="w-8 h-8" />
                        )}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-center mb-2">
                    {isFinishing ? 'סיים אימון?' : 'לבטל אימון?'}
                </h3>

                {/* Description */}
                <p className="text-[var(--cosmos-text-muted)] text-center text-sm mb-4">
                    {isFinishing
                        ? 'האימון יישמר בהיסטוריה שלך'
                        : 'כל ההתקדמות תאבד'
                    }
                </p>

                {/* Stats (only for finishing) */}
                {isFinishing && (
                    <div className="bg-[var(--cosmos-glass-bg)] rounded-2xl p-4 mb-4 grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-2xl font-bold text-[var(--cosmos-accent-primary)]">
                                {workoutStats.completedSets}
                            </div>
                            <div className="text-[10px] text-[var(--cosmos-text-muted)] uppercase">סטים</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-[var(--cosmos-accent-cyan)]">
                                {workoutStats.totalVolume.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-[var(--cosmos-text-muted)] uppercase">ק״ג</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-[var(--cosmos-accent-secondary)]">
                                {workoutStats.duration}
                            </div>
                            <div className="text-[10px] text-[var(--cosmos-text-muted)] uppercase">זמן</div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {saveError && (
                    <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 mb-4">
                        <p className="text-red-400 text-sm text-center">{saveError}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <motion.button
                        whileHover={!isSaving ? { scale: 1.02 } : undefined}
                        whileTap={!isSaving ? { scale: 0.98 } : undefined}
                        onClick={(e) => {
                            if (!isSaving) {
                                e.stopPropagation();
                                handleConfirm();
                            }
                        }}
                        disabled={isSaving}
                        className={`w-full py-3.5 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 ${isFinishing
                            ? 'bg-emerald-500 hover:bg-emerald-400'
                            : 'bg-red-500 hover:bg-red-400'
                            } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>שומר...</span>
                            </>
                        ) : (
                            isFinishing ? 'סיים ושמור' : 'בטל אימון'
                        )}
                    </motion.button>

                    {isFinishing && onCooldown && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCooldown();
                            }}
                            className="w-full py-3.5 rounded-2xl font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 transition-all"
                        >
                            צינון מודרך לפני סיום
                        </motion.button>
                    )}

                    {isFinishing && onSaveAsTemplate && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSaveAsTemplate();
                            }}
                            className="w-full py-3.5 rounded-2xl font-bold bg-[var(--cosmos-accent-primary)]/20 text-[var(--cosmos-accent-primary)] border border-[var(--cosmos-accent-primary)]/40 hover:bg-[var(--cosmos-accent-primary)]/30 transition-all"
                        >
                            שמור כתבנית
                        </motion.button>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCancel();
                        }}
                        className="w-full py-3.5 rounded-2xl font-semibold text-[var(--cosmos-text-muted)] hover:text-white hover:bg-white/5 transition-all"
                    >
                        חזור
                    </motion.button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
});

ConfirmExitOverlay.displayName = 'ConfirmExitOverlay';

export default ConfirmExitOverlay;
