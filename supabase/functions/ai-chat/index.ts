// ============================================================================
// Supabase Edge Function: ai-chat
// ----------------------------------------------------------------------------
// מקבל {messages, model?, temperature?, maxTokens?} מהאפליקציה ומעביר אותו
// ל-PoloAI (aggregator תואם-OpenAI) עם המפתח שיושב ב-Supabase Secrets
// (המפתח לעולם לא בקוד/ב-bundle).
//
// פריסה:
//   supabase functions deploy ai-chat
//
// הגדרת המפתח (פעם אחת):
//   supabase secrets set POLOAI_API_KEY=sk-xxxxx
//
// החלפה לספק אחר (OpenAI / Anthropic / OpenRouter וכו'):
//   שנה את PROVIDER_URL / PROVIDER_SECRET_NAME / ALLOWED_MODELS בסעיף PROVIDER CONFIG למטה.
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error remote ESM import (Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ----------------------------------------------------------------------------
// PROVIDER CONFIG — שנה כאן כדי להחליף ספק
// ----------------------------------------------------------------------------

// Provider: PoloAI (https://poloai.top) — an OpenAI-compatible aggregator
// gateway (POST /v1/chat/completions, Bearer auth, choices[0].message.content),
// so the request build and response parsing below are unchanged.
const PROVIDER_URL = 'https://poloai.top/v1/chat/completions';
const PROVIDER_SECRET_NAME = 'POLOAI_API_KEY';

// No provider-specific extra headers needed.
const EXTRA_HEADERS: Record<string, string> = {};

// gpt-5.4-mini is the cheapest/fastest tier this provider offers (base mini,
// not the -high/-xhigh reasoning variants) — good default for chat/coaching use.
const DEFAULT_MODEL = 'gpt-5.4-mini';

// Allowlist of models that clients are permitted to request. Any model not in
// this list is silently replaced with DEFAULT_MODEL to prevent a malicious
// caller from specifying an expensive model and burning quota.
const ALLOWED_MODELS: readonly string[] = ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5'];
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

// ----------------------------------------------------------------------------
// CORS — origin allow-list מ-ALLOWED_ORIGIN env var (פסיק כמפריד).
// מקורות localhost מותרים תמיד (פיתוח); אתר עוין לא יכול להציג Origin כזה,
// כך שזה לא מחליש production. כל מקור אחר שלא ברשימה — "null" (חוסם CORS).
// ----------------------------------------------------------------------------

const LOCALHOST_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getCorsOrigin(req: Request): string {
  // @ts-expect-error Deno global
  const raw = (Deno.env.get('ALLOWED_ORIGIN') ?? '') as string;
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  if (allowed.includes(origin)) return origin;
  if (LOCALHOST_ORIGIN_RE.test(origin)) return origin;
  return 'null';
}

function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// ----------------------------------------------------------------------------
// AUTH — verify Supabase JWT (anon-key not enough; require a real user)
// ----------------------------------------------------------------------------

interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number;
  aud?: string;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    // @ts-expect-error Deno global
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Structural + claims validation. Signature verification is enforced by
 * Supabase's platform when verify_jwt = true in functions config. Here we
 * additionally reject anon role and expired tokens so we never burn the
 * provider quota for an unauthenticated client.
 *
 * !!! SECURITY — CRITICAL DEPENDENCY !!!
 * decodeJwtPayload() ONLY base64-decodes the payload; it does NOT verify the
 * JWT signature. This function therefore TRUSTS that the platform already
 * rejected tokens with an invalid signature. That guarantee holds ONLY while
 * `verify_jwt = true` in supabase/functions/ai-chat/config.toml. If that flag
 * is ever flipped to false, a forged/unsigned token with a fabricated `sub`
 * and a non-anon `role` would pass authorize() and reach the paid provider.
 * Do NOT set verify_jwt = false without first adding real signature
 * verification here (see deferred: explicit JWKS signature check).
 */
function authorize(
  req: Request
): { error: null; userId: string } | { error: string; userId: null } {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return { error: 'missing Authorization bearer token', userId: null };
  }
  const token = header.slice(7).trim();
  if (!token) return { error: 'empty bearer token', userId: null };

  const payload = decodeJwtPayload(token);
  if (!payload) return { error: 'malformed JWT', userId: null };
  if (payload.role === 'anon') return { error: 'anonymous calls not allowed', userId: null };
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    return { error: 'token expired', userId: null };
  }
  if (!payload.sub) return { error: 'token missing sub', userId: null };

  return { error: null, userId: payload.sub };
}

