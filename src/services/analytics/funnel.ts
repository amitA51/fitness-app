// ============================================================================
// FUNNEL — the handful of events that answer "is this business working?"
// ============================================================================
// The existing eventTracker writes to localStorage, which is useful for
// in-app debugging and useless for measuring a product. This module records the
// small, fixed set of business-critical steps to `public.product_events`
// (migration 20260726110000_product_events.sql) so conversion can actually be
// measured before and after launch.
//
// Rules baked in here:
//   • Nothing is sent without analytics consent. Consent is checked at call
//     time, not at import time, so revoking it takes effect immediately.
//   • Failures are silent and never block a user action. Telemetry must not be
//     able to break a workout.
//   • Events are also mirrored into the local eventTracker, which keeps the
//     existing debug view working offline.
//   • The event names are a closed union AND an allow-list in the RLS policy, so
//     the table cannot silently accumulate ad-hoc names.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { trackEvent as trackLocalEvent } from '../eventTracker';
import { getCurrentUser } from '../supabaseAuth';
import { hasAnalyticsConsent } from '../tracking/trackingConsent';

/** Keep in sync with the CHECK allow-list in the product_events RLS policy. */
export const FUNNEL_EVENTS = [
  'signup_completed',
  'onboarding_completed',
  'workout_started',
  'workout_completed',
  'first_workout_completed',
  'paywall_viewed',
  'checkout_started',
  'checkout_completed',
  'subscription_cancelled',
  'coach_invite_accepted',
  'sync_failed',
  'unsynced_changes_held',
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Only primitives: the payload is size-capped server-side and must stay small. */
export type FunnelProps = Record<string, string | number | boolean>;

/**
 * Record a funnel step. Fire-and-forget by design: callers should not await it
 * and must not depend on its result.
 */
export function trackFunnel(event: FunnelEvent, props: FunnelProps = {}): void {
  // Local mirror first: it works offline, for guests, and without consent
  // because it never leaves the device.
  try {
    trackLocalEvent(event, props as Record<string, string | number>);
  } catch {
    // localStorage unavailable (private mode / quota) — not worth surfacing.
  }

  if (!hasAnalyticsConsent() || !supabase) return;

  void (async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return; // Guests have no row to attribute the event to.

      const { error } = await supabase.from('product_events').insert({
        user_id: user.id,
        name: event,
        props,
        occurred_at: new Date().toISOString(),
      });
      if (error) {
        // A missing migration or a revoked policy must not spam the console on
        // every interaction, so this stays at debug level.
        logger.analytics.debug('funnel event not recorded', { event, message: error.message });
      }
    } catch (err) {
      logger.analytics.debug('funnel event threw', { event, err });
    }
  })();
}
