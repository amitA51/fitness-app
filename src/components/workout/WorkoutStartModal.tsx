// WorkoutStartModal - Premium Apple-style modal for starting workouts
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WorkoutTemplate, WorkoutSession, PersonalExercise } from '../../types';
import * as dataService from '../../services/dataService';
import {
    CloseIcon,
    PlayIcon,
    AddIcon,
    ClockIcon,
    FlameIcon
} from '../icons';
import WorkoutTemplates from './WorkoutTemplates';
import { triggerHaptic } from '../../utils/haptics';
import { ModalOverlay } from '../ui/ModalOverlay';

interface WorkoutStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartFromTemplate: (template: WorkoutTemplate) => void;
    onStartEmpty: () => void;
    onRepeatLastWorkout: (session: WorkoutSession) => void;
    onOpenHistory?: () => void;
}

/**
 * WorkoutStartModal - Premium Apple-style modal
 */
const WorkoutStartModal: React.FC<WorkoutStartModalProps> = ({
    isOpen,
    onClose,
    onStartFromTemplate,
    onStartEmpty,
    onRepeatLastWorkout,
    onOpenHistory,
}) => {
    const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
    const [mostUsedExercises, setMostUsedExercises] = useState<PersonalExercise[]>([]);
    const [activeTab, setActiveTab] = useState<'templates' | 'quick'>('templates');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const sessions = await dataService.getWorkoutSessions(1);
            if (sessions.length > 0 && sessions[0]) {
                setLastSession(sessions[0]);
            }

            const exercises = await dataService.getPersonalExercises();
            const topExercises = exercises.filter(ex => (ex.useCount || 0) > 0).slice(0, 6);
            setMostUsedExercises(topExercises);
        } catch (error) {
            console.error('Failed to load workout start data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'היום';
        if (diffDays === 1) return 'אתמול';
        if (diffDays < 7) return `לפני ${diffDays} ימים`;
        return `לפני ${Math.floor(diffDays / 7)} שבועות`;
    };

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="modal"
            zLevel="extreme"
            backdropOpacity={80}
            blur="md"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel="התחל אימון"
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-t-[32px] sm:rounded-[32px] max-h-[90dvh] overflow-hidden shadow-2xl border-t border-white/10 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 pb-4 border-b border-[var(--gray-600)]">
                    {/* Drag Handle (Mobile) */}
                    <div className="w-10 h-1 bg-[var(--gray-600)] rounded-full mx-auto mb-6 sm:hidden" />

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-white tracking-tight">התחל אימון</h2>
                        <div className="flex items-center gap-2">
                            {onOpenHistory && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onOpenHistory(); }}
                                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onOpenHistory(); }}
                                    className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center hover:bg-[var(--gray-600)] transition-colors cursor-pointer"
                                    aria-label="היסטוריה"
                                >
                                    <ClockIcon className="w-5 h-5 text-[var(--gray-500)]" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onClose(); }}
                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                                    className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center hover:bg-[var(--gray-600)] transition-colors cursor-pointer"
                                    aria-label="סגור"
                            >
                                <CloseIcon className="w-5 h-5 text-[var(--gray-500)]" />
                            </button>
                        </div>
                    </div>

                    {/* Tabs - Apple Segmented Control */}
                    <div className="bg-[var(--bg-tertiary)] p-1 rounded-xl flex">
                        <button
                            type="button"
                            onClick={() => { triggerHaptic('selection'); setActiveTab('templates'); }}
                            onPointerDown={(e) => { e.preventDefault(); triggerHaptic('selection'); setActiveTab('templates'); }}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === 'templates'
                                ? 'bg-[var(--gray-500)] text-white shadow-sm'
                                : 'text-[var(--gray-500)] hover:text-white'
                                }`}
                        >
                            תבניות
                        </button>
                        <button
                            type="button"
                            onClick={() => { triggerHaptic('selection'); setActiveTab('quick'); }}
                            onPointerDown={(e) => { e.preventDefault(); triggerHaptic('selection'); setActiveTab('quick'); }}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeTab === 'quick'
                                ? 'bg-[var(--gray-500)] text-white shadow-sm'
                                : 'text-[var(--gray-500)] hover:text-white'
                                }`}
                        >
                            התחלה מהירה
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-5 overflow-y-auto max-h-[calc(90dvh-140px)] overscroll-contain pb-[calc(1.25rem_+_env(safe-area-inset-bottom))]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-[var(--dynamic-accent-start)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeTab === 'templates' ? (
                        <div className="space-y-4">
                            {/* Repeat Last Workout */}
                            {lastSession && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => { triggerHaptic('medium'); onRepeatLastWorkout(lastSession); }}
                                    onPointerDown={(e) => { e.preventDefault(); triggerHaptic('medium'); onRepeatLastWorkout(lastSession); }}
                                    className="w-full p-4 rounded-xl bg-[var(--bg-tertiary)] active:bg-[var(--gray-600)] transition-colors text-start flex items-center gap-4 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-[var(--dynamic-accent-start)]/10 flex items-center justify-center text-xl">
                                        🔄
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white group-hover:text-[var(--dynamic-accent-start)] transition-colors">
                                            חזור על אימון אחרון
                                        </h3>
                                        <p className="text-xs text-[var(--gray-500)] mt-1">
                                            {lastSession.exercises.length} תרגילים • {formatRelativeTime(lastSession.startTime)}
                                        </p>
                                    </div>
                                </motion.button>
                            )}

                            { /* Templates Component (Replaces manual grid) */}
                            <div className="pt-2">
                                <WorkoutTemplates
                                    onStartWorkout={(t) => {
                                        onStartFromTemplate(t);
                                        // Close modal? usually startWorkout handles navigation.
                                    }}
                                    isEmbedded={true}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Quick Start Tab */
                        <div className="space-y-4">
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onStartEmpty(); }}
                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); triggerHaptic('medium'); onStartEmpty(); }}
                                className="w-full p-5 rounded-2xl bg-[var(--dynamic-accent-start)] text-black active:scale-[0.98] transition-all flex items-center gap-4 group cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center">
                                    <AddIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 text-start">
                                    <h3 className="text-lg font-black">
                                        התחל אימון ריק
                                    </h3>
                                    <p className="text-sm opacity-60 font-medium">
                                        בחר תרגילים תוך כדי תנועה
                                    </p>
                                </div>
                                <PlayIcon className="w-6 h-6 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </motion.button>

                            {/* Most Used Exercises */}
                            {mostUsedExercises.length > 0 && (
                                <div className="space-y-3 pt-4">
                                    <h3 className="text-xs font-bold text-[var(--gray-500)] uppercase tracking-wide px-1 flex items-center gap-2">
                                        <FlameIcon className="w-4 h-4 text-[var(--warning)]" />
                                        הכי בשימוש
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {mostUsedExercises.map((exercise, _index) => (
                                            <div
                                                key={exercise.id}
                                                className="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-transparent"
                                            >
                                                <span className="text-sm font-bold text-white line-clamp-1">
                                                    {exercise.name}
                                                </span>
                                                <span className="text-[10px] text-[var(--gray-500)] block mt-0.5">
                                                    {exercise.useCount || 0} פעמים
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </ModalOverlay>
    );
};

export default React.memo(WorkoutStartModal);
