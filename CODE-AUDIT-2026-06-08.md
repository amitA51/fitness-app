# Comprehensive Code Audit — SparkOS Fitness App

> **Date:** 2026-06-08 · **Branch:** master · **Scope:** full `src/` (532 files, ~96K LOC) + services/sync/edge boundaries
> **Method:** multi-agent workflow `comprehensive-code-audit` — 70 agents, 4 phases (Structure → Discovery → adversarial Verify → Synthesis), ~4.2M tokens.
> **Verified against the project's OWN standards** (immutability-critical, <50/<800 line caps, Fresh Steel/Obsidian tokens, dvh, RTL/Hebrew a11y, the graph's known cycles) — not generic advice.

## Health Score: **72 / 100**

> Solid, by-feature engineering with a pure service layer, real design tokens, and an already-audited surface — held back by a **confirmed data-loss cluster in the sync/persistence layer**, five files over the 800-line cap, a type-design family that permits illegal states, ~2,000 lines of dead code, and test thresholds set at ~25% against the project's own 80% bar.

### Run stats
| Metric | Value |
|---|---|
| Discovery agents (responded) | 21 / 21 |
| Raw findings | 198 |
| Adversarially verified (CRITICAL/HIGH) | 44 checked · **43 confirmed** · 1 rejected |
| By severity | 3 CRITICAL · 66 HIGH · 100 MEDIUM · 29 LOW |
| HIGH/CRITICAL beyond verify cap (unverified) | 25 |

---

## Executive Summary

This is a **mature, heavily-audited** Hebrew RTL fitness PWA. The adversarial verifier rejected **none** of the findings outright but **down-adjusted** most of the scary-sounding security claims (IDOR writes are backstopped by working RLS; the Vite CVE is moderate + dev-only; `verify_jwt=true` actually exists). After dedup + re-rank the 198 findings collapse to **8 real themes**.

The **dominant, genuinely dangerous** theme is a **persistence / data-loss cluster** in the sync layer, confirmed against source:
- The bulk push path (`batchUpsert` in `supabaseSyncOrchestrator.ts`) **omits `deleted_at` on every entity** → an offline device **resurrects records deleted on another device** (Postgres upsert sets the omitted column to NULL, clearing the tombstone).
- The same function **silently swallows partial-batch failures** — rejected upserts are dropped with no log and no failure count, so a transient 5xx loses ~N records invisibly.
- `App.tsx` **re-writes `user_profile`/`workout_prefs` from a stale onboarding snapshot on every authenticated mount**, wiping Settings edits.
- Three body-stat entities lack `updatedAt` → LWW merge collapses to `createdAt`, so the **later edit is silently discarded** under two-device contention.
- AI-conversation and `user_settings` deletes **never propagate**; `addRecoveryLog` dedup is non-atomic.