// ----------------------------------------------------------------------------
// RATE LIMITING — Postgres ledger (public.rate_limit_events) with per-user
// minute + daily buckets. Deno KV is NOT used here: it is unavailable on this
// project/tier (Deno.openKv() reliably rejects), which made the fail-closed
// path block 100% of traffic. The same rate_limit_events table already backs
// coach-invite-accept's throttling, so this reuses proven infrastructure.
// ----------------------------------------------------------------------------

const RATE_LIMIT_PER_MIN = 10;
const RATE_LIMIT_PER_DAY = 100;

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  bucket: 'minute' | 'day' | null;
}

async function checkRateLimit(userId: string): Promise<RateLimitDecision> {
  // @ts-expect-error Deno global
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-expect-error Deno global
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!SUPABASE_URL || !SERVICE_KEY) {
    // FAIL CLOSED: without a service-role client we cannot enforce the quota.
    // @ts-expect-error Deno global
    console.error('[ai-chat] missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, rejecting (fail-closed)');
    return { allowed: false, retryAfterSeconds: 60, bucket: null };
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  try {
    const [{ count: minCount }, { count: dayCount }] = await Promise.all([
      admin
        .from('rate_limit_events')
        .select('id', { count: 'exact', head: true })
        .eq('bucket', 'ai_chat_min')
        .eq('subject', userId)
        .gte('created_at', minuteAgo),
      admin
        .from('rate_limit_events')
        .select('id', { count: 'exact', head: true })
        .eq('bucket', 'ai_chat_day')
        .eq('subject', userId)
        .gte('created_at', dayAgo),
    ]);

    if ((minCount ?? 0) >= RATE_LIMIT_PER_MIN) {
      return { allowed: false, retryAfterSeconds: 60, bucket: 'minute' };
    }
    if ((dayCount ?? 0) >= RATE_LIMIT_PER_DAY) {
      return { allowed: false, retryAfterSeconds: 3600, bucket: 'day' };
    }

    // Record this request in both buckets. Best-effort: a failed write here
    // does not let the request bypass the limit (reads above already gated).
    await admin.from('rate_limit_events').insert([
      { bucket: 'ai_chat_min', subject: userId },
      { bucket: 'ai_chat_day', subject: userId },
    ]);

    return { allowed: true, retryAfterSeconds: 0, bucket: null };
  } catch (e) {
    // FAIL CLOSED: ledger unreachable — block rather than let traffic through
    // unmetered (consistent with coach-invite-accept's hardening).
    // @ts-expect-error Deno global
    console.error('[ai-chat] rate_limit_events check failed, rejecting (fail-closed)', e);
    return { allowed: false, retryAfterSeconds: 60, bucket: null };
  }
}

