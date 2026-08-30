# Google Play — Store Listing + Data Safety (SparkOS Fitness)

Closed test, 12 testers. Package `com.sparkos.fitness`, `versionName 1.0`
(`android/app/build.gradle:42,46`).

Every factual claim below is traceable to a file in this repo. Anything I could
not verify is in **OPEN QUESTIONS** at the end, unanswered — not guessed.

---

## 1. URL fields — what to paste where

| Play Console field | Value |
|---|---|
| Store listing → Privacy policy | `https://<DOMAIN>/store/privacy.html` |
| Store listing → Support URL (website) | `https://<DOMAIN>/store/support.html` |
| Store listing → Support email | `pgishonim@gmail.com` |
| Data safety → "URL where users can request data deletion" | `https://<DOMAIN>/store/support.html#deletion` |
| App content → Terms (optional, and used by the in-app consent gate) | `https://<DOMAIN>/store/terms.html` |

`<DOMAIN>` is not in the repo. `src/main.tsx:42` reads `VITE_COMMIT_REF`, which
Netlify injects, so the PWA is served from Netlify — the three HTML files can be
dropped into `public/store/` on that same site (or any static host) and they will
work as-is. **Verify in a browser that the URL returns 200 before you paste it:**
Play rejects a listing whose privacy-policy URL 404s, and a 404 costs you a
review round.

---

## 2. App name (30 chars max)

```
SparkOS Fitness — יומן אימונים
```
Exactly 30 characters — no slack. Safe fallback (22):
```
SparkOS – יומן אימונים
```

## 3. Short description (80 chars max) — 70 chars

```
יומן אימונים בעברית: סטים, שיאים אישיים והתקדמות. עובד גם בלי אינטרנט.
```

## 4. Full description (4000 chars max) — 1,141 chars

```
יומן אימונים בעברית, למי שמתאמן בחדר כושר ורוצה לראות התקדמות.

■ רישום אימון בזמן אמת
סטים, חוזרים ומשקלים נרשמים בין סט לסט, עם טיימר מנוחה מובנה. הממשק בנוי לאגודל אחד — גם כשהמכשיר על הרצפה ליד הספסל.

■ תבניות אימון
בונים אימון פעם אחת וחוזרים אליו. אפשר לשנות תרגילים, סדר ומספר סטים בכל פעם.

■ התקדמות שאפשר למדוד
שיאים אישיים לכל תרגיל, נפח אימון לאורך זמן, מדידות גוף ותמונות התקדמות בציר זמן.

■ מאמן ומתאמן
אפשר לקשר את החשבון למאמן: הוא שולח תוכנית, רואה את היומן ומגיב עליו. צ'ק-אין תקופתי עם מדידות ותמונות.

■ שאלה על תרגיל
לא בטוחים בטכניקה או במשקל הבא? שואלים, והתשובה נשענת על המספרים האמיתיים שלכם מהאימונים האחרונים.

■ עובד בלי אינטרנט
בחדר כושר בקומת מינוס אין קליטה. מה שנרשם נשמר על המכשיר ומסתנכרן לענן ברגע שיש חיבור.

■ עברית מלאה
האפליקציה נבנתה מההתחלה בעברית ומימין לשמאל, עם מצב כהה מובנה.

הרשאות: הרשאת אינטרנט בלבד. אין הרשאת מיקום, אנשי קשר או מיקרופון. תמונות נבחרות על ידכם דרך בוחר התמונות של המכשיר.

הנתונים שלכם: אפשר לייצא את היסטוריית האימונים לקובץ בכל רגע, ולמחוק את החשבון וכל המידע מתוך ההגדרות.

האפליקציה נועדה למעקב אימונים ואינה מהווה ייעוץ רפואי. התייעצו עם רופא לפני תחילת תוכנית אימון.
```

Deliberately **not** in the listing: nutrition / calorie tracking. The trainee
nutrition surface is switched off (`src/constants/featureFlags.ts:48`,
`NUTRITION_TRAINEE_UI_ENABLED = false`, and `/nutrition` redirects home for
everyone except `app_admins`). Advertising a screen a tester cannot open is a
"misleading claims" finding. Also not in the listing: subscriptions or prices —
no billing provider is configured (`src/services/billing/checkoutService.ts:10`).

---

## 5. Data safety — answers to copy into the form

Verdict for the top-level questions:

- Does your app collect or share any of the required user data types? → **Yes**
- Is all of the user data collected by your app encrypted in transit? → **Yes**
  (Supabase over HTTPS; no plaintext endpoint in the repo)
