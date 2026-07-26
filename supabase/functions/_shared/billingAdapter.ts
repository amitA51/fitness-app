// ============================================================================
// Billing provider adapter (shared by billing-checkout and billing-webhook)
// ============================================================================
// The payment provider is a business decision that is still open (the audit
// found Stripe does not list Israel as a supported merchant country, and a
// merchant-of-record such as Paddle needs contractual sign-off). To avoid
// blocking the entire commerce path on that decision, everything provider-
// specific is isolated behind this one interface.
//
// To go live:
//   1. Set BILLING_PROVIDER to the adapter key (e.g. 'paddle').
//   2. Set the provider secrets it reads (see each adapter).
//   3. Insert the real rows into public.billing_prices (migration §9).
//
// Until BILLING_PROVIDER is set, both functions return `billing_not_configured`
// and the app stays on the honest pre-launch waitlist paywall.
// ============================================================================

// @ts-expect-error Deno global
export const env = (k: string): string => (Deno.env.get(k) ?? '') as string;

export interface CheckoutRequest {
  userId: string;
  email: string | null;
  priceKey: string;
  providerPriceId: string;
  quantity: number;
  /** Absolute URL to return to on success. Validated against ALLOWED_ORIGIN. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** Hosted checkout URL to redirect the browser to. */
  url: string;
  /** Provider's session/transaction id, stored for reconciliation. */
  providerSessionId: string | null;
}

/** Normalised subscription state extracted from a provider webhook. */
export interface SubscriptionEvent {
  /** Provider's own event id — used for idempotency. */
  eventId: string;
  eventType: string;
  /** When the provider says the state changed (for out-of-order protection). */
  eventAt: string;
  userId: string;
  scope: 'consumer' | 'coach';
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  priceKey: string | null;
  providerPriceId: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete';
  quantity: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingAdapter {
  readonly key: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /**
   * Verify the raw request body against the provider signature header and parse
   * it. MUST use the raw bytes — re-serialising JSON breaks every HMAC scheme.
   * Returns null when the payload is authentic but not subscription-related.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<SubscriptionEvent | null>;
}

export class BillingConfigError extends Error {}
export class WebhookVerificationError extends Error {}

/** Constant-time comparison so signature checks do not leak timing information. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Paddle Billing adapter
// ---------------------------------------------------------------------------
// Secrets: PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_API_BASE
// (https://api.paddle.com or https://sandbox-api.paddle.com).
//
// Paddle signs with `Paddle-Signature: ts=<unix>;h1=<hmac_sha256(ts:body)>`.
// The custom_data we send at checkout is echoed back on every event, which is
// how a webhook is attributed to a Supabase user id.
const paddleAdapter: BillingAdapter = {
  key: 'paddle',

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const apiKey = env('PADDLE_API_KEY');
    const apiBase = env('PADDLE_API_BASE') || 'https://api.paddle.com';
    if (!apiKey) throw new BillingConfigError('PADDLE_API_KEY is not set');

    const response = await fetch(`${apiBase}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: req.providerPriceId, quantity: req.quantity }],
        customer: req.email ? { email: req.email } : undefined,
        // Echoed back on every webhook: the only trustworthy user attribution.
        custom_data: { user_id: req.userId, price_key: req.priceKey },
        checkout: { url: req.successUrl },
      }),
    });

    if (!response.ok) {
      // Never forward the provider body to the browser (P2-07 in the audit).
      console.error('[billing] paddle transaction create failed', response.status);
      throw new Error('provider_unavailable');
    }

    const body = (await response.json()) as {
      data?: { id?: string; checkout?: { url?: string } };
    };
    const url = body.data?.checkout?.url;
    if (!url) throw new Error('provider_unavailable');
    return { url, providerSessionId: body.data?.id ?? null };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<SubscriptionEvent | null> {
    const secret = env('PADDLE_WEBHOOK_SECRET');
    if (!secret) throw new BillingConfigError('PADDLE_WEBHOOK_SECRET is not set');

    const header = headers.get('paddle-signature') ?? '';
    const parts = new Map(
      header
        .split(';')
        .map((segment) => segment.split('='))
        .filter((pair): pair is [string, string] => pair.length === 2)
        .map(([k, v]) => [k.trim(), v.trim()])
    );
    const ts = parts.get('ts');
    const h1 = parts.get('h1');
    if (!ts || !h1) throw new WebhookVerificationError('missing signature');

    // Replay window: reject anything older than five minutes.
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > 300) {
      throw new WebhookVerificationError('signature timestamp outside window');
    }

    const expected = await hmacSha256Hex(secret, `${ts}:${rawBody}`);
    if (!timingSafeEqual(expected, h1)) {
      throw new WebhookVerificationError('signature mismatch');
    }

    const payload = JSON.parse(rawBody) as {
      event_id?: string;
      event_type?: string;
      occurred_at?: string;
      data?: {
        id?: string;
        customer_id?: string;
        status?: string;
        current_billing_period?: { starts_at?: string; ends_at?: string };
        scheduled_change?: { action?: string } | null;
        items?: Array<{ price?: { id?: string }; quantity?: number }>;
        custom_data?: { user_id?: string; price_key?: string; scope?: string };
      };
    };

    const eventType = payload.event_type ?? '';
    if (!eventType.startsWith('subscription.')) return null;

    const data = payload.data ?? {};
    const userId = data.custom_data?.user_id;
    if (!userId) throw new WebhookVerificationError('event has no user attribution');

    const statusMap: Record<string, SubscriptionEvent['status']> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      paused: 'past_due',
      canceled: 'canceled',
    };

    return {
      eventId: payload.event_id ?? `${eventType}:${data.id ?? ''}`,
      eventType,
      eventAt: payload.occurred_at ?? new Date().toISOString(),
      userId,
      scope: data.custom_data?.scope === 'coach' ? 'coach' : 'consumer',
      providerSubscriptionId: data.id ?? '',
      providerCustomerId: data.customer_id ?? null,
      priceKey: data.custom_data?.price_key ?? null,
      providerPriceId: data.items?.[0]?.price?.id ?? null,
      status: statusMap[data.status ?? ''] ?? 'incomplete',
      quantity: data.items?.[0]?.quantity ?? 1,
      currentPeriodStart: data.current_billing_period?.starts_at ?? null,
      currentPeriodEnd: data.current_billing_period?.ends_at ?? null,
      cancelAtPeriodEnd: data.scheduled_change?.action === 'cancel',
    };
  },
};

const ADAPTERS: Record<string, BillingAdapter> = {
  paddle: paddleAdapter,
};

/**
 * The configured adapter, or null when billing is not live yet. Callers must
 * treat null as `billing_not_configured` rather than failing open.
 */
export function getAdapter(): BillingAdapter | null {
  const key = env('BILLING_PROVIDER').trim().toLowerCase();
  if (!key) return null;
  return ADAPTERS[key] ?? null;
}

/** Shared, fail-closed CORS. Mirrors account-delete / coach-invite-accept. */
export function corsHeaders(req: Request, methods = 'POST, OPTIONS'): Record<string, string> {
  const raw = env('ALLOWED_ORIGIN');
  const allowed = (raw ? raw.split(',') : ['http://localhost:5173', 'http://localhost:4173'])
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, paddle-signature',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export const json = (body: unknown, status: number, req: Request): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });

/** Only allow redirect targets on our own configured origins. */
export function isAllowedRedirect(url: string): boolean {
  const raw = env('ALLOWED_ORIGIN');
  const allowed = (raw ? raw.split(',') : ['http://localhost:5173', 'http://localhost:4173'])
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    return allowed.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
