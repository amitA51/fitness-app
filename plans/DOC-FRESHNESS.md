# Doc freshness index — three audits vs. the tree as it stands

**Read this before acting on `plans/MOTION-GESTURE-AUDIT.md`, `plans/FS-PRIMARY-EXPOSURE.md` or
`reports/04-A11Y-RTL-HEBREW.md`.** Those three are snapshots. The code moved. Three workers in the
last two batches acted on claims in them that later work had already closed.

Method: static read of current source. Every verdict carries the `file:line` that settles it. No
build, no dev server, no browser, no test, no git — as instructed. The three audits were **not**
edited; this index is the only deliverable.

---

## Counts

| Verdict | MOTION-GESTURE | FS-PRIMARY | 04-A11Y-RTL | Total |
|---|---:|---:|---:|---:|
| **CLOSED** — was true, now fixed | 12 | 8 | 14 | **34** |
| **STILL-OPEN** — still true today | 7 | 4 (+ ~200 unlanded batch sites) | 8 | **19** |
| **WRONG** — never true, or the cited address holds something else | 5 | 5 | 5 | **15** |
| **MOVED** — true, line drifted | 9 groups | ~15 groups | 10 groups | **34 groups** |
| **UNVERIFIABLE** — needs a browser or a device | 7 | 2 | 4 | **13** |

**The scale in one line:** a third of the checkable claims across these three documents are stale,
and the two headline findings of the motion audit (`SlideToComplete` has no velocity; the exercise
swipe is a no-op) are both false now.

---

# TIER 1 — claims that would cause damage

These send a worker to fix something already fixed, or to break something correct. Act on nothing in
this tier.

## 1.1 `MOTION-GESTURE-AUDIT.md` — its own fix list says "Nothing below has been applied". Seven of eleven items have been applied. **WRONG**

That sentence sits directly under the `# Prioritised fix list` heading and is the single
highest-damage line in the three documents. Applied since:

| Fix-list item | Status | Settled by |
|---|---|---|
| P0 — Velocity + projection on `SlideToComplete` | **CLOSED** | `src/components/workout/components/SlideToComplete.tsx:48`, `:413`, `:443` |
| P0 — Make the snap-back interruptible | **CLOSED** | `src/components/workout/components/SlideToComplete.tsx:137`, `:358`, `:520` |
| P1 — Fix the projection constant in `ModalOverlay` | **CLOSED** | `src/components/ui/ModalOverlay.tsx:99` |
| P1 — Give `NumpadOverlay` drag-to-dismiss | **CLOSED** | `src/components/workout/overlays/NumpadOverlay.tsx:578`, `:581`, `:612` |
| P1 — Correct 1:1 tracking on the four bypass sheets | **CLOSED** | all four, see 1.3 |
| P1 — Tracking on the two large numbers | **CLOSED** | `src/components/workout/components/InlineRestTimer.tsx:451`, `src/components/workout/WorkoutSummary.tsx:648` |
| P2 — Velocity + projection on bypass sheets' dismiss tests | **CLOSED** | inherited from `src/components/ui/ModalOverlay.tsx:224` |
| P2 — Damp the button-triggered sheet opens | **CLOSED** | opens are now `ModalOverlay`'s `bounce: 0`; see 1.3 |
| P3 — Continuous feedback on the exercise swipe | **CLOSED** | see 1.4 |
| P2 — Point the high-contrast toggle at classes that exist | **STILL-OPEN** | `src/styles/tokens.css:756`–`:759` |
| P3 — Press feedback on the sheet close button | **STILL-OPEN** | `src/components/ui/Sheet.tsx:113`, `:115` |

## 1.2 `SlideToComplete` "Zero velocity handling" — **WRONG**

The executive-summary table and §1 rows 4/5 say the release is a pure position test and that
"Nothing anywhere in this file reads velocity. There is no `lastMoveTime`/`lastX` bookkeeping to
compute it from." All of that is false now.

