# THEME AXES PROBE — `high-contrast`, `large-text`, `reduce-motion`, `prefers-contrast`

**Status:** read-only audit. No product code, config, test or gate was touched. No browser, no build,
no dev server was run.
**Date:** 2026-08-28
**Scope:** the theme axes that are NOT light/dark, which no previous batch has measured.

---

## 0. METHOD (read this before trusting a number)

Two earlier audit documents in this repo were later found to carry wrong numbers that other workers
trusted. So: here is exactly how every figure below was produced, so it can be re-derived and
falsified.

**Contrast ratio — WCAG 2.1 / 2.2, §1.4.3 + §1.4.11:**

```
for each channel c in {R,G,B} as 0..255:
    s = c / 255
    lin = s / 12.92                     if s <= 0.03928
    lin = ((s + 0.055) / 1.055) ^ 2.4   otherwise
L     = 0.2126*Rlin + 0.7152*Glin + 0.0722*Blin
ratio = (Lbrighter + 0.05) / (Ldarker + 0.05)
```

**`color-mix(in srgb, A p%, B)`** was computed as linear interpolation of the *gamma-encoded* 0–255
channels (that is what `in srgb` means — non-linear sRGB), then luminance taken from the resulting
hex.

**Every ratio below names the two surfaces it is measured between.** A fill-vs-fill ratio is a
§1.4.11 non-text figure (floor 3:1) — it is NOT a text figure and must not be compared to 4.5:1.
A text ratio is ink-on-its-own-fill (floor 4.5:1 for body, 3:1 for ≥18.66px bold).

**Method self-check (this is the part that makes the rest checkable).** I re-derived three numbers
that this codebase already asserts in its own comments, using the formula above, before computing
anything new:

| Existing claim in repo | Where | My derivation | Match |
| --- | --- | --- | --- |
| `#318d78` has L = 0.2106 | `src/components/ui/SettingsToggle.tsx` (comment above `TRACK_CHECKED_DARK`) | L = 0.210572 | ✅ |
| ON knob `--fs-surface` vs `#318d78` = 4.69:1 (dark) | same comment | (0.260572)/(0.055605) = 4.686 | ✅ |
| `--nav-pill-text` on `--nav-pill-bg` = 15.12:1 (light) | `src/styles/components.css:1138` comment | #fff on #16292d = 1.05/0.069454 = 15.12 | ✅ |

Three independent hits. The formula I am using is the same one the previous batches used, so my
numbers are comparable to theirs rather than a different scale.

**What is NOT measured.** Everything below is a *derivation from source*: resolved token values
computed by hand from the CSS cascade. **Nothing here was rendered in a browser or sampled from a
real pixel.** Anything that depends on runtime composition — `backdrop-filter` output, alpha
compositing of translucent nav over scrolled content, `env(safe-area-*)`, actual reflow/clipping at
390px — is explicitly marked **UNVERIFIED** and must be confirmed visually before anyone acts on it.
Where I say "invisible", I mean "computes below the 3:1 §1.4.11 floor", not "I looked at it".

---

## 1. COMPOSITION — do the axes stack or replace?

### 1.1 The answer: **THEY STACK.** `html.dark.high-contrast` is a real, reachable state.

This is settled by source, not inferred.

**Evidence A — the toggler writes them as four independent classes on the same element:**

`src/contexts/SettingsContext.tsx:194-203`

```ts
document.documentElement.classList.toggle('reduce-motion', settings.workoutSettings.reducedAnimations);
document.documentElement.classList.toggle('high-contrast', settings.workoutSettings.highContrast);
document.documentElement.classList.toggle('large-text',    settings.workoutSettings.largeText);
document.documentElement.classList.toggle('dark',          settings.darkMode);
```

Four separate `classList.toggle` calls, four separate booleans, no mutual exclusion anywhere. `dark`
comes from `settings.darkMode`; `high-contrast` comes from `settings.workoutSettings.highContrast`.
Nothing clears one when the other is set. **All four can be on simultaneously**, i.e.
`<html class="dark high-contrast large-text reduce-motion">` is reachable.

**Evidence B — the CSS blocks are same-specificity siblings, so the later one wins per-token:**

| Selector | File:line | Specificity |
| --- | --- | --- |
| `:root` | `src/styles/tokens.css:12` (and 203, 258, 278, 303, …) | (0,0,0) + element |
| `html.large-text` | `src/styles/tokens.css:250` | (0,1,0) |
| `html.dark` | `src/styles/tokens.css:381` | (0,1,0) |
| `html.high-contrast` | `src/styles/tokens.css:587` | (0,1,0) |

`html.dark` (381) and `html.high-contrast` (587) have **identical specificity**, and there is **no
`html.dark.high-contrast` selector anywhere in the repo**. So the cascade resolves by source order,
and 587 > 381:

