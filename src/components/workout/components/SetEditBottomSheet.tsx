// SetEditBottomSheet - Android-style Bottom Sheet for editing completed sets
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import { memo, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CloseIcon, CheckCircleIcon } from '../../icons';
import { ModalOverlay } from '../../ui/ModalOverlay';
import { WorkoutSet } from '../../../types';

// ============================================================
// ANIMATION CONSTANTS (stable references)
// ============================================================

const SHEET_TRANSITION = { type: 'spring' as const, damping: 30, stiffness: 300 };

const CLOSE_BUTTON_HOVER = { scale: 1.1 };
const CLOSE_BUTTON_TAP = { scale: 0.9 };

interface SetEditBottomSheetProps {
    isOpen: boolean;
    sets: WorkoutSet[];
    exerciseName: string;
    onClose: () => void;
    onUpdateSet: (setIndex: number, updates: Partial<WorkoutSet>) => void;
}

/**
 * Generate a stable key for a set based on its content and position
 * This is more stable than index alone when sets are reordered
 */
const getSetKey = (set: WorkoutSet, index: number): string => {
    // Use completedAt timestamp if available (unique for completed sets)
    if (set.completedAt) {
        return `set-${set.completedAt}`;
    }
    // For incomplete sets, use a combination of index and values
    return `set-pending-${index}-${set.weight ?? 0}-${set.reps ?? 0}`;
};

/**
 * SetEditBottomSheet - Android-friendly slide-up sheet for editing completed sets
 * Features:
 * - Slide up from bottom animation
 * - List of all sets with edit capability
 * - Weight and reps adjustment per set
 * - Double-tap protection on save
 * - Portal rendering for proper z-index stacking
 * - Focus trap and scroll lock
 */
