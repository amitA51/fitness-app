// ExerciseReorder - Android-style Bottom Sheet for exercise management
// Features: Drag-and-drop reordering, expandable sets, inline editing, set deletion
import React, { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, Reorder, useDragControls, AnimatePresence, PanInfo } from 'framer-motion';
import { Exercise, WorkoutSet } from '../../types';
import { DragHandleIcon, CheckCheckIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, CloseIcon } from '../icons';

interface ExerciseReorderProps {
    exercises: Exercise[];
    currentIndex: number;
    onReorder: (exercises: Exercise[]) => void;
    onSelectExercise: (index: number) => void;
    onDeleteExercise?: (index: number) => void;
    onEditSet?: (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number }) => void;
    onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
    onClose: () => void;
}

/**
 * ExerciseReorder - Android-style Bottom Sheet for reordering exercises
 * Now with expandable sets for editing weight/reps and deleting individual sets
 * Uses portal rendering to avoid z-index conflicts
 */
const ExerciseReorder: React.FC<ExerciseReorderProps> = ({
    exercises,
    currentIndex,
    onReorder,
    onSelectExercise,
    onDeleteExercise,
    onEditSet,
    onDeleteSet,
    onClose,
}) => {
    const [items, setItems] = useState(exercises);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

    // Sync items with exercises prop changes (for set edits) while preserving local order
    React.useEffect(() => {
        setItems(currentItems => {
            const exercisesMap = new Map(exercises.map(e => [e.id, e]));

            // Map current items to their updated versions from props
            // If an item no longer exists in props, it will be removed (filter Boolean)
            // If new items were added to props that aren't in currentItems, they won't appear until re-mount 
            // (which is acceptable for this reorder-focused view, or we could append them)
            return currentItems
                .map(item => exercisesMap.get(item.id))
                .filter(Boolean) as Exercise[];
        });
    }, [exercises]);

    const handleReorder = useCallback((newOrder: Exercise[]) => {
        setItems(newOrder);
    }, []);

    const handleSave = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onReorder(items);
        onClose();
    }, [items, onReorder, onClose]);

    const handleClose = useCallback((e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        onClose();
    }, [onClose]);

    const handleDelete = useCallback((index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (deleteConfirm === index) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
            onDeleteExercise?.(index);
            setDeleteConfirm(null);
            if (expandedExercise === index) {
                setExpandedExercise(null);
            } else if (expandedExercise !== null && expandedExercise > index) {
                setExpandedExercise(expandedExercise - 1);
            }
        } else {
            setDeleteConfirm(index);
            setTimeout(() => setDeleteConfirm(null), 3000);
        }
    }, [deleteConfirm, items, onDeleteExercise, expandedExercise]);

    const toggleExpand = useCallback((index: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedExercise(prev => prev === index ? null : index);
    }, []);

    const getCompletedSets = useCallback((exercise: Exercise) => {
        return exercise.sets?.filter(s => s.completedAt).length || 0;
    }, []);

    const getTotalSets = useCallback((exercise: Exercise) => {
        return exercise.sets?.length || 0;
    }, []);

    const getOriginalExerciseIndex = useCallback((exercise: Exercise) => {
        return exercises.findIndex(ex => ex.id === exercise.id);
    }, [exercises]);

    // Handle swipe down to close
    const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.velocity.y > 500 || info.offset.y > 200) {
            onClose();
        }
    }, [onClose]);

    // Render content
    const sheetContent = (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleClose}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
            />

            {/* Bottom Sheet */}
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={handleDragEnd}
                onClick={(e) => e.stopPropagation()}
                className="fixed bottom-0 left-0 right-0 z-[9999] bg-[var(--bg-secondary)] rounded-t-[32px] max-h-[85vh] overflow-hidden border-t border-white/10 shadow-[0_-10px_60px_rgba(0,0,0,0.5)]"
            >
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1 bg-white/20 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pb-4 border-b border-white/5">
                    <div>
                            <h3 className="text-lg font-bold text-white">סדר תרגילים</h3>
                        <p className="text-xs text-[var(--gray-500)] mt-0.5">גרור כדי לשנות סדר • הקש ˅ לעריכת סטים</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-2 rounded-full bg-[var(--cosmos-accent-primary)] text-black text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
                        >
                            שמור
                        </button>
                            <button
                            type="button"
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center hover:bg-[var(--gray-600)] transition-colors"
                        >
                            <CloseIcon className="w-4 h-4 text-[var(--gray-500)]" />
                        </button>
                    </div>
                </div>

                {/* Exercise List */}
                <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)] overscroll-contain workout-scrollable">
                    <Reorder.Group
                        axis="y"
                        values={items}
                        onReorder={handleReorder}
                        className="space-y-3"
                    >
                        {items.map((exercise, index) => (
                            <ExerciseReorderItem
                                key={exercise.id}
                                exercise={exercise}
                                index={index}
                                originalIndex={getOriginalExerciseIndex(exercise)}
                                isActive={index === currentIndex}
                                isExpanded={expandedExercise === index}
                                completedSets={getCompletedSets(exercise)}
                                totalSets={getTotalSets(exercise)}
                                isDeleteConfirm={deleteConfirm === index}
                                onSelect={() => {
                                    onSelectExercise(index);
                                    onClose();
                                }}
                                onDelete={(e) => handleDelete(index, e)}
                                onToggleExpand={(e) => toggleExpand(index, e)}
                                onEditSet={onEditSet}
                                onDeleteSet={onDeleteSet}
                            />
                        ))}
                    </Reorder.Group>

                    {items.length === 0 && (
                        <div className="text-center text-[var(--gray-500)] py-12">
                            <p className="text-lg">אין תרגילים</p>
                            <p className="text-sm mt-1">הוסף תרגילים באימון</p>
                        </div>
                    )}
                </div>

                {/* Bottom Safe Area */}
                <div className="h-[env(safe-area-inset-bottom,16px)]" />
            </motion.div>
        </AnimatePresence>
    );

    // Render via portal to avoid z-index conflicts
    return createPortal(sheetContent, document.body);
};

