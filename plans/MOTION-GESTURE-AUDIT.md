# Motion & Gesture Audit — SparkOS Fitness

**Scope:** read-only fact base for judging interaction quality against Apple's fluid-interface
principles (WWDC18 *Designing Fluid Interfaces*). No code was changed.
**Method:** static read of source. Every verdict carries a `file:line`.
**Date:** 2026-08-29

---

## Executive summary

The app is further along than a "does it even have gestures" audit would assume. There are **three
distinct gesture systems**, and they sit at three different levels of quality:

| System | Verdict |
|---|---|
| `SlideToComplete` (set completion) | Solid tracking + grab offset + pointer capture. **Zero velocity handling** — the release is a pure position test, and the finish is a fixed-duration GSAP timeline that cannot be grabbed. |
| Bottom sheets via `ModalOverlay` (canonical `<Sheet>`) | **The best gesture in the app.** 1:1 tracking, rubber-band, momentum projection, velocity handoff on release. Projection constant is ~2.5× too weak. |
| Bottom sheets that bypass `ModalOverlay` (4 of them) | Regressive. 0.4–0.5 elastic tracking (not 1:1), position-only dismiss thresholds, no velocity handoff, unearned spring bounce on button-triggered opens. |
| Exercise swipe (`useSwipeNavigation`) | **Worst offender.** `handleSwipePointerMove` is a deliberate no-op. Nothing moves during the gesture; the app decides on release. This is a swipe *detector*, not a swipe. |

