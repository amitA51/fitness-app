# Shared-primitive copies — full sweep

Read-only audit. No build, server, test, Playwright or git command was run.

## Total: 17 copy sites

- **2** where a user sees a **wrong state** (both are switches).
- **15** where the defect is **cosmetic but measurable** (a stated contrast ratio, pixel
  delta or missing ARIA attribute — not "it looks inconsistent").
- **16** of the 17 duplicate a shared component that already exists and is importable.
  **1** is a peer pair with **no owner at all** (the circular avatar) — the fix there is
  extraction, not import.

Token values used for every ratio below, read from `src/styles/tokens.css`
(light / dark / high-contrast-dark):

| token | light | dark | hc-dark |
|---|---|---|---|
| `--fs-bg` | `#eef3f1` | `#000000` | `#000000` |
| `--fs-surface` | `#ffffff` | `#111111` | `#000000` |
| `--fs-surface-2` | `#dbe6e3` | `#262626` | `#111111` |
| `--fs-ink` | `#132327` | `#f0f0f0` | `#ffffff` |
| `--fs-muted` | `#4d5c5a` | `#a3a3a3` | `#f2f2f2` |
| `--fs-steel` | `#b9c8c6` | `#2a2a2a` | — |
| `--fs-accent` | `#43c7a5` | `#4ddcbb` | `#8efad8` |
| `--color-ink-on-accent` | `#071412` | `#071412` | `#000000` |

---

## The shared primitives, and what each one owns

| primitive | file:line | what it owns that a hand-roll loses |
|---|---|---|
| `SettingsToggle` | `src/components/ui/SettingsToggle.tsx:90-166` | 52×32 track inside an explicit **44×44** target (`:119-120`); `2px solid var(--fs-ink)` track edge (`:138`); per-state knob tokens (`:154`); a **dark-only** ON fill `#318d78` (`:71`, `:77-80`); `triggerHaptic`; `disabled` + `aria-disabled`; `focus-visible` accent ring |
| `IconBox` | `src/pages/settings/components/IconBox.tsx:17-32` | 32×32 tile at **`borderRadius: 12`** (`:26`) with a `tone` prop (`surface` / `accent`) |
| `Divider` | `src/pages/settings/components/Divider.tsx:7-15` | 1px `--fs-surface-2` hairline, **`marginInline: 16px`** (`:11`), **`aria-hidden="true"`** (`:10`) |
| `SettingsCard` | `src/components/ui/SettingsCard.tsx:10-14` | `Card variant="glass" asymmetric interactive noPadding className="fs-accent-rail"` → `.glass-surface` supplies background + **border** + `--shadow-glass` (see `src/components/ui/Card.tsx:49` and its comment), plus the 4px accent rail and `magnetic-card` press feedback |
| `SettingsRow` | `src/components/ui/SettingsRow.tsx:11-42` | `flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]` + trailing control slot + optional divider |
| `ActionRow` | `src/pages/settings/components/ActionRow.tsx:13-59` | icon+label button row, `minHeight: 52px`, `textAlign: start`, imports `IconBox` |
| `SegmentedControl` | `src/pages/progress/components/SegmentedControl.tsx:88-140` | `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls`, roving `tabIndex`, **RTL-aware** arrow keys, `minHeight: 44` |

There is **no shared icon-button primitive.** `src/components/ui/Button.tsx:36-56` exposes
`variant` / `size` / `shape` / `icon` / `fullWidth` but no `iconOnly` mode and no 44×44 icon
form. So the ~30 hand-rolled 44×44 icon buttons across `src/` are **NOT copies** — there is
nothing to import. Listed under NOT-A-COPY below.

---

# BATCH 1 — the inverted switch (user sees a WRONG STATE)

Files touched: `src/pages/settings/sections/ProfileEditSection.tsx`, plus a new
`src/components/ui/Avatar.tsx`.

### 1.1 — COPY · bespoke `role="switch"` (the known instance, confirmed)

- **Copy:** `src/pages/settings/sections/ProfileEditSection.tsx:423-455` — the
  `פרופיל ציבורי` control. Bare `<button role="switch">` at `:425`, 52×30 track at `:431-432`,
  hand-rolled knob at `:442-454`.
