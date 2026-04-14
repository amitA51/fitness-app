// ExerciseNav - Navigation between exercises with add button
import { memo, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, AddIcon } from '../../icons';
import { Exercise } from '../../../types';

// ============================================================
// ANIMATION CONSTANTS (stable references to prevent re-renders)
// ============================================================

const HOVER_SCALE_UP = { scale: 1.05 };
const HOVER_SCALE_SMALL = { scale: 1.02 };
const HOVER_SCALE_DOT = { scale: 1.3 };
const TAP_SCALE_DOWN = { scale: 0.95 };
const TAP_SCALE_SMALL = { scale: 0.98 };
const TAP_SCALE_DOT = { scale: 0.9 };
const EMPTY_ANIMATION = {};

// ============================================================
// TYPES
// ============================================================

type DotStatus = 'empty' | 'warmup-only' | 'partial' | 'complete';

interface ExerciseNavProps {
    exercises: Exercise[];
    currentIndex: number;
    onChangeExercise: (index: number) => void;
    onOpenDrawer: () => void;
    onAddExercise: () => void;
}

// ============================================================
// DOT COLOR HELPER
// ============================================================

function getDotStatus(exercise: Exercise): DotStatus {
    const sets = exercise.sets || [];
    if (sets.length === 0) return 'empty';

    const completedSets = sets.filter(s => s.completedAt);
    if (completedSets.length === 0) return 'empty';

    const allWarmup = completedSets.every(s => s.isWarmup);
    if (allWarmup) return 'warmup-only';

    const workingSets = sets.filter(s => !s.isWarmup);
    const completedWorking = workingSets.filter(s => s.completedAt);
    if (completedWorking.length >= workingSets.length) return 'complete';

    return 'partial';
}

const DOT_BG: Record<DotStatus, string> = {
    'empty': 'bg-white/20',
    'warmup-only': 'bg-orange-400/50',
    'partial': 'bg-[#30D158]/50',
    'complete': 'bg-[#30D158]',
};

// ============================================================
// COMPONENT
// ============================================================

/**
 * ExerciseNav - Bottom navigation for exercise switching
 * Features:
 * - Prev/Next buttons
 * - Add exercise button
 * - List view button
 * - Progress dots with completion/warmup colors
 * - Keyboard shortcuts (← →)
 */
