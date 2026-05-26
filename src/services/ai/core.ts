// ============================================================================
// AI Core - ממשק ספק AI כללי עם factory pattern
// ============================================================================
//
// יש שני providers:
//   - LocalFallbackProvider: תשובות מבוססות-חוקים, לא דורש חיבור
//   - RemoteProvider: קורא ל-Supabase Edge Function שמתווכת ל-OpenRouter
//
// הבחירה מי פעיל נעשית ב-src/services/ai/bootstrap.ts
// ============================================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  AI_DEFAULT_MODEL,
  AI_FUNCTION_NAME,
  AI_MAX_TOKENS,
  AI_REQUEST_TIMEOUT_MS,
  AI_TEMPERATURE,
  AI_TOP_P,
  DEEPSEEK_BASE_URL,
  withPersona,
} from './config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  isAvailable(): boolean;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

// ----------------------------------------------------------------------------
// שגיאות ממודלות - מאפשרות ל-UI להציג הודעה מתאימה
// ----------------------------------------------------------------------------

export type AIErrorCode =
  | 'config_error'
  | 'auth_error'
  | 'rate_limit'
  | 'network_error'
  | 'timeout'
  | 'provider_down'
  | 'bad_response'
  | 'unknown';

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ----------------------------------------------------------------------------
// LocalFallbackProvider - תשובות מוכנות מראש, בלי אינטרנט
// ----------------------------------------------------------------------------

export class LocalFallbackProvider implements AIProvider {
  isAvailable(): boolean {
    return true;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const query = lastUserMessage?.content.toLowerCase() || '';

    if (query.includes('משקל') || query.includes('weight')) {
      return 'המלצה: העלה משקל ב-2.5% אם השלמת את כל החזרות בקלות בשבוע שעבר. אם לא הצלחת, שמור על אותו משקל.';
    }
    if (query.includes('חזרות') || query.includes('reps')) {
      return 'להיפרטרופיה: 8-12 חזרות. לכוח: 3-6 חזרות. לסיבולת: 15+ חזרות. שמור על טכניקה נכונה לפני שמוסיף משקל.';
    }
    if (query.includes('מנוחה') || query.includes('rest')) {
      return 'זמן מנוחה מומלץ: כוח כבד - 3-5 דקות. היפרטרופיה - 60-90 שניות. סיבולת - 30-60 שניות.';
    }
    if (query.includes('תזונה') || query.includes('nutrition') || query.includes('אוכל')) {
      return 'לבניית שריר: 1.6-2.2ג חלבון לק"ג גוף. עודף קלורי של 300-500 קלוריות. שים דגש על חלבון בכל ארוחה.';
    }
    if (query.includes('שינה') || query.includes('sleep')) {
      return 'שינה היא קריטית להתאוששות ובניית שריר. שאף ל-7-9 שעות שינה בכל לילה. הימנע ממסכים שעה לפני השינה.';
    }
    return 'המשך להתאמן בעקביות, שמור על תזונה מאוזנת ומספיק שינה. עקביות היא המפתח לתוצאות!';
  }
}

// ----------------------------------------------------------------------------
// RemoteProvider - קורא ל-Edge Function ב-Supabase
// ----------------------------------------------------------------------------

interface RemoteProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

export class RemoteProvider implements AIProvider {
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeoutMs: number;
  private retries: number;

  constructor(opts: RemoteProviderOptions = {}) {
    this.model = opts.model ?? AI_DEFAULT_MODEL;
    this.temperature = opts.temperature ?? AI_TEMPERATURE;
    this.maxTokens = opts.maxTokens ?? AI_MAX_TOKENS;
    this.timeoutMs = opts.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
    this.retries = opts.retries ?? 1;
  }

  isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!supabase) {
      throw new AIError('config_error', 'Supabase client not configured');
    }

    const body = {
      messages: withPersona(messages),
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await this.invokeOnce(body);
      } catch (e) {
        lastError = e;
        if (e instanceof AIError) {
          // לא לעשות retry לשגיאות שלא יעזור להם retry
          if (e.code === 'config_error' || e.code === 'auth_error' || e.code === 'bad_response') {
            throw e;
          }
        }
        if (attempt < this.retries) {
          await delay(500 * (attempt + 1));
        }
      }
    }
    throw lastError instanceof AIError ? lastError : new AIError('unknown', String(lastError));
  }

  private async invokeOnce(body: Record<string, unknown>): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const invokePromise = supabase!.functions.invoke(AI_FUNCTION_NAME, {
        body,
      });
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () =>
          reject(new AIError('timeout', `Request timed out after ${this.timeoutMs}ms`))
        );
      });
      const { data, error } = await Promise.race([invokePromise, abortPromise]);

      if (error) {
        // supabase-js עוטף שגיאות HTTP ב-FunctionsHttpError; מנסים לחלץ את ה-payload
        const details = await extractErrorDetails(error);
        throw new AIError(details.code, details.message, details.status);
      }

      if (!data || typeof data !== 'object') {
        throw new AIError('bad_response', 'Empty response from edge function');
      }

      const payload = data as { content?: string; error?: { code?: string; message?: string } };
      if (payload.error) {
        throw new AIError(
          (payload.error.code as AIErrorCode) ?? 'unknown',
          payload.error.message ?? 'Unknown error'
        );
      }
      if (typeof payload.content !== 'string') {
        throw new AIError('bad_response', 'No content field in response');
      }
      return payload.content;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new AIError('timeout', `Request exceeded ${this.timeoutMs}ms`);
      }
      throw new AIError('network_error', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function extractErrorDetails(
  error: unknown
): Promise<{ code: AIErrorCode; message: string; status?: number }> {
  const e = error as {
    context?: { response?: Response; status?: number };
    message?: string;
    status?: number;
  };
  const status = e.context?.status ?? e.status;
  try {
    if (e.context?.response) {
      const body = await e.context.response.json();
      if (body?.error?.code) {
        return {
          code: body.error.code as AIErrorCode,
          message: body.error.message ?? 'Unknown',
          status,
        };
      }
    }
  } catch {
    /* fall through */
  }
  let code: AIErrorCode = 'unknown';
  if (status === 401 || status === 403) code = 'auth_error';
  else if (status === 429) code = 'rate_limit';
  else if (status && status >= 500) code = 'provider_down';
  else if (status && status >= 400) code = 'bad_response';
  return { code, message: e.message ?? 'Request failed', status };
}

// ----------------------------------------------------------------------------
// DirectDeepSeekProvider - קריאה ישירה ל-DeepSeek API (OpenAI-compatible)
// ----------------------------------------------------------------------------

export class DirectDeepSeekProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeoutMs: number;

  constructor(apiKey: string, opts: Partial<RemoteProviderOptions> = {}) {
    this.apiKey = apiKey;
    this.model = opts.model ?? AI_DEFAULT_MODEL;
    this.temperature = opts.temperature ?? AI_TEMPERATURE;
    this.maxTokens = opts.maxTokens ?? AI_MAX_TOKENS;
    this.timeoutMs = opts.timeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: withPersona(messages).map((m) => ({ role: m.role, content: m.content })),
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          top_p: AI_TOP_P,
          thinking: { type: 'enabled' },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const code: AIErrorCode =
          res.status === 401 || res.status === 403
            ? 'auth_error'
            : res.status === 429
              ? 'rate_limit'
              : res.status >= 500
                ? 'provider_down'
                : 'bad_response';
        throw new AIError(code, `DeepSeek API error: ${res.status}`, res.status);
      }

      const data = await res.json();
      const msg = data?.choices?.[0]?.message;
      const content = msg?.content ?? msg?.reasoning_content;
      if (typeof content !== 'string') {
        throw new AIError('bad_response', 'No content in DeepSeek response');
      }
      return content;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new AIError('timeout', `Request exceeded ${this.timeoutMs}ms`);
      }
      throw new AIError('network_error', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

// ----------------------------------------------------------------------------
// Singleton provider
// ----------------------------------------------------------------------------

let currentProvider: AIProvider = new LocalFallbackProvider();

export function getAIProvider(): AIProvider {
  return currentProvider;
}

export function setAIProvider(providerOrConfig: AIProvider | AIConfig): void {
  if ((providerOrConfig as AIProvider).chat) {
    currentProvider = providerOrConfig as AIProvider;
    return;
  }
  const config = providerOrConfig as AIConfig;
  if (config.apiKey && config.model) {
    currentProvider = new RemoteProvider({ model: config.model });
  } else {
    currentProvider = new LocalFallbackProvider();
  }
}

export function resetAIProvider(): void {
  currentProvider = new LocalFallbackProvider();
}