- **Shared:** `src/components/ui/SettingsToggle.tsx:90-166`.
- **What the copy gets wrong:**
  1. **The ON/OFF knob colours are inverted relative to every other switch in the app.**
     The copy paints the knob `--color-ink-on-accent` `#071412` when **ON** (`:451`).
     `SettingsToggle` paints the knob `--fs-ink` `#132327` when **OFF** (`:154`).
     Those two colours are **1.16:1** apart — visually identical, opposite meanings.
     On the Settings screen a dark knob means OFF on the `מצב כהה` / `רטט` / `תזכורת אימון`
     rows and ON on this one.
  2. **Touch target 52×30.** The 30px height is **14px under the 44px floor**;
     `SettingsToggle:119-120` wraps its identical 52px track in `minWidth/minHeight: 44px`.
  3. **No track border.** `SettingsToggle:138` carries `2px solid var(--fs-ink)`. Without it
     the OFF track (`--fs-surface-2` `#262626`) sits on the card (`--fs-surface` `#111111`) at
     **1.25:1** in dark — under the 3:1 WCAG 1.4.11 asks of a component boundary. With the
     shared border it is **16.57:1**.
  4. **Keeps the bright dark-mode accent.** `SettingsToggle:71,77-80` deliberately drops the
     ON fill to `#318d78` in dark so the ink edge clears 3:1; the copy stays on
     `--fs-accent` `#4ddcbb`.
  5. Also missing: `triggerHaptic('light')`, `disabled`/`aria-disabled`, and the
     `focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]` ring.
- **Severity: USER SEES A WRONG STATE, and the target is 14px under the floor.**
- **Verdict: COPY.** Same control (a binary settings switch), same 52px track width, same
  24px knob, re-declared. Fix by importing `SettingsToggle` and deleting the block.

### 1.2 — COPY · local `CARD_STYLE`

- **Copy:** `ProfileEditSection.tsx:30-35`.
- **Shared:** `src/components/ui/SettingsCard.tsx:10-14`.
- **Wrong:** flat opaque `--fs-surface` with no border and no shadow. In dark that is
  `#111111` on the `#000000` page — a **1.11:1** card edge, i.e. the container has no visible
  boundary. It also loses the 4px `fs-accent-rail` stripe that every neighbouring settings
  card carries, so this card reads as unrailed between railed ones.
- **Severity: COSMETIC** (no wrong state, no unreachable target) — but the boundary is
  measurably invisible in dark.
- **Verdict: COPY.** Same control (a settings section card), directly replaceable by
  `<SettingsCard>` with a 20px inner padding wrapper.

### 1.3 — COPY (peer pair, no owner) · circular avatar

- **Copy A:** `ProfileEditSection.tsx:233-276` — 64px.
- **Copy B:** `src/pages/profile/PublicProfilePage.tsx:343-392` — 96px.
- **Shared:** **none exists.** `src/components/ui/ProfileAvatar.tsx:3-52` is *not* it — see
  NOT-A-COPY below.
- **Wrong:** both re-declare the same `borderRadius: '50%'` + `background: var(--fs-accent)` +
  `color: var(--color-ink-on-accent)` + display-face-700 initials + `<UserRound>` fallback.
  The Settings copy omits `letterSpacing: '-0.02em'`, which the public copy has, so the same
  two initials render at default tracking in one place and −0.02em in the other on a display
  face the type scale always specifies tracking for.
- **Severity: COSMETIC.**
- **Verdict: COPY of each other, not of a shared component.** Fix by **extracting**
  `src/components/ui/Avatar.tsx` with a `size` prop — not by importing anything that exists
  today. Batch 6 adopts it.

---

# BATCH 2 — the second bespoke switch (user sees a WRONG STATE)

File touched: `src/components/workout/overlays/SettingsPrimitives.tsx`.

### 2.1 — COPY · `Toggle`'s switch visual

- **Copy:** `src/components/workout/overlays/SettingsPrimitives.tsx:107-133` (the switch inside
  the exported `Toggle`, `:59-135`; `role="switch"` at `:67`). Track 50×30 at `:110-111`,
  knob at `:119-132`.