- `PROJECTION_S = 0.499` — `src/components/workout/components/SlideToComplete.tsx:48`
- `VELOCITY_WINDOW_MS = 100` — `:50`
- `STALE_RELEASE_MS = 80` (a stopped finger is credited no momentum) — `:53`
- Sample history `samplesRef` — `:76`, written per pointer-move at `:390`–`:396`
- `releaseVelocity()` in px/s — `:413`–`:421`
- The projected-resting-point gate the audit asked for, verbatim — `:443`–`:445`

Also closed in the same file, and also still described as FAIL:

- **§1 row 1(a), the CSS-transition snap-back at the cited `:333`.** That transition string no longer
  exists. The return is an interruptible spring: `snapHome()` at `:137`–`:156`, two-parameter
  springs at `:56`–`:57`, bounce spent only when the release carried momentum at `:145`–`:147`.
  Thumb and fill now carry `transition: 'none'` (`:575`, `:520`).
- **§1.1(a), the re-grab jump.** `startOffsetRef` is now seeded from the live presentation value
  (`offsetRef.current`) at `:360`, and the in-flight spring is stopped first at `:358`. The comment
  at `:73`–`:75` documents the exact bug the audit predicted.
- **§1 row 7, "no springs exist".** Half closed — the snap-home is a spring (`:56`–`:57`); the
  commit fling is still GSAP. See 2.1.

## 1.3 The four bypass sheets and `NumpadOverlay` — **CLOSED**, all five

§2b's table, its three numbered findings, and P1/P2 all describe hand-rolled `m.div` sheets with
`dragElastic` 0.4–0.5 and position-only dismiss. Every one is now on the canonical
`ModalOverlay variant="bottomSheet"` path with a `[data-sheet-drag-handle]` grabber, so they inherit
1:1 downward tracking, `dragElastic={0.08}`, velocity handoff and `projectMomentum`.

| Sheet | Now on the canonical path at |
|---|---|
| `ExerciseSelector` | `src/components/workout/ExerciseSelector/index.tsx:186`, `:189`, `:234` |
| `WorkoutSettingsOverlay` | `src/components/workout/overlays/WorkoutSettingsOverlay.tsx:95`, `:98`, `:128` |
| `SupersetPicker` | `src/components/workout/components/SupersetPicker.tsx:85`, `:88`, `:106` |
| `ExerciseReorder` | `src/components/workout/ExerciseReorder.tsx:212`, `:215`, `:244` |
| `NumpadOverlay` | `src/components/workout/overlays/NumpadOverlay.tsx:578`, `:581`, `:612` |

Each file carries a past-tense comment describing the old defect —
`src/components/workout/ExerciseSelector/index.tsx:200`–`:202`,
`src/components/workout/overlays/WorkoutSettingsOverlay.tsx:110`–`:111`,
`src/components/workout/components/SupersetPicker.tsx:100`–`:101`,
`src/components/workout/ExerciseReorder.tsx:227`–`:228`,
`src/components/workout/overlays/NumpadOverlay.tsx:594`. **A grep for `dragElastic` in these files
hits only prose.** §2b's claim that `NumpadOverlay` has "NO DRAG AT ALL" is **WRONG**.

One correction to a fix-list instruction: the `damping: 28 / stiffness: 350` spring P2 targets in
`NumpadOverlay` is gone from the sheet open. The surviving
`stiffness: 500, damping: 30` at `src/components/workout/overlays/NumpadOverlay.tsx:95`–`:97` is a
per-digit entry micro-animation staggered by index, not the sheet. Do not "damp" it.

## 1.4 The exercise swipe, "the biggest single violation" — **CLOSED**

§3 in full — the whole section, its 10-row table, and P3. The move handler is no longer a no-op.
`src/components/workout/hooks/useSwipeNavigation.ts:7` opens with *"The surface FOLLOWS THE FINGER.
The move handler used to be a deliberate no-op"*, and the hook now has:

- a real `handleSwipePointerMove` — `:185`
- velocity sampling over a 100 ms window — `:52`, `:209`–`:212`, `:242`–`:248`
- a projected commit target — `:253`, `:256`, `:263`
- a spring settle with earned bounce — `:121`, `:132`
- RTL sign-flip preserved — `:146`, `:148`

## 1.5 `reports/04` P1 contrast — both sites **CLOSED**

