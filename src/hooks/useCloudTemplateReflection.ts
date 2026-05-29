import { useEffect } from 'react';
import { subscribeToUserTable } from '../services/coach/realtime';
import { emitTemplatesChanged } from '../services/dataEvents';
import { getCurrentUser } from '../services/supabaseAuth';
import { fetchWorkoutTemplates } from '../services/supabaseSync';
import { toCanonicalTemplate } from '../services/supabaseSyncMappers';
import { mergeWorkoutTemplatesFromCloud } from '../services/templateDb';

/**
 * Pull the current user's workout templates from the cloud and merge them into
 * the local-first store (reflecting any coach edits). Emits `TEMPLATES_CHANGED`
 * when something actually changed. No-ops offline / for guests / pre-migration.
 * Exposed so flows that need a coach-assigned template present locally (e.g.
 * starting an assigned program) can ensure it is synced first.
 */
export async function syncTemplatesFromCloud(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const cloud = await fetchWorkoutTemplates(user.id);
  const { added, updated } = await mergeWorkoutTemplatesFromCloud(cloud.map(toCanonicalTemplate));
  if (added > 0 || updated > 0) emitTemplatesChanged();
}

/**
 * Trainee-side reflection of coach edits. Syncs templates on mount (to catch
 * edits made while away) and again whenever the row changes in realtime (a
 * coach editing the plan), so open screens reload via `TEMPLATES_CHANGED`.
 */
export function useCloudTemplateReflection(): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;
      await syncTemplatesFromCloud();
      if (cancelled) return;
      unsubscribe = subscribeToUserTable('workout_templates', user.id, () => {
        void syncTemplatesFromCloud();
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
}