- **Shared:** `src/components/ui/SettingsToggle.tsx:90-166`.
- **What the copy gets wrong:**
  1. **The knob is mirrored in RTL.** The copy positions it with physical `left: 2` (`:123`)
     and moves it with `animate={{ x: value ? 21 : 0 }}` (`:130`) — both physical. Under
     `<html dir="rtl">` (`index.html:2`) the knob therefore rests at the **physical left** when
     OFF and travels right when ON. `SettingsToggle:147` uses `insetInlineStart`, which flips,
     so every other switch in the app rests at the **right** when OFF. Two switches in the same
     app move in opposite directions for the same state change.
  2. **The OFF knob is invisible in dark.** The copy hardcodes the knob to `--fs-surface`
     in *both* states (`:127`). In dark that is `#111111` on the OFF track `#262626` —
     **1.25:1**. `SettingsToggle:154` switches the knob to `--fs-ink` when OFF: **13.28:1**.
  3. **The track outline is invisible in dark.** `border: 1px solid var(--fs-steel)` (`:114`)
     is `#2a2a2a` against its own `#262626` OFF fill — **1.05:1**. The whole OFF control is a
     featureless grey blob. `SettingsToggle:138` uses a 2px `--fs-ink` edge for exactly this.
  4. Keeps `--fs-accent` as the dark ON fill instead of the `#318d78` step at `:71`.
- **Not a defect here, checked:** the tap target is fine — the *whole row* is the button
  (`:62-72`, `padding: '14px 4px'`), so it is full-width and ≈58px tall. And reduced motion is
  covered: `src/App.tsx:23` wraps the tree in `<MotionConfig reducedMotion>` and
  `src/styles/motion.css:347-357` zeroes every `transition-duration` globally.
- **Severity: USER SEES A WRONG STATE** (direction reversed; OFF knob absent in dark).
- **Verdict: COPY.** Same control — a binary settings switch with a 24px knob on a ~50px
  track. Fix by rendering `<SettingsToggle>` inside the row and keeping the row's own
  label/description layout.

---

# BATCH 3 — the root cause: the 32px tile and the hairline (COSMETIC)

Files touched: `src/components/ui/SettingsRow.tsx`,
`src/pages/settings/components/IconBox.tsx`, `src/pages/settings/components/Divider.tsx`,
`src/pages/settings/sections/ThemeSection.tsx`.

This batch is why Batch 4 exists: five sections forked `SettingsRow` **solely** to get the
rounded tile, so fixing the tile is the prerequisite for un-forking the rows.

### 3.1 — COPY · `SettingsRow`'s own inline icon tile

- **Copy:** `src/components/ui/SettingsRow.tsx:15-21` (`w-8 h-8` at `:17`).
- **Shared:** `src/pages/settings/components/IconBox.tsx:23-30`.
- **Wrong:** identical 32×32 box and identical `--fs-surface-2` / `--fs-heading` pairing, but
  **no `borderRadius`** — 0px corners where `IconBox:26` sets **12px**, and no `tone` prop.
  This is visible in one card: `WorkoutPrefsSection.tsx` renders `IconBox` (12px, `:28-30`) on
  the rest-time row and `SettingsRow` tiles (0px, `:79`, `:91`) on the two toggle rows
  directly beneath it. Same card, two corner treatments.
- **Severity: COSMETIC.**
- **Verdict: COPY.** Same control (the decorative 32px settings-row icon tile), same tokens.
  Note the fix requires **promoting `IconBox` to `src/components/ui/`** first — a
  `components/ui` file importing from `pages/settings` would invert the layering.

### 3.2 — COPY · `SettingsRow`'s inline divider

- **Copy:** `src/components/ui/SettingsRow.tsx:37`.
- **Shared:** `src/pages/settings/components/Divider.tsx:7-15`.
- **Wrong:** byte-identical geometry (`height: 1px`, `--fs-surface-2`, `marginInline: 16px`)
  but **missing `aria-hidden="true"`**, which `Divider:10` sets — so a purely decorative 1px
  `<div>` is exposed to the accessibility tree once per settings row. `Divider`'s own docstring
  says it exists to replace exactly this literal.
- **Severity: COSMETIC** (an extra empty node per row for screen-reader users).
- **Verdict: COPY.** Same promotion caveat as 3.1.

### 3.3 — Consequence of 3.1, fix in the same batch · double-nested tile

