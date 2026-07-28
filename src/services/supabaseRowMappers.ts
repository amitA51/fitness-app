/**
 * Local record -> cloud row mappers. ONE implementation, used by BOTH push paths.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * The app had TWO independent implementations of the same transformation:
 *
 *   1. `sync<Entity>()` in supabaseSync.ts / supabaseMiscSync.ts / waterService.ts
 *      — the immediate path, also replayed by the offline queue. It runs on every
 *      single write, so its bugs surfaced quickly and it is correct.
 *   2. The inline `batchUpsert(...)` mappers in supabaseSyncOrchestrator.ts
 *      — the bulk path, reachable ONLY from the manual "upload to cloud" button
 *      in Settings. Nothing exercises it routinely, so it drifted silently.
 *
 * The drift was not cosmetic. Three of the eleven tables were reading fields
 * that do not exist on the canonical IndexedDB record, which `undefined`
 * silently turns into a dropped column or a NULL:
 *
 *   • personal_records  — read `r.recordType`, but `savePR` stores `type`
 *     (src/services/prService.ts). `record_type` is `text NOT NULL`, so the
 *     omitted column raised 23502 and killed the ENTIRE 50-row chunk. A user
 *     with 198 PRs lost up to 50 per failing chunk, reported as a clean sync.
 *   • body_measurements — read `m.measurements`, but the local row is FLAT
 *     (chest/waist/hips/...). The nested column went out as NULL, so every
 *     measurement came back blank on another device.
 *   • nutrition_logs    — read `l.calories`/`l.protein`/..., but the local row
 *     keeps `totalMacros`. A full upload overwrote correct cloud macros with
 *     NULL. This one actively DESTROYS good data rather than just omitting it.
 *
 * Patching the three mappers would have fixed today's bugs and left the
 * duplication that produced them. Both paths now call the functions below, so
 * the two cannot disagree again.
 *
 * ---------------------------------------------------------------------------
 * Two input shapes, on purpose
 * ---------------------------------------------------------------------------
 * Every mapper accepts BOTH the canonical IndexedDB shape and the already-mapped
 * shape, because the offline queue persists its payloads in the *mapper* shape
 * (nested `measurements`, `recordType`) while a bulk push reads raw IndexedDB
 * rows. A queued mutation written by an older app version must keep replaying
 * correctly after an upgrade, so the tolerance is a compatibility requirement,
 * not defensiveness.
 *
 * ---------------------------------------------------------------------------
 * House rules encoded here
 * ---------------------------------------------------------------------------
 * • `deleted_at` is written ONLY when actually deleting. A live save that sent
 *   `deleted_at: null` would clear a tombstone set on another device and
 *   resurrect the record (verified 2026-06-09) — PostgREST applies it on the
 *   conflict-UPDATE branch. Omitting the column preserves the remote tombstone.
 * • Numbers use `?? null`, never `|| null`. `0 || null` is `null`, which turned a
 *   real zero-carb day into "no data" — there is such a row in production.
 * • `updated_at` always falls back through `updatedAt -> createdAt -> now`, since
 *   the server LWW guard drops any write whose timestamp is older than stored.
 */

import { isUuid } from '../utils/id';
import { correctTimestamp, serverNowIso } from './serverClock';

/** A cloud row: plain JSON, ready for `.upsert()`. */
export type CloudRow = Record<string, unknown>;

const nowIso = (): string => serverNowIso();

/**
 * `updated_at` for a record, never undefined, corrected for device clock skew.
 *
 * The server guard (`sync_lww_guard`) silently DROPS an update whose
 * `updated_at` is older than the stored row, and PostgREST reports no error, so
 * a missing timestamp here reads as a successful sync that did nothing — and a
 * timestamp from a slow device clock does exactly the same thing while looking
 * completely normal. `correctTimestamp` shifts it by the measured server offset
 * (a no-op when the clock is trusted). See ./serverClock.
 */
const updatedAt = (r: { updatedAt?: string; createdAt?: string }): string =>
  correctTimestamp(r.updatedAt ?? r.createdAt ?? nowIso());

