/**
 * classify-builtin-exercises.mjs — ONE-TIME codemod (kept for provenance).
 *
 * Injects `mechanic` / `force` / `level` / `primaryMuscle` into every record of
 * src/data/builtInExercises.ts.
 *
 * WHY A CODEMOD AND NOT HAND EDITS
 * The 90 existing records carry hand-written Hebrew names, notes and tutorials.
 * Rewriting the file by hand to add four fields risks silently mangling that
 * Hebrew. This script only ever INSERTS lines after an existing `muscleGroup:`
 * line, so every existing string is preserved byte-for-byte. Re-running it is a
 * no-op: records that already declare `mechanic:` are skipped.
 *
 * WHY THE TABLE IS HAND-AUTHORED
 * scripts/enrich-exercise-catalog.mjs matched only 26 of 90 names against
 * free-exercise-db, because upstream names differ ("Barbell Bench Press - Medium
 * Grip" vs "Bench Press"). Fuzzy matching mis-assigns near-duplicates such as
 * Dips vs Bench Dips, so the classification below is authored deliberately using
 * the same vocabulary as the dataset.
 *
 * Names are the join key and MUST stay byte-identical to the catalog: the seeder
 * (services/exerciseDb) de-duplicates built-ins by name, so a renamed entry
 * would be re-seeded as a duplicate for existing users.
 *
 * Usage: node scripts/classify-builtin-exercises.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(resolve(HERE, '..'), 'src', 'data', 'builtInExercises.ts');

/** name → [mechanic, force, level, primaryMuscle]. `null` force = not applicable. */
const CLASSIFICATION = {
  // ---- Cardio / warmup -----------------------------------------------------
  'קפיצות ג׳ק | Jumping Jacks': ['compound', null, 'beginner', 'cardio'],
  'ריצה על מסילה | Treadmill Run': ['compound', null, 'beginner', 'cardio'],

  // ---- Chest ---------------------------------------------------------------
  'לחיצת חזה | Bench Press': ['compound', 'push', 'beginner', 'chest'],
  'לחיצת חזה בשיפוע חיובי | Incline Dumbbell Press': ['compound', 'push', 'beginner', 'chest'],
  'לחיצת חזה בשיפוע שלילי | Decline Bench Press': ['compound', 'push', 'beginner', 'chest'],
  'לחיצת חזה עם משקולות יד | Dumbbell Press': ['compound', 'push', 'beginner', 'chest'],
  'פרפר בכבלים | Cable Fly': ['isolation', 'push', 'beginner', 'chest'],
  'פרפר בכבלים - פולי עליון | High Cable Crossover': ['isolation', 'push', 'intermediate', 'chest'],
  'פרפר בכבלים - פולי תחתון | Low Cable Crossover': ['isolation', 'push', 'intermediate', 'chest'],
  'פול-אובר | Dumbbell Pullover': ['isolation', 'pull', 'intermediate', 'chest'],
  'לחיצת חזה במכונת האמר | Hammer Strength Chest Press': ['compound', 'push', 'beginner', 'chest'],
  'מקבילים רחב | Chest Dips': ['compound', 'push', 'intermediate', 'chest'],
  'לחיצת גיליוטינה | Guillotine Press': ['compound', 'push', 'expert', 'chest'],
  'לחיצת לנדמיין | Landmine Press': ['compound', 'push', 'intermediate', 'chest'],
  'שכיבות סמיכה | Push Up': ['compound', 'push', 'beginner', 'chest'],
  'לחיצת סבנד | Svend Press': ['isolation', 'push', 'beginner', 'chest'],

  // ---- Back ----------------------------------------------------------------
  'מתח | Pull Up': ['compound', 'pull', 'intermediate', 'lats'],
  'מתח באחיזה הפוכה וצרה | Chin-Up': ['compound', 'pull', 'beginner', 'lats'],
  'משיכת פולי עליון | Lat Pulldown': ['compound', 'pull', 'beginner', 'lats'],
  'משיכת פולי עליון במשולש | V-Bar Pulldown': ['compound', 'pull', 'beginner', 'lats'],
  'פול-אובר בכבל | Straight Arm Pulldown': ['isolation', 'pull', 'beginner', 'lats'],
  'חתירה בכבל בישיבה - אחיזה צרה | Seated Cable Row Close Grip': [
    'compound',
    'pull',
    'beginner',
    'middle back',
  ],
  'חתירה בכבל בישיבה - אחיזה רחבה | Seated Cable Row Wide Grip': [
    'compound',
    'pull',
    'beginner',
    'middle back',
  ],
  'חתירה ביד אחת | Single Arm Dumbbell Row': ['compound', 'pull', 'beginner', 'middle back'],
  'חתירה בטי-בר | T-Bar Row': ['compound', 'pull', 'intermediate', 'middle back'],
  'חתירה במוט | Barbell Row': ['compound', 'pull', 'intermediate', 'middle back'],
  'ראק-פולס | Rack Pulls': ['compound', 'pull', 'intermediate', 'middle back'],
  'פשיטת גב / סופרמן | Hyperextension': ['isolation', 'pull', 'beginner', 'lower back'],
  'דדליפט | Deadlift': ['compound', 'pull', 'intermediate', 'lower back'],
  // Face pulls sit in the Back tab by convention but the prime mover is the rear
  // delt — the catalog keeps muscleGroup and primaryMuscle deliberately different.
  'משיכה לפנים | Face Pull': ['isolation', 'pull', 'beginner', 'shoulders'],

  // ---- Shoulders -----------------------------------------------------------
  'לחיצת כתפיים | Overhead Press': ['compound', 'push', 'beginner', 'shoulders'],
  'לחיצת ארנולד | Arnold Press': ['compound', 'push', 'intermediate', 'shoulders'],
  'הרחקה לצדדים | Dumbbell Lateral Raise': ['isolation', 'push', 'beginner', 'shoulders'],
  'הרחקה לצדדים בכבל | Cable Lateral Raise': ['isolation', 'pull', 'beginner', 'shoulders'],
  'הרחקה לצדדים בישיבה | Seated Lateral Raise': ['isolation', 'push', 'beginner', 'shoulders'],
  'הרמה לפנים | Front Raise': ['isolation', 'push', 'beginner', 'shoulders'],
  'חתירה אנכית | Upright Row': ['compound', 'pull', 'intermediate', 'traps'],
  'פרפר הפוך במכונה | Reverse Pec Deck': ['isolation', 'pull', 'beginner', 'shoulders'],
  'הרחקה אופקית בכבל | Reverse Cable Fly': ['isolation', 'pull', 'intermediate', 'shoulders'],
  'לחיצה מאחורי העורף | Behind the Neck Press': ['compound', 'push', 'expert', 'shoulders'],

  // ---- Legs: quads ---------------------------------------------------------
  'סקוואט | Back Squat': ['compound', 'push', 'intermediate', 'quadriceps'],
  'סקוואט קדמי | Front Squat': ['compound', 'push', 'intermediate', 'quadriceps'],
  'לחיצת רגליים | Leg Press': ['compound', 'push', 'beginner', 'quadriceps'],
  'האק סקוואט | Hack Squat': ['compound', 'push', 'intermediate', 'quadriceps'],
  'בולגריאן ספליט סקוואט | Bulgarian Split Squat': [
    'compound',
    'push',
    'intermediate',
    'quadriceps',
  ],
  'סקוואט גביע | Goblet Squat': ['compound', 'push', 'beginner', 'quadriceps'],
  'סיסי סקוואט | Sissy Squat': ['isolation', 'push', 'expert', 'quadriceps'],
  'פשיטת ברכיים | Leg Extension': ['isolation', 'push', 'beginner', 'quadriceps'],
  'מכרעים בהליכה | Walking Lunges': ['compound', 'push', 'beginner', 'quadriceps'],
  "מכרעים / לאנג'ים | Lunges": ['compound', 'push', 'beginner', 'quadriceps'],
  'צעד וחצי / עלייה על מדרגה | Step Ups': ['compound', 'push', 'beginner', 'quadriceps'],

  // ---- Legs: posterior chain ----------------------------------------------
  'דדליפט רומני | Romanian Deadlift (RDL)': ['compound', 'pull', 'intermediate', 'hamstrings'],
  'דדליפט סומו | Sumo Deadlift': ['compound', 'pull', 'intermediate', 'hamstrings'],
  'בוקר טוב | Good Mornings': ['compound', 'pull', 'intermediate', 'hamstrings'],
  'כפיפת ברכיים בישיבה | Seated Leg Curl': ['isolation', 'pull', 'beginner', 'hamstrings'],
  'כפיפת ברכיים בשכיבה | Lying Leg Curl': ['isolation', 'pull', 'beginner', 'hamstrings'],
  'גשר ישבן | Glute Bridge': ['isolation', 'push', 'beginner', 'glutes'],
  "היפ ת'ראסט | Hip Thrust": ['compound', 'push', 'beginner', 'glutes'],
  'בעיטה אחורית בכבל | Cable Kickback': ['isolation', 'pull', 'beginner', 'glutes'],

  // ---- Legs: hips & calves -------------------------------------------------
  'הרחקת ירך במכונה | Hip Abductor Machine': ['isolation', 'pull', 'beginner', 'abductors'],
  'קירוב ירך במכונה | Hip Adductor Machine': ['isolation', 'pull', 'beginner', 'adductors'],
  'הרמת עקבים | Calf Raise': ['isolation', 'push', 'beginner', 'calves'],
  'הרמת עקבים בישיבה | Seated Calf Raise': ['isolation', 'push', 'beginner', 'calves'],
  'הרמת עקבים במכונת לחיצת רגליים | Leg Press Calf Raise': [
    'isolation',
    'push',
    'beginner',
    'calves',
  ],
  'הרמת עקבים חמור | Donkey Calf Raise': ['isolation', 'push', 'beginner', 'calves'],

  // ---- Biceps & forearms ---------------------------------------------------
  'כפיפת מוט | Barbell Curl': ['isolation', 'pull', 'beginner', 'biceps'],
  'כפיפה בשיפוע חיובי | Incline Dumbbell Curl': ['isolation', 'pull', 'beginner', 'biceps'],
  'כפיפת פטישים | Hammer Curls': ['isolation', 'pull', 'beginner', 'biceps'],
  'כפיפת ריכוז | Concentration Curl': ['isolation', 'pull', 'beginner', 'biceps'],
  'כפיפה בכיסא כומר | Preacher Curl': ['isolation', 'pull', 'beginner', 'biceps'],
  'עשרים ואחת | 21s': ['isolation', 'pull', 'intermediate', 'biceps'],
  'כפיפת מוט באחיזה הפוכה | Reverse Curl': ['isolation', 'pull', 'beginner', 'forearms'],
  'כפיפת שורש כף היד | Wrist Curls': ['isolation', 'pull', 'beginner', 'forearms'],

  // ---- Triceps -------------------------------------------------------------
  'פשיטת מרפקים בכבל | Tricep Pushdown': ['isolation', 'push', 'beginner', 'triceps'],
  'פשיטה עם חבל | Rope Pushdown': ['isolation', 'push', 'beginner', 'triceps'],
  'לחיצת חזה צרה | Close Grip Bench Press': ['compound', 'push', 'intermediate', 'triceps'],
  'לחיצה צרפתית | Skullcrusher': ['isolation', 'push', 'intermediate', 'triceps'],
  'פשיטת מרפקים מעל הראש | Overhead Tricep Extension': ['isolation', 'push', 'beginner', 'triceps'],
  'קיק-בק | Tricep Kickback': ['isolation', 'push', 'beginner', 'triceps'],
  'מקבילים | Dips': ['compound', 'push', 'intermediate', 'triceps'],
  'מקבילים בין ספסלים | Bench Dips': ['compound', 'push', 'beginner', 'triceps'],

  // ---- Core ----------------------------------------------------------------
  'כפיפות בטן | Crunch': ['isolation', 'pull', 'beginner', 'abdominals'],
  'פלאנק | Plank': ['isolation', 'static', 'beginner', 'abdominals'],
  'הרמת רגליים בתלייה | Hanging Leg Raise': ['isolation', 'pull', 'intermediate', 'abdominals'],
  'הרמת ברכיים בתלייה | Hanging Knee Raise': ['isolation', 'pull', 'beginner', 'abdominals'],
  'גלגלת בטן | Ab Wheel Rollout': ['compound', 'pull', 'expert', 'abdominals'],
  'טוויסט רוסי | Russian Twist': ['isolation', 'pull', 'beginner', 'abdominals'],
  'חוטב עצים בכבל | Woodchoppers': ['compound', 'pull', 'intermediate', 'abdominals'],
  'כפיפות בטן בכבל | Cable Crunch': ['isolation', 'pull', 'beginner', 'abdominals'],
  'ואקום | Stomach Vacuum': ['isolation', 'static', 'beginner', 'abdominals'],
};

