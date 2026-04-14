// PlanEditorModal - Modal for creating and editing workout plans
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import React, { useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { WorkoutTemplate, Exercise, PersonalExercise } from '../../types';
import { CloseIcon, AddIcon, TrashIcon, DumbbellIcon } from '../icons';
import { ModalOverlay } from '../ui/ModalOverlay';
import ExerciseLibraryTab from './ExerciseLibraryTab';

const SaveIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
);

interface PlanEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plan: Partial<WorkoutTemplate>) => Promise<void>;
    initialPlan?: WorkoutTemplate | null;
}

const PlanEditorModal: React.FC<PlanEditorModalProps> = ({ isOpen, onClose, onSave, initialPlan }) => {
    const [name, setName] = useState(initialPlan?.name || '');
    const [exercises, setExercises] = useState<Exercise[]>((initialPlan?.exercises || []) as any);
    const [showLibrary, setShowLibrary] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddExercise = (personalExercise: PersonalExercise) => {
        const newExercise: Exercise = {
            id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: personalExercise.name,
            sets: Array(personalExercise.defaultSets || 3).fill({
                reps: 10,
                weight: 0
            }),
            muscleGroup: personalExercise.muscleGroup,
            targetRestTime: personalExercise.defaultRestTime || 90,
            tempo: personalExercise.tempo,
            notes: personalExercise.notes,
        };

        setExercises([...exercises, newExercise]);
        setShowLibrary(false);
    };

    const handleRemoveExercise = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExercises(exercises.filter(ex => ex.id !== id));
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        try {
            await onSave({
                name,
                exercises: exercises as any,
                muscleGroups: Array.from(new Set(exercises.map(e => e.muscleGroup).filter(Boolean) as string[])),
            });
            onClose();
        } catch (error) {
            console.error('Failed to save plan:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="fullscreen"
            zLevel="extreme"
            backdropOpacity={95}
            blur="md"
            trapFocus
            lockScroll
            closeOnBackdropClick={false}
            closeOnEscape
            ariaLabel={initialPlan ? 'עריכת תוכנית' : 'תוכנית חדשה'}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-4xl h-full md:h-auto md:max-h-[85vh] bg-[var(--bg-secondary)] md:rounded-3xl border-0 md:border border-white/10 flex flex-col overflow-hidden shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                    <h2 className="text-xl font-bold text-white">
                        {initialPlan ? 'עריכת תוכנית' : 'תוכנית חדשה'}
                    </h2>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim()}
                        className={`p-2 rounded-xl flex items-center gap-2 font-bold transition-all ${name.trim()
                            ? 'text-[var(--cosmos-accent-primary)] hover:bg-[var(--cosmos-accent-primary)]/10'
                            : 'text-white/30 cursor-not-allowed'
                            }`}
                    >
                        <span className="hidden sm:inline">{isSaving ? 'שומר...' : 'שמור'}</span>
                        <SaveIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {/* Main Form */}
                    <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all ${showLibrary ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/50 uppercase tracking-wider">שם התוכנית</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="לדוגמה: יום חזה מפלצתי"
                                    className="w-full bg-transparent text-3xl font-bold text-white placeholder-white/20 outline-none border-b border-white/10 focus:border-[var(--cosmos-accent-primary)] transition-colors py-2"
                                    autoFocus={!initialPlan}
                                />
                            </div>

                            {/* Exercises List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                                        תרגילים ({exercises.length})
                                    </label>
                                    <button
                                        onClick={() => setShowLibrary(true)}
                                        className="text-sm font-bold text-[var(--cosmos-accent-primary)] hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        <AddIcon className="w-4 h-4" />
                                        הוסף תרגיל
                                    </button>
                                </div>

                                {exercises.length === 0 ? (
                                    <div
                                        onClick={() => setShowLibrary(true)}
                                        className="h-40 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 cursor-pointer hover:border-[var(--cosmos-accent-primary)]/50 hover:bg-[var(--cosmos-accent-primary)]/5 transition-all group"
                                    >
                                        <DumbbellIcon className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="font-medium">לחץ כאן להוספת תרגילים</span>
                                    </div>
                                ) : (
                                    <Reorder.Group axis="y" values={exercises} onReorder={setExercises} className="space-y-3">
                                        {exercises.map((exercise) => (
                                            <Reorder.Item key={exercise.id} value={exercise}>
                                                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                                                    <div className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60">
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-white">{exercise.name}</h4>
                                                        <div className="flex gap-2 text-xs text-white/50 mt-1">
                                                            <span>{(exercise.sets || []).length} סטים</span>
                                                            <span>•</span>
                                                            <span>{exercise.muscleGroup || 'כללי'}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleRemoveExercise(exercise.id, e)}
                                                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                    </Reorder.Group>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Library Sidebar / Drawer */}
                    <AnimatePresence>
                        {showLibrary && (
                            <motion.div
                                initial={{ x: '100%', opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: '100%', opacity: 0 }}
                                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                                className="absolute inset-0 md:relative md:w-[450px] bg-[var(--bg-primary)] md:border-r border-white/10 z-20 flex flex-col"
                            >
                                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[var(--bg-primary)]">
                                    <h3 className="font-bold text-white">בחר תרגיל להוספה</h3>
                                    <button
                                        onClick={() => setShowLibrary(false)}
                                        className="text-sm text-white/60 hover:text-white"
                                    >
                                        סגור
                                    </button>
                                </div>
                                <div className="flex-1 overflow-hidden p-2">
                                    <ExerciseLibraryTab
                                        onSelect={(ex) => handleAddExercise(ex)}
                                        isSelectionMode={true}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </ModalOverlay>
    );
};

export default PlanEditorModal;