Second tier is real but lower-stakes: secrets hygiene (live DeepSeek key in on-disk `.env.local` violates the project's own server-only rule), a "dual source of truth" type family, structural debt (5 files over 800 lines), ~2,000 lines of dead code, token/a11y polish, and test-coverage gaps. Overall: **good code with a dangerous soft spot**, concentrated in sync/persistence and a handful of god-files.

---

## Top Themes

| # | Theme | Severity | Where |
|---|---|---|---|
| 1 | **Persistence/data-loss in sync** (tombstone resurrection, swallowed batch failures, LWW collapse) | 🔴 CRITICAL | `supabaseSyncOrchestrator.ts`, `supabaseSync.ts`, `bodyStatsService.ts`, `cloudMerge.ts` |
| 2 | **Stale-snapshot overwrites destroy user edits** (profile hydration, rating re-save, schedule stale closure) | 🟠 HIGH | `App.tsx`, `WorkoutSummary.tsx`, `ScheduleCalendar.tsx`, `_shared.tsx` |
| 3 | **Dual sources of truth the type system can't enforce** (isCompleted vs completedAt, status vs endTime, muscle, Exercise god-object) | 🟠 HIGH | `types/index.ts`, `analyticsService.ts`, `insightsAggregator.ts`, `prService.ts` |
| 4 | **Files over the 800-line cap + workout/ bucket sprawl** | 🟡 MEDIUM | `workoutReducer.ts`, `WarmupCooldownFlow.tsx`, `App.tsx`, `analyticsService.ts`, `supabaseSync.ts` |
| 5 | **~2,000+ lines of dead code** | 🟡 MEDIUM | `PlanEditorModal`, `PRCelebration`, `useSwipeGesture`, `useViewTransition`, `label.tsx`, orphaned analytics exports |
| 6 | **Secrets hygiene & server-only AI-key contract** | 🟡 MEDIUM | `.env.local`, `temp_debug.txt` |
| 7 | **Design-token & a11y polish** (hardcoded hex on dark, focus traps, nested dialog, RTL physical props) | 🟡 MEDIUM | `PreWorkoutScreen`, `WorkoutSummary`, `RootErrorBoundary`, `WorkoutGoalSelector`, `WorkoutDetail` |
| 8 | **Test coverage ~25% vs 80% target; auth/sync/entitlement/E2E untested** | 🟡 MEDIUM | `vitest.config.ts`, `supabaseAuth.ts`, `supabaseSyncOrchestrator.ts`, `AuthContext.tsx` |

---

## Prioritized Action List

### 🔴 P0 — CRITICAL (fix before multi-device users hit them)

1. **Bulk sync push omits `deleted_at` → deleted records resurrect across devices.** Add `deleted_at: x.deletedAt ?? null` to every `batchUpsert` map fn in `supabaseSyncOrchestrator.ts` (templates, sessions, exercises, body_weight, body_measurements, records, recovery, **nutrition, water**), matching the single-record path. Add a test asserting a tombstoned record isn't un-deleted by a bulk push. — *effort S*
2. **`batchUpsert` silently drops partial-batch failures → invisible push data loss.** Capture rejected results (`supabaseSyncOrchestrator.ts:195-208`): log each via `logger.sync.error`, return `{synced, failed}`, propagate the failure count into `SyncResult`. — *effort S*

### 🟠 P1 — HIGH

3. **`App.tsx:240-267` overwrites profile/prefs from stale onboarding on every auth mount.** Remove or one-shot-guard the effect; make `saveOnboardingData` spread-merge instead of raw-replace. — *S*
4. **Body-stat entities lack `updatedAt` → LWW collapses to `createdAt`, later edit lost.** Add `updatedAt` to `BodyWeightEntry`/`BodyMeasurement`/`RecoveryLog` and stamp it in add/update. — *M*
5. **AI-conversation & `user_settings` deletes never propagate.** Add `deleted_at` to SELECT/upsert + mapper, switch to soft-delete so the existing tombstone branch fires. — *M*
6. **`goalType as string` persists the literal `'undefined'`; four in-place mutations violate the immutability rule.** Use `?? 'general'`; replace `parsed._completed = true` mutations with immutable spreads; add a `DEFAULT_APP_SETTINGS` factory for the five `{} as AppSettings` casts. — *M*
7. **Stale-closure correctness bugs.** `WorkoutSummary` rating effect dep `session` → `session.id`; `ScheduleCalendar`/`TemplatePicker` need `[clientId, fromDate, toDate]` deps; `AssignBox` shared busy flag → split; `EditSessionSheet` UTC-midnight drops Israeli sessions a day back. — *M*
8. **Community `create_post`/`create_comment` RPCs missing → feature broken AND rate-limit inoperative.** Add a migration defining both as `SECURITY DEFINER` with `auth.uid()` guard + length validation + per-user rate window. *(Verify against live schema first — see blind spots.)* — *M*
9. **Unhandled rejections & silent catches** across startup/queue/data surfaces. Add `.catch(logger.sync.error)` to `offlineQueue.ts:593` + wrap the interval body; wrap `deleteMealEntry`; give `PreWorkoutScreen` loadData an error state; surface AI failures as typed results. — *M*
10. **Dual-flag / god-object type design permits illegal states.** Route completion through `isSetCompleted()`; collapse 3 PR-detection impls to `prService`; make `WorkoutSession` a discriminated union; unify `targetMuscle`/`muscleGroup`; migrate 16 deprecated-`Exercise` imports. — *L*
11. **Live DeepSeek key in `.env.local` violates server-only contract.** Rotate it, remove from `.env` (Supabase Secrets only), rotate anon key as defense-in-depth, delete `temp_debug.txt`, add a gitleaks pre-commit hook. — *S*

### 🟡 P2 — MEDIUM

12. `addRecoveryLog` dedup non-atomic; destructive `replace*FromCloud` functions still exported. — *M*
13. Five files over the 800-line cap; `COMPLETE_SET` case >150 lines — mechanical slice splits. — *L*
14. ~2,000 lines of confirmed dead code — delete (recoverable from git; *verify lazy/dynamic refs first*). — *M*
15. Design-token violations: hardcoded `#FFFFFF`/`#16292d` on dark, `--fs-primary` on accent fill (fails AA in dark). — *M*
16. A11y: missing focus traps, nested `role=dialog`, English aria-label, RTL physical properties. — *M*
17. Redundant IndexedDB reads & unstable callbacks on workout entry / feed. — *M*
18. Analytics correctness: ACWR baseline off-by-one, future-dated week leak, total-vs-per-set reps. — *M*
19. UTC date-keying mis-keys Israeli midnight entries; two competing date modules → consolidate on `datetime.ts`. — *M*
20. Test coverage ratchet + minimal Playwright E2E for the 3 highest-risk flows. — *L*
21. Defense-in-depth: app-layer ownership filters on coach writes; cached-role TTL; enforce or drop `scopes.write`. — *M*

### 🔵 P3 — LOW

22. Import cycles / barrel coupling / god-helper fan-out / stale docs (`OpenRouter`→`DeepSeek` comments, AccessibilityStatement TODOs, `console.log`→`logger` in `webVitals.ts`). — *M*

---

## Quick Wins (effort S, high value)

- [ ] Add `deleted_at` to `batchUpsert` mappers (closes the #1 data-loss bug)
- [ ] Surface rejected `batchUpsert` results (`{synced, failed}` + log)
- [ ] Delete the `App.tsx:240-267` stale-onboarding overwrite; spread-merge `saveOnboardingData`
- [ ] `goalType ... as string` → `?? 'general'`
- [ ] Four `parsed._completed = true` mutations → immutable spreads
- [ ] `ScheduleCalendar` `useAsyncData` deps `[clientId, fromDate, toDate]`
- [ ] `.catch(logger.sync.error)` on `processQueue()` + wrap the interval
- [ ] Rotate DeepSeek key, remove from `.env.local`, delete `temp_debug.txt`, add gitleaks hook
- [ ] `.substr(2,9)` → `.substring(2,11)` in `workoutReducer.ts`
- [ ] Hardcoded `#FFFFFF`/`#16292d` → `var(--color-ink-on-dark)`/`var(--fs-primary)`; `WorkoutSummary` → `var(--color-ink-on-accent)`
- [ ] `useFocusTrap` on `WorkoutGoalSelector`; remove inner `role=dialog` from `PlateCalculatorOverlay`
- [ ] Delete confirmed dead files (brings `analyticsService` under 800 by itself)

---

## Structure Verdict

Top-level organization is **good and by-feature** (`pages/coach` well-colocated; no loose top-level component files; **services stay pure — no React imported into any service**). Two real structural problems:

1. **Five files breach the 800-line hard cap:** `workoutReducer.ts` (1065), `WarmupCooldownFlow.tsx` (989), `App.tsx` (974), `analyticsService.ts` (879), `supabaseSync.ts` (866). Each has a clean mechanical split already implied internally (six reducer slices; two flow steps; route-tree vs shell; analytics sub-domains; realtime vs CRUD).
2. **`src/components/workout/` subtree uses an ad-hoc overlapping bucket scheme** (`components/`, `core/`, `active/`, `overlays/`, `states/`, `history/`, `common/`, `hooks/` + a confusing 4-deep `components/workout/components/ui/` that re-invents the global kit). **Two homes for "overlays"**, and **triplicate `formatDuration` helpers with conflicting seconds-vs-milliseconds contracts** exported through a barrel — a silent 1000× footgun.

Five import cycles around `supabaseSync` are confirmed but **currently harmless** (ESM live bindings); they block tree-shaking and create init-order fragility. The barrel re-exports amplify coupling and hide the true graph.

---

## ⚠️ Blind Spots (completeness critic — what this audit did NOT cover)

Surface the next round here before trusting the report as exhaustive:

- **Edge functions never audited** — `supabase/functions/ai-chat` (440 LOC: CORS allow-list, JWT verify, Deno-KV rate limiter fail-open/closed, 4000-char validation), `coach-invite-accept`, `coach-push-send` (these hold `service_role` keys). The real server-side trust boundary was not opened.
- **CSV/ICS export injection** — `exportService.ts` writes user-controlled notes/titles/meal names into CSV (no `=`/`+`/`-`/`@` formula-injection escaping) and ICS (no line-folding/escaping). **Entirely unexamined.**
- **`nutrition_logs` + `water_logs` sit in the SAME `batchUpsert`-omits-`deleted_at` bug** (lines 318, 363) — the P0 fix must include them; their `updatedAt`/LWW class wasn't checked either.
- **Service-worker / PWA layer** — `push-sw.js`, the workbox `vite.config.ts` block, `registerType:'prompt'` update flow (don't regress the prompt-mode SW per project memory).
- **Capacitor / native shell** — `capacitor.config.ts`, native plugins (Haptics/Preferences) untouched.
- **Migrations as a body of work** — 31 files; RLS spot-checked via summaries, not read end-to-end. The "community feature is broken" claim rests on absence-of-migration **inference** — verify against the live DB before acting.
- **Achievement/streak integrity, notification/web-push flow, concurrency/race coverage** — thin.

### False-positive caution
- **Dead-code line counts may be over-stated** — `knip`/`ts-prune` flag `lazy()`/dynamic-import/barrel-only refs as unused. Confirm against runtime refs before deleting (esp. `PRCelebration`, `label.tsx`, `Premium*`/`Aurora`).
- **The "dual source of truth" family is latent, not active** — kept consistent by reducer discipline today; HIGH may slightly over-state vs the confirmed sync data-loss.
- **Perf items are heuristic, unprofiled** — `getWorkoutSessions()` N-reads and CommunityFeed re-render are plausible but unmeasured.

---

## Lenses / agents used

**Structure:** `architect` ×2, `code-explorer`.
**App-wide dimensions:** `typescript-reviewer`, `security-reviewer`, `refactor-cleaner` (dead-code), `silent-failure-hunter`, `performance-optimizer`, `code-reviewer` (immutability/style), `type-design-analyzer`, `comment-analyzer`, test-coverage, `a11y-architect` (tokens/RTL/a11y).
**Per-area deep reviews (11):** data-layer · sync · AI · coach-services · analytics-math · workout-core · ui/design-system · pages/app-shell · coach-pages · community/billing · hooks/utils.
**Verify:** `Explore` adversarial verifiers (one skeptic per CRITICAL/HIGH, default-to-reject). **Synthesis + completeness critic.**

> Full raw findings (198) preserved in the workflow output JSON under the session's tasks dir.
