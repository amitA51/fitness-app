// Workout Programs Data
// Predefined workout programs for the fitness hub

export interface WorkoutProgram {
  id: string;
  name: string;
  nameHe?: string;
  description: string;
  descriptionHe?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
  color: string;
  duration: number; // in weeks
  totalWeeks?: number;
  workoutsPerWeek: number;
  daysPerWeek?: number;
  muscleGroups: string[];
  focusAreas?: string[];
  exercises: WorkoutProgramExercise[];
  periodization?: string;
}

export interface WorkoutProgramExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  day: number; // which day of the week (1-7)
}

export const WORKOUT_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'full-body-beginner',
    name: 'Full Body Beginner',
    nameHe: 'גוף מלא מתחילים',
    description: 'A beginner-friendly full body program',
    descriptionHe: 'תוכנית גוף מלא ידידותית למתחילים',
    difficulty: 'beginner',
    icon: '💪',
    color: '#10B981',
    duration: 8,
    totalWeeks: 8,
    workoutsPerWeek: 3,
    daysPerWeek: 3,
    muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    focusAreas: ['Full Body', 'General Fitness'],
    exercises: [],
  },
  {
    id: 'upper-lower',
    name: 'Upper/Lower Split',
    nameHe: 'פיצול עליון/תחתון',
    description: 'Classic upper/lower split for intermediate lifters',
    descriptionHe: 'פיצול עליון/תחתון קלאסי למתאמנים בינוניים',
    difficulty: 'intermediate',
    icon: '🏋️',
    color: '#F59E0B',
    duration: 12,
    totalWeeks: 12,
    workoutsPerWeek: 4,
    daysPerWeek: 4,
    muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    focusAreas: ['Upper Body', 'Lower Body', 'Hypertrophy'],
    exercises: [],
  },
  {
    id: 'push-pull-legs',
    name: 'Push/Pull/Legs',
    nameHe: 'דחיפה/משיכה/רגליים',
    description: 'Advanced push/pull/legs program',
    descriptionHe: 'תוכנית דחיפה/משיכה/רגליים מתקדמת',
    difficulty: 'advanced',
    icon: '🔥',
    color: '#EF4444',
    duration: 16,
    totalWeeks: 16,
    workoutsPerWeek: 6,
    daysPerWeek: 6,
    muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    focusAreas: ['Push', 'Pull', 'Legs', 'Strength'],
    exercises: [],
  },
];

export const getProgramById = (id: string): WorkoutProgram | undefined => {
  return WORKOUT_PROGRAMS.find(p => p.id === id);
};
