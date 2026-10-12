// ============================================================================
// Cardio activities — the one table every cardio surface reads.
// ============================================================================
// Each activity decides which fields the user is asked for, how its speed is
// written (pace per km for runners, km/h for riders, per 500 m on a rower, per
// 100 m in the pool), whether live GPS makes sense, and which discipline its
// numbers count toward (a treadmill walk is walking, not running).

import type { CardioActivity, RunType } from '../../types';

/** How an activity's speed is written. */
export type PaceStyle = 'per_km' | 'speed' | 'per_500m' | 'per_100m' | 'none';

/** The unit the user types distance in (stored as km either way). */
export type DistanceUnit = 'km' | 'm';

/** Which totals an effort counts toward. */
export type CardioDiscipline = 'running' | 'walking' | 'cycling' | 'rowing' | 'swimming' | 'other';

/** Where the activity sits in the picker. */
export type CardioGroup = 'outdoor' | 'gym' | 'other';

export interface CardioActivityConfig {
  id: CardioActivity;
  /** Short Hebrew label for tiles and headings. */
  label: string;
  /**
   * Built-in catalog name ('עברית | English') this activity is logged under.
   * NEVER edit a shipped name: exerciseDb de-duplicates built-ins by name.
   */
  catalogName: string;
  paceStyle: PaceStyle;
  distanceUnit: DistanceUnit;
  /** Distance is a headline field (a run) rather than optional (elliptical). */
  distanceMatters: boolean;
  /** Live GPS tracking makes sense (moving outdoors). */
  gps: boolean;
  /** Ask for treadmill incline. */
  incline: boolean;
  /** Ask for elevation gain. */
  elevation: boolean;
  /** Offer run types (easy / tempo / …). */
  runTypes: boolean;
  group: CardioGroup;
}

export const CARDIO_ACTIVITIES: readonly CardioActivityConfig[] = [
  {
    id: 'run',
    label: 'ריצה',
    catalogName: 'ריצה | Running',
    paceStyle: 'per_km',
    distanceUnit: 'km',
    distanceMatters: true,
    gps: true,
    incline: false,
    elevation: true,
    runTypes: true,
    group: 'outdoor',
  },
  {
    id: 'walk',
    label: 'הליכה',
    catalogName: 'הליכה | Walking',
    paceStyle: 'per_km',
    distanceUnit: 'km',
    distanceMatters: true,
    gps: true,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'outdoor',
  },
  {
    id: 'hike',
    label: 'טיול רגלי',
    catalogName: 'טיול רגלי | Hiking',
    paceStyle: 'per_km',
    distanceUnit: 'km',
    distanceMatters: true,
    gps: true,
    incline: false,
    elevation: true,
    runTypes: false,
    group: 'outdoor',
  },
  {
    id: 'cycle',
    label: 'רכיבה',
    catalogName: 'רכיבת אופניים | Cycling',
    paceStyle: 'speed',
    distanceUnit: 'km',
    distanceMatters: true,
    gps: true,
    incline: false,
    elevation: true,
    runTypes: false,
    group: 'outdoor',
  },
  {
    id: 'swim',
    label: 'שחייה',
    catalogName: 'שחייה | Swimming',
    paceStyle: 'per_100m',
    distanceUnit: 'm',
    distanceMatters: true,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'outdoor',
  },
  {
    id: 'treadmill',
    label: 'הליכון',
    catalogName: 'ריצה על מסילה | Treadmill Run',
    paceStyle: 'per_km',
    distanceUnit: 'km',
    distanceMatters: true,
    gps: false,
    incline: true,
    elevation: false,
    runTypes: true,
    group: 'gym',
  },
  {
    id: 'indoor_cycle',
    label: 'אופני כושר',
    catalogName: 'אופני כושר | Stationary Bike',
    paceStyle: 'speed',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'gym',
  },
  {
    id: 'row',
    label: 'חתירה',
    catalogName: 'מכונת חתירה | Rowing Machine',
    paceStyle: 'per_500m',
    distanceUnit: 'm',
    distanceMatters: true,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'gym',
  },
  {
    id: 'elliptical',
    label: 'אליפטיקל',
    catalogName: 'אליפטיקל | Elliptical',
    paceStyle: 'none',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'gym',
  },
  {
    id: 'stairs',
    label: 'מדרגות',
    catalogName: 'מכונת מדרגות | Stair Climber',
    paceStyle: 'none',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'gym',
  },
  {
    id: 'jump_rope',
    label: 'קפיצה בחבל',
    catalogName: 'קפיצה בחבל | Jump Rope',
    paceStyle: 'none',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'other',
  },
  {
    id: 'hiit',
    label: 'HIIT',
    catalogName: 'אימון HIIT | HIIT Workout',
    paceStyle: 'none',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'other',
  },
  {
    id: 'other',
    label: 'אירובי אחר',
    catalogName: 'אירובי אחר | Other Cardio',
    paceStyle: 'none',
    distanceUnit: 'km',
    distanceMatters: false,
    gps: false,
    incline: false,
    elevation: false,
    runTypes: false,
    group: 'other',
  },
];