function rateLimitResponse(req: Request, decision: RateLimitDecision): Response {
  const minutes = Math.max(1, Math.ceil(decision.retryAfterSeconds / 60));
  return new Response(
    JSON.stringify({
      error: 'rate_limit_exceeded',
      error_hebrew: `חרגת ממכסת הבקשות, נסה שוב בעוד ${minutes} דקות`,
      retry_after: decision.retryAfterSeconds,
      bucket: decision.bucket,
    }),
    {
      status: 429,
      headers: {
        ...buildCorsHeaders(req),
        'Content-Type': 'application/json',
        'Retry-After': String(decision.retryAfterSeconds),
      },
    }
  );
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function errorResponse(req: Request, code: string, message: string, status: number): Response {
  return jsonResponse(req, { error: { code, message } }, status);
}

function validateRequest(body: unknown): ChatRequest | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') return 'invalid message';
    const msg = m as Record<string, unknown>;
    if (!['system', 'user', 'assistant'].includes(msg.role as string)) {
      return `invalid role: ${msg.role}`;
    }
    if (typeof msg.content !== 'string') return 'message.content must be a string';
    if (msg.content.length > 4000) {
      return `message content exceeds 4000 characters (got ${msg.content.length})`;
    }
  }
  return {
    messages: b.messages as ChatMessage[],
    model: typeof b.model === 'string' ? b.model : undefined,
    temperature: typeof b.temperature === 'number' ? b.temperature : undefined,
    maxTokens: typeof b.maxTokens === 'number' ? b.maxTokens : undefined,
  };
}

// ----------------------------------------------------------------------------
// MAIN HANDLER
// ----------------------------------------------------------------------------

// @ts-expect-error Deno global
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 'method_not_allowed', 'Only POST is allowed', 405);
  }

  // Require an authenticated user (non-anon Supabase JWT). Prevents anyone
  // with the public anon key from draining the provider quota.
  const authResult = authorize(req);
  if (authResult.error !== null) {
    return errorResponse(req, 'unauthorized', authResult.error, 401);
  }

  // Per-user rate limiting (Postgres ledger): caps each user at 10 req/min
  // and 100 req/day before we ever spend provider budget on them.
  const rateDecision = await checkRateLimit(authResult.userId);
  if (!rateDecision.allowed) {
    // bucket === null means the limiter itself is unavailable (DB down). Fail
    // CLOSED with 503 rather than 429 so we never serve traffic we can't meter.
    if (rateDecision.bucket === null) {
      return errorResponse(
        req,
        'rate_limiter_unavailable',
        'Rate limiter temporarily unavailable, please retry shortly',
        503
      );
    }
    return rateLimitResponse(req, rateDecision);
  }

  // Enforce a sane body size cap (defense against giant message arrays).
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  const MAX_BODY_BYTES = 64 * 1024; // 64 KB
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(req, 'payload_too_large', `body > ${MAX_BODY_BYTES} bytes`, 413);
  }

  // @ts-expect-error Deno global
  const apiKey = Deno.env.get(PROVIDER_SECRET_NAME);
  if (!apiKey) {
    return errorResponse(
      req,
      'config_error',
      `Missing ${PROVIDER_SECRET_NAME} in Supabase secrets`,
      500
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 'bad_request', 'Invalid JSON body', 400);
  }

  const parsed = validateRequest(body);
  if (typeof parsed === 'string') {
    return errorResponse(req, 'bad_request', parsed, 400);
  }

  // Enforce the model allowlist: use the client-supplied model only when it is
  // explicitly permitted; fall back to the default for anything else.
  const model =
    parsed.model !== undefined && ALLOWED_MODELS.includes(parsed.model)
      ? parsed.model
      : DEFAULT_MODEL;

  const payload = {
    model,
    messages: parsed.messages,
    temperature: parsed.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: parsed.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  let upstream: Response;
  try {
    upstream = await fetch(PROVIDER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...EXTRA_HEADERS,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return errorResponse(req, 'network_error', `Upstream fetch failed: ${msg}`, 502);
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    const status = upstream.status;
    let code = 'upstream_error';
    if (status === 401 || status === 403) code = 'auth_error';
    else if (status === 429) code = 'rate_limit';
    else if (status >= 500) code = 'provider_down';
    return errorResponse(req, code, text.slice(0, 500), status);
  }

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return errorResponse(req, 'bad_response', 'Provider returned no content', 502);
  }

  return jsonResponse(req, {
    content,
    usage: data.usage ?? null,
    model: payload.model,
  });
});
