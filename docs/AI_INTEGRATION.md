# AI Integration — SPARKOS Fitness

מסמך מלא של אופן פעולת ה-AI באפליקציה, איך הוא מוגדר, ואיך לשנות אותו.

---

## 1. סקירה ברמה גבוהה

האפליקציה משתמשת ב-AI במספר פיצ'רים (צ'אט מאמן, ניתוח אימון, המלצות פרוגרסיה, סיכום שבועי, תובנות). יש שכבת-אבסטרקציה אחת — `AIProvider` — עם שני מימושים:

| Provider | מתי פעיל | תלות |
|----------|----------|------|
| `RemoteProvider` | כש-Supabase מוגדר (ברירת מחדל בפרוד) | Supabase Edge Function → OpenRouter |
| `LocalFallbackProvider` | כש-Supabase לא מוגדר, או fallback בשגיאה | ללא — תשובות מבוססות-חוקים |

הבחירה נעשית פעם אחת ב-`initAI()` שנקרא ב-`main.tsx`.

### זרימה עיקרית

```
UI component (AICoach, Progression, וכו')
  ↓  קורא פונקציית-פיצ'ר
src/services/ai/features.ts  |  src/services/ai.ts  |  aiProgressionService.ts
  ↓  getAIProvider().chat(messages)
src/services/ai/core.ts · RemoteProvider
  ↓  withPersona() מוסיף את ה-persona הגלובלי
  ↓  supabase.functions.invoke('ai-chat', { body })
Supabase Edge Function · supabase/functions/ai-chat/index.ts
  ↓  Authorization: Bearer OPENROUTER_API_KEY (מ-Supabase secrets)
OpenRouter API
  ↓
response → חזרה במעלה → UI
```

חשוב: **המפתח של ספק ה-AI לעולם לא נכנס ל-bundle של הדפדפן.** הוא יושב ב-Supabase Secrets, נגיש רק ל-Edge Function.

---

## 2. מפת קבצים

```
src/
├── main.tsx                          # קורא ל-initAI() באתחול
├── lib/supabase.ts                   # Supabase client (VITE_SUPABASE_URL/ANON_KEY)
└── services/
    ├── ai.ts                         # Facade לקריאה מהקומפוננטות (backward compat)
    ├── aiProgressionService.ts       # המלצות פרוגרסיה + סיכום שבועי
    ├── aiWorkoutInsightService.ts    # תובנות אימון
    └── ai/
        ├── config.ts                 # ★ כל ההגדרות במקום אחד
        ├── core.ts                   # AIProvider, RemoteProvider, LocalFallbackProvider, AIError
        ├── bootstrap.ts              # initAI() — קורא פעם אחת
        ├── contextBuilder.ts         # buildContext() — נתוני משתמש לשימוש בפרומפט
        ├── features.ts               # getWorkoutAdvice / suggestWeight / suggestExercises / getFormTips
        ├── chat.ts                   # ניהול שיחות (IndexedDB history)
        └── errorMessages.ts          # humanizeAIError() — ממפה AIError להודעה בעברית

supabase/
└── functions/
    └── ai-chat/
        └── index.ts                  # Edge Function (Deno) שמתווכת ל-OpenRouter
```

---

## 3. תצורה — איפה משנים מה

**כלל:** דברים לא-סודיים → `src/services/ai/config.ts`. דברים סודיים (מפתחות) → Supabase Secrets.

### 3.1 `src/services/ai/config.ts` — מקום אחד לכל מה שצריך לשנות

| קבוע | ערך ברירת מחדל | תפקיד |
|------|----------------|-------|
| `AI_FUNCTION_NAME` | `'ai-chat'` | שם ה-Edge Function ב-Supabase |
| `AI_DEFAULT_MODEL` | `'openai/gpt-4o-mini'` | מודל ברירת המחדל (מזהה של OpenRouter) |
| `AI_REQUEST_TIMEOUT_MS` | `30000` | timeout לבקשה |
| `AI_MAX_TOKENS` | `1024` | מקסימום טוקנים לתשובה |
| `AI_TEMPERATURE` | `0.7` | temperature |
| `AI_PERSONA` | טקסט ארוך | ה-system prompt הגלובלי (אופי המאמן) |

**החלפת מודל:** שנה את `AI_DEFAULT_MODEL`. רשימת מודלים: https://openrouter.ai/models

**שינוי האופי של המאמן:** ערוך את `AI_PERSONA`. הוא מוזרק אוטומטית לכל בקשה (ראה §5).