- `src/pages/settings/sections/ThemeSection.tsx:51-95` passes `icon={<IconBox>…</IconBox>}`
  into `SettingsRow`, which wraps the `icon` prop **unconditionally** in its own tile
  (`SettingsRow.tsx:15-21`). Result: a 12px-rounded 32px `IconBox` sits inside a 0px-corner
  32px `--fs-surface-2` box of the same size, so the square corners of the outer tile show
  behind the rounded inner one at all four corners, on all four rows.
- **Not a separate copy** — it is 3.1 surfacing at a call site. Resolved by 3.1.

---

# BATCH 4 — five forked settings rows (COSMETIC) · depends on Batch 3

Files touched: `ProfileSection.tsx`, `CoachSection.tsx`, `CloudSyncSection.tsx`,
`NotificationsSection.tsx` (all under `src/pages/settings/sections/`).

All five re-declare `SettingsRow`'s class string **verbatim** —
`flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]` — and every one of them forked only
because `SettingsRow` cannot express one small thing.

| # | copy file:line | shared | why it forked | concrete defect |
|---|---|---|---|---|
| 4.1 | `ProfileSection.tsx:33-71` (`שם`) | `SettingsRow.tsx:11-42` | wants `IconBox`, not the square tile | Within **one card**, rows 1/5/6/7 show 12px-rounded tiles (this row + the three `SettingsSelect` rows) and rows 2/3/4 show 0px square tiles (`:75`, `:87`, `:99` go through `SettingsRow`). Same screen, two tile shapes. |
| 4.2 | `CoachSection.tsx:121-176` (`שם העסק`) | same | wants `IconBox` | Same 12px-vs-0px split against the `SettingsRow` calls at `:237`/`:262`. |
| 4.3 | `CoachSection.tsx:178-232` (`אודות`) | same | needs `items-start` for a textarea; `SettingsRow:14` hardcodes `items-center` | Same tile split, plus the fork re-declares the 52px min-height independently, so it will silently drift from the shared value. |
| 4.4 | `CloudSyncSection.tsx:45-89` | same | needs `IconBox tone="accent"`; `SettingsRow`'s tile has no `tone` | Same tile split; the accent tone is unreachable through the shared row. |
| 4.5 | `NotificationsSection.tsx:52-91` | same | needs a second description line; `SettingsRow` has no `description` prop | Sits directly below two real `SettingsRow`s (`:36`, `:44`) in the same card. |
| 4.6 | `NotificationsSection.tsx:54-59` (`w-8 h-8` at `:55`) | `IconBox.tsx:23-30` | — | A **third** copy of the 32px tile: `--fs-surface-2` / `--fs-heading`, **no `borderRadius`**, i.e. 0px where `IconBox:26` sets 12px. |

- **Severity: all COSMETIC.** No wrong state; every one of these rows is ≥52px so no target
  is under the 44px floor.
- **Verdict: all COPY.** Each is the same control (a settings row) re-declared. The correct
  fix is **one change to the shared component** — give `SettingsRow` an `iconTone`, an `align`
  and a `description` prop and have it render `IconBox` — then swap all five call sites.
  Forking further would be the mistake.

---

# BATCH 5 — flat cards and full-bleed hairlines (COSMETIC)

Files touched: `src/pages/settings/sections/LegalLinksSection.tsx`,
`src/pages/settings/sections/BlockedUsersSection.tsx`.

### 5.1 — COPY · `LegalLinksSection.tsx:15-20` `CARD_STYLE` → `SettingsCard.tsx:10-14`

Same three declarations as 1.2. Flat `--fs-surface`, no border, no shadow, no accent rail →
**1.11:1** card edge on the `#000000` page in dark. **COSMETIC.** **COPY.**

### 5.2 — COPY · `BlockedUsersSection.tsx:22-27` `CARD_STYLE` → `SettingsCard.tsx:10-14`

Identical to 5.1 plus `padding: 20`. Same 1.11:1 dark edge, same missing rail.
**COSMETIC.** **COPY.**

### 5.3 — COPY · `LegalLinksSection.tsx:33` `DIVIDER` → `Divider.tsx:7-15`

`{ height: 1, background: 'var(--fs-surface-2)' }` — **no `marginInline: 16px`** and no
`aria-hidden`. So this card's three hairlines run **full-bleed 0px** while every other settings
divider is inset **16px**. A 16px inset delta on one card. **COSMETIC.** **COPY.**

