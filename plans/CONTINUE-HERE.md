# SparkOS Fitness — CONTINUE HERE (hand-off for a fresh session)

> **Updated:** 2026-05-29 by Opus 4.8, mid-way through executing §G (Biome lint debt) of `plans/REMAINING-WORK.md`.
> **Audience:** a fresh agent session. This file is SELF-CONTAINED. Give it to the agent and say "execute this".
> **Companion:** `plans/REMAINING-WORK.md` (the full original plan). This file tracks what's left.

---

## 0. HOW TO WORK (read first — non-negotiable)

1. **Keep the build green after EVERY item.** Run, in order, and they must all pass before you commit:
   - `npx tsc --noEmit` → 0 errors
   - `npm run test:run` → all pass (66 at baseline, incl. `src/test/no-emoji.test.ts`)
   - `npm run build` → succeeds
   If any goes red, fix immediately before moving on. Never batch risky items before verifying.
2. **One logical change per commit.** Conventional-commit messages (`refactor:`, `fix:`, `feat:`, `chore:`).
   Reference the plan section in the body (e.g. "plans/CONTINUE-HERE.md §G").
3. **Use sub-agents** for large/mechanical work (the user explicitly asked for this — "use sub-agents, be precise").
   - Dispatch ONE rule-group per sub-agent. Give each a precise scope, require it to keep the build green,
     run `npx biome format --write` ONLY on the files it touched, run `npx tsc --noEmit`, and **NOT commit**.
   - Run sub-agents **SEQUENTIALLY**, not in parallel: the a11y rules cluster in the SAME component files, so
     two agents editing at once corrupt each other's edits. One agent → you verify → you commit → next agent.
   - YOU (orchestrator) re-run the full triad (tsc + test:run + build) and commit per rule.
4. **No emoji anywhere under `src/`** — `src/test/no-emoji.test.ts` fails on any real emoji. `U+2713`/`U+2717`
   (check/cross) are allowed. Use inline SVG or plain symbols.
5. **Immutability** — never mutate objects/arrays in place; return new copies.
6. **No `console.log`** in production code (hook-enforced). Use `src/utils/logger.ts`.
7. **Encoding (CRITICAL):** many files contain Hebrew. Write files as UTF-8 (no BOM) via the Write/Edit tools.
   Do NOT use PowerShell `Set-Content` on Hebrew files — it produces mojibake that trips the no-emoji test.
