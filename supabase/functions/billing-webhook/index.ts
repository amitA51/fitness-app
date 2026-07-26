// ============================================================================
// Supabase Edge Function: billing-webhook
// ----------------------------------------------------------------------------
// The receiver the entitlements schema was always designed around but never had.
// It is the ONLY path that may change a user's paid state.
//
// Guarantees:
//   • Signature verified over the RAW body before anything is parsed as trusted
//     input (adapter.parseWebhook). An unverified request is rejected 401.
//   • Idempotent: the provider event id is inserted into billing_events, whose
//     UNIQUE (provider, external_id) constraint makes a duplicate delivery a
//     no-op instead of a double-apply.
//   • Out-of-order safe: billing_apply_subscription() refuses events older than
//     the state it already stored, so a late "canceled" cannot downgrade a payer
//     who has already renewed.
//   • verify_jwt = false (config.toml): providers cannot present a Supabase JWT.
//     The signature IS the authentication.
//
// Deploy:  supabase functions deploy billing-webhook --no-verify-jwt
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BillingConfigError,
  WebhookVerificationError,
  env,
  getAdapter,
} from '../_shared/billingAdapter.ts';

/** Webhooks are server-to-server: no CORS, and no body echoed back. */
const reply = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply({ ok: false, error: 'method' }, 405);

  const adapter = getAdapter();
  if (!adapter) {
    console.error('[billing-webhook] BILLING_PROVIDER is not configured');
    return reply({ ok: false, error: 'billing_not_configured' }, 503);
  }

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[billing-webhook] missing Supabase service configuration');
    return reply({ ok: false, error: 'server_misconfigured' }, 503);
  }

  // Raw text, never re-serialised JSON: every HMAC scheme signs exact bytes.
  const rawBody = await req.text();
  if (rawBody.length > 1_000_000) return reply({ ok: false, error: 'payload_too_large' }, 413);

  let event: Awaited<ReturnType<typeof adapter.parseWebhook>>;
  try {
    event = await adapter.parseWebhook(rawBody, req.headers);
  } catch (e) {
    if (e instanceof BillingConfigError) {
      console.error('[billing-webhook] provider misconfigured:', e.message);
      return reply({ ok: false, error: 'billing_not_configured' }, 503);
    }
    if (e instanceof WebhookVerificationError) {
      console.error('[billing-webhook] signature rejected:', e.message);
      return reply({ ok: false, error: 'invalid_signature' }, 401);
    }
    console.error('[billing-webhook] could not parse payload');
    return reply({ ok: false, error: 'bad_request' }, 400);
  }

  // Authentic, but not a subscription lifecycle event: acknowledge so the
  // provider does not retry forever.
  if (!event) return reply({ ok: true, ignored: true }, 200);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Idempotency gate. `processed_at` separates "we have seen this event" from
  // "we have finished applying it": a retry of a half-finished event must be
  // allowed, or a single failed apply would permanently swallow a purchase.
  let eventRowId: string | null = null;
  const { data: inserted, error: eventError } = await admin
    .from('billing_events')
    .insert({
      user_id: event.userId,
      provider: adapter.key,
      external_id: event.eventId,
      event_type: event.eventType,
      payload: JSON.parse(rawBody),
    })
    .select('id')
    .maybeSingle();

  if (eventError) {
    // 23505 = unique_violation → we have seen this event id before.
    if (eventError.code === '23505') {
      const { data: existing } = await admin
        .from('billing_events')
        .select('id, processed_at')
        .eq('provider', adapter.key)
        .eq('external_id', event.eventId)
        .maybeSingle();

      const prior = existing as { id?: string; processed_at?: string | null } | null;
      if (prior?.processed_at) {
        // Genuinely already applied — acknowledge without doing anything.
        return reply({ ok: true, duplicate: true }, 200);
      }
      // Seen but never completed: fall through and finish the job this time.
      eventRowId = prior?.id ?? null;
      console.warn('[billing-webhook] retrying a previously unprocessed event', event.eventId);
    } else {
      console.error('[billing-webhook] could not record event:', eventError.message);
      return reply({ ok: false, error: 'storage_failed' }, 500);
    }
  } else {
    eventRowId = (inserted as { id?: string } | null)?.id ?? null;
  }

  // Remember the provider customer id so a portal/cancel flow can find them.
  if (event.providerCustomerId) {
    const { error: customerError } = await admin.from('billing_customers').upsert(
      {
        user_id: event.userId,
        provider: adapter.key,
        provider_customer_id: event.providerCustomerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (customerError) {
      console.error('[billing-webhook] customer upsert failed:', customerError.message);
    }
  }

  // Resolve the internal price key. Prefer the echoed custom_data, fall back to
  // a lookup by the provider's price id so a checkout made outside the app
  // (e.g. a manual provider-side subscription) still maps to a plan.
  let priceKey = event.priceKey;
  if (!priceKey && event.providerPriceId) {
    const { data } = await admin
      .from('billing_prices')
      .select('price_key')
      .eq('provider', adapter.key)
      .eq('provider_price_id', event.providerPriceId)
      .maybeSingle();
    priceKey = (data as { price_key?: string } | null)?.price_key ?? null;
  }

  if (!priceKey) {
    console.error('[billing-webhook] no price mapping for event', {
      eventType: event.eventType,
      providerPriceId: event.providerPriceId,
    });
    // Recorded in billing_events for manual reconciliation; do not retry.
    return reply({ ok: false, error: 'unmapped_price' }, 200);
  }

  const { data: applyData, error: applyError } = await admin.rpc('billing_apply_subscription', {
    p_user_id: event.userId,
    p_scope: event.scope,
    p_provider: adapter.key,
    p_provider_subscription_id: event.providerSubscriptionId,
    p_price_key: priceKey,
    p_status: event.status,
    p_quantity: event.quantity,
    p_current_period_start: event.currentPeriodStart,
    p_current_period_end: event.currentPeriodEnd,
    p_cancel_at_period_end: event.cancelAtPeriodEnd,
    p_event_at: event.eventAt,
    p_snapshot: JSON.parse(rawBody),
  });

  if (applyError) {
    console.error('[billing-webhook] apply failed:', applyError.message);
    // 500 so the provider retries. `processed_at` is deliberately left NULL, so
    // that retry will be allowed through the idempotency gate above instead of
    // being dismissed as a duplicate.
    return reply({ ok: false, error: 'apply_failed' }, 500);
  }

  const applied = Array.isArray(applyData)
    ? ((applyData[0] as { applied?: boolean } | undefined)?.applied ?? false)
    : false;

  // Close the idempotency window only now that the work is actually done. A
  // stale event (applied === false, reason 'stale_event') also counts as done:
  // retrying it would never change anything.
  if (eventRowId) {
    const { error: markError } = await admin
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventRowId);
    if (markError) {
      // Worst case the provider retries and we re-apply idempotently.
      console.error('[billing-webhook] could not mark event processed:', markError.message);
    }
  }

  // Close out the matching checkout session, if any.
  if (applied && event.status !== 'incomplete') {
    await admin
      .from('billing_checkout_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('user_id', event.userId)
      .eq('status', 'created');
  }

  return reply({ ok: true, applied }, 200);
});
