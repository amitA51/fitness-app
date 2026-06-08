# Handoff — Feature Expansion (Wave 1 done, Wave 2 in progress)

> מסמך העברה לסוכן/סשן הבא. כל מה שצריך כדי להמשיך בדיוק מאיפה שעצרנו.
> Master plan: `plans/FEATURE-EXPANSION-PLAN.md` (15 work-streams, 3 waves).
> Date: 2026-06-08. Branch: `wave1-legal-compliance`.

---

## 0. ENVIRONMENT CONSTRAINTS (read first — these bit us repeatedly)

- **Use the PowerShell tool for commands, NOT Bash.** Bash here has no `npm` on PATH (exit 127) and lacks `tail`/`wc`/`head`. PowerShell works: `npm run typecheck`, `npx @biomejs/biome check <paths> | Out-String`.
- `npm run lint:check` is RED from **pre-existing CRLF/format debt** in untouched files (Greeting.tsx, Premium3DCard.tsx, Sparkline, WaterTracker.tsx). Don't try to fix those. To verify YOUR work, run biome scoped to your new files only.
- Biome rules that bit the agents: `noArrayIndexKey` (key lists by id/content, never index); imports must be sorted; `any` is banned. Run `npx @biomejs/biome check --fix <files>` to auto-fix format/import-order.
- git commits via the PowerShell tool sometimes background; verify with `git log --oneline -5` afterward.
- **Design pattern used everywhere: FAIL-SAFE-INERT.** New compliance/feature code sits behind RPC/feature checks that return safe defaults (empty / free plan / no block) when the backend/migration isn't applied — so the app runs normally even before migrations are applied. Keep this pattern.

## 1. GIT STATE

- On branch `wave1-legal-compliance` (off `master` @ `7aacab1`).
- **Wave 1 committed** — but there are **2 duplicate commits** (`ed6911f` + `b98e200`) from a background race. **TODO: squash them into one** (cosmetic). Don't soft-reset past them carelessly — `src/App.tsx` has both Wave-1 and Wave-2 edits entangled.
- **Wave 2 foundations commit** was issued (`feat: Wave 2 foundations ...`) but ran in the background and was **NOT confirmed** — run `git log --oneline -5` first. If missing, commit the Wave-2 foundation files (list in §3).
- Pre-existing unrelated changes in working tree: `graphify-out/*` — do NOT commit these.

## 2. WAVE 1 — DONE (7 streams, typecheck + biome GREEN)

Files created:
- Legal/consent: `src/content/legal/legalDocs.ts` (Hebrew DRAFT — needs lawyer), `legalHash.ts`; `src/pages/legal/{LegalDocPage,TermsPage,PrivacyPage}.tsx`; `src/services/consent/{types,consentService}.ts`; `src/contexts/ConsentContext.tsx`; `src/components/consent/{ConsentCheckboxes,ConsentGate}.tsx`.
- Age: `src/services/ageGate.ts`; `src/contexts/AgeGateContext.tsx`; `src/components/consent/AgeGate.tsx`. DOB lives in a SEPARATE `user_age_verification` table (NOT profiles — coaches select `profiles.*`).
- Cookies/tracking: `src/services/tracking/trackingConsent.ts`; `src/components/consent/CookieConsentBanner.tsx`. `src/main.tsx` refactored so **Sentry + web-vitals init only after analytics opt-in**.
- Capacitor web-side (dep-free): `src/utils/{platform,externalLink}.ts`; `capacitor.config.ts`; `docs/native-capacitor-setup.md`.
- GDPR: `docs/data-processing-record.md` (ROPA). Export/erasure already existed (`exportFullBackup`, `deleteAllUserData` purges cloud-first).
- i18n: `src/contexts/LocaleContext.tsx`; `docs/i18n-adoption.md`.
- a11y + hub: `src/pages/settings/sections/LegalLinksSection.tsx`; enhanced `src/pages/AccessibilityStatement.tsx`.
- Migrations: `supabase/migrations/20260609000000_legal_consent.sql`, `20260609000100_seed_legal_v1.sql`, `20260609000200_age_verification.sql`.
- Edited: `src/App.tsx` (gates + public /legal routes), `src/main.tsx`, `src/pages/Settings.tsx`, `src/pages/AccessibilityStatement.tsx`.
- `scripts/compute-legal-hashes.mjs` exists but HANGS (esbuild) — ignore; the seed uses pgcrypto instead.

App provider tree (in `App.tsx`): `LocaleProvider > SettingsProvider > AuthProvider > EntitlementProvider > AppRouter (+ CookieConsentBanner)`. Authenticated branch: `BrowserRouter > AgeGateProvider > AgeGate > ConsentProvider > ConsentGate > AppShell`. Gates allowlist `/legal/*` + `/accessibility`.

## 3. WAVE 2 — FOUNDATIONS DONE (data/service, typecheck + biome GREEN)