- **Paywall waitlist, 1.65:1.** Inverted to an accent fill with on-accent ink, exactly the report's
  first option: `src/pages/billing/PaywallScreen.tsx:180`–`:181` (fill + border),
  `:186` and `:194` (ink). The comment at `:177`–`:179` cites the 1.65:1 measurement.
- **`PlanSetRow` `+` button, 1.50:1.** `src/components/workout/components/PlanSetRow.tsx:113` is now
  `--color-ink-on-accent`, with the reasoning at `:110`–`:112`. The report cited `:108-110`; the
  fill is at `:108`, the ink at `:113`.

## 1.6 `reports/04` P1 Tabs RTL — **half closed, and the half that is open is the trap**

The shared component is fixed. The two page-level tablists are not.

- **CLOSED** — `src/pages/progress/components/SegmentedControl.tsx:72`:
  `const forward = isRTL ? e.key === 'ArrowLeft' : e.key === 'ArrowRight';` — the single helper the
  report specified. `:9` documents the old bug; `:52` reads `useIsRTL()`.
- **STILL-OPEN** — `src/pages/Progress.tsx:222` and `:228`, `src/pages/Nutrition.tsx:200` and `:206`.
  Both still advance the index on raw `ArrowRight` with no `isRTL` flip. The report's cited ranges
  (`Progress.tsx:193-210`, `Nutrition.tsx:194-211`) have **MOVED** to `:221-235` and `:199-213`.

A worker told "the tabs RTL bug is closed" leaves two main tablists broken. A worker told to fix all
three finds one already done.

## 1.7 `FS-PRIMARY-EXPOSURE.md` §4c — the adjacent defect it warns Batch 3 about is already fixed. **CLOSED**

§4c and Batch 3's extra-item 1 both instruct: *"A worker who only re-points the border leaves this
broken."* It is not broken. `src/components/workout/overlays/SettingsPrimitives.tsx:171` reads
`color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-heading)'` — the exact token the audit
prescribed — with the reasoning at `:164`–`:170`. The border at `:162` is still `--fs-primary` and
still needs Batch 3.

## 1.8 `FS-PRIMARY-EXPOSURE.md` Batch 1 — landed, and it deviated from the audit's own §5 proposal. **CLOSED + WRONG**

Both proposed tokens now exist in all three cascade blocks:

| Token | `:root` | `html.dark` | `html.high-contrast` |
|---|---|---|---|
| `--fs-edge` | `src/styles/tokens.css:62` | `:460` | `:728` |
| `--fs-panel` | `:67` | `:465` | **`:742`** |

**The HC `--fs-panel` value is not what §5 proposes.** §5's code block, its four-state contrast
table (`light+HC #111111 / dark+HC #111111`), and Batch 1's instruction all say
`html.high-contrast { --fs-panel: var(--fs-surface-2); }`. Shipped code uses a literal `#1c363b`
(`src/styles/tokens.css:742`), with `:729`–`:741` explaining that the elevation ladder was rejected
precisely because it would take a band from 1.39:1 to 1.11:1 — the regression §5's own "Two things to
fix before this ships" item 1 flagged. That item is resolved, differently. **The audit's §5 table and
Batch 1 text are now wrong against the tree; do not "correct" `tokens.css:742` back to
`--fs-surface-2`.**

Eight of Batch 1's twelve paint sites are converted:

| Site, as the audit cites it | Verdict | Now at |
|---|---|---|
| `.card-outlined` `global.css:122` | **CLOSED** | `src/styles/global.css:127` (`--fs-edge`) |
| `.card-interactive` `global.css:130` | **CLOSED** | `src/styles/global.css:139` (`--fs-edge`) |
| `.masthead` `global.css:316` | **CLOSED** | `src/styles/global.css:332` (`--fs-panel`) |
| `.chapter-break` `global.css:343` (§4b "needs one look") | **CLOSED** | `src/styles/global.css:368` (`--fs-panel`) |
| `.hero-card` `components.css:642,643` | **CLOSED** | `src/styles/components.css:649`, `:650` |
| `.premium-dark-surface` `components.css:1789,1790` | **CLOSED** | `src/styles/components.css:1803`, `:1804` |
| `.tab-item.active` `global.css:309` | **STILL-OPEN**, MOVED | `src/styles/global.css:318` |
| `.text-gradient` `global.css:594` | **STILL-OPEN**, MOVED | `src/styles/global.css:619` |
| decorative stripe `components.css:1372` | **STILL-OPEN**, MOVED (leave alone, per audit) | `src/styles/components.css:1379` |
| `.fs-brand-icon` `components.css:1392` | **STILL-OPEN**, MOVED (needs design sign-off) | `src/styles/components.css:1399` |