### 5.4 — COPY · `LegalLinksSection.tsx:64-71` (the `מעקב אנליטיקה ויציבות` row) → `SettingsRow.tsx:11-42`

This row is label + `SettingsToggle` — exactly what `SettingsRow` is for. The local
`ROW_STYLE` (`:22-31`) sets `padding: '14px 16px'` but **omits `min-h-[52px]`**; the computed
row is ≈46px (28px padding + a ~18px line box), **6px under** the height the shared row
guarantees — still above the 44px floor, so reachable. **COSMETIC.** **COPY.**

### 5.5 — NOT-A-COPY · the three `<Link>` rows at `LegalLinksSection.tsx:52-60`

They use the same `ROW_STYLE`, but `SettingsRow` renders a `<div>` and exposes no `as` / `to`
prop, and no shared link-row primitive exists. A navigation link row is a **different control**
from a label-plus-control row. Fix by pulling the geometry onto tokens if desired — not by
importing `SettingsRow`.

---

# BATCH 6 — the public profile page (COSMETIC) · adopt Batch 1's `Avatar`

File touched: `src/pages/profile/PublicProfilePage.tsx`.

### 6.1 — COPY · `PublicProfilePage.tsx:89-93` `CARD_STYLE` → `Card.tsx:33-50`

Duplicates `Card variant="elevated" asymmetric` but drops the
`border: 1px solid var(--color-border)` and `boxShadow: var(--shadow-card)` that
`Card.tsx:35-38` supplies. In dark that is `#111111` on `#000000` with no stroke — a
**1.11:1** boundary across all six uses of the constant (`:125`, `:153`, `:176`, `:346`,
`:425`). **COSMETIC.** **COPY** — note the target is `Card`, not `SettingsCard`, since this is
not a settings surface.

### 6.2 — the second half of the avatar pair (1.3)

`PublicProfilePage.tsx:343-392` adopts the `Avatar` extracted in Batch 1.

---

# NOT-A-COPY — candidates examined and rejected, with reasons

| candidate | reason it is NOT a copy |
|---|---|
| `WorkoutPrefsSection.tsx:52-72` rest-time chip vs `IconBox` | **The established precedent, re-confirmed.** They share a token pairing, but `IconBox` is a 32px decorative tile and this is a labelled pressable chip with `aria-pressed` and its own `minHeight: 44px` (`:55`). Forking `IconBox` to express a pressable control would be the actual mistake. Fix by tokens, if at all. |
| `SettingsPrimitives.tsx:386+` `TabBar` vs `SegmentedControl` | Different control: a horizontally **scrolling 5-item tab strip** with per-item borders and no trough, vs a 2-up equal-flex inline switch with a sliding shared pill. They do not even share styling. *Its own* defects are real but independent — no `role="tablist"`/`role="tab"`, no `aria-selected`, and `padding: '10px 16px'` computes to ≈38px, under the 44px floor. Fix **in place**, not by importing `SegmentedControl`. |
| `SettingsPrimitives.tsx` `ChipSelector` / `GoalSelector` / `RestTimeSelector` vs `ActionChip.tsx:15-80` | Different controls: single-select option groups inside an overlay, vs a tool button on the exercise surface. `ActionChip` is pill-shaped with a notification dot and scroll-snap; these are 12px-radius grid cells. |
| `SettingsPrimitives.tsx:360` `Divider` vs `settings/components/Divider.tsx` | Different insets by intent (`margin: '6px 0'`, full-bleed, for an overlay panel vs `marginInline: 16px` for a card row) **and** across a module boundary — `components/workout` importing from `pages/settings` would invert the layering. Not actionable until a `components/ui/Divider` exists. |
| `ProfileAvatar.tsx:3-52` | **Not the primitive and not a copy.** It is an 80px **square** initials tile on a `--fs-primary` band bundled with a name and an eyebrow — a profile header block, not a reusable avatar. It also has **zero importers** anywhere in `src/` (only its own declaration and default export), so it is dead code, and it re-implements `getInitials` inline at `:4-10` instead of importing `src/utils/getInitials`. No user sees it. |
| ~30 hand-rolled 44×44 icon buttons (`CommentSheet.tsx:63`, `GlobalToast.tsx:199`, `DateNavigator.tsx:26`, `WorkoutDetail.tsx:131`, `Dashboard.tsx:209`, `PhotoTimeline.tsx:117`, `ExerciseNav.tsx:25`, …) | **No shared icon-button primitive exists** to copy — `Button.tsx:36-56` has no `iconOnly` mode. They are also not one control: a header back chevron, a sheet close X, a stepper +/− and a toast dismiss are distinct. Building the primitive is a separate proposal, not a copy fix. |
| `ProgressBar.tsx`, `RecoveryBar.tsx`, `MacroStrip.tsx`, `AnimatedBar.tsx`, `SetProgress.tsx`, `ProgressDots.tsx`, `AnimatedProgressRing.tsx` | Seven genuinely different controls: a page-level 6px top indicator with milestone markers, a labelled value/max sub-score meter, a stacked macro strip, a chart bar, a per-set dot strip, an onboarding step counter and an SVG ring. None duplicates another's role. (Minor token drift only: `ProgressBar` anchors its fill with the `--progress-fill-origin-inline-start` token while `RecoveryBar` uses the `useIsRTL()` hook — two mechanisms for one job, worth unifying, not a copy.) |
| `UnsyncedChangesSection`, `DangerZoneSection`, `BackupSection`, `WeeklyReportSection`, `GuidanceSection`, `AccountSection`, `CloudSyncDirectional`, `DataAboutSection`, `SettingsSelect` | Checked and clean. All import `SettingsCard` / `SettingsRow` / `ActionRow` / `Button` / `IconBox` / `Divider` rather than re-declaring them. `SettingsSelect.tsx` is the model call site: `IconBox` at `:50` and `Divider` at `:93`. |
| 35 modals and sheets (`CommentSheet`, `RPEPicker`, `NumpadOverlay`, `WorkoutSettingsOverlay`, `CreateTemplateModal`, …) | All import `ModalOverlay` or `Sheet`. No hand-rolled blocking overlay found. |

