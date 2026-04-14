// RPEPicker - Premium visual RPE selector with Apple Fitness+ aesthetics
// Replaces native prompt() with a beautiful slider-based bottom sheet
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface RPEPickerProps {
    isOpen: boolean;
    currentValue: number | null | undefined;
    targetRPE?: string;
    onSelect: (rpe: number | null) => void;
    onClose: () => void;
}

const RPE_DATA: { value: number; label: string; color: string; emoji: string; description: string }[] = [
    { value: 1, label: '1', color: '#30D158', emoji: '😴', description: 'מאמץ מינימלי' },
    { value: 2, label: '2', color: '#30D158', emoji: '🙂', description: 'קל מאוד' },
    { value: 3, label: '3', color: '#34C759', emoji: '😊', description: 'קל' },
    { value: 4, label: '4', color: '#34C759', emoji: '😐', description: 'בינוני-קל' },
    { value: 5, label: '5', color: '#FFD60A', emoji: '😤', description: 'בינוני' },
    { value: 6, label: '6', color: '#FFD60A', emoji: '😠', description: 'בינוני-קשה' },
    { value: 7, label: '7', color: '#FF9500', emoji: '💪', description: 'קשה' },
    { value: 8, label: '8', color: '#FF9500', emoji: '🔥', description: 'קשה מאוד' },
    { value: 9, label: '9', color: '#FF453A', emoji: '😰', description: 'כמעט מקסימלי' },
    { value: 10, label: '10', color: '#FF453A', emoji: '💀', description: 'מקסימלי!' },
];

const RPEPicker = memo<RPEPickerProps>(({ isOpen, currentValue, targetRPE, onSelect, onClose }) => {
    const [selected, setSelected] = useState<number | null>(currentValue ?? null);

    const handleSelect = useCallback((value: number) => {
        setSelected(prev => prev === value ? null : value);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([5]);
        }
    }, []);

    const handleConfirm = useCallback(() => {
        onSelect(selected);
        onClose();
    }, [selected, onSelect, onClose]);

    const selectedData = selected ? RPE_DATA.find(r => r.value === selected) : null;

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
            ariaLabel="דירוג מאמץ RPE"
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] rounded-t-3xl border-t border-white/10 pb-safe"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="px-6 pb-4 text-center">
                    <h3 className="text-xl font-bold text-white mb-1">דירוג מאמץ</h3>
                    <p className="text-xs text-white/40">RPE - Rate of Perceived Exertion</p>
                    {targetRPE && (
                        <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                            <span className="text-[10px] text-purple-400/60">יעד:</span>
                            <span className="text-sm font-bold text-purple-400">{targetRPE}</span>
                        </div>
                    )}
                </div>

                {/* RPE Grid */}
                <div className="px-4 pb-4">
                    <div className="grid grid-cols-5 gap-2">
                        {RPE_DATA.map(rpe => {
                            const isSelected = selected === rpe.value;
                            return (
                                <motion.button
                                    key={rpe.value}
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => handleSelect(rpe.value)}
                                    className="relative flex flex-col items-center gap-1 py-3 px-1 rounded-2xl border transition-all"
                                    style={{
                                        backgroundColor: isSelected ? `${rpe.color}15` : 'rgba(255,255,255,0.03)',
                                        borderColor: isSelected ? `${rpe.color}60` : 'rgba(255,255,255,0.05)',
                                        boxShadow: isSelected ? `0 0 20px ${rpe.color}20` : 'none',
                                    }}
                                >
                                    <span className="text-lg">{rpe.emoji}</span>
                                    <span
                                        className="text-lg font-black"
                                        style={{ color: isSelected ? rpe.color : 'rgba(255,255,255,0.5)' }}
                                    >
                                        {rpe.value}
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Description */}
                <AnimatePresence mode="wait">
                    {selectedData && (
                        <motion.div
                            key={selectedData.value}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-center pb-4 px-6"
                        >
                            <span
                                className="text-sm font-bold"
                                style={{ color: selectedData.color }}
                            >
                                {selectedData.emoji} {selectedData.description}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-semibold text-sm"
                    >
                        ביטול
                    </button>
                    {selected && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => { onSelect(null); onClose(); }}
                            className="py-3.5 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm"
                        >
                            נקה
                        </motion.button>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleConfirm}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-[var(--text-primary)]"
                        style={{
                            backgroundColor: selectedData?.color || 'var(--cosmos-accent-primary)',
                            boxShadow: selectedData ? `0 0 20px ${selectedData.color}40` : 'none',
                        }}
                    >
                        אישור
                    </motion.button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
});

RPEPicker.displayName = 'RPEPicker';

export default RPEPicker;