**Batches 2–9 have NOT landed.** `--fs-edge` and `--fs-panel` appear in only three files —
`tokens.css`, `global.css`, `components.css`. Every `--fs-primary` paint site outside those three is
still open.

## 1.9 `reports/04` P2 heading hierarchy — **WRONG**, two of its four cited files do not exist

The finding cites `src/pages/onboarding/steps/RoleStep.tsx:46`, compares against
`WelcomeStep.tsx:32` and `CompleteStep.tsx:123`, and instructs "make the active step's heading an
`h1`". `src/pages/onboarding/steps/` now contains exactly three files —
`GoalsStep.tsx`, `ProfileStep.tsx`, `WelcomeStep.tsx`. **`RoleStep.tsx` and `CompleteStep.tsx` are
gone, and none of the three surviving steps contains any `<h1>` or `<h2>` element at all**, so the
cited `WelcomeStep.tsx:32` `h1` is also gone. The finding is unaddressable as written and the
onboarding heading question needs re-deriving from scratch.

(`CompleteStep.tsx`'s absence is already noted in `FS-PRIMARY-EXPOSURE.md`'s Batch 9 correction —
`reports/04` was never updated to match.)

## 1.10 `FS-PRIMARY-EXPOSURE.md` — sites that are SAFE and must not be swept: all confirmed **STILL-OPEN as SAFE**

Re-verified by opening each file, because sweeping one breaks working UI. The audit's second-pass
verdicts hold:

- `src/pages/onboarding/steps/GoalsStep.tsx:93`, `:126`, `:139` — all three SAFE. The selected card
  fills with `var(--fs-accent)` at `:81` (the audit cites `:80`, where the declaration opens). The
  audit called this "the single largest misread in the original"; its correction is accurate.
- `src/components/workout/reorder/ExerciseReorderItem.tsx:289` — SAFE. The fill at `:288` is
  `isExpanded ? 'var(--fs-accent)'`, so the `--fs-primary` ink at `:289` sits on mint.
- `src/pages/Dashboard.tsx:294` — SAFE, single site, matches.
- `src/components/workout/WorkoutSummary.tsx:678` — SAFE.
- `src/pages/settings/sections/WorkoutPrefsSection.tsx:65` — **BROKEN**, and the audit's
  move-out-of-SAFE is right: the line is
  `{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }`. The fill is primary.

---

# TIER 2 — still open, act on these

## 2.1 `MOTION-GESTURE-AUDIT.md`

| Claim | Verdict | Evidence |
|---|---|---|
| §1.1(b) the completion fling is a fixed, un-grabbable GSAP timeline | **STILL-OPEN** | `src/components/workout/components/SlideToComplete.tsx:300`–`:304` (`gsap.timeline()`, `DUR.fast`, `EASE.pop`) |
| §1 row 6 no rubber-band — hard clamp at both ends | **STILL-OPEN** | `src/components/workout/components/SlideToComplete.tsx:384` |
| §1 row 7 the fling carries no spring | **STILL-OPEN** (snap-home half is closed) | `src/components/workout/components/SlideToComplete.tsx:304`, `:325` |
| §2a the `velocity.y > 850` escape hatch is probably redundant once projection is correct | **STILL-OPEN**, and now actionable — projection *is* correct | `src/components/ui/ModalOverlay.tsx:225` |
| P3 sheet close button is `onClick` + `transition-colors` | **STILL-OPEN**, MOVED from `:104` | `src/components/ui/Sheet.tsx:113`, `:115` |
| P2 `html.high-contrast` glass list names `.glass-subtle`, which is defined nowhere, and misses both shipping classes | **STILL-OPEN**, MOVED from `tokens.css:672-675` | `src/styles/tokens.css:756`–`:759` |
| P2 `prefers-contrast: more` block omits `.glass-surface-dark` | **STILL-OPEN**, MOVED from `components.css:1524-1532` | `src/styles/components.css:1530`–`:1540` |

