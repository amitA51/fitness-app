# AI Coach Audit — SparkOS Fitness

Scope: every user-visible "AI coach" surface in the app, the settings overlay that
sits beside it, `src/services/ai/**`, `supabase/functions/ai-chat`, and the paywall
gating. Read-only audit. No file under `src/`, `supabase/` or `e2e/` was touched.

**Method and limits, stated up front.** This is a static read of the tree as of
2026-08-28. No dev server, no Playwright, no browser (another worker owns port
4173). Nothing below was confirmed against a running app, and three things are
therefore **not determined**: (a) whether `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
are populated in the live Netlify environment, (b) whether the `ai-chat` edge
function is actually deployed with `POLOAI_API_KEY` set, (c) whether
`AI_REQUIRES_ENTITLEMENT` is set on that function. Each of those flips the coach
between "real model" and "hardcoded keyword table", so where it matters I state
both branches rather than guessing.

Also note a naming collision that makes this area easy to misread: this app has a
**human** coach product (`src/pages/coach/**`, `src/services/coach/**`,
`src/contexts/CoachContext.tsx`, ~1,400 matches for `coach`) which is a real
trainer↔trainee relationship and is **not** part of this audit. The **AI** coach is
a much smaller thing: two files of UI and one service tree.

---

## Headline

**The AI coach is one screen with three tabs, and only one string on it can come
from a model.**

Counts, user-visible coaching output: **1 REAL · 3 DERIVED · 4 CANNED.**

The single most important finding is not any one of those. It is this: the app
contains a complete, tested, 380-line deterministic coaching engine — readiness,
fatigue, acute:chronic load ratio, per-muscle recovery, data-sufficiency hedging —
and **no code path reaches it at runtime.** `calculateTrainingLoad` has exactly one
non-test caller (`src/services/ai/contextBuilder.ts:246`); `buildContext` has three
non-test callers, and **all three are themselves dead**
(`generateCoachBrief`, `getWorkoutAdvice`, `generateAIWorkoutInsight` — no component
calls any of them). The `CoachBriefCard` that the earlier `plans/HOME-AUDIT.md`
found on the dashboard **no longer exists in the tree** (glob for `**/CoachBrief*`
returns nothing), so the last consumer is gone. The math is not wrong. It is
unplugged.

Second most important: the one Hebrew string that legally discloses AI —
`ExerciseTutorial.tsx:1025`, "טיפים אלה מנוסחים בעזרת AI" — sits directly above a
hardcoded five-entry lookup table (`src/services/ai/features.ts:136-163`). No model
is involved. That is an AI disclosure attached to something that is not AI.

---

## 1. Inventory — every user-visible AI-coach surface

There is no AI coach screen. There is no AI coach route. There are **three**
surfaces total.

| # | Surface | Where | Trigger | What the user sees |
|---|---------|-------|---------|--------------------|
| 1 | Action chip **"מאמן AI"** | `src/components/workout/components/ExerciseDisplay.tsx:913-925` (label `:918`, aria `:923`) | Rendered whenever the `onOpenAICoach` prop exists (`ExerciseDisplay.tsx:497`). During an active workout that is always: `ActiveWorkoutNew.tsx:764` passes `onOpenAICoach={handleOpenTutorial}` | Sparkles icon + "מאמן AI" in the per-exercise chip row |
| 2 | Overflow-menu item **"מדריך"** | `src/components/workout/components/WorkoutHeader.tsx:193-194` | Workout header ⋯ menu | Opens the same panel as #1 |
| 3 | Full-screen panel titled **"מאמן AI"** | `src/components/workout/ExerciseTutorial.tsx` (title `:424`, exercise subtitle `:441`) | `SHOW_TUTORIAL` → `state.showTutorial` (`useWorkoutHandlers.ts:342-344`), rendered at `WorkoutFlowOverlays.tsx:238-266` behind an `OverlayErrorBoundary` and `React.lazy` | Three tabs: **ביצוע** / **שאלה** / **פתק** |
| 4 | Paywall feature row **"מאמן AI"** | `src/pages/billing/PaywallScreen.tsx:73-79` | `/paywall` | Table row: label "מאמן AI", description "תוכנית אימון מותאמת אישית מבוססת AI", free = "—", pro = **"בקרוב"** |

### Inside the panel

**Tab ביצוע (`ExerciseTutorial.tsx:452-654`)**
- `הנחיית התוכנית` — the program's own cue, prop `customNotes`, rendered `dir="auto"` (`:456-482`).
- `הדגמת התרגיל` — up to 2 catalog images from `getExerciseImages` (`:484-518`), per-frame failure hidden individually (`:143`, `:254`).
- `שרירים בעבודה` + ציוד / סוג / כיוון / רמה — `MuscleMap` plus `translateMechanic` / `translateForce` / `translateLevel` (`:520-597`).
- `שלבי הביצוע` — a step carousel with an `sr-only` live region (`:600-606`) and a segmented spine. Content resolution order at `:231-237`:
  1. curated table keyed on the **English** exercise name — only `Bench Press`, `Squat`, `Deadlift` (`:185-227`);
  2. else `splitInstructionSteps(instructions)` over the catalog's own cue text;
  3. else a generic three-beat outline (`:172-183`).

**Tab שאלה (`ExerciseTutorial.tsx:657-757`)**
- Free-text input + "שלחו למאמן" (`:700-724`), sub-label "התשובה מבוססת על הנתונים האמיתיים שלכם בתרגיל הזה" (`:679-692`).
- `תשובת המאמן` — the answer card (`:726-745`).
- Error line, `role="alert"`, from `humanizeAIError` (`:747-759`).
- `טיפים לטכניקה` — a button "הציגו טיפים לטכניקה" that loads text on demand (`:762-800`), followed by the AI + medical disclaimer (`:1014-1027`).

**Tab פתק (`ExerciseTutorial.tsx:830-...`)** — a set note textarea, six hardcoded
quick-note chips (`QUICK_NOTES`, `:60-67`), save + "הפתק נשמר" status. This is note
*capture*, not coaching, but it lives under a heading that says "מאמן AI".

### Dead machinery in the same area

`showAICoach` exists as reducer state (`workoutTypes.ts:94`, init `:371`,
`WorkoutProvider.tsx:187`), has two actions (`workoutTypes.ts:243-244`, handled at
`workoutReducerUiHandlers.ts:112-117`), a `ModalType` member `'aicoach'`
(`workoutTypes.ts:277`, handled `workoutReducerUiHandlers.ts:142`), is exposed on
the context (`WorkoutContext.tsx:155,169`), and is threaded as `onCloseAICoach`
through `WorkoutOverlays.tsx:109,187` → `WorkoutFlowOverlays.tsx:97,152,243`.
**`OPEN_AI_COACH` is never dispatched anywhere in `src/`, and nothing renders on
`showAICoach`.** The only dispatch is `CLOSE_AI_COACH` (`useWorkoutHandlers.ts:421`),
which sets `false` on a value that is already `false`.

---

## 2. Classification

Legend, as commissioned: **REAL** = text produced by an actual model call at
runtime · **DERIVED** = computed from the user's real data by local logic ·
**CANNED** = a hardcoded or template string presented as intelligence.

| Output | Class | Evidence |
|--------|-------|----------|
| `תשובת המאמן` (ask tab answer) | **REAL** — conditionally | `ExerciseTutorial.tsx:344` → `askExerciseQuestion` (`src/services/ai.ts:109-136`) → `provider.chat`. REAL only while `RemoteProvider` is the active provider |
| `הנחיית התוכנית` | **DERIVED** | Program/coach-authored `customNotes` passed through verbatim (`ExerciseTutorial.tsx:474`). Real user-scoped data, zero inference |
| Muscle map + ציוד/סוג/כיוון/רמה | **DERIVED** | Exercise-catalog metadata translated locally (`ExerciseTutorial.tsx:239-247, 520-597`) |
| `שלבי הביצוע` when the catalog has a cue | **DERIVED** | `splitInstructionSteps(instructions)` (`ExerciseTutorial.tsx:234`) segments the exercise's own text |
| `שלבי הביצוע` for Bench Press / Squat / Deadlift | **CANNED** | Hardcoded `exerciseTips` table, 3 keys (`ExerciseTutorial.tsx:185-227`) |
| `שלבי הביצוע` fallback (every other exercise with no cue) | **CANNED** | Three fixed beats: "תחילת תנועה / טכניקה / סיום" (`ExerciseTutorial.tsx:172-183`) |
| `טיפים לטכניקה` — **labelled as AI** | **CANNED** | `getExerciseTutorial` (`src/services/ai.ts:69-74`) → `getFormTips` (`features.ts:136-163`): a 5-key Hebrew lookup (`סקווט`, `לחיצת חזה`, `דדליפט`, `חתירה`, `לחיצת כתפיים`) with a 3-item generic fallback at `:152-156`. **No provider call at all.** The disclosure at `ExerciseTutorial.tsx:1025` claims otherwise |
| `תשובת המאמן` when Supabase is unconfigured | **CANNED** | `LocalFallbackProvider.chat` (`core.ts:74-121`): a keyword table on משקל / חזרות / מנוחה / תזונה / שינה, with a catch-all at `core.ts:116`. This is the **boot default** (`core.ts:295`) |

**REAL: 1 · DERIVED: 3 · CANNED: 4.**

The REAL count is 1 and it is conditional. `initAI()` (`main.tsx:129` →
`src/services/ai/bootstrap.ts:18-29`) picks `RemoteProvider` only when
`isSupabaseConfigured()` is true, which is purely `Boolean(VITE_SUPABASE_URL &&
VITE_SUPABASE_ANON_KEY)` (`src/lib/supabase.ts:10,51`). **There is no `.env` in the
repo** (only `.env.example`), so in any plain local checkout the answer in
"תשובת המאמן" is the keyword table — and the user cannot tell, because the copy
above the box says the answer is based on their real data.

### A fourth bucket the brief did not ask for: UNREACHABLE

These produce coaching content of real quality and **nothing displays them.** They
are neither REAL nor CANNED to the user, because the user never sees them.

| Unit | Where | Status |
|------|-------|--------|
| `generateCoachBrief` / `buildCoachFacts` / `deterministicProse` | `src/services/ai/coachBrief.ts:110,119,189` | Only caller is `src/services/ai/__tests__/coachBrief.test.ts`. The consumer (`CoachBriefCard`) has been deleted from the tree |
| `buildContext` / `buildSystemPrompt` | `src/services/ai/contextBuilder.ts:240,67` | Called only from the three dead features below (+ tests) |
| `calculateTrainingLoad` — readiness, fatigue, ACWR, per-muscle recovery | `src/services/trainingLoadService.ts:272`; readiness at `:349` (`100 − fatigueScore`) | Sole non-test caller is `contextBuilder.ts:246`, which is itself unreachable |
| `generateAIWorkoutInsight` | `src/services/aiWorkoutInsightService.ts:14` | Called only from `useFitnessInsights.ts:150`; the hook's `aiInsight` / `generateAIInsight` outputs (`:53-58`) are never destructured by any component — `Dashboard.tsx:52-58` takes only `workoutSessions`, `weekOverWeekDeltas`, `muscleGroups`, `error` |
| `getWorkoutAdvice`, `suggestWeight` | `src/services/ai/features.ts:24,44` | Zero callers in `src/` outside the `ai.ts` re-export |
| `suggestExercises`, `generateWorkoutSummary` | `features.ts:74,99` | Zero callers. Both are rule-based anyway, not model calls |
| Conversation layer: `sendMessage`, `createConversation`, `getAllConversations`, `deleteConversation`, IndexedDB `AI_CONVERSATIONS` store, cloud sync + tombstones | `src/services/ai/chat.ts` (whole file) | No UI consumer. There is no chat screen. The ask tab calls `askExerciseQuestion` directly and persists nothing |
| `computeNutritionAdherence` | `src/services/intelligence/nutritionAdherence.ts:35` | Only `contextBuilder.ts:283` (+ tests) |
| `ProgressionRecommendation` component | `src/components/workout/ProgressionRecommendation.tsx` | Imported by nothing |

Note also: the dashboard's one visible "תובנה" line is **DERIVED and honest** —
`pickDashboardInsight` (`src/components/dashboard/insightPicker.ts:35-64`) is pure
local math over week-over-week volume and days-since-trained, returns `null` when
nothing qualifies, and its header comment explicitly refuses to invent an
always-fillable affirmation. That is the pattern the rest of this area should copy.

---

## 3. The settings — `WorkoutSettingsOverlay.tsx`

First, the answer to the question the owner actually asked: **there are no AI-coach
settings.** Not one. The five tabs are `כללי / מנוחה / שמע / אימון / מתקדם`
(`SettingsPrimitives.tsx:22-27`); no tab, toggle, slider or chip in this overlay
touches the coach. `grep` for AI settings across `src/pages/settings/sections/**`
also finds none (`CoachSection.tsx` is the human-coach relationship). "Improve the
AI coach *and its settings*" starts from zero settings.

Second, the trace. Every control, and the code that reads it:

| Control (Hebrew label) | Key | Read by | Verdict |
|---|---|---|---|
| מטרת אימון | `defaultWorkoutGoal` | `useWorkoutEffects.ts:173`, `workoutReducerHelpers.ts:104`, `useWorkoutSave.ts:135`, `WorkoutActions.tsx:301` | wired |
| מצב כהה | `darkMode` (app-level) | `SettingsContext.tsx:205` toggles `html.dark` | wired |
| רטט | `hapticsEnabled` | `SettingsContext.tsx:213-215` → `setHapticsEnabled`; `useWorkoutSettings.ts:191` | wired |
| שמור מסך דלוק | `keepAwake` | `WorkoutProvider.tsx:376-384`; also re-checked inside `keepScreenAwake` (`useWorkoutSettings.ts:~200`) | wired |
| זמן מנוחה | `defaultRestTime` | `workoutReducerHelpers.ts:76`, `ActiveWorkoutNew.tsx:315` | wired |
| רטט בסיום מנוחה | `restTimerVibrate` | `WorkoutProvider.tsx:321`, `useWorkoutTimer.ts:108` | wired |
| צליל בסיום מנוחה | `restTimerSound` | `WorkoutProvider.tsx:324`, `useWorkoutTimer.ts:107` | wired |
| טיימר אוטומטי | `autoStartRest` | `workoutReducerSetHandlers.ts:196` | wired |
| הוספת סטים אוטומטית | `autoAddSets` | `workoutReducerSetHandlers.ts:154-155` | wired |
| צלילים מופעלים | `soundEnabled` | `SettingsContext.tsx` audio sync; `WorkoutProvider.tsx:307` | wired |
| ביפים בספירה לאחור | `countdownBeepEnabled` | `useWorkoutSettings.ts:186` → `useAudioBeep` → `InlineRestTimer.tsx:92` | wired |
| הצג הנחיות חימום | `warmupPreference` | `useWorkoutEffects.ts:172-181`, `useWorkoutHandlers.ts:433-434` | **partly dead — see D2** |
| הצג הנחיות צינון | `cooldownPreference` | `useWorkoutHandlers.ts:222-228` | **partly dead — see D3** |
| תזכורת לשתות מים (+ interval) | `waterReminderEnabled` / `waterReminderInterval` | `useWorkoutEffects.ts:243-245` | wired |
| ערכים מאימון קודם | `showGhostValues` | `ActiveWorkoutNew.tsx:332`, `WorkoutPlanScreen.tsx:92,374-375`, `usePreviousSetData.ts:42-43` | wired |
| תצוגה מקדימה של נפח | `showVolumePreview` | `ActiveWorkoutNew.tsx:333`, `ExerciseDisplay.tsx:76` | wired |
| כפתורי משקל מהירים | `enableQuickWeightButtons` | `ActiveWorkoutNew.tsx:247` | wired |
| כפתורי חזרות מהירים | `enableQuickRepsButtons` | `ActiveWorkoutNew.tsx:248` | wired |
| הגדלה אוטומטית של משקל (+ amount) | `autoIncrementWeight` / `weightIncrementAmount` | `workoutReducerSetHandlers.ts:145-146` | wired |
| **התראות שיא אישי** | **`enablePRAlerts`** | **nothing** | **DEAD — see D1** |
| צמצום אנימציות | `reducedAnimations` | `SettingsContext.tsx:195-198` → `html.reduce-motion`; `motion.css:361-368` | wired |
| טקסט גדול | `largeText` | `SettingsContext.tsx:204` → `html.large-text`; `tokens.css:245` | wired |
| ניגודיות גבוהה | `highContrast` | `SettingsContext.tsx:200-203` → `html.high-contrast`; `tokens.css:576-613` | wired |

### D1 — `enablePRAlerts` ("התראות שיא אישי") is a fully dead toggle

`WorkoutSettingsOverlay.tsx:432-437` writes it. Nothing gates on it. The PR
celebration is dispatched unconditionally on a real PR
(`usePersonalRecords.ts:186`), and the only setting that suppresses it is
`prCelebrationIntensity` — checked at `workoutReducerUiHandlers.ts:154` (confetti)
and `ActiveWorkoutNew.tsx:690` (`!== 'off'` gates the card). That key is **not in
this overlay**. `enablePRAlerts` has two accessors built for it,
`useWorkoutSettings.ts:524` (`alertsEnabled`) and `useEnablePRAlerts()` at
`:660-662`; **neither has a single consumer in `src/`.**

Net effect: a user who turns "התראות שיא אישי" off still gets the full PR
celebration, including confetti. The control is worse than absent, because it
teaches the user the app ignores them.

### D2 — `warmupPreference`: three chips, two behaviours

`תמיד` and `שאל` are indistinguishable. `useWorkoutEffects.ts:180` branches on
`warmupPreference !== 'never'`, and `useWorkoutHandlers.ts:434` treats
`'always' || 'ask'` as one case. Only `אף פעם` changes anything.

### D3 — `cooldownPreference`: `שאל` is a no-op and `אף פעם` does not mean never

`useWorkoutHandlers.ts:222-228` branches **only** on `'always'`. `'ask'` and
`'never'` both fall through to the finish-confirm sheet — and that sheet renders
its cooldown button on `isFinishing && onCooldown` with no reference to the
preference (`ConfirmExitOverlay.tsx:431`), while `WorkoutFlowOverlays.tsx:164`
passes `onCooldown` unconditionally. So a user who selects **אף פעם** is still
offered the cooldown. The label is factually wrong.

### One more, adjacent

The overlay's own "Advanced" preamble asserts *"כולן משפיעות על התנהגות האימון בזמן
אמת"* (`WorkoutSettingsOverlay.tsx:377-381`) — "all of them affect workout behaviour
in real time". `enablePRAlerts` is in that section.

---

## 4. `src/services/ai.ts` and the service tree

`src/services/ai.ts` is a **facade**: lines 1-41 are re-exports of `./ai/*`, and
lines 43-136 hold the only live logic — `sanitizeForPrompt` (`:54-61`),
`getExerciseTutorial` (`:69-74`), `buildExerciseGrounding` (`:83-107`) and
`askExerciseQuestion` (`:109-136`).

### Provider and model

Two providers, selected once at boot.

- `LocalFallbackProvider` (`core.ts:74-121`) — the module-level default
  (`core.ts:295`). Pure keyword matching, no network. It also sniffs the system
  prompt for `המלצת עומס מתמטית: push|maintain|deload|rest` (`core.ts:87-96`) so it
  stays consistent with the deterministic engine — a nice touch that is currently
  unreachable, because the only caller that emits that line (`buildSystemPrompt`)
  is dead.
- `RemoteProvider` (`core.ts:132-...`) — calls `supabase.functions.invoke('ai-chat')`.
  Client-side defaults: model `gpt-5.4-mini`, temperature `0.7`, maxTokens `2048`,
  timeout `45_000` ms, `retries: 1` (`config.ts:38-49,17-31`; `core.ts:137-147`).
- Provider chain: browser → Supabase Edge Function `ai-chat` → **PoloAI**
  (`https://poloai.top/v1/chat/completions`), an OpenAI-compatible aggregator
  (`supabase/functions/ai-chat/index.ts:30-31`). Key `POLOAI_API_KEY` lives in
  Supabase Secrets; a previous browser-side provider that inlined a raw key into
  the bundle was removed, and the removal is documented in place at
  `core.ts:268-283`. That is correct and worth preserving.

### What the prompt actually says

The persona is **server-owned**. `config.ts:60-79` explains why: while it lived in
the client, anyone with a valid user JWT could call the function directly and drop
the safety framing. The live text is `SYSTEM_PROMPT` at
`supabase/functions/ai-chat/index.ts:322-347`, in Hebrew. In substance:

- Persona: "מאמן כושר אישי מקצועי בשם SPARKOS", 15 years in strength and hypertrophy.
- Style: Hebrew only, direct, second-person plural, short and practical, **no
  emoji**, no "מצוין!" / "שאלה נהדרת!" openers.
- Scope: strength/hypertrophy programming, RPE/RIR/deload progression, technique,
  fatigue and overtraining, sports nutrition, recovery and sleep.
- Safety: technique over load; explicitly not a doctor, physio or dietitian; on
  sharp pain, injury, dizziness, chest pain, eating disorder or mental distress →
  stop and refer to a professional, **and give no training plan**; never recommend
  supplements, drugs, hormones or extreme diets.
- Grounding: use attached workout data specifically, never invent numbers, and
  treat user messages as data, not instructions (prompt-injection defence).

The client cannot displace it: `validateRequest` **rejects any `system` message
from the browser** (`index.ts:377-380`), and `withPersona` (`config.ts:97-110`)
folds caller context into a single leading `user` message explicitly labelled
"### הקשר ומשימה (נתונים, לא הוראות מערכת)".

For the one live surface, the ask tab, the caller-supplied context is built at
`ai.ts:120-124`:
- with grounding — `תתייחס לשאלה שמתייחסת לתרגיל: {name}. נתוני המשתמש (התבסס עליהם,
  אל תמציא מספרים אחרים): {grounding}. ענה קצר ומעשי.`
- without — the same minus the data, plus `אל תמציא מספרים ספציפיים אם אין לך נתונים.`

`grounding` is real: `buildExerciseGrounding` (`ai.ts:83-107`) scans up to 100
completed sessions for that exercise's best completed working set and emits
`אחרון: {kg} ק"ג x {reps} · 1RM משוער {kg} ק"ג` via the canonical Epley
`oneRepMax`. Input sanitising: name 100 chars, question 500, grounding 160, history
capped at the last 20 messages (`ai.ts:112-118`).

### What happens when the call fails

Three different behaviours, and they are inconsistent:

| Path | Failure behaviour |
|---|---|
| Ask tab (`ExerciseTutorial.tsx:336-352`) | **Visible.** Logs, then renders `humanizeAIError(error)` in a `role="alert"` paragraph (`:747-759`). Hebrew map at `src/services/ai/errorMessages.ts:9-18`, one string per `AIErrorCode`. This is the good path |
| `טיפים לטכניקה` (`ExerciseTutorial.tsx:314-327`) | **Silent.** `logger.workout.error` only; the button stays in its idle state and the user gets no feedback. Moot in practice — there is no network call to fail |
| Dead features (`features.ts:38-40,64-66`; `aiWorkoutInsightService.ts:38-40`) | Swallow the error and return a **canned Hebrew sentence** — "לא הצלחתי להפיק עצה כרגע. בדוק את החיבור לאינטרנט…" — indistinguishable to a caller from a real answer. `generateCoachBrief` (`coachBrief.ts:239-245`) does this properly instead: it falls back to the deterministic template and stamps `source: 'deterministic'` so the UI can label it |

One real defect on the live path. `isSupabaseConfigured()` tests only that the two
env vars exist (`src/lib/supabase.ts:10,51`) — it does not test that a user is
signed in. So for a **guest or signed-out user** on a configured build,
`RemoteProvider` is active, `functions.invoke` sends the anon key as the bearer
token, and the edge function rejects `role === 'anon'` (`index.ts:148`) with 401 →
`auth_error` → the user is told *"בעיית הרשאה בשירות ה-AI. נסה שוב מאוחר יותר."*
The `LocalFallbackProvider` that exists precisely for this case is never reached.
Not browser-verified; the code path is unambiguous.

### Cost, rate and token guards — these exist, and they are good

This is the one part of the coach that is genuinely production-grade, and it is all
in `supabase/functions/ai-chat/index.ts`:

- **Auth**: bearer required, `role: 'anon'` rejected, expiry checked, `sub` required
  (`:135-158`). `verify_jwt = true` in `supabase/functions/ai-chat/config.toml`, and
  the code documents at `:121-133` that its own decode does **not** verify the
  signature and therefore depends on that flag — do not flip it.
- **Rate limit**: 10/min and 100/day per user (`:163-164`), atomic via
  `consumeRateLimits` against the Postgres `rate_limit_events` ledger
  (`:239-270`). **Fails closed**: no service-role client → reject (`:225-233`);
  limiter unavailable → 503, not 429 (`:452-459`). The comment at `:153-160`
  records that Deno KV was tried and blocked 100% of traffic.
- **Model allowlist**: `['gpt-5.4-mini','gpt-5.4','gpt-5.5']`; anything else is
  silently replaced with the default so a caller cannot request an expensive model
  (`:43-44`, `:503-507`).
- **Token/size clamps**: `maxTokens` clamped to 64-2048, `temperature` to 0-1.2
  (`:47-50`, `:395-407`); ≤30 messages, ≤4,000 chars each, ≤24,000 chars total
  (`:302-309`, `:355-390`); body ≤64 KB (`:475-479`).
- **Entitlement gate**: `has_feature_access('ai_coach')` called **as the caller**,
  fails closed, but **inert unless `AI_REQUIRES_ENTITLEMENT === 'true'`**
  (`:186-234`, invoked `:462-471`).
- **Leak discipline**: upstream error bodies and fetch messages are logged
  server-side and never echoed (`:539-543`, `:546-559`).
- **CORS**: `ALLOWED_ORIGIN` allow-list plus localhost, everything else `"null"`
  (`:52-77`).

Client-side guards are thinner: history capped at 20 (`ai.ts:117`; also
`MAX_HISTORY_MESSAGES` in `chat.ts:24`), one retry with a 500 ms/1000 ms backoff and
no retry on `config_error` / `auth_error` / `bad_response` (`core.ts:~160-180`). One
honest limitation is documented rather than hidden: `supabase-js`'s
`functions.invoke` accepts no `AbortSignal`, so the 45 s timeout only races a
rejection — **the upstream request stays in flight and is still billed**
(`core.ts:~190-196`).

Existing test coverage worth knowing about before anyone changes this:
`src/services/__tests__/aiSafety.test.ts`, `aiMessageContract.test.ts`,
`aiContextBuilder.test.ts`, `src/services/ai/__tests__/coachBrief.test.ts`,
`chatDelete.test.ts`, `src/services/__tests__/trainingLoadService.test.ts`.

---

## 5. The paywall

**Nothing is gated. The AI coach is free to everyone, and the paywall says it does
not exist yet.**

- `ai_coach` is declared a premium feature (`src/services/billing/types.ts:33`).
- The enforcement components exist and are complete: `PlanGate`
  (`src/contexts/EntitlementContext.tsx:92-101`) and `PremiumLock`
  (`src/components/billing/PremiumLock.tsx:189-199`, whose own JSDoc example is
  literally `<PremiumLock featureKey="ai_coach">`).
- **Neither is used anywhere in `src/`.** A repo-wide grep for `PremiumLock`,
  `PlanGate` and `featureKey=` returns only their own definition files. No call
  site. So client-side gating for **every** premium feature — not just the coach —
  is currently zero.
- The chip and the panel carry no entitlement check: `ExerciseDisplay.tsx:497` gates
  on the presence of a callback, `ActiveWorkoutNew.tsx:764` always supplies it.

**What a non-paying user sees:** exactly what a paying user sees. The chip, the
panel, all three tabs, and a live model call — subject only to the server's
10/min · 100/day per-user quota. Whether the server refuses them depends on
`AI_REQUIRES_ENTITLEMENT`, which is **not determined** from the repo. If it is
`'true'`, a free user's question fails with 402 `premium_required`, which
`errorMessages.ts` has no mapping for and so surfaces as the generic
*"משהו השתבש. נסה שוב."* — an upsell moment rendered as a bug.

**What the paywall claims:** `/paywall` lists "מאמן AI" **last** with pro value
**"בקרוב"** and free value "—". The code comment above the table
(`PaywallScreen.tsx:32-35`) says the ordering is deliberate: *"The AI coach is not
yet wired (the chat endpoint returns 503), so its row is honestly future-tense."*
So the paywall is more honest than the workout screen. Two contradictory claims now
ship side by side: the paywall says "coming soon, paid", the workout screen ships it
free with an AI disclosure on a hardcoded table.

Also relevant: there is no purchase path. `PurchasePanel` renders only when billing
is live, and the CTA is a waitlist (`joinWaitlist('paywall')`,
`PaywallScreen.tsx:280-289`), with the copy *"מנוי הפרימיום יושק בקרוב"*
(`:527`). Gating the coach today would gate it behind something nobody can buy.

---

## 6. Competitor research

Four named apps. I separate **ships** (documented on the vendor's own feature/store
page, describing a control a user touches) from **claims** (marketing language with
no described mechanism). Every fact is cited; all pages fetched 2026-08-28.

### Hevy — the most directly relevant comparison

Hevy ships **two** distinct things, and neither is an in-app LLM chatbot.

**1. Hevy Trainer — SHIPS. An algorithm, explicitly not an LLM.**
Source: [Hevy Trainer feature page](https://www.hevyapp.com/features/workout-plan-generator/).
Hevy describes it as *"an adaptive strength programming system based on a
sophisticated algorithm"* — the word AI does not appear. Concretely, a user touches:
- **Onboarding, 6 questions**: experience level, goal, available equipment,
  frequency, session length, muscle group to emphasise.
- **A generated program** with exercises, sets, target rep ranges, automatic rest
  times, and a recommended starting weight *only if you have logged that exercise
  in Hevy before*.
- **A stated, inspectable progression rule**: *"You must hit the upper end of the
  rep range with a specific weight on all prescribed sets for Trainer to increase
  it."* One sentence, no black box.
- **Per-exercise controls**: Reorder · Replace (4 recommended alternatives, then
  the full library, and it asks *permanent or this session only*) · **Don't
  Recommend Again** (a persistent exclusion list you can edit in Program Settings)
  · Delete · Add.
- **Program settings**: equipment, focus muscle, duration, goal, frequency,
  preferred rest duration, and a **variety** setting (focused 6-week blocks /
  continuous / weekly exercise rotation). Optional programmed cardio with placement
  preference.
- **Injury awareness**: add an injury and the program substitutes high-risk
  exercises or attaches a caution, with an explicit "this is not medical advice"
  line. Removing the injury reverts it.
- **A "Science Behind Hevy Trainer" section** in settings, explaining the
  programming decisions against peer-reviewed exercise science.
- **Pricing**: Pro-only. *"$2.99/month ($23.99/year or $74.99/lifetime)."*

**2. HevyGPT — SHIPS, and Hevy pays nothing for inference.**
Source: [HevyGPT feature page](https://www.hevyapp.com/features/hevy-gpt/).
It is a **custom GPT hosted in ChatGPT** plus an OAuth write-back into Hevy. The
user prompts ChatGPT, then asks it to save the program, and the routines appear in
a new folder in the Workout tab. Notable details: **free Hevy accounts can use it**,
capped at **4 routines** per import; a free ChatGPT account is enough; with the
integration active ChatGPT *"will be able to analyze your training history to
recommend workouts with load recommendations and progression suggestions"*; prompts
can account for injuries, disliked exercises, equipment, goals, duration,
frequency; imported routines are fully editable. Not available in the Android
ChatGPT app — desktop web only there.

The strategic read: the category leader by installs (15M+ users, per its own site)
put its **deterministic** engine behind the paywall and **outsourced the LLM to the
user's own ChatGPT subscription.** Zero token cost, zero rate limiting, zero
hallucinated-weight liability.

### Fitbod — SHIPS an adaptive recommender, marketed as AI

Source: [Fitbod on the App Store](https://apps.apple.com/us/app/fitbod-workout-gym-log/id1041517543)
(Fitbod Inc., v8.31.0, 282K ratings, Apple Editors' Choice). Subtitle: *"AI Personal
Trainer & Workouts"*. Its own feature list, verbatim:
- *"AI workouts maximize fitness gains by varying and balancing exercises"*
- *"**Adaptive AI learns from your edits to its workout recommendations**"* — the
  edit loop is the product
- *"Non-linear periodization to optimize your workouts for sustained progress"*
- *"Wide variety of workout modifiers to change up single sessions"*
- *"Pro fitness trainers available via email for all strength training questions"* —
  **human**, not AI, and Fitbod says so plainly
- Apple's own Editors' Choice blurb calls it *"the data-based weight-lifting app"*.

A long-form user review (Camille1919, 12/12/2021) names the controls a user actually
touches, including a **muscle recovery %** setting, available equipment, an
exclusion list, in-workout exercise swap, and editable weight/rep recommendations
that re-flow the remaining sets. **They ship this.** What they do **not** describe
anywhere in that listing is a conversational assistant — "AI" here means a
recommender over your logged data, not a chatbot.

### Strong — ships **no** AI at all, and is the market's quality bar

Source: [strong.app](https://www.strong.app/) homepage and its own feature list.
5M+ users, 4.9 on both stores, "Trusted by over 5 million users worldwide". Its
complete feature enumeration: *"Supersets, Custom Exercises, CSV Export, Apple
Health, Warm-up Calculator, Siri Shortcuts, 3rd Party Integrations, Dark Mode, RPE,
Advanced Charts, Body Part Measurements, Workout Scheduling, Muscle Heat Map,
Workout Sharing, Custom Timers and more."* **The word AI does not appear on the page.**
Its positioning is the opposite: *"Think less. Lift more."* · *"designed to stay out
of your way"* · *"Everything you need. Nothing you don't."* Press quotes it selects
reinforce it (Lifehacker: *"easy to use, even when you're exhausted mid-workout"*).
A serious competitor won this category by shipping **zero** intelligence and
excellent logging.

### Whoop — SHIPS a real LLM coach, and it is a different business

Sources: [Whoop (company) — Wikipedia](https://en.wikipedia.org/wiki/Whoop_(company))
and the primary press release it cites,
[WHOOP Unveils the New WHOOP Coach Powered by OpenAI (BusinessWire, 26 Sep 2023)](https://www.businesswire.com/news/home/20230926899032/en/WHOOP-Unveils-the-New-WHOOP-Coach-Powered-by-OpenAI-the-First-Wearable-to-Deliver-Highly-Individualized-Performance-Coaching-on-Demand).
Whoop Coach is a conversational, on-demand coaching feature powered by OpenAI,
shipped September 2023. It is genuinely an LLM the user talks to. The precondition
matters: Whoop grounds it in continuously-sensed physiology — HRV, resting heart
rate, respiratory rate, sleep — feeding a 0-100% daily recovery score, on a
mandatory subscription (the device stops tracking without one), and by Time's
account collects ~100 MB per user per day across five sensors. **They ship this.**
It is not a model this app can copy: the value is in the sensor stream, not the
model. Whoop's own coach page returned 403 to automated fetch, so this rests on
Wikipedia plus the BusinessWire primary source, not on Whoop's marketing copy.

### What the pattern says

| | In-app LLM chat | Deterministic engine | Behind paywall | Inference cost |
|---|---|---|---|---|
| Hevy | No — outsourced to the user's ChatGPT | **Yes**, Trainer | Trainer: yes, $2.99/mo · HevyGPT: no (free, 4-routine cap) | ~zero |
| Fitbod | No | **Yes**, adaptive recommender + non-linear periodisation | Yes | ~zero |
| Strong | No | No | n/a | zero |
| Whoop | **Yes** | Yes (recovery score) | Yes, mandatory | real, funded by hardware + subscription |
| **SparkOS today** | Yes, one text box | **Yes — and unplugged** | **No** | real, paid per token, given away free |

Three of four strength-training competitors ship **no** LLM in-app. All three that
ship coaching at all ship a **deterministic engine with visible controls and a
stated rule**. This app has built the engine those three monetise, and shipped
instead the one thing they all avoided.

---

## 7. Recommendation

The owner's standing rule is: if it does not help the user, delete it. Applied
honestly, most of this list is deletion — and the highest-value item is
*plugging in* something that already exists and is already tested.

### Do first

**R1 — Delete the false AI disclosure, or make it true.** `ExerciseTutorial.tsx:1025`
tells the user in Hebrew that the tips are AI-phrased. They are a 5-key hardcoded
table (`features.ts:136-163`). Either drop the AI clause and keep the medical
disclaimer, or route that button through the provider. This is a one-line honesty
fix on a legally-motivated string, and it is the cheapest thing on this page.
*Recommended: delete `טיפים לטכניקה` entirely* — the ביצוע tab already shows
technique steps, so this button is a second, worse copy of the same content, and
removing it removes the false claim with it.

**R2 — Name the three dead settings, then delete two and fix one.**
- Delete the `enablePRAlerts` toggle from the overlay (`:432-437`) — or, if the
  owner wants the control, wire it. Do not ship both a switch and an unrelated
  `prCelebrationIntensity` that actually decides. Also delete
  `useEnablePRAlerts()` (`useWorkoutSettings.ts:660`) and the `alertsEnabled`
  accessor (`:524,528`), which no one calls.
- Reduce `warmupPreference` and `cooldownPreference` to the two states the code
  actually implements (`תמיד` / `אף פעם`), or implement the third. Today `אף פעם`
  on cooldown does not prevent the cooldown offer — that is a wrong label, not a
  missing feature.

**R3 — Fix the guest path.** `bootstrap.ts` should select `RemoteProvider` only when
a user session exists, not merely when env vars do (`src/lib/supabase.ts:51`).
Right now a guest asking a question gets *"בעיית הרשאה בשירות ה-AI"* while a
working local fallback sits unused. Also add a `premium_required` (402) entry to
`errorMessages.ts` so a paywalled refusal reads as an upsell, not as
*"משהו השתבש"*.

### Then decide the actual product question

**R4 — Plug the engine in, or delete it.** ~900 lines of tested deterministic
coaching (`trainingLoadService.ts`, `contextBuilder.ts`, `coachBrief.ts`,
`intelligence/nutritionAdherence.ts`) reach no user. Two defensible answers, and
both are better than the status quo:

*(a) Delete it.* Honest, immediate, and consistent with the rule. The dashboard
already has a working DERIVED insight (`insightPicker.ts`) that returns `null`
rather than inventing an affirmation. If nothing is going to render readiness, the
readiness engine is 900 lines of maintained dead weight, and `HOME-AUDIT.md`'s
finding — that its hero number was effectively two constants for a user with no RPE
and no recovery log — is a reason not to resurrect it as a score.

*(b) Plug it in as Hevy Trainer, not as a score.* This is what the three strength
competitors monetise, and this app already has the parts: `calculateTrainingLoad`,
per-muscle recovery (`trainingLoadService.ts:150-155`), progression
(`autoIncrementWeight`), an exercise catalog with equipment/mechanic/level, an RPE
picker, and a recovery log. What is missing is Hevy's *shape*: a 6-question
onboarding, a **stated progression rule** the user can read, exercise
Replace/Exclude with "permanent or just today", and an injury list that substitutes
exercises. Note the prerequisite the current code gets wrong even if you choose
this: `generateAIWorkoutInsight` calls `buildContext(sessions)` with **no**
`recoveryLogs` (`aiWorkoutInsightService.ts:19`), so the prompt always reports
*"ציון התאוששות: לא ידוע"* and *"אין יומן התאוששות"* even for a user who has logged
recovery in `Progress.tsx:158`. Wire the inputs before trusting the outputs.

**R5 — Decide what "מאמן AI" means, and stop shipping two answers.** Today the
paywall says *coming soon, paid*; the workout screen ships it *free, now, with a
false AI label*. Pick one:
- If the coach is a paid feature: wrap the chip in `<PremiumLock featureKey="ai_coach">`
  (it exists and is unused), set `AI_REQUIRES_ENTITLEMENT=true`, and remove
  "בקרוב" from the paywall row. But note there is no purchase path yet — the CTA is
  a waitlist — so this gates it behind something nobody can buy.
- If it is free: delete the `ai_coach` row from `FEATURE_ROWS`
  (`PaywallScreen.tsx:73-79`) so the paywall stops selling something the user
  already has.
- **Recommended, and the simplest:** rename the surface. What that panel actually
  is, and is good at, is an **exercise guide with a question box** — muscle map,
  demo images, classification facts, technique steps, a grounded Q&A, and a set
  note. Calling it "מאמן AI" (`ExerciseTutorial.tsx:424`, `ExerciseDisplay.tsx:918`)
  over-promises a coach and under-sells a genuinely useful reference. Rename it
  "מדריך תרגיל" — which is already what the header menu calls it
  (`WorkoutHeader.tsx:193`) — keep the ask tab, and the false-intelligence problem
  mostly evaporates without deleting anything users value.

### Delete outright (dead code, no user impact)

- `showAICoach` state + `OPEN_AI_COACH` / `CLOSE_AI_COACH` + `ModalType` `'aicoach'`
  + `handleCloseAICoach` + the `onCloseAICoach` prop threaded through two overlay
  layers. Never opened, never rendered.
- `src/services/ai/chat.ts` in full — conversations, IndexedDB store, cloud sync,
  tombstones — plus the `AI_CONVERSATIONS` re-exports in `ai.ts:28-37`. There is no
  chat screen. **Caveat:** check the cloud `ai_conversations` table and
  `supabaseSync` / `offlineQueue` (`ai:create` / `ai:delete` mutation kinds) before
  removing, and check `idNormalization.ts:35`, which references
  `CURRENT_CONVERSATION_KEY`. Not a pure deletion.
- `getWorkoutAdvice`, `suggestWeight`, `suggestExercises`, `generateWorkoutSummary`
  (`features.ts`) and `src/components/workout/ProgressionRecommendation.tsx`. Zero
  callers.
- `aiInsight` / `aiInsightLoading` / `generateAIInsight` from
  `useFitnessInsights.ts` (`:53-58,143-155`) — the hook builds them, no component
  reads them, and `aiWorkoutInsightService.ts` goes with them.
- `coachBrief.ts` — **only if R4(a) is chosen.** Under R4(b) it is the right seam to
  build on: it already separates deterministic `facts` from model-phrased prose and
  labels the source.

### Top 3, in order

1. **R1** — kill the false AI disclosure on the hardcoded tips. Minutes of work,
   removes a claim the code cannot support.
2. **R4** — decide the fate of the unplugged coaching engine. This is the real
   product decision, and "delete it" is a legitimate answer.
3. **R2** — name and remove the dead toggles: `enablePRAlerts`, and the phantom
   third state on `warmupPreference` / `cooldownPreference`.

### Not covered

- No runtime verification of anything: no dev server, no Playwright, no 390 px /
  desktop / light / dark pass, no console check, no offline or mid-workout-reload
  probe. Browser held by another worker (port 4173).
- Whether the live Netlify build has Supabase env vars, whether `ai-chat` is
  deployed, whether `POLOAI_API_KEY` and `AI_REQUIRES_ENTITLEMENT` are set, and
  whether the `has_feature_access` RPC exists in the live database. All
  **not determined** — each changes which branch the coach takes.
- The paywall comment's claim that *"the chat endpoint returns 503"*
  (`PaywallScreen.tsx:33`) is plausible from the fail-closed paths at `index.ts:225`
  and `:452`, but **not verified** — it needs a live call.
- No RTL/overflow/a11y pass on the panel at 390 px. Read-only observations only:
  the ask input and answer use `dir="auto"` (`:711`, `:729`), the step carousel
  reverses arrow keys for RTL (`:306-309`) and has an `sr-only` live region
  (`:600-606`), and the tablist implements RTL arrow navigation (`:388-401`).
  Whether any of it renders correctly on a phone is untested.
- The human-coach product (`src/pages/coach/**`, `src/services/coach/**`) — out of
  scope, and much larger than the AI coach.
