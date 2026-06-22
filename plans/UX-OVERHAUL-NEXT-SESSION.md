# UX Overhaul — Next-Session Execution Plan (dedup + IA/ordering)

> **תקציר (he):** הסשן הבא ממשיך את לולאת ה-UX. המיקוד שביקש המשתמש: **להסיר כפילויות במסכים** ו**לסדר את ה-IA/ניווט** שיהיה פשוט וברור. למטה תוכנית מאומתת-בקוד (discovery+verify כבר רצו — `wf_e471fe32-fb4`): **7 ממצאים אמיתיים** מתועדפים, כל אחד עם file:line + הפיקס המדויק + הסקיל להשתמש. עבוד בבאטצ'ים, שמור שערים ירוקים, **אל תדחוף (no push)**. השתמש במקסימום סקילים (מיפוי בסעיף 5).
>
> **Branch:** `ux/overhaul-loop-2026-06-21` · **Base:** `master` · **HEAD when written:** `04a03d9` (iter-11) · 45 commits ahead of master · running log in memory `loop-ux-overhaul-2026-06-21`.

---

## 0. START HERE (first 5 minutes)

1. Read memory `loop-ux-overhaul-2026-06-21.md` (full per-iter decision log + the meticulous-codebase lesson) and `plans/UX-OVERHAUL-REVIEW.md` (§4 intentional visual deltas, §5 do-not-touch).
2. Clean the tree FIRST. ~20 files may show as `modified` in `git status` but are **pure LF→CRLF stat-noise (zero content)** — confirm with `git --no-pager diff --shortstat` (empty = noise) then `git checkout -- .`.
3. Confirm green baseline (see §1). Only then start.
4. **Do NOT re-run broad discovery** — this plan IS the verified discovery. Re-run a fresh `Workflow` only after exhausting §3, to find the *next* layer.

## 1. Gates (keep green after every batch)

```bash
npm run typecheck            # expect: 0 errors
npx vitest run               # expect: 1043 tests / 110 files green
# targeted (faster per batch): npx vitest run <dir-touched>
```

Commit convention: conventional-commit messages, **no attribution trailer** (matches all 45 branch commits; project disables it). **Never push** — user reviews locally. Commit each coherent batch.

## 2. Hard guardrails (the meticulous-codebase lesson)

This codebase is meticulous: across 11 iterations ~½ of agent findings were false positives. The 7 below already survived adversarial verification — but still read the real code before each edit, and **respect intentional craft**.

**DO-NOT-RE-FLAG (verified false positives / already done — re-touching = churn):**
- `.fs-accent-rail` (containment-only now, renders nothing). `WorkoutBottomBar` N/M label (intentional bidi reinforcement). **Program vs Templates** are genuinely distinct (curriculum vs user library) — NOT a merge. Nutrition FAB+empty = one modal; library/presets = distinct tab flows. `Button` mint/navy = intentional semantic. RecoveryTab verdict→hero→detail = intentional hierarchy. Settings Premium card works. CompleteStep static coach cards intentionally non-interactive. **Destructive confirmation = intentional graduated friction** (meal=undo, template=inline-confirm, account=ConfirmDialog, reset=warning). Back-nav = one documented pattern (onBack→pop-history→logical-parent-on-cold-entry).
- Already de-duped: Dashboard (ForecastNudge/CommunityCard/TodayFocusLine removed, hero-first, weekly-volume-twice fixed), Nutrition (date-axis-to-top, %-ribbon + circular-h2 removed), MyCoach state-aware hierarchy, "עוד" grouped, recovery word unified, PageHeader SSOT (6 screens), ProgramCard on Dashboard.
- **The 10 findings refuted this round (§4) — do NOT redo them.**

---

## 3. THE WORK — 7 verified findings, 2 batches

> All risk=low except where noted. Each fix is surgical; verify the cited lines before editing (line numbers from HEAD `04a03d9`).

### BATCH A — `BottomNav.tsx` IA + dedup (do as ONE careful batch; it touches nav)

File: `src/components/ui/BottomNav.tsx`. Touches navigation structure → read the whole file's tab/sheet model first, run the 8 BottomNav tests after (`npx vitest run src/components/ui` or wherever BottomNav.test lives).