const SetEditBottomSheet = memo<SetEditBottomSheetProps>(({
    isOpen,
    sets,
    exerciseName,
    onClose,
    onUpdateSet,
}) => {
    const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
    const [tempWeight, setTempWeight] = useState<number>(0);
    const [tempReps, setTempReps] = useState<number>(0);

    // Start editing a set
    const handleStartEdit = useCallback((index: number) => {
        const set = sets[index];
        if (set) {
            setEditingSetIndex(index);
            setTempWeight(set.weight || 0);
            setTempReps(set.reps || 0);
        }
    }, [sets]);

    // Save edits
    const handleSave = useCallback(() => {
        if (editingSetIndex !== null) {
            onUpdateSet(editingSetIndex, {
                weight: tempWeight,
                reps: tempReps,
            });
            setEditingSetIndex(null);
        }
    }, [editingSetIndex, tempWeight, tempReps, onUpdateSet]);

    // Cancel edit
    const handleCancel = useCallback(() => {
        setEditingSetIndex(null);
    }, []);

    // Weight adjustment handlers (stable references)
    const handleDecreaseWeight = useCallback(() => {
        setTempWeight(w => Math.max(0, w - 2.5));
    }, []);

    const handleIncreaseWeight = useCallback(() => {
        setTempWeight(w => w + 2.5);
    }, []);

    const handleWeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTempWeight(Number(e.target.value));
    }, []);

    // Reps adjustment handlers (stable references)
    const handleDecreaseReps = useCallback(() => {
        setTempReps(r => Math.max(0, r - 1));
    }, []);

    const handleIncreaseReps = useCallback(() => {
        setTempReps(r => r + 1);
    }, []);

    const handleRepsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTempReps(Number(e.target.value));
    }, []);

    // Memoize set keys to prevent recalculation
    const setKeys = useMemo(() =>
        sets.map((set, index) => getSetKey(set, index)),
        [sets]);

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="none"
            zLevel="ultra"
            backdropOpacity={80}
            blur="sm"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel="עריכת סטים"
        >
            {/* Bottom Sheet */}
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={SHEET_TRANSITION}
                className="fixed bottom-0 left-0 right-0 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-t-[32px] max-h-[75vh] overflow-hidden border-t border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-white/20 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pb-4 border-b border-white/5">
                    <div>
                        <h3 className="text-lg font-bold text-white">עריכת סטים</h3>
                        <p className="text-xs text-white/40 mt-0.5">{exerciseName}</p>
                    </div>
                    <motion.button
                        whileHover={CLOSE_BUTTON_HOVER}
                        whileTap={CLOSE_BUTTON_TAP}
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
                    >
                        <CloseIcon className="w-5 h-5 text-white/50" />
                    </motion.button>
                </div>

                {/* Sets List */}
                <div className="p-4 overflow-y-auto max-h-[60vh] overscroll-contain">
                    <div className="space-y-3">
                        {sets.map((set, index) => {
                            const isEditing = editingSetIndex === index;
                            const isCompleted = !!set.completedAt;

                            return (
                                <motion.div
                                    key={setKeys[index]}
                                    layout
                                    className={`
                                        rounded-2xl p-4 transition-all
                                        ${isEditing
                                            ? 'bg-[var(--cosmos-accent-primary)]/10 border-2 border-[var(--cosmos-accent-primary)]/50'
                                            : isCompleted
                                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                : 'bg-white/5 border border-white/10'
                                        }
                                    `}
                                >
                                    {isEditing ? (
                                        /* Edit Mode - Premium Layout */
                                        <div className="space-y-4" dir="rtl">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                                                <span className="text-sm font-bold text-[var(--cosmos-accent-primary)]">
                                                    עריכת סט {index + 1}
                                                </span>
                                            </div>

                                            {/* Inputs Row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Weight Input */}
                                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-2 text-center">
                                                        משקל (ק"ג)
                                                    </label>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            onClick={handleDecreaseWeight}
                                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 active:scale-95 transition-all"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={tempWeight}
                                                            onChange={handleWeightChange}
                                                            className="w-full bg-transparent text-center text-xl font-bold text-white outline-none p-0"
                                                        />
                                                        <button
                                                            onClick={handleIncreaseWeight}
                                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 active:scale-95 transition-all"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Reps Input */}
                                                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-2 text-center">
                                                        חזרות
                                                    </label>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            onClick={handleDecreaseReps}
                                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 active:scale-95 transition-all"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={tempReps}
                                                            onChange={handleRepsChange}
                                                            className="w-full bg-transparent text-center text-xl font-bold text-white outline-none p-0"
                                                        />
                                                        <button
                                                            onClick={handleIncreaseReps}
                                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 active:scale-95 transition-all"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={handleSave}
                                                    className="flex-1 py-2.5 rounded-xl bg-[var(--cosmos-accent-primary)] text-black font-bold text-sm shadow-lg shadow-[var(--cosmos-accent-primary)]/20 active:scale-[0.98] transition-all"
                                                >
                                                    שמור שינויים
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium text-sm hover:bg-white/10 active:scale-[0.98] transition-all"
                                                >
                                                    ביטול
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* View Mode */
                                        <SetViewMode
                                            set={set}
                                            index={index}
                                            isCompleted={isCompleted}
                                            onEdit={handleStartEdit}
                                        />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Safe Area */}
                <div className="h-[env(safe-area-inset-bottom,16px)]" />
            </motion.div>
        </ModalOverlay>
    );
});

/**
 * SetViewMode - Extracted view mode component to avoid inline handlers in map
 */
const SetViewMode = memo<{
    set: WorkoutSet;
    index: number;
    isCompleted: boolean;
    onEdit: (index: number) => void;
}>(({ set, index, isCompleted, onEdit }) => {
    const handleClick = useCallback(() => {
        onEdit(index);
    }, [onEdit, index]);

    return (
        <div
            className="flex items-center justify-between cursor-pointer"
            onClick={handleClick}
        >
            <div className="flex items-center gap-3">
                {isCompleted && (
                    <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                )}
                <div>
                    <span className="text-sm font-bold text-white">
                        סט {index + 1}
                    </span>
                    {!isCompleted && (
                        <span className="text-xs text-white/40 mr-2">(טרם הושלם)</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-left">
                    <div className="text-lg font-bold text-white">
                        {set.weight || 0}
                        <span className="text-xs text-white/40 mr-1">kg</span>
                    </div>
                </div>
                <div className="text-white/20">×</div>
                <div className="text-left">
                    <div className="text-lg font-bold text-white">
                        {set.reps || 0}
                        <span className="text-xs text-white/40 mr-1">reps</span>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <span className="text-white/40 text-xs">✎</span>
                </div>
            </div>
        </div>
    );
});

SetViewMode.displayName = 'SetViewMode';
SetEditBottomSheet.displayName = 'SetEditBottomSheet';

export default SetEditBottomSheet;
