# BILLING / PREMIUM — STATE AUDIT (read-only)

**Date:** 2026-08-28 · **Method:** static read of `src/`, `supabase/`, `e2e/`, `scripts/`, env files.
**Nothing was modified.** No dev server, no build, no Playwright, no git, no DB connection.

---

## 0. One-paragraph answer

A **complete, well-built, provider-agnostic billing stack exists and is switched off on purpose.**
The schema, the webhook receiver, a real Paddle adapter, a server-side feature gate and a SQL test
suite are all present and coherent. What does *not* exist is any **enforcement of the six features
the paywall advertises** — exactly one of them (`ai_coach`) has a server-side gate, that gate is
behind an unset env flag, and the feature it guards has **zero UI call sites** after the AI deletion
pass. A client **cannot forge premium status** (there is no client write path to `entitlements`
anywhere), but that safety is currently meaningless because almost nothing is gated. Two live
promises are now factually false ("up to 3 templates" — trigger dropped; "AI coach coming soon" —
surface deleted), and the paywall's only working button calls an RPC (`join_waitlist`) that **has no
migration in this repo at all**.

The prior audit's conclusion ("nothing premium is gated") is correct about the *gate components* and
wrong about the *stack*. Both halves matter.

---

## 1. Surface classification

### LIVE — a real non-admin user reaches this today

| Surface | Evidence | Reality |
|---|---|---|
| `/paywall` route | `src/AppRouter.tsx:644-652` | **No guard.** Sits inside `AppShell`, so it needs auth-or-guest + onboarding + age gate + consent (`src/AppRouter.tsx:311-325`) — but **no** `AdminGuard`, no entitlement check. A **guest** reaches it. |
| Settings → "פרימיום / הצטרפו לרשימת ההמתנה" | `src/pages/Settings.tsx:162-200` | The only discoverable entry point. Accent-bordered card, always rendered, for every user. |
| `PaywallScreen` | `src/pages/billing/PaywallScreen.tsx:255-…` | Renders the 6-row comparison table, the "יושק בקרוב" note, and the waitlist CTA. |
| `EntitlementProvider` | `src/App.tsx:32-35` | Mounted app-wide. Fires `current_entitlement` on every authenticated mount. Always resolves FREE (no rows exist). |
| `entitlementService` | `src/services/billing/entitlementService.ts:46-66, 83-93` | Live code path, fail-open to FREE. |
| `waitlistService` | `src/services/billing/waitlistService.ts:29-33, 60-70` | Called on paywall mount and on CTA click. **See finding F2 — the RPC has no migration.** |
| `trackFunnel('paywall_viewed')` | `src/pages/billing/PaywallScreen.tsx:271` | Fires on every paywall view. |
| `PurchasePanel` | `src/pages/billing/components/PurchasePanel.tsx:39, 51-56, 108` | Mounted by the paywall, but returns `null` because `VITE_BILLING_LIVE !== 'true'`. **Live-but-inert by design**, and it correctly reports `available=false` so the host swaps to waitlist copy. |

### WIRED-BUT-UNREACHABLE — built and correct, nothing routes to it

| Surface | Evidence | Why unreachable |
|---|---|---|
| `checkoutService.createCheckout` / `listActivePrices` / `formatPrice` | `src/services/billing/checkoutService.ts:73-89, 96-100, 105-131` | Only consumer is `PurchasePanel`, which bails at `:51` before ever calling. |
| `billing-checkout` edge function | `supabase/functions/billing-checkout/index.ts:44-153` | Nothing in the client can invoke it (button never renders); and it returns `503 billing_not_configured` at `:49-53` while `BILLING_PROVIDER` is unset. |
| `billing-webhook` edge function | `supabase/functions/billing-webhook/index.ts:40-208` | No provider is registered with any PSP, so no request ever arrives. Also 503s at `:44-48`. |
| Paddle adapter (**not a stub**) | `supabase/functions/_shared/billingAdapter.ts:106-208` | Real implementation: raw-body HMAC, `ts` replay window of 300s (`:158-161`), timing-safe compare (`:73-78`), `custom_data` user attribution. Unreachable because `getAdapter()` returns `null` when `BILLING_PROVIDER` is empty (`:227-231`). |
| `has_feature_access()` / `has_paid_entitlement()` | `supabase/migrations/20260726100000_billing_core.sql:274-308` | Granted to `authenticated`. **Exactly one caller in the whole tree:** `supabase/functions/ai-chat/index.ts:215` — itself inert (see §2). |
| `PlanGate` | `src/contexts/EntitlementContext.tsx:88-101` | Only consumer is `PremiumLock`, which itself has no consumer. |
| `useTemplates` → `navigate('/paywall')` | `src/pages/templates/hooks/useTemplates.ts:101-106` | **Dead branch.** It reacts to `free_template_limit_reached`, raised by a trigger that was dropped in `supabase/migrations/20260824000000_drop_free_template_quota.sql:21-22`. The sibling path at `:186-193` already acknowledges this ("trigger dropped"). |

