// ============================================================================
// Trainee-side reflection of coach edits (all data tables)
// ============================================================================
// A coach can now edit a trainee's sessions, nutrition, body weight, etc.
// directly in the cloud. The trainee's app is local-first and only pulls on the
// SIGNED_IN event, so a warm/open app would never see those edits. This hook,
// mounted once at the app root, closes that gap:
//   1. on mount (when authenticated) it pulls the whole store once, best-effort;
//   2. it subscribes to Realtime on every coach-writable table and, per table,
//      debounces a fetch+merge of just that table, then emits the existing
//      data-changed event so any open screen reloads.
// It no-ops for guests and when Supabase is unconfigured.

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserTable } from '../services/coach/realtime';
import { emitTemplatesChanged, emitWorkoutSaved } from '../services/dataEvents';

// 1.2s: long enough to coalesce a burst of coach edits (a multi-set update fires
// several row events), short enough that the trainee sees the change promptly.
const REFLECT_DEBOUNCE_MS = 1200;

/** Coach-writable trainee tables we mirror live (RLS scopes them to the link). */
const REFLECTED_TABLES = [
  'workout_sessions',
  'workout_templates',
  'body_weight',
  'body_measurements',
  'personal_records',
  'recovery_logs',
  'nutrition_logs',
] as const;

type ReflectedTable = (typeof REFLECTED_TABLES)[number];

/** Tell open screens that a table changed, using the events they already listen on. */
const emitChangeFor = (table: ReflectedTable): void => {
  if (table === 'workout_sessions') {
    emitWorkoutSaved();
    return;
  }
  if (table === 'workout_templates') {
    emitTemplatesChanged();
    return;
  }
  if (typeof window === 'undefined') return;
  if (table === 'body_weight') {
    // TDEE-aware surfaces (Settings / Nutrition) listen on these.
    window.dispatchEvent(new CustomEvent('BODY_WEIGHT_UPDATED'));
    window.dispatchEvent(new CustomEvent('settings-updated'));
    return;
  }
  // body_measurements / personal_records / recovery_logs / nutrition_logs:
  // the progress + nutrition screens reload their day on `settings-updated`,
  // the app's general "data may have changed" signal.
  window.dispatchEvent(new CustomEvent('settings-updated'));
};

/** Fetch the one changed table from the cloud, merge it locally, then notify. */
const reflectTable = async (table: ReflectedTable, userId: string): Promise<void> => {
  const [sync, mappers] = await Promise.all([
    import('../services/supabaseSync'),
    import('../services/supabaseSyncMappers'),
  ]);

  if (table === 'workout_sessions') {
    const { mergeWorkoutSessionsFromCloud } = await import('../services/sessionDb');
    const rows = await sync.fetchWorkoutSessions(userId);
    await mergeWorkoutSessionsFromCloud(rows.map(mappers.toCanonicalSession));
  } else if (table === 'workout_templates') {
    const { mergeWorkoutTemplatesFromCloud } = await import('../services/templateDb');
    const rows = await sync.fetchWorkoutTemplates(userId);
    await mergeWorkoutTemplatesFromCloud(rows.map(mappers.toCanonicalTemplate));
  } else if (table === 'body_weight') {
    const { mergeBodyWeightFromCloud } = await import('../services/bodyWeightDb');
    const rows = await sync.fetchBodyWeight(userId);
    await mergeBodyWeightFromCloud(rows.map(mappers.toCanonicalBodyWeight));
  } else if (table === 'body_measurements') {
    const { mergeBodyMeasurementsFromCloud } = await import('../services/cloudMerge');
    const rows = await sync.fetchBodyMeasurements(userId);
    await mergeBodyMeasurementsFromCloud(rows.map(mappers.toCanonicalBodyMeasurement));
  } else if (table === 'personal_records') {
    const { mergePersonalRecordsFromCloud } = await import('../services/cloudMerge');
    const rows = await sync.fetchPersonalRecords(userId);
    await mergePersonalRecordsFromCloud(rows);
  } else if (table === 'recovery_logs') {
    const { mergeRecoveryLogsFromCloud } = await import('../services/cloudMerge');
    const rows = await sync.fetchRecoveryLogs(userId);
    await mergeRecoveryLogsFromCloud(rows);
  } else if (table === 'nutrition_logs') {
    const { mergeNutritionLogsFromCloud } = await import('../services/cloudMerge');
    const rows = await sync.fetchNutritionLogs(userId);
    await mergeNutritionLogsFromCloud(rows.map(mappers.toCanonicalNutritionLog));
  }

  emitChangeFor(table);
};

/**
 * Mount once (app root). Pulls everything on entry, then keeps the local store
 * in sync with coach edits via Realtime. No-ops for guests / offline.
 */
export function useCloudDataReflection(): void {
  const { user, isGuest } = useAuth();
  const userId = user?.id ?? null;
  const timersRef = useRef<Partial<Record<ReflectedTable, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    if (!userId || isGuest) return;

    let cancelled = false;
    const timers = timersRef.current;
    const unsubscribers: Array<() => void> = [];

    // (a) Best-effort full pull so a warm open catches edits made while away.
    void (async () => {
      try {
        const { pullAllData } = await import('../services/supabaseSync');
        await pullAllData();
        if (cancelled) return;
        for (const table of REFLECTED_TABLES) emitChangeFor(table);
      } catch {
        // Offline / transient — Realtime below still reflects subsequent edits.
      }
    })();

    // (b) Per-table Realtime → debounced fetch+merge+emit.
    for (const table of REFLECTED_TABLES) {
      const unsubscribe = subscribeToUserTable(table, userId, () => {
        if (cancelled) return;
        const existing = timers[table];
        if (existing) clearTimeout(existing);
        timers[table] = setTimeout(() => {
          void reflectTable(table, userId).catch(() => {
            // Swallow: a failed reflection must not crash the app; the next
            // event (or full pull) retries.
          });
        }, REFLECT_DEBOUNCE_MS);
      });
      unsubscribers.push(unsubscribe);
    }

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
      for (const table of REFLECTED_TABLES) {
        const t = timers[table];
        if (t) clearTimeout(t);
        delete timers[table];
      }
    };
  }, [userId, isGuest]);
}