const ExerciseNav = memo<ExerciseNavProps>(({
    exercises,
    currentIndex,
    onChangeExercise,
    onOpenDrawer,
    onAddExercise,
}) => {
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < exercises.length - 1;

    // Compute dot statuses once
    const dotStatuses = useMemo(() =>
        exercises.map(getDotStatus),
        [exercises]
    );

    // Stable handlers to prevent child re-renders
    const handlePrev = useCallback(() => {
        if (canGoPrev) onChangeExercise(currentIndex - 1);
    }, [canGoPrev, currentIndex, onChangeExercise]);

    const handleNext = useCallback(() => {
        if (canGoNext) onChangeExercise(currentIndex + 1);
    }, [canGoNext, currentIndex, onChangeExercise]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return; // Don't intercept when typing
        }

        if (e.key === 'ArrowLeft' && canGoPrev) {
            onChangeExercise(currentIndex - 1);
        } else if (e.key === 'ArrowRight' && canGoNext) {
            onChangeExercise(currentIndex + 1);
        }
    }, [canGoPrev, canGoNext, currentIndex, onChangeExercise]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="flex items-center justify-between gap-2 pt-4">
            {/* Prev/Next Navigation */}
            <div className="flex gap-2">
                <motion.button
                    whileHover={canGoNext ? HOVER_SCALE_UP : EMPTY_ANIMATION}
                    whileTap={canGoNext ? TAP_SCALE_DOWN : EMPTY_ANIMATION}
                    className={`
                        w-11 h-11 rounded-xl 
                        bg-[var(--cosmos-glass-bg)] border border-[var(--cosmos-glass-border)] 
                        text-[var(--cosmos-text-primary)] 
                        flex items-center justify-center 
                        transition-all
                        ${canGoNext
                            ? 'hover:bg-[var(--cosmos-glass-highlight)] active:scale-90'
                            : 'opacity-40 cursor-not-allowed'
                        }
                    `}
                    disabled={!canGoNext}
                    onPointerDown={(e) => {
                        if (canGoNext) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNext();
                        }
                    }}
                >
                    <ChevronLeftIcon className="w-5 h-5 rotate-180" />
                </motion.button>

                <motion.button
                    whileHover={canGoPrev ? HOVER_SCALE_UP : EMPTY_ANIMATION}
                    whileTap={canGoPrev ? TAP_SCALE_DOWN : EMPTY_ANIMATION}
                    className={`
                        w-11 h-11 rounded-xl 
                        bg-[var(--cosmos-glass-bg)] border border-[var(--cosmos-glass-border)] 
                        text-[var(--cosmos-text-primary)] 
                        flex items-center justify-center 
                        transition-all
                        ${canGoPrev
                            ? 'hover:bg-[var(--cosmos-glass-highlight)] active:scale-90'
                            : 'opacity-40 cursor-not-allowed'
                        }
                    `}
                    disabled={!canGoPrev}
                    onPointerDown={(e) => {
                        if (canGoPrev) {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePrev();
                        }
                    }}
                >
                    <ChevronLeftIcon className="w-5 h-5" />
                </motion.button>

                {/* Progress Dots (only show if <= 8 exercises) */}
                {exercises.length <= 8 && exercises.length > 1 && (
                    <div className="flex items-center gap-1 px-2">
                        {exercises.map((exercise, i) => {
                            const isCurrent = i === currentIndex;
                            const status = dotStatuses[i] ?? 'empty';

                            return (
                                <motion.button
                                    key={exercise.id}
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onChangeExercise(i);
                                    }}
                                    className={`rounded-full transition-all ${isCurrent
                                        ? 'w-3 h-3 bg-[var(--cosmos-accent-primary)] shadow-[0_0_6px_var(--cosmos-accent-primary)]'
                                        : `w-2 h-2 ${DOT_BG[status]} hover:opacity-80`
                                        }`}
                                    whileHover={HOVER_SCALE_DOT}
                                    whileTap={TAP_SCALE_DOT}
                                    title={
                                        status === 'complete' ? 'הושלם' :
                                            status === 'partial' ? 'חלקי' :
                                                status === 'warmup-only' ? 'חימום בלבד' : ''
                                    }
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Exercise Button */}
            <motion.button
                whileHover={HOVER_SCALE_SMALL}
                whileTap={TAP_SCALE_SMALL}
                className="
                    flex-1 max-w-[200px] h-11 
                    rounded-2xl 
                    bg-[var(--cosmos-accent-primary)]/15 
                    border border-[var(--cosmos-accent-primary)]/40 
                    text-[var(--cosmos-accent-primary)] 
                    text-sm font-semibold tracking-wide uppercase 
                    flex items-center justify-center gap-2 
                    shadow-[0_0_20px_rgba(129,140,248,0.2)]
                    hover:bg-[var(--cosmos-accent-primary)]/25 
                    hover:border-[var(--cosmos-accent-primary)]/60 
                    hover:text-white 
                    transition-all
                "
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAddExercise();
                }}
            >
                <AddIcon className="w-4 h-4" />
                הוסף תרגיל
            </motion.button>

            {/* List Button */}
            <motion.button
                whileHover={HOVER_SCALE_UP}
                whileTap={TAP_SCALE_DOWN}
                className="
                    flex items-center gap-2 
                    text-xs text-[var(--cosmos-text-muted)] 
                    hover:text-white 
                    px-4 py-2.5 
                    rounded-xl
                    bg-white/5 border border-white/10
                    transition-all
                    min-h-[44px]
                "
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenDrawer();
                }}
            >
                <div className="w-1 h-1 bg-current rounded-full shadow-[4px_0_0_currentColor,-4px_0_0_currentColor]" />
                <span className="font-medium tracking-wider">LIST</span>
            </motion.button>
        </div>
    );
}, (prev, next) => {
    // Custom comparison — re-render when selection, count, IDs, or completion changes
    if (prev.currentIndex !== next.currentIndex) return false;
    if (prev.exercises.length !== next.exercises.length) return false;

    for (let i = 0; i < prev.exercises.length; i++) {
        if (prev.exercises[i]?.id !== next.exercises[i]?.id) return false;

        // Track completion status changes for dot colors
        const prevCompleted = prev.exercises[i]?.sets?.filter(s => s.completedAt).length || 0;
        const nextCompleted = next.exercises[i]?.sets?.filter(s => s.completedAt).length || 0;
        if (prevCompleted !== nextCompleted) return false;
    }

    return true;
});

ExerciseNav.displayName = 'ExerciseNav';

export default ExerciseNav;
