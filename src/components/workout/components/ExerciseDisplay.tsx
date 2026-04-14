// ExerciseDisplay - Ultra Premium Exercise View with Apple Fitness+ aesthetics
// Features: Fluid animations, premium badges, intelligent ghost values, micro-interactions

import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCheckIcon, TrophyIcon, FlameIcon } from '../../icons';
import { Exercise, WorkoutSet } from '../../../types';
import SetInputCard from './SetInputCard';
import SwipeComplete from './SwipeComplete';
import SetEditBottomSheet from './SetEditBottomSheet';
import RPEPicker from './RPEPicker';
import NotesBottomSheet from './NotesBottomSheet';
import AlternativesSheet from './AlternativesSheet';
import { usePreviousData } from '../hooks/usePreviousData';
import { Badge } from './ui/Badge';
import { SetProgress } from './SetProgress';
import { SupersetGroup } from '../core/workoutTypes';


// ============================================================
// TYPES
// ============================================================

interface ExerciseDisplayProps {
    exercise: Exercise;
    displaySetIndex: number;
    currentSet: WorkoutSet;
    prInfo: string;
    onUpdateSet: (field: 'weight' | 'reps', value: number) => void;
    onCompleteSet: () => void;
    onOpenNumpad: (target: 'weight' | 'reps') => void;
    onRenameExercise?: (name: string) => void;
    onEditSet?: (setIndex: number, updates: Partial<WorkoutSet>) => void;
    nameSuggestions?: string[];
    onUpdateNotes?: (notes: string) => void;
    onUpdateRPE?: (rpe: number | null) => void;
    onUndo?: () => void;
    showGhostValues?: boolean;
    enableQuickWeightButtons?: boolean;
    enableQuickRepsButtons?: boolean;
    showVolumePreview?: boolean;
    supersetGroups?: SupersetGroup[];
    onCreateSuperset?: (exerciseId: string) => void;
}

// ============================================================
// QUICK ACTION BUTTON
// ============================================================



// ============================================================
// MAIN COMPONENT
// ============================================================