### 3.2 `supabase/functions/ai-chat/index.ts` — החלפת ספק

ברירת מחדל: OpenRouter. כדי לעבור לספק אחר (OpenAI ישיר, Anthropic ישיר, Groq, וכו'):

1. שנה את `PROVIDER_URL` לנקודת-הקצה של הספק.
2. שנה את `PROVIDER_SECRET_NAME` אם אתה רוצה שם סוד אחר.
3. אם הספק לא תומך בפורמט של OpenAI (Anthropic למשל) — תצטרך גם להתאים את ה-`payload` ואת ה-parsing של `choices[0].message.content`.
4. `EXTRA_HEADERS` — דרישה של OpenRouter; ברוב הספקים אפשר להשאיר ריק.
5. פרוס מחדש: `supabase functions deploy ai-chat`.

### 3.3 משתני סביבה

**קליינט (`.env`):**
- `VITE_SUPABASE_URL` · חובה
- `VITE_SUPABASE_ANON_KEY` · חובה

אין משתני `VITE_` ל-AI. המפתח לא יושב בקליינט.

**Supabase Secrets (שרת):**
- `OPENROUTER_API_KEY` · חובה לפעולת ה-Edge Function

הגדרה:
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

---

## 4. פריסה ראשונית

```bash
# 1. הגדר את המפתח בצד שרת
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx

# 2. פרוס את הפונקציה
supabase functions deploy ai-chat

# 3. ודא שה-.env הקליינט מוגדר
#    VITE_SUPABASE_URL=https://<project>.supabase.co
#    VITE_SUPABASE_ANON_KEY=...

# 4. הרץ את האפליקציה
npm run dev
```

כשהאפליקציה עולה, `initAI()` ב-`main.tsx` קורא ל-`isSupabaseConfigured()`. אם `true` → `RemoteProvider` מופעל. אחרת → `LocalFallbackProvider`.

### בדיקת חיים

בלוג של הדפדפן בזמן העלאה תראה:
```
[ai] AI initialized · RemoteProvider (Supabase Edge Function)
```
או, אם Supabase לא מוגדר:
```
[ai] AI initialized · LocalFallbackProvider (Supabase not configured)
```

---

## 5. Persona + הקשר משתמש — איך הפרומפט נבנה

`RemoteProvider.chat(messages)` לא שולח את `messages` כמו שהוא. הוא קודם קורא ל-`withPersona()`:

```ts
// src/services/ai/config.ts
export function withPersona(messages: ChatMessage[]): ChatMessage[] {
  const existingSystems = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');

  const combinedSystem: ChatMessage = {
    role: 'system',
    content: [AI_PERSONA, ...existingSystems.map((m) => m.content)].join('\n\n---\n\n'),
  };

  return [combinedSystem, ...rest];
}
```

**התוצאה:** כל בקשה אמיתית נשלחת כ:

```
system: <AI_PERSONA הגלובלי>
         ---
        <system prompt ספציפי לפיצ'ר + נתוני משתמש מ-buildSystemPrompt>
user: <שאלת המשתמש>
```

ה-persona מגדיר את האופי. `buildSystemPrompt(context)` ב-`contextBuilder.ts` מוסיף נתונים דינמיים כמו: מגמת נפח, שרירים חלשים, ציון התאוששות, רצף אימונים. כך הסוכן עונה באופן אישי לפי המצב הנוכחי של המשתמש.

**LocalFallbackProvider לא משתמש ב-persona** — הוא מחזיר תשובות קבועות לפי מילות מפתח. זה בכוונה, כי הוא מיועד למצב בלי חיבור.

---

## 6. טיפול בשגיאות

`RemoteProvider` זורק `AIError` עם `code` מטופס:

| code | משמעות |
|------|--------|
| `config_error` | המפתח לא מוגדר ב-Supabase Secrets, או Supabase לא מוגדר בקליינט |
| `auth_error` | הספק דחה את המפתח (401/403) |
| `rate_limit` | חרגת ממכסה (429) |
| `network_error` | אין אינטרנט / fetch נכשל |
| `timeout` | הבקשה חרגה מ-`AI_REQUEST_TIMEOUT_MS` |
| `provider_down` | שגיאת 5xx מהספק |
| `bad_response` | תשובה לא חוקית מהספק |
| `unknown` | כל השאר |

**ב-UI:** קורא ל-`humanizeAIError(err)` מ-`src/services/ai/errorMessages.ts`. מחזיר מחרוזת עברית להצגה. דוגמה ב-`AICoach.tsx`:

```ts
try {
  const response = await askExerciseQuestion(...);
} catch (e) {
  logger.ai.error('Chat error', e);
  setError(humanizeAIError(e));
}
```

**Retry logic:** `RemoteProvider` עושה retry פעם אחת על שגיאות חולפות (network/timeout/rate_limit/provider_down). שגיאות קבועות (`config_error`/`auth_error`/`bad_response`) נזרקות מיד בלי retry.

---

## 7. תבנית לפיצ'ר AI חדש

```ts
// src/services/ai/myNewFeature.ts
import { buildContext, buildSystemPrompt } from './contextBuilder';
import { type ChatMessage, getAIProvider } from './core';
import type { WorkoutSession } from '../../types';

export async function myNewFeature(sessions: WorkoutSession[], question: string): Promise<string> {
  const context = buildContext(sessions);
  const provider = getAIProvider();

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: question },
  ];

  // לא צריך להוסיף persona ידנית — RemoteProvider עושה זאת.
  return provider.chat(messages);
}
```

בקומפוננטה:

```tsx
import { myNewFeature } from '../../services/ai/myNewFeature';
import { humanizeAIError } from '../../services/ai/errorMessages';

try {
  const answer = await myNewFeature(sessions, 'שאלה');
} catch (e) {
  setError(humanizeAIError(e));
}
```

---

## 8. חוזה של ה-Edge Function

**Endpoint:** `POST /functions/v1/ai-chat`
(נקרא דרך `supabase.functions.invoke('ai-chat', { body })`)

**Request body:**
```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "model": "openai/gpt-4o-mini",   // אופציונלי; ברירת מחדל = DEFAULT_MODEL
  "temperature": 0.7,               // אופציונלי
  "maxTokens": 1024                 // אופציונלי
}
```

**Response 200:**
```json
{
  "content": "תשובת המודל כטקסט",
  "usage": { "prompt_tokens": 123, "completion_tokens": 45 },
  "model": "openai/gpt-4o-mini"
}
```

**Response 4xx/5xx:**
```json
{
  "error": {
    "code": "auth_error",
    "message": "details..."
  }
}
```

קודי שגיאה שמוחזרים: `method_not_allowed`, `bad_request`, `config_error`, `auth_error`, `rate_limit`, `provider_down`, `upstream_error`, `bad_response`, `network_error`.

---

## 9. דברים שעוד לא נבנו (רוצה — תוסיפו)

- **Streaming** — כרגע התשובה חוזרת שלמה. streaming ידרוש שינוי ב-Edge Function (SSE) וב-`RemoteProvider`.
- **UI לבחירת מודל/persona ע"י המשתמש** — בכוונה אין. הכל מוגדר מרכזית ב-`config.ts`.
- **מעקב עלויות/usage** — `Usage` מוחזר אבל לא נשמר. אפשר להוסיף טבלת `ai_usage` ב-Supabase ולכתוב כל קריאה.
- **Prompt caching** — אם עוברים ישירות ל-Anthropic, שווה להפעיל caching על `AI_PERSONA` הארוך. דורש שינוי ב-Edge Function.
- **בדיקת חיבור ב-Settings** — כרגע אין UI לכך.
- **הגבלת קצב בצד Edge Function** — כרגע אין rate-limiting. אם המפתח ייחשף לציבור, כדאי להוסיף.

---

## 10. בדיקה ידנית מהירה

```bash
# קריאה ישירה ל-Edge Function (החלף <project-ref> ואת ה-ANON_KEY)
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/ai-chat" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "שלום, אתה עובד?" }
    ]
  }'
```

תשובה תקינה תראה `{"content": "...", "usage": {...}, "model": "..."}`.

---

## 11. Checklist לסוכן חדש שמקבל את הפרויקט

- [ ] קראתי את `src/services/ai/config.ts` — יודע איפה המודל וה-persona
- [ ] אני מבין ש-`RemoteProvider` קורא ל-Edge Function בלבד, לא ישירות לספק
- [ ] אני יודע איפה המפתח יושב (Supabase Secrets, לא `.env`)
- [ ] אני יודע ש-`withPersona()` מזריק אוטומטית ולא צריך לכלול ב-messages ידנית
- [ ] כשכותב פיצ'ר חדש — משתמש ב-`getAIProvider().chat()` ולא מקים provider ידנית
- [ ] בטיפול שגיאות — משתמש ב-`humanizeAIError()`, לא מנסה לפרש `err.message` ידנית