`.kinetic-number`'s own `-0.01em` at `src/styles/components.css:1638` is unchanged — correctly, since
the audit said leave it for the 35+ small call sites. The two large numbers were fixed with inline
overrides rather than the proposed `.xl` class.

## 2.2 `FS-PRIMARY-EXPOSURE.md` — batch sites verified as still open, citations correct

Spot-checked across every batch. These second-pass line numbers are **exact** today, so the ledger
is usable for batches 2–9 apart from the drift in 3.2:

`src/components/workout/reorder/SetEditRow.tsx:69,128,153,175,176,263` ·
`src/components/workout/components/SetEditBottomSheet.tsx:30,340` ·
`src/components/workout/states/WorkoutPlanScreen.tsx:194,275,289,445,446` (5 sites, as batched) ·
`src/components/ui/PremiumSelect.tsx:128,178,201` ·
`src/components/workout/QuickExerciseForm.tsx:146,158,307` ·
`src/components/workout/WorkoutSummary.tsx:678,953,1019,1036,1051,1064` (all six corrected numbers
right) · `src/components/workout/reorder/ExerciseReorderItem.tsx:155,161,189,289` ·
`src/pages/onboarding/components/ProgressDots.tsx:63` ·
`src/components/workout/components/SlideToComplete.tsx:491` ·
`src/components/workout/components/WorkoutHeader.tsx:261` ·
`src/errors/RootErrorBoundary.tsx:115` (literal fallback `var(--fs-primary, #16292d)` intact, as the
audit requires) · `src/pages/settings/sections/WorkoutPrefsSection.tsx:65`.

`TemplateCard.tsx:223,228,229,254` all present, including the identical-branch bug at `:229`
(`isFavorite ? 'var(--fs-primary)' : 'var(--fs-primary)'`) — but see 3.3 for the path.

## 2.3 `reports/04-A11Y-RTL-HEBREW.md`

| Claim | Verdict | Evidence |
|---|---|---|
| P1 statement — named accessibility coordinator still missing | **STILL-OPEN** | `src/pages/AccessibilityStatement.tsx:232`–`:237` (owner-action comment), `:239` (brand name, not a person) |
| P2 touch target — MyCoach 36px and 28px | **STILL-OPEN**, MOVED | `src/pages/MyCoach.tsx:575`–`:576` (36px), `:947`–`:948` (28px). `:756`–`:757` is already 44px |
| P2 BiDi — login back arrows point the wrong way in RTL | **STILL-OPEN** | `src/pages/login/steps/SignInStep.tsx:97`, `src/pages/login/steps/SignUpStep.tsx:267`, `src/pages/login/steps/ForgotPasswordStep.tsx:123` — all still `ArrowLeft` |
| P2 BiDi — email addresses not isolated | **STILL-OPEN** | `src/pages/login/steps/ForgotPasswordStep.tsx:99`–`:101` — mono `<span>`, no `<bdi dir="ltr">` |
| P2 BiDi — `CSV`/`JSON` not isolated | **STILL-OPEN**, MOVED from `:59-61` | `src/pages/billing/PaywallScreen.tsx:67`, `:69` |
| Copy — `KCAL`, `P/C/F` | **STILL-OPEN**, lines exact | `src/pages/nutrition/components/MealLog.tsx:101`, `:215`; `src/pages/nutrition/components/NutritionTrendChart.tsx:58`, `:113` |
| P2 RTL logical — highlight bars pinned physically | **STILL-OPEN**, but the cited address is WRONG — see 3.4 | `src/styles/global.css:486` and `:511`, both `inset: 9px auto 9px 0` |

`<bdi>` has been adopted broadly elsewhere — 56 sites across the coach console, dashboard and workout
surfaces — so the pattern is established and the login steps are simply un-migrated.

### Residual worth naming, not a claim in the report