- Advanced profile: `src/services/profile/{types,profileService}.ts` + migration `20260610000000_advanced_profile.sql` (profiles public fields + achievements + `award_achievement` RPC + `avatars` storage bucket). Uses existing `compressImageToWebP`.
- Timezones: `src/utils/datetime.ts` (Intl, DST-safe) + `src/services/datePreferences.ts`.
- Entitlements: `src/services/billing/{types,entitlementService}.ts` + `src/contexts/EntitlementContext.tsx` (`useEntitlement`, `<PlanGate>`) + migration `20260610000100_entitlements.sql`. NO payment SDK yet. Mounted in `App.tsx`.

## 4. WAVE 2 — UI ROUND ✅ DONE (2026-06-08 — built, integrated, typecheck+biome GREEN)

All 3 deliverables complete + wired (routes /community, /u/:userId, /paywall; ProfileEditSection + DateTimeSection mounted in Settings; "קהילה" in BottomNav "עוד" sheet). UNCOMMITTED. Migrations still NOT applied (see §6). Follow-up: comment-thread sheet stubbed (onCommentOpen no-op). See memory `wave2-ui-progress-2026-06-08`. Original (now-historical) instructions below:

3 sub-agents were dispatched but their results were LOST (harness internal error). **Unknown if files were written.** FIRST ACTION next session: check, and re-run any missing:
```
Glob: src/pages/community/**  src/services/community/**  supabase/migrations/20260611000000_community.sql
Glob: src/pages/profile/PublicProfilePage.tsx  src/pages/settings/sections/ProfileEditSection.tsx
Glob: src/pages/billing/PaywallScreen.tsx  src/components/billing/PremiumLock.tsx  src/pages/settings/sections/DateTimeSection.tsx
```
The 3 intended deliverables:
- **Community/forums** (Apple UGC BLOCKER — needs report+block+EULA): migration (posts, post_comments, post_reactions, post_reports, user_blocks, follows + RLS + `toggle_like`/`report_content`/`block_user` RPCs) + `src/services/community/*` + `src/pages/community/CommunityFeed.tsx` + `components/{PostComposer,PostCard}.tsx`. Wire route `/community` in App.tsx + nav.
- **Profile UI**: `src/pages/profile/PublicProfilePage.tsx` (route `/u/:userId`) + `src/pages/settings/sections/ProfileEditSection.tsx` (consumes existing `profileService`). Wire route + mount in Settings after ProfileSection.
- **Paywall + DateTime UI**: `src/pages/billing/PaywallScreen.tsx` (route `/paywall`, CTA "בקרוב") + `src/components/billing/PremiumLock.tsx` (wraps `<PlanGate>`) + `src/pages/settings/sections/DateTimeSection.tsx` (consumes `datePreferences`). Wire route + mount DateTimeSection in Settings after ThemeSection.

**Integration is the ORCHESTRATOR's job** (you) — agents must only create NEW files and NOT edit `App.tsx`/`Settings.tsx`/`main.tsx`.

## 5. WAVE 2 — STILL TODO

- Google Calendar — needs **Google OAuth client id/secret from the owner** (Supabase edge function for token exchange/refresh). The `.ics` export fallback can be built WITHOUT secrets.
- Haptics native — web layer already exists (`src/utils/haptics.ts`); only needs `npm i @capacitor/haptics` + a native branch behind the existing abstraction.
- Wire premium gating onto real features (PREMIUM_FEATURES keys: ai_coach, advanced_progress, progress_photos, cloud_sync, data_export, unlimited_templates). `<PlanGate>` is UX-only — also enforce server-side in `supabase/functions/ai-chat`.
- Actual payment integration (web: Stripe vs Paddle webhook → edge function with `billing_events` idempotency; native: RevenueCat + Apple/Google) — needs SDK installs, accounts, secrets.

## 6. MIGRATIONS NOT YET APPLIED (5, +community if created)

`20260609000000_legal_consent`, `20260609000100_seed_legal_v1`, `20260609000200_age_verification`, `20260610000000_advanced_profile`, `20260610000100_entitlements` (+ `20260611000000_community`).

⚠️ **Applying these ACTIVATES the blocking gates for real users** (ConsentGate prompts everyone to accept; AgeGate prompts everyone for DOB). This is the deliberate "go-live" switch — **QA in DevTools first** (prior sessions applied migrations via the Supabase MCP). Apply via Supabase MCP `apply_migration` or `npx supabase db push`.

## 7. GO-LIVE CHECKLIST

- [ ] Apply the 5(+1) migrations (deliberate — activates gates).
- [ ] DevTools QA: app loads, /legal/* render unauthed, ConsentGate + AgeGate + CookieBanner work, accept flow records consent.
- [ ] Lawyer review of `legalDocs.ts` (terms/privacy/coach_terms) — currently DRAFT.
- [ ] Confirm `deleteAllCloudData` covers `user_consents` + `user_age_verification` (or document a legal-retention exception for consent proof).
- [ ] Squash the duplicate Wave-1 commit.
- [ ] App Store: Privacy Nutrition Labels + Account Deletion + Terms/Privacy URLs (use /legal/*) + UGC moderation (community) before submission.

## 8. MEMORY FILES (for an ECC-style agent)

`feature-expansion-plan-2026-06-08`, `wave1-legal-progress-2026-06-08`, `env-shell-hangs` (PowerShell-not-Bash), `biome-preexisting-debt`. Save a `wave2-progress` memory next session.