---

## Fix order and file exclusivity

| batch | severity | files (disjoint across batches) | depends on |
|---|---|---|---|
| 1 | **wrong state** | `settings/sections/ProfileEditSection.tsx` + new `components/ui/Avatar.tsx` | — |
| 2 | **wrong state** | `components/workout/overlays/SettingsPrimitives.tsx` | — |
| 3 | cosmetic (root cause) | `components/ui/SettingsRow.tsx`, `settings/components/IconBox.tsx`, `settings/components/Divider.tsx`, `settings/sections/ThemeSection.tsx` | — |
| 4 | cosmetic | `settings/sections/{ProfileSection,CoachSection,CloudSyncSection,NotificationsSection}.tsx` | 3 |
| 5 | cosmetic | `settings/sections/{LegalLinksSection,BlockedUsersSection}.tsx` | — |
| 6 | cosmetic | `pages/profile/PublicProfilePage.tsx` | 1 |

Batches 1, 2, 3 and 5 can run in parallel. 4 waits on 3; 6 waits on 1.

## Also noticed — real, not touched, not copies

- `SettingsPrimitives.tsx:386+` `TabBar`: no `role="tablist"`/`role="tab"`, no `aria-selected`,
  no arrow-key navigation, and a ≈38px computed target — **under the 44px floor**. This is the
  only *unreachable-target* finding in the sweep and it is not a copy defect.
- `src/components/ui/ProfileAvatar.tsx` is dead (zero importers) and duplicates
  `src/utils/getInitials` inline at `:4-10`. Candidate for deletion.
- Both avatar fallbacks (`ProfileEditSection.tsx:233`, `PublicProfilePage.tsx:343`) are
  `aria-hidden="true"`, so when a user has no photo a screen reader gets nothing at all —
  while the `<img>` branch has a proper Hebrew `alt`. Same defect in both, so not a
  copy-vs-shared gap; worth fixing when the `Avatar` primitive is extracted.
- `src/components/ui/SettingsCard.tsx` is marked `@deprecated` in favour of
  `<Card variant="glass" asymmetric>`, yet it is still the correct target for Batches 1 and 5.
  Either un-deprecate it or migrate all settings sections to `Card` — but not both piecemeal.