const BY_ID = new Map<CardioActivity, CardioActivityConfig>(
  CARDIO_ACTIVITIES.map((a) => [a.id, a])
);

/** Config of one activity; unknown ids fall back to "other". */
export function cardioActivityConfig(id: CardioActivity): CardioActivityConfig {
  return BY_ID.get(id) ?? (BY_ID.get('other') as CardioActivityConfig);
}

export function isCardioActivity(value: unknown): value is CardioActivity {
  return typeof value === 'string' && BY_ID.has(value as CardioActivity);
}

/**
 * Built-in catalog names that are logged as cardio. The activity's own
 * `catalogName` plus older built-ins that map onto an activity.
 */
const CATALOG_NAMES: ReadonlyMap<string, CardioActivity> = new Map<string, CardioActivity>([
  ...CARDIO_ACTIVITIES.map((a) => [a.catalogName, a.id] as [string, CardioActivity]),
  ['הליכה בשיפוע | Incline Walk', 'treadmill'],
  ['אינטרוולים בריצה | Running Intervals', 'run'],
]);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Same names, matched case- and spacing-insensitively ("ריצה | running"). */
export const CATALOG_NAME_TO_ACTIVITY = {
  get(name: string): CardioActivity | undefined {
    return NORMALIZED.get(normalizeName(name));
  },
  has(name: string): boolean {
    return NORMALIZED.has(normalizeName(name));
  },
} as const;

const NORMALIZED = new Map<string, CardioActivity>(
  [...CATALOG_NAMES].map(([name, activity]) => [normalizeName(name), activity])
);

/** Runner's names for a run's intent. */
export const RUN_TYPE_LABELS: Readonly<Record<RunType, string>> = {
  easy: 'קלה',
  tempo: 'טמפו',
  intervals: 'אינטרוולים',
  long: 'ארוכה',
  recovery: 'התאוששות',
  race: 'מרוץ',
};

export const RUN_TYPES: readonly RunType[] = [
  'easy',
  'tempo',
  'intervals',
  'long',
  'recovery',
  'race',
];

/** Treadmill below this speed is walking (the ACSM walking equation's range). */
export const TREADMILL_WALK_MAX_KMH = 7;

/**
 * Discipline of one effort. A treadmill effort is running or walking by its
 * speed; without a distance it is assumed to be a run (the common case).
 */
export function cardioDiscipline(
  activity: CardioActivity,
  speedKmh: number | null
): CardioDiscipline {
  switch (activity) {
    case 'run':
      return 'running';
    case 'treadmill':
      return speedKmh !== null && speedKmh < TREADMILL_WALK_MAX_KMH ? 'walking' : 'running';
    case 'walk':
    case 'hike':
      return 'walking';
    case 'cycle':
    case 'indoor_cycle':
      return 'cycling';
    case 'row':
      return 'rowing';
    case 'swim':
      return 'swimming';
    default:
      return 'other';
  }
}
