// AlternativesSheet - Premium alternative exercises bottom sheet
// Replaces native alert() with an interactive exercise selection panel
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface AlternativesSheetProps {
    isOpen: boolean;
    alternatives: string[];
    exerciseName: string;
    onSelect?: (altName: string) => void;
    onClose: () => void;
}

const AlternativesSheet = memo<AlternativesSheetProps>(({ isOpen, alternatives, exerciseName, onSelect, onClose }) => {
    const handleSelect = useCallback((name: string) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([10]);
        }
        onSelect?.(name);
        onClose();
    }, [onSelect, onClose]);

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="none"
            zLevel="high"
            backdropOpacity={70}
            blur="sm"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel={`תרגילים חלופיים ל${exerciseName}`}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] rounded-t-3xl border-t border-white/10 pb-safe max-h-[70vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="px-6 pb-4 text-center flex-shrink-0">
                    <h3 className="text-xl font-bold text-white mb-1">תרגילים חלופיים</h3>
                    <p className="text-xs text-white/40">במקום {exerciseName}</p>
                </div>

                {/* Alternatives List */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="space-y-2">
                        {alternatives.map((alt, idx) => (
                            <motion.button
                                key={alt}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelect(alt)}
                                className="
                                    w-full flex items-center gap-3 p-4 rounded-2xl
                                    bg-white/3 border border-white/5
                                    hover:bg-white/8 hover:border-white/15
                                    transition-all text-right group
                                "
                            >
                                {/* Number */}
                                <div className="w-8 h-8 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--success)]/20 transition-colors">
                                    <span className="text-xs font-bold text-[var(--success)]">{idx + 1}</span>
                                </div>

                                {/* Name */}
                                <span className="flex-1 text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                                    {alt}
                                </span>

                                {/* Arrow */}
                                {onSelect && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 group-hover:text-[var(--success)] transition-colors flex-shrink-0">
                                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Close */}
                <div className="px-6 pb-8 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-semibold text-sm"
                    >
                        סגור
                    </button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
});

AlternativesSheet.displayName = 'AlternativesSheet';

export default AlternativesSheet;