### DEAD — no consumer at all

| Surface | Evidence |
|---|---|
| `PremiumLock` | `src/components/billing/PremiumLock.tsx` — grep for `PremiumLock` across `src/` returns **only the file itself**. Zero imports. |
| `billing_prices` catalogue | Ships empty on purpose; the only INSERT in the repo is commented out (`20260726100000_billing_core.sql:322-338`). No migration inserts a row. |
| `billing_customers`, `billing_subscriptions`, `billing_checkout_sessions`, `billing_events`, `entitlements` | Write path is service-role/webhook only. With no provider, all five are empty. No client code references `billing_customers` / `billing_subscriptions` at all (grep: 0 matches in `src/`). |
| `enforce_free_template_quota()` | Created at `20260726100000_billing_core.sql:320-356`, **dropped** at `20260824000000_drop_free_template_quota.sql:21-22`. |
| `e2e/journeys/paywall-entitlement.spec.ts` | All three tests are `test.fixme` (`:32-36`, `:59-62`, `:71-74`). **Zero assertions execute.** |
| Subscription cancel / manage / portal | Nothing. Grep for `cancelSubscription|manageSubscription|customer_portal|cancel_at_period_end|billing_subscriptions` across `src/` → **0 matches**. See finding F5. |

---

## 2. Is entitlement enforced SERVER-SIDE today?

**The entitlement value cannot be forged. The gates it would feed barely exist.**

**Cannot be forged — verified:**

- `entitlements` has RLS on with a **read-own-row policy only**; there is no client
  INSERT/UPDATE/DELETE policy anywhere (`20260610000100_entitlements.sql:40-48`).
- `billing_subscriptions` likewise: owner-read only, "No client write policy" is explicit
  (`20260726100000_billing_core.sql:110-116`).
- `billing_events` has RLS on and **no policy at all** → no client access
  (`20260610000100_entitlements.sql:47-48`).
- `current_entitlement()` is `SECURITY DEFINER … SET search_path = public` and keys off `auth.uid()`
  server-side (`20260726100000_billing_core.sql:388-413`). The client sends nothing.
- `has_paid_entitlement()` also keys off `auth.uid()` (`:274-288`), and `billing_apply_subscription()`
  is revoked from `anon` and `authenticated` (`:265-268`) — only the service role can move money state.
- The single write path is trigger-projected from `billing_subscriptions`
  (`:135-190`), so there is one derived truth.

So: a browser that sets `isPremium = true` in its own React state unlocks **its own UI and nothing
else**. It cannot make the server agree.

**But the gates:**

- `has_feature_access()` gates all six keys (`:296-306`) and is invoked from **exactly one place** in
  the entire codebase: `supabase/functions/ai-chat/index.ts:215`.
- That call is itself conditional: `AI_REQUIRES_ENTITLEMENT` must equal `'true'`, otherwise
  `checkAiEntitlement()` returns *allow* immediately (`ai-chat/index.ts:193-196`). The flag is not
  set in `.env.example`'s active section (it appears only as a documented instruction at
  `.env.example:83-84`) and is not present in `.env` or `.env.local`.
- No **RLS policy anywhere** references `has_feature_access` or `has_paid_entitlement`. Grep across
  all of `supabase/` returns only the definitions, the ai-chat call, and the SQL test.
- Therefore for the other five advertised features — `advanced_progress`, `unlimited_templates`,
  `progress_photos`, `cloud_sync`, `data_export` — **there is no server-side enforcement at all**,
  and after `20260824000000` there is no client-side one either.