> **For any token declared in BOTH blocks, `high-contrast` wins.
> For any token declared in `dark` but NOT in `high-contrast`, the DARK value survives.
> For any token declared in neither, the `:root` (light) value survives.**

That third line is where the danger lives, and §2 enumerates it.

**Evidence C — the propagation mechanism (why this is not just a list of overrides).**
`html.high-contrast` overrides *primitive* tokens (`--fs-bg`, `--fs-surface`, `--fs-ink`, `--fs-accent`).
Most semantic tokens are `var()` **aliases** (`--color-surface: var(--fs-surface)`), and `var()` is
resolved at use time against the winning declaration — so HC propagates into them automatically,
in both light and dark. **The asymmetries all come from the same single cause:** tokens whose value
is a *literal* hex/rgba rather than an alias. A literal cannot be reached by an axis that does not
name it explicitly. Every finding in §3 is one instance of that.

### 1.2 Where each class is toggled (the real sites)

| Axis | Class | App-level toggle (settings UI) | Second, competing writer | OS media query |
| --- | --- | --- | --- | --- |
| Dark | `dark` | `src/pages/settings/sections/ThemeSection.tsx:23-26` (`מצב כהה`) | — | `prefers-color-scheme` used only as the *initial default*, `src/contexts/SettingsContext.tsx:105-112` |
| High contrast | `high-contrast` | `ThemeSection.tsx:36-38` (`ניגודיות גבוהה`) **and** `src/components/workout/overlays/WorkoutSettingsOverlay.tsx:450-451` | ⚠️ `src/components/workout/hooks/useWorkoutSettings.ts:406-409` | `@media (prefers-contrast: more)` — a *different, smaller* rule set, `src/styles/components.css:1523` and `src/components/workout/exercise-library.css:1014` |
| Large text | `large-text` | `ThemeSection.tsx:32-34` (`טקסט גדול`) **and** `WorkoutSettingsOverlay.tsx:444-445` | ⚠️ `useWorkoutSettings.ts:399-403` writes `--font-scale` instead | none |
| Reduce motion | `reduce-motion` | `ThemeSection.tsx:28-30` (`הפחתת אנימציות`) | ⚠️ `useWorkoutSettings.ts:392-397` | `@media (prefers-reduced-motion: reduce)`, many sites |