`src/pages/login/steps/SignInStep.tsx:64` still puts the word "Supabase" into a user-visible error.
The report's cited block (`:227-246`) **is** closed — the customer-facing banner at `:226`–`:262` is
Hebrew and its comment says it deliberately names no environment variables — but the same defect
class survives one function up.

---

# TIER 3 — line drift only, claim intact

Lower damage: a worker lands on the wrong line and notices. Still worth fixing before a batch.

## 3.1 `MOTION-GESTURE-AUDIT.md`

`SlideToComplete.tsx`, all **MOVED**: pointer-down `:252` → `:346` · press haptic `:263` → `:363` ·
pointer capture `:264` → `:364` · pointer-move `:283` → `:370`/`:409` · RTL sign `:278` → `:376` ·
grab offset `:261` → `:360` · threshold haptic `:289` → `:403` · `THRESHOLD` `:28` → `:29` ·
GSAP timeline `:206-244` → `:291`–`:345` · thumb `:441` → `:565`–`:578` · fill `:386` → `:508`–`:522`.

Elsewhere: `prefers-reduced-transparency` block `components.css:1496` → `src/styles/components.css:1503` ·
`prefers-contrast` block `:1523` → `:1530` · `.kinetic-number` `:1628-1642` → `:1635`–`:1638` ·
`.kinetic-number.large` `:1645-1650` → `:1652`–`:1657` · `ModalOverlay` `projectMomentum` `:93` →
`src/components/ui/ModalOverlay.tsx:98` · `drag="y"` `:369` → `:396` · `dragConstraints` `:371-373`
→ `:399`–`:400` · backdrop click `:334` → `:263`/`:360`.

## 3.2 `FS-PRIMARY-EXPOSURE.md` — the `tokens.css` drift is **not** "+15". It is +24, and up to +84. **WRONG**

The second pass corrects the original by +15 and states *"`tokens.css` line citations below line 28
are stale by +15"*. Every one of those corrected numbers is itself stale, by a further +24 in the
`:root` block and by +40 to +84 lower down:

| Token / block | Audit's "verified" number | Actually at | Drift |
|---|---|---|---|
| `--fs-primary` (light) | `:22` | `:22` | ✓ correct |
| `--fs-accent-text` (light) | `:43` | `:43` | ✓ correct |
| `--navy` | `:56` | `src/styles/tokens.css:80` | +24 |
| `--color-on-mustard` | `:66` | `:90` | +24 |
| `--color-primary` | `:83` | `:107` | +24 |
| `--fs-heading` | `:110` | `:134` | +24 |
| `html.dark` opens | `:381` | `:420` | +39 |
| `--fs-primary` (dark) | `:417` | `:441` | +24 |
| `--fs-accent-text` (dark) | `:425` | `:449` | +24 |
| `--navy` (dark) | `:437` | `:477` | +40 |
| `--color-primary` (dark) | `:465` | `:505` | +40 |
| `--color-border-strong` (dark) | `:471` | `:531` | +60 |
| `html.high-contrast` opens | `:587` | `:646` | +59 |
| `--fs-accent-text` (HC) | `:683` | `:723` | +40 |
| HC glass selector block | `:672-675` | `:756`–`:759` | +84 |

Cause: the `--fs-edge` / `--fs-panel` declarations and their ~30 lines of rationale landed at
`:60`–`:67`, `:445`–`:465` and `:724`–`:742`. The drift is not uniform, so **do not apply a constant
offset** — re-grep per token.

Two smaller drifts in the batch ledger:
`src/components/workout/overlays/NumpadOverlay.tsx` `:601` → `:602` and `:609` → `:615` (Batch 2's
instruction targets `:609` for the fill; the fill is at `:615`).
`src/components/workout/overlays/SettingsPrimitives.tsx` `:284,333,399,401` → `:291`, `:340`,
`:406`, `:408`.

## 3.3 `FS-PRIMARY-EXPOSURE.md` — Batch 9's `TemplateCard` path. **WRONG**

Batch 9 lists `templates/components/TemplateCard.tsx`, which under the batch's own
`src/components/`-relative convention resolves to a file that does not exist. The file is at
`src/pages/templates/components/TemplateCard.tsx`. All four sites (`:223`, `:228`, `:229`, `:254`)
are present there.

