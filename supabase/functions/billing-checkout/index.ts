// ============================================================================
// Supabase Edge Function: billing-checkout
// ----------------------------------------------------------------------------
// Starts a hosted checkout for the signed-in user. This is the missing half of
// the paywall: previously /paywall could only join a waitlist, so there was no
// way to take money at all.
//
// Security posture:
//   • JWT-verified; the user id comes from the token, never the body.
//   • The body carries a `priceKey` ONLY. Amount, currency and the provider's
//     price id are read server-side from public.billing_prices, so a tampered
//     client cannot buy a plan at its own price.
//   • Redirect URLs are validated against ALLOWED_ORIGIN (no open redirect).
//   • Rate limited fail-closed via the shared rate_limit_events ledger.
//
// Body:    { priceKey: string, quantity?: number }
// Returns: { ok: true, url } | { ok: false, error: ... }
//
// Deploy:  supabase functions deploy billing-checkout
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BillingConfigError,
  corsHeaders,
  env,
  getAdapter,
  isAllowedRedirect,
  json,
} from '../_shared/billingAdapter.ts';
import { consumeRateLimits } from '../_shared/rateLimit.ts';

interface PriceRow {
  price_key: string;
  scope: string;
  provider: string;
  provider_price_id: string;
  is_active: boolean;
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, req);

  const adapter = getAdapter();
  if (!adapter) {
    // Billing is not live yet. The client keeps showing the waitlist paywall.
    return json({ ok: false, error: 'billing_not_configured' }, 503, req);
  }

  const SUPABASE_URL = env('SUPABASE_URL');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = env('SUPABASE_ANON_KEY');

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ ok: false, error: 'unauthenticated' }, 401, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fail-closed rate limit: 20 checkout starts per hour per user, decided
  // atomically (see supabase/migrations/20260726130000_rate_limit_atomic.sql).
  const rateVerdict = await consumeRateLimits(
    admin,
    [{ bucket: 'billing_checkout_user', subject: caller.id, windowSeconds: 3600, maxEvents: 20 }],
    '[billing-checkout]'
  );
  if (!rateVerdict.allowed) {
    return json({ ok: false, error: 'rate_limited' }, rateVerdict.unavailable ? 503 : 429, req);
  }

  let priceKey = '';
  let quantity = 1;
  try {
    const body = (await req.json()) as { priceKey?: unknown; quantity?: unknown };
    if (typeof body.priceKey !== 'string' || body.priceKey.length === 0 || body.priceKey.length > 64) {
      return json({ ok: false, error: 'bad_request' }, 400, req);
    }
    priceKey = body.priceKey;
    if (typeof body.quantity === 'number' && Number.isInteger(body.quantity)) {
      // Clamp: seats are the only reason quantity > 1, and never unbounded.
      quantity = Math.min(Math.max(body.quantity, 1), 500);
    }
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400, req);
  }

  // Price is resolved SERVER-side. A client cannot name its own amount.
  const { data: priceData, error: priceError } = await admin
    .from('billing_prices')
    .select('price_key, scope, provider, provider_price_id, is_active')
    .eq('price_key', priceKey)
    .maybeSingle();

  if (priceError) {
    console.error('[billing-checkout] price lookup failed:', priceError.message);
    return json({ ok: false, error: 'provider_unavailable' }, 503, req);
  }
  const price = priceData as PriceRow | null;
  if (!price || !price.is_active) return json({ ok: false, error: 'unknown_price' }, 404, req);
  if (price.provider !== adapter.key) {
    console.error('[billing-checkout] price provider mismatch', {
      price: price.provider,
      adapter: adapter.key,
    });
    return json({ ok: false, error: 'billing_not_configured' }, 503, req);
  }

  const appOrigin = (env('ALLOWED_ORIGIN').split(',')[0] ?? '').trim();
  const successUrl = `${appOrigin}/paywall?checkout=success`;
  const cancelUrl = `${appOrigin}/paywall?checkout=cancelled`;
  if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
    console.error('[billing-checkout] ALLOWED_ORIGIN is not a usable app origin');
    return json({ ok: false, error: 'billing_not_configured' }, 503, req);
  }

  try {
    const result = await adapter.createCheckout({
      userId: caller.id,
      email: caller.email ?? null,
      priceKey: price.price_key,
      providerPriceId: price.provider_price_id,
      quantity,
      successUrl,
      cancelUrl,
    });

    // Reconciliation record. A failure here must not block the purchase.
    const { error: sessionError } = await admin.from('billing_checkout_sessions').insert({
      user_id: caller.id,
      price_key: price.price_key,
      provider: adapter.key,
      provider_session_id: result.providerSessionId,
      status: 'created',
    });
    if (sessionError) {
      console.error('[billing-checkout] could not record session:', sessionError.message);
    }

    return json({ ok: true, url: result.url }, 200, req);
  } catch (e) {
    if (e instanceof BillingConfigError) {
      console.error('[billing-checkout] provider misconfigured:', e.message);
      return json({ ok: false, error: 'billing_not_configured' }, 503, req);
    }
    // Generic code only: never leak the provider's response to the browser.
    console.error('[billing-checkout] checkout creation failed');
    return json({ ok: false, error: 'provider_unavailable' }, 502, req);
  }
});
