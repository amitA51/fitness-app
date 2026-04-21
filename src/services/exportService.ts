import type { BodyWeightEntry, MealEntry, WorkoutSession } from '../types';
import { STORES, dbGetAll } from './indexedDBCore';

// CSV Export
export function exportWorkoutHistoryCSV(sessions: WorkoutSession[]): void {
  const headers = ['תאריך', 'תרגיל', 'סט', 'חזרות', 'משקל', 'נפח', 'RPE', 'הערות'];
  const rows: string[][] = [];

  sessions.forEach((session) => {
    const date = session.date || new Date(session.startTime).toLocaleDateString('he-IL');
    session.exercises?.forEach((exercise) => {
      exercise.sets?.forEach((set) => {
        if (set.isWarmup) return;
        rows.push([
          date,
          exercise.exerciseName || exercise.id,
          set.setNumber.toString(),
          set.reps.toString(),
          set.weight.toString(),
          (set.weight * set.reps).toString(),
          set.rpe?.toString() || '',
          set.notes || '',
        ]);
      });
    });
  });

  downloadCSV(headers, rows, `workout-history-${todayStr()}.csv`);
}

export function exportNutritionCSV(entries: MealEntry[]): void {
  const headers = ['תאריך', 'שם ארוחה', 'סוג', 'קלוריות', 'חלבון', 'פחמימות', 'שומן'];
  const rows: string[][] = [];

  entries.forEach((entry) => {
    entry.meals?.forEach((meal) => {
      rows.push([
        entry.date,
        entry.name,
        meal.name,
        meal.totalMacros.calories.toString(),
        meal.totalMacros.protein.toString(),
        meal.totalMacros.carbs.toString(),
        meal.totalMacros.fat.toString(),
      ]);
    });
  });

  downloadCSV(headers, rows, `nutrition-history-${todayStr()}.csv`);
}

export function exportBodyWeightCSV(entries: BodyWeightEntry[]): void {
  const headers = ['תאריך', 'משקל', 'הערות'];
  const rows = entries.map((e) => [e.date, e.weight.toString(), e.notes || '']);

  downloadCSV(headers, rows, `body-weight-${todayStr()}.csv`);
}

// Full weekly report as text (can be shared)
export async function generateWeeklyReport(): Promise<string> {
  const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weekSessions = sessions
    .filter((s) => s.status === 'completed' && new Date(s.startTime) >= oneWeekAgo)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const totalVolume = weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const totalDuration = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalSets = weekSessions.reduce(
    (sum, s) =>
      sum +
      (s.exercises || []).reduce(
        (es, ex) => es + (ex.sets || []).filter((set) => set.isCompleted && !set.isWarmup).length,
        0
      ),
    0
  );

  const muscleGroups = new Set<string>();
  weekSessions.forEach((s) =>
    (s.exercises || []).forEach((e) => {
      const m = e.muscleGroup || e.targetMuscle;
      if (m) muscleGroups.add(m);
    })
  );

  const avgDuration =
    weekSessions.length > 0 ? Math.round(totalDuration / 60 / weekSessions.length) : 0;

  const exerciseDetails = weekSessions
    .map((s) => {
      const date = new Date(s.startTime).toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const exercises = (s.exercises || [])
        .map((e) => {
          const vol = e.sets
            .filter((set) => !set.isWarmup)
            .reduce((sum, set) => sum + set.weight * set.reps, 0);
          return `  • ${e.exerciseName}: ${vol.toLocaleString()} ק"ג`;
        })
        .join('\n');
      return `${date}:\n${exercises}`;
    })
    .join('\n\n');

  return `דוח שבועי · SparkOS Fitness

תקופה: ${new Date(oneWeekAgo).toLocaleDateString('he-IL')} — ${new Date().toLocaleDateString('he-IL')}

סיכום:
אימונים: ${weekSessions.length}
זמן ממוצע: ${avgDuration} דקות
נפח כולל: ${totalVolume.toLocaleString()} ק"ג
סטים: ${totalSets}
שרירים: ${Array.from(muscleGroups).join(', ')}

פירוט אימונים:
${exerciseDetails || 'אין אימונים השבוע'}`;
}

// Helper functions
function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function downloadCSV(headers: string[], rows: string[][], filename: string): void {
  const bom = '\uFEFF'; // BOM for Hebrew support in Excel
  const csv =
    bom +
    [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Share via Web Share API
export async function shareReport(reportText: string): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: 'SparkOS Fitness - דוח אימונים',
      text: reportText,
    });
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