- Do you provide a way for users to request that their data be deleted? → **Yes**
  (in-app: `src/pages/settings/sections/DangerZoneSection.tsx`; web:
  `store/support.html#deletion`)
- Is your app committed to the Play Families Policy? → **No** (the terms set a
  16+ floor, `legalDocs.ts` → "כשירות וגיל מינימלי")
- Independent security review → **No** (nothing in the repo claims one)

### 5a. Collected — tick these

"Shared" below means *transferred to a third party for their own use*. Supabase
and Sentry are service providers processing on our behalf, which Google does not
count as sharing — so every row is **Shared: No**, on one condition that is still
open: see OPEN QUESTION 1 about the AI provider. Do not submit this table until
that one is answered.

| Category → data type | Collected | Shared | Required? | Purposes | Where in the code |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | Required | App functionality; Account management | `PRIVACY_DOC` "פרטי חשבון: שם"; `src/pages/settings/sections/ProfileEditSection.tsx` |
| Personal info → Email address | Yes | No | Required | App functionality; Account management | `src/services/supabaseAuth.ts` |
| Personal info → User IDs | Yes | No | Required | App functionality; Account management; Analytics | Supabase auth uid; Sentry keeps `user.id` only (`src/main.tsx:52`) |
| Personal info → Other info (date of birth / gender / height / goals / experience) | Yes | No | Optional | App functionality; Personalization | `PRIVACY_DOC` "נתוני פרופיל וכושר" |
| Health and fitness → Fitness info (workouts, sets, reps, weights, PRs, body weight, body measurements) | Yes | No | Optional | App functionality; Personalization | `src/services/sessionDb.ts`, `prService.ts`, `bodyStatsService.ts`, `bodyWeightDb.ts` |
| Messages → Other in-app messages | Yes | No | Optional | App functionality | coach↔trainee messaging (`src/pages/MyCoach.tsx`); community posts (`src/services/community/communityService.ts`) |
| Photos and videos → Photos | Yes | No | Optional | App functionality | progress photos `src/pages/progress/tabs/BodyTab.tsx:193`; coach check-in `src/pages/MyCoach.tsx:908`; avatar `ProfileEditSection.tsx:319` |
| App activity → Other user-generated content | Yes | No | Optional | App functionality | workout templates, notes (`src/services/templateDb.ts`) |
| App info and performance → Crash logs | Yes | No | **Optional** | Diagnostics | Sentry starts **only after** analytics consent (`src/main.tsx:27-60`, `src/components/consent/CookieConsentBanner.tsx`) |
| App info and performance → Diagnostics | Yes | No | Optional | Diagnostics | same consent gate; `tracesSampleRate 0.1` in prod (`src/main.tsx:45`) |
| App info and performance → Other app performance data | Yes | No | Optional | Diagnostics | `src/services/webVitals.ts`, same consent gate |

On the three consent-gated rows, mark collection as **optional** and say the user
can decline. That is accurate: `sendDefaultPii: false`, and `beforeSend` strips
the request body, all breadcrumbs and `extra.data`, and reduces `event.user` to an
id (`src/main.tsx:46-58`).

### 5b. NOT collected — leave unticked

Location (approximate and precise) · Financial info · Contacts · Calendar ·
Audio · Files and docs · Web browsing history · App activity → in-app search
history · Installed apps · Device or other IDs · anything Advertising.

Grounded in: `android/app/src/main/AndroidManifest.xml:40` declares exactly one
permission, `INTERNET`. No Firebase / FCM / AdMob / advertising-ID dependency
exists anywhere in `src/`.

**Health and fitness → Health info: No.** There is no medical-condition or
injury field in the app — I grepped for one and it does not exist. Read
OPEN QUESTION 2 before you tick this box, though: free text the user types into
the AI feature could contain health details.

---

## 6. Other Play sections that will block the closed test

- **App access.** The app is behind a login. Play review needs working
  credentials, or the review stalls. Create a throwaway account and paste it into
  App access → "All or some functionality is restricted".
- **Content rating (IARC).** Answer honestly that the app has
  user-to-user communication (coach messaging + a community feed) — Play asks
  this explicitly and a wrong answer here is a policy violation, not a typo.
- **Target audience.** 16+ or 18+, to match the terms. Not "13-15".
- **Ads.** No.
- **Health apps declaration.** Only required if you integrate Health Connect or
  claim a medical function. Neither is in the repo → No.
- **Generative AI.** See OPEN QUESTION 2. This one is a real policy exposure.

---

## 7. Provenance — what is verbatim and what I wrote

**Verbatim, exported without a single word changed** from
`src/content/legal/legalDocs.ts`:

- `store/privacy.html` — every heading, paragraph and bullet from `PRIVACY_DOC`
  (10 sections), plus the draft banner text taken from
  `src/pages/legal/LegalDocPage.tsx:142`.
- `store/terms.html` — every heading, paragraph and bullet from `TERMS_DOC`
  (13 sections), plus the same draft banner.

**Version carried through: `2026-06-09`.** Source: the `V1` constant at
`src/content/legal/legalDocs.ts:45`, which feeds both `version` and
`effectiveDate` on both documents. Both HTML files print
"גרסה 2026-06-09 · בתוקף מ-2026-06-09", the same string the in-app page renders,
and each carries a header comment telling the next person to re-export when
`version` is bumped.

`COACH_TERMS_DOC` exists in the same file but is **not** exported here — it is an
additional agreement for coaches, not a store-listing requirement. Say the word
if you want `store/coach-terms.html` too.

**Written by me** (nothing in the repo to export): all of
`store/support.html` and all of the Hebrew in section 2-4 above. Every claim in
the support page is grounded: the two deletion actions and their exact effects
are paraphrased from `DangerZoneSection.tsx`, CSV export from
`src/services/exportService.ts`, offline-first from `src/services/indexedDBCore.ts`
+ `supabaseSyncOrchestrator.ts`, guest mode from the DangerZone copy itself,
password reset from the `/reset-password` route (`src/AppRouter.tsx:282`). I did
**not** invent a response-time promise, a phone number, a company address, or an
office-hours window.

**Self-containment, how I verified it:** two ways. Statically: all three files
contain zero `<link>`, zero `<script>`, zero `@import`, zero `url(` and no
`fonts.googleapis.com` / `fonts.gstatic.com` reference — grepped across `store/`;
the only textual hits for `<link` / `<script` / `@import` are inside the HTML
comment that says they are absent. Dynamically: I opened each file from
`file:///` in a real Chrome at 390×844 and read
`performance.getEntriesByType('resource').length` — **0 resources loaded on all
three pages**, with `document.querySelectorAll('link').length === 0` and
`script.length === 0`. The only CSS is one inline `<style>` per file; the only
`href`s are `mailto:`, `#` anchors and relative links between the three pages.
Font stack is `"Assistant", "Segoe UI", "Arial Hebrew", Arial, system-ui` —
`Assistant` is used **only if already installed locally**, never fetched, and
Hebrew falls back cleanly. Note the app's own `index.html` *does* pull Google
Fonts; these pages deliberately do not.

**Rendering, verified in Chrome at 390×844 (DPR 3, mobile) and in dark mode:**
`<html dir="rtl" lang="he">` on all three · `scrollWidth === clientWidth === 390`
on all three, so **no horizontal scroll**, and zero elements extend past the
inline axis · real heading structure (privacy `h1`+10×`h2`, terms `h1`+13×`h2`,
support `h1`+6×`h2`+6×`h3`) · `#deletion` anchor resolves on the support page.
Contrast on card surfaces, computed from the live DOM: light — ink 16.19:1, link
6.62:1, muted 7.01:1; dark — ink 16.57:1, link 11.03:1, muted 7.49:1. All pass
WCAG AA (4.5:1) with room to spare.

**Nothing outside `store/` was created, edited or deleted.** The only three
writes in this task are `store/privacy.html`, `store/terms.html`,
`store/support.html` and this file. `src/`, `android/`, `scripts/`,
`package.json` were opened read-only.

---

## OPEN QUESTIONS — answer these before you submit

### 1. An AI provider receives user data and is missing from the privacy policy. This is the blocker.

`src/services/ai/config.ts:33` → `POLOAI_BASE_URL = 'https://poloai.top'`, an
OpenAI-compatible aggregator, called through the Supabase Edge Function `ai-chat`
(`config.ts:22`), default model `gpt-5.4-mini`.

It is **live and reachable in the shipping app**:
`src/components/workout/ExerciseTutorial.tsx:322-327` sends the user's free-text
question **plus grounding computed from their last 100 workout sessions**
(recent set weights, estimated 1RM) on every "שאלה" tab use.

`PRIVACY_DOC` → "ספקי משנה" lists **Supabase, Sentry, payment providers**. It
does not list an AI provider. So the hosted policy I just published is
**incomplete** with respect to what the code actually does — user fitness data
and free text leave to a third party that the policy never names.

