/**
 * Built-in Workout Templates
 *
 * Hardcoded Hebrew starter workout templates and the helper that converts them
 * into the app's `WorkoutTemplate` shape.
 */

import type { WorkoutTemplate } from '../types';

export interface BuiltInTemplateExercise {
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: number;
  targetRestTime: number;
}

export interface BuiltInWorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: BuiltInTemplateExercise[];
  muscleGroups: string[];
  icon: string;
}

export const getBuiltInWorkoutTemplates = (): BuiltInWorkoutTemplate[] => [
  {
    id: 'builtin-full-body',
    name: 'אימון כללי',
    description: 'אימון גוף מלא - כל השרירים הגדולים',
    exercises: [
      {
        name: 'סקוואט | Back Squat',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'לחיצת חזה | Bench Press',
        muscleGroup: 'Chest',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'מתח | Pull Up',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'לחיצת כתפיים | Overhead Press',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'כפיפת מוט | Barbell Curl',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'פשיטת מרפקים בכבל | Tricep Pushdown',
        muscleGroup: 'Triceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'פלאנק | Plank',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 60,
        targetRestTime: 45,
      },
    ],
    muscleGroups: ['חזה', 'גב', 'רגליים', 'כתפיים', 'יד קדמית', 'יד אחורית', 'בטן'],
    icon: '§',
  },
  {
    id: 'builtin-chest-shoulders',
    name: 'חזה + כתפיים',
    description: 'דגש על חזה וכתפיים - פיתוח רוחב ועומק',
    exercises: [
      {
        name: 'לחיצת חזה | Bench Press',
        muscleGroup: 'Chest',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'לחיצת חזה בשיפוע חיובי | Incline Dumbbell Press',
        muscleGroup: 'Chest',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'פרפר בכבלים | Cable Fly',
        muscleGroup: 'Chest',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'לחיצת כתפיים | Overhead Press',
        muscleGroup: 'Shoulders',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'הרחקה לצדדים | Dumbbell Lateral Raise',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'פרפר הפוך במכונה | Reverse Pec Deck',
        muscleGroup: 'Shoulders',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['חזה', 'כתפיים'],
    icon: '§',
  },
  {
    id: 'builtin-back-arms',
    name: 'גב + זרועות',
    description: 'רחב גבי ובידוד ידיים - מראה V',
    exercises: [
      {
        name: 'מתח | Pull Up',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'משיכת פולי עליון | Lat Pulldown',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'חתירה במוט | Barbell Row',
        muscleGroup: 'Back',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 90,
      },
      {
        name: 'משיכה לפנים | Face Pull',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'פשיטת מרפקים בכבל | Tricep Pushdown',
        muscleGroup: 'Triceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת מוט | Barbell Curl',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת פטישים | Hammer Curls',
        muscleGroup: 'Biceps',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['גב', 'יד קדמית', 'יד אחורית'],
    icon: '§',
  },
  {
    id: 'builtin-legs',
    name: 'רגליים',
    description: 'כל הרגל - ארבע ראשי, ירך אחורי וישבן',
    exercises: [
      {
        name: 'סקוואט | Back Squat',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 8,
        targetRestTime: 120,
      },
      {
        name: 'דדליפט רומני | Romanian Deadlift (RDL)',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 10,
        targetRestTime: 90,
      },
      {
        name: 'לחיצת רגליים | Leg Press',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 90,
      },
      {
        name: 'פשיטת ברכיים | Leg Extension',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'כפיפת ברכיים בשכיבה | Lying Leg Curl',
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: "היפ ת'ראסט | Hip Thrust",
        muscleGroup: 'Legs',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 90,
      },
      {
        name: 'הרמת עקבים | Calf Raise',
        muscleGroup: 'Legs',
        targetSets: 4,
        targetReps: 15,
        targetRestTime: 45,
      },
    ],
    muscleGroups: ['רגליים'],
    icon: '§',
  },
  {
    id: 'builtin-core',
    name: 'בטן + ליבה',
    description: 'חיזוק שרירי הליבה והבטן - יציבות ומראה',
    exercises: [
      {
        name: 'פלאנק | Plank',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 60,
        targetRestTime: 45,
      },
      {
        name: 'כפיפות בטן | Crunch',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 20,
        targetRestTime: 45,
      },
      {
        name: 'כפיפות בטן בכבל | Cable Crunch',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
      {
        name: 'הרמת רגליים בתלייה | Hanging Leg Raise',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 12,
        targetRestTime: 60,
      },
      {
        name: 'טוויסט רוסי | Russian Twist',
        muscleGroup: 'Core',
        targetSets: 3,
        targetReps: 20,
        targetRestTime: 45,
      },
      {
        name: 'פשיטת גב / סופרמן | Hyperextension',
        muscleGroup: 'Back',
        targetSets: 3,
        targetReps: 15,
        targetRestTime: 60,
      },
    ],
    muscleGroups: ['בטן'],
    icon: '§',
  },
];

// Convert built-in template to WorkoutTemplate format
export const convertBuiltInToWorkoutTemplate = (
  builtin: BuiltInWorkoutTemplate
): WorkoutTemplate => ({
  id: builtin.id,
  name: builtin.name,
  description: builtin.description,
  exercises: builtin.exercises.map((ex, index) => ({
    id: `builtin-${builtin.id}-${index}`,
    exerciseId: ex.name,
    exerciseName: ex.name,
    targetMuscle: ex.muscleGroup,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    targetWeight: null,
    restSeconds: ex.targetRestTime,
    order: index,
    notes: '',
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    targetRestTime: ex.targetRestTime,
    sets: Array(ex.targetSets)
      .fill(null)
      .map(() => ({
        reps: ex.targetReps,
        weight: 0,
      })),
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
  muscleGroups: builtin.muscleGroups,
  isBuiltin: true,
});