## 3.4 `reports/04` — three citation blocks now point at unrelated code. **WRONG**

| Cited as | What is actually there | Where the real thing is |
|---|---|---|
| `global.css:704-705,733,758` (physical highlight bars, paired padding) | `:704`–`:705` is a `content-visibility` rule on card classes; `:733` is prose inside the `pageEnter` comment; `:758` is a View-Transitions comment | `src/styles/global.css:486` (`.card-fs::before`) and `:511` (`.panel::before`), both `inset: 9px auto 9px 0` — physical `left: 0`, so the accent rail lands on the wrong edge in RTL. **STILL-OPEN** |
| `components.css:524,528` (physical padding) | `:524` is a section-header comment; `:528` is `.safe-area-top`'s closing brace | `src/styles/components.css:534`–`:539` (`.safe-area-left` / `.safe-area-right`), duplicated at `src/styles/global.css:572`–`:577`. Both pairs have **zero TSX consumers** — dead, not defective |
| `tokens.css:16-28,88-92,371-382,455-457` (the contrast table's token source, cited three times) | none of the four ranges holds what is described | `--fs-heading` + its ban comment: `src/styles/tokens.css:132`–`:134`; `html.dark` opens `:420`; `html.high-contrast` opens `:646` |

## 3.5 `reports/04` — other MOVED citations, claim closed or intact

`Sheet.tsx:117-118` → `src/components/ui/Sheet.tsx:119`–`:120` ·
`PaywallScreen.tsx:292` → `src/pages/billing/PaywallScreen.tsx:324` ·
`:105-117` → `:110`–`:124` · `:351-390` → `:383`–`:394` · `:333,475` → drifted (the `h1` is now at
`:331`) · `MyCoach.tsx:244` → `src/pages/MyCoach.tsx:246` ·
`PageHeader.tsx:74-75` → `src/components/ui/PageHeader.tsx:166`–`:167` ·
`PremiumSelect.tsx:24` → `src/components/ui/PremiumSelect.tsx:26` ·
`SegmentedControl.tsx:29-40` → `src/pages/progress/components/SegmentedControl.tsx:69`–`:79`;
`:73` → `:111` · `AccessibilityStatement.tsx:99-102` → `src/pages/AccessibilityStatement.tsx:107`;
`:155-176` → `:154`–`:181`; `:224-242` → `:232`–`:239`.

---

# TIER 4 — the rest of `reports/04`, closed

Recorded so no one re-opens them.

| Claim | Verdict | Evidence |
|---|---|---|
| P2 touch target — SegmentedControl 32px | **CLOSED** | `src/pages/progress/components/SegmentedControl.tsx:111` (`minHeight: 44`) |
| P2 touch target — Sheet close 36px | **CLOSED** | `src/components/ui/Sheet.tsx:119`–`:120`, with the HIG note at `:117` |
| P2 touch target — Paywall back 40px | **CLOSED** | `src/pages/billing/PaywallScreen.tsx:324` (`w-11 h-11`) |
| P2 RTL logical — `PageHeader` maps `paddingInlineStart` to the left safe area | **CLOSED** | `src/components/ui/PageHeader.tsx:166`–`:167`, backed by `src/styles/tokens.css:784`–`:785` (`:root`) and `:796`–`:797` (`:root:dir(rtl)`), plus utilities at `src/styles/global.css:583`–`:588`. This is precisely the fix the report specified |
| P2 semantics — comparison table has no `<caption>` | **CLOSED** | `src/pages/billing/PaywallScreen.tsx:394` (`<caption className="sr-only">`) |
| P2 semantics — "not available" cell relies on `aria-label` on a generic `div` | **CLOSED** | `src/pages/billing/PaywallScreen.tsx:120` (`sr-only` text node) + `:121` (`aria-hidden` dash), reasoning at `:113`–`:115` |
| P2 automation — no axe gate in CI/E2E | **CLOSED** | `e2e/a11y.spec.ts` exists: `AxeBuilder` at `:1`/`:33`, WCAG 2.0/2.1 A+AA tags at `:17`, four public routes at `:43`–`:48`, `expect(...).toHaveLength(0)` at `:58`. `@axe-core/playwright` pinned at `package.json:50`. `:7` documents the DEV-only state the report described. **Partial**: `color-contrast` is disabled with a stated reason at `:24`–`:30`, coverage is 4 public routes only, and the Tab/Shift+Tab/Escape and RTL-arrow suites the report also asked for do not exist yet |
| Copy — `Select an option` English fallback | **CLOSED** | `src/components/ui/PremiumSelect.tsx:26` (Hebrew default), note at `:24`–`:25` |
| Copy — `My Coach` subtitle | **CLOSED** | `src/pages/MyCoach.tsx:246` (Hebrew title). The only remaining match is a code comment at `:2` |
| Copy — SignInStep exposes env-var names to the user | **CLOSED** at the cited block | `src/pages/login/steps/SignInStep.tsx:226`–`:262`; see the residual in 2.3 |
| P1 statement — publishes "full navigation" and a blanket 4.5:1 | **CLOSED** | `src/pages/AccessibilityStatement.tsx:154` now scopes to central screens; `:156`–`:158` qualifies the 4.5:1 claim and points at known limitations; the limitations section lists incomplete screen-reader testing, sub-44px targets and axe-on-public-pages-only |

---

# UNVERIFIABLE from source alone

Honest gaps. Nothing below was guessed.

**`MOTION-GESTURE-AUDIT.md`'s own "What a static read cannot determine" section — all 7 items remain
unverifiable**, and it was right to list them: haptic/spark frame alignment, real
`navigator.vibrate` latency, whether the re-grab jump was perceptible (now moot — the bug is fixed),
whether `dragElastic: 0.5` read as broken (moot — all four sheets migrated), frame rate under load,
whether `MIN_DX = 70` is tuned or guessed, and real RTL rendering of mixed Hebrew/digits/Latin.
Item 7's sub-claim about `fixed bottom-0 left-0 right-0` on the bypass sheets is moot for the same
reason as item 4.

**`FS-PRIMARY-EXPOSURE.md`:** I did not re-derive the four-state contrast arithmetic, and I did not
re-verify the ~43 hits outside `src/`. Both are explicitly out of scope in the audit's own §7. Its
inventory total, however, is checkable and has changed — see below.

**`reports/04-A11Y-RTL-HEBREW.md`:** I did not recompute the 13-row token contrast table (only the
two "active use" rows, which are structurally fixed). The release-gate item 10 — NVDA / JAWS /
VoiceOver / TalkBack in Hebrew, keyboard-only, real-device touch — needs hardware and is correctly
self-labelled. Whether the axe gate actually **passes** needs `npm run test:e2e`, which I was
instructed not to run. `e2e/smoke.spec.ts`, `src/components/ui/Sheet.test.tsx` and `vitest.config.ts`
were not read, so the coverage claims about those three are unchecked.

---

# One inventory number to reconcile before Batch 2

`FS-PRIMARY-EXPOSURE.md` publishes **247 lines / 251 occurrences / 85 files** as its re-derived,
verified inventory. Counted today across `src/**` (`*.ts`, `*.tsx`, `*.css`, `*.js`, `*.jsx`):

**253 lines / 257 occurrences / 84 files.**

It went **up** while eight sites were being removed, because the Batch 1 edits added explanatory
comments that name `--fs-primary` — `src/styles/global.css:120`–`:124`, `:324`–`:325`,
`:358`–`:364`, `:435`; `src/styles/components.css:633`, `:1778`, `:1783`–`:1785`;
`src/styles/tokens.css:55`–`:67`, `:452`–`:465`, `:724`–`:742`. The audit's own comment/non-paint
subtraction table (38 non-paint lines) is therefore also stale and will not reconcile.

A worker who greps `--fs-primary` today sees 253 and cannot tie it to 247. Re-derive the non-paint
subtraction before trusting any batch site count. Use `Select-String` piped through
`ForEach-Object { $_ -replace '[^\x20-\x7E]','' }`, as the audit's own tooling note says — the grep
tool caps at 5 matches per file and undercounts `tokens.css` badly.