Three claims in the brief need correcting before anything gets built on them — see
[Corrections to the brief](#corrections-to-the-brief). Most importantly:
**`prefers-reduced-transparency` IS handled**, and **the canonical sheets DO have drag-to-dismiss.**

---

# 1. `SlideToComplete` — the hot path

`src/components/workout/components/SlideToComplete.tsx`

The single most repeated action in the product. Every numbered principle, answered.

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| 1 | Interruptible; animates from presentation value | **FAIL** | `SlideToComplete.tsx:333` |
| 2 | Responds on pointer-down; continuous feedback | **PASS** | `SlideToComplete.tsx:252`, `:263`, `:283` |
| 3 | 1:1 tracking respecting grab offset; pointer capture | **PASS** | `SlideToComplete.tsx:261`, `:278`, `:264` |
| 4 | Release velocity handed to the animation | **FAIL** | `SlideToComplete.tsx:314` |
| 5 | Snap target from a projected resting point | **FAIL** | `SlideToComplete.tsx:314-320` |
| 6 | Rubber-band at boundaries | **FAIL** | `SlideToComplete.tsx:283` |
| 7 | Two-parameter springs; bounce only when earned | **FAIL** | `SlideToComplete.tsx:210`, `:333` |
| 8 | Haptic + sound + visual on the same frame | **PASS (visual/haptic)**, **N/A (sound)** | `SlideToComplete.tsx:289` |
| 9 | Enter/exit same path; transform-origin anchored | **PASS** | `SlideToComplete.tsx:196-244` |
| 10 | Size-specific tracking | **N/A** (15px label) | `SlideToComplete.tsx` label block |

### 1 — Interruptibility: FAIL, two separate ways

**(a) The snap-back is a CSS `transition`.** `SlideToComplete.tsx:333` builds a string:

```
'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), width 280ms ..., opacity 220ms ease'
```

applied to the thumb at `:441` and the fill at `:386`. `isDragging` sets it to `'none'` so it does
not fight the finger — correct — but it is what runs the **return journey** after an
under-threshold release at `:318`. A CSS transition is not grabbable: a re-grab mid-return calls
`recalcMax()` and sets `startOffsetRef.current = offset` at `:261`, and `offset` state is already
`0` (set synchronously at `:318`) while the thumb is still visually mid-flight. **The thumb jumps
to the finger.** This is the textbook presentation-vs-target bug the principle exists to prevent.

**(b) The completion fling is a fixed GSAP timeline.** `:206-244`. `ease: EASE.pop` =
`back.out(2)`, `DUR.fast` = 0.3s. It is not spring-based, carries no velocity, and has no
interrupt path — `isFlinging` at `:441` deliberately strips React's transform so GSAP owns it
exclusively. Arguably acceptable: it is a *commit* animation, and the commit is irreversible by
design. But it means the last 300ms of the app's most-repeated gesture is un-grabbable.

### 2 — Pointer-down response: PASS, and genuinely good

`onPointerDown` at `:252` fires `triggerHaptic('light')` at `:263` — haptic on **press**, not
release. Feedback is continuous throughout: `offset` drives the fill width (`:382`), the fill
opacity (`0.12 + progress * 0.2`), the label fade (`1 - progress * 0.85`) and the chevron fade,
all recomputed per pointer-move at `:283`. This is the correct shape.

The tap-and-hold ramp (`:145-190`) is a bonus input path that also gives continuous feedback
(rAF-driven fill + haptic marks at 33%/66%). It is well-guarded: `finishedRef` at
`:88-96` prevents the ramp and the pointer-up from double-firing `onComplete`, and
`HOLD_MOVE_TOLERANCE = 8` cancels the ramp once the press becomes a slide.

### 3 — Grab offset and pointer capture: PASS

`startOffsetRef.current = offset` at `:261`, then `startOffsetRef.current + delta` at `:283`. The
thumb does **not** snap to the finger — the grab point is preserved. `setPointerCapture` at `:264`
plus `touchAction: 'none'` at `:361` keeps tracking when the pointer leaves the track. RTL is
handled by a `sign` multiplier (`isRTL ? -1 : 1`), applied to the delta at `:278` and the
transform at `:441`, with no physical `left`/`right` in the thumb path.

### 4 & 5 — Velocity and projection: FAIL

`onPointerUp` at `:314`:

```
const ratio = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;
if (ratio >= THRESHOLD) { finish(); } else { setOffset(0); }
```

Nothing anywhere in this file reads velocity. There is no `lastMoveTime`/`lastX` bookkeeping to
compute it from. Consequence: **a fast flick released at 70% is discarded**, identical to a slow
crawl abandoned at 70%. `THRESHOLD = 0.75` (`:28`) is a pure position gate. A user who throws the
thumb — the natural gesture for "yes, done, next set" — is told no. This is the highest-value fix
in the app, on the highest-traffic gesture.

Note the contrast: `ModalOverlay.tsx:93` already contains a correct `projectMomentum` helper. The
hot-path gesture does not use it.

### 6 — Rubber-band: FAIL

`Math.max(0, Math.min(maxOffsetRef.current, ...))` at `:283` is a hard clamp at both ends. Push
past the end of the track and the thumb simply stops dead under a still-moving finger. No
progressive resistance.

### 7 — Springs: FAIL (no springs exist)

Two motion systems, neither spring-based:
- CSS cubic-bezier `(0.16, 1, 0.3, 1)` / 280ms for return (`:333`)
- GSAP `back.out(2)` / 0.3s + `back.out(3)` for the fling (`:210`, `:231`)

`back.out(2)` overshoots hard. Per principle 7 the overshoot on the *commit* is arguably earned
(the gesture carried momentum toward it) — but it is a fixed overshoot regardless of whether the
user flicked or crept, because velocity is never measured. The **return** journey overshoot-free
easing is right in character but wrong in kind (transition, not spring).

### 8 — Haptic/visual simultaneity: PASS

`triggerHapticEffect('impact', 'medium')` at `:289` fires inside the `setOffset` updater on the
threshold-crossing frame, alongside `setThresholdAnnounce`. Same frame as the visual. The
completion haptic is deliberately **not** here — the comment at `:98-100` says it is owned by the
`COMPLETE_SET` reducer in `WorkoutProvider` to avoid a double buzz. That is a defensible
architectural choice, but it means the completion haptic and the `fireSparks`/check-stamp visual at
`:215-234` are dispatched from two different systems, so their frame alignment **cannot be
confirmed by static read** — see [Not determinable](#what-a-static-read-cannot-determine). No audio
layer exists in this component.

### 9 — Same path in and out: PASS

The thumb travels the same axis on the way out (`x: target + overshoot` → `x: target`) and is
returned by `gsap.set(thumb, { clearProps: 'transform' })` + `setOffset(0)` at `:241-243`. The
spark burst origin is computed from the thumb centre (`thumbCenter`, RTL-mirrored at `:217`), so
the celebration is anchored to the element that caused it — the transform-origin principle applied
correctly.

---

# 2. Bottom sheets

## 2a. The canonical path — `ModalOverlay` / `<Sheet>`

`src/components/ui/ModalOverlay.tsx`, `src/components/ui/Sheet.tsx`

**Drag-to-dismiss exists.** `drag="y"` at `ModalOverlay.tsx:369`, gated by `dragListener={false}` +
`dragControls`, started only from a `[data-sheet-drag-handle]` pointer-down (`:186`). `<Sheet>`
marks both the grabber (`Sheet.tsx:75`) and the title (`Sheet.tsx:99`) as handles. The body keeps
`touchAction: 'pan-y'` so content still scrolls.

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| 1 | Interruptible; from presentation value | **PASS** | `ModalOverlay.tsx:369`, `:365` |
| 2 | Pointer-down response; continuous | **PASS** | `ModalOverlay.tsx:375`, `:198` |
| 3 | 1:1 tracking + grab offset | **PASS** | `ModalOverlay.tsx:371-373` |
| 4 | Velocity handed to the animation | **PASS** | `ModalOverlay.tsx:216-222` |
| 5 | Projected resting point | **PARTIAL** | `ModalOverlay.tsx:93-96`, `:208` |
| 6 | Rubber-band | **PASS** | `ModalOverlay.tsx:372-373` |
| 7 | Two-param spring; earned bounce | **PASS** | `ModalOverlay.tsx:219-221`, `:250-256` |
| 8 | Haptic on the crossing frame | **PASS** | `ModalOverlay.tsx:198-205` |
| 9 | Same path in/out | **PASS** | `ModalOverlay.tsx:322-326` |
| 10 | Size-specific tracking | **PASS** | `Sheet.tsx:103` (20px @ -0.02em) |

Why this one is right:
- **1:1 downward.** `dragConstraints={{ top: 0 }}` — only the *upward* direction is constrained, so
  downward drag is unelasticized 1:1 finger tracking. `dragElastic={0.08}` gives progressive
  resistance upward. This is the correct asymmetry and the other four sheets get it wrong.
- **Velocity handoff.** `animate(sheetY, 0, { type:'spring', bounce:0, duration:0.4, velocity: info.velocity.y })`
  at `:216-222`. No seam between drag and animate.
- **Projection.** `projectMomentum` at `:93-96` implements the exponential-decay formula —
  but with `decel = 0.995`, giving a factor of **0.199s**. The Apple value `d = 0.998` gives
  **0.499s**. The projection is **2.5× too weak**, so a flick is under-credited. The `|| info.velocity.y > 850`
  escape hatch at `:209` is compensating for exactly this.
- **Bounce is correctly withheld.** `bounce: 0` on both the non-gesture open (`:253`) and the
  snap-home (`:219`) — damping 1.0, per the principle. The `duration: 0.45` open (`:254`) is longer
  than the 0.3–0.4 response band.
- **Haptic on the crossing frame only.** `dismissArmedRef` at `:198-205` fires
  `triggerHapticEffect('selection')` on the transition into the armed zone, once. Correct.

**Sheets on the canonical path (drag-to-dismiss works):** `StartWorkoutSheet.tsx:121`,
`CommentSheet.tsx:546`, `ReportReasonSheet.tsx:49`, `WelcomeGuideSheet.tsx:132`,
`AlternativesSheet.tsx:56`, `DropSetSheet.tsx:125`, `SetEditBottomSheet.tsx:97`,
`WorkoutToolsSheet.tsx:148`, `RPEPicker.tsx:95`, `BottomNav.tsx:619`,
`AddWeightModal.tsx:59`, `AddMeasurementModal.tsx:79`, `AddRecoveryModal.tsx:69`,
`AddMealModal.tsx:99`, `GoalsEditor.tsx:157`, `BarcodeScanner.tsx:184`, plus the coach sheets.

## 2b. The four sheets that bypass it

These use `variant="none"` and hand-roll their own `m.div`. They are the regression.

| Sheet | Drag? | 1:1? | Velocity? | Projection? | Spring on open |
|---|---|---|---|---|---|
| `ExerciseSelector/index.tsx:225` | yes | **no** — `dragElastic 0.5` (`:229`) | yes (`:187`) | **linear** `v*0.18` (`:187`) | `bounce:0, 0.38s` ✓ (`:216`) |
| `WorkoutSettingsOverlay.tsx:124` | yes | **no** — `dragElastic 0.4` (`:126`) | **no** (`:60`) | **no** — `offset.y > 100` | `damping 28 / stiffness 350` → ζ≈0.75 ✗ |
| `SupersetPicker.tsx:111` | yes | **no** — `dragElastic 0.5` (`:113`) | **no** (`:83`) | **no** — `offset.y > 150` | `damping 30 / stiffness 300` → ζ≈0.87 ✗ |
| `ExerciseReorder.tsx:256` | yes | **no** — `dragElastic 0.5` (`:258`) | threshold only (`:194`) | **no** | — |
| `NumpadOverlay.tsx:598` | **NO DRAG AT ALL** | — | — | — | `damping 28 / stiffness 350` → ζ≈0.75 ✗ |

Three findings worth stating plainly:

1. **`dragConstraints={{ top: 0, bottom: 0 }}` + `dragElastic: 0.5` is not 1:1 tracking.** Both
   bounds are pinned at zero, so *every* pixel of downward travel is elastic — the sheet moves
   **half as far as the finger**. Principle 3 broken by construction. The canonical
   `{{ top: 0 }}` + `0.08` is the correct form and already exists two files away.

2. **`NumpadOverlay` is a bottom sheet that animates in and cannot be dragged.** It is the weight/reps
   entry surface — high traffic, second only to `SlideToComplete`. Dismissal is button, backdrop tap,
   or Escape only. `NumpadOverlay.tsx:582-598` has no `drag` prop.

3. **Unearned bounce on button-triggered opens.** `damping: 28, stiffness: 350` resolves to damping
   ratio ζ ≈ **0.75** (response ≈ 0.34s) — a visible overshoot on a sheet opened by a *tap*, which
   carried no momentum. Principle 7 wants damping 1.0 here. `SupersetPicker` is ζ ≈ 0.87, milder but
   the same category.

## 2c. `ConfirmExitOverlay` — correctly N/A

`ConfirmExitOverlay.tsx:99` uses `variant="modal"`, not `bottomSheet`. It is a destructive-action
confirm dialog: drag-to-dismiss would be *wrong* (an accidental swipe must not resolve
"discard the workout?"). Centred modal, scale+fade, backdrop-click and Escape. **No finding.**
Same for `DraftConflictDialog.tsx:36`, `WorkoutSummary.tsx:571`, `ConfirmDialog.tsx:79`.

---

# 3. The exercise swipe — the biggest single violation

`src/components/workout/hooks/useSwipeNavigation.ts`, wired at `ActiveWorkoutNew.tsx:726-727`

| # | Principle | Verdict | Evidence |
|---|---|---|---|
| 1 | Interruptible | **N/A** — nothing animates during the gesture | `useSwipeNavigation.ts:61` |
| 2 | Continuous feedback during gesture | **FAIL** | `useSwipeNavigation.ts:61-63` |
| 3 | 1:1 tracking | **FAIL** — no tracking at all | `useSwipeNavigation.ts:61` |
| 4 | Velocity handed to animation | **FAIL** | `useSwipeNavigation.ts:75-77` |
| 5 | Projected resting point | **FAIL** | `useSwipeNavigation.ts:73` |
| 6 | Rubber-band at first/last exercise | **FAIL** | `useSwipeNavigation.ts:85` |
| 7 | Springs | **N/A** | — |
| 8 | Haptic timing | **FAIL** — fires on release only | `useSwipeNavigation.ts:89` |
| 9 | Same path in/out | **N/A** | — |
| 10 | Tracking | **N/A** | — |

The move handler is an explicit no-op with a comment saying so:

```
// useSwipeNavigation.ts:61-63
const handleSwipePointerMove = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
  // No-op — we decide on pointerup. Tracking here would require canceling scroll.
}, []);
```

The user drags 70px across the screen and **nothing moves**. On release, `MIN_DX = 70` /
`MAX_DY = 40` / `MAX_DURATION = 400` are tested (`:13-15`, `:73-77`) and the exercise either
changes instantly or does not. At the first/last exercise the gesture silently returns at `:85`
with no rubber-band and no haptic — indistinguishable from a missed swipe.

RTL is handled correctly (`:83-84`): `dx > 0 ? (isRTL ? -1 : 1) : ...`, sign-flipped rather than
assumed. No `scrollLeft` is read anywhere in this hook, so the RTL sign-flip hazard does not apply
here. Interactive targets are excluded at `:44-50`.

The stated reason for the no-op — "tracking would require canceling scroll" — is solvable
(`touch-action: pan-y` on the swipe surface, as `ModalOverlay.tsx:368` already does), so this is a
deferred cost, not a hard constraint.

---

# 4. Typography — tracking across the scale

## Not a single fixed value — the display scale is properly graded

`src/styles/typography.css` grades tracking by size, correctly:

| Class | Size | Tracking | File:line |
|---|---|---|---|
| `.text-display-hero` | 120px | **-0.03em** | `typography.css:53` |
| `.text-display-xl` | 88px | -0.028em | `typography.css:62` |
| `.text-display-lg` | 48px | -0.022em | `typography.css:71` |
| `.text-display` | 36px | -0.02em | `typography.css:80` |
| `.text-display-sm` | 24px | -0.016em | `typography.css:~89` |
| `h1`–`h6`, `.heading` | — | -0.022em | `typography.css:39` |
| `.text-label` | 11px | -0.01em | `typography.css:~137` |

Sizes at `tokens.css:216-219`. Tokens `--tracking-tighter: -0.04em` … `--tracking-widest: 0.15em`
exist at `tokens.css:242-247`. **Verdict on the display scale: PASS.** The brief's assumption that
this is one fixed value is wrong.

## The real defect: `.kinetic-number` pins body tracking onto display-size numbers

`components.css:1628-1642` — every number in the app:

```
.kinetic-number {
  letter-spacing: -0.01em;   /* components.css:1630 */
  ...
}

.kinetic-number.large {      /* components.css:1645 */
  font-size: clamp(48px, 14vw, 92px);
  letter-spacing: -0.04em;
}
```

Two tracking values for a class applied at sizes from 12px to 92px. **-0.01em is body tracking.**
Numbers that carry `.kinetic-number` *without* `.large` inherit it no matter how large they render:

| Surface | Size | Tracking it gets | Should be | File:line |
|---|---|---|---|---|
| Rest timer | **72px** | -0.01em | ~-0.03em | `InlineRestTimer.tsx:442,446` |
| Workout summary PR | **56px** | -0.01em | ~-0.025em | `WorkoutSummary.tsx:638,642` |
| Header live timer | 22px | -0.02em (inline override) | ✓ ok | `WorkoutHeader.tsx:64-69` |
| `.kinetic-number.large` | 48–92px | -0.04em | ✓ ok | `components.css:1645-1650` |

So the two largest numbers in the product — the ones the brief named — are set **three times too
loose**, while a sibling class 15 lines away has the right value. `.kinetic-number` is used at 35+
call sites (`HeroStat.tsx:38`, `CalorieHero.tsx:99`, `RingProgress.tsx:163`, `SetInputCard.tsx:260`,
`PreWorkoutScreen.tsx:384/423/457`, …), so the fix must be size-aware, not a blanket change.

Credit where due: `.kinetic-number` sets `direction: ltr; unicode-bidi: isolate` at
`components.css:1641-1642`, which kills the RTL digit-reorder bug class at the source. That is the
right architecture for a Hebrew app.

---

# 5. Also-checked items

## `onClick` where `onPointerDown` is the correct hook

Mixed, and mostly already correct. `onPointerDown` is used for press feedback in
`SetInputCard.tsx:120/158/225/316`, `InlineRestTimer.tsx:344/372/398`,
`PreWorkoutScreen.tsx:310/727`, `WarmupCooldownSelectionStep.tsx:210/244`,
`WarmupCooldownActiveStep.tsx:349`, `WorkoutSummary.tsx:718`, `BottomNav.tsx:533`,
`NumpadOverlay.tsx:226`, `GlowAreaChart.tsx:313`. `ActiveWorkoutNew.tsx:884` even documents the
convention: *"onPointerDown for instant button response"*.

The gap is on the sheet chrome, not the workout controls:
- `Sheet.tsx:104` — the 44px close button is `onClick` only, with `transition-colors` for feedback.
  A CSS colour transition on click-release, where the rest of the app buzzes on press.
- `ModalOverlay.tsx:334` — `handleBackdropClick` is `onClick`. Correct here: a backdrop dismiss
  *should* be cancellable by dragging off before release.
- `WorkoutSettingsOverlay.tsx:63-66` — `handleClose` fires `triggerHaptic()` then `onClose()` from
  an `onClick`. The haptic is one release-frame late.

## Gestures driven by CSS `transition` / `@keyframes`

One confirmed, and it is on the hot path: **`SlideToComplete.tsx:333`** (detailed in §1.1). The
thumb (`:441`) and fill (`:386`) snap-back both run through it.

Everything else in the CSS motion layer is decorative rather than gesture-driven —
`.magnetic-card` (`components.css:1653`), `.page-header-edge::after` (`components.css:1445-1470`,
including a `@supports (animation-timeline: scroll())` scroll-driven variant), `pulse-dot`
(`WorkoutHeader.tsx:60`). Non-interruptible, but nothing is trying to grab them.
`prefers-reduced-motion` guards are present at `motion.css:347`, `:429`, `components.css:823`,
`:867`, `:902`, `:986`, `:1095`, `:1614`, `:1676`, `:1716` and `global.css:663`.

---

# Corrections to the brief

Three premises did not survive the read. Flagging them because the later implementation batch
would be built on them.

### 1. `prefers-reduced-transparency` IS handled — the brief says it is not

`src/styles/components.css:1496`:

```
@media (prefers-reduced-transparency: reduce) {
  :root, html.dark { --nav-bg: var(--fs-surface); }
  .glass, .glass-strong, .glass-light,
  .glass-surface, .glass-surface-dark, .glass-nav, .btn-glass { ... }
}
```

It de-translucates `--nav-bg`, `.backdrop-blur-modal`, **and both real classes**
(`.glass-surface`, `.glass-surface-dark`). A second scoped block exists at
`src/components/workout/exercise-library.css:999`. There is a `biome-ignore` above it explaining
that Biome 1.9.4 does not know the feature name. **Nothing to add here.**

### 2. The stale glass selector list is real — but it is at `tokens.css:672`, not `components.css:1472`

Two separate blocks, and only one is stale.

- **`tokens.css:672-675`** — the **app-level** `html.high-contrast` toggle (the Settings switch,
  not the OS query):
  ```
  html.high-contrast .glass,
  html.high-contrast .glass-strong,
  html.high-contrast .glass-subtle,
  html.high-contrast .glass-nav { ... !important }
  ```
  Confirmed by grep: **`.glass-subtle` is never defined in any CSS file** — the defined set is
  `.glass` (`components.css:398`), `.glass-strong` (`:405`), `.glass-light` (`:414`),
  `.glass-surface` (`:1417`), `.glass-surface-dark` (`:1424`), `.glass-nav` (`:1433`). And
  `.glass` / `.glass-strong` / `.glass-nav` have **zero TSX call sites** — the only real
  consumers are `.glass-surface` (`Card.tsx:81`, `ModalOverlay.tsx:311`) and `.glass-surface-dark`
  (`OfflineIndicator.tsx:96/139`, `NumpadOverlay.tsx:598`, `PreWorkoutScreen.tsx:271`).
  **So the app's own high-contrast toggle de-translucates four selectors, three of which are
  unused and one of which does not exist, and misses both classes that ship.** The brief's finding
  is correct; its address is not.

- **`components.css:1523`** — the OS `@media (prefers-contrast: more)` block. Only sets
  `border-color`, and its list *does* include `.glass-surface` — but omits `.glass-surface-dark`.
  Minor, and a different defect from the one described.

### 3. Sheets do have drag-to-dismiss

`ModalOverlay.tsx:369` (`drag="y"`), reached by every `<Sheet>` consumer. The finding is not
"dismissal is button-only" — it is that **five surfaces bypass the good implementation**
(§2b), one of them (`NumpadOverlay`) with no drag at all.

---

# Prioritised fix list

Cheapest-highest-impact first. Concrete values, not directions. **Nothing below has been applied.**

### P0 — Velocity + projection on `SlideToComplete`
`SlideToComplete.tsx:314` · ~25 lines · highest traffic in the product

Track velocity across pointer-moves (EMA over the last 2–3 samples, `dx/dt` in px/s), then replace
the position gate:

```
const PROJECTION_S = 0.499;          // d = 0.998 → (1/1000) * d/(1-d)
const projected = offset + velocity * PROJECTION_S;
if (projected >= maxOffsetRef.current * THRESHOLD) finish();
```

Keep `THRESHOLD = 0.75` for the projected point. A flick from 40% now completes; a crawl abandoned
at 74% still does not. This single change is what makes the app's most repeated gesture feel
thrown rather than ignored.

### P0 — Make the snap-back interruptible
`SlideToComplete.tsx:333`, `:441`, `:386`

Replace the CSS `transition` string with a spring on the current presentation value — a
`useMotionValue` + `animate(x, 0, {...})`, or GSAP reading `gsap.getProperty(thumb, 'x')` before it
animates. Under-threshold release, carrying the release velocity:

```
{ type: 'spring', bounce: 0, duration: 0.35, velocity }   // damping 1.0 / response 0.35
```

Then `startOffsetRef.current` must be seeded from the **live transform**, not from `offset` state,
or the re-grab jump at `:261` survives the fix.

### P1 — Fix the projection constant in `ModalOverlay`
`ModalOverlay.tsx:94` · one character

```
const decel = 0.998;   // was 0.995 — factor 0.199s → 0.499s
```

Then re-evaluate the `|| info.velocity.y > 850` escape hatch at `:209`; with a correct projection
it is probably redundant.

### P1 — Give `NumpadOverlay` drag-to-dismiss
`NumpadOverlay.tsx:582-598`

Migrate to `<Sheet>` / `variant="bottomSheet"` and inherit the working gesture rather than adding a
fifth hand-rolled one. If the custom numpad chrome makes that too invasive, copy the canonical
prop set verbatim: `dragConstraints={{ top: 0 }}`, `dragElastic={0.08}`, `dragMomentum={false}`,
`dragListener={false}` + a `[data-sheet-drag-handle]` grabber.

### P1 — Correct 1:1 tracking on the four bypass sheets
`ExerciseSelector/index.tsx:228-229`, `WorkoutSettingsOverlay.tsx:125-126`,
`SupersetPicker.tsx:112-113`, `ExerciseReorder.tsx:257-258`

Change `dragConstraints={{ top: 0, bottom: 0 }}` / `dragElastic={{ top: 0, bottom: 0.5 }}` to
`dragConstraints={{ top: 0 }}` / `dragElastic={0.08}`. Downward becomes 1:1; upward keeps
progressive resistance.

### P1 — Tracking on the two large numbers
`InlineRestTimer.tsx:446` (72px), `WorkoutSummary.tsx:642` (56px)

Either add the existing `.large` modifier, or introduce one graded step so the class is size-aware:

```
.kinetic-number.xl { letter-spacing: -0.03em; }   /* 56–80px */
```

Leave `.kinetic-number`'s `-0.01em` alone — it is correct for the 35+ small-number call sites.

### P2 — Add velocity + projection to the bypass sheets' dismiss tests
`WorkoutSettingsOverlay.tsx:60` (`offset.y > 100`), `SupersetPicker.tsx:83` (`> 150`),
`ExerciseSelector/index.tsx:187` (linear `v * 0.18`), `ExerciseReorder.tsx:194`

Export `projectMomentum` from `ModalOverlay.tsx:93` (or lift it into `src/lib/motionTokens.ts`
beside `EASE`/`DUR`) and use one shared implementation:

```
const projected = info.offset.y + projectMomentum(info.velocity.y);
if (projected > height * 0.42) onClose();
```

### P2 — Damp the button-triggered sheet opens
`WorkoutSettingsOverlay.tsx:118`, `SupersetPicker.tsx:105`, `NumpadOverlay.tsx:585`

`{ type: 'spring', damping: 28, stiffness: 350 }` → ζ ≈ 0.75, an unearned overshoot on a tap. Use
the two-parameter form:

```
{ type: 'spring', bounce: 0, duration: 0.35 }        // damping 1.0 / response 0.35 — tap-opened
```

Reserve `{ bounce: 0.2, duration: 0.3 }` (≈ damping 0.8 / response 0.3 — Apple's shipped drawer
value) for the **gesture-completed** case only: the snap-home after a drag that did not reach the
dismiss threshold.

### P2 — Point the high-contrast toggle at the classes that exist
`tokens.css:672-675`

`.glass, .glass-strong, .glass-subtle, .glass-nav` → add `.glass-surface`, `.glass-surface-dark`,
`.glass-light`, `.btn-glass`; drop `.glass-subtle` (undefined). Mirror the already-correct list at
`components.css:1500-1507`. Also add `.glass-surface-dark` to `components.css:1524-1532`.

### P3 — Continuous feedback on the exercise swipe
`useSwipeNavigation.ts:61`

The largest quality gain per principle 2, but the largest change: it needs a translating
exercise-card container, `touch-action: pan-y` on the swipe surface, a projected-target commit, and
a rubber-band at index 0 / n-1. Scope as its own batch, not a line fix.

### P3 — Press feedback on the sheet close button
`Sheet.tsx:104`

`onClick` + `transition-colors` → `onPointerDown` haptic, matching `SetInputCard.tsx:120` and the
convention documented at `ActiveWorkoutNew.tsx:884`.

---

# What a static read cannot determine

Explicitly listed, because a file cannot measure a finger.

1. **Whether the completion haptic and the spark burst land on the same frame.** The visual fires at
   `SlideToComplete.tsx:215-234` inside a GSAP timeline; the haptic is dispatched by the
   `COMPLETE_SET` reducer in `WorkoutProvider` (per the comment at `:98-100`). Two systems, one
   moment. Only a device recording can confirm alignment. This is the one principle-8 risk in the
   app and it is invisible to grep.
2. **Actual `navigator.vibrate` latency.** `triggerHaptic` / `triggerHapticEffect`
   (`src/utils/haptics.ts`) were not read for their implementation. On iOS Safari the Vibration API
   is unavailable at all, so the haptic layer may be a no-op on the app's primary platform —
   unverified.
3. **Whether the re-grab jump at `SlideToComplete.tsx:261` is perceptible.** The 280ms window is
   short. The bug is structurally certain; its *severity* needs a real thumb interrupting a
   real snap-back.
4. **Whether `dragElastic: 0.5` reads as "broken" or merely "heavy"** on the four bypass sheets.
   Half-speed tracking is a definite principle-3 violation, but users may read it as weight rather
   than as wrongness. Needs a side-by-side against the canonical sheet.
5. **Frame rate under load.** GSAP fling + 12-particle `fireSparks` burst + React re-render at set
   completion, on a mid-range Android, is a profiler question. `will-change` is scoped correctly at
   `components.css:1660-1663` (hover/fine-pointer only), which is a good sign, but not a
   measurement.
6. **Whether `MIN_DX = 70` / `MAX_DURATION = 400` (`useSwipeNavigation.ts:13-15`) are tuned or
   guessed.** With no continuous feedback the user gets no signal about how far is far enough, so
   the miss rate is unknowable without instrumentation.
7. **Real RTL rendering.** The sign-flips at `SlideToComplete.tsx:278` and
   `useSwipeNavigation.ts:83-84` are correct on paper. `NumpadOverlay.tsx:598` and the four bypass
   sheets use `fixed bottom-0 left-0 right-0` — physical properties, but symmetric (both edges
   pinned), so no visual defect follows; they are a lint/convention issue, not a bug. Actual bidi
   behaviour of mixed Hebrew + digits + Latin needs a browser.
8. **Whether `prefers-reduced-transparency` actually fires.** The CSS is present and correct at
   `components.css:1496`; whether the target browsers honour it, and whether the resulting opaque
   surfaces still pass contrast, needs a device with the OS setting on.