**Honest verdict:** the *architecture* for server-side enforcement is real and correctly built.
The *deployed enforcement* covers one feature, behind an off switch, on an endpoint with no UI.

---

## 3. Is `/paywall` reachable by a normal non-admin user right now?

**Yes.**

- **Route:** `src/AppRouter.tsx:644-652` — wrapped only in `PageErrorBoundary`. Compare `/admin` two
  lines below (`:654-664`), which *is* wrapped in `AdminGuard`.
- **Gate it does sit behind:** `status !== 'unauthenticated'` (so authenticated **or guest**),
  onboarding complete, age gate, consent gate (`src/AppRouter.tsx:293-325`).
- **Link:** `src/pages/Settings.tsx:162-200`, an always-visible accent-bordered card reading
  **פרימיום / הצטרפו לרשימת ההמתנה**.
- **Second (dead) route in:** `src/pages/templates/hooks/useTemplates.ts:104` — never fires, see §1.
- **Deep link:** anyone can type `/paywall`. Also `/paywall?checkout=success` (see F6).

### What it advertises vs what is true

`src/pages/billing/PaywallScreen.tsx:37-79`:

| Row | Claim | True today? |
|---|---|---|
| `advanced_progress` | free "בסיסי" / pro "מלא" | **No.** No gate exists on the Progress page. Free users get the full thing. |
| `cloud_sync` | free "—" / pro "כל המכשירים" | **No.** Cloud sync runs for any authenticated user; no entitlement check exists in the sync path. |
| `unlimited_templates` | free "עד 3" | **No — and this one was true until 2026-08-24.** The enforcing trigger was deliberately dropped (`20260824000000_drop_free_template_quota.sql:21-22`) because it was capping everyone, including coach-authored splits. |
| `data_export` | free "—" / pro "CSV ו-JSON" | **No gate.** |
| `progress_photos` | free "—" / pro "ללא הגבלה" | **No gate.** |
| `ai_coach` | pro "בקרוב" | **Advertises a surface that no longer exists.** `generateAIInsight` is exposed by `src/hooks/fitness/useFitnessInsights.ts:145-157` and has **zero call sites** — all 16 grep hits for `generateAIInsight|aiInsight` are inside that one file. Nothing in the UI reaches `ai-chat`. |

Plus the CTA itself: **the only actionable control on the page is the waitlist button, and it calls
an RPC with no migration.** See F2.

---

## 4. What does `PremiumLock` expose, and why zero call sites?

**Exposes** (`src/components/billing/PremiumLock.tsx:204-215`): `{ featureKey, children, compact }`.
It wraps `PlanGate` so gating semantics stay in one place, and adds a class ErrorBoundary
(`:52-72`) that **fails open** — a missing `EntitlementProvider` renders `children` rather than
locking. Two visual modes: a full locked card with a `/paywall` CTA (`:107-190`) and a compact "פרו"
chip (`:88-105`). Both navigate to `/paywall` (`:80-82`).

**Verdict: unfinished, not superseded.** Nothing else in the tree does this job — `PlanGate` is the
lower-level primitive it wraps, and `PlanGate` also has no direct consumers. The most likely history
is that the generic gate was built first and never applied, because applying it would have locked
features off users while nothing was purchasable. It is correct, complete, RTL-clean code sitting at
zero adoption.

---

## 5. Is a payment PROVIDER configured?

**No provider is configured. The adapter is not a stub.**

- `_shared/billingAdapter.ts:106-208` is a full **Paddle Billing** implementation.
- `ADAPTERS` contains exactly one key, `paddle` (`:219-221`).
- `getAdapter()` returns `null` unless `BILLING_PROVIDER` is set (`:227-231`); both edge functions
  treat `null` as `billing_not_configured` and 503 (`billing-checkout/index.ts:49-53`,
  `billing-webhook/index.ts:44-48`).

**Keys expected** (`.env.example:64-90`) — note the split:

| Where | Keys |
|---|---|
| Client env (`VITE_`) | `VITE_BILLING_LIVE` — documented default `false` at `.env.example:86` |
| Supabase **secrets**, not client env | `BILLING_PROVIDER`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_BASE`, `AI_REQUIRES_ENTITLEMENT` (`.env.example:73-84`) |
| Also required | `ALLOWED_ORIGIN` (`.env.example:20`) — drives both CORS and the checkout redirect allow-list (`billingAdapter.ts:234-266`) |

**Is there an `.env` in the repo?** Yes — two, and both are gitignored (`.gitignore:12-15`:
`.env`, `.env.*`, `!.env.example`):

- `.env` — **placeholder only**, its first line says so. No billing keys.
- `.env.local` — real Supabase URL + anon key, plus one server-side AI provider key. **No billing
  keys, no `VITE_BILLING_LIVE`, no `AI_REQUIRES_ENTITLEMENT`.** (Values not reproduced here.)

**Could not verify:** whether the Supabase project actually has `BILLING_PROVIDER` /
`PADDLE_*` / `AI_REQUIRES_ENTITLEMENT` set as function secrets, and whether `billing-checkout` /
`billing-webhook` / `ai-chat` are deployed at all. That requires the Supabase dashboard or CLI and
is outside a repo read. What the repo *does* prove is that with the flag absent from every env file
present, a locally-built client shows the waitlist paywall, not a buy button.

---

## 6. What do the billing tests actually assert?

**Two of the three layers are real. The e2e layer is empty. And one SQL suite tests behaviour that
no longer exists.**

| Suite | Count | What it actually asserts |
|---|---|---|
| `src/services/billing/__tests__/entitlementService.test.ts` | 12 | **Object shape + fail-open only.** Mocked `supabase.rpc`; asserts FREE on unconfigured / no user / RPC error / null data / zero rows, plan+status normalization of garbage strings, and a pure grant/deny matrix (`:174-206`). Never touches a database. |
| `src/services/billing/__tests__/billingEnforcement.test.ts` | 7 | **Pure logic.** The `isPremium` period + 24h grace matrix (`:23-58`). Client-side only. |
| `supabase/tests/billing_core_test.sql` | ~20 asserts | **Real enforcement.** Stale/out-of-order webhook rejected (`:63-74`), one row per provider subscription id (`:77-79`), `has_paid_entitlement()`/`has_feature_access()` **deny a free caller and grant a payer** (`:82-91`), `current_entitlement()` expires past grace but not inside it (`:93-108`), cancellation drops to free (`:111-121`), coach-scope must not upgrade the personal plan (`:163-181`), seat multiplication (`:183-186`). Run by `npm run db:test` (`scripts/db-test.mjs:41`). |
| `e2e/journeys/paywall-entitlement.spec.ts` | 3 | **Nothing.** All `test.fixme`. The header also describes a `subscriptions` table that has never existed in this schema (`:12`, `:24`, `:77-81`). |

**Test drift (F4):** `scripts/db-test.mjs:26-36` applies `20260726100000_billing_core.sql` but **not**
`20260824000000_drop_free_template_quota.sql`. So `billing_core_test.sql:124-160` still asserts the
free-template quota trigger — including "the fourth free template was accepted" as a failure — for a
trigger production no longer has. `npm run db:test` is green while proving a behaviour that was
deliberately deleted.

**Zero coverage anywhere for:** `billing-checkout`, `billing-webhook`, the Paddle adapter, HMAC
signature verification, the replay window, `PurchasePanel`, `PremiumLock`, `PlanGate`.

---

## 7. THE DELIVERABLE — smallest honest change to make the premium surface ADMIN-ONLY

**Principle: reuse `app_admins` / `is_app_admin()` / `useIsAppAdmin` / `AdminGuard`. Invent no new
flag. Change no billing logic. Delete no working code. Do not touch prices — the owner has not
decided, and this plan does not decide for him.**

Existing machinery to reuse, verified working:
`supabase/migrations/20260828000000_admin_coach_assignment.sql:27-45` (table + RLS, no write policy),
`src/hooks/useIsAppAdmin.ts:29-46` (fail-closed), `src/AppRouter.tsx:373-378` (`AdminGuard`),
`src/AppRouter.tsx:654-664` (the pattern to copy), `src/__tests__/adminRouteGuard.test.tsx` (the test
pattern to copy).

### Ordered steps

**Step 1 — `src/AppRouter.tsx`** (the whole gate, in one edit)
Wrap the existing `/paywall` route element in `<AdminGuard>`, exactly as `/admin` is at `:654-664`.
Keep `PageErrorBoundary` inside. Non-admins get `<Navigate to="/" replace />`; the loading state
already renders `PageLoader` so a real admin is never bounced on a cold load. Add the same
"hidden operator screen" comment used at `:653`.
*After this step, `/paywall` is admin-only even if every later step is skipped.*

**Step 2 — `src/pages/Settings.tsx`**
The פרימיום card at `:162-200` is the only discoverable entry point. Either **delete it** (smallest,
most honest), or gate it: call `useIsAppAdmin()` and render the `<Link>` only when
`isAdmin === true` — render **nothing** while `loading` (never a flash). Recommended: gate rather
than delete, so the owner keeps his own way in.

**Step 3 — `src/pages/billing/PaywallScreen.tsx`** (stop the false claims)
- Remove or correct the two now-false rows in `FEATURE_ROWS` (`:37-79`): `unlimited_templates`
  "עד 3" (trigger dropped) and `ai_coach` "בקרוב" (surface deleted). For the other four, either drop
  the free-column "—" claims or mark the whole table as an unenforced draft — do not leave "—" next
  to a feature every free user already has.
- Remove the waitlist CTA (`:449-452`) **or** the `joinWaitlist` call behind it, until F2 is
  resolved. As written it shows a Hebrew error to whoever taps it.
- Add one operator-only line at the top: this screen is a draft, nothing is for sale, no price is
  shown. Keep it factual; do not add a price, a tier or a provider name.
- Leave `PurchasePanel` mounted and untouched — it already renders `null` and self-reports
  `available=false`.

**Step 4 — `src/pages/templates/hooks/useTemplates.ts`**
Delete the dead `navigate('/paywall')` at `:104`. Keep `showToast(FREE_TEMPLATE_LIMIT_MESSAGE)` and
the `isFreeTemplateLimitError` guard — the sibling path at `:186-193` is already the correct shape
to match. (Note in passing: `FREE_TEMPLATE_LIMIT_MESSAGE` at `:17` is now a generic connection
message, so the current behaviour is "check your connection" *and* a jump to the paywall.)

**Step 5 — `scripts/db-test.mjs`**
Add `supabase/migrations/20260824000000_drop_free_template_quota.sql` to `SETUP` (`:26-36`), after
`billing_core`. This will make `billing_core_test.sql` fail — which is the point.

**Step 6 — `supabase/tests/billing_core_test.sql`**
Remove the free-template-quota block (`:124-160`) that step 5 just broke. Everything else in the
file tests live behaviour and must stay. Do not weaken any other assertion.

**Step 7 — `e2e/journeys/paywall-entitlement.spec.ts`**
Replace the three `fixme` tests with one that asserts the **new** contract: a non-admin visiting
`/paywall` lands on `/`. Also fix the header's stale `subscriptions` terminology → `entitlements` /
`current_entitlement()`.

**Step 8 — `src/__tests__/paywallRouteGuard.test.tsx`** (new)
Mirror `src/__tests__/adminRouteGuard.test.tsx` for `/paywall`: admin sees the screen, non-admin
redirects, loading renders neither.

**Step 9 — `.env.example`**
No variable change needed — `VITE_BILLING_LIVE=false` at `:86` is already correct. Add one comment
line to the billing block (`:64-86`) recording that `/paywall` is behind `AdminGuard` until launch,
so the go-live checklist includes "un-gate the route".

### What must be REMOVED or hidden so the app stops promising things

1. The Settings פרימיום card — the only thing that tells a user premium exists (step 2).
2. The waitlist CTA — currently a button that errors (step 3).
3. "עד 3 תבניות" — unenforced since 2026-08-24 (step 3).
4. "מאמן AI — בקרוב" — the surface was deleted (step 3).
5. The dead `/paywall` redirect in the templates flow (step 4).

### What must NOT be touched

`EntitlementProvider` (leave mounted — one cheap RPC, keeps the read model warm, harmless);
every billing table and function (already service-role-only); `billingAdapter`; both edge functions
(they answer 503 correctly); `PremiumLock` and `PlanGate` (keep them — they are the gates a real
launch will need); `.env` / `.env.local`; any price, tier or provider decision.

---

## 8. Security / revenue risks if real users arrived tomorrow

**F1 — HIGH (revenue + consumer protection).** The paywall advertises six paid features. **Zero** are
enforced for a free user. If a provider were switched on tomorrow, a payer would receive nothing they
did not already have. In Israel that is a misleading-representation exposure, not just a product bug.
`PaywallScreen.tsx:37-79` vs. one `has_feature_access` call site at `ai-chat/index.ts:215`.

**F2 — HIGH (the live promise that is already broken).** `joinWaitlist()` calls
`supabase.rpc('join_waitlist')` (`waitlistService.ts:29-33`) and `hasJoinedWaitlist()` selects from
`public.waitlist` (`:60-70`). **Neither the table nor the RPC exists in any of the 55 migrations** —
a grep for `waitlist` across all of `supabase/` returns only three comment lines in two edge
functions. So the paywall's only actionable control most likely errors for every user, and the mount
check silently returns `false` (it swallows all errors at `:66-70`). *Unverified:* whether either
object was created by hand in the live project. If it was, it is undocumented and unmigrated, which
is its own problem.

**F3 — MEDIUM/HIGH (provider budget).** `AI_REQUIRES_ENTITLEMENT` is unset, so `checkAiEntitlement()`
returns *allow* without checking anything (`ai-chat/index.ts:193-196`). Today that is contained
because no UI reaches `ai-chat`. The moment an AI surface is re-added, every authenticated user —
free, guest-upgraded, anyone — can spend provider budget up to 100 requests/day
(`ai-chat/index.ts:175`), with the rate limiter as the only defence. Set the flag **before** any AI
UI returns, not after.

**F4 — MEDIUM (false confidence).** `npm run db:test` passes while asserting a trigger that was
deliberately dropped (§6). Anyone reading "the billing suite is green" would conclude the free-tier
quota is enforced. It is not.

**F5 — MEDIUM (a promise with no implementation).** `PurchasePanel.tsx:238-241` tells the buyer
**"אפשר לבטל בכל עת מההגדרות"**. There is no cancel control, no customer portal, and no code path
that reads `cancel_at_period_end` — grep across `src/` returns 0 matches for any of it. This text is
invisible today (the panel renders `null`), but it appears the instant `VITE_BILLING_LIVE=true`, and
it would be false on day one. A cancel surface is a launch blocker, not a follow-up.

**F6 — LOW (analytics integrity).** `PaywallScreen.tsx:281-291` fires
`trackFunnel('checkout_completed')` purely on `?checkout=success` in the URL. Anyone can inflate the
conversion metric by visiting `/paywall?checkout=success`. No money moves; the funnel number becomes
untrustworthy.

**F7 — LOW, non-billing, noted once.** `.env.local` holds a live third-party API key in plaintext.
It is gitignored (`.gitignore:12-15`) so it is not committed, and its comment block correctly
explains why it must never take a `VITE_` prefix. Worth rotating if the machine is shared. No value
is reproduced in this document.

**Positive, worth stating so it is not accidentally "fixed":** `billing-webhook` runs with
`verify_jwt = false` (`supabase/functions/billing-webhook/config.toml:6`) **on purpose** — a PSP
cannot present a Supabase JWT, so the HMAC signature *is* the authentication
(`billingAdapter.ts:172-176`), with a 300-second replay window and a constant-time compare. If
`PADDLE_WEBHOOK_SECRET` is missing it throws `BillingConfigError` → 503, i.e. it fails closed. This
is correct. Do not "harden" it by turning JWT verification on.

---

## 9. What I could NOT verify

- **Deployment state.** Whether `billing-checkout`, `billing-webhook` or `ai-chat` are deployed to
  the Supabase project, and which secrets are set there. Repo read only.
- **Live schema.** Whether `public.waitlist` / `join_waitlist()` exist in the live database despite
  having no migration (F2), and whether all 55 migrations have actually been applied.
- **`billing_prices` contents in the live project.** The repo inserts nothing; a row could have been
  added by hand, which would make `isBillingLive()` depend solely on `VITE_BILLING_LIVE`.
- **Runtime behaviour.** No dev server, no build, no Playwright, no screenshots — other workers are
  active on this tree. Every claim above is a static read of source, migrations, tests and config.
- **Netlify / production env.** `VITE_BILLING_LIVE` in the production build environment. Locally
  it is absent from both env files, which means `false`.
