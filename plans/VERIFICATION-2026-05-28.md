# Plan Verification — verified against actual code

> Status: round 2 in progress — full P0–P3 verification via 9 parallel agents + fixes.


> **Date:** 2026-05-28
> **Purpose:** Independently verify the claims in `MASTER-ARCHITECTURE-REVIEW.md` against the real
> codebase (the original review agent may have hallucinated). Trust nothing; check everything.
> **Scope this pass:** P0 (1–5) and P1 (6–10) only.

## Verdict per finding

| # | Finding | Verified status |
|---|---------|-----------------|
| P0.1 | API key in client bundle | ✅ **Already fixed** — no `VITE_*_API_KEY` anywhere in `src/`. |
| P0.2 | Reducer routing bugs | ✅ **Already fixed & correct** — `TOGGLE_PAUSE ∈ TIMER_ACTIONS`; all 5 modal cases ∈ `MODAL_ACTIONS`; no action falls through to the all-reducers fallback. |
| P0.3 | `recoveryService.ts` dead code | ✅ **Already deleted.** |
| P0.4 | CSS duplication (global.css + components.css) | ⚠️ **Real, NOT fixed.** Both files imported in `main.tsx`; `.card/.btn-primary/.glass/.badge/.input` defined in both. `@keyframes shimmer/spin` only in global.css (claim said both — minor inaccuracy). Consolidation is risky (last-import-wins override semantics) → needs a focused pass with visual regression checks. |
| P0.5 | Model mismatch client/edge | ✅ **Already fixed** — `openai/gpt-oss-120b:free` is in the edge `ALLOWED_MODELS`. |
| P1.6 | God components | ✅ **Real.** Line counts accurate (Progress 3258, Settings 2000, Login 1691, ActiveWorkoutNew 1400, supabaseSync 1311, workoutDb 1145, analyticsService 856, WorkoutSummary 720). Large refactor — not auto-applied. |
| P1.7 | Type weakness | ⚠️ **Partly real + one hallucination.** `Exercise` has **26 optional fields** ✅; 5 overlapping exercise types exist ✅. **❌ HALLUCINATION:** "`Screen` type contains `passwords`, `investments`, `logos`" — those values do **not** exist anywhere in the codebase. `Screen` contains only fitness routes. |
| P1.8 | Duplicate utils | ⚠️ **Real; plan's suggested fix was unsafe.** `todayStr`×5, `generateId`×4. The naïve "extract shared `todayStr`" would have introduced a **timezone bug**: services used UTC (`toISOString`) while `WorkoutStreak` used local date. **FIXED** (see below). `generateId` differs per file (prefix + random length) — left as-is for now (cosmetic dedup, no bug). |
| P1.9 | Test coverage ~12% | ✅ **Real.** Large effort — not in this pass. |
| P1.10 | z-index conflict (zIndex.ts vs tokens.css) | ℹ️ **Nearly a non-issue.** CSS `--z-*` tokens have **0 usages** anywhere. The live system is `zIndex.ts` (JS) only. No runtime conflict; the CSS tokens are just dead. |

## Fix applied this pass

**P1.8 / latent timezone bug — `todayStr` consolidated to a single LOCAL-date helper.**

- Added `todayStr()` to `src/utils/dateUtils.ts` using local date components
  (`getFullYear/getMonth/getDate` + `pad2`), not UTC.
- Replaced the duplicated UTC versions in: `waterService.ts`, `nutritionService.ts`,
  `exportService.ts`, `aiDashboardService.ts`.
- **Why it matters:** for users ahead of UTC (Israel, UTC+2/+3), the old UTC version mis-keyed
  early-morning local entries (00:00–03:00) to the previous calendar day. Water/nutrition/body-weight
  logs are date-keyed, so this was a real correctness bug, not just duplication.
- **Migration note:** date keys for new entries are now local. Any historical entries written during
  the old UTC-boundary window keep their old key; impact is limited to that narrow window.
- Verified: `tsc --noEmit` passes with 0 errors; all `todayStr` call sites resolve to the import.

## Not changed (deliberately) — need a focused pass / decision

- **P0.4 CSS consolidation** — high visual-regression risk; do with the app running.
- **P1.6 god-component splits** — large multi-file refactor.
- **P1.9 test coverage** — large effort.
- **P1.8 `generateId` dedup** — safe but cosmetic; behaviors differ per call site.
- **P1.10 dead CSS `--z-*` tokens** — harmless; remove only as housekeeping.
