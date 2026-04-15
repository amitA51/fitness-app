
// ExerciseSelector - ULTRA PREMIUM REDESIGN
// Full-screen bottom sheet with Deep Cosmos aesthetic, mesh gradients, and premium animations
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import React, { useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { PersonalExercise, Exercise, WorkoutGoal, WorkoutTemplate, createWorkoutSet } from '../../../types';
import * as dataService from '../../../services/dataService';
import { CloseIcon } from '../../icons';
import { getWorkoutTemplates } from '../../../services/dataService';
import ExerciseLibraryTab from '../ExerciseLibraryTab';
import WorkoutTemplates from '../WorkoutTemplates';
import { ModalOverlay } from '../../ui/ModalOverlay';

// ============================================================
// TYPES
// ============================================================

interface ExerciseSelectorProps {
    isOpen: boolean;
    onSelect: (exercise: Exercise) => void;
    onClose: () => void;
    onCreateNew: () => void;
    goal?: WorkoutGoal;
}



// ============================================================
// HAPTIC HELPER
// ============================================================

import { triggerHaptic } from '../../../utils/haptics';

// ============================================================
// UNIQUE ID GENERATOR
// ============================================================

const makeExerciseId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `ex-${crypto.randomUUID()}`
        : `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ============================================================
// MAIN COMPONENT
// ============================================================

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
    isOpen,
    onSelect,
    onClose,
    onCreateNew: _onCreateNew,
    goal: _goal,
}) => {
    const [userTemplates, setUserTemplates] = useState<WorkoutTemplate[]>([]);
    const [builtinTemplates, setBuiltinTemplates] = useState<WorkoutTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'exercises' | 'templates'>('exercises');
    const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
    const [pendingExercises, setPendingExercises] = useState<PersonalExercise[]>([]);

    // Animations
    const y = useMotionValue(0);
    const sheetScale = useTransform(y, [0, 300], [1, 0.95]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        try {
            const allTemplates = await getWorkoutTemplates();
            // Separate user templates and built-in templates
            const userT = allTemplates.filter(t => !t.isBuiltin);
            const builtinT = allTemplates.filter(t => t.isBuiltin);
            setUserTemplates(userT);
            setBuiltinTemplates(builtinT);
        } catch {
            // Silently handle template loading errors
        }
    };

    const handleSelect = useCallback((personalExercise: PersonalExercise) => {
        if (!personalExercise.name?.trim()) return;

        triggerHaptic('light');

        // Toggle selection - add to pending or remove from pending
        setSelectedExercises(prev => {
            const next = new Set(prev);
            if (next.has(personalExercise.id)) {
                next.delete(personalExercise.id);
            } else {
                next.add(personalExercise.id);
            }
            return next;
        });

        // Update pending exercises
        setPendingExercises(prev => {
            const exists = prev.find(e => e.id === personalExercise.id);
            if (exists) {
                return prev.filter(e => e.id !== personalExercise.id);
            }
            return [...prev, personalExercise];
        });
    }, []);

    // Confirm selection and add all selected exercises to workout
    const handleConfirmSelection = useCallback(() => {
        if (pendingExercises.length === 0) return;

        triggerHaptic('success');

        // Add all pending exercises to workout
        pendingExercises.forEach(personalExercise => {
            const exercise: Exercise = {
                id: makeExerciseId(),
                name: personalExercise.name,
                muscleGroup: personalExercise.muscleGroup,
                targetRestTime: personalExercise.defaultRestTime || 90,
                sets: Array(personalExercise.defaultSets || 4)
                    .fill(null)
                    .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
            };

            // Fire and forget analytics
            dataService.incrementExerciseUse(personalExercise.id).catch(() => {});

            onSelect(exercise);
        });

        // Clear selection state
        setSelectedExercises(new Set());
        setPendingExercises([]);

        onClose();
    }, [pendingExercises, onSelect, onClose]);

    const handleTemplateSelect = useCallback((template: WorkoutTemplate) => {
        if (!template.exercises || template.exercises.length === 0) return;

        triggerHaptic('success');

        // Add all exercises from template
        template.exercises.forEach(ex => {
            const exercise: Exercise = {
                id: makeExerciseId(),
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                targetRestTime: ex.targetRestTime || 90,
                sets: (ex.sets && ex.sets.length > 0)
                    ? ex.sets.map(s => createWorkoutSet({ reps: s.reps || 0, weight: s.weight || 0 }))
                    : Array(4).fill(null).map(() => createWorkoutSet({ reps: 0, weight: 0 })),
            };
            onSelect(exercise);
        });

        // Clear selection
        setSelectedExercises(new Set());
        setPendingExercises([]);

        // Close modal
        onClose();
    }, [onSelect, onClose]);

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        if (info.offset.y > 150) {
            onClose();
        }
    };

    const handleTabExercises = useCallback(() => {
        triggerHaptic();
        setActiveTab('exercises');
    }, []);

    const handleTabTemplates = useCallback(() => {
        triggerHaptic();
        setActiveTab('templates');
    }, []);

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="none"
            zLevel="extreme"
            backdropOpacity={90}
            blur="xl"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel="בחירת תרגילים"
        >
            <motion.div
                className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-[32px] overflow-hidden bg-[var(--bg-secondary)] border-t border-white/10 max-h-[85vh]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{
                    scale: sheetScale,
                    y,
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
                }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={handleDragEnd}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag Handle */}
                <div className="flex justify-center py-3">
                    <div className="w-10 h-1 rounded-full bg-[var(--gray-500)]" />
                </div>

                {/* Header */}
                <div className="px-5 pb-4 border-b border-white/5 bg-[var(--bg-secondary)] z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">בחר תרגילים</h1>
                            <p className="text-sm text-[var(--gray-500)] mt-0.5">
                                {selectedExercises.size > 0
                                    ? `${selectedExercises.size} תרגילים נבחרו`
                                    : 'לחץ להוספה לאימון'
                                }
                            </p>
                        </div>
                        <motion.button
                            type="button"
                            onClick={onClose}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center hover:bg-[var(--gray-600)] transition-all"
                            aria-label="סגור"
                        >
                            <CloseIcon className="w-4 h-4 text-[var(--gray-500)]" />
                        </motion.button>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={handleTabExercises}
                            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all relative ${
                                activeTab === 'exercises'
                                    ? 'bg-white text-black'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--gray-500)]'
                                }`}
                        >
                            תרגילים
                            {pendingExercises.length > 0 && (
                                <motion.span
                                    key="exercises-badge"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--cosmos-accent-primary)] text-white text-[10px] font-bold flex items-center justify-center"
                                >
                                    {pendingExercises.length}
                                </motion.span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleTabTemplates}
                            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'templates'
                                    ? 'bg-white text-black'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--gray-500)]'
                                }`}
                        >
                            תבניות
                            {(userTemplates.length + builtinTemplates.length) > 0 && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    activeTab === 'templates' ? 'bg-black/10' : 'bg-white/10'
                                    }`}>
                                    {userTemplates.length + builtinTemplates.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative flex flex-col pb-[100px]">
                    {activeTab === 'exercises' ? (
                        <div className="flex-1 overflow-hidden">
                            <ExerciseLibraryTab
                                isSelectionMode={true}
                                onSelect={handleSelect}
                                selectedIds={selectedExercises}
                            />
                        </div>
                    ) : (
                        <div className="pt-4 px-5 h-full overflow-y-auto">
                            <WorkoutTemplates
                                onStartWorkout={handleTemplateSelect}
                                isEmbedded={true}
                                onClose={undefined}
                                userTemplates={userTemplates}
                                builtinTemplates={builtinTemplates}
                            />
                        </div>
                    )}
                </div>

                {/* Footer with Floating Action Button */}
                <AnimatePresence>
                    {pendingExercises.length > 0 && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="absolute bottom-0 inset-x-0 p-5 pt-4"
                            style={{
                                background: 'linear-gradient(to top, rgba(10,10,18,1) 0%, rgba(10,10,18,0.95) 60%, transparent 100%)'
                            }}
                        >
                            <div className="safe-area-bottom">
                                <motion.button
                                    type="button"
                                    onClick={handleConfirmSelection}
                                    whileTap={{ scale: 0.97 }}
                                    className="w-full h-16 rounded-3xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--cosmos-accent-primary) 0%, var(--cosmos-accent-cyan) 100%)',
                                        boxShadow: '0 0 40px rgba(99, 102, 241, 0.5), 0 8px 32px rgba(0,0,0,0.3)',
                                        color: 'white'
                                    }}
                                >
                                    <span className="text-xl">💪</span>
                                    <span>התחל אימון ({pendingExercises.length} תרגילים)</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer - Default state when no selection */}
                <AnimatePresence>
                    {pendingExercises.length === 0 && (
                        <motion.div
                            initial={{ y: 0, opacity: 1 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="absolute bottom-0 inset-x-0 p-5 pt-4 pointer-events-none"
                            style={{
                                background: 'linear-gradient(to top, rgba(10,10,18,1) 0%, rgba(10,10,18,0.95) 60%, transparent 100%)'
                            }}
                        >
                            <div className="safe-area-bottom">
                                <motion.button
                                    type="button"
                                    onClick={onClose}
                                    whileTap={{ scale: 0.97 }}
                                    className="w-full h-16 rounded-3xl font-bold text-lg transition-all flex items-center justify-center gap-3 bg-white/10 text-white/60"
                                >
                                    <span>חזרה לאימון</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Scrollbar and safe area styles */}
                <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 16px); }
        `}</style>
            </motion.div>
        </ModalOverlay>
    );
};

export default ExerciseSelector;