const dryRun = process.argv.includes('--dry');
const lines = readFileSync(CATALOG, 'utf8').split('\n');

// Two records use double quotes because their Hebrew name contains an ASCII
// apostrophe (לאנג'ים, ת'ראסט), so both quote styles must be accepted.
const NAME_RX = /^(\s+)name: (?:'(.*)'|"(.*)"),\s*$/;
const output = [];
const seen = new Set();
const unknown = [];
let injected = 0;
let alreadyDone = 0;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  output.push(line);

  const nameMatch = line.match(NAME_RX);
  if (!nameMatch) continue;

  const [, indent, singleQuoted, doubleQuoted] = nameMatch;
  const name = singleQuoted ?? doubleQuoted;
  seen.add(name);

  const classification = CLASSIFICATION[name];
  if (!classification) {
    unknown.push(name);
    continue;
  }

  // Look ahead inside this record: skip if it is already classified, and find
  // the muscleGroup line so the new fields land next to it.
  let muscleGroupOffset = -1;
  for (let j = i + 1; j < lines.length && !/^\s+\},?\s*$/.test(lines[j]); j += 1) {
    if (/^\s+mechanic:/.test(lines[j])) {
      muscleGroupOffset = -2;
      break;
    }
    if (/^\s+muscleGroup:/.test(lines[j])) muscleGroupOffset = j;
  }
  if (muscleGroupOffset === -2) {
    alreadyDone += 1;
    continue;
  }

  const [mechanic, force, level, primaryMuscle] = classification;
  const extra = [
    `${indent}mechanic: '${mechanic}',`,
    ...(force ? [`${indent}force: '${force}',`] : []),
    `${indent}level: '${level}',`,
    `${indent}primaryMuscle: '${primaryMuscle}',`,
  ];

  if (muscleGroupOffset > 0) {
    // Copy through the muscleGroup line, then insert.
    for (let j = i + 1; j <= muscleGroupOffset; j += 1) output.push(lines[j]);
    output.push(...extra);
    i = muscleGroupOffset;
  } else {
    output.push(...extra);
  }
  injected += 1;
}

const tableNames = Object.keys(CLASSIFICATION);
const missingFromFile = tableNames.filter((n) => !seen.has(n));

console.log(`records seen        : ${seen.size}`);
console.log(`classified (table)  : ${tableNames.length}`);
console.log(`injected            : ${injected}`);
console.log(`already classified  : ${alreadyDone}`);
console.log(`no table entry      : ${unknown.length}`);
for (const n of unknown) console.log(`  MISSING CLASSIFICATION: ${n}`);
console.log(`table names not in file: ${missingFromFile.length}`);
for (const n of missingFromFile) console.log(`  STALE TABLE ENTRY: ${n}`);

if (dryRun) {
  console.log('\n--dry: no file written');
} else if (injected > 0) {
  writeFileSync(CATALOG, output.join('\n'), 'utf8');
  console.log(`\nwrote ${CATALOG}`);
} else {
  console.log('\nnothing to inject');
}

if (unknown.length > 0 || missingFromFile.length > 0) process.exitCode = 1;