const ExerciseDisplay = memo<ExerciseDisplayProps>(({
    exercise,
    displaySetIndex,
    currentSet,
    prInfo,
    onUpdateSet,
    onCompleteSet,
    onOpenNumpad,
    onEditSet,
    onUpdateNotes,
    onUpdateRPE,
    onUndo,
    showGhostValues = true,
    enableQuickWeightButtons = true,
    enableQuickRepsButtons = true,
    showVolumePreview = false,
    supersetGroups = [],
    onCreateSuperset,
}) => {

    const [showSetEditor, setShowSetEditor] = useState(false);
    const [showRPEPicker, setShowRPEPicker] = useState(false);
    const [showNotesSheet, setShowNotesSheet] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);

    // Fetch ghost values
    const { previousSets } = usePreviousData(exercise.name);
    const previousSet = previousSets?.[displaySetIndex];

    // Only show ghost if setting is ON and previous data exists
    const showGhostWeight = showGhostValues && !currentSet.weight && !!previousSet?.weight;
    const showGhostReps = showGhostValues && !currentSet.reps && !!previousSet?.reps;

    // Computed values with memoization to prevent unnecessary recalculations
    const completedSetsCount = useMemo(() =>
        exercise.sets?.filter(s => s.completedAt).length || 0,
        [exercise.sets]
    );

    const totalSets = useMemo(() =>
        exercise.sets?.length || 0,
        [exercise.sets]
    );

    const warmupIndices = useMemo(() => {
        const indices = new Set<number>();
        exercise.sets?.forEach((s, i) => {
            if (s.isWarmup) indices.add(i);
        });
        return indices;
    }, [exercise.sets]);

    const hasPR = useMemo(() => prInfo && !prInfo.includes('NO PR'), [prInfo]);

    // Check if this exercise is part of a superset
    const supersetInfo = useMemo(() => {
        if (!exercise?.id || supersetGroups.length === 0) return null;

        const group = supersetGroups.find(g => g.exercises.includes(exercise.id));
        if (!group) return null;

        const position = group.exercises.indexOf(exercise.id) + 1;
        const total = group.exercises.length;

        return {
            groupId: group.id,
            position,
            total,
            restBetweenRounds: group.restBetweenRounds,
        };
    }, [exercise?.id, supersetGroups]);

    const isInSuperset = supersetInfo !== null;
    const supersetPosition = isInSuperset ? `${supersetInfo.position}/${supersetInfo.total}` : null;

    // Stable Handlers for Input Cards
    // These are memoized to prevent cross-card re-renders (changing reps shouldn't re-render weight card)

    const handleRepsTap = React.useCallback(() => onOpenNumpad('reps'), [onOpenNumpad]);

    const handleIncrementReps = React.useCallback(() => {
        onUpdateSet('reps', (currentSet.reps || 0) + 1);
    }, [currentSet.reps, onUpdateSet]);

    const handleDecrementReps = React.useCallback(() => {
        onUpdateSet('reps', Math.max(0, (currentSet.reps || 0) - 1));
    }, [currentSet.reps, onUpdateSet]);

    const handleWeightTap = React.useCallback(() => onOpenNumpad('weight'), [onOpenNumpad]);

    const handleIncrementWeight = React.useCallback(() => {
        onUpdateSet('weight', (currentSet.weight || 0) + 2.5);
    }, [currentSet.weight, onUpdateSet]);

    const handleDecrementWeight = React.useCallback(() => {
        onUpdateSet('weight', Math.max(0, (currentSet.weight || 0) - 2.5));
    }, [currentSet.weight, onUpdateSet]);





    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={exercise.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex-1 flex flex-col items-center justify-center gap-5 px-2 w-full max-w-md mx-auto"
            >
                {/* Exercise Name Section */}
                <div className="text-center w-full">
                    <div
                        key="display"
                        className="flex flex-col items-center gap-3"
                    >
                        {/* Exercise Name */}
                        <div className="flex items-center justify-center gap-3 w-full">
                            <h2
                                className="text-3xl sm:text-5xl font-black text-center leading-tight tracking-tight relative"
                                style={{
                                    background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    textShadow: '0px 2px 20px rgba(0,0,0,0.5)'
                                }}
                            >
                                {exercise.name || 'תרגיל ללא שם'}
                            </h2>
                        </div>

                        {/* Set Progress Dots */}
                        <SetProgress
                            current={displaySetIndex}
                            total={totalSets}
                            completed={completedSetsCount}
                            warmupIndices={warmupIndices}
                        />
                    </div>


                    <div
                        className="mt-4 flex gap-2 justify-center flex-wrap"
                    >
                        {/* Current Set Badge */}
                        <Badge variant="accent">
                            <span className="font-bold">סט {displaySetIndex + 1}</span>
                            <span className="text-white/40 mx-1">/</span>
                            <span className="text-white/60">{totalSets}</span>
                        </Badge>

                        {/* Completed Sets Badge */}
                        {completedSetsCount > 0 && (
                            <Badge
                                variant="success"
                                icon={<CheckCheckIcon className="w-3 h-3" />}
                            >
                                {completedSetsCount} הושלמו
                            </Badge>
                        )}

                        {/* Tempo Badge */}
                        {exercise.tempo && (
                            <Badge variant="purple">
                                <span className="font-mono tracking-widest">{exercise.tempo}</span>
                            </Badge>
                        )}

                        {/* Superset Badge */}
                        {isInSuperset && (
                            <Badge variant="gradient">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="5" cy="12" r="3" />
                                    <circle cx="19" cy="12" r="3" />
                                    <path d="M8 12h8" />
                                </svg>
                                <span className="font-bold">{supersetPosition}</span>
                                <span className="text-white/40">סופרסט</span>
                            </Badge>
                        )}

                        {/* Edit Button */}
                        {completedSetsCount > 0 && onEditSet && (
                            <button
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowSetEditor(true);
                                }}
                                className="
                                        inline-flex items-center gap-1.5 px-3 py-1.5 
                                        rounded-xl spark-glass-light border-glass
                                        text-[var(--cosmos-info)] active:scale-[0.98] active:brightness-90
                                        transition-all shadow-sm
                                    "
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span className="text-xs font-semibold">עריכה</span>
                            </button>
                        )}
                    </div>

                    {/* Program Extras Badges */}
                    {exercise.programExtras && (
                        <div className="mt-3 flex gap-2 justify-center flex-wrap">
                            {/* Warmup Indicator */}
                            {currentSet.isWarmup && (
                                <Badge variant="accent">
                                    <span className="text-orange-400">🔥</span>
                                    <span className="font-bold text-orange-300">חימום</span>
                                </Badge>
                            )}

                            {/* RPE Target */}
                            {exercise.programExtras.rpeTarget && (
                                <Badge variant="purple">
                                    <span className="text-[10px] opacity-60">RPE</span>
                                    <span className="font-bold">{exercise.programExtras.rpeTarget}</span>
                                </Badge>
                            )}

                            {/* Rest Time */}
                            {exercise.programExtras.restTime && (
                                <Badge variant="accent">
                                    <span className="text-[10px] opacity-60">מנוחה</span>
                                    <span className="font-bold">{exercise.programExtras.restTime}</span>
                                </Badge>
                            )}

                            {/* Intensity Technique */}
                            {exercise.programExtras.intensityTechnique && (
                                <Badge variant="purple">
                                    <span className="text-[10px] opacity-60">⚡</span>
                                    <span className="font-bold text-[11px]">{exercise.programExtras.intensityTechnique}</span>
                                </Badge>
                            )}

                            {/* Alternatives */}
                            {exercise.programExtras.alternatives && exercise.programExtras.alternatives.length > 0 && (
                                <button
                                    onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowAlternatives(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl spark-glass-light border-glass text-[var(--cosmos-success)] text-[11px] font-semibold active:scale-[0.98] active:brightness-90 transition-all shadow-sm"
                                >
                                    🔄 חלופות ({exercise.programExtras.alternatives.length})
                                </button>
                            )}
                        </div>
                    )}

                    {/* Program Notes */}
                    {exercise.programExtras?.notes && (
                        <div className="mt-3 px-4 py-2.5 rounded-[16px] spark-glass-light border-glass text-[12px] text-white/80 text-center leading-relaxed shadow-sm font-medium">
                            {exercise.programExtras.notes}
                        </div>
                    )}

                </div>

                {/* Volume Preview */}
                {showVolumePreview && (currentSet.weight || 0) > 0 && (currentSet.reps || 0) > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 font-medium tracking-wide"
                    >
                        VOLUME: <span className="text-white font-bold">{((currentSet.weight || 0) * (currentSet.reps || 0)).toLocaleString()} kg</span>
                    </motion.div>
                )}

                {/* Input Cards */}
                <div
                    className="grid grid-cols-2 gap-4 w-full"
                >
                    <SetInputCard
                        label="חזרות"
                        value={currentSet.reps || 0}
                        ghostValue={previousSet?.reps}
                        showGhost={showGhostReps}
                        icon={
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cosmos-accent-cyan)" strokeWidth="2">
                                <path d="M17 2.1l4 4-4 4" />
                                <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
                                <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
                            </svg>
                        }
                        accentColor="#22d3ee"
                        incrementAmount={1}
                        onTap={handleRepsTap}
                        onIncrement={handleIncrementReps}
                        onDecrement={handleDecrementReps}
                        showButtons={enableQuickRepsButtons}
                    />
                    <SetInputCard
                        label="משקל"
                        value={currentSet.weight || 0}
                        ghostValue={previousSet?.weight}
                        showGhost={showGhostWeight}
                        unit="kg"
                        icon={<FlameIcon className="w-4 h-4 text-[var(--cosmos-accent-orange)]" />}
                        accentColor="#f97316"
                        incrementAmount={2.5}
                        onTap={handleWeightTap}
                        onIncrement={handleIncrementWeight}
                        onDecrement={handleDecrementWeight}
                        showButtons={enableQuickWeightButtons}
                    />
                </div>





                {/* Helper Actions Row - RPE, Notes, Undo */}
                <div
                    className="flex justify-between items-center w-full px-2 mt-4"
                >
                    <div className="flex gap-4">
                        {onUpdateRPE && (
                            <button
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowRPEPicker(true);
                                }}
                                className={`p-2 rounded-full transition-all active:scale-[0.98] active:brightness-90 ${currentSet.rpe ? 'bg-[var(--cosmos-warning)]/20 text-[var(--cosmos-warning)]' : 'text-white/40'
                                    }`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                {currentSet.rpe && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--cosmos-warning)] text-[8px] font-bold text-black flex items-center justify-center">
                                        {currentSet.rpe}
                                    </span>
                                )}
                            </button>
                        )}

                        {onUpdateNotes && (
                            <button
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowNotesSheet(true);
                                }}
                                className={`p-2 rounded-full transition-all active:scale-[0.98] active:brightness-90 relative ${currentSet.notes ? 'bg-[var(--cosmos-accent-secondary)]/20 text-[var(--cosmos-accent-secondary)]' : 'text-white/40'
                                    }`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                {currentSet.notes && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--cosmos-accent-secondary)]" />
                                )}
                            </button>
                        )}
                    </div>

                    {/* Simple PR Badge - Centered */}
                    {hasPR && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--cosmos-warning)]/10 border border-[var(--cosmos-warning)]/20">
                            <TrophyIcon className="w-3 h-3 text-[var(--cosmos-warning)]" />
                            <span className="text-[10px] font-bold text-[var(--cosmos-warning)] tracking-wider">{prInfo}</span>
                        </div>
                    )}

                    {/* Superset Action */}
                    {!isInSuperset && onCreateSuperset && (
                        <button
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onCreateSuperset(exercise.id);
                            }}
                            className="p-2 rounded-full text-white/30 active:text-[#667eea] active:bg-[#667eea]/10 active:scale-[0.98] transition-all"
                            title="צור סופרסט"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="5" cy="12" r="2" />
                                <circle cx="19" cy="12" r="2" />
                                <path d="M8 12h8" />
                                <path d="M12 8v8" />
                            </svg>
                        </button>
                    )}

                    {/* Undo Button - Small Icon */}
                    {completedSetsCount > 0 && onUndo && (
                        <button
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onUndo) onUndo();
                            }}
                            className="p-2 rounded-full text-white/40 active:text-[var(--cosmos-error)] active:bg-[var(--cosmos-error)]/10 active:scale-[0.98] transition-all"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 7v6h6" />
                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                            </svg>
                        </button>
                    )}
                </div>



                {/* Swipe Complete */}
                <div
                    className="w-full mt-2"
                >
                    <SwipeComplete onComplete={onCompleteSet} />
                </div>

                {/* Set Edit Bottom Sheet */}
                {onEditSet && (
                    <SetEditBottomSheet
                        isOpen={showSetEditor}
                        sets={exercise.sets || []}
                        exerciseName={exercise.name || ''}
                        onClose={() => setShowSetEditor(false)}
                        onUpdateSet={onEditSet}
                    />
                )}

                {/* RPE Picker */}
                {onUpdateRPE && (
                    <RPEPicker
                        isOpen={showRPEPicker}
                        currentValue={currentSet.rpe}
                        targetRPE={exercise.programExtras?.rpeTarget as any}
                        onSelect={onUpdateRPE}
                        onClose={() => setShowRPEPicker(false)}
                    />
                )}

                {/* Notes Bottom Sheet */}
                {onUpdateNotes && (
                    <NotesBottomSheet
                        isOpen={showNotesSheet}
                        currentNotes={currentSet.notes || ''}
                        exerciseName={exercise.name || ''}
                        setIndex={displaySetIndex}
                        onSave={onUpdateNotes}
                        onClose={() => setShowNotesSheet(false)}
                    />
                )}

                {/* Alternatives Sheet */}
                {exercise.programExtras?.alternatives && exercise.programExtras.alternatives.length > 0 && (
                    <AlternativesSheet
                        isOpen={showAlternatives}
                        alternatives={exercise.programExtras.alternatives}
                        exerciseName={exercise.name || ''}
                        onClose={() => setShowAlternatives(false)}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
});

ExerciseDisplay.displayName = 'ExerciseDisplay';

export default ExerciseDisplay;
