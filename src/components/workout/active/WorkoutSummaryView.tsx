import React, { useCallback, useRef, useState } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { createWorkoutTemplate } from '../../../services/dataService';
import type { WorkoutExercise, WorkoutSession } from '../../../types';
import { logger } from '../../../utils/logger';

// Lazy loaded
const WorkoutSummary = React.lazy(() => import('../WorkoutSummary'));

interface WorkoutSummaryViewProps {
  completedSession: WorkoutSession;
  onExit: () => void;
}

const WorkoutSummaryView: React.FC<WorkoutSummaryViewProps> = ({ completedSession, onExit }) => {
  // Once a template was saved, the action is hidden — repeat taps were
  // silently creating duplicate templates.
  const [templateSaved, setTemplateSaved] = useState(false);
  const savingRef = useRef(false);

  const handleSaveAsTemplate = useCallback(async () => {
    if (savingRef.current || templateSaved) return;
    savingRef.current = true;
    try {
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
      setTemplateSaved(true);
      showToast('התבנית נשמרה', 'success');
    } catch (err) {
      logger.workout?.error?.('Failed to save workout as template', err);
      showToast('שמירת התבנית נכשלה', { variant: 'error' });
    } finally {
      savingRef.current = false;
    }
  }, [completedSession, templateSaved]);

  return (
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
        onSaveAsTemplate={templateSaved ? undefined : handleSaveAsTemplate}
      />
    </React.Suspense>
  );
};

export default React.memo(WorkoutSummaryView);
