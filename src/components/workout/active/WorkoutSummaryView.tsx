import React from 'react';
import { createWorkoutTemplate } from '../../../services/dataService';
import type { WorkoutExercise, WorkoutSession } from '../../../types';

// Lazy loaded
const WorkoutSummary = React.lazy(() => import('../WorkoutSummary'));

interface WorkoutSummaryViewProps {
  completedSession: WorkoutSession;
  onExit: () => void;
}

const WorkoutSummaryView: React.FC<WorkoutSummaryViewProps> = ({ completedSession, onExit }) => (
  <React.Suspense
    fallback={
      <div
        className="fixed inset-0 z-overlay flex items-center justify-center"
        style={{ background: 'var(--fs-bg)' }}
      >
        <div
          style={{
            color: 'var(--fs-heading)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          תוצאות האימון...
        </div>
      </div>
    }
  >
    <WorkoutSummary
      isOpen={true}
      session={completedSession}
      onClose={() => {
        localStorage.removeItem('active_workout_v3_state');
        onExit();
      }}
      onSaveAsTemplate={async () => {
        const defaultName = completedSession.exercises?.[0]?.name || 'My Workout';
        await createWorkoutTemplate({
          name: defaultName,
          description: '',
          exercises: (completedSession.exercises || []).map((ex: WorkoutExercise, idx: number) => ({
            id: ex.id || `ex_${idx}`,
            exerciseId: ex.exerciseId || ex.id || `exercise_${idx}`,
            exerciseName: ex.exerciseName || ex.name || 'Unknown',
            targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
            targetSets: ex.sets?.length || 4,
            targetReps: 10,
            targetWeight: null,
            restSeconds: ex.targetRestTime || ex.restSeconds || 90,
            order: idx,
            notes: '',
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            targetRestTime: ex.targetRestTime,
            tempo: ex.tempo,
            sets: ex.sets?.map((s: { reps: number; weight: number }) => ({
              reps: s.reps,
              weight: s.weight,
            })),
          })),
          muscleGroups: Array.from(
            new Set(
              (completedSession.exercises || [])
                .map((e: WorkoutExercise) => e.muscleGroup)
                .filter(Boolean) as string[]
            )
          ),
          isBuiltin: false,
          updatedAt: new Date().toISOString(),
          lastUsed: null,
          timesUsed: 0,
          isFavorite: false,
        });
      }}
    />
  </React.Suspense>
);

export default React.memo(WorkoutSummaryView);