**No axis is dead.** All four have a reachable, labelled Hebrew switch in
`src/pages/settings/sections/ThemeSection.tsx`, and `high-contrast` / `large-text` have a *second*
switch inside the in-workout settings overlay. The `tokens.css:581-584` comment ("`high-contrast`
had a class and a UI switch but no token block") describes the state **before** the block at 587 was
added; that comment is now historical, not current. Nothing here is dead code.

### 1.3 ⚠️ A second, conflicting writer of the same classes (derived from source — UNVERIFIED at runtime)

`src/components/workout/hooks/useWorkoutSettings.ts:387-418` defines `useAccessibilitySettings()`,
which independently `classList.add`/`remove`s `reduce-motion` and `high-contrast` — and, critically,
**removes both in its cleanup on unmount**:

```ts
return () => {
  document.documentElement.classList.remove('reduce-motion');
  document.documentElement.classList.remove('high-contrast');
  document.documentElement.style.removeProperty('--font-scale');
};
```

It is live: `src/components/workout/ActiveWorkoutNew.tsx:35,336` calls it.

Consequence I can derive but not measure: `SettingsContext`'s effect has the dependency array
`[highContrast, largeText, reducedAnimations, darkMode]`. When `ActiveWorkoutNew` unmounts (user
leaves the active-workout screen), the cleanup strips `high-contrast` and `reduce-motion` from
`<html>`, but none of those four dependencies changed, so **SettingsContext's effect does not re-run
and does not put the classes back.** Predicted behaviour: entering and leaving a workout silently
turns high-contrast and reduced-motion OFF for the rest of the session, while the settings screen
still shows both switches ON. **UNVERIFIED — needs a browser to confirm.** It is a two-line
reproduction if true (toggle HC on → start a workout → exit → observe `<html>` class list).

Related, same file: `--font-scale` is written (`1.2` / `1`) at `useWorkoutSettings.ts:399-403` and
**consumed by nothing**. Grep for `font-scale` across `src/` returns only those three write sites in
that one file — zero CSS readers. That custom property is dead weight: the in-workout "large text"
path sets a variable no stylesheet reads, while the *class* path (`html.large-text`) is what actually
does the work.

---

## 2. TOKEN-BY-TOKEN: what each axis overrides

### 2.1 `html.large-text` (`tokens.css:250-252`)

Overrides **exactly one** declaration — and it is not a token:

```css
html.large-text { font-size: 1.125rem; }   /* root 16px → 18px, +12.5% */
```

Zero design tokens are redefined. See §4 for what that actually does and does not scale.

### 2.2 `html.high-contrast` (`tokens.css:587-621`) — the complete override set

25 declarations. Resolved values are **identical in light+HC and dark+HC** for all of these, because
HC is the last writer:

| Token | `:root` (light) | `html.dark` | `html.high-contrast` |
| --- | --- | --- | --- |
| `--fs-bg` | `#eef3f1` | `#000000` | `#000000` |
| `--fs-surface` | `#ffffff` | `#111111` | `#000000` |
| `--fs-surface-2` | `#dbe6e3` | `#262626` | `#111111` |
| `--fs-ink` | `#132327` | `#f0f0f0` | `#ffffff` |
| `--fs-muted` | `#4d5c5a` | `#a3a3a3` | `#f2f2f2` |
| `--fs-heading` | `var(--fs-primary)` | `var(--fs-ink)` | `#ffffff` |
| `--color-border` | `rgba(19,35,39,.12)` | `rgba(255,255,255,.1)` | `#ffffff` |
| `--color-border-strong` | `var(--fs-primary)` | `rgba(255,255,255,.26)` | `#ffffff` |
| `--color-separator` | `var(--fs-surface-2)` | `#1a1a1a` | `#ffffff` |
| `--fs-accent` | `#43c7a5` | `#4ddcbb` | `#8efad8` |
| `--color-accent` | `var(--fs-accent)` | `var(--fs-accent)` | `#8efad8` |
| `--color-secondary` | `var(--fs-accent)` | `var(--fs-accent)` | `#8efad8` |
| `--color-success` / `-fg` | `#2f8f58` | `#34d98c` | `#7cf0a8` |
| `--color-error` / `-fg` | `#b83228` | `#ff5449` | `#ff8a80` |
| `--fs-error` | `#d23f3f` | `#f07070` | `#ff8a80` |
| `--color-warning`, `--fs-warn` | `#e26e3f` | `#ff8a65` | `#ffc06b` |
| `--color-ink-on-accent` | `#071412` | `#071412` | `#000000` |
| `--color-ink-on-error` | `#ffffff` | `#071412` | `#000000` |
| `--fs-body-overlay`, `--fs-grid-line`, `--fs-mesh-accent`, `--fs-mesh-signal` | transparent | transparent | transparent (no-op) |

Plus two rule blocks (not tokens): `tokens.css:624-632` de-translucifies
`.glass / .glass-strong / .glass-subtle / .glass-nav`, and `tokens.css:634-637` kills
`.ambient-mesh*` background images. See finding **H-4** — the first list targets almost nothing real.

### 2.3 ⛔ THE GAP LIST — overridden by `dark` (or hard-coded in `:root`) but **NOT** by `high-contrast`

This is the section that decides whether fourteen batches of dark-mode work still holds. Each row is
a token a fix could have been made against, which `high-contrast` cannot reach.

| Token | Resolved in **light + HC** | Resolved in **dark + HC** | Why it matters |
| --- | --- | --- | --- |
| **`--fs-primary`** | **`#16292d`** (navy) | `#0a0a0a` | ⛔ **The single most damaging gap.** It is the non-inverting token that batches 1–14 spent their effort *migrating away from*. HC does not touch it, and in light it stays navy while every surface goes pure black. |
| **`--nav-pill-bg`** | `var(--fs-primary)` → **`#16292d`** | `var(--fs-accent)` → `#8efad8` | ⛔ The selected-state fill for active tab, active chip, trained day cell, nav pill. Light+HC = near-black on black. |
| `--nav-pill-text` | `var(--color-ink-on-dark)` → `#ffffff` | `var(--color-ink-on-accent)` → `#000000` | Follows correctly; only the *fill* breaks. |
| **`--btn-primary-bg`** | `var(--fs-primary)` → **`#16292d`** | `var(--fs-accent)` → `#8efad8` | ⛔ Primary CTA fill. |
| `--btn-primary-text` | `var(--fs-accent)` → `#8efad8` | `#071412` (literal) | Light follows HC, dark does not — asymmetric but both legible. |
| **`--btn-primary-bg-hover`** | `var(--navy-deep)` → **`#0d1a1c`** | `#42bda1` (literal) | ⛔ Pressed state; neither value is HC-aware. |
| `--color-primary`, `--color-primary-hover` | `#16292d` / `#0d1a1c` | `#0a0a0a` / `#050505` | Not HC-aware. |
| **`--fs-link`** | **`#1d6575`** (literal) | `var(--fs-accent)` → `#8efad8` | ⛔ Light+HC link text on a black surface — see **H-5**. |
| **`--color-surface-hover`** | **`#f0f5f3`** (literal) | `#222222` | ⛔ Near-white hover flash on a pure-black surface in light+HC. |
| `--color-surface-input` | `var(--fs-surface)` → `#000000` | `#0a0a0a` (literal) | Dark keeps `#0a0a0a` on a `#000` page — input boundary 1.02:1 unless bordered. |
| **`--fs-plate`** | **`#d7e0de`** (literal) | `#1a1a1a` | ⛔ Used in the rest-day mix; inverts the week-strip polarity in light+HC — see **H-3**. |
| `--fs-steel` | `#b9c8c6` | `#2a2a2a` | Light stays a pale grey on black. |
| **`--nav-bg`** | **`rgba(255,255,255,.78)`** | `rgba(17,17,17,.86)` | ⛔ Bottom nav ignores HC entirely — a white translucent bar over a black app. See **H-4**. |
| `--nav-icon-inactive`, `--nav-label-inactive` | `rgba(19,35,39,.6/.66)` | `rgba(240,240,240,.62/.68)` | Consistent with `--nav-bg` in each theme, so the nav is internally coherent — just not black in light+HC. |
| `--color-toggle-on` | `#34c759` | `#34d98c` | Not HC-aware (no `.toggle-switch` contrast claim was in scope). |
| `--fs-toggle-knob` | `#ffffff` | `#ffffff` | Fine on either. |
| `--color-ink-on-dark` | `#ffffff` | `#f0f0f0` | Fine. |
| `--color-scrim` | `rgba(13,21,22,.6)` | `rgba(0,0,0,.8)` | Not HC-aware; a 60% scrim in light+HC over black content is a weak modal separation. **UNVERIFIED** (compositing). |
| `--elevation-*`, `--shadow-*` | light shadow set | dark shadow set | HC does not flatten shadows. Shadows on pure black carry no information — cosmetic, not a defect. |
| `--gray-100…900`, `--label-secondary/-tertiary` | light ramp | dark ramp | In light+HC the grey ramp stays *light* on a black page. Any surface still painted from `--gray-*` will be a pale block. **UNVERIFIED** — I did not enumerate `--gray-*` call sites. |
| `TRACK_CHECKED_DARK = '#318d78'` | n/a | `#318d78` | ⚠️ Not a token at all — a hard-coded hex in `src/components/ui/SettingsToggle.tsx:71`. **No theme axis can ever reach it.** |

---

## 3. RE-CHECK OF THE SURFACES THIS CREW ALREADY "FIXED", UNDER HIGH-CONTRAST

Headline, and it is counterintuitive:

> **`dark + high-contrast` is fine — every surface below holds or improves.
> `light + high-contrast` re-breaks the exact surfaces batches 1–14 fixed, by the identical
> mechanism (`--fs-primary` does not invert), with polarity flipped to the other theme.**

Resolved base values used throughout: HC surfaces `--fs-surface = #000000` (L=0),
`--fs-surface-2 = #111111` (L=0.005605), `--fs-ink = #ffffff` (L=1.0),
`--fs-muted = #f2f2f2` (L=0.887917), `--fs-accent = #8efad8` (L=0.790822),
light-only `--fs-primary = #16292d` (L=0.019454), `--navy-deep = #0d1a1c` (L=0.009084),
`--fs-plate` light `#d7e0de`, dark `#1a1a1a`.

### H-1 — Active tab (`components.css:1138`) and active filter chip (`components.css:626`)

Both rules paint `background: var(--nav-pill-bg); color: var(--nav-pill-text)`.
Active tab sits inside `.tab-row` whose track is `--fs-surface-2`; the chip sits on a card
(`--fs-surface`).

| Measurement (surfaces named) | light + HC | dark + HC | Floor | Verdict |
| --- | --- | --- | --- | --- |
| Active-tab fill vs `.tab-row` track (`#111111`) | **1.25:1** | 15.12:1 | 3:1 (§1.4.11) | ⛔ light fails |
| Active-tab ink on its own fill | 15.12:1 | 16.82:1 | 4.5:1 | ✅ both |
| Inactive tab label (`--fs-muted #f2f2f2`) on track | 16.87:1 | 16.87:1 | 4.5:1 | ✅ |
| Active chip fill vs card (`#000000`) | **1.39:1** | 16.82:1 | 3:1 | ⛔ light fails |

**Severity: high.** In light+HC the selected tab is a `#16292d` pill on a `#111111` track — 1.25:1,
i.e. the pill shape is not there. The *label* is still readable (white, 15.12:1) but the inactive
labels are `#f2f2f2` on the same near-black track at 16.87:1, so active and inactive are both "light
text on near-black" and the only surviving difference is `font-weight: 600` vs `500`. **This is
literally the defect the comment at `components.css:1130-1137` documents having fixed for dark
("1.31:1 against its own track… the selected tab was invisible in the theme the app is used in") —
reproduced in light by the HC axis.**

### H-2 — Primary button, including pressed (`src/components/ui/Button.tsx:65-67`)

`bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] active:bg-[var(--btn-primary-bg-hover)]`.
No border on the primary variant.

| Measurement | light + HC | dark + HC | Floor | Verdict |
| --- | --- | --- | --- | --- |
| Resting fill vs page (`#000000`) | **1.39:1** | 16.82:1 | 3:1 | ⛔ light fails |
| Label on resting fill | 12.11:1 (`#8efad8` on `#16292d`) | 15.04:1 (`#071412` on `#8efad8`) | 4.5:1 | ✅ both |
| Pressed fill vs page | **1.18:1** | 9.03:1 | 3:1 | ⛔ light fails |
| Pressed fill vs resting fill (state change) | **1.18:1** | 1.86:1 | ~3:1 desirable | ⛔ light; ⚠️ dark marginal |
| Label on pressed fill | 14.23:1 | 8.08:1 | 4.5:1 | ✅ both |

**Severity: high.** In light+HC the CTA has no visible boundary — it reads as floating mint text on
black with no button behind it, and pressing it changes nothing perceptible (1.18:1). The text is
never illegible, so this is a §1.4.11 boundary/state failure, not a §1.4.3 text failure. Be precise
about that when writing the fix ticket.

### H-3 — Home week strip, three day-cell states (`components.css:1147`, `1190`, `.rest`, `.done.perfect-week`)

Empty = `color-mix(in srgb, var(--fs-surface-2) 55%, var(--fs-surface))` → `#111111`×0.55 over
`#000000` → **`#090909`** (L=0.002838) in both HC modes.
Rest = `color-mix(in srgb, var(--nav-pill-bg) 46%, var(--fs-plate))`.

| Pair | light + HC | dark + HC | Floor | Verdict |
| --- | --- | --- | --- | --- |
| Trained (`.done`) vs Empty | **1.31:1** | 15.91:1 | 3:1 | ⛔ light fails |
| Rest vs Empty | 5.69:1 | 4.47:1 | 3:1 | ✅ both |
| Trained vs Rest | 4.33:1 | 3.56:1 | 3:1 | ✅ both |
| Rest dashed border (`--fs-ink #ffffff`) vs rest fill | 3.49:1 | 5.65:1 | 3:1 | ✅ both |

Resolved rest fill: light+HC `#16292d`×0.46 over `#d7e0de` → **`#7e8c8d`** (L=0.250638);
dark+HC `#8efad8`×0.46 over `#1a1a1a` → **`#4f8171`** (L=0.185927).

**Severity: high, and worse than the bare ratio suggests — the polarity inverts.** In light+HC the
trained day is `#16292d` (L=0.019) and the *rest* day is `#7e8c8d` (L=0.251), because `--fs-plate`
stays a pale `#d7e0de`. So the row reads: black board, near-invisible trained cells, and the
**rest day as the brightest, most "earned"-looking cell in the week.** All three pairwise ratios
except trained-vs-empty still clear 3:1, so an automated pairwise check would pass this while the
meaning is backwards. Worth naming explicitly in the ticket: *luminance ordering*, not just contrast.

`.day-cell.done.perfect-week` uses `--fs-accent` → `#8efad8` in both HC modes → 16.82:1 vs empty. ✅
That state is fine, which makes the inversion stranger: a perfect week is bright, a single trained
day is invisible.

### H-4 — Bottom nav and the glass classes

`src/components/ui/BottomNav.tsx:521-526` styles the bar with **inline**
`background: var(--nav-bg)` + inline `backdropFilter: 'saturate(180%) blur(20px)'`. It carries **no
`.glass-nav` class**.

And the HC de-translucency rule at `tokens.css:624-632` targets
`.glass, .glass-strong, .glass-subtle, .glass-nav`. Grepping `src/` for those four class names in
`.tsx`/`.ts`: **zero call sites.** The classes actually used by components are `.glass-surface` (11
call sites) and `.glass-surface-dark` (4), defined at `components.css:1417` and `1424` — and neither
appears in the HC rule. (`.glass-subtle` is not even defined in CSS.)

Two consequences:

1. **The HC "make glass opaque" rule matches nothing that renders.** By contrast the OS-level
   `@media (prefers-reduced-transparency: reduce)` block at `components.css:1493-1517` *does* list
   `.glass-surface` and `.glass-surface-dark` — so the OS path is more complete than the app's own
   toggle. (Mitigating: `.glass-surface`/`.glass-surface-dark` are already opaque
   `background: var(--fs-surface)` with no `backdrop-filter`, so there is little left to fix there.
   The gap is real but its blast radius is small.)
2. **The bottom nav ignores `high-contrast` completely.** In light+HC `--nav-bg` stays
   `rgba(255,255,255,0.78)` with a live 20px blur: a translucent **white** bar under a pure-black
   app. Its own contents stay internally consistent (dark inactive icons on white, navy pill with
   white ink), so this is a coherence/blur defect rather than a measured contrast failure.
   **UNVERIFIED** — the composited result depends on what scrolls under it and cannot be computed
   from the cascade. Needs a screenshot at 390px.

**Severity: medium** (H-4.1 low, H-4.2 medium).

### H-5 — Link text in light + HC

`--fs-link` is a literal `#1d6575` in `:root` and is not overridden by HC.
`#1d6575` (L=0.108561) on `--fs-surface #000000`: **3.17:1** — fails §1.4.3 body text (4.5:1).
In dark+HC `--fs-link: var(--fs-accent)` → `#8efad8` on `#000` = **16.82:1** ✅.

**Severity: high.** The token's own comment (`tokens.css:23-26`) explains it was darkened
specifically to clear AA "on every light surface (#fff / #eef3f1 / #dbe6e3)". HC introduces a fourth
light-mode surface — `#000000` — that the comment's premise never contemplated.

### H-6 — Settings toggle track and knob (`src/components/ui/SettingsToggle.tsx`)

Track: `trackBackground(checked, isDark)` → OFF `var(--fs-surface-2)`; ON `var(--fs-accent)` in
light, hard-coded `#318d78` in dark. Border `2px solid var(--fs-ink)`. Knob: `var(--fs-ink)` when
OFF, `var(--fs-surface)` when ON. `useIsDarkTheme` observes only the `dark` class, so HC does not
change which branch is taken — correct behaviour.

| Measurement | light + HC | dark + HC | Floor | Verdict |
| --- | --- | --- | --- | --- |
| OFF track (`#111111`) vs card (`#000000`) | 1.11:1 | 1.11:1 | 3:1 | ⚠️ but see note |
| 2px border (`#ffffff`) vs card | 21:1 | 21:1 | 3:1 | ✅ carries the boundary |
| 2px border vs OFF track | 18.88:1 | 18.88:1 | 3:1 | ✅ |
| OFF knob (`#ffffff`) on OFF track | 18.88:1 | 18.88:1 | 3:1 | ✅ |
| 2px border vs **ON** track | **1.25:1** (`#fff` on `#8efad8`) | 4.03:1 (`#fff` on `#318d78`) | 3:1 | ⛔ light fails |
| ON knob (`--fs-surface #000`) on ON track | 16.82:1 | 5.21:1 | 3:1 | ✅ both |
| ON vs OFF track (state readability) | 15.12:1 | 4.69:1 | 3:1 | ✅ both |

**Severity: medium, not high.** The deliberate 2px white edge disappears on the ON track in
light+HC (1.25:1), but the control does not become unreadable: the ON fill is 15.12:1 from the OFF
fill and the black knob is 16.82:1 on it, so both the boundary *and* the state remain perceivable
through the fill and knob. The defect is that the component's stated boundary strategy silently
stops working — the fallback happens to save it.

Structural note worth a ticket of its own: `TRACK_CHECKED_DARK = '#318d78'` is a hex literal in TSX
(`SettingsToggle.tsx:71`). The long comment above it derives that value as "the only viable window"
*for the dark palette*. Under HC the light branch's accent moves to `#8efad8` while the dark branch
cannot move at all. Any future axis is structurally blind to this value.

### H-7 — Route spinner (`src/AppRouter.tsx:975-985`)

`border: '2px solid var(--fs-heading)'` with `borderTopColor: transparent`, on the page surface.
HC sets `--fs-heading: #ffffff` explicitly (`tokens.css:593`).
`#ffffff` on `#000000` = **21:1** in both light+HC and dark+HC.

**✅ PASS — the only surface in this list that HC unambiguously improves.** The reasoning in the
comment there ("`--fs-heading` … inverts on purpose") happens to generalise to HC precisely because
`--fs-heading` is one of the 25 tokens HC names directly. That is the pattern to copy.

### 3.8 `@media (prefers-contrast: more)` — the OS axis

`components.css:1523-1531` bumps `border-color: var(--color-border-strong)` on
`.glass, .glass-strong, .glass-light, .glass-surface, .glass-nav, .btn-glass, .card,
.card-interactive`. `exercise-library.css:1014` does something similar for that surface.

This is a *separate* axis from `html.high-contrast` — the OS query does **not** set any of the 25 HC
tokens, and the HC class does **not** trigger the OS query. So a user who sets "Increase Contrast" at
the OS level gets firmer borders and nothing else; a user who flips the in-app switch gets the token
block and no border firming (except where `--color-border-strong` → `#ffffff` reaches it anyway).
Note this list *does* include `.glass-surface` and `.card`, so it lands on real components —
unlike the HC rule in H-4.1. **The two contrast axes are not unified.** Low severity, but it is why
"high contrast" behaves differently depending on where the user turned it on.

---

## 4. `large-text` — what it actually scales, and the real failure mode

`html.large-text { font-size: 1.125rem }` (`tokens.css:250`) raises the root font size 16px → 18px
(**+12.5%**). `body` (`global.css:29-37`) sets no `font-size`, so it inherits. That is the entire
mechanism — no token is redefined.

### What scales

| Scales (+12.5%) | Does NOT scale |
| --- | --- |
| Tailwind named font sizes — the whole `fontSize` scale in `tailwind.config.js:100-119` is **rem** (`sm: 0.8125rem`, `base: 0.9375rem`, `title: 1.25rem`, `display: 2.25rem`…), so every `text-sm` / `text-base` / `text-lg` / `text-title` / `text-display*` grows. 93 such usages across 22 files. | The design-token type scale: **all 12 `--text-*` tokens are px** (`tokens.css:218-229`: `--text-body: 15px`, `--text-label: 11px`, …). |
| Tailwind's *default* spacing/sizing scale (`h-11`, `p-4`, `gap-2` = rem) — so padding and box heights grow with the text. | Arbitrary Tailwind px values: `text-[10px]`, `text-[17px]`, `h-[52px]` — 25 `text-[Npx]` usages across 11 files. |
| Any element with no explicit `font-size` (e.g. `.day-cell`, `components.css:1147`, which sets family/weight but no size). | **Essentially all of the project's own CSS.** `grep` for rem in `src/**/*.css` returns **9 matches total** (7 in `global.css`, 1 in `components.css:87`, 1 being the `large-text` rule itself). Everything else — font sizes, paddings, `min-height`, `--nav-height: 64px`, `--max-width: 480px`, `--space-*`, `--radius-*` — is px. |
| Tailwind `borderRadius` is overridden to **px** in config, so corners do not grow. | |

### The failure mode worth naming: **inconsistent scaling, not clipping**

I looked for the clip case specifically and could not find one:

- `.tab-row .tab` (`components.css:1112-1126`) — `min-height: 40px` + `font-size: 13px`. Both fixed;
  `min-height` grows if needed anyway. No clip.
- `.day-cell` (`components.css:1147`) — `min-height: 48px`, `display: grid`, `place-items: center`,
  **no `font-size`** → its digits DO scale 16→18px, and `min-height` lets the cell grow. No clip.
- `SettingsToggle` (`SettingsToggle.tsx:118-131`) — `minWidth/minHeight: '44px'` inline, inner track
  a fixed `52×32px`. Nothing scales, nothing clips; the touch target simply stops growing while the
  row's label grows around it. The 44px AA target is preserved (it is a floor, not a ceiling).
- `Button` editorial variant (`Button.tsx:154-158`, `299`) — `h-[52px]` paired with `text-[17px]` and
  `minHeight: 52`. Both fixed → immune to `large-text` in both directions.
- `.chip-fs` (`components.css:600-613`) — `padding: 6px 14px` + `font-size: 10px`, both px → immune.
- Grep for the dangerous same-element combination (`h-[Npx]` together with a named `text-*`) across
  all `.tsx`: **zero matches.**

So the honest finding is the opposite of the expected one:

> **`large-text` is largely inert for this app's own typography.** Because the token type scale and
> every CSS-file font size are px, flipping `טקסט גדול` grows only the subset of text styled with
> Tailwind's named sizes — and it grows Tailwind's rem paddings and heights along with it, which is
> why nothing clips. A user who needs bigger text gets a partial, patchy 12.5% increase: two labels
> in the same row can end up scaling differently depending on whether the author reached for
> `text-sm` or `text-[13px]`. The bottom nav (`--nav-height: 64px` + `text-[10px]`) does not change
> at all.

**UNVERIFIED:** I did not render this. "Nothing clips" is a static conclusion from the fact that px
containers hold px text and rem containers hold rem text. A browser pass at 390px with `large-text`
on is still required, particularly for RTL Hebrew line-wrapping in fixed-`min-height` rows and for
any `overflow: hidden` + `line-clamp` combination I did not enumerate.

`reduce-motion` is implemented as a real class selector (`motion.css:361-368` kills
transitions/animations globally; `exercise-library.css:993` handles one press state) and is
additionally mirrored by `@media (prefers-reduced-motion: reduce)` in many components. Not audited
further — out of scope, and no contrast surface depends on it.

---

## 5. VERDICT

> ### PARTIALLY SAFE.
> **The fourteen batches of dark-mode token work survive `dark + high-contrast` intact — every
> re-checked surface holds or improves. They do NOT survive `light + high-contrast`, which
> re-creates the exact class of defect those batches eliminated, in the other theme, through the
> same token (`--fs-primary`) and the same mechanism (a token that does not participate in the
> active axis).**

Why, in one sentence: `html.high-contrast` repaints the *surfaces* to pure black in both themes but
never touches `--fs-primary`, so in light mode every selected-state and CTA fill stays navy on black
at 1.2–1.4:1.

Secondary structural verdict: **no axis is dead** (all four have reachable Hebrew switches in
`ThemeSection.tsx`), but two axes have **duplicate, conflicting writers** — `useAccessibilitySettings`
removes classes `SettingsContext` owns, and writes a `--font-scale` variable no stylesheet reads.

### Prioritized work, grouped for file-exclusive tasks

Each group touches a disjoint file set, so these can be handed out in parallel without collision.

**P0 — Group A: make `high-contrast` reach the selected-state and CTA fills.**
Files: `src/styles/tokens.css` only.
Add to the `html.high-contrast` block (587-621) the tokens in the §2.3 gap list that carry
selection/action fills — at minimum `--fs-primary`, `--nav-pill-bg`, `--btn-primary-bg`,
`--btn-primary-bg-hover`, `--fs-link`, `--color-surface-hover`, `--fs-plate`, `--nav-bg`. Fixes
H-1, H-2, H-3, H-5 and the light half of H-6 in one edit, because every one of those surfaces
resolves through those tokens. Re-derive the ratios afterwards against `#000000` / `#111111`.
Note the ordering requirement from H-3: the trained day must end up *brighter* than the rest day,
not merely 3:1 away from it.

**P0 — Group B: single owner for the `<html>` accessibility classes.**
Files: `src/components/workout/hooks/useWorkoutSettings.ts` (+ its call site
`src/components/workout/ActiveWorkoutNew.tsx`).
Stop `useAccessibilitySettings` writing/removing `reduce-motion` and `high-contrast`, and drop the
dead `--font-scale`. Leave `SettingsContext` as the only writer. Verify the §1.3 prediction in a
browser first — if it reproduces, it is a P0 on its own, since it silently disables the accessibility
mode the user asked for.

**P1 — Group C: de-translucency list points at nothing.**
Files: `src/styles/tokens.css` (rule at 624-632).
Replace `.glass-subtle` / `.glass-nav` / `.glass-strong` with the class names that actually render
(`.glass-surface`, `.glass-surface-dark`), mirroring the already-correct list in the
`prefers-reduced-transparency` block at `components.css:1493`. Low blast radius (those classes are
already opaque) but the rule is currently a no-op.

**P1 — Group D: unify the two contrast axes.**
Files: `src/styles/components.css` (1523) and `src/components/workout/exercise-library.css` (1014).
Make `@media (prefers-contrast: more)` and `html.high-contrast` produce the same result — either by
having the media query add the class's token block, or by having the class adopt the border firming.
Today the user gets a different app depending on where they turned "high contrast" on.

**P2 — Group E: get the hard-coded hex out of the toggle.**
Files: `src/components/ui/SettingsToggle.tsx`.
`TRACK_CHECKED_DARK = '#318d78'` is unreachable by any theme axis. Promote it to a token
(e.g. `--toggle-track-on`) defined per axis in `tokens.css`, so HC can move it. Sequence this
**after** Group A, since Group A changes what the light branch resolves to.

**P2 — Group F: make `large-text` mean something.**
Files: `src/styles/tokens.css` (the `--text-*` scale).
Convert the 12 `--text-*` tokens from px to rem so the design-token type scale participates in
`large-text`. This is a wide visual change and must be gated on a screenshot pass at 390px — it is
the one item here that can plausibly introduce clipping where none exists today.

**Verification gate for all of the above (not yet run — out of scope for this probe):** a browser
pass at 390px and desktop across the four reachable combinations — light, dark, light+HC, dark+HC —
plus `large-text` on each. Every number in §3 is a hand derivation from the cascade and should be
re-sampled from real pixels before anyone reports these surfaces as fixed.

---

## 6. WHAT THIS PROBE DID NOT COVER

- No browser, no build, no gates (`npm run verify` / `test:run` / `test:e2e` / `db:test`), per the
  read-only brief. Nothing here is a rendered measurement.
- Alpha compositing: `--nav-bg`, `--color-scrim`, `--fs-overlay-*`, `--color-border` in dark, and all
  `backdrop-filter` output. Not computable from the cascade.
- `--gray-100…900` and `--label-secondary/-tertiary` call sites under light+HC were not enumerated.
  The ramp keeps light values on a black page, so there may be additional pale-block surfaces I did
  not find.
- `reduce-motion` beyond confirming it is implemented and reachable.
- The `oledMode` and `selectedTheme` (`'deepCosmos'`) settings in `WorkoutSettings` — a possible
  fifth and sixth theme axis. Both appear in the settings type and defaults; I did not trace whether
  either reaches CSS. Flagged as unexamined.
- Whether the in-workout HC/large-text toggles in `WorkoutSettingsOverlay.tsx:444-451` persist to the
  same `appSettings` localStorage key that `SettingsContext` reads. Both stores *read* `'appSettings'`
  (`SettingsContext.tsx:117`, `WorkoutProvider.tsx:113`), but the workout reducer persists to
  `'active_workout_v3_state'` (`WorkoutProvider.tsx:33`), so an in-workout toggle may not survive to
  the settings screen. Derived, not verified.
