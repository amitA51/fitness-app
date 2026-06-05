// ============================================================================
// Supabase Edge Function: ai-chat
// ----------------------------------------------------------------------------
// מקבל {messages, model?, temperature?, maxTokens?} מהאפליקציה ומעביר אותו
// ל-DeepSeek עם המפתח שיושב ב-Supabase Secrets (המפתח לעולם לא בקוד/ב-bundle).
//
// פריסה:
//   supabase functions deploy ai-chat
//
// הגדרת המפתח (פעם אחת):
//   supabase secrets set DEEPSEEK_API_KEY=sk-xxxxx
//
// החלפה לספק אחר (OpenAI / Anthropic / OpenRouter וכו'):
//   שנה את PROVIDER_URL / PROVIDER_SECRET_NAME / ALLOWED_MODELS בסעיף PROVIDER CONFIG למטה.
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// ----------------------------------------------------------------------------
// PROVIDER CONFIG — שנה כאן כדי להחליף ספק
// ----------------------------------------------------------------------------

// Provider: DeepSeek direct API. It is OpenAI-format compatible (POST
// /chat/completions, Bearer auth, choices[0].message.content), so the request
// build and response parsing below are unchanged from the OpenRouter setup.
const PROVIDER_URL = 'https://api.deepseek.com/chat/completions';
const PROVIDER_SECRET_NAME = 'DEEPSEEK_API_KEY';

// OpenRouter-specific headers are not needed for the direct DeepSeek API.
const EXTRA_HEADERS: Record<string, string> = {};

const DEFAULT_MODEL = 'deepseek-v4-flash';

// Allowlist of models that clients are permitted to request. Any model not in
// this list is silently replaced with DEFAULT_MODEL to prevent a malicious
// caller from specifying an expensive model and burning quota. For the DeepSeek
// DIRECT API these are bare model names (NOT provider-namespaced slugs).
const ALLOWED_MODELS: readonly string[] = ['deepseek-v4-flash', 'deepseek-v4-pro'];
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
// RATE LIMITING — Deno KV with per-user minute + daily buckets
// ----------------------------------------------------------------------------

const RATE_LIMIT_PER_MIN = 10;
const RATE_LIMIT_PER_DAY = 100;
const MIN_BUCKET_TTL_MS = 120_000; // 2 min — covers 1-min window + clock skew
const DAY_BUCKET_TTL_MS = 90_000_000; // 25h — covers 24h window + clock skew

interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  bucket: 'minute' | 'day' | null;
}

async function checkRateLimit(userId: string): Promise<RateLimitDecision> {
  // @ts-expect-error Deno namespace not declared in TS lib
  let kv: Deno.Kv;
  try {
    // @ts-expect-error Deno global
    kv = await Deno.openKv();
  } catch (e) {
    // FAIL CLOSED: if KV is unavailable we cannot enforce the quota, so we must
    // NOT let the request through (failing open would let anyone with the anon
    // key drain the OpenRouter budget). Block and surface a 503 — consistent
    // with coach-invite-accept's rate-limit hardening. Operators should enable
    // Deno KV on their plan or add an ai_rate_limits table.
    // @ts-expect-error Deno global
    console.error('[ai-chat] Deno.openKv unavailable, rejecting request (fail-closed)', e);
    return { allowed: false, retryAfterSeconds: 60, bucket: null };
  }

  const now = Date.now();
  const minuteEpoch = Math.floor(now / 60_000);
  const dayEpoch = Math.floor(now / 86_400_000);

  const minKey = ['rate', userId, 'min', minuteEpoch];
  const dayKey = ['rate', userId, 'day', dayEpoch];

  // Read current counters.
  const [minEntry, dayEntry] = await kv.getMany([minKey, dayKey]);

  const minCount = Number((minEntry.value as { value?: bigint } | null)?.value ?? 0n);
  const dayCount = Number((dayEntry.value as { value?: bigint } | null)?.value ?? 0n);

  if (minCount >= RATE_LIMIT_PER_MIN) {
    const retryAfterSeconds = Math.max(1, 60 - Math.floor((now % 60_000) / 1000));
    return { allowed: false, retryAfterSeconds, bucket: 'minute' };
  }

  if (dayCount >= RATE_LIMIT_PER_DAY) {
    const retryAfterSeconds = Math.max(1, Math.ceil((86_400_000 - (now % 86_400_000)) / 1000));
    return { allowed: false, retryAfterSeconds, bucket: 'day' };
  }

  // Atomic increment of both counters.
  try {
    await kv
      .atomic()
      // @ts-expect-error Deno.KvU64 sum
      .sum(minKey, 1n)
      // @ts-expect-error Deno.KvU64 sum
      .sum(dayKey, 1n)
      .commit();
  } catch {
    // Fallback: best-effort non-atomic write if sum() unsupported.
    try {
      // @ts-expect-error Deno.KvU64 constructor
      await kv.set(minKey, new Deno.KvU64(BigInt(minCount + 1)), { expireIn: MIN_BUCKET_TTL_MS });
      // @ts-expect-error Deno.KvU64 constructor
      await kv.set(dayKey, new Deno.KvU64(BigInt(dayCount + 1)), { expireIn: DAY_BUCKET_TTL_MS });
    } catch (inner) {
      // KV open succeeded but BOTH the atomic and fallback writes failed. Reads
      // already enforced the limit for this request, so we proceed — but log so
      // the outage is visible (never silently swallow).
      // @ts-expect-error Deno global
      console.warn(
        '[ai-chat] rate-limit counter write failed (read-side limit still applied)',
        inner
      );
    }
  }

  // Best-effort TTL refresh — set expiry only when the bucket is fresh so the
  // entry self-evicts after the window closes.
  if (minCount === 0) {
    try {
      // @ts-expect-error Deno.KvU64 + expireIn
      await kv.set(minKey, new Deno.KvU64(BigInt(minCount + 1)), { expireIn: MIN_BUCKET_TTL_MS });
    } catch {
      /* sum() already incremented — ignore */
    }
  }
  if (dayCount === 0) {
    try {
      // @ts-expect-error Deno.KvU64 + expireIn
      await kv.set(dayKey, new Deno.KvU64(BigInt(dayCount + 1)), { expireIn: DAY_BUCKET_TTL_MS });
    } catch {
      /* sum() already incremented — ignore */
    }
  }

  return { allowed: true, retryAfterSeconds: 0, bucket: null };
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
  // with the public anon key from draining the OpenRouter quota.
  const authResult = authorize(req);
  if (authResult.error !== null) {
    return errorResponse(req, 'unauthorized', authResult.error, 401);
  }

  // Per-user rate limiting (Deno KV): caps each user at 10 req/min and
  // 100 req/day before we ever spend OpenRouter budget on them.
  const rateDecision = await checkRateLimit(authResult.userId);
  if (!rateDecision.allowed) {
    // bucket === null means the limiter itself is unavailable (KV down). Fail
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
