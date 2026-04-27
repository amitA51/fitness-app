// ============================================================================
// Supabase Edge Function: ai-chat
// ----------------------------------------------------------------------------
// מקבל {messages, model?, temperature?, maxTokens?} מהאפליקציה ומעביר אותו
// ל-OpenRouter עם המפתח שיושב ב-Supabase Secrets.
//
// פריסה:
//   supabase functions deploy ai-chat
//
// הגדרת המפתח (פעם אחת):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
//
// החלפה לספק אחר (OpenAI / Anthropic / Groq וכו'):
//   שנה את PROVIDER_URL ו-AUTH_HEADER בסעיף PROVIDER CONFIG למטה.
// ============================================================================

// @ts-expect-error Deno runtime import
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// ----------------------------------------------------------------------------
// PROVIDER CONFIG — שנה כאן כדי להחליף ספק
// ----------------------------------------------------------------------------

const PROVIDER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PROVIDER_SECRET_NAME = 'OPENROUTER_API_KEY';

const EXTRA_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://sparkos-fitness.app',
  'X-Title': 'SPARKOS Fitness',
};

const DEFAULT_MODEL = 'openai/gpt-oss-120b:free';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

// ----------------------------------------------------------------------------
// CORS — origin allow-list מ-ALLOWED_ORIGIN env var (פסיק כמפריד).
// אם origin לא נמצא ברשימה — מחזירים "null" (חוסם CORS).
// ----------------------------------------------------------------------------

function getCorsOrigin(req: Request): string {
  // @ts-expect-error Deno global
  const raw = (Deno.env.get('ALLOWED_ORIGIN') ?? '') as string;
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return allowed.length > 0 && allowed.includes(origin) ? origin : 'null';
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

  const payload = {
    model: parsed.model || DEFAULT_MODEL,
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