const createdAt = (r: { createdAt?: string }): string => r.createdAt ?? nowIso();

/** Spread-in tombstone: present only for a real delete. See house rules above. */
const tombstone = (r: { deletedAt?: string | null }): CloudRow =>
  r.deletedAt ? { deleted_at: r.deletedAt } : {};

/** Coerce to a finite number or null. Preserves 0, unlike `|| null`. */
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Round to an integer or null, preserving 0. For the integer macro columns. */
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

// ===========================================================================
// workout_templates
// ===========================================================================

export interface TemplatePushInput {
  id: string;
  name: string;
  description?: string | null;
  exercises: unknown;
  lastUsed?: string | null;
  timesUsed?: number;
  isFavorite?: boolean;
  muscleGroups?: string[];
  isBuiltin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toTemplateRow = (userId: string, t: TemplatePushInput): CloudRow => ({
  id: t.id,
  user_id: userId,
  name: t.name,
  description: t.description || null,
  exercises: t.exercises,
  // Personalisation metadata. These have no dedicated columns, so they ride
  // along inside the `exercises` jsonb envelope? No — see the migration
  // 20260728140000: real columns were added, because losing `is_builtin` made
  // dataService re-seed the built-in templates and produce duplicates, and
  // losing favourites/usage silently reset the user's library on every restore.
  last_used: t.lastUsed ?? null,
  times_used: t.timesUsed ?? 0,
  is_favorite: t.isFavorite ?? false,
  muscle_groups: t.muscleGroups ?? null,
  is_builtin: t.isBuiltin ?? false,
  created_at: createdAt(t),
  updated_at: updatedAt(t),
  ...tombstone(t),
});

// ===========================================================================
// workout_sessions
// ===========================================================================

export interface SessionPushInput {
  id: string;
  date?: string;
  startTime: string;
  endTime?: string | null;
  duration?: number;
  exercises: unknown;
  totalVolume?: number;
  notes?: string;
  status?: string;
  templateId?: string | null;
  rating?: number | null;
  caloriesBurned?: number | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toSessionRow = (userId: string, s: SessionPushInput): CloudRow => ({
  id: s.id,
  user_id: userId,
  date: s.date || nowIso(),
  start_time: s.startTime,
  end_time: s.endTime || null,
  duration: s.duration ?? 0,
  exercises: s.exercises,
  total_volume: s.totalVolume ?? 0,
  notes: s.notes || null,
  status: s.status ?? null,
  template_id: s.templateId ?? null,
  // Added by migration 20260728140000. `rating` is written by the workout
  // summary screen and read back by WorkoutDetail, so dropping it made a
  // user's own rating vanish on any other device.
  rating: num(s.rating),
  calories_burned: num(s.caloriesBurned),
  created_at: s.createdAt ?? s.startTime ?? nowIso(),
  updated_at: updatedAt({ updatedAt: s.updatedAt, createdAt: s.createdAt ?? s.startTime }),
  ...tombstone(s),
});

// ===========================================================================
// personal_exercises
// ===========================================================================

export interface ExercisePushInput {
  id: string;
  name: string;
  muscleGroup?: string | null;
  category?: string;
  tempo?: string | null;
  defaultRestTime?: number;
  defaultSets?: number;
  notes?: string | null;
  tutorialText?: string | null;
  isFavorite?: boolean;
  useCount?: number;
  lastUsed?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toExerciseRow = (userId: string, e: ExercisePushInput): CloudRow => ({
  id: e.id,
  user_id: userId,
  name: e.name,
  muscle_group: e.muscleGroup || null,
  category: e.category || 'strength',
  tempo: e.tempo || null,
  default_rest_time: e.defaultRestTime ?? 60,
  default_sets: e.defaultSets ?? 3,
  notes: e.notes || null,
  tutorial_text: e.tutorialText || null,
  is_favorite: e.isFavorite ?? false,
  use_count: e.useCount ?? 0,
  last_used: e.lastUsed || null,
  created_at: createdAt(e),
  updated_at: updatedAt(e),
  ...tombstone(e),
});

// ===========================================================================
// body_weight
// ===========================================================================

export interface BodyWeightPushInput {
  id: string;
  weight: number;
  date: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toBodyWeightRow = (userId: string, b: BodyWeightPushInput): CloudRow => ({
  id: b.id,
  user_id: userId,
  weight: b.weight,
  date: b.date,
  // The column has existed since 20260608000500_coach_edit_columns.sql, but
  // neither push path ever sent it, so a weight note typed on the phone was
  // simply absent everywhere else.
  notes: b.notes || null,
  created_at: createdAt(b),
  updated_at: updatedAt(b),
  ...tombstone(b),
});

// ===========================================================================
// body_measurements
// ===========================================================================

/**
 * Accepts the FLAT canonical row (what `addBodyMeasurement` stores in IndexedDB)
 * or the already-NESTED queue payload. The bulk path used to read `.measurements`
 * off a flat row and send NULL.
 */
export interface MeasurementPushInput {
  id: string;
  date: string;
  measurements?: Record<string, number | undefined> | null;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  neck?: number;
  bodyFat?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

const MEASUREMENT_FIELDS = ['chest', 'waist', 'hips', 'arms', 'thighs', 'neck', 'bodyFat'] as const;

/** Nested payload if already nested, otherwise gathered from the flat row. */
export const measurementPayload = (m: MeasurementPushInput): Record<string, number> => {
  const source: Record<string, unknown> =
    m.measurements && typeof m.measurements === 'object'
      ? (m.measurements as Record<string, unknown>)
      : (m as unknown as Record<string, unknown>);

  const out: Record<string, number> = {};
  for (const field of MEASUREMENT_FIELDS) {
    const v = num(source[field]);
    if (v !== null) out[field] = v;
  }
  return out;
};

export const toMeasurementRow = (userId: string, m: MeasurementPushInput): CloudRow => ({
  id: m.id,
  user_id: userId,
  date: m.date,
  measurements: measurementPayload(m),
  notes: m.notes || null,
  created_at: createdAt(m),
  updated_at: updatedAt(m),
  ...tombstone(m),
});

// ===========================================================================
// personal_records
// ===========================================================================

/**
 * Accepts `type` (the canonical `PersonalRecord` field that `savePR` writes to
 * IndexedDB) or `recordType` (the queue-payload field). Reading only
 * `recordType` is what NOT-NULL-violated and killed whole 50-row chunks.
 */
export interface PRPushInput {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  type?: string;
  recordType?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

/** Never undefined: the column is `text NOT NULL`. 'weight' matches savePR's own fallback. */
export const prRecordType = (r: PRPushInput): string => r.recordType ?? r.type ?? 'weight';

export const toPersonalRecordRow = (userId: string, r: PRPushInput): CloudRow => ({
  id: r.id,
  user_id: userId,
  // Cloud column is uuid with an FK to personal_exercises, while local identity
  // is the normalised exercise NAME. A name string here 22P02s the whole batch.
  exercise_id: isUuid(r.exerciseId) ? r.exerciseId : null,
  exercise_name: r.exerciseName,
  weight: r.weight,
  reps: r.reps,
  date: r.date,
  record_type: prRecordType(r),
  notes: r.notes || null,
  created_at: createdAt(r),
  updated_at: updatedAt(r),
  ...tombstone(r),
});

// ===========================================================================
// recovery_logs
// ===========================================================================

export interface RecoveryPushInput {
  id: string;
  date: string;
  sleepHours?: number;
  sleepQuality?: number;
  sorenessLevel?: number;
  energyLevel?: number;
  stressLevel?: number;
  tightAreas?: string[];
  overallScore?: number;
  sessionId?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toRecoveryRow = (userId: string, l: RecoveryPushInput): CloudRow => ({
  id: l.id,
  user_id: userId,
  date: l.date,
  sleep_hours: num(l.sleepHours),
  sleep_quality: num(l.sleepQuality),
  soreness_level: num(l.sorenessLevel),
  energy_level: num(l.energyLevel),
  stress_level: num(l.stressLevel),
  tight_areas: l.tightAreas ?? [],
  overall_score: num(l.overallScore),
  session_id: l.sessionId ?? null,
  notes: l.notes || null,
  created_at: createdAt(l),
  updated_at: updatedAt(l),
  ...tombstone(l),
});

// ===========================================================================
// nutrition_logs
// ===========================================================================

interface MacroLike {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface MealLike extends MacroLike {
  id?: string;
  name?: string;
  time?: string;
  foods?: unknown[];
  totalMacros?: MacroLike;
}

/**
 * Accepts the canonical row (`totalMacros`, meals carrying `totalMacros` +
 * `foods`) or the flattened queue payload. Reading only the flat fields sent
 * NULL macros over correct cloud values on every full upload.
 */
export interface NutritionPushInput extends MacroLike {
  id: string;
  date: string;
  name?: string;
  totalMacros?: MacroLike;
  meals?: MealLike[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

const macrosOf = (l: NutritionPushInput): MacroLike => l.totalMacros ?? l;

/**
 * Per-meal payload. Keeps the flat macro fields the existing pull mapper reads
 * AND preserves `totalMacros` + `foods`, which the old flattening threw away —
 * that is why a meal restored on another device had no food names, brands,
 * serving sizes or barcodes. Old rows without the extra keys still read fine.
 */
const mealPayload = (m: MealLike): CloudRow => {
  const macros = m.totalMacros ?? m;
  return {
    id: m.id,
    name: m.name,
    time: m.time,
    calories: int(macros.calories) ?? 0,
    protein: int(macros.protein) ?? 0,
    carbs: int(macros.carbs) ?? 0,
    fat: int(macros.fat) ?? 0,
    totalMacros: m.totalMacros ?? null,
    foods: m.foods ?? [],
  };
};

export const toNutritionRow = (userId: string, l: NutritionPushInput): CloudRow => {
  const macros = macrosOf(l);
  return {
    id: l.id,
    user_id: userId,
    date: l.date,
    // `int`, not `|| null`: a genuine 0 g carb day is data, not absence.
    calories: int(macros.calories),
    protein: int(macros.protein),
    carbs: int(macros.carbs),
    fat: int(macros.fat),
    meals: (l.meals ?? []).map(mealPayload),
    // Column added by 20260728140000; the pull previously rebuilt the entry
    // title as '' because there was nowhere to store it.
    name: l.name || null,
    notes: l.notes || null,
    created_at: createdAt(l),
    updated_at: updatedAt(l),
    ...tombstone(l),
  };
};

// ===========================================================================
// user_settings
// ===========================================================================

export interface SettingPushInput {
  key: string;
  value: unknown;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * `id` is deliberately absent. It is a `uuid` with a `uuid_generate_v4()`
 * default; the old `${userId}:${key}` composite was rejected with 22P02 on
 * EVERY write, so this table stayed empty in production. Identity is the
 * UNIQUE (user_id, key) pair used as the upsert conflict target.
 */
export const toSettingRow = (userId: string, s: SettingPushInput): CloudRow => ({
  user_id: userId,
  key: s.key,
  value: s.value,
  created_at: createdAt(s),
  updated_at: correctTimestamp(s.updatedAt ?? nowIso()),
});

// ===========================================================================
// ai_conversations
// ===========================================================================

export interface ConversationPushInput {
  id: string;
  title?: string;
  messages: unknown;
  context?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toConversationRow = (userId: string, c: ConversationPushInput): CloudRow => ({
  id: c.id,
  user_id: userId,
  title: c.title || null,
  messages: c.messages,
  context: c.context ?? {},
  created_at: createdAt(c),
  updated_at: updatedAt(c),
  ...tombstone(c),
});

// ===========================================================================
// water_logs
// ===========================================================================

export interface WaterPushInput {
  id: string;
  date: string;
  amountMl: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const toWaterRow = (userId: string, w: WaterPushInput): CloudRow => ({
  id: w.id,
  user_id: userId,
  date: w.date,
  amount_ml: w.amountMl,
  created_at: createdAt(w),
  updated_at: updatedAt(w),
  ...tombstone(w),
});
