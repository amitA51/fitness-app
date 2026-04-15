// Extracted from WorkoutSummary.tsx
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TrophyIcon, FlameIcon } from '../../icons';

export interface ExerciseSummaryItemData {
    name: string | undefined;
    setsCompleted: number;
    totalVolume: number;
    bestSet?: { weight: number; reps: number };
    isPR?: boolean;
}

// ============================================================
// EXERCISE SUMMARY ITEM
// ============================================================

interface ExerciseSummaryItemProps {
    name: string;
    setsCompleted: number;
    totalVolume: number;
    bestSet?: { weight: number; reps: number };
    isPR?: boolean;
    delay?: number;
}

export const ExerciseSummaryItem: React.FC<ExerciseSummaryItemProps> = memo(({
    name,
    setsCompleted,
    totalVolume,
    bestSet,
    isPR,
    delay = 0
}) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, type: 'spring', stiffness: 200 }}
        className="relative premium-card p-4"
    >
        {isPR && (
            <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400 }}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
            >
                <TrophyIcon className="w-4 h-4 text-white" />
            </motion.div>
        )}

        <div className="flex justify-between items-start mb-3">
            <h4 className="text-base font-bold text-white leading-tight">{name}</h4>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg font-mono">
                {setsCompleted} sets
            </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
                <FlameIcon className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white/70 font-medium">{totalVolume.toLocaleString()} kg</span>
            </div>
            {bestSet && (
                <div className="flex items-center gap-1.5">
                    <span className="text-white/30">Best:</span>
                    <span className="text-[var(--cosmos-accent-primary)] font-bold">
                        {bestSet.weight}kg × {bestSet.reps}
                    </span>
                </div>
            )}
        </div>
    </motion.div>
);
});

ExerciseSummaryItem.displayName = 'ExerciseSummaryItem';

// ============================================================
// SUMMARY EXERCISE LIST
// ============================================================

export interface SummaryExerciseListProps {
    exercises: ExerciseSummaryItemData[];
    prExercises: Set<string>;
    maxItems?: number;
    startDelay?: number;
}

export const SummaryExerciseList: React.FC<SummaryExerciseListProps> = memo(({
    exercises,
    prExercises,
    maxItems,
    startDelay = 0.5
}) => {
    const displayExercises = maxItems ? exercises.slice(0, maxItems) : exercises;
    const hasMore = maxItems && exercises.length > maxItems;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: startDelay }}
        >
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.15em] mb-3 px-1">
                סיכום תרגילים
            </h3>
            <div className="space-y-2">
                {displayExercises.map((ex, i) => (
                    <ExerciseSummaryItem
                        key={ex.name ?? ''}
                        name={ex.name ?? ''}
                        setsCompleted={ex.setsCompleted}
                        totalVolume={ex.totalVolume}
                        bestSet={ex.bestSet}
                        isPR={prExercises.has(ex.name ?? '')}
                        delay={startDelay + i * 0.08}
                    />
                ))}
                {hasMore && (
                    <p className="text-center text-xs text-white/30 pt-2">
                        + {exercises.length - maxItems!} תרגילים נוספים
                    </p>
                )}
            </div>
        </motion.div>
    );
});

SummaryExerciseList.displayName = 'SummaryExerciseList';