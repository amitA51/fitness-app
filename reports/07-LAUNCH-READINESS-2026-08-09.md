<!-- Generated 2026-08-09 by a 16-agent audit + research campaign (6 codebase auditors, 6 English-language researchers, 3 adversarial fact-checkers, 1 synthesis).
     Supersedes the open items in DEPLOY-TODO.md, which is stale: ALLOWED_ORIGIN and the VAPID/CRON server secrets are already set. -->

# SparkOS Fitness — Launch Decision Document
**Date:** 2026-08-09 · **Basis:** 6 codebase audits + 6 external-requirements research streams + 3 adversarial fact-checks · **Deployed commit:** `909094d` (live since 2026-07-31)

---

## תקציר מנהלים

**שורה תחתונה: המוצר כמעט גמור, אבל אי אפשר להשיק אותו כרגע לאף אחד משלושת הקהלים.** למשתמשים רגילים — NO-GO, כי הרשמה של אורח מוחקת את כל הנתונים שלו, בדיוק אחרי שהאפליקציה מבקשת ממנו להירשם "כדי לשמור את הנתונים"; זה הוכח בבדיקה ואין שחזור. למאמנים — NO-GO, כי מאמן לא יכול לשייך תוכנית אימון (מגבלת שלוש התבניות של המסלול החינמי חלה על המתאמן וחוסמת פיצול של ארבעה ימים) ולא יכול להוסיף מתאמן שני (`seat_limit=1` בלי מסלול שדרוג שאפשר לקנות). לגביית כסף — NO-GO, כי אין ישות משפטית רשומה, אין הנפקת קבלה אוטומטית, אין קישור ייעודי לביטול עסקה בדף הראשי כפי שדורש סעיף 14ט לחוק הגנת הצרכן, ומתוך שש התכונות שדף התשלום מוכר רק אחת נאכפת בקוד. **החדשות הטובות:** הרבה ממה שנראה שבור הוא בעצם ארבע שורות הגדרה ב-`netlify.toml` ושני משתני סביבה חסרים — מפתחות ה-VAPID וה-CRON כבר מוגדרים בצד השרת, `ALLOWED_ORIGIN` כבר מוגדר נכון (הצ'קליסט פשוט מיושן), מחיקת חשבון עובדת באמת בצד השרת, והפרדת הנתונים בין מאמנים תקינה. **שתי הפתעות משפטיות לטובתך:** אין חובת רישום מאגר מידע ברשות להגנת הפרטיות, וסביר שאתה נכנס לפטור "מאגר המנוהל בידי יחיד" — כלומר רוב חבילת אבטחת המידע ברמה הבינונית, כולל מבדק החדירות שחשבת שאתה חייב, כנראה לא חלה עליך; זה תלוי בכמה אנשים מחזיקים הרשאת גישה למאגר, וזו שאלה אחת לעורך דין. **התוכנית:** M0 יום אחד לתיקוני הגדרות · M1 כשלושה שבועות עד פיילוט חינמי סגור · M2 כשלושה שבועות עד השקה ציבורית חינמית · M3 כשבועיים עד המאמן הראשון · M4 גבייה — והצוואר שם הוא רישום עסק, רואה חשבון וספק סליקה ישראלי, לא קוד.

---

## 1. Verdicts

| Audience | Verdict | The single most important reason |
|---|---|---|
| **Regular users (trainees)** | **NO-GO today → GO after M1** | Signing up as a guest destroys every byte of guest data — workouts, onboarding, program progress — while the login screen actively invites guests to sign up "כדי לשמור את הנתונים שלכם". Probe-proven: `localDataCleared = true, sessions = 0, onboarding_completed = null`. |
| **Coaches** | **NO-GO** | A coach cannot do the one thing they buy the product for: assigning a program fails because the coach's templates count against the **trainee's** 3-template free quota, and a coach can never have a second client (`seat_limit = 1`, DB-guarded, upgrade CTA points at a product that cannot be bought). |
| **Charging money** | **NO-GO** | There is no legal seller: no registered entity, no tax registration, no automated קבלה, and no homepage cancellation link (סעיף 14ט). Independently, 5 of the 6 features the paywall advertises have **zero** enforcement anywhere in client or server — you would be charging for unlimited templates and nothing else. |

**Overall posture:** the code is meticulous; the gaps are configuration, business setup, and a small number of genuine product dead-ends. Nothing here needs a rewrite.

---

## 2. What is already DONE — do not redo this work

Verified by live HTTP probes, live-browser dogfooding, or file:line reading. Several of these contradict `DEPLOY-TODO.md`, which is stale.

**Deployment & security**
- `ALLOWED_ORIGIN` **is** set in Supabase and fails closed. Probed on `ai-chat`, `account-delete`, `coach-invite-accept`, `coach-push-send`, `billing-checkout`: the prod origin is echoed, `evil.example.com` gets `Access-Control-Allow-Origin: null`. **DEPLOY-TODO §3 shows this unchecked — it is done.** Delete that line.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` **and** `CRON_SECRET` are all set in Supabase. Proven by probe ordering: `coach-push-send` returns 401 (auth), not the `no_vapid` 500 that precedes its auth check; `reminders-dispatch` returns 403, not `no_secret` 500. **The server half of push is fully paid for and provisioned.**
- Netlify genuinely runs `build:release`; source maps are genuinely off the CDN.
- Production bundle is clean: one `console.warn` total, zero `console.log/debug/info`, zero `localhost`, zero mock/DEMO strings.
- `VITE_DEMO_VIEW_SWITCH` unset is the **safe** state (`CoachContext.tsx:49` requires the literal `'true'` in a prod build).
- `VITE_BILLING_LIVE` unset is the **intended** state; `billing-checkout` returns `billing_not_configured` 503.
- HTTPS/HSTS correct (`max-age=31536000; includeSubDomains; preload`).
- Rate limiting on edge functions is real and correct: `ai-chat` uses an atomic Postgres ledger, fails **closed** when the limiter DB is unreachable.
- Sentry PII scrubbing is already correct: `sendDefaultPii: false`, `beforeSend` drops `request`/breadcrumbs/`extra.data` and reduces `event.user` to `{id}`, SDK is consent-lazy-loaded.

**Product**
- **Account deletion is genuinely complete** — authenticates from the caller's own JWT, rate-limits fail-closed, verifies the typed email against the JWT claim (not the body), opens an audit row, walks and batch-removes every object under `${uid}/` in **both** buckets (`progress-photos`, `avatars` — grep confirms these are the complete set), then calls `admin.auth.admin.deleteUser`. Audit table survives the user, service-role only. This satisfies Apple 5.1.1(v) and the erasure half of Israeli privacy law.
- **Coach↔coach data isolation is correct.** `coach_clients` is scoped by `auth.uid()` on every policy; every cross-user read goes through `is_coach_of()` gated on an **active** link. Coach A cannot see Coach B's clients.
- The 2026-06-29 self-writable-`seat_limit` finding **is fixed in the repo** (`guard_coach_subscription_fields`, migration `20260629000000`). ⚠️ Verify against the live DB — repo migrations are not the source of truth.
- The paywall's current behaviour is honest and correct: `PurchasePanel` short-circuits on the env flag before querying the catalogue; the waitlist has real idle/submitting/joined/error states; the buy button is gated by **both** the flag and an active price row, so a half-done rollout cannot show a dead button.
- Billing webhook design is genuinely good: raw-body HMAC + 5-minute replay window + constant-time compare; `verify_jwt=false` codified in `config.toml`; idempotency separates *seen* from *applied* via `processed_at`; out-of-order events rejected via `latest_event_at`; checkout accepts only a `priceKey` so the client can never name its own amount.
- Service worker: `registerType: 'prompt'` with an update toast (deliberate — do not regress); 21-entry precache shell with `navigateFallback` works offline cold.
- `/reset-password` handles all four link states. Workout finish/save has careful error handling with a retry toast. 166 classified Hebrew exercises and the 12-week program are real content. The coach product is ~13.5k lines with zero TODO/stub markers; messaging is properly paginated (200-message cursor); the roster N+1 is already batched.
- Progress-photo storage is private with owner + active-coach read. Age gate is server-authoritative. Consent system is append-only and versioned.

**Legal — obligations you do NOT have**
- **No PPA database registration.** Post-Amendment-13 registration is limited to public bodies and data brokers with 10,000+ subjects. Any plan doc saying "register the database" is out of date.
- **No 100,000-record notification** at current scale (tripwire, not a task).
- **No Privacy Protection Officer** and **no s.17B information security officer** (that attaches to holders of five registrable/notifiable databases, public bodies, banks, insurers, credit-rating companies).
- **No allocation number (מספר הקצאה)** for consumer subscriptions. Thresholds are ₪10,000 pre-VAT from Jan 2026 and ₪5,000 from 1 June 2026, and the rule only conditions the **buyer's** input-VAT deduction — consumers don't deduct. Only relevant if you ever sell a >₪5,000 coach/gym package.
- **No EU medical-device (MDR) or FDA obligation** while intended use stays lifestyle/wellbeing with no disease claims.
- **Likely no penetration test.** Corrected below — that is a HIGH-tier duty only.

---

## 3. Corrections applied from fact-checking

These override the original research. Do not act on the superseded versions.

| Original claim | Status | What to use instead |
|---|---|---|
| Health data ⇒ automatically MEDIUM security tier regardless of user count | **WRONG** | Reg. 1 has a **"מאגר המנוהל בידי יחיד"** carve-out: an individual (or an individual-owned company) where only the individual + at most **two** additional credential-holders may use the database, unless (a) its main purpose is supplying data to others as a business, (b) it holds ≥10,000 subjects, or (c) the owner is under a statutory/professional confidentiality duty. If SparkOS clears it, **reg. 21(4)** applies only regs 1, 2, 6(א), 9(א), 11(א), 12–14, 20 — **no** written security procedure, **no** access-permission management, **no** access logging, **no** training, **no** annual incident review, **no** PPA breach reporting, **no** periodic audit, **no** outsourcing-agreement duties. **The whole question is how many people hold credentials (do real coaches count?).** One question for a lawyer; potentially the highest-leverage legal item in this document. |
| Risk survey + penetration test every 18 months | **WRONG** | HIGH-tier only (regs 5(ג)/5(ד)); reg. 21(2) deliberately excludes them from medium. **Medium tier owes reg. 16** instead: an internal or external audit every **24 months** by a qualified party who is not the security officer. **Do not budget for a pentest on this basis.** |
| Breach report within 72 hours | **WRONG** | Reg. 11(ד)(1): **"באופן מיידי"** — immediate. There is no 72-hour rule in Israeli law; that is GDPR bleed-through. (And if the individual-managed carve-out applies, this duty doesn't attach at all.) |
| Fines: millions of NIS, 1%/day accrual, doubled for repeat within 2 years | **WRONG** | Real schedule: ₪150,000 fixed for registration/notification; per-subject amounts (₪2/4 DPO-related, ₪4/8 unlawful processing) with floors ₪20,000–200,000; security-reg breaches ₪20,000/40,000/80,000 (medium tier); doubled **only** above 1,000,000 subjects; the Fifth Appendix lists **reductions**. **Hard cap: 5% of annual turnover**, with lower ceilings for small (₪4–10m) and micro (<₪4m) businesses. For a pre-revenue app, exposure is orders of magnitude below "millions". **The bigger real exposure the research missed:** Amendment 13 abolished the 2-year short limitation period — civil claims now carry the general **7 years**. |
| s.11 privacy notice = six items incl. controller contact | **WRONG** | **Five** items: (1) whether providing data is mandatory or voluntary + consequence of refusal; (2) purpose of collection; (3) to whom it is delivered and why; (4) existence of the s.13 access right; (5) existence of the s.14 correction right. Controller contact belongs to the s.8א(ב) **notification to the PPA**, not the notice to individuals. Publish it anyway — just don't call it the statutory minimum. |
| Refunds "same payment method, within 7 business days" | **WRONG** | סעיף 14ה: **14 days** from receipt of the cancellation notice. The Law itself imposes no same-method rule. A voluntary 7-business-day internal SLA is fine; **writing "7 ימי עסקים" into Hebrew legal copy states the law incorrectly.** |
| 4-month extended cancellation for 65+/disabled/עולים | **QUALIFIED** | Confirmed at 14ג1, but for מכר מרחוק the extension under 14ג1(ג) is conditioned on a **prior conversation** between trader and consumer. Pure self-serve web signup with no sales call likely falls outside it. Do not build the 4-month path unless you add human-sold plans. |
| Price display "סעיפים 17א-17ב" | **IMPRECISE** | Authority page covers 17א-17ז, and the affirmative service-price duty applies to a closed list (מספרה, מכבסה, בית אוכל, עינוג) that excludes SaaS. **Operative rule for you:** if you publish a price at all, it must be מחיר כולל (VAT-inclusive) and in shekels. Conclusion unchanged. |
| 60-day accessibility cure period is "the one genuine defense" | **WRONG** | Not statutory. It is judicial practice in class-action certification decisions plus an **unenacted** draft bill (תובענות ייצוגיות תיקון 16, 2024). Keep a monitored accessibility inbox as mitigation — do not treat it as a shield. |
| Accessibility exemption: <₪100k gets a renewable 3-year exemption | **WRONG** | Two separate tiers conflated. (a) **Flat**, no clock: עוסק פטור **or** average annual turnover ≤ ₪100,000. (b) **Separate**: average turnover ≤ ₪1,000,000, but **only for a site/app that began operating before the regulations took effect**, 3 years renewable, conditional on publishing contact channels. **A site launched today gets nothing from (b).** |
| GDPR Art. 8 ages: Ireland/Spain 13 | **WRONG** | Ireland **16** (DPA 2018 s.31), Spain **14** (LOPDGDD Art. 7). Germany/NL 16 correct; France 15; Austria 14. Conclusion (a hard 18+ gate avoids the patchwork) unaffected. |
| EU AI Act: grace period to 2 Dec 2026 | **OVERBROAD** | The runway applies **only** to Art. 50(2) machine-readable marking of AI-generated content. **Art. 50(1) — "you are interacting with an AI" — applied in full from 2 Aug 2026 with no grace period.** Cheap to comply with; do it regardless of EU targeting. |
| Supabase MFA challenge 15/minute per IP | **WRONG** | **15 per hour** per IP. 60× less headroom than stated — relevant for shared-NAT (gym wifi). |
| Netlify deploy retention 30d Free/Pro, 90d paid | **WRONG** | 30 days Free, **90 days on all paid plans including Pro**. |
| Postmark "~94% inbox placement"; PowerDMARC "89%/22-34%"; Better Stack free "3-min interval" | **UNVERIFIABLE** | Do not repeat these numbers. Postmark's own glossary says any provider quoting an inbox-placement percentage is misusing the term. Better Stack's 3-minute free interval is not documented anywhere on their pricing page — **the tiebreaker for choosing it over UptimeRobot is unsupported.** |
| Resend free tier = 3,000/month | **INCOMPLETE** | Also **100/day** and **1 domain**. The daily cap is the one that bites a launch-day push or a coach bulk-inviting 40 clients. |
| Supabase Log Drains "consolidate into Sentry" | **INCOMPLETE** | Available on Pro (March 2026) but costs **~$60/month per drain** plus per-million-event packages — more than the $25 Pro plan itself. Not free. |
| Amazon SES $0.10/1,000, cheapest at scale | **QUALIFIED** | That's the à-la-carte rate; SES also sells tiered plans from $0.16/1,000. |
| "The app has ZERO product analytics" | **WRONG (internal conflict)** | `product_events` **is** deployed and **6 of 12** allow-listed events **do** fire (`onboarding_completed`, `workout_completed`, `paywall_viewed`, `checkout_started`, `checkout_completed`, `coach_invite_accepted`). What's missing is 6 emitters and any read path — **not** the infrastructure. Do not install PostHog/Amplitude; finish what exists. |
| "Coach RLS HIGH findings NOT fixed" | **CONFLICT** | The repo contains the fix (`guard_coach_subscription_fields`, `20260629000000`). Since repo ≠ live, this becomes a **verification task against production**, not a build task. |
| B6: "the invite deep link is dead for logged-out users" | **WRONG — refuted post-synthesis, 2026-08-09** | `/join` **is** routed in the unauthenticated branch (`AppRouter.tsx:323`) above the `*` → Login catch-all, `JoinPage` renders a real Hebrew explainer, and `rememberInviteContinuation` + `?next=` carries the code through login (preserved across the auth transition, asserted by `authSessionTransition.test.ts:197`). Inherited from a stale `reports/06`. **Deleted from the M3 entry criteria — do not build a fix.** |
| A1: "signing up as a guest destroys guest data" | **CONFIRMED — re-read post-synthesis, 2026-08-09** | `authSessionTransition.ts:75-89`: a guest never wrote the owner marker, so `previousUserId` is `null`; the same-identity guard (`:78`) and the null-`nextUserId` guard (`:84`) both miss, and execution falls through to the wipe. The function's own doc comment scopes the wipe to "a different account actually signing in" — `null → new uuid` is a *first* account, not a different one, and that is exactly the gap. **This is the real one. Fix it first.** |

**Material omission surfaced by fact-checking:** תקנות הגנת הפרטיות (הוראות לעניין מידע שהועבר לישראל מהאזור הכלכלי האירופי), תשפ"ג-2023 carries direct per-subject sanctions and, since 1 Jan 2025, reaches **Israeli data co-located with EEA-origin data**. A single EEA signup could arguably pull the whole Supabase instance into scope. This cuts against the comfortable "GDPR probably doesn't apply" conclusion and is a lawyer question.

---

## 4. (A) BLOCKERS — launching to regular USERS

### A1. Signing up destroys all guest data
- **What:** `authSessionTransition.ts:78-89` — a guest has never written `LAST_SIGNED_IN_USER_ID_KEY`, so neither early-return fires and execution falls through to `clearUserScopedLocalData()`, which `dbClear()`s all 13 IndexedDB stores and removes `onboarding_completed`, `user_profile`, `bbt_program_progress_v1`. No migration code exists anywhere.
- **Why it blocks:** Guest mode is the lowest-friction entry (one tap), `ChoiceStep.tsx:72` explicitly asks guests to sign up "כדי לשמור את הנתונים שלכם", and doing so wipes them and dumps them back at onboarding step 1. Highest-volume data-loss path in the product. `DEPLOY-TODO` stage 5 claims a manual Settings button covers this — that button is `disabled` until after sign-in, i.e. after the wipe.
- **First action:** In `AuthContext.applySession`, when `previousUserId === null` **and** the prior session was a guest: skip the wipe, stamp `LAST_SIGNED_IN_USER_ID_KEY` to the new id, re-stamp `GUEST_OWNER` queue entries to the new user id, then `pushAllData()` before `pullAllData()`. Guard it so it fires **only** on guest→first-account, never on account switching. Add a shared-device test.
- **Who:** CODE · **Effort:** ~1 day

### A2. Zero production error telemetry (four compounding defects)
- **What:** (1) `VITE_SENTRY_DSN` unset in Netlify → `main.tsx:33` skips init entirely. (2) `logger.ts:57-74` deliberately suppresses `console.error` in prod builds and routes to a no-op Sentry facade — so every sync failure, auth failure, RLS denial and error-boundary crash goes nowhere at all. (3) `netlify.toml:18` `connect-src` allows only `https://*.ingest.sentry.io`, which does **not** match a modern regional DSN host `oNNN.ingest.us.sentry.io` — pasting a DSN would deliver zero events. (4) `scripts/strip-sourcemaps.mjs` moves maps to a `sourcemaps/` directory on the ephemeral build container that nobody uploads, and `@sentry/vite-plugin` is not in `package.json` — every stack trace would be unreadable. Also no `release` field in `Sentry.init`, so crash-free rate and per-release regression attribution won't work.
- **Why it blocks:** You cannot run a pilot blind. Every degradation path in this codebase is designed to fail quietly and log; the log has no destination.
- **First action, in one commit:** create the Sentry project; set `VITE_SENTRY_DSN`; widen `connect-src` to include your DSN's actual regional host; replace `strip-sourcemaps.mjs` with `@sentry/vite-plugin` (`sourcemaps.filesToDeleteAfterUpload: ['./dist/**/*.map']` achieves the same no-maps-on-CDN goal *after* uploading); add `release` to `Sentry.init`; gate the prod console-suppression on `sentryDsn` being present. Then trigger one real exception from prod and confirm it arrives symbolicated. Enable spike protection (free tier = 5,000 errors/month, and one hot-path error loop can eat it in an afternoon).
- **Who:** CODE + OWNER (Sentry account) · **Effort:** ~3 hours

### A3. Transactional email cannot work — password reset is the only way back into an account
- **What:** No custom SMTP anywhere in the repo. Supabase's built-in service is capped at **2 emails/hour project-wide** and **refuses to deliver to any address that is not a project team member** — Supabase's own words: "best-effort only… no SLA guarantee". Compounding: `mailer_autoconfirm: true` is set on the live project (probed), yet `SignUpStep.tsx:126-256` still ships a full "בדוק את הדוא״ל שלך" screen with a 30s-cooldown resend button for an email that is never sent. Auth **Site URL** and the redirect allow-list are never mentioned in `DEPLOY-TODO` and have never been verified.
- **Why it blocks:** A locked-out user has no recovery path and no support channel to tell you (see A7). This is the most likely way a real user gets permanently stuck.
- **First action:** (1) Buy the domain (prerequisite — see D). (2) Provision Resend (free tier is 3,000/month **and 100/day and 1 domain** — the daily cap is the binding one) or Brevo (300/day). (3) Publish SPF + DKIM + DMARC on a **dedicated sending subdomain**, starting at `p=none`. (4) Wire custom SMTP in Supabase, **disable link tracking** (it rewrites and corrupts magic-link/reset tokens), and raise the fresh 30/hour cap on the Rate Limits page. (5) Verify Site URL and that the prod origin + `/reset-password` are in the redirect allow-list. (6) **Decide one way on confirmation:** either turn `mailer_autoconfirm` off and keep the confirm screen, or leave it on and delete the confirm-sent screen + resend logic + the dead `'Email not confirmed'` branch. (7) Send yourself a real live password reset end-to-end.
- **Who:** OWNER (domain, provider, DNS) + CODE (screen decision) · **Effort:** ~half a day after the domain exists

### A4. The recommended first action dead-ends on an empty screen
- **What:** The Dashboard first-run card renders "1 בחרו תבנית מוכנה (מומלץ)" as the primary CTA → `/templates` → "אין תבניות עדיין". `initializeBuiltInWorkoutTemplates` exists (`dataService.ts:36`) but is **never called from anywhere**, and if wired as-is it creates 5 templates against a limit of 3 and throws mid-loop with no try/catch.
- **Why it blocks:** The step-1 CTA on the home screen for every brand-new user promises content and delivers nothing. Classic first-session quit point.
- **First action:** Repoint the first-run CTA at `/program`, which already has real 12-week content (~30 min). Only if you want seeded templates: give app-seeded content the same quota exemption `isProgramHidden` gets, and wrap the loop in try/catch.
- **Who:** CODE · **Effort:** ~30 minutes (option A)

### A5. Every guest sees a permanent broken-sync banner with a dead button
- **What:** `offlineQueue.ts:752-757` early-returns for unauthenticated users, so a guest's queued mutation never drains; `OfflineIndicator.tsx:71-73` renders the banner on `queueDepth > 0` with no auth check and re-polls every 5s forever. Clicking "סנכרן עכשיו" changes nothing (retested live). It also reads "**1** פעולות ממתינות לסנכרון" — broken Hebrew plural, on the most persistently visible chrome in a Hebrew-first product.
- **Why it blocks:** Permanent "something is broken / your data isn't saved" chrome on the first screen of the lowest-friction entry path, directly contradicting the guest-mode value proposition.
- **First action:** Hide the pending-sync branch when `isGuest`, and stop enqueueing mutations at all in guest mode (a guest has no cloud target). Add the singular: `queueDepth === 1 ? 'פעולה אחת ממתינה לסנכרון' : …`.
- **Who:** CODE · **Effort:** ~1 hour

### A6. The free-template quota is enforced in production with billing off, and it silently loses data
- **What:** `trg_enforce_free_template_quota` is live and `entitlements` has zero rows, so every user is capped at 3. The client pre-check (`templateDb.ts:79-84`) counts **local IndexedDB** filtered by `!isTombstoned && !isProgramHidden`; the DB trigger counts **all cloud rows**. When local passes and the DB rejects, the template is already written to IndexedDB, `syncWorkoutTemplate` throws `P0001`, `offlineQueue` classifies it **permanent** and `moveToDeadLetter`s it — no user-visible error, surfaced only in a Settings section nobody visits. `DEPLOY-TODO:55-59` even names a live user with 7 cloud templates. Separately, 3 of 4 save-as-template paths mishandle the error: `WorkoutSummaryView.tsx:71-79` shows a generic "שמירת התבנית נכשלה"; `:90` swallows it with `.catch(() => {})`; `WorkoutActions.tsx:155` passes an `async` fn into a `() => void` prop wired to `onClick` → unhandled rejection with no telemetry.
- **Why it blocks:** Silent data loss caused by a monetization rule shipped before the monetization it enforces. It also hits anyone who reinstalls or uses a second device.
- **First action (pick the cheap option):** **Drop `trg_enforce_free_template_quota` entirely** — one SQL statement — since nothing is being sold. Raise `FREE_TEMPLATE_LIMIT` in `templateDb.ts:59` accordingly. Then import `isFreeTemplateLimitError` in both workout components and change the `WorkoutSummary` prop type to `() => void | Promise<void>` with a catch, so the class can never regress silently. (Re-introduce the quota only when billing ships, with grandfathering and a server-authoritative pre-check — see C8.)
- **Who:** CODE + SQL · **Effort:** ~4 hours

### A7. No support, contact, feedback or bug-report path anywhere
- **What:** 16 Settings sections, none is support/help/contact. `LegalLinksSection` exposes only terms/privacy/accessibility. The only contact address in the entire product is **a personal Gmail buried inside draft-labelled legal text** (`legalDocs.ts:140/:223/:255`, `AccessibilityStatement.tsx:249`, `AgeGate.tsx:98`). ⚠️ That address is also flagged in the owner's global instructions as their **partner's** mailbox.
- **Why it blocks:** Compounds with A2 and A3: telemetry is off, and the user who most needs to reach you is the one locked out by an email that never arrived. Also publishes a personal address to every stranger.
- **First action:** Register `support@<domain>` (and `privacy@`). Add a Settings → "עזרה ותמיכה" section with a single mailto CTA that pre-fills app version + last-sync state, and a published SLA of "תוך יום עסקים אחד" (beatable solo — do **not** promise 4 hours). Replace all five call sites. For an Israeli audience, a WhatsApp number will out-perform email.
- **Who:** OWNER (mailbox) + CODE · **Effort:** ~2 hours once the mailbox exists

### A8. The under-age block screen is an unescapable dead end
- **What:** `AgeGate.tsx:73-107` renders only a heading, a paragraph and a mailto. No sign-out, no "wrong date", no back. The verdict is server-persisted and `ageGate.ts:57-62` fails **closed** on any non-`42P01` error, so a transient network failure also lands the user here. Date entry is a raw DD/MM/YYYY text field, so a year typo is entirely plausible. Separately, the Terms promise a guardian-consent route (`legalDocs.ts:69`) that **does not exist** — `parental_consent_status` is only ever written as `'pending'` and nothing anywhere advances it to `'granted'`.
- **Why it blocks:** One typo permanently bricks an account with no self-service recovery, and the only recourse is a personal Gmail with no process behind it.
- **First action:** Add "התנתקו" plus a one-time "תיקון תאריך לידה" affordance (one correction within 24h, audited server-side) to the blocked screen. **Decide:** make under-age a clean hard block and **remove the guardian promise from the Terms**, or build the guardian flow. Recommend the former (see E9). Also make `set_birth_date` reject a change once `age_verified = false`.
- **Who:** CODE + OWNER (age policy decision) · **Effort:** ~half a day

### A9. Three one-line config lines kill two advertised features
- **What:** `netlify.toml:22` `camera=()` — an empty allowlist disables `getUserMedia` for **all** origins including self, so `BarcodeScanner.tsx:129` always rejects and every user is silently pushed to the manual fallback, which then also fails because `connect-src` omits `https://world.openfoodfacts.org`. Separately `img-src 'self' data: https:` omits `blob:`, so coach check-in photo previews (`MyCoach.tsx:792/:921`) render as broken images — the upload still works, which makes it look like data loss when it isn't.
- **Why it blocks:** Two advertised features non-functional in production, and the barcode failure is indistinguishable from the user denying permission, so nobody will ever report it.
- **First action:** `Permissions-Policy = "camera=(self), microphone=(), geolocation=()"`; add `https://world.openfoodfacts.org` to `connect-src`; `img-src 'self' data: blob: https:`. Test one real Israeli barcode and one check-in photo on an Android phone.
- **Who:** CODE · **Effort:** ~30 minutes

### A10. Missing JS chunks return `index.html` with HTTP 200, and the SW caches that HTML for 30 days
- **What:** `netlify.toml:10-13` is a blanket `/* → /index.html 200` with no `/assets/` exclusion (verified live: `GET /assets/nope-123.js` → 200, `text/html`). `vite.config.ts:99-109` then registers `CacheFirst` for `/assets/*.js` with `statuses: [0, 200]` and a 30-day max-age, so the SW stores that HTML body under the chunk URL. Confirmed present in the deployed `/sw.js`.
- **Why it blocks:** Every user with a tab open across a deploy gets "Failed to fetch dynamically imported module" the next time they navigate to a route they hadn't visited — a hard error mid-session, not the polite update toast the code was designed around. `registerType: 'prompt'` deliberately makes this window long.
- **First action:** Add a Netlify rule **before** the catch-all so `/assets/*` 404s properly; add content-type guarding to the `route-script-cache` rule; add a window-level chunk-load-error handler that force-reloads once. Test by deploying with a tab open.
- **Who:** CODE · **Effort:** ~3 hours

### A11. No database backups, and the Supabase plan tier is unverified
- **What:** No restore procedure, no PITR, no `pg_dump` anywhere in the repo. `DEPLOY-TODO`'s rollback section covers migration rollback only, not data loss. Repo evidence hints at a low tier (`ai-chat/index.ts:158-162`: "Deno KV is NOT used here: it is unavailable on this project/tier"). **Supabase Free has zero backups, pauses projects after 7 days of inactivity, goes read-only above 500 MB database size, and has 1-day log retention.**
- **Why it blocks:** The app stores irreplaceable personal data (workout history, body measurements, progress photos). A pause over a quiet holiday week takes the app down for everyone; a bad migration is permanent. This codebase has already fixed a sync/resurrection data-loss class twice.
- **First action, today:** open the Supabase dashboard and read the plan. If Free → upgrade to **Pro ($25/mo)** for daily backups (7-day retention), no pausing, 7-day logs, 8 GB disk, 250 GB egress, and an email support channel. Then **rehearse a restore** with "Restore to a New Project" and record the wall-clock as your documented RTO — this is also the only way to prove the live schema can be reconstituted, given repo ≠ live. Add a scheduled `supabase db dump` to an off-platform store. Leave **Spend Cap ON** at launch (revenue is zero, blast radius small); flip it off once there is real paid revenue plus a billing alert. Do **not** buy PITR ($100/mo) yet — Supabase's own guidance is to enable it above 4 GB.
- **Who:** OWNER · **Effort:** ~1 hour + a day to rehearse · **Cost:** $25/mo

### A12. Nothing monitors the site or the database
- **What:** No uptime check, no synthetic probe, no alerting rule anywhere in the repo. Mean time to detection is effectively unbounded, and users have no channel to tell you (A7).
- **Why it blocks:** The realistic failure modes are *not* "Netlify is down" — they are Supabase paused, an RLS change locking out trainees, or a 402 Fair Use restriction. **All of those return a perfectly healthy static site.** A root-URL ping would report 100% uptime through every one.
- **First action:** Set up four checks, alerting to your phone: (1) site root 200 + serves the shell; (2) Supabase REST reachable with the anon key; (3) one cheap edge-function health path — **not** `ai-chat`, which bills tokens per probe; (4) a synthetic authenticated journey (log in, read one row). UptimeRobot free (50 monitors, 5-min) or Better Stack free (10 monitors) — note the "3-minute free interval" claim that would favour Better Stack is **undocumented**, so choose on features, not that. Sentry's free plan also includes 1 uptime monitor.
- **Who:** OWNER · **Effort:** ~30 minutes · **Cost:** $0

### A13. Health data is consented to via one bundled ToS checkbox
- **What:** Weight, body measurements, progress photos, nutrition logs and injury history are all "מידע בעל רגישות מיוחדת" under Amendment 13. The PPA's final consent position statement (Feb 2026) requires **explicit, separate, granular, documented** consent — a single "I agree to the Terms" checkbox does not cover them. `ConsentGate` currently blocks the app behind exactly that.
- **Why it blocks:** This duty attaches regardless of whether you charge money, and it is the item most likely to be non-compliant today. It also cuts the other way commercially: 68% of fitness-app users are already worried about health-data use.
- **First action (minimum viable, does not need a lawyer):** add a distinct, **unticked** consent step in onboarding for health data, and a **second** distinct consent before the first progress photo, each with plain-Hebrew text at the point of the ask stating what is stored, where (Supabase), who can see it (specifically: **whether a coach can**), and how to delete it. Log timestamp + document version. Add a persistent "העדפות פרטיות" entry in Settings that reopens the same surface (withdrawal must be as easy as granting), with independent revocation of health-data and photo consents.
- **Who:** CODE (+ LAWYER at M4 for wording sign-off) · **Effort:** ~half a day

---

## 5. (B) BLOCKERS — launching to COACHES

*All A-blockers apply to coaches too. These are additional.*

### B1. Coach program assignment is capped by the **trainee's** free quota
- **What:** `upsertClientTemplate` (`coachApi.ts:516-539`) writes into the trainee's `workout_templates`; the trigger counts the row **owner** and has no coach exemption (grep for `is_coach_of`/`updated_by` in the migration returns nothing). `ProgramBuilder.tsx:400-410` loops one day = one template; the catch shows only `showToast('שיוך התוכנית נכשל', 'error')` and leaves the days that did land as orphan templates in the trainee's library.
- **Why it blocks:** A 4-day split fails. A trainee who already made 3 templates of their own — which the app actively encourages — can receive **nothing**. There is no way out: the quota is keyed to the trainee's entitlement, and no trainee can ever be non-free while billing is off.
- **First action:** Covered by A6 if you drop the trigger. If you keep it, add the exemption: skip the count when `NEW.updated_by IS DISTINCT FROM NEW.user_id` (or gate on `is_coach_of_user`). Map the error via `isFreeTemplateLimitError` to a specific Hebrew message in `ProgramBuilder`'s catch. Add a pgTAP case.
- **Who:** CODE + SQL migration · **Effort:** ~4 hours

### B2. Every self-serve coach gets `seat_limit = 1` and there is no upgrade path
- **What:** `become_coach()` seeds `seat_limit 1`; `guard_coach_subscription_fields()` forbids clients changing it and pins INSERT to exactly 1; enforcement fires at **both** invite creation and invite accept, plus a pre-check in the edge function. `CoachInvites.tsx:152-182` disables the button and says "הגעתם לתקרת המושבים. יש לשדרג את המנוי" — pointing at a purchase flow that does not exist and, even if it did, would grant nothing (`billing_sync_entitlement` returns early for `scope <> 'consumer'`; nothing anywhere writes `coach_subscriptions`). `docs/COACH-MANUAL-SETUP.md:67` claims a default of 3 — that is stale, the code seeds 1.
- **Why it blocks:** Client #2 is impossible. Every coach requires you to run SQL by hand against production. That is not a funnel.
- **First action for the pilot:** migration raising the seeded free-tier `seat_limit` to a real number (e.g. 5), with a backfill for existing rows; give the seat-full state a real CTA instead of dead copy; correct `COACH-MANUAL-SETUP.md`. **Do not** wire coach billing yet — that is M4 (C11).
- **Who:** CODE + SQL · **Effort:** ~1 hour

### B3. Push is dead client-side, and reminders were never scheduled
- **What:** `VITE_VAPID_PUBLIC_KEY` unset in Netlify → `pushService.ts:30` returns `no_vapid_key` for every subscribe, surfaced as "התראות לא מוגדרות בסביבה זו". Zero rows ever reach `push_subscriptions`, so `sendCoachPush` is a no-op on both the direct-assignment and group fan-out paths — **and the coach gets a success toast.** Separately, `reminder_dispatch.sql:41-58` has its `create extension pg_cron` / `cron.schedule` calls **entirely inside SQL comments** — they were never executed. Only the in-tab client materializer runs, i.e. only while a tab is open.
- **Why it blocks:** The whole premise of remote coaching is reaching the client between sessions. Silent non-delivery where both sides believe it worked is the worst failure mode. **The server half is already provisioned and paid for** — this is one missing Netlify variable plus two SQL statements.
- **First action:** Set `VITE_VAPID_PUBLIC_KEY` in Netlify to the public half of the keypair already in Supabase secrets; redeploy; enable reminders in Settings and confirm a row lands in `push_subscriptions`; trigger `coach-push-send`. Run the two `cron.schedule` statements for `reminders-dispatch`. **Verify on a real installed iOS/Android PWA, not desktop.** Audit `public/push-sw.js` for unconditional `showNotification()` inside `event.waitUntil()` — Safari revokes push permission for silent pushes. Make `NotificationsSection` surface `no_vapid_key` instead of silently no-op'ing. Add server-side pruning of 404/410 endpoints and re-validation on launch (iOS subscriptions go stale).
- **Who:** OWNER (env var) + CODE · **Effort:** ~2 hours + real-device verification

### B4. Coach-side reads render backend errors as empty lists
- **What:** `reports/06` flags three `MyCoach` reads and `CoachPrograms.listProgramTemplates` as rendering a failed query as an empty list.
- **Why it blocks:** To a coach, "my client's program vanished" and "the list is empty" are the same event, and it ends the relationship. The single most-cited reason coaches abandoned Trainerize in 2024-2026 was exactly this class of post-acquisition delivery/sync failure.
- **First action:** Give every coach surface an explicit error state with a retry, distinct from empty. Start with the four named sites.
- **Who:** CODE · **Effort:** ~half a day

### B5. Verify the coach RLS findings against the **live** database
- **What:** The 2026-06-29 whitebox audit found 2 HIGH (coach_clients invite/consent bypass; self-writable `seat_limit`) and 6 MED (ai-chat no entitlement check, stale group access after removal, cross-client record move, community rate-limit bypass, Sentry PII, backup-import). The repo now contains fix migrations for at least the seat_limit item. **Repo migrations are not the source of truth; production has migrations not in the repo.**
- **Why it blocks:** Selling a coach product where coach A could reach coach B's clients is existential, not a P1. You do not currently know which state production is in.
- **First action:** Run the Supabase **Security Advisor (Splinter)** to zero findings, enable "Enable RLS on new tables", enable SSL Enforcement, and manually re-test the two HIGH vectors against production with two throwaway coach accounts. Reconcile repo migrations against live schema and write down the delta.
- **Who:** CODE + OWNER · **Effort:** ~half a day

### ~~B6. Does the invite deep link work for a logged-out user?~~ — **NOT A BLOCKER. Refuted 2026-08-09.**
- **The claim:** `reports/06` documented that `AppRouter`'s unauthenticated gate renders `<Login/>` for every path except legal/accessibility, so `/join?code=` never mounts and the code is lost. Two auditors repeated it. **It was never re-tested — and it is wrong.**
- **What the code actually does (read directly):** `AppRouter.tsx:323` registers `<Route path="/join" element={<JoinPage />} />` inside the `status === 'unauthenticated'` branch, **above** the `path="*"` → `<Login />` catch-all at `:328`. A logged-out visitor therefore gets `JoinPage`, which renders a Hebrew explainer ("הוזמנת להתחבר למאמן / כדי לקבל את ההזמנה, יש להירשם או להתחבר קודם") and a CTA that calls `rememberInviteContinuation(code)` then navigates to `/login?next=…` (`JoinPage.tsx:66-74`). The continuation survives the auth transition — `authSessionTransition.test.ts:197-204` asserts `PENDING_AUTH_REDIRECT_KEY` is preserved across it — and `AppRouter.tsx:335-337` deliberately routes an authenticated invite recipient to `/join` **before** onboarding. `JoinPage.tsx:101-104` then consumes and clears the continuation so a brand-new account still reaches onboarding.
- **What this means:** `reports/06` is stale on this point; do not spend the half day. The four-state manual test (existing user / brand-new user / expired code / coach opening their own link) is still worth 15 minutes as regression confidence before M3, but it is a **check, not a fix**, and it does not gate anything.
- **Who:** nobody · **Effort:** 0

### B7. Coach mode is a permanent one-way door, and the copy says otherwise
- **What:** Promotion is one tap (Settings, or the onboarding role pick). There is no reverse path anywhere; `guard_profile_role()` actively blocks coach→trainee while a `coach_profiles` row exists. `RoleStep.tsx:125` tells the user "תמיד אפשר לשנות בהגדרות בהמשך" — true one way, false the other. Side effect: `coach-invite-accept` returns `coaches_cannot_join`, so the account can **never** be coached by anyone — including a real trainer who wants to experience their own program, or who trains under a mentor. Separately, for a **guest** who picks "מאמן" in onboarding, `AppRouter.tsx:274-279` calls `clearGuest()` and dumps them at the login screen with no explanation.
- **Why it blocks:** A curious trainee taps a button and is permanently stuck in a client-management UI with no support path except operator SQL.
- **First action:** Remove the coach option from trainee onboarding (or require sign-in first with an explanatory screen instead of `clearGuest()`). Add a "חזרה לחשבון מתאמן" action in `CoachSection`, guarded by zero active `coach_clients`, via a `leave_coach_mode()` SECURITY DEFINER RPC that deletes `coach_profiles` + `coach_subscriptions` then flips `profiles.role`. Fix the `RoleStep` copy.
- **Who:** CODE · **Effort:** ~4 hours

---

## 6. (C) BLOCKERS — CHARGING MONEY

*All A and B blockers apply. Most of C is not code.*

### C1. There is no legal seller
- **What:** No company name, ח.פ/ע.מ, registered address or phone appears in any document. Every legal doc's only contact is a personal Gmail. The ToS names **no contracting party**.
- **Why it blocks:** A privacy policy that does not identify the controller cannot support valid consent or a DSAR process, and a ToS with no party on the other side is not a contract. You also cannot issue a קבלה without a registered business.
- **First action:** Decide עוסק מורשה vs a company with your accountant and register. Note the **2026 עוסק פטור ceiling is ₪122,833** and an עוסק פטור may **not** charge VAT and may **not** issue a חשבונית מס — only a קבלה. Any real subscription business needs עוסק מורשה or a company. Then fill the entity name, address and `privacy@`/`support@` into the three legal contact sections plus `AccessibilityStatement.tsx:249` and `AgeGate.tsx:95`.
- **Who:** OWNER + ACCOUNTANT · **Effort:** days–weeks of external lead time; the code edit is minutes

### C2. No automatic receipt (קבלה) on every payment and renewal
- **What:** Nothing in `src/services/billing` or the webhook calls any invoicing API. **The obligation is unconditional** and is not the same as the allocation-number rule: הוראות מס הכנסה (ניהול פנקסי חשבונות), תשל"ג-1973 — ס' 5(א) a receipt voucher for each receipt separately, ס' 5(ד) a copy must be given to the payer, ס' 17(א) documentation must be created close to the transaction.
- **Why it blocks:** Hard legal gate on taking Israeli money.
- **First action:** Integrate an invoicing provider with an API (Green Invoice/morning, iCount, Invoice4U, SUMIT, EZcount — Cardcom and Greeninvoice can also emit documents natively, so you may not need a second vendor). On every successful charge, `billing-webhook` must issue the document and store its id/URL against the subscription.
- **Who:** CODE + CPA (which provider, which document type) · **Effort:** ~2 days

### C3. No homepage cancellation link, and `cancelAtPeriodEnd` is legally insufficient
- **What:** **סעיף 14ט** (confirmed against the statute): "לעניין עסקה שניתן להתקשר לגביה עם צרכן באינטרנט, ייצור עוסק **בדף הראשי** של אתר האינטרנט שלו **קישור ייעודי** שבאמצעותו ניתן לשלוח הודעת ביטול." **סעיף 13ד(ג):** the contract ends within **3 business days** of the notice (6 if by registered mail). The consumer may also give notice **orally, by phone, in person, by registered mail, by email, by fax, or via the site — at the consumer's choice.**
- **Why it blocks:** This is the single most commonly missed requirement. Failure to stop charging on time exposes you to statutory damages of up to **₪10,000 without proof of damage** (סעיף 31א, and the Authority's closed list expressly includes failure to cancel a distance transaction).
- **First action:** Build the public homepage cancellation link (depends on the landing page, D1) reachable **without logging in**; build in-app self-serve cancellation that takes effect within 3 business days with pro-rata refund of prepaid amounts, **not** at period end; publish a real phone number and monitored email next to it; log every notice with timestamp and channel (the 3-vs-6-day clock depends on channel).
- **Who:** CODE + OWNER (phone number) · **Effort:** ~2 days

### C4. No 14-day cooling-off refund path
- **What:** **סעיף 14ג(ג)(2):** for an ongoing service the consumer may cancel within 14 days of the transaction **or** of receiving the disclosure document — **whichever is later** — "בין אם הוחל במתן השירות ובין אם לאו". **סעיף 14ה(ב)(1):** maximum cancellation fee is 5% of the price **or ₪100, whichever is lower** — and zero if cancellation is due to a defect or breach. **סעיף 14ה: refund within 14 days** of receiving the notice. ⚠️ *Corrected from the research's "7 business days".*
- **Why it blocks:** You must be able to fully refund a first charge minus at most ₪100, and "all sales final"/"no refunds on digital goods" clauses are unenforceable here and are themselves violations.
- **First action:** Build a refund path against the PSP API. Write the Hebrew copy stating **14 ימים**, not 7 business days. Do **not** build the 4-month extended window for 65+/disabled/עולים unless you add human-sold plans — for pure self-serve distance selling it is conditioned on a prior conversation (14ג1(ג)).
- **Who:** CODE + LAWYER (copy) · **Effort:** ~1 day

### C5. No disclosure document (טופס גילוי) at checkout
- **What:** Nothing is sent post-checkout. Because the 14-day clock runs from the **later** of the transaction and receipt of the document, **not sending it leaves the cancellation window open indefinitely.**
- **Why it blocks:** It is both an obligation and your own protection — it closes the window.
- **First action:** Email a Hebrew summary of price, term, renewal behaviour and cancellation terms immediately post-checkout, and store proof of sending. (`hebrew-document-generator` is installed if you want a PDF.)
- **Who:** CODE + LAWYER (required fields) · **Effort:** ~half a day

### C6. No end-of-term notice and no promo-price-rise notice
- **What:** **סעיף 13א(א)** defines "תקופת ההודעה" as between 60 and 30 days before the end of a fixed term; you must notify in writing of the end date and cancellation rights. Separately you must give advance written notice before a promotional price rises, even if the consumer knew in advance.
- **Why it blocks:** A fitness app will almost certainly launch a "first month ₪1" or annual offer. This is a scheduled-job requirement, not a policy one, and it does not exist. *(Whether it reaches month-to-month plans is unresolved — lawyer question.)*
- **First action:** Add a scheduled job emitting both notices. Ships with the dunning scheduler (C10).
- **Who:** CODE · **Effort:** ~half a day on top of C10

### C7. The legal documents are drafts, and the consent audit trail asserts things the code never checks
- **What:** Four distinct defects. (1) All three docs are `isDraft: true` and `LegalDocPage.tsx:121-136` renders "טיוטה — המסמך טרם עבר אישור משפטי סופי" on the very pages `ConsentGate` forces users to accept. (2) `content_hash` is `sha256('terms|2026-06-09')` — a hash of the **version string**, not the text — so the Hebrew can be edited with no re-prompt and the stored "proof" still matches. The correct function (`legalHash.ts` `canonicalText()`) and the script (`scripts/compute-legal-hashes.mjs`) both exist, unused. (3) Every user gets a consent row for `coach_terms` — a document with **no route and no way to read it** — because `ConsentContext.tsx:69` keeps all pending types while the gate shows only two checkboxes; `REQUIRED_DOC_TYPES` is exported and never imported. (4) `record_consent` takes `is_minor`/`guardian_ack` **from the client**, no caller ever sets them, and the server already knows the answer from `user_age_verification` — so 100% of rows assert no minor consented.
- **Why it blocks:** A blocking modal demanding consent to a self-labelled unapproved draft is legally worthless as a consent record and a credibility hit at the moment of highest suspicion. The audit trail cannot answer the only question it would ever be asked.
- **First action:** (Code, ~1 day, do first) filter pending by `REQUIRED_DOC_TYPES` and gate `coach_terms` behind the coach role; add a `/legal/coach-terms` route; run `compute-legal-hashes.mjs` and seed the **real** digests with a CI check; delete the two client parameters from `record_consent` and derive them server-side from `user_age_verification`. (Legal, weeks) lawyer review of all three Hebrew docs, then bump version + hash and flip `isDraft: false`.
- **Who:** CODE then LAWYER · **Effort:** ~1 day code + weeks of legal lead time

### C8. Five of six advertised premium features have **zero** enforcement
- **What:** `PaywallScreen.tsx:37-80` advertises `advanced_progress`, `cloud_sync`, `unlimited_templates`, `data_export`, `progress_photos`, `ai_coach`. A grep for `PremiumLock|PlanGate|useEntitlement|isPremium` across all of `src/` returns **only** the paywall itself (using `refresh`) and `templateDb.ts`. `src/components/billing/PremiumLock.tsx` is imported by nothing. Server side, `has_feature_access` is called from exactly one place: `ai-chat/index.ts:215`. No RLS policy, RPC or storage rule references it.
- **Why it blocks:** Turning billing on today would charge money for exactly one thing the user didn't already have. That is a refund/chargeback and consumer-protection problem, not a product gap.
- **First action — recommended:** **shrink the paywall to what is genuinely enforced** (unlimited templates + AI) — a 30-minute honest fix — rather than building five gates. If you instead wire gates, do not flip `VITE_BILLING_LIVE` until a free-user deny test passes for **every row shown on the paywall**.
- **Who:** OWNER (decision) + CODE · **Effort:** 30 min (shrink) or days (wire)

### C9. No payment provider — and Stripe is not available to you
- **What:** **Confirmed by direct fetch of stripe.com/global: Israel appears in no list** — not supported, not Preview, not extended network. Blogs claiming "Stripe launched in Israel in 2024" are wrong. The repo's decision to hide the provider behind `BillingAdapter` with `BILLING_PROVIDER` unset is **correct — keep it.**
- **Why it blocks:** No rail, no revenue.
- **First action:** Get **written quotes and written capability confirmations** from 2-3 Israeli PSPs (Cardcom and PayPlus have the most modern REST APIs; then Tranzila, Hyp, Meshulam/Grow, Greeninvoice). ⚠️ **Every capability and fee claim about these providers is unverified** — none publish fees, and the "~1.2-1.4% + ~₪59/mo", "all support Apple Pay/Google Pay/Bit", and "token-based recurring, no subscription object" claims all rest on a comparison blog. Ask each in writing for: card tokenization + server-side recurring charge, refunds API, Apple Pay / Google Pay / Bit, webhook signature scheme, sandbox, and the fee schedule. Negotiate — 20-40% discounts are reported.
- **Who:** OWNER · **Effort:** weeks of lead time

### C10. Dunning, retries and card-updater must be built by you
- **What:** Israeli PSPs give you tokens and a charge endpoint, not Stripe Billing. The subscription state machine, renewal dates, retry ladder, expired-card detection, Hebrew "update your card" flow, and grace period before entitlement revocation all live in your Supabase schema and a scheduled edge function. None of it exists. **Failed payments account for 30-50% of total churn in fitness apps.** PayPal-specific gotchas if used: the buyer may cancel a Preapproved Payment up to **3 business days after** the payment date, and a preapproved arrangement **auto-cancels after 24 months of inactivity** (Israeli Payment Services Law ss.34-35).
- **Why it blocks:** Without it, a declined card silently ends a paying subscription.
- **First action:** Build the scheduler + exponential retry + pre-renewal reminder + grace period. Honour the `eventId`/`eventAt` idempotency and ordering fields the adapter interface already anticipates. **Estimate this as the largest single engineering line item of the whole billing project.**
- **Who:** CODE · **Effort:** ~1-2 weeks

### C11. Coach seats cannot be sold end-to-end
- **What:** `billing_core.sql:155-157` — `IF NEW.scope <> 'consumer' THEN RETURN NEW` — the entitlement projection deliberately skips coach scope, and nothing anywhere writes `coach_subscriptions`. `billing_prices.grants_plan` only permits `'free','pro_monthly','pro_yearly'`, so the commented-out coach price template has to insert `grants_plan='free'` for a paid coach plan. No `/coach/billing` screen exists.
- **Why it blocks:** A purchased coach plan would grant zero extra seats. The B2B revenue line is non-functional at the plumbing level.
- **First action:** Extend `billing_apply_subscription` (or a sibling) so `scope='coach'` upserts `coach_subscriptions(coach_id, plan, seat_limit = price.seat_limit * quantity, status)`, guarded against downgrading below the coach's active client count; add a `/coach/billing` screen; turn the dead "יש לשדרג את המנוי" copy into a link. Add a `'coach_seats'` value to `grants_plan` (or drop the CHECK) and document that consumer plan and coach seats are separate axes.
- **Who:** CODE · **Effort:** ~3 days

### C12–C18. Smaller but hard gates before the first real charge
| # | What | First action | Who | Effort |
|---|---|---|---|---|
| C12 | `billingAdapter.ts:258-261` defaults the origin allowlist to localhost, and `billing-checkout` builds `successUrl` from the **first** entry — which then passes `isAllowedRedirect` because localhost is in its own default. A real charge would return the customer to a localhost URL. | In `billing-checkout`, require `ALLOWED_ORIGIN` explicitly (`if (!env('ALLOWED_ORIGIN')) return billing_not_configured`). Set `ALLOWED_ORIGIN` **before** `BILLING_PROVIDER` in the go-live sequence. | CODE | minutes |
| C13 | `AI_REQUIRES_ENTITLEMENT` unset ⇒ AI is free for every signed-in user, while the paywall lists `ai_coach` as pro-only. | **Decide before the first price row exists**, so no one has a free-AI habit to lose: either `supabase secrets set AI_REQUIRES_ENTITLEMENT=true`, or stop listing AI as gated. Do not leave the two in contradiction. | OWNER | minutes |
| C14 | `ai-chat` sends age, weight, goals, recovery and nutrition to **PoloAI** (`poloai.top`) automatically on dashboard mount. PoloAI appears **nowhere user-visible** and is absent from the privacy policy's sub-processor list — as is **Netlify**. There is **no cross-border transfer section at all**. | Add PoloAI and Netlify to the sub-processor list with what is sent and where; add a "העברת מידע מחוץ לישראל" section; add a user-visible "מנוסח בעזרת AI" note plus an opt-out; obtain/accept the vendor DPAs (Supabase, Netlify, Sentry, PoloAI) and retain the executed copies. ⚠️ Also confirm PoloAI's terms permit this and whether it is a viable processor at all. | LAWYER + CODE | ~1 day + vendor review |
| C15 | VAT 18% (confirmed, stays 18% in 2026). All ILS prices must be **VAT-inclusive and in shekels**. Your net is price ÷ 1.18. | Price VAT-inclusive everywhere; confirm VAT reporting cadence with the CPA (bi-monthly up to ₪1,775,000 turnover from 1.1.2026, monthly above). | CPA + CODE | hours |
| C16 | `entitlements.source` CHECK accepts `web_stripe/web_paddle/apple/google`, but the adapter key is `'paddle'` → every entitlement row is written with `source = NULL`, permanently unattributable. | Rename the adapter key to `web_paddle`, or widen the CHECK. **Before the first real purchase**, or early rows are unattributable forever. | CODE | minutes |
| C17 | `billing-webhook:206-212` marks **every** open checkout session for the user completed, not the one paid. | Add `.eq('provider_session_id', <id from event>)`. | CODE | minutes |
| C18 | All three paywall E2E tests are `test.fixme`; `supabase/tests/billing_core_test.sql` has no runner in CI. Zero executing coverage of checkout, webhook idempotency, or grant/deny. | Stand up the PSP sandbox, seed a test price, un-`fixme` in the order the spec header prescribes, add `psql -f billing_core_test.sql` to CI against a branch DB, and run a full sandbox pass **including deliberate failure injection** of `billing_apply_subscription`. | CODE | ~3 days |

---

## 7. (D) Important, not blocking

Grouped. Each is real; none should stop a launch.

**Distribution & trust** *(do most of these at M2)*
| Item | Action | Who | Effort |
|---|---|---|---|
| D1. No custom domain, no landing page, no identity | Buy the domain; build a public logged-out root page: one-line Hebrew value prop, 2-3 real screenshots, price intent, a **named founder with a face**, links to privacy/terms/support, and the C3 cancellation link. Netlify auto-provisions the cert; use ALIAS/ANAME for the apex; add a CAA record. **This is also the prerequisite for A3 (email DNS).** Caution: more trust badges is not linearly better — one SaaS added badges and saw a 12% conversion **drop**. Prefer specific verifiable claims. | OWNER + CODE | ~1 day + DNS |
| D2. No OG/Twitter tags, empty sitemap, soft-404s on every unknown path | Add `og:*`/`twitter:card`/canonical; populate sitemap + robots `Sitemap:` line; set manifest `id`/`start_url` to the final origin in the same change. Distribution is a link pasted into WhatsApp — today it renders a blank card. | CODE | ~2 hours |
| D3. Onboarding is 7 steps and asks גיל/גובה/משקל at step 3 | Cut to ≤5 screens with 2-3 questions that visibly change the next screen; move body data to **after** the first completed workout. Completion drops ~15% per screen beyond five. | CODE | ~1 day |
| D4. No defined activation event | Define it as **first workout COMPLETED**; target 30-50% within 48h; land the user directly on a ready-to-start beginner workout, not a dashboard. Make "3+ workouts in week one" the north-star (those users churn 4-5× less). | CODE | ~1 day |
| D5. Notification permission timing | Ask **after** the first completed workout with a Hebrew pre-primer and a "לא עכשיו". Web push permission is one-shot per origin — a denial is permanent. Do this in the same moment as the A2HS prompt. | CODE | ~2 hours |
| D6. PWA install is never coached | Build an iOS Safari Add-to-Home-Screen sheet (only when not standalone) with the real Share icon, and an Android `beforeinstallprompt` button. Add `screenshots` (narrow + wide) and `id: '/'` to the manifest — without screenshots Chrome shows the mini-infobar instead of the rich install dialog. iOS push and durable storage **both** depend on installation. | CODE | ~1 day |
| D7. Storage persistence called too late | Move `ensurePersistentStorage()` to app boot (it currently only fires in `ActiveWorkoutNew.tsx:529` and `Program.tsx:101`). WebKit's 7-day storage cap does not apply to Home Screen apps, but LRU eviction under disk pressure does. Also: **no Background Sync in Safari, ever** — flush the queue on `visibilitychange`/`focus` and show a visible "X workouts not yet synced" chip. | CODE | ~half a day |
| D8. Analytics: 6 of 12 events have no emitter, and no read path | Add `signup_completed`, `workout_started`, `first_workout_completed`, `subscription_cancelled`, `sync_failed`, `unsynced_changes_held`. Create 5 saved SQL queries in Supabase for the core funnel. **Do not install a third-party analytics tool** — the infrastructure exists. Also record the consent decision itself as a non-gated counter so you can scale every downstream number (today all telemetry is opt-in-off-by-default and you cannot tell whether coverage is 8% or 80%). | CODE | ~half a day |
| D9. No testimonials, no money-back guarantee, no help center, no in-app feedback | Collect 3-5 attributed Hebrew testimonials from the M1 pilot; publish a 14- or 30-day money-back guarantee; write 8-12 Hebrew FAQ answers (top one will be "how do I install this to my home screen"); add a one-tap feedback entry during the pilot. As a PWA you have **no App Store star rating** — testimonials are the only substitute. | OWNER + CODE | ~1 day |

**Coach product** *(most matter at M3, none block the first coach)*
| Item | Action | Effort |
|---|---|---|
| D10. Roster activity query is unbounded | `coachApi.ts:88-93` has no `.limit()` and no date window; PostgREST truncates at 1,000 rows, after which dormant clients render as "חדש" and the attention triage silently inverts. **Trigger: ~16 weeks after the first 20-client coach, or immediately at 50 clients.** Add `.gte('start_time', now-60d)` + an explicit limit, or move the aggregate to an RPC. Add a unit test asserting old-sessions-only ⇒ `inactive`, not `new`. | ~3 hours |
| D11. No coach onboarding | Coach-mode first-run checklist in Hebrew: profile → invite 1 client → clone 1 program → assign → send first message. Trainerize needs 4-8 hours of training because it has none; time-to-first-value under 30 minutes is the bar. | ~1 day |
| D12. No bulk client import | The realistic Israeli customer runs on WhatsApp + Excel, not Trainerize. Build phone-number bulk invite (WhatsApp share link per client, **not email**) and paste-a-spreadsheet program import parsed by the existing AI substrate. This converts the migration objection into the demo. | ~2 days |
| D13. Invite `email` column is a free-text label | Nothing ever emails an invite; the UI already relabels it "שם או תזכורת". Rename the column to `label` for honesty and lean on link/QR/share (WhatsApp is the channel here anyway). | ~1 hour |
| D14. No coach branding, no voice notes, no client self-booking, no PDF report, no coach-assignable habits | In-PWA coach branding (logo/color/name on the trainee surface) closes most of the perceived white-label gap cheaply. Voice notes are not optional in a WhatsApp-first market. Client self-booking matters because Israeli trainers are hybrid, not pure-online. PDF report is free distribution (`hebrew-document-generator` is installed). | days each |
| D15. Point some AI at the **coach** | "Summarize this week's 25 check-ins and tell me who needs attention" is the highest-value adopted AI use case of 2026, and **Hebrew check-in summarization is a genuine moat** — no incumbent can do it. | ~2 days |

**Platform & ops**
| Item | Action | Effort |
|---|---|---|
| D16. Deploy previews build against the **production** Supabase | Every PR preview writes to the live customer database, and `public/robots.txt` ships identically to every context so previews are crawlable. Set env vars **per deploy context**; password-protect previews; emit a disallow-all robots.txt for preview contexts. | ~2 hours |
| D17. Netlify plan/credits | Check which billing model this account is on. Post-Sep-2025 Free = **300 credits hard limit** — 15 credits per production deploy means ~20 deploys exhausts it before serving a byte, and at zero **all projects are paused** with no way to buy more on Free. Personal is $9/mo for 1,000 credits. (Note a reported Jul-Aug 2026 bug blocking free-plan deploys despite remaining credits.) | 30 min |
| D18. No `NODE_VERSION` pin | Add `[build.environment] NODE_VERSION = "22"` and a matching `.nvmrc`. The next deploy is the one shipping the CSP/env fixes — do not let Netlify's default Node change under it. | 20 min |
| D19. Asset caching, manifest MIME, font preload, dangling sourcemap comments | Add `[[headers]]` for `/assets/*` with `max-age=31536000, immutable`; serve `manifest.webmanifest` as `application/manifest+json`; drop the CSP-blocked inline `onload` on the font preload (it throws a violation on every page load and Bricolage Grotesque may be silently falling back); strip trailing `//# sourceMappingURL=` lines in `strip-sourcemaps` (or delete the script per A2). | ~1 hour total |
| D20. `react-doctor.yml` triggers on `main`; the branch is `master` | A quality gate that has never executed. One-line fix or delete. | 5 min |
| D21. Migration discipline | Repo migrations ≠ live. Adopt expand/contract, write the down-migration and rehearse forward-verify-back-verify in a branch or restored clone before touching prod. Reconcile the repo↔live delta **before** the next schema change, not during an incident. | ~1 day |
| D22. AI spend has no global ceiling | Per-user limits are 10/min and 100/day, so 100 signups = 10,000 calls/day with no aggregate cap and no alarm between "normal" and "card maxed". **Set a hard monthly cap + 50%/80% alerts in the AI provider dashboard today (minutes)**, then add a global daily bucket to `consume_rate_limit`. Also: token/dollar budgets, not just request counts — one long prompt ×10/min stays inside the limit while burning a multiple of the cost. Also confirm `POLOAI_API_KEY` is even set (unverifiable from outside — sign in once and send one AI message). | 30 min + hours |
| D23. Community moderation queue has no reader | `post_reports` accumulates with no UI; the migration's own comment points at a moderation surface that does not exist. Either ship an owner-only triage page behind a service-role function, or **turn the community off until it exists**. Stopgap today: a saved SQL query + a daily reminder. Harassment in a fitness community with body photos is real exposure. | days, or minutes to disable |

**Legal/compliance, non-blocking**
| Item | Action | Who |
|---|---|---|
| D24. DSAR export is local-only | `exportService.ts` reads only IndexedDB — omitting photos, coach/group messages, community posts, `coach_notes`, consents, age verification, entitlements, push subs, profiles. **Stopgap today (minutes): relabel the UI honestly as "נתוני המכשיר בלבד"** and soften `legalDocs.ts:197`. Real fix: an `export-my-data` edge function mirroring the (excellent) `account-delete` pattern. | CODE |
| D25. `coach_notes` are invisible to the client | A coach's written assessments of an identified person, held by the platform, unreadable and unexportable by the subject, while the policy grants access and rectification with no carve-out. **Decide:** disclose the exception, or include them in the DSAR export. | OWNER + LAWYER |
| D26. GPC is advertised but only a caption | `isGpcEnabled()` is consumed in exactly one place — display text — while `acceptAllTracking()` sets `analytics: true` unconditionally, and the policy asserts CCPA "Do Not Sell or Share". Make GPC force `analytics: false`. | CODE, 30 min |
| D27. Analytics consent is client-enforced only | `product_events` RLS checks ownership and an event allow-list but nothing about consent, and consent lives in localStorage (per-device, no server record). No retention/purge job. Store the decision server-side, add it to the RLS `WITH CHECK`, add a purge for rows older than N months. | CODE, half a day |
| D28. The health/medical disclaimer exists only inside the ToS | Nothing at onboarding, nothing before a first workout, nothing on the AI surfaces — for a product that issues load recommendations and nutrition targets. Add a one-line disclaimer at the onboarding health-data step and a persistent footnote on the AI coach panel and `CoachBriefCard`, linking to the Terms. Also add **PAR-Q-style readiness screening** — but only if a "yes" answer actually gates the product **consistently every time**; an inconsistently-enforced clearance rule is evidence *against* you. | CODE + hebrew-content-writer |
| D29. EU AI Act Art. 50(1) | "You are interacting with an AI" disclosure has applied **in full since 2 Aug 2026** (no grace period). Trivially cheap; do it regardless of EU targeting. | CODE, minutes |
| D30. Accessibility statement names no coordinator | The `OWNER ACTION` marker is live in production ("אחראי/ת נגישות: צוות SparkOS Fitness" is a placeholder). Supply a real full name + title; confirm the "60 ימי עסקים" wording. ⚠️ **Do not rely on the 60-day cure period as a defense** — it is judicial practice plus an unenacted bill, not statute. Note the ≤₪100,000/עוסק פטור exemption is flat with no clock, but the ≤₪1,000,000 renewable exemption applies **only to sites that began operating before the regulations** — a site launched today gets nothing from it. The accessibility **statement is mandatory even when exempt**. | OWNER, minutes |
| D31. Do not rely on blanket liability-exemption clauses | Under the Standard Contracts Law 1982 such clauses are presumptively "depriving conditions" and Israeli courts void or rewrite them. Protection comes from screening, honest claims and insurance — not contract text. Draft narrow, reasonable limitations. *(Sub-section numbering unverified — lawyer.)* | LAWYER |
| D32. Coach platform posture is undefined in the ToS | Four clauses needed: intermediary status, coach indemnity to the platform, program IP (coach retains vs platform licence), and coach warranties re: qualifications/insurance. Courts increasingly look past the "marketplace" label — you host the programs, mediate the chat, and bill the seats. | LAWYER |
| D33. Marketing consent must be separated from transactional | Communications Law s.30A requires prior explicit opt-in for advertising by email/SMS/automated call, with statutory damages per message and no proof of damage. Workout reminders are transactional; "upgrade to premium" pushes are advertising. **Ship separate consent flags before any promotional push**, and a coach-broadcast policy stopping coaches from using the channel to advertise. *(Exact per-message ceiling unverified — lawyer.)* | CODE + LAWYER |
| D34. `user_consents.user_agent` is declared and never written | Either populate it or drop the column so the schema stops implying evidence that does not exist. | CODE, 30 min |
| D35. Database Definition Document / ROPA | If the individual-managed carve-out does **not** apply, you owe a DDD: data inventory and classification, storage location, purposes, permitted uses, transfers abroad, named database manager — reviewed annually by 31 December. **Write it once to satisfy both the Israeli DDD and a GDPR ROPA (~80% the same artifact).** One page is enough. | OWNER + LAWYER, ~1 day |

---

## 8. (E) Explicit non-goals for v1

Say no to these on purpose. Each has a reason, so you can re-open them deliberately later.

1. **App Store / Play Store presence.** iOS: a Capacitor wrapper with no native-only capability is a high-probability Guideline 4.2 rejection ("repackaged website"), tightened further by the 9 June 2026 revision of 4.3(b) against apps "indistinguishable from what's already widely available" — and today **nothing in `src/` imports `@capacitor/*`**. Guideline 3.1.1 then forces IAP at 15-30%, and the US external-link relief does **not** apply to the Israeli storefront. Android: a TWA is cheap but a personal Play account created after 13 Nov 2023 needs **12 testers for 14 continuous days**, target API 36 from 31 Aug 2026, a Data safety form, and Play Billing if you sell inside it. At Israeli price points, 15% Apple + 18% VAT leaves ~0.72 of sticker. **Web-first keeps 100% minus PSP fees and has zero review latency.** Revisit only if measured iOS standalone-install rate stays below ~15% after 60 days *and* coach push proves to be the core retention lever.
2. **EU / international customers.** Staying Hebrew-only, ILS-priced and Israel-marketed keeps you outside the GDPR Art. 3(2) targeting test, outside Non-Union OSS (which would mean charging each EU country's VAT **from the first sale** with no threshold for a non-EU seller), and away from the 2023 EEA-transfer regulations' co-location risk. **Protect this position consciously:** no EU-language marketing, no EUR pricing, no EU-targeted ads.
3. **Merchant-of-record rail (Paddle).** Paddle's own tax-registration list (last updated 1 Aug 2025) **does not include Israel** — it is not registered to charge or remit Israeli VAT, and the export zero-rating in סעיף 30(א)(5) probably fails because the service is in substance supplied to an Israeli resident. Israel is also only *absent* from Paddle's 28-country unsupported list, never affirmatively supported. Only relevant if an international tier ever exists — and then as a **second** rail, never as the Israeli one.
4. **Exercise video library.** Table stakes globally (TrueCoach 3,000-4,000 clips, Kahunas 1,000+), but weeks of work. 166 classified Hebrew exercises with text tutorials and images beats the Israeli incumbents you actually compete with (BaseCRM ships **35** exercises).
5. **Wearables** (HealthKit / Health Connect / Whoop / Garmin / Oura). Differentiator, not blocker, and Apple Health / Health Connect need the native build. Whoop and Oura have cloud APIs if you ever want a cheap first integration.
6. **White-label / branded coach app in the stores.** The incumbents' main monetized upsell, but in-PWA coach branding (D14) closes most of the perceived gap for a fraction of the cost.
7. **Wiring the five unenforced premium gates.** Shrink the paywall instead (C8). Build gates only for features you actually intend to withhold.
8. **Security and compliance theatre.** No SOC 2. No external penetration test (HIGH-tier duty only). No PPA database registration. No PPO/DPO appointment. No s.17B information security officer. No formal DPIA project — a one-page memo concluding "not required, here is why" is the deliverable, and it is cheap insurance under unannounced-inspection powers.
9. **Guardian / parental-consent flow.** Choose a clean hard age block instead — but then **remove the guardian promise from the Terms** (`legalDocs.ts:69`), because documenting a route that does not exist is worse than not offering it. Note Israeli minors under 18 lack legal capacity, so their consent (and therefore consent to store their body photos) is retroactively voidable; a hard 18+ gate is the cheapest risk reduction available and also moots the GDPR Art. 8 patchwork.
10. **Product Hunt / Show HN / BetaList / Reddit English launches.** They send English-speaking non-Israeli traffic to a Hebrew UI — inflating vanity signups while poisoning the activation and retention data you need. The channel is Hebrew Facebook groups (7.59M Israelis, 79.6% of population) and WhatsApp communities (88%+ monthly use), plus 2-5 Israeli coach partners.
11. **Third-party product analytics (PostHog/Amplitude/Mixpanel).** You already have `product_events` deployed with 6 working emitters. Finish it (D8).
12. **The community feed, unless the moderation tool ships.** Off is a legitimate v1 answer (D23).
13. **Israeli food database, form-check video, adaptive targets, automation builder, coach business analytics.** All real opportunities. All later.

---

## 9. Sequenced plan

### M0 — "Stop the bleeding" (the site is already live)
**Entry criteria:** none. Start today.
**Contents:** A2 (Sentry, all four defects, one commit) · A9 (three CSP/header lines) · A10 (asset 404 + SW cache) · A11 (check plan, upgrade to Pro, spend cap ON) · A12 (uptime checks) · D18 (`NODE_VERSION`) · D19 (cache headers, manifest MIME, font preload) · D22 (AI provider spend cap + alerts — 30 minutes, do it first) · D17 (check Netlify billing model) · verify `POLOAI_API_KEY` by signing in once · update `DEPLOY-TODO.md` (§3 ALLOWED_ORIGIN is done; move `VITE_VAPID_PUBLIC_KEY` into the required list).
**Exit:** errors are visible and symbolicated; no feature is silently dead from config; no unbounded AI or Supabase bill; backups exist; you find out about an outage before a user does.
**Effort:** ~1 day. **Cost:** $25/mo Supabase + $0-9/mo Netlify.

### M1 — Free closed pilot, ~20 invited Hebrew users
**Entry criteria (all must be true):** A1 guest-data fix shipped **with a shared-device test** · A3 real password reset received end-to-end from the production domain · A4 first-run CTA lands on real content · A5 guest banner gone · A6 quota trigger dropped and all four save paths handle the error · A7 support mailbox + Settings entry live with a published SLA · A8 age-gate escape hatch shipped · A13 separate health-data and photo consents shipped · A11 restore rehearsed once with a recorded RTO.
**Not required yet:** landing page, custom domain branding, testimonials, lawyer-approved docs, coach features, billing.
**Deliverables of the pilot:** a measured activation baseline (% reaching first completed workout within 48h; % reaching 3+ workouts in week one), a bug list, and 3-5 attributed Hebrew testimonials.
**Cohort discipline:** run 2-3 cohorts (people you know → strangers from a Facebook group), fix between cohorts, and cap the size at your own triage capacity — 20-30 is the honest ceiling for one person. Feedback loop over WhatsApp, not email.
**Effort:** ~3 weeks solo.

### M2 — Public free launch (open signups, strangers)
**Entry criteria:** M1 exit + D1 custom domain and public landing page with named founder identity, price intent and the privacy explainer · D2 OG tags, sitemap, robots · D3/D4 trimmed onboarding landing on a ready first workout · D5/D6 A2HS + notification prompts at the post-first-workout moment · D7 storage persist at boot + visible unsynced chip · D8 six missing analytics emitters + five saved queries + a consent-coverage counter · D16 preview environments isolated from the production database · D23 community moderation tool shipped **or** community disabled · D24 export honestly relabelled · D28 health disclaimer at points of use · D30 accessibility coordinator named · 18+ (or 16+) age policy decided and the Terms' guardian promise removed.
**Distribution:** Hebrew Facebook groups after weeks of genuine participation; a pre-launch waitlist warmed to 100-200; no English launch boards.
**Honest targets to write down now:** D1 25-35%, D7 ~10-15%, D30 4-8%, activation 30-50%. Health & Fitness has the best download-to-paid rate of any category (2.9% at D35) and among the worst retention — judge yourself against that, not hope.
**Effort:** ~3 weeks.

### M3 — First real coach with real clients
**Entry criteria:** M2 exit + B1 coach assignment no longer hits the trainee quota · B2 free-tier seat limit raised with a real seat-full CTA · B3 push verified end-to-end on a real installed phone **and** `reminders-dispatch` scheduled in pg_cron with one real delivery to a closed app · B4 error-vs-empty fixed on all four coach surfaces · B5 coach RLS re-verified against the **live** database with Security Advisor at zero · B7 coach mode reversible and removed from trainee onboarding · C7 code half (coach_terms route + hash + server-derived minor flags) · D11 coach onboarding checklist · D12 phone-number bulk invite.
**Pitch:** Hebrew RTL coach console (no global incumbent has it), real offline logging (My PT Hub markets this as exclusive), 166 classified Hebrew exercises vs BaseCRM's 35, groups + group chat included. **Give 2-5 Israeli coaches free lifetime seats** in exchange for onboarding real clients and a testimonial — one coach with 20 clients delivers 20 activated users with external accountability, which is exactly the week-one-frequency lever everything else depends on.
**Effort:** ~2 weeks.

### M4 — Take money
**Entry criteria — business (the real critical path, start the lead-time items during M1):**
C1 entity registered (עוסק מורשה or company) with the accountant · C9 signed PSP contract with **written** confirmation of tokenized recurring, refunds API, Apple Pay / Google Pay / Bit, and the fee schedule · C15 CPA sign-off on VAT treatment and invoicing · C7 lawyer-approved Hebrew ToS + privacy + coach terms, then `isDraft: false` with real content hashes · C14 PoloAI/Netlify disclosure + executed DPAs · D31/D32 ToS liability and coach-platform clauses drafted by counsel.

**Entry criteria — code:**
C2 automatic קבלה on every payment and renewal · C3 homepage cancellation link + ≤3-business-day cancellation + multi-channel intake with logged timestamps · C4 refund path, **14 days**, fee ≤ lower of 5%/₪100 · C5 disclosure document emailed at checkout with proof of sending · C6 60-to-30-day and promo-rise notices · C8 paywall shrunk to what is enforced (or gates wired and free-user deny tests passing) · C10 dunning, retries, card-updater, grace period · C11 coach seats writable end-to-end (only if selling to coaches) · C12/C16/C17 the three small correctness fixes · C13 AI entitlement decided · C18 sandbox pass with deliberate failure injection.

**Go-live order (do not reorder):** ① `ALLOWED_ORIGIN` set explicitly → ② `BILLING_PROVIDER` + PSP secrets in sandbox → ③ INSERT approved `billing_prices` rows → ④ register the webhook URL and re-verify `verify_jwt=false` **after** deploy (it was deployed wrong once already) → ⑤ full sandbox pass including failure injection → ⑥ `AI_REQUIRES_ENTITLEMENT` decision → ⑦ `isDraft: false` → ⑧ **last of all**, `VITE_BILLING_LIVE=true`.

**Pricing anchor:** Health & Fitness is the only App Store category where annual plans are *gaining* share (68% of subs are annual). Anchor annual, offer monthly, price VAT-inclusive in ILS. Global medians: monthly ~$10, yearly ~$34.80. Israel is mid-tier. If you offer a trial, **7 days minimum, never 3** — long trials convert at 42.5% vs 25.5% for ≤4 days, and 55% of 3-day-trial cancellations happen on day 0. Expect ~2-3% of new users to pay within five weeks: 100 signups ≈ 3 payers.

**Effort:** ~4-8 weeks, dominated by external lead time, not code.

---

## 10. Open questions — who must answer, and why it matters

| Question | Who | Why it matters |
|---|---|---|
| Does the **"מאגר המנוהל בידי יחיד"** carve-out apply? (How many people hold database credentials — do real coaches with access to their clients' records count as בעלי הרשאה?) | **LAWYER** | Determines whether you owe the entire medium-tier package (written security procedure, access logging, training, annual incident review, PPA breach reporting, 24-month reg-16 audit, outsourcing agreements) or almost none of it. **Highest-leverage legal question in this document.** |
| Do calorie/macro targets and AI nutrition guidance brush against reserved dietetic practice under the 2016 regulation of the nutrition profession? | **LAWYER — ask this first** | Genuinely unresolved in all sources. Mitigation regardless: frame nutrition output as general information, not individualized dietetic treatment, and avoid therapeutic diets for medical conditions. |
| Israeli PSP: real fees, and written confirmation of tokenized recurring, refunds API, Apple Pay / Google Pay / Bit support | **OWNER** | **Every one of these claims is unverified** — no Israeli PSP publishes fees, and "no subscription object exists, build the scheduler yourself" is an assumption. Get it in writing before designing the billing architecture. |
| Has Israel enacted a foreign-supplier VAT registration regime for non-resident B2C providers? | **CPA** | Sources directly conflict. Changes the merchant-of-record calculus for Israeli customers. |
| Does סעיף 30(א)(5) zero-rating apply to genuine foreign-resident customers, and does it fail when routed through an MoR? | **CPA — written opinion** | The difference between 0% and 18% on any future international tier. Do not route Israeli money through an MoR before this. |
| Does the EEA-transfer regulation (תשפ"ג-2023) reach the Supabase instance if a single EEA user signs up? | **LAWYER** | Direct per-subject sanctions; since 1 Jan 2025 it reaches Israeli data co-located with EEA-origin data. Undercuts the comfortable "GDPR probably doesn't apply". |
| Exact required fields of the טופס גילוי; whether the 60-30 day notice reaches month-to-month plans; the current text of the 2010 cancellation regulations; the current s.30A per-message damages ceiling | **LAWYER** | These gate C4/C5/C6 and any promotional push. |
| Is Paddle actually willing to onboard an Israeli seller? | **OWNER — apply, don't assume** | Israel is only *absent* from the unsupported list, never affirmatively listed. Only relevant for a future international rail. |
| Which Supabase plan is the project on, and which Netlify billing model is the account on? | **OWNER — today, 30 minutes** | Determines whether backups exist and whether the site can be paused for lack of credits. |
| Do the repo migrations match the live database? | **CODE + OWNER** | Every migration and every restore depends on knowing the answer. |

**Not legal advice.** The privacy, consumer-protection and medical-device items in particular warrant an Israeli attorney before charging money — but note that the corrections in §3 materially *reduce* the scope of what you were told you owe.

---

## 11. One-line summary of the honest position

The product is more finished than the launch is. Roughly **one day of configuration work** makes the live site observable and stops it silently disabling its own features; **three weeks** makes it safe to put in front of twenty real Hebrew users; **the coach product is two genuine bugs away from working** and both are side effects of billing enforcement being left switched on while billing itself was switched off; and **taking money is gated by business registration, an accountant, a payment provider and a lawyer — not by code.**