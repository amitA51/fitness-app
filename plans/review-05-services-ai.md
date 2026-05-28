# Review 05 — AI Services Layer

**Scope**: `src/services/ai/*`, `src/services/ai.ts`, `src/services/aiProgressionService.ts`,
`src/services/aiWorkoutInsightService.ts`, `supabase/functions/ai-chat/index.ts`
**Date**: 2026-05-28
**Total Lines Reviewed**: ~2,145 across 12 files

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [File-by-File Analysis](#2-file-by-file-analysis)
3. [AI Provider Abstraction Quality](#3-ai-provider-abstraction-quality)
4. [Context Builder Completeness](#4-context-builder-completeness)
5. [Error Handling & Fallback Patterns](#5-error-handling--fallback-patterns)
6. [Security Analysis](#6-security-analysis)
7. [Cost Control Mechanisms](#7-cost-control-mechanisms)
8. [Hebrew Persona Effectiveness](#8-hebrew-persona-effectiveness)
9. [Architectural Concerns](#9-architectural-concerns)
10. [Recommendations Summary](#10-recommendations-summary)

---

## 1. Executive Summary

The AI services layer is **well-designed at the architectural level** — clean provider
abstraction, good separation of concerns into `ai/` subdirectory, resilient fallbacks, and a
security-hardened Edge Function. The Hebrew persona is thoughtfully crafted. However, there are
**critical security and consistency issues** that need immediate attention:

| Severity | Count | Key Issues |
|----------|-------|------------|
| 🔴 Critical | 2 | API key exposed in client bundle; model mismatch between client/server |
| 🟠 High | 4 | No error handling in workout insight service; context builder incompleteness; persona duplication; SRP violation in dashboard service |
| 🟡 Medium | 6 | Duplicated code (streak, weak muscles); fragile regex parsing; inconsistent thresholds; no streaming; `suggestWeight`/`suggestExercises` aren't AI-powered despite names |
| 🔵 Low | 5 | `any` types; duck-typing in `setAIProvider`; missing user profile in context; weak ID generation; `_weakMuscles` unused param |

**Overall Grade**: B- (good architecture, needs hardening)

---

## 2. File-by-File Analysis

### 2.1 `src/services/ai.ts` — Legacy Facade (74 lines)

**Purpose**: Re-exports the new `./ai/` subdirectory API and provides backward-compatible
type aliases and functions for components that haven't migrated.

**Quality Issues**:
- **Line 49**: `import { type ChatMessage, getAIProvider } from './ai/core'` — re-imports
  types already re-exported on line 7. The local functions at lines 52-73 use these
  directly instead of going through the feature layer.
- **Line 67**: `askExerciseQuestion` hardcodes its own system prompt in Hebrew
  (`תתייחס לשאלה שמתייחסת לתרגיל...`) — **bypasses the persona system** defined in
  `config.ts`. When called through `RemoteProvider`, the persona gets prepended via
  `withPersona()`, creating a conflicting double-system-prompt.
- **Lines 38-40**: Legacy type aliases `AICoachMessage` and `ExerciseChatMessage` add
  noise. Should be deprecated with `@deprecated` JSDoc.

**Recommendations**:
- Mark legacy functions with `@deprecated` and track migration
- Route `askExerciseQuestion` through the feature layer to respect persona
- Remove re-imports; use the re-exports

---

### 2.2 `src/services/ai/config.ts` — AI Config (99 lines)

**Purpose**: Central configuration for AI model, request parameters, persona, and the
`withPersona()` helper that prepends the global persona to any message array.

**Quality Issues**:
- 🔴 **Line 32**: `AI_DEFAULT_MODEL = 'deepseek-v4-flash'` — This model string is **NOT
  in the Edge Function's `ALLOWED_MODELS` list** (see `supabase/functions/ai-chat/index.ts`
  line 37-41). When `RemoteProvider` sends this model, the Edge Function silently replaces
  it with `DEFAULT_MODEL = 'openai/gpt-oss-120b:free'`. The client thinks it's using
  DeepSeek but actually gets GPT-OSS.
- **Line 41**: `AI_MAX_TOKENS = 2048` but the Edge Function defaults to
  `DEFAULT_MAX_TOKENS = 1024` (line 43 of Edge Function). When the client sends
  `maxTokens: 2048`, the Edge Function uses it — so this is actually fine. But the
  mismatch in defaults is confusing.
- **Line 40**: `AI_REQUEST_TIMEOUT_MS = 45_000` — 45 seconds is generous. Consider
  whether users will wait that long.

**Strengths**:
- Well-structured persona with clear communication rules
- Anti-sycophancy directives ("אל תתחיל תשובות עם 'מצוין!'")
- Safety rules prioritized (technique > weight, injury awareness)
- `withPersona()` is clean — merges persona with existing system messages

**Recommendations**:
- 🔴 Sync `AI_DEFAULT_MODEL` with the Edge Function's `ALLOWED_MODELS` or add
  `'deepseek-v4-flash'` to the allowlist
- Add a comment in both files cross-referencing each other
- Consider making timeout configurable per-feature (dashboard can be slower than chat)

---

### 2.3 `src/services/ai/core.ts` — Core Provider (350 lines)

**Purpose**: Defines the `AIProvider` interface, three provider implementations
(`LocalFallbackProvider`, `RemoteProvider`, `DirectDeepSeekProvider`), error types,
and the singleton provider factory.

**Quality Issues**:
- **Line 288**: `DirectDeepSeekProvider` sends `thinking: { type: 'enabled' }` — this is
  DeepSeek-specific and **leaks provider details** into the abstraction. If you switch to
  OpenAI or Anthropic, this parameter is meaningless or errors.
- **Lines 334-345**: `setAIProvider` uses duck-typing
  ```typescript
  if ((providerOrConfig as AIProvider).chat)
  ```
  This is fragile — any object with a `chat` property (even accidental) will be treated
  as an `AIProvider`. A discriminated union or separate methods would be safer.
- **Lines 339-344**: When `setAIProvider` receives an `AIConfig` with `apiKey` and
  `model`, it creates a `RemoteProvider` — but never a `DirectDeepSeekProvider`. The
  `AIConfig.apiKey` field is effectively dead code.
- **Lines 79-94**: `LocalFallbackProvider` keyword matching is very primitive — only 5
  keyword groups, all in Hebrew. Any question not matching these gets a generic response.
- **Line 328**: Module-level singleton `currentProvider` — not testable without
  `setAIProvider`. No way to inject a mock provider for unit tests.
- **No streaming support**: The `chat()` interface returns `Promise<string>`. No way to
  stream tokens for real-time UX.

**Strengths**:
- Clean `AIProvider` interface with `chat()` + `isAvailable()`
- `AIError` with typed codes enables proper error handling downstream
- `RemoteProvider` has smart retry logic — skips retry on config/auth/bad_response errors
- AbortController-based timeout in both `RemoteProvider` and `DirectDeepSeekProvider`
- `extractErrorDetails` handles supabase-js error wrapper gracefully

**Recommendations**:
- Remove `thinking` parameter from `DirectDeepSeekProvider` or move to config
- Replace duck-typing with a type guard or separate `setAIProviderFromConfig()` method
- Fix `setAIProvider` to support `DirectDeepSeekProvider` via config
- Add `stream()` method to `AIProvider` interface (future)
- Consider making provider injectable via context for testability

---

### 2.4 `src/services/ai/chat.ts` — Chat Service (115 lines)

**Purpose**: Manages conversation persistence in IndexedDB, message history capping, and
the `sendMessage()` flow that builds the prompt and stores responses.

**Quality Issues**:
- **Line 22-24**: `generateId()` uses `Date.now() + Math.random().toString(36)` — not
  cryptographically secure but acceptable for client-side IDs.
- **Line 64**: History cap `MAX_HISTORY_MESSAGES = 20` — good cost control, but the
  system prompt from `systemPrompt` param is added before the history (line 74-76),
  meaning the total messages sent could be 21+ (system + 20 history + current user).
- **Lines 40-41**: `getCurrentConversation` stores the current conversation ID in
  `localStorage` separately from IndexedDB. If IndexedDB is cleared but localStorage
  isn't, this returns null gracefully — good.
- No message size validation before sending to provider
- No deduplication of identical messages

**Strengths**:
- Clean IndexedDB abstraction via `STORES.AI_CONVERSATIONS`
- Full history persisted locally, only recent slice sent to AI
- Auto-title from first user message (line 87)
- Sorted by `updatedAt` in `getAllConversations`

**Recommendations**:
- Add message content length validation (match Edge Function's 4000 char limit)
- Consider adding a `tokenEstimate` field for cost awareness
- Add conversation export/import for user data portability

---

### 2.5 `src/services/ai/contextBuilder.ts` — Context Assembly (141 lines)

**Purpose**: Builds the `AIContext` object from workout sessions, recovery logs, and
nutrition data. Produces the dynamic system prompt sent to the AI.

**Quality Issues**:
- **Lines 77-93**: Weak muscle calculation uses 80% threshold
  (`v < avgVolume * 0.8`), but `aiDashboardService.ts` line 128 uses 70%
  (`v < avgVol * 0.7`). **Inconsistent thresholds** mean the AI and the dashboard
  may disagree on which muscles are "weak."
- **Lines 105-119**: Streak calculation is **duplicated** from
  `aiDashboardService.ts` lines 132-144. Same algorithm, slightly different variable
  names.
- **Missing user profile data**: No age, weight, experience level, training goals,
  or injury history. The AI can't personalize advice without knowing if the user is
  a 20-year-old beginner or a 45-year-old intermediate.
- **Line 82**: `e.sets.reduce((sum, set) => sum + set.weight * set.reps, 0)` — doesn't
  filter warmup sets, potentially inflating volume calculations.
- **No exercise history per muscle group**: Only recent sessions are analyzed. Long-term
  progression trends per muscle are not available.

**Strengths**:
- Integrates `calculateTrainingLoad` from trainingLoadService — good delegation
- Rich context: volume trends, acute/chronic ratio, fatigue score, readiness score,
  primary constraint, muscle recovery states
- `buildSystemPrompt` produces a structured Hebrew data dump — effective for LLM parsing
- Optional parameters for recovery/nutrition make it flexible

**Recommendations**:
- 🔴 Extract streak calculation to a shared utility (eliminate duplication)
- Unify weak muscle threshold (pick 75% and document the rationale)
- Filter warmup sets from volume calculations
- Add user profile fields to `AIContext` (age, weight, experience, goals)
- Add per-muscle historical volume trend

---

### 2.6 `src/services/ai/features.ts` — AI Features (129 lines)

**Purpose**: High-level AI-powered features: workout advice, weight suggestions,
exercise suggestions, workout summaries, and form tips.

**Quality Issues**:
- 🟠 **Lines 50-70**: `suggestExercises` is **entirely rule-based** — no AI call. It
  returns from a hardcoded Hebrew exercise database. The name is misleading.
- 🟠 **Lines 109-129**: `getFormTips` is also **entirely rule-based** with only 5
  exercises covered. No AI involved.
- 🟠 **Lines 72-107**: `generateWorkoutSummary` is **pure computation** — no AI call.
  It formats workout data into a string. Misleading name.
- **Lines 27-48**: `suggestWeight` creates its own system prompt
  (`'אתה מאמן כושר מקצועי...'`) which **duplicates the persona**. When going through
  `RemoteProvider`, `withPersona()` prepends the full persona, resulting in two
  conflicting system instructions.
- **Line 53**: `_weakMuscles` parameter is declared but never used (prefixed with `_`).
- **Lines 56-65**: Exercise database uses hardcoded Hebrew muscle group names — not
  i18n-friendly and limited to 8 muscle groups.

**Recommendations**:
- Rename non-AI functions: `suggestExercises` → `getExerciseSuggestions`, etc.
  or move them to a separate `ruleBasedFeatures.ts`
- Remove duplicate persona from `suggestWeight` — let `withPersona()` handle it
- Expand exercise database or load from `builtInExercises.ts`
- Remove unused `_weakMuscles` parameter or implement it

---

### 2.7 `src/services/ai/errorMessages.ts` — Error Messages (33 lines)

**Purpose**: Maps `AIError` codes to user-friendly Hebrew messages.

**Quality Issues**:
- **Line 23**: `err.message.toLowerCase()` — keyword matching on error messages is
  fragile but acceptable as a last resort.

**Strengths**:
- Clean `Record<AIErrorCode, string>` mapping — exhaustive and type-safe
- Falls back to keyword matching for non-AIError errors
- All messages in Hebrew, appropriate for the target audience
- Minimal and focused — perfect SRP

**Recommendations**: None — this file is well-written. Consider adding `@deprecated`
codes if error codes change over time.

---

### 2.8 `src/services/ai/bootstrap.ts` — AI Initialization (36 lines)

**Purpose**: One-time initialization of the AI provider based on available configuration.

**Quality Issues**:
- 🔴 **Line 17**: `const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY` —
  `VITE_` prefixed env vars are **bundled into the client JavaScript**. This exposes
  the DeepSeek API key to anyone who inspects the bundle. This is a **critical
  security vulnerability**.
- **Lines 25-27**: Priority order is `DirectDeepSeekProvider > RemoteProvider >
  LocalFallbackProvider`. If both `VITE_DEEPSEEK_API_KEY` and Supabase are configured,
  the direct provider wins — bypassing the Edge Function's rate limiting and model
  allowlist.
- No error handling if `DirectDeepSeekProvider` constructor throws.

**Recommendations**:
- 🔴 **REMOVE `VITE_DEEPSEEK_API_KEY`** — API keys must never be in client bundles.
  Route all DeepSeek calls through the Edge Function.
- If direct DeepSeek is needed for development, document it clearly and ensure it's
  never set in production `.env` files
- Add try/catch around provider construction

---

### 2.9 `src/services/ai/aiDashboardService.ts` — Dashboard Service (604 lines)

**Purpose**: Collects data from all app modules, sends to AI for personalized dashboard
insights, with caching and fallback.

**Quality Issues**:
- 🟠 **SRP Violation**: This 604-line file handles:
  1. Data collection from 5+ modules (`collectDashboardData`, lines 69-309)
  2. Prompt building (`buildDashboardPrompt`, lines 315-372)
  3. Cache management (lines 378-421)
  4. Rate limiting (lines 423-439)
  5. AI invocation (lines 425-480)
  6. Response parsing (`parseDashboardResponse`, lines 486-516)
  7. Fallback logic (`generateFallbackInsight`, lines 522-603)

  This should be split into at least 3-4 smaller modules.

- **Lines 178-206**: Dynamic `await import('../bodyStatsService')` — called twice
  (once for recovery at line 179, once for body weight at line 247). The module is
  imported twice in the same function execution. Should import once and reuse.

- **Line 128**: Weak muscle threshold 70% vs contextBuilder's 80% — inconsistent
  (see section 2.5).

- **Lines 486-500**: `parseDashboardResponse` uses regex to extract structured data
  from free-form AI text. This is **inherently fragile** — if the AI deviates from
  the expected format, parsing fails silently. The `getLine` regex at line 488 could
  match unintended lines.

- **Lines 388-402**: `fingerprintInput` only includes a subset of fields. Changes to
  recovery, nutrition, or water data won't invalidate the cache unless the workout
  data also changes.

- **Line 434**: `MIN_INTERVAL_MS = 60_000` — module-level `lastCallAt` variable is
  lost on page refresh. A user can bypass this by refreshing.

**Strengths**:
- **Excellent fallback**: `generateFallbackInsight` (lines 522-603) is a complete
  rule-based system that ensures the UI always has content, even when AI is unavailable.
- **Smart caching**: Fingerprint-based cache invalidation means the AI is only called
  when data actually changes.
- **Resilient data collection**: Four separate try/catch blocks for recovery, nutrition,
  body weight, and water — one module failing doesn't break others.
- **Lazy imports**: Dynamic `await import()` prevents loading heavy modules at startup.

**Recommendations**:
- 🟠 Split into: `dashboardDataCollector.ts`, `dashboardPromptBuilder.ts`,
  `dashboardCache.ts`, `dashboardInsightService.ts`
- Import body stats module once and reuse
- Unify weak muscle threshold with contextBuilder
- Add recovery/nutrition/water to the fingerprint
- Use structured JSON output from AI (request JSON in the prompt) instead of regex parsing
- Persist `lastCallAt` in sessionStorage for cross-refresh rate limiting

---

### 2.10 `src/services/aiProgressionService.ts` — AI Progression (302 lines)

**Purpose**: AI-enhanced workout progression recommendations, combining algorithmic
base calculations with AI interpretation.

**Quality Issues**:
- **Lines 127-166**: `getAIWeeklyProgressionSummary` calls `buildContext(sessions)`
  without recovery logs or nutrition data — **incomplete context**. The AI gets volume
  trends but no recovery or nutrition info for its weekly summary.
- **Lines 205-252**: `parseAIResponse` uses Hebrew regex patterns to extract warnings
  and tips. Pattern at line 210 `/(\d+(?:\.\d+)?)\s*ק"?ג/` is clever but fragile —
  a response like "במשקל 80 ק\"ג" would match, but "80ק״ג" (different quote char)
  would not.
- **Lines 115**: `as ExerciseWithProgression` type assertion — unnecessary, TypeScript
  can infer this.

**Strengths**:
- **Good architecture**: Delegates to `calculateProgression` for base logic, enhances
  with AI. The AI is an enhancement, not a requirement.
- **Concurrency cap** at line 97: `const CONCURRENCY = 3` — cost-aware parallelism.
- **Robust fallback**: `fallbackResponse` (lines 254-282) provides meaningful advice
  even when AI fails.
- `isReadyToProgress` (lines 288-302) is a pure utility — no AI needed, good design.

**Recommendations**:
- Pass recovery logs and nutrition data to `buildContext` in
  `getAIWeeklyProgressionSummary`
- Replace regex parsing with structured JSON output request
- Remove unnecessary type assertion at line 115

---

### 2.11 `src/services/aiWorkoutInsightService.ts` — Workout Insights (29 lines)

**Purpose**: Thin wrapper that generates a single AI insight from workout data.

**Quality Issues**:
- 🟠 **No error handling**: `provider.chat(messages)` at line 28 can throw, and the
  error propagates unhandled to the caller. Every other AI-calling function in the
  codebase has try/catch with fallback — this one doesn't.
- **Line 10**: `buildContext(sessions)` called without recovery logs or nutrition data —
  incomplete context (same issue as aiProgressionService).
- No fallback response for when AI is unavailable.

**Recommendations**:
- 🟠 Add try/catch with a fallback response:
  ```typescript
  try {
    return provider.chat(messages);
  } catch {
    return 'לא הצלחנו ליצור תובנה. נסה שוב מאוחר יותר.';
  }
  ```
- Pass additional context data if available

---

### 2.12 `supabase/functions/ai-chat/index.ts` — Edge Function (409 lines)

**Purpose**: Supabase Edge Function that proxies AI requests to OpenRouter with auth,
rate limiting, model allowlisting, and CORS.

**Quality Issues**:
- 🔴 **Lines 37-41**: `ALLOWED_MODELS` doesn't include `'deepseek-v4-flash'` which is
  the client's `AI_DEFAULT_MODEL`. Silent fallback to `'openai/gpt-oss-120b:free'`.
- **Lines 98-110**: `decodeJwtPayload` does base64 decode but **does NOT verify the
  cryptographic signature**. This is documented as relying on Supabase's platform
  (line 113-116), but if `verify_jwt = true` is not set in the function config, tokens
  could be forged.
- **Lines 154-167**: Rate limiting uses Deno KV with **fail-open** design — if KV is
  unavailable, requests pass through. This means a KV outage = unlimited requests.
- **Lines 193-230**: Rate limit increment has multiple fallback paths (atomic →
  non-atomic → swallow). The fallback at lines 215-222 re-sets the counter on the
  first request, but the atomic increment at line 197 also runs. On the first request,
  both paths execute — potential double-count. However, since it's rate limiting,
  being slightly over-conservative is acceptable.
- **Line 390**: `text.slice(0, 500)` — truncates upstream error messages. Could lose
  useful debugging info. Consider logging full error server-side.

**Strengths**:
- **Excellent security posture**: JWT auth, model allowlist, body size cap, CORS
  with origin allowlist, rate limiting
- **Structured error responses**: Consistent `{ error: { code, message } }` format
- **Rate limit headers**: Returns `Retry-After` header for client backoff
- **Hebrew rate limit message**: `error_hebrew` field for direct UI display
- **Defense in depth**: Body size cap (64KB), per-message char limit (4000),
  model allowlist — multiple layers of protection
- **Usage passthrough**: Returns `data.usage` to client for monitoring
- **Clean provider config section**: Comments explain how to switch providers

**Recommendations**:
- 🔴 Add `'deepseek-v4-flash'` to `ALLOWED_MODELS` or document the mismatch
- Add `verify_jwt = true` to the function's config.toml if not already set
- Consider fail-closed rate limiting for high-security scenarios
- Log full upstream errors to Supabase logs (not just truncated to client)
- Add request/response logging for monitoring and debugging

---

## 3. AI Provider Abstraction Quality

### Interface Design

The [`AIProvider`](src/services/ai/core.ts:29) interface is minimal and clean:

```typescript
interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  isAvailable(): boolean;
}
```

**Strengths**:
- Single-method interface — easy to implement new providers
- `isAvailable()` enables runtime capability checking
- Three implementations cover all scenarios

**Weaknesses**:
- No streaming support (`AsyncGenerator<string>` or callback)
- No token counting or cost estimation
- No model capability queries
- `isAvailable()` is never checked before calling `chat()` in any consumer

### Provider Switching

Switching providers requires code changes in [`bootstrap.ts`](src/services/ai/bootstrap.ts:21).
There's no runtime configuration or environment-based switching (except the
`VITE_DEEPSEEK_API_KEY` presence check).

**How easy to switch providers**:

| Scenario | Effort | Changes Needed |
|----------|--------|----------------|
| Switch OpenRouter model | Low | Change `AI_DEFAULT_MODEL` in config.ts + add to Edge Function allowlist |
| Switch from OpenRouter to OpenAI | Medium | Change Edge Function's `PROVIDER_URL` + update `EXTRA_HEADERS` |
| Add Anthropic as fallback | Medium | Add new provider class or modify Edge Function to try multiple providers |
| Add streaming | High | Requires `AIProvider` interface change + all consumers |

### Key Issue: Model Mismatch

The client sends [`AI_DEFAULT_MODEL = 'deepseek-v4-flash'`](src/services/ai/config.ts:32)
but the Edge Function's [`ALLOWED_MODELS`](supabase/functions/ai-chat/index.ts:37) only
contains `openai/gpt-oss-120b:free`, `google/gemini-2.0-flash-exp:free`, and
`openai/gpt-4o-mini`. The model is **silently replaced** — no error, no warning.

---

## 4. Context Builder Completeness

### What's Included

The [`buildContext()`](src/services/ai/contextBuilder.ts:55) function provides:

| Category | Fields | Quality |
|----------|--------|---------|
| Volume | weeklyVolume, previousWeeklyVolume, volumeChangePercent, volumeTrend | ✅ Good |
| Training Load | acuteChronicRatio, fatigueScore, readinessScore, primaryConstraint, recommendation | ✅ Excellent |
| Muscles | muscleCoverage, muscleRecovery[], weakMuscles | ✅ Good |
| Recovery | recoveryScore | ⚠️ Only if recoveryLogs passed |
| Nutrition | nutritionCompliance | ⚠️ Only if nutritionData passed |
| Consistency | streakDays | ✅ Good |

### What's Missing

| Missing Data | Impact | Priority |
|-------------|--------|----------|
| **User profile** (age, weight, height, sex, experience level) | AI can't personalize for a 20yo beginner vs 45yo intermediate | 🔴 High |
| **Training goals** (strength, hypertrophy, fat loss, endurance) | AI gives generic advice without knowing goals | 🔴 High |
| **Injury history / limitations** | AI might recommend exercises the user can't do | 🟠 Medium |
| **Equipment availability** | AI might suggest barbell exercises for someone with only dumbbells | 🟡 Low |
| **Deload history** | AI can't recommend deload timing without knowing last deload | 🟠 Medium |
| **Progressive overload rate** | AI can't assess if the user is progressing too fast/slow | 🟠 Medium |
| **Per-muscle volume trends** | AI sees current weak muscles but not whether they're improving | 🟡 Low |
| **Sleep/stress data** | Included in dashboard service but not in contextBuilder | 🟠 Medium |

### Context vs Dashboard Duplication

Both [`contextBuilder.ts`](src/services/ai/contextBuilder.ts:55) and
[`aiDashboardService.ts`](src/services/ai/aiDashboardService.ts:69) calculate:
- Volume trends
- Weak muscles (with different thresholds: 80% vs 70%)
- Streak days (duplicated algorithm)
- Top exercises / muscle coverage

This duplication means changes to the calculation logic must be made in two places.

---

## 5. Error Handling & Fallback Patterns

### Error Type Hierarchy

```
AIError (extends Error)
├── code: AIErrorCode
│   ├── 'config_error'    — missing Supabase config
│   ├── 'auth_error'      — invalid API key (401/403)
│   ├── 'rate_limit'      — too many requests (429)
│   ├── 'network_error'   — fetch failed
│   ├── 'timeout'         — request exceeded timeout
│   ├── 'provider_down'   — upstream 5xx
│   ├── 'bad_response'    — unexpected response format
│   └── 'unknown'         — catch-all
└── status?: number
```

### Fallback Coverage

| Service | Has Fallback | Fallback Quality |
|---------|-------------|-----------------|
| `RemoteProvider` | ✅ Retry logic | Retries on network/timeout/rate_limit |
| `LocalFallbackProvider` | ✅ Built-in | Keyword-based responses |
| `aiDashboardService` | ✅ `generateFallbackInsight` | Complete rule-based scoring system |
| `aiProgressionService` | ✅ `fallbackResponse` | Uses base algorithm recommendation |
| `aiWorkoutInsightService` | ❌ **NONE** | Error propagates unhandled |
| `features.ts` getWorkoutAdvice | ❌ **NONE** | Error propagates unhandled |
| `features.ts` suggestWeight | ❌ **NONE** | Error propagates unhandled |
| `chat.ts` sendMessage | ❌ **NONE** | Error propagates unhandled |

### `humanizeAIError` Coverage

The [`humanizeAIError()`](src/services/ai/errorMessages.ts:18) function handles:
- All `AIError` codes → Hebrew messages ✅
- Generic `Error` with network/timeout keywords → mapped messages ✅
- Unknown errors → generic Hebrew message ✅

**Gap**: No error boundary or global error handler for AI errors. Each component must
individually catch and call `humanizeAIError`.

---

## 6. Security Analysis

### 🔴 CRITICAL: API Key in Client Bundle

[`bootstrap.ts:17`](src/services/ai/bootstrap.ts:17):
```typescript
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
```

`VITE_` prefixed env vars are embedded in the Vite build output. Anyone can inspect
the JavaScript bundle and extract the DeepSeek API key. This key could be used to:
- Make unlimited API calls billed to the owner
- Access DeepSeek's API for other purposes

**Mitigation**: Remove `VITE_DEEPSEEK_API_KEY` entirely. Route all DeepSeek calls
through the Edge Function, which keeps the key in Supabase Secrets.

### Edge Function Security

| Layer | Implementation | Status |
|-------|---------------|--------|
| Authentication | JWT structural validation + anon rejection | ✅ Good (relies on platform for signature) |
| Rate Limiting | Deno KV, 10/min + 100/day per user | ✅ Good (fail-open design) |
| Model Allowlist | `ALLOWED_MODELS` array | ✅ Good |
| Body Size | 64KB cap | ✅ Good |
| Message Size | 4000 chars per message | ✅ Good |
| CORS | Origin allowlist from env var | ✅ Good |
| API Key Storage | Supabase Secrets | ✅ Good |

### JWT Validation Concern

[`decodeJwtPayload()`](supabase/functions/ai-chat/index.ts:98) decodes the JWT
payload but does **not verify the signature**. The comment at line 113-116 states
this is enforced by Supabase's platform when `verify_jwt = true` is set in the
function config. This should be verified in the function's `config.toml`.

### Data Exposure

No user data is sent to the AI provider beyond what's in the prompt. The Edge Function
forwards messages as-is — it doesn't add user IDs or session metadata to the upstream
request. This is good for privacy.

---

## 7. Cost Control Mechanisms

### Client-Side

| Mechanism | Location | Effectiveness |
|-----------|----------|--------------|
| History cap (20 messages) | `chat.ts:20` | ✅ Prevents context bloat |
| Dashboard cache (30-min TTL) | `aiDashboardService.ts:380` | ✅ Reduces redundant calls |
| Dashboard fingerprint | `aiDashboardService.ts:388` | ✅ Only calls AI when data changes |
| Dashboard rate limit (60s) | `aiDashboardService.ts:379` | ⚠️ Lost on page refresh |
| Concurrency cap (3) | `aiProgressionService.ts:97` | ✅ Prevents burst requests |
| `AI_MAX_TOKENS = 2048` | `config.ts:41` | ✅ Caps response size |

### Server-Side (Edge Function)

| Mechanism | Location | Effectiveness |
|-----------|----------|--------------|
| Rate limit: 10 req/min | `index.ts:143` | ✅ Per-user throttle |
| Rate limit: 100 req/day | `index.ts:144` | ✅ Daily budget cap |
| Model allowlist | `index.ts:37` | ✅ Prevents expensive model abuse |
| Body size cap: 64KB | `index.ts:325` | ✅ Prevents large payloads |
| Message cap: 4000 chars | `index.ts:283` | ✅ Per-message limit |
| Default max_tokens: 1024 | `index.ts:43` | ✅ Response size cap |

### Missing Cost Controls

- **No token usage tracking**: The Edge Function returns `data.usage` but nothing
  logs or aggregates it
- **No cost alerting**: No mechanism to alert when approaching budget limits
- **No per-user budget**: Rate limits are request-based, not token-based. A user
  sending 10 requests with 2048 max_tokens uses more budget than 10 requests with
  100 max_tokens
- **No model-based pricing**: The allowlist includes `openai/gpt-4o-mini` which is
  paid — no separate rate limit for paid vs free models

---

## 8. Hebrew Persona Effectiveness

### Persona Design

The [`AI_PERSONA`](src/services/ai/config.ts:55) is well-crafted:

```
אתה מאמן כושר אישי מקצועי בשם "SPARKOS" עם 15 שנות ניסיון בכוח והיפרטרופיה.
```

**Strengths**:
- Clear identity (name, experience level, specialization)
- Anti-sycophancy rules ("אל תתחיל תשובות עם 'מצוין!'")
- No emoji rule ("אל תשתמש באימוג'ים בשום מקרה")
- Safety-first approach ("תמיד תעדיף טכניקה על משקל")
- Direct, concise communication style ("תשובות קצרות ומעשיות")
- Contextual awareness ("אם יצורפו לך נתוני אימון...התבסס עליהם באופן ספציפי")

### Persona Injection

[`withPersona()`](src/services/ai/config.ts:89) cleanly merges the persona with any
existing system messages using `---` separator. This is called by both `RemoteProvider`
and `DirectDeepSeekProvider`.

### Persona Duplication Problem

[`features.ts:41-42`](src/services/ai/features.ts:41) creates its own system prompt:
```typescript
content: 'אתה מאמן כושר מקצועי. ענה בעברית בקצרה ובמעשיות. תן המלצת משקל ספציפית.',
```

When this goes through `RemoteProvider`, `withPersona()` prepends the full persona,
creating **two conflicting system instructions**. The AI receives both the detailed
persona rules AND a simpler instruction, potentially degrading response quality.

### Hebrew Response Parsing

Multiple services parse Hebrew AI responses using regex:
- [`aiDashboardService.ts:488`](src/services/ai/aiDashboardService.ts:488): `SCORE:`, `LABEL:`, `TIP:`, `FOCUS:`
- [`aiProgressionService.ts:210`](src/services/ai/aiProgressionService.ts:210): Weight pattern `/(\d+(?:\.\d+)?)\s*ק"?ג/`
- [`aiProgressionService.ts:215-240`](src/services/ai/aiProgressionService.ts:215): Warning/tip keyword patterns

**Risk**: Hebrew text has multiple quote characters (`"`, `"`, `״`, `׳`), and the regex
patterns only match some. The AI might use different quote characters, causing parsing
failures.

**Recommendation**: Request structured JSON output from the AI instead of parsing
free-form Hebrew text. Example prompt addition:
```
החזר תשובה בפורמט JSON בלבד:
{"score": 75, "label": "מתקדם", "recommendation": "...", "tips": ["..."], "focus": "..."}
```

---

## 9. Architectural Concerns

### 9.1 Code Duplication

| Duplicated Logic | Locations | Impact |
|-----------------|-----------|--------|
| Streak calculation | `contextBuilder.ts:105-119`, `aiDashboardService.ts:132-144` | Bug risk: divergent logic |
| Weak muscle calculation | `contextBuilder.ts:77-93`, `aiDashboardService.ts:111-129` | Different thresholds (80% vs 70%) |
| Volume calculation | `contextBuilder.ts:63-65`, `aiDashboardService.ts:84-92` | Same threshold but separate code |
| System prompt construction | `contextBuilder.ts:33-53`, `aiDashboardService.ts:315-372` | Different formats for same data |

### 9.2 Naming Misleading

Functions named as "AI" that don't use AI:
- [`suggestExercises()`](src/services/ai/features.ts:50) — pure rule-based
- [`getFormTips()`](src/services/ai/features.ts:109) — pure rule-based
- [`generateWorkoutSummary()`](src/services/ai/features.ts:72) — pure computation

This creates confusion about which features actually incur API costs and latency.

### 9.3 Module Dependency Graph

```
ai.ts (facade)
├── ai/core.ts (providers, errors, singleton)
│   └── ai/config.ts (model, persona, params)
├── ai/bootstrap.ts (initialization)
│   └── ai/core.ts
├── ai/chat.ts (conversation management)
│   ├── ai/core.ts
│   └── indexedDBCore.ts
├── ai/contextBuilder.ts (data assembly)
│   ├── trainingLoadService.ts
│   └── bodyStatsService.ts (types only)
├── ai/features.ts (AI features)
│   ├── ai/core.ts
│   ├── ai/contextBuilder.ts
│   └── bodyStatsService.ts (types only)
├── ai/errorMessages.ts
│   └── ai/core.ts
└── ai/aiDashboardService.ts (dashboard insights)
    ├── ai/core.ts
    ├── bodyStatsService.ts (dynamic import)
    ├── nutritionService.ts (dynamic import)
    └── waterService.ts (dynamic import)

aiProgressionService.ts (standalone)
├── ai/core.ts
├── ai/contextBuilder.ts
└── progressionService.ts

aiWorkoutInsightService.ts (standalone)
├── ai/core.ts
└── ai/contextBuilder.ts
```

**Observation**: Clean layered architecture. The `ai/` subdirectory is self-contained
except for the `trainingLoadService` dependency in contextBuilder. The standalone
services (`aiProgressionService`, `aiWorkoutInsightService`) correctly depend on the
`ai/` module rather than reimplementing it.

### 9.4 Missing Abstractions

- **No `AIService` facade** that handles error catching, logging, and fallback uniformly.
  Each consumer must implement its own try/catch.
- **No streaming abstraction** — the `AIProvider.chat()` returns a complete string.
  For real-time chat UX, streaming is essential.
- **No token budget** — no way to estimate or limit total token consumption per session.
- **No response schema validation** — regex parsing is fragile; JSON schema validation
  would be more reliable.

---

## 10. Recommendations Summary

### 🔴 Critical (Do First)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | **API key exposed in client bundle** | `bootstrap.ts:17` | Remove `VITE_DEEPSEEK_API_KEY`, route through Edge Function |
| 2 | **Model mismatch** (client sends `deepseek-v4-flash`, server doesn't allow it) | `config.ts:32` + `index.ts:37` | Add model to allowlist or sync defaults |

### 🟠 High Priority

| # | Issue | File | Fix |
|---|-------|------|-----|
| 3 | No error handling in workout insight service | `aiWorkoutInsightService.ts:28` | Add try/catch with fallback |
| 4 | SRP violation — dashboard service is 604 lines | `aiDashboardService.ts` | Split into 3-4 modules |
| 5 | Persona duplication in `suggestWeight` | `features.ts:41` | Remove inline persona, trust `withPersona()` |
| 6 | Context builder missing user profile data | `contextBuilder.ts` | Add age, weight, goals, experience to `AIContext` |

### 🟡 Medium Priority

| # | Issue | File | Fix |
|---|-------|------|-----|
| 7 | Duplicated streak calculation | `contextBuilder.ts` + `aiDashboardService.ts` | Extract to shared utility |
| 8 | Duplicated weak muscle calculation with different thresholds | same | Unify to single utility with configurable threshold |
| 9 | Fragile Hebrew regex parsing | `aiDashboardService.ts:486`, `aiProgressionService.ts:205` | Request JSON output from AI |
| 10 | No error handling in `getWorkoutAdvice`/`suggestWeight`/`sendMessage` | `features.ts`, `chat.ts` | Add try/catch with fallback |
| 11 | Misleading function names (`suggestExercises`, `getFormTips`) | `features.ts` | Rename or move to `ruleBasedFeatures.ts` |
| 12 | Dashboard cache `lastCallAt` lost on refresh | `aiDashboardService.ts:423` | Persist in sessionStorage |

### 🔵 Low Priority

| # | Issue | File | Fix |
|---|-------|------|-----|
| 13 | Duck-typing in `setAIProvider` | `core.ts:335` | Use discriminated union or type guard |
| 14 | `_weakMuscles` unused parameter | `features.ts:53` | Remove or implement |
| 15 | `DirectDeepSeekProvider` leaks `thinking` param | `core.ts:288` | Move to config or remove |
| 16 | Legacy facade needs `@deprecated` markers | `ai.ts:38-73` | Add JSDoc annotations |
| 17 | No streaming support | `core.ts:29` | Add `stream()` to interface (future) |

---

## Appendix: File Size Summary

| File | Lines | Responsibility Count | Grade |
|------|-------|---------------------|-------|
| `ai.ts` | 74 | 2 (re-export + legacy compat) | A |
| `config.ts` | 99 | 2 (config + persona helper) | A- |
| `core.ts` | 350 | 5 (types, 3 providers, factory) | B+ |
| `chat.ts` | 115 | 3 (CRUD + send + history) | A- |
| `contextBuilder.ts` | 141 | 2 (build context + build prompt) | B+ |
| `features.ts` | 129 | 5 (mixed AI + rule-based) | C+ |
| `errorMessages.ts` | 33 | 1 (error mapping) | A+ |
| `bootstrap.ts` | 36 | 1 (init) | B (security issue) |
| `aiDashboardService.ts` | 604 | 7 (SRP violation) | C |
| `aiProgressionService.ts` | 302 | 4 (advice + plan + summary + utility) | B+ |
| `aiWorkoutInsightService.ts` | 29 | 1 (insight generation) | C (no error handling) |
| `index.ts` (Edge Function) | 409 | 6 (auth, rate limit, proxy, validation, CORS, helpers) | A- |
