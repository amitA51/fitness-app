// ============================================================================
// Power — olympic-style barbell lifts and kettlebell ballistics
// ============================================================================
// Neither existed in the original catalog, which meant the library could describe
// how to grow a muscle but not how to produce force quickly. These are honestly
// tagged `expert` where they genuinely need coaching: a power clean learned from
// a text box is how people hurt their wrists and lower back.

import type { CatalogExercise } from './types';

export const POWER_EXERCISES: CatalogExercise[] = [
  // ------------------------------------------------------------ barbell power
  {
    name: 'פוש פרס | Push Press',
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'push',
    level: 'intermediate',
    primaryMuscle: 'shoulders',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 120,
    defaultSets: 4,
    notes: 'לחיצת כתפיים בעזרת דחיפת רגליים - מאפשרת משקל גבוה מלחיצה נקייה.',
    tutorialText:
      'מהמוט על הכתפיים, כפפו ברכיים קלות ופרצו מעלה ברגליים, ורק אז המשיכו את המוט בידיים עד יישור מעל הראש.',
    secondaryMuscles: ['Triceps', 'Quads', 'Core'],
    equipment: 'barbell',
  },
  {
    name: 'משיכה גבוהה | High Pull',
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'pull',
    level: 'intermediate',
    primaryMuscle: 'traps',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 120,
    defaultSets: 4,
    notes: 'מלמד להאיץ מוט - שלב ביניים טוב לפני נטילה מלאה.',
    tutorialText:
      'מדדליפט קל, פרצו בירכיים והמשיכו את המוט מעלה עם מרפקים גבוהים עד גובה החזה. אל תסובבו את הפרקים.',
    secondaryMuscles: ['Shoulders', 'Glutes', 'Hamstrings'],
    equipment: 'barbell',
  },
  {
    name: 'נטילה | Power Clean',
    muscleGroup: 'Legs',
    mechanic: 'compound',
    force: 'pull',
    level: 'expert',
    primaryMuscle: 'quadriceps',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 180,
    defaultSets: 5,
    notes: 'הרמה אולימפית לפיתוח כוח מתפרץ בכל הגוף. דורשת לימוד טכניקה מודרך.',
    tutorialText:
      'משכו את המוט לאורך הרגליים, פרצו בירכיים, וצנחו מתחת למוט כדי לקבל אותו על הכתפיים בברכיים כפופות. סיימו בעמידה זקופה.',
    secondaryMuscles: ['Glutes', 'Traps', 'Hamstrings'],
    equipment: 'barbell',
  },
  {
    name: 'חטיפה | Power Snatch',
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'pull',
    level: 'expert',
    primaryMuscle: 'shoulders',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 180,
    defaultSets: 5,
    notes: 'ההרמה המהירה ביותר - מוט מהרצפה עד מעל הראש בתנועה אחת. דורשת ניידות כתף טובה.',
    tutorialText:
      'באחיזה רחבה, משכו את המוט מהרצפה, פרצו בירכיים ונעלו את הידיים מעל הראש תוך צניחה קלה מתחת למוט.',
    secondaryMuscles: ['Traps', 'Glutes', 'Quads'],
    equipment: 'barbell',
  },
  {
    name: 'נטילה ודחיקה | Clean and Jerk',
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'push',
    level: 'expert',
    primaryMuscle: 'shoulders',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 180,
    defaultSets: 5,
    notes: 'שני שלבים - נטילה לכתפיים ודחיקה מעל הראש. המשקל הכבד ביותר שניתן להעביר מעל הראש.',
    tutorialText:
      'בצעו נטילה לכתפיים, התייצבו, ואז כפפו ברכיים ודחקו את המוט מעל הראש תוך פיסוק רגליים קדימה ואחורה.',
    secondaryMuscles: ['Triceps', 'Quads', 'Traps'],
    equipment: 'barbell',
  },

  // ---------------------------------------------------------------- kettlebell
  {
    name: 'סווינג קטלבל | Kettlebell Swing',
    muscleGroup: 'Legs',
    mechanic: 'compound',
    force: 'pull',
    level: 'intermediate',
    primaryMuscle: 'glutes',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 75,
    defaultSets: 4,
    notes: 'מלמד לייצר כוח מהירכיים - עובד ישבן ומיתרי ירך וגם מעלה דופק.',
    tutorialText:
      'התנועה מהירכיים ולא מהכתפיים: שלחו את האגן אחורה, ואז פרצו קדימה כך שהקטלבל עף עד גובה החזה בזרועות רפויות.',
    secondaryMuscles: ['Hamstrings', 'Core', 'Lats'],
    equipment: 'kettlebell',
  },
  {
    name: 'קלין קטלבל | Kettlebell Clean',
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'pull',
    level: 'intermediate',
    primaryMuscle: 'shoulders',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 90,
    defaultSets: 4,
    notes: 'מביא את הקטלבל למנח מדף על האמה - בסיס לכל תרגילי הקטלבל מעל הראש.',
    tutorialText:
      'מסווינג קצר, קרבו את המרפק לגוף וגלגלו את הקטלבל סביב האמה עד מנח מדף. אל תיתנו לו לחבוט בפרק.',
    secondaryMuscles: ['Traps', 'Glutes', 'Core'],
    equipment: 'kettlebell',
  },
  {
    name: "סנאץ' קטלבל | Kettlebell Snatch",
    muscleGroup: 'Shoulders',
    mechanic: 'compound',
    force: 'pull',
    level: 'expert',
    primaryMuscle: 'shoulders',
    category: 'strength',
    tempo: 'explosive',
    defaultRestTime: 120,
    defaultSets: 4,
    notes: 'קטלבל מבין הרגליים עד מעל הראש בתנועה אחת - שילוב של כוח מתפרץ וסיבולת.',
    tutorialText:
      'מסווינג חזק, האיצו את הקטלבל מעלה וסובבו את היד סביבו כך שיתייצב מעל הראש בזרוע נעולה.',
    secondaryMuscles: ['Traps', 'Glutes', 'Core'],
    equipment: 'kettlebell',
  },
  {
    name: 'טורקיש גט-אפ | Turkish Get-Up',
    muscleGroup: 'Core',
    mechanic: 'compound',
    force: 'push',
    level: 'expert',
    primaryMuscle: 'abdominals',
    category: 'strength',
    tempo: 'slow',
    defaultRestTime: 120,
    defaultSets: 3,
    notes: 'מקימה מלאה משכיבה לעמידה עם משקל מעל הראש - יציבות כתף ובטן בכל טווח.',
    tutorialText:
      'משכיבה, נעלו את היד מעל החזה ואל תורידו ממנה עיניים. התרוממו לישיבה, למכרע, ולעמידה - וחזרו באותו סדר.',
    secondaryMuscles: ['Shoulders', 'Glutes', 'Quads'],
    equipment: 'kettlebell',
  },
];