interface ExerciseReorderItemProps {
    exercise: Exercise;
    index: number;
    originalIndex: number;
    isActive: boolean;
    isExpanded: boolean;
    completedSets: number;
    totalSets: number;
    isDeleteConfirm: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onToggleExpand: (e: React.MouseEvent) => void;
    onEditSet?: (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number }) => void;
    onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
}

const ExerciseReorderItem: React.FC<ExerciseReorderItemProps> = memo(({
    exercise,
    index,
    originalIndex,
    isActive,
    isExpanded,
    completedSets,
    totalSets,
    isDeleteConfirm,
    onSelect,
    onDelete,
    onToggleExpand,
    onEditSet,
    onDeleteSet,
}) => {
    const dragControls = useDragControls();
    const isComplete = completedSets === totalSets && totalSets > 0;

    return (
        <Reorder.Item
            value={exercise}
            dragListener={false}
            dragControls={dragControls}
            className={`relative rounded-2xl overflow-hidden shadow-sm ${isActive
                ? 'bg-[var(--bg-secondary)] ring-1 ring-[#a3e635]'
                : 'bg-[var(--bg-tertiary)]'
                }`}
            whileDrag={{
                scale: 1.02,
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                zIndex: 50
            }}
            layout
        >
            <div className="flex items-center gap-3 p-4">
                {/* Drag Handle */}
                <div
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        dragControls.start(e);
                    }}
                    className="cursor-grab active:cursor-grabbing touch-none p-2 -m-2 rounded-lg hover:bg-white/10"
                >
                    <DragHandleIcon className="w-5 h-5 text-white/40" />
                </div>

                {/* Exercise Number */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isComplete
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isActive
                        ? 'bg-[var(--cosmos-accent-primary)]/30 text-[var(--cosmos-accent-primary)]'
                        : 'bg-white/10 text-white/50'
                    }`}>
                    {isComplete ? <CheckCheckIcon className="w-4 h-4" /> : index + 1}
                </div>

                {/* Exercise Info - Clickable to select */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect();
                    }}
                    className="flex-1 text-right min-w-0"
                >
                    <h3 className={`font-bold truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                        {exercise.name || 'תרגיל ללא שם'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${isComplete ? 'text-emerald-400' : 'text-white/40'}`}>
                            {completedSets}/{totalSets} סטים
                        </span>
                        {exercise.muscleGroup && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-xs text-white/40">{exercise.muscleGroup}</span>
                            </>
                        )}
                        {exercise.programExtras?.rpeTarget && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 font-medium">
                                RPE {exercise.programExtras.rpeTarget}
                            </span>
                        )}
                        {exercise.programExtras?.restTime && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 font-medium">
                                ⏱ {exercise.programExtras.restTime}
                            </span>
                        )}
                        {exercise.programExtras?.notes && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">
                                📝
                            </span>
                        )}
                        {exercise.programExtras?.intensityTechnique && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">
                                {exercise.programExtras.intensityTechnique}
                            </span>
                        )}
                    </div>
                </button>

                {/* Expand Button */}
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className={`p-2.5 rounded-xl transition-all shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${isExpanded
                        ? 'bg-[var(--cosmos-accent-primary)]/20 text-[var(--cosmos-accent-primary)]'
                        : 'bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10'
                        }`}
                >
                    {isExpanded ? (
                        <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                        <ChevronDownIcon className="w-5 h-5" />
                    )}
                </button>

                {/* Delete Button */}
                <button
                    type="button"
                    onClick={onDelete}
                    className={`p-2.5 rounded-xl transition-all shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${isDeleteConfirm
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10'
                        }`}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>

                {/* Active Indicator */}
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--cosmos-accent-primary)]" />
                )}
            </div>

            {/* Expanded Sets List */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2">
                            {exercise.sets && exercise.sets.length > 0 ? (
                                exercise.sets.map((set, setIndex) => (
                                    <SetEditRow
                                        key={`set-${originalIndex}-${setIndex}`}
                                        set={set}
                                        setIndex={setIndex}
                                        exerciseIndex={originalIndex}
                                        canDelete={(exercise.sets?.length || 0) > 1}
                                        onEditSet={onEditSet}
                                        onDeleteSet={onDeleteSet}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-white/30 text-xs py-3">
                                    אין סטים בתרגיל זה
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Overlay */}
            {isDeleteConfirm && (
                <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-red-400 font-semibold bg-red-500/20 px-3 py-1 rounded-full">
                        לחץ שוב למחיקה
                    </span>
                </div>
            )}
        </Reorder.Item>
    );
});

ExerciseReorderItem.displayName = 'ExerciseReorderItem';

// Individual Set Edit Row Component
interface SetEditRowProps {
    set: WorkoutSet;
    setIndex: number;
    exerciseIndex: number;
    canDelete: boolean;
    onEditSet?: (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number }) => void;
    onDeleteSet?: (exerciseIndex: number, setIndex: number) => void;
}

const SetEditRow: React.FC<SetEditRowProps> = memo(({
    set,
    setIndex,
    exerciseIndex,
    canDelete,
    onEditSet,
    onDeleteSet,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempWeight, setTempWeight] = useState(set.weight || 0);
    const [tempReps, setTempReps] = useState(set.reps || 0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

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

    const handleWeightChange = (e: React.MouseEvent, delta: number) => {
        e.preventDefault();
        e.stopPropagation();
        setTempWeight(Math.max(0, tempWeight + delta));
    };

    const handleRepsChange = (e: React.MouseEvent, delta: number) => {
        e.preventDefault();
        e.stopPropagation();
        setTempReps(Math.max(0, tempReps + delta));
    };

    if (isEditing) {
        return (
            <motion.div
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                className="bg-[var(--bg-tertiary)] rounded-2xl p-4 space-y-4 shadow-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                    סט {setIndex + 1} - עריכה
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Weight Input */}
                    <div className="space-y-2">
                        <label className="text-xs text-[var(--gray-500)]">משקל (ק"ג)</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={(e) => handleWeightChange(e, -2.5)}
                                className="w-10 h-10 rounded-xl bg-[var(--gray-600)] text-white font-bold hover:bg-[var(--gray-500)] active:scale-95 transition-all"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                inputMode="decimal"
                                value={tempWeight}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    setTempWeight(Number(e.target.value) || 0);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-10 bg-[var(--bg-secondary)] rounded-xl text-center text-white font-bold text-lg outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                            <button
                                type="button"
                                onClick={(e) => handleWeightChange(e, 2.5)}
                                className="w-10 h-10 rounded-xl bg-[var(--gray-600)] text-white font-bold hover:bg-[var(--gray-500)] active:scale-95 transition-all"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Reps Input */}
                    <div className="space-y-2">
                        <label className="text-xs text-[var(--gray-500)]">חזרות</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={(e) => handleRepsChange(e, -1)}
                                className="w-10 h-10 rounded-xl bg-[var(--gray-600)] text-white font-bold hover:bg-[var(--gray-500)] active:scale-95 transition-all"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={tempReps}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    setTempReps(Number(e.target.value) || 0);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-10 bg-[var(--bg-secondary)] rounded-xl text-center text-white font-bold text-lg outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                            <button
                                type="button"
                                onClick={(e) => handleRepsChange(e, 1)}
                                className="w-10 h-10 rounded-xl bg-[var(--gray-600)] text-white font-bold hover:bg-[var(--gray-500)] active:scale-95 transition-all"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 py-3 rounded-xl bg-[var(--gray-600)] text-white/80 font-semibold active:scale-98 transition-all"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold active:scale-98 transition-all"
                    >
                        שמור
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${isCompleted
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                } ${deleteConfirm ? 'border-red-500/40 bg-red-500/10' : ''}`}
            onClick={handleStartEdit}
        >
            <div className="flex items-center gap-3">
                {isCompleted && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center">
                        <CheckCheckIcon className="w-3 h-3 text-emerald-400" />
                    </div>
                )}
                <div>
                    <span className="text-sm font-bold text-white">
                        סט {setIndex + 1}
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

                {/* Edit Icon */}
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <EditIcon className="w-4 h-4 text-white/40" />
                </div>

                {/* Delete Button */}
                {canDelete && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${deleteConfirm
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10'
                            }`}
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
});

SetEditRow.displayName = 'SetEditRow';

export default memo(ExerciseReorder);