- **A1 (#4, dup, conf .95, skill: baseline-ui) — extract duplicated sheet subtitles.** `/program` subtitle `'תוכנית מובנית · 12 שבועות'` is defined identically at **L413 and L444**; `/templates` `'אימונים שיצרת לשימוש חוזר'` at **L419 + L450**; `/community` `'שיתוף ומעקב עם מתאמנים'` at **L430 + L480**. Hoist three module-level consts (`PROGRAM_SUBTITLE`, `TEMPLATES_SUBTITLE`, `COMMUNITY_SUBTITLE`) after imports, reference in all 6 sites. Pure DRY, zero visual change.
- **A7 (#7, ordering-ia, conf .82, risk MED, skill: baseline-ui) — unify עוד-sheet section order across roles.** Trainee orders sections `האימון שלי → מאמן וקהילה → חשבון` (L437-485); Coach reorders to `האימון שלי → קהילה → חשבון` (L399-435), moving + relabeling the middle group. Switching roles shifts the same items. Fix: keep the SAME 3-section order for both; in coach view relabel the middle kicker to `מאמן וקהילה` and place `/community` (and `/me` if kept, see A1-coach below) there. **Judgment:** verify this doesn't drop a coach-only item; keep it minimal.
- **A1-coach (#1, ordering-ia, conf .82, risk low, impact HIGH, skill: baseline-ui) — coach personal-training (`/me`) parity.** `/me` (renders Dashboard, no CoachGuard, AppRouter L351-358) sits in `COACH_MORE_PATHS` (L98) so coaches reach their own workouts via עוד→dig, while trainees get `/workout` as a main tab. **JUDGMENT CALL — verify first:** a coach's primary job IS coaching, so a *secondary* placement of their personal workout may be correct. Only promote if the coach-trains-self flow is actually frequent. If promoting: safest = add `/me` as a conditional 5th icon-only tab in `COACH_MAIN_TABS` (label `האימונים שלי`, Dumbbell) — no reflow, sheet keeps it harmlessly. Do NOT replace `/coach` home.

### BATCH B — screen-level dedup (independent, low-risk; can be one commit or split)

- **B2 (#2, dup, conf .98, skill: impeccable) — extract `RatingSelector` in MyCoach CheckInForm.** `src/pages/MyCoach.tsx` **L824-846 (mood)** and **L849-871 (energy)** are verbatim-identical 5-button selectors (same inline styles, aria, handlers; only var + label differ). Extract a `RatingSelector({ label, value, onChange })` local component (keep `min 44px`, `active:scale-[0.98]`, `focus-visible:ring`, `aria-pressed`, `aria-label=\`${label} ${n} מתוך 5\``, `role="group"`), replace both blocks. Pure DRY.
- **B3 (#3, dup, conf .95, skill: none) — PreWorkoutScreen exercise count shown twice.** `src/components/workout/states/PreWorkoutScreen.tsx`: the stat grid shows `תרגילים` count prominently (~L347-358); the `אימון אחרון` caption (~L478-479) repeats it via `pluralizeHe(lastWorkoutLabel.exercises, …)`. Drop the count from the caption, keep only the time context (`אימון אחרון {timeLabel}`). Remove now-unused `pluralizeHe`/`HE_NOUNS.exercise` import if orphaned by the change.
- **B5 (#5, dup/a11y, conf .92, skill: israeli-accessibility-compliance) — TodaysWorkoutCard double-announce.** `src/components/dashboard/TodaysWorkoutCard.tsx`: Card has `aria-label='האימון של היום'` (L32) AND a visible `<h2>` with the same text (L45) → SR reads it twice. Remove the redundant `aria-label` from the Card; keep `role="region"` (the child h2 names the region). Verify Card forwards `role` (it's a `<div>`).
- **B6 (#6, dup, conf .92, skill: none) — MealEntryCard calories twice.** `src/pages/nutrition/components/MealLog.tsx`: calories shown as the 36px hero (L99 + `KCAL` eyebrow) AND again in the mono footer macro row (Flame + calories, L132-135). Drop the Flame+calories span from the footer so it reads `P · C · F · Fb` (the hero already owns the calorie number). Keep the footer's tabular/dir handling intact. *(Note: this file was read but not edited in iter-11; the `active:scale` work was elsewhere.)*

**Suggested commits:** `refactor(nav): dedup BottomNav subtitles + unify role section order` (A1+A7[+A1-coach]); `refactor(ui): remove on-screen duplications across coach/workout/dashboard/nutrition` (B2,B3,B5,B6) — or split B per file if cleaner.

---

## 4. The 10 refuted findings — DO NOT re-flag

Verifier rejected these as intentional/non-issues: workout RPE pill vs previous-set badge (distinct sources), WorkoutSummary "3 repeat/save entry points" (it's a buildTemplatePayload code-dup refactor, not a UX dup — and even that is borderline), PreWorkout "templates buried below coach/program" (cards don't render as empty slots), Program prescription "scrolls out" (it's in the PINNED non-scrolling card), RecoveryTab "redundant headers" (intentional ChapterBreak+SectionCard hierarchy), CheckInForm field order (weight-first is correct), MyCoach connectSection "rendered twice" (defined once, conditionally placed), CheckInStatusLead vs CheckInForm (read-only summary ≠ the form), appPathMeta 'templates' accent (fully implemented), Settings jump-nav lacks icons (different nav context by design).

---

## 5. SKILLS TO USE — maximal, by work-type (explicit ask)

Invoke via the Skill tool BEFORE doing the work manually. Map:

| When you are… | Use skill |
|---|---|
| Removing duplication / improving hierarchy / "make it cleaner" (the core of this round) | **impeccable** (`distill` to remove redundancy hero-first; `critique` for a scored audit; `polish` for a finish pass) |
| A fast spacing/hierarchy/typography deslop on a screen | **baseline-ui** |
| A designer's-eye QA pass after a batch (catch inconsistency/slop) | **design-review** |
| Editing ANY visible Hebrew copy (labels, subtitles, empty states, aria) | **hebrew-content-writer** |
| Any RTL/bidi/direction/logical-property layout work | **hebrew-rtl-best-practices** |
| Any a11y work (aria, focus, SR, contrast) — e.g. B5 | **israeli-accessibility-compliance** |
| Visual QA in a real browser, **both modes + RTL** (see §6) | **/browse** (gstack headless) — NEVER the chrome MCP tools |
| Orchestrating a fresh discovery→verify→ship at scale (after §3) | **Workflow** tool (verify-first; see the two scripts already saved under `…/workflows/scripts/ux-*.js`) |
| Any "how does X work / where is X" codebase question | **graphify** (`graphify query "…"`) before grepping |
| Lint/a11y/bundle/arch scan before committing React | **react-doctor** |

Per project CLAUDE.md these hebrew-* + israeli-* skills are **mandatory** when their domain comes up. Lean on impeccable `distill` — it is the exact framework for this mandate (1 hero, remove redundancy, order most-important-first).

## 6. Visual QA still pending (from iter-10, not auto-verifiable)

Use **/browse** to check both light (Fresh Steel) + dark (Obsidian) + RTL for the iter-10 commits that changed layout: `bf37874` (Progress masthead 72→26 + sticky/tabbar), `5b1ee63` (ProgramCard 3 states), `b98a61d` (PreWorkout caption), `8900e2a` (MyCoach check-in lead). If any looks wrong: `git revert <hash>`. Also eyeball the iter-11 `active:scale` press feedback (`d73f095`) and the B-batch dedups once shipped.

## 7. Execution recipe (per batch)

1. Read the cited file(s) — confirm the issue is still there at those lines.
2. (Optional) invoke the mapped skill for guidance.
3. Make the surgical edit(s).
4. `npm run typecheck` + targeted `vitest` → green.
5. Commit (conventional message, no attribution, **no push**).
6. Append a one-line entry to memory `loop-ux-overhaul-2026-06-21.md` (iter-12 section) + update `plans/UX-OVERHAUL-REVIEW.md` if a visible delta shipped.
7. After all 7 done + full `vitest run` green → consider a fresh `Workflow` discovery for the next layer (or stop and report).

## 8. Remaining backlog from iter-11 (lower priority, after §3)

- **#8/#17 error-state**: largely MOOT — Progress handles load errors page-level; only verify the **Dashboard compact WorkoutHistory** path doesn't silently show "אין אימונים" on load failure.
- **#12** CoachBriefCard: static SSR `.toLocaleString()` vs animated counter formatter → align (low risk).
- **token-hygiene #18/#22** (invisible): OnboardingFlow radius `22 16 22 16`→`var(--radius-asymmetric)`, font `11px`→`var(--text-label)`. Pure maintainability — only if idle.
- **#26** CommentSheet disabled-button contrast → use `opacity-40`, NOT `--fs-ink` (fails dark).
- **LongPressMenu** focus-visible/aria: component is UNUSED (no imports) — skip unless wired.
