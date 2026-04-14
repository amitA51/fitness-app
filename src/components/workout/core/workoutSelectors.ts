import { WorkoutState, WorkoutDerivedValue } from './workoutTypes';
import { createWorkoutSet } from '../../../types';


export const calculateWorkoutDerivedValues = (state: WorkoutState): WorkoutDerivedValue & { duration: number } => {
    const currentExercise = state.exercises[state.currentExerciseIndex];

    // Active Set Index
    const activeSetIndex = currentExercise?.sets?.findIndex(s => !s.completedAt) ?? -1;
    const effectiveSetIndex = activeSetIndex === -1 ? (currentExercise?.sets?.length || 0) : activeSetIndex;

    // Current Set
    const currentSet = currentExercise?.sets?.[effectiveSetIndex] || createWorkoutSet({ reps: 0, weight: 0 }); // fallback

    // Stats
    let completedSetsCount = 0;
    let totalVolume = 0;
    let totalSets = 0;

    state.exercises.forEach(ex => {
        (ex.sets || []).forEach(set => {
            totalSets++;
            if (set.completedAt) {
                completedSetsCount++;
                totalVolume += (set.weight || 0) * (set.reps || 0);
            }
        });
    });

    // Progress
    const progressPercent = totalSets > 0 ? (completedSetsCount / totalSets) * 100 : 0;

    // Duration (in seconds)
    const now = Date.now();
    // If paused, don't count current elapsed time since pause?
    // Simplified: (Now - Start) - TotalPaused
    // Valid only if startTimestamp is set
    let duration = 0;
    if (state.startTimestamp) {
        let elapsed = now - state.startTimestamp;
        if (state.isPaused && state.lastPauseTimestamp) {
            // If currently paused, the time since last pause shouldn't count? 
            // Logic: elapsed includes the current pause duration if we just iterate 'now'.
            // We need to subtract: totalPausedTime + (now - lastPauseTimestamp)
            elapsed -= (state.totalPausedTime + (now - state.lastPauseTimestamp));
        } else {
            elapsed -= state.totalPausedTime;
        }
        duration = Math.max(0, Math.floor(elapsed / 1000));
    }

    return {
        currentExercise,
        activeSetIndex: effectiveSetIndex,
        currentSet,
        completedSetsCount,
        totalSets,
        totalVolume,
        progressPercent,
        duration
    };
};