I did not paper over it and I did not quietly add a paragraph to the HTML: doing
that would have made the hosted copy diverge from `/legal/privacy` in the app,
which is the exact failure this task was written to prevent. The fix belongs in
the file I do not own. Suggested bullet for `PRIVACY_DOC.sections` → "ספקי משנה":

```
'ספק מודל שפה (AI) — לצורך מענה על שאלות תרגיל, מקבל את שאלתך ונתוני אימון רלוונטיים',
```

Then bump `V1` in `legalDocs.ts:45` (e.g. `2026-08-30`), re-run the seed-hash
script, and re-export these two HTML files so all three copies match.

Two things I cannot answer from the code, and you must:
- **Does PoloAI have a data-processing commitment not to train on or retain our
  users' data?** If yes, it is a service provider and Data Safety stays
  "Shared: No". If no, or unknown, then **Fitness info and Messages must be
  declared as Shared** — a materially heavier declaration, and a wrong answer
  here is a policy violation, not a formatting slip.
- Is the AI feature meant to be in the closed test at all? Turning it off is the
  cheapest way to close both this and question 2.

### 2. Google Play's Generative AI policy applies to this app, and I see no reporting affordance.

Play requires apps with generative-AI features to give users an in-app way to
report offensive AI output. The community feed has one
(`src/components/community/ReportReasonSheet.tsx`), but I grepped
`ExerciseTutorial.tsx` for `report` / `flag` / `feedback` / `דיווח` and found
**nothing** on the AI answer surface. Either add a report control next to the AI
answer, or keep the feature out of this release. Not something I can fix from
`store/`.

### 3. The hosted policy says "טיוטה" — on purpose. Decide whether that ships.

`PRIVACY_DOC.isDraft` and `TERMS_DOC.isDraft` are both `true`, and
`legalDocs.ts:12-17` says in as many words: *"DRAFT — REQUIRES HUMAN LEGAL REVIEW
BEFORE PRODUCTION… NOT legal advice."* The in-app page renders a visible draft
banner, so the hosted copies do too — verbatim. Hiding it on the hosted copy
alone would be the divergence I was told to prevent.

Play does not require a lawyer's sign-off, so this will very likely pass review.
But a reviewer reading "has not passed final legal approval" may read it as
placeholder content. Your call, and there are only two clean options: get the
review, flip `isDraft` to `false`, re-export — or ship the banner knowingly.

### 4. The privacy policy names no legal entity. Fix before production, not before the closed test.

The document identifies the data controller as "SparkOS Fitness" with a Gmail
address and nothing else — no company name, no registration number, no address.
GDPR Art. 13 and the Israeli Privacy Protection Law both expect an identifiable
controller with real contact details. Acceptable for 12 testers; thin for
production, and a `@gmail.com` address as the official privacy contact reads as
unserious to a reviewer.

### 5. "No camera" is true today, but only by two accidents.

Your input said no camera. At the Android permission level that is correct — the
manifest declares only `INTERNET`. But
`src/pages/nutrition/components/BarcodeScanner.tsx:129` calls
`navigator.mediaDevices.getUserMedia`. It is unreachable today because the
nutrition trainee UI is flagged off and `/nutrition` redirects non-admins, and it
would fail closed in a WebView with no `CAMERA` permission. **Flip
`NUTRITION_TRAINEE_UI_ENABLED` to `true` and you have shipped a camera feature
with no permission declared and a stale Data Safety answer.**

Separately: the progress-photo and coach check-in file inputs use
`capture="environment"` (`BodyTab.tsx:195`, `MyCoach.tsx:911`), which opens the
system camera app by intent. No permission needed, nothing to declare — but know
the answer if a reviewer asks why a "no camera" app opens the camera.

### 6. OpenFoodFacts is a second undeclared third party.

`src/services/barcodeFood.ts:75` → `https://world.openfoodfacts.org/api/v2/product`.
A lookup sends a barcode and, inherently, the user's IP to a third party not
named in the sub-processor list. Behind the same disabled flag as question 5, and
the coach-side nutrition surface may still reach it. Lower severity than
question 1, same class of problem.

### 7. Billing is described in the terms but does not exist yet.

`TERMS_DOC` → "מנויים ותשלומים" describes monthly/annual subscriptions.
`src/services/billing/checkoutService.ts:10` says no purchase can complete until
an operator configures a provider. So Financial info = No **today**. When billing
goes live: re-answer Data Safety (Purchase history), and remember that digital
goods sold inside an Android app must go through Play Billing.

---

*Prepared from the repo state on 2026-08-30. Legal text version `2026-06-09`.*
