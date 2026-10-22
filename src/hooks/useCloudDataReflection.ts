// ============================================================================
// Trainee-side reflection of coach edits (all data tables)
// ============================================================================
// A coach can now edit a trainee's sessions, nutrition, body weight, etc.
// directly in the cloud. The trainee's app is local-first, so a warm/open app
// would never see those edits. This hook, mounted once at the app root, closes
// that gap:
//   1. on mount and on every return to the foreground it runs the ROUTINE pull
//      (pullAllDataIfStale): incremental, and skipped when the last successful
//      pull is under 15 minutes old. It used to pull every table in full on
//      every mount;
//   2. only for a user with an active coach (getCoachLinkState), it subscribes
//      to Realtime on every coach-writable table and, per table, debounces a
//      fetch+merge of just the rows that changed, then emits the existing
//      data-changed event so any open screen reloads. A self-guided user — most
//      users — opens no channels at all. The link is re-checked on every return
//      to the foreground and on COACH_LINK_STATE_EVENT (a link made or ended on
//      this device, or a failed probe that has since got an answer).
// It no-ops for guests and when Supabase is unconfigured.

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { COACH_LINK_STATE_EVENT } from '../services/coach/coachLinkEvents';
import { getCoachLinkState } from '../services/coach/messageService';
import { type UserTableChange, subscribeToUserTable } from '../services/coach/realtime';
import { emitTemplatesChanged, emitWorkoutSaved } from '../services/dataEvents';

// 1.2s: long enough to coalesce a burst of coach edits (a multi-set update fires
// several row events), short enough that the trainee sees the change promptly.
const REFLECT_DEBOUNCE_MS = 1200;

/**
 * Above this many changed rows in one burst, one incremental pull of the table
 * is cheaper than asking for each id.
 */
const MAX_IDS_PER_REFLECTION = 200;

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

/** Rows of one table waiting for the debounce to fire. */
interface PendingReflection {
  ids: Set<string>;
  /** An event named no row (or too many did): catch up on the whole table instead. */
  wholeTable: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Fetch just the changed rows of one table (or, when the events named no row,
 * the rows changed since the last pull), merge them locally, then notify.
 * Each realtime event used to refetch the table's ENTIRE history.
 */
const reflectRows = async (table: ReflectedTable, pending: PendingReflection): Promise<void> => {
  const { pullTableRows } = await import('../services/supabaseSyncOrchestrator');
  const ids =
    pending.wholeTable || pending.ids.size > MAX_IDS_PER_REFLECTION ? undefined : [...pending.ids];
  await pullTableRows(table, ids);
  emitChangeFor(table);
};

/** True while the page is on screen (always true outside a browser). */
const isVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Mount once (app root). Keeps the local store in step with the cloud on entry
 * and on return to the foreground, and — for a coach-linked user — with coach
 * edits via Realtime. No-ops for guests / offline.
 */
export function useCloudDataReflection(): void {
  const { user, isGuest } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || isGuest) return;

    let cancelled = false;
    const pending = new Map<ReflectedTable, PendingReflection>();
    let unsubscribers: Array<() => void> | null = null;

    // (a) Routine pull: incremental, at most once per freshness window.
    const pullIfStale = () => {
      void (async () => {
        try {
          const { pullAllDataIfStale } = await import('../services/supabaseSyncOrchestrator');
          const result = await pullAllDataIfStale();
          if (cancelled || result.skipped) return;
          for (const table of REFLECTED_TABLES) emitChangeFor(table);
        } catch {
          // Offline / transient — the next foreground (or Realtime) catches up.
        }
      })();
    };

    // (b) Per-table Realtime → debounced fetch of the changed rows → emit.
    const onRowChange = (table: ReflectedTable) => (change: UserTableChange) => {
      if (cancelled) return;
      const entry: PendingReflection = pending.get(table) ?? {
        ids: new Set<string>(),
        wholeTable: false,
        timer: undefined,
      };
      if (change.id) entry.ids.add(change.id);
      else entry.wholeTable = true;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        pending.delete(table);
        if (cancelled) return;
        void reflectRows(table, entry).catch(() => {
          // Swallow: a failed reflection must not crash the app; the next
          // event (or routine pull) catches up.
        });
      }, REFLECT_DEBOUNCE_MS);
      pending.set(table, entry);
    };

    const subscribe = () => {
      unsubscribers = REFLECTED_TABLES.map((table) =>
        subscribeToUserTable(table, userId, onRowChange(table))
      );
    };
    const unsubscribe = () => {
      for (const stop of unsubscribers ?? []) stop();
      unsubscribers = null;
    };

    // Channels only while someone can actually edit this user's data. The link
    // state is cached (getCoachLinkState), so re-checking on each foreground is
    // cheap; an unknown answer (offline) leaves the channels as they are.
    const syncSubscriptions = async () => {
      const link = await getCoachLinkState().catch(() => null);
      if (cancelled || link === null) return;
      const wanted = link.coachIds.length > 0;
      if (wanted && !unsubscribers) subscribe();
      else if (!wanted && unsubscribers) unsubscribe();
    };

    pullIfStale();
    void syncSubscriptions();

    // (c) Back in the foreground: catch up (throttled) and re-check the link.
    const onVisibilityChange = () => {
      if (!isVisible()) return;
      pullIfStale();
      void syncSubscriptions();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // (d) The link state changed (an invite accepted, a coach disconnected) or
    // became known after a failed probe: open or close the channels now.
    const onLinkStateChange = () => {
      void syncSubscriptions();
    };
    window.addEventListener(COACH_LINK_STATE_EVENT, onLinkStateChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener(COACH_LINK_STATE_EVENT, onLinkStateChange);
      unsubscribe();
      for (const entry of pending.values()) {
        if (entry.timer) clearTimeout(entry.timer);
      }
      pending.clear();
    };
  }, [userId, isGuest]);
}
