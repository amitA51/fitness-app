/**
 * Compact metadata for the built-in Bodybuilding Transformation System.
 *
 * WHY: bbtProgram.generated.ts is 339 kB source / ~218 kB emitted, while the
 * Dashboard and pre-workout entry only need the title, week/day labels, block,
 * and exercise count. Keeping that small projection separate means users who
 * never opt into the program do not download or parse its exercise catalog.
 *
 * The five day definitions and two blocks exactly mirror the generated source.
 * Update this projection alongside the generator whenever program structure
 * changes; no exercise prescription or substitution data belongs here.
 */

/** The five trainable days of each week, in progression order. */
export const TRAINING_DAYS = ['Upper', 'Lower', 'Pull', 'Push', 'Legs'] as const;
export type TrainingDay = (typeof TRAINING_DAYS)[number];

export interface BbtProgramBlockMetadata {
  name: string;
  nameHe: string;
  weeks: number[];
}

export interface BbtProgramDayMetadata {
  week: number;
  dayType: TrainingDay;
  dayHe: string;
  blockHe: string;
  exerciseCount: number;
}

export interface BbtProgramMetadata {
  id: string;
  title: string;
  titleHe: string;
  level: string;
  totalWeeks: number;
  blocks: readonly BbtProgramBlockMetadata[];
}

export const BBT_PROGRAM_METADATA: BbtProgramMetadata = {
  id: 'bbt-intermediate-advanced',
  title: 'The Bodybuilding Transformation System',
  titleHe: 'מערכת השינוי לפיתוח גוף',
  level: 'Intermediate / Advanced',
  totalWeeks: 12,
  blocks: [
    { name: 'Foundation Block', nameHe: 'בלוק יסוד', weeks: [1, 2, 3, 4, 5] },
    { name: 'Ramping Block', nameHe: 'בלוק העצמה', weeks: [6, 7, 8, 9, 10, 11, 12] },
  ],
};

const DAY_DETAILS: Record<
  TrainingDay,
  Omit<BbtProgramDayMetadata, 'week' | 'blockHe' | 'dayType'>
> = {
  Upper: { dayHe: 'פלג גוף עליון · דגש כוח', exerciseCount: 7 },
  Lower: { dayHe: 'פלג גוף תחתון · דגש כוח', exerciseCount: 6 },
  Pull: { dayHe: 'משיכה · דגש היפרטרופיה', exerciseCount: 7 },
  Push: { dayHe: 'דחיפה · דגש היפרטרופיה', exerciseCount: 7 },
  Legs: { dayHe: 'רגליים · דגש היפרטרופיה', exerciseCount: 7 },
};

/** Metadata-only block lookup. It never resolves the generated exercise catalog. */
export const getBlockForWeek = (week: number): { name: string; nameHe: string } => {
  const block = BBT_PROGRAM_METADATA.blocks.find((candidate) => candidate.weeks.includes(week));
  return block ? { name: block.name, nameHe: block.nameHe } : { name: '', nameHe: '' };
};

/**
 * Resolve the only day fields that non-program surfaces can truthfully show.
 * Full exercise rows must go through programCatalogService instead.
 */
export const getProgramDayMetadata = (
  week: number,
  dayType: TrainingDay
): BbtProgramDayMetadata | null => {
  const block = BBT_PROGRAM_METADATA.blocks.find((candidate) => candidate.weeks.includes(week));
  const day = DAY_DETAILS[dayType];
  if (!block || !day) return null;

  return { week, dayType, blockHe: block.nameHe, ...day };
};