8. **Formatting:** run `npx biome format --write <files-you-touched>` on your OWN files only. **NEVER run
   `npm run format` OR `npx biome check --fix ./src`** — both rewrite/reformat ALL of `src/` (incl. CSS), which
   creates massive churn and risks the §F1 CSS cascade. (I tried `biome check --fix` once; it reformatted CSS
   heavily and fixed ZERO lint rules — every remaining rule needs manual/`--unsafe` fixing. Don't repeat that.)
9. **`biome.json` is edit-protected** by a global hook (rejects edits as "weakening config"). See §E3 below.
10. **React Doctor "staged regressions" on commit = pre-existing a11y debt** attributed to the files you touched,
    NOT new regressions you introduced. The commit still SUCCEEDS. The real fix is §G itself. Don't panic on it.
11. **Commit only your work.** Stage specific paths (`git add src/`), never blind `git add -A`. Leave OUT of your
    commits (they are the user's tooling/runtime): `.claude/settings.json`, `.claude/hooks/`, `.codegraph/daemon.pid`.
12. **Working-tree note:** the root `VISION-*.md` files show as DELETED — the **user deleted them on purpose**
    (they're old). Do NOT restore them and do NOT stage them. Leave the deletion alone.

---

## 1. WHAT'S ALREADY DONE (committed on master, all green)

Do NOT redo these. Verify with `git log --oneline -25` if unsure.

### §G Biome lint debt — 3 of ~7 rule-groups cleared (133 errors fixed). Recent commits:
- `dd2c634` **suspicious/noArrayIndexKey (39)** — real item ids where available; justified `biome-ignore` for
  genuinely static/positional lists (skeletons, fixed month grid, step indicators).
- `0f29501` **a11y/noSvgWithoutTitle (45)** — `aria-hidden="true"` on decorative inline SVGs.
- `36bf923` **a11y/useButtonType (49)** — `type="button"` on native buttons (all onClick-driven; none were submits).

### Earlier refactor work (from the original plan):
- **§F2-workoutDb** — `services/workoutDb.ts` split into `templateDb.ts`, `sessionDb.ts`, `bodyWeightDb.ts`,
  `exerciseDb.ts`, `cloudMerge.ts` + `data/builtInWorkoutTemplates.ts`; `workoutDb.ts` is now a barrel.
- **Dead code removed** — `RestTimerOverlay.tsx` + 22 unreferenced files. Recoverable from git if needed.
- **§C1-rest** — volume math migrated to `setVolume`/`exerciseVolume` (`utils/workoutMath.ts`), warmup-aware.
- **§C6** — `computeSessionStats` in `utils/workoutMath.ts` replaces 3 duplicate impls; +6 tests.
- **§C3** — haptics consolidated into `utils/haptics.ts`; `hooks/useHaptics.ts` is a thin wrapper.
- **§C9** — `contexts/DataContext.tsx` slimmed to `{ sessions, loading, error, refreshData }`.
- **§E5** — placeholder URLs removed from `public/robots.txt` + `public/sitemap.xml`.
- **§E7** — `services/dataEvents.ts` + `services/syncEngine.ts` extracted; data layer decoupled from cloud.
- **§F2-UI splits** (pure extraction — VISUAL VERIFY STILL PENDING): `Progress.tsx` 3258->834 (`pages/progress/`),
  `Settings.tsx` 2001->1709, `Login.tsx` 1691->140 (`pages/login/`), `ActiveWorkoutNew.tsx` 1404->1135 (4 hooks).
- **§C4** — `AnnualButton`+`FSButton` folded into `Button.tsx` variants; both deleted. VISUAL VERIFY PENDING.
- **§C8** — distinct per-page accent palette in `contexts/PageThemeContext.tsx`. VISUAL VERIFY PENDING.
- **§F1 (partial)** — duplicate `@keyframes` removed from `global.css`. See §F1 below for what's left.

---

## 2. WHAT REMAINS — do in this order

### §G — finish the Biome lint debt  (RESUME HERE — this is the active task)
After the 3 groups above, **biome reports ~156 errors + 6 warnings remaining**, ALL pre-existing debt (not from
the refactor). Get the live breakdown FIRST, then fix per rule:
```
npx biome check ./src --max-diagnostics=400 2>&1 | grep -oE 'lint/[a-z0-9]+/[a-zA-Z]+ ' | sort | uniq -c | sort -rn
```
As of this hand-off the remaining offenders are:

| count | rule | risk | fix approach |
|---|---|---|---|
| 30 | `a11y/useSemanticElements` | **HIGH (DOM/CSS)** | `role="button"` on a `<div>` → real `<button>`. Changes DOM + default styling. Reset button styles (`appearance:none; background:none; border:0; padding:0; font:inherit; text-align:inherit; cursor:pointer`) or reuse an existing class so it looks IDENTICAL. **Needs visual review** — do this group last and check each in `npm run dev`. If a clean swap is risky for a given node, an alternative the rule accepts is adding the missing semantics — but prefer the real element. |
| 29 | `a11y/noLabelWithoutControl` | MED | Associate each `<label>` with its control: `htmlFor={id}` + matching `id` on the input, OR wrap the control inside the `<label>`. Where a `<label>` is really just styled text (no control), change it to a `<span>`/`<div>`. |
| 18 | `correctness/useExhaustiveDependencies` | **HIGH (behavior)** | Fix each `useEffect`/`useCallback`/`useMemo` dep array. REVIEW EACH — adding a dep can cause loops/extra renders. Where the current deps are intentional (mount-only effect, stable ref), add `// biome-ignore lint/correctness/useExhaustiveDependencies: <true reason>`. Run tests after. |
| 8 | `a11y/useKeyWithClickEvents` | MED | Element with `onClick` needs a keyboard path. If it's becoming a real `<button>` via the §useSemanticElements work, that resolves it — coordinate the two. Otherwise add `onKeyDown` (Enter/Space) + `role` + `tabIndex={0}`. |
| 7 | `a11y/noAutofocus` | LOW | Remove `autoFocus`, or replace with a `useRef`+`useEffect(() => ref.current?.focus(), [])` focus call, or `biome-ignore` if the autofocus is genuinely correct UX (e.g. a search field that opens in a modal). |
| 5 | `style/useTemplate` | LOW | string concat `a + b` → template literal. |
| 5 | `style/noUnusedTemplateLiteral` | LOW | backtick literal with no interpolation → plain quotes. |
| 4 | `complexity/useOptionalChain` | LOW | `a && a.b` → `a?.b`. |
| 3 | `style/useExponentiationOperator` | LOW | `Math.pow(a,b)` → `a ** b`. |
| 3 | `style/noUselessElse` | LOW | drop `else` after a returning `if`. |
| 2 | `suspicious/noGlobalIsNan` | LOW | `isNaN(x)` → `Number.isNaN(x)` (check semantics — only equivalent when x is already a number; coerce if needed). |
| 2 | `suspicious/noAssignInExpressions` | LOW-MED | pull the assignment out of the expression onto its own line. |
| 2 | `style/useDefaultParameterLast` | **MED (signature)** | reorder params so defaulted ones come last. CAUTION: updates ALL call sites — use `codegraph_callers`/grep to find them. |
| 2 | `correctness/noUnusedVariables` | LOW | remove the unused var/import (the user HATES dead code — actually delete it, don't `_`-prefix). |
| 1 | `suspicious/noShorthandPropertyOverrides` | LOW | a shorthand CSS/JS prop overrides a longhand set just above — reorder or remove the dup. |
| 1 | `suspicious/noConfusingVoidType` | LOW | fix the `void` in a union/generic position. |
| 1 | `complexity/noUselessSwitchCase` | LOW | remove the redundant `case` (usually a `default` duplicate). |
| 1 | `a11y/noRedundantRoles` | LOW | drop the `role` that duplicates the element's implicit role. |
| 1 | `a11y/noNoninteractiveTabindex` | LOW | remove `tabIndex` from a non-interactive element (or make it interactive if intended). |
| 2 | `a11y/useFocusableInteractive` | LOW-MED | element with an interactive `role` needs `tabIndex={0}` (or becomes a real button via the §useSemanticElements work). |

**Suggested batching (one sub-agent each, sequential, commit per group):**
1. **All LOW-risk auto-mechanical** in one agent: `useTemplate`, `noUnusedTemplateLiteral`, `useOptionalChain`,
   `useExponentiationOperator`, `noUselessElse`, `noGlobalIsNan`, `noConfusingVoidType`, `noUselessSwitchCase`,
   `noRedundantRoles`, `noNoninteractiveTabindex`, `noShorthandPropertyOverrides`, `noUnusedVariables`,
   `noAssignInExpressions`. (~33 errors. Safe. One commit `fix: clear low-risk biome style/suspicious lints`.)
2. **`useDefaultParameterLast` (2)** — separate, because it changes call sites. Verify callers with codegraph.
3. **`a11y/noAutofocus` (7)** — own commit.
4. **`a11y/noLabelWithoutControl` (29)** — own commit.
5. **`correctness/useExhaustiveDependencies` (18)** — own commit; run `npm run test:run` after; review each.
6. **`a11y/useKeyWithClickEvents` + `useFocusableInteractive` + `useSemanticElements` (40)** — do TOGETHER and
   LAST (they overlap on the same interactive elements). HIGH visual risk → needs `npm run dev` + visual check.
   Consider the `impeccable` skill / `react-doctor` here.

METHOD per group: sub-agent finds its targets via biome, fixes, `biome format --write` on touched files,
`tsc --noEmit` clean, reports files + before/after count, does NOT commit. You re-run tsc+test:run+build, then commit.

### §E3 — flip `noExplicitAny` to error  (NEEDS THE USER; 2 minutes)
The only non-ignored `any` in `src/` is already fixed. All that's left is the config flip, which the
protection hook blocks. Ask the user to run this in the session (with a leading `!`):
```
(Get-Content biome.json) -replace '"noExplicitAny": "warn"','"noExplicitAny": "error"' | Set-Content biome.json -Encoding utf8
```
Then run `npm run lint:check` and fix any new `any` that surfaces (there should be none). Commit `biome.json` if OK.

### §F5 — i18n  (LARGEST, lowest priority, NOT started)
Hebrew strings hardcoded across 100+ components. Do INCREMENTALLY, never all at once.
1. Foundation: a `t()` helper + JSON dictionary (`src/i18n/he.json`), typed keys.
2. Migrate ONE pilot screen end-to-end to establish the pattern (suggest a small page).
3. Then screen-by-screen, separate commits. Hebrew stays the default/only locale unless the user asks for more.
   Watch encoding (rule 7) — verify no string dropped/garbled.

### §F1 — finish CSS consolidation  (HIGH visual risk; needs the app running)
Done: duplicate `@keyframes` removed from `global.css`.
NOT done (intentionally): merging duplicate selectors `.card`, `.btn-primary`, `.glass`, `.badge`, `.input`
between `global.css` and `components.css`. `global.css` scopes them inside `@layer components`/`@layer utilities`
(BELOW Tailwind utilities in the cascade); `components.css` is unlayered. Naively merging into unlayered
`components.css` makes those props override Tailwind utilities on combined elements (`card p-5`,
`btn-primary px-4 py-2`) → visual regressions. A correct merge wraps the merged rules in matching
`@layer components {}`/`@layer utilities {}` blocks. Only with `npm run dev` running and visual diffing. When in doubt, leave it.

### Visual verification  (do once, after the above, with the app running)
§F2-UI / §C4 / §C8 / §F1 / §G-useSemanticElements passed tsc+tests+build but were NOT visually verified.
`npm run dev` and check: Login (choice / sign-in / sign-up / forgot-password, incl. editorial buttons),
Dashboard quick-start buttons, Progress (all tabs + add-weight/measurement/recovery modals), Settings, and the
full active-workout flow (start → log sets → rest timer → superset create/remove → finish → summary → PR
detection → swipe between exercises, incl. RTL). Confirm per-page accent colors look good. Fix regressions.

---

## 3. DECISIONS ALREADY MADE BY THE USER (don't re-ask)
- Production domain: not relevant now → placeholder URLs removed (done).
- Page theme: distinct per-page accents + dark mode stays owned by SettingsContext (done).
- Dead code: remove ALL of it aggressively — the user strongly dislikes dead code (ongoing: keep removing any you find).
- Scope: do EVERYTHING in the plan, no compromises. Use sub-agents and skills.
- Root `VISION-*.md` files: deleted on purpose (old). Don't restore.

## 3a. TOOLING NOTE
A plugin `impeccable` was installed this session (`impeccable:impeccable` skill). It was NOT yet used. If you
want, read its SKILL.md before the §useSemanticElements/a11y group — it may help with the visual-risk a11y work.
`react-doctor` skill is also available for React/a11y triage.

---

## 4. FINAL VERIFICATION (before declaring the whole plan done)
1. `npx tsc --noEmit` — 0 errors.
2. `npm run test:run` — all pass (incl. `no-emoji`).
3. `npm run build` — succeeds.
4. `npm run lint:check` — ideally clean if §G done; at minimum no NEW errors vs the pre-existing baseline.
5. Manual smoke test with the app running (see "Visual verification" above).
