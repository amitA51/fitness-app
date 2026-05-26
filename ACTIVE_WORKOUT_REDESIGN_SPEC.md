# Active Workout Screen — Redesign Specification

> Reference mockup: `mockup-workout-v2.html` (open in browser to see exact layout)
> Files to modify: components under `src/components/workout/`
> Design system: `src/styles/tokens.css` (Fresh Steel palette)

---

## SCREEN LAYOUT (top to bottom)

The screen is a full-height flex column (`h-dvh`). Three zones:

```
+-----------------------------+
| PROGRESS BAR (4px)          |  <- fixed top
| HEADER                      |  <- fixed
| REST TIMER (conditional)    |  <- fixed, only when rest active
| EXERCISE CARD               |  <- fixed
+-----------------------------+
|                             |
| SCROLLABLE CONTENT          |  <- flex: 1, overflow-y: auto
|  - technique pills          |
|  - weight + reps cards      |
|  - previous set badge       |
|  - action group (tools)     |
|                             |
+-----------------------------+
| SLIDE TO COMPLETE           |  <- fixed bottom (thumb zone)
| NAV ROW                     |  <- fixed bottom
| NEXT UP STRIP               |  <- fixed bottom
+-----------------------------+
```

---

## 1. PROGRESS BAR

**Component:** `ProgressBar.tsx`
**Position:** Absolute top, z-100
**Height:** 4px
**Track:** `var(--fs-surface-2)`
**Fill:** `linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))`
**Behavior:** Width = `derived.progressPercent`% (completed sets / total sets across all exercises)
**Effect:** Shimmer animation on fill (CSS `background-position` loop)

---

## 2. HEADER

**Component:** `WorkoutHeader.tsx`
**Layout:** `flex, items-center, justify-between`
**Padding:** `12px 16px`
**Border-bottom:** `2px solid var(--fs-accent)`
**Background:** `var(--fs-bg)`

### Left side (header-start):
1. **Brand icon** — 30x30px circle, `border: 3px solid var(--fs-steel)`, background: radial-gradient accent dot on primary
2. **Info block:**
   - Label: `"אימון פעיל"` — font-mono, 9px, weight 700, letter-spacing 0.16em, uppercase, color muted
   - **Timer** — font-mono, **26px**, weight 700, color accent
     - **IMPORTANT:** Timer sits inside a pill container: `background: color-mix(in srgb, var(--fs-accent) 10%, var(--fs-surface))`, `border: 1px solid color-mix(in srgb, var(--fs-accent) 20%, transparent)`, `border-radius: 10px`, `padding: 2px 12px 2px 10px`
     - **Pulsing dot** (8x8px circle, accent color, `animation: pulse-dot 2s infinite ease-in-out`) — placed before the time text inside the pill
     - Timer uses `useWorkoutTimer` hook, shows `MM:SS` format, `direction: ltr`

### Right side (header-end):
1. **Overflow menu button** — 42x42px, `var(--fs-surface-2)` bg, `1px solid var(--fs-steel)` border, `border-radius: var(--radius-chip)` (12px 8px 12px 8px), icon: `MoreHorizontal` (vertical dots)
   - Opens dropdown with 3 items:
     - **מדריך** (Tutorial) — book icon, dispatches `SHOW_TUTORIAL`
     - **הגדרות** (Settings) — Settings icon, dispatches `TOGGLE_SETTINGS`
     - **בטל אימון** (Discard) — Trash2 icon, **destructive red** (`var(--fs-danger)`), shows ConfirmExitOverlay with intent='cancel'
2. **Finish button** — 42x42px, `var(--fs-accent)` bg, no border, `border-radius: var(--radius-chip)`, icon: `Check` (checkmark), shows ConfirmExitOverlay with intent='finish'
   - Has `isSaving` disabled state (opacity 0.6, cursor wait)

---

## 3. REST TIMER (conditional)

**Component:** `InlineRestTimer.tsx`
**Condition:** Only shown when `state.restTimer.active === true`
**Position:** Pinned below header (flex-shrink: 0)
**Layout:** `flex, items-center, justify-between`
**Padding:** `10px 16px`
**Background:** `linear-gradient(180deg, var(--fs-surface) 0%, color-mix(in srgb, var(--fs-accent) 5%, var(--fs-surface)) 100%)`
**Border-bottom:** `2px solid var(--fs-accent)`

### Left: Ring + Time
- **SVG progress ring:** 48x48px, track circle (fill: rubber, stroke: steel, width 6), progress circle (stroke: accent, width 6, dasharray/dashoffset animated)
- **Time display:** font-display, weight 900, 26px, color ink (changes to `var(--fs-warn)` when 3 seconds or less)
- **Breathing dot** (only when 5 seconds or less): pulsing circle indicator
- **Sublabel:** font-mono, 9px, accent color, uppercase, `"NEXT - SET XX"` or `"מנוחה"`

### Right: Action buttons
- **+15s** button — font-mono 11px, surface-2 bg, steel border, border-radius 8px, min-height 36px
- **+30s** button — same style
- **+60s** button — same style
- **דלג (Skip)** button — accent bg, heading color, accent border

---

## 4. EXERCISE CARD

**Position:** Pinned below header/rest-timer (flex-shrink: 0)
**Wrapper padding:** `12px 14px 0`

### The Card:
- **Background:** `var(--fs-surface)`
- **Border:** `1px solid var(--fs-steel)`
- **Border-radius:** `var(--radius-asymmetric)` = `22px 16px 22px 16px`
- **Padding:** `14px 16px 12px`
- **Box-shadow:** `var(--shadow-card)`
- **Top accent line:** `::before` pseudo-element, 3px height, `linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))`

### Card contents:

**Row 1: Exercise name + PR badge**
- **Exercise name:** font-display, weight 800, 21px, color heading, `text-overflow: ellipsis`
- **PR badge** (conditional, shown when PR exists): `"PR: XXkg"`, font-mono 10px weight 700, color accent-2, background `color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))`, border `color-mix(in srgb, var(--fs-accent) 25%, transparent)`, border-radius 8px, `direction: ltr`

**Row 2: Set dots + label**
- **Set dots** (`direction: ltr`): One dot per set in the exercise
  - Completed: `background: var(--fs-accent)`, `border-color: var(--fs-accent)`
  - Current: `background: var(--fs-accent-2)`, `border-color: var(--fs-accent-2)`, `box-shadow: 0 0 8px color-mix(...)`, `transform: scale(1.25)`
  - Pending: `background: var(--fs-surface-2)`, `border: 1.5px solid var(--fs-steel)`
  - Each dot: 10x10px circle, gap 5px between dots
- **Set label:** font-mono, 11px, weight 600, color muted, `"SET 3 / 4"` format, `direction: ltr`

---

## 5. SCROLLABLE CONTENT

**Container:** `flex: 1, overflow-y: auto, padding: 14px`
**Spacing:** Use explicit spacer divs, NOT uniform gap. Gaps: 8px (tight), 12px (normal), 16px (loose)
**Touch:** `touch-action: pan-y`, `overscroll-behavior: contain`
**Swipe:** Horizontal swipe between exercises (pointer-based, RTL-aware, MIN_DX=70px, MAX_DY=40px, MAX_DURATION=400ms)

### 5A. Technique Pills

**Component:** `SetTechniquePills.tsx`
**Layout:** `flex, gap: 6px, overflow-x: auto, scrollbar-width: none`
**Spacing after:** 12px gap

Each pill is a toggle button:

| Technique | Label | State key |
|-----------|-------|-----------|
| warmup | חימום | `set.isWarmup` |
| dropSet | דרופ | `set.isDropSet` |
| failure | כשל | `set.isFailure` |
| restPause | מנוחה-קצרה | `set.isRestPause` |

**Inactive:** bg surface, border 1px steel, border-radius `var(--radius-chip)`, font-mono 10px weight 700, color muted
**Active:** bg accent, color white, border-color accent
**Handler:** `dispatch('SET_TECHNIQUE', { technique, value: !current })`

### 5B. Input Cards (Weight + Reps)

**Component:** `SetInputCard.tsx`
**Layout:** `grid, grid-template-columns: 1fr 1fr, gap: 10px`
**Spacing after:** 8px gap

Each card:
- **Background:** `radial-gradient(circle at 20px 20px, color-mix(in srgb, var(--fs-accent) 12%, transparent), transparent 30px), linear-gradient(135deg, var(--fs-surface-shine-strong), transparent 54%), var(--fs-surface)`
- **Border:** `1px solid var(--fs-steel)`
- **Border-radius:** `24px 16px 24px 16px`
- **Padding:** `16px 12px 12px`
- **Tap:** Opens NumpadOverlay for that field
- **Press effect:** `transform: scale(0.97)` on active
- **Flash effect:** Brief accent overlay (opacity 0.15 to 0) on value change

**Card contents (top to bottom, centered):**
1. **Label** — font-mono, 9px, uppercase, letter-spacing 0.18em, color accent, weight 700
   - Weight card: `"משקל"`
   - Reps card: `"חזרות"`
2. **Value** — font-display, weight 800, `clamp(34px, 10vw, 42px)`, color ink, `direction: ltr`
   - Unit suffix (weight only): font-mono 11px, color muted, `"kg"`
   - Ghost state (no value entered yet, previous exists): color becomes `color-mix(in srgb, var(--fs-muted) 56%, transparent)`
3. **Ghost badge** (conditional: when value=0 and previousSet has value): `"קודם XX"`, font-mono 10px, color `color-mix(in srgb, var(--fs-accent) 70%, var(--fs-muted))`, bg `color-mix(in srgb, var(--fs-accent) 10%, transparent)`, border-radius 5px, padding 2px 7px
4. **Stepper row** — grid 2 columns, gap 6px, margin-top 8px
   - **Minus button:** height 42px, border-radius 14px, bg surface-2, color ink, font-display weight 800 size 20px, character: minus sign
   - **Plus button:** same size, bg **accent**, color white, character: plus sign
   - Both: `transform: scale(0.93)` on active, haptic feedback on press
5. **Step hint** (weight card only): font-mono, 8px, uppercase, letter-spacing 0.12em, color muted, `"קפיצה 2.5"`

**Increment amounts:** Weight = 2.5, Reps = 1

### 5C. Previous Set Badge

**Spacing after:** 12px gap
**Layout:** `flex, items-center, justify-center, gap: 8px`
**Condition:** Only shown when `previousSet` has weight or reps
**Style:** bg `color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))`, border `1px solid color-mix(in srgb, var(--fs-accent) 20%, transparent)`, border-radius 10px, padding 7px 14px

Contents:
- **Label:** font-mono, 10px, weight 700, color accent, uppercase, `"אימון קודם:"`
- **Value:** font-display, 13px, weight 800, color ink, `direction: ltr`, format `"XXkg x YY"`
- **RPE** (if previousSet.rpe exists): font-mono, 9px, weight 700, color muted, `"RPE X"`

### 5D. Action Group (Tools)

**Container:** bg surface, border 1px steel, border-radius 16px, padding 10px 12px
**Label:** font-mono, 8px, weight 700, letter-spacing 0.14em, uppercase, color muted, `"כלים"`, border-bottom 1px surface-2, padding-bottom 4px

**Row 1 — Primary actions:**

| Button | Icon | Label | Active state | Handler |
|--------|------|-------|-------------|---------|
| RPE | Star (lucide) | `"RPE —"` or `"RPE X"` | accent bg when RPE set | Opens RPEPicker bottom sheet |
| Plates | `"KG"` text | `"פלטות"` | — | dispatches `OPEN_PLATE_CALC` |
| Notes | FileText (lucide) | `"הערות"` | dot indicator when notes exist | Opens NotesBottomSheet |
| *(spacer)* | — | — | — | flex: 1 spacer |
| Undo | RotateCcw (lucide) | *(icon only)* | — | dispatches `UNDO_LAST_SET`, only shown when completedSetsCount > 0 |

**Row 2 — Secondary actions:**

| Button | Icon | Label | Handler |
|--------|------|-------|---------|
| Edit Sets | Edit (lucide) | `"עריכת סטים"` | Opens SetEditBottomSheet, only shown when completedSetsCount > 0 |
| Superset | Plus (lucide) | `"סופרסט"` | Enters superset mode (select 2 exercises), only shown when NOT already in a superset |

**Chip style (all buttons):**
- Inactive: bg surface, border 1px steel, border-radius `var(--radius-chip)`, font-mono 11px weight 700, color ink, min-height 38px, padding 7px 12px
- Active/On: bg accent, color primary, border-color accent
- Press: `transform: scale(0.95)`, border-color accent
- Icon: 14x14px, `stroke-width: 2.5`

---

## 6. BOTTOM SECTION (pinned)

**Position:** flex-shrink: 0 (never scrolls)
**Padding:** `0 14px 16px` (+ safe-area-inset-bottom on real device)
**Background:** `var(--fs-bg)`
**Border-top:** `1px solid var(--fs-surface-2)`
**Layout:** flex column, gap 8px
**Order (top to bottom):**

### 6A. Slide to Complete

**Component:** `SlideToComplete.tsx`
**Track:** width 100%, height 62px, border-radius 999px (pill), bg: `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 14px), var(--fs-primary)`
**Label:** `"החלק לסימון סט כבוצע"`, font-mono 13px weight 700, letter-spacing 0.08em, uppercase, color accent, centered, fades as progress grows
**Thumb:** 54x54px circle, bg accent, color white, inset 4px from start, border-radius 999px, shadow, chevron icon
**Behavior:**
- Drag threshold: 75% of track width
- At 75%: haptic 'medium'
- On complete: haptic 'success', calls `onCompleteSet`, resets thumb to start after 240ms
- Keyboard: Enter/Space completes immediately
- RTL-aware: thumb starts at `inset-inline-start`, direction hint at `inset-inline-end`

### 6B. Nav Row

**Layout:** `flex, items-center, gap: 6px`

| Element | Size | Style | Action |
|---------|------|-------|--------|
| Prev arrow | 42x42px | surface bg, steel border, radius-chip, ChevronLeft(rotated) | dispatches CHANGE_EXERCISE with currentIndex - 1, disabled when index=0 |
| Center panel | flex: 1, 42px height | primary bg, radius-chip | Shows: set progress and exercise position |
| Next arrow | 42x42px | same as prev, ChevronLeft icon | dispatches CHANGE_EXERCISE with currentIndex + 1, disabled when last |
| List button | 42x42px | surface-2 bg, steel border, radius-chip, List icon | dispatches TOGGLE_DRAWER to open ExerciseReorder drawer |

**Center panel text:**
- Set info: font-mono 12px weight 700, `rgba(255,255,255,0.85)`, format `"סט X/Y"`
- Divider: dot character, `rgba(255,255,255,0.3)`
- Position: font-mono 11px weight 700, `rgba(255,255,255,0.45)`, `direction: ltr`, format `"Z/N"`

### 6C. Next Up Strip

**Condition:** Only shown when there IS a next exercise (currentIndex < exercises.length - 1)
**Layout:** `flex, items-center, gap: 6px`
**Style:** bg `color-mix(in srgb, var(--fs-accent) 6%, var(--fs-surface))`, border `1px solid color-mix(in srgb, var(--fs-accent) 14%, transparent)`, border-radius 10px, padding 6px 12px

Contents:
- **Label:** font-mono, 9px, weight 700, color accent, letter-spacing 0.08em, uppercase, `"הבא:"`
- **Name:** font-body, 12px, weight 700, color ink, `direction: ltr`, ellipsis overflow
- **Meta:** font-mono, 10px, color muted, shows set count like `"4 sets"`

---

## 7. OVERLAYS (lazy loaded, opened on demand)

These are NOT part of the main layout. They render as portals/modals on top of everything.

### 7A. NumpadOverlay
**File:** `overlays/NumpadOverlay.tsx`
**Trigger:** Tapping a SetInputCard (weight or reps)
**Position:** Fixed bottom sheet, slides up from bottom
**Contains:**
- Navy masthead with exercise name + target label (WEIGHT/REPS and משקל/חזרות)
- Large animated value display (font-display, clamp 56px-96px)
- Ghost values row: "קודם" (previous set) + "אימון קודם" (last workout)
- Mode toggle tabs: מקלדת (numpad) / כפתורי +/- (stepper)
- Preset buttons: weight=[20,40,60,80,100,120] / reps=[6,8,10,12,15,20] (merged with recent values)
- Numpad grid: 3x4 keys (weight allows decimal, reps does not)
- Stepper mode: increment buttons (weight: plus/minus 1.25, 2.5, 5, 10 / reps: plus/minus 1, 2, 3, 5)
- Confirm button: "אישור", accent bg, full width, disabled when empty

### 7B. RPEPicker (bottom sheet)
**Trigger:** RPE chip button
**Content:** RPE scale 1-10 selector with target RPE highlight if programmed

### 7C. NotesBottomSheet
**Trigger:** Notes chip button
**Content:** Text input for set notes

### 7D. SetEditBottomSheet
**Trigger:** Edit Sets chip button
**Content:** List of completed sets with editable weight/reps

### 7E. PlateCalculatorOverlay
**Trigger:** Plates chip button
**Content:** Plate breakdown visualization for target weight

### 7F. ConfirmExitOverlay
**Trigger:** Finish button or Discard menu item
**Content:** Workout stats (sets, volume, duration) + confirm/cancel + optional cooldown button
**Two intents:** 'finish' (save workout) or 'cancel' (discard without saving)

### 7G. ExerciseReorder (drawer)
**Trigger:** List button in nav row
**Content:** Full draggable exercise list with: reorder, select exercise, delete exercise, edit individual sets, delete sets

### 7H. ExerciseSelector
**Trigger:** Add exercise action (from ExerciseReorder or auto-open when no exercises)
**Content:** Exercise library browser with search, categories, muscle groups

### 7I. WorkoutSettingsOverlay
**Trigger:** Settings in overflow menu
**Content:** Workout preferences (rest time, volume preview, ghost values, etc.)

### 7J. ExerciseTutorial
**Trigger:** Tutorial in overflow menu
**Content:** Exercise instructions, form tips, custom notes

### 7K. WarmupCooldownFlow
**Trigger:** Workout start (warmup) or finish cooldown button
**Content:** Guided warmup/cooldown movement flow

### 7L. WorkoutGoalSelector
**Trigger:** Workout start (if no default goal set)
**Content:** Goal type picker (strength, hypertrophy, endurance, etc.)

---

## 8. CONDITIONAL ELEMENTS

### Superset Mode Indicator
**Condition:** When user clicks "סופרסט" and selects first exercise
**Position:** Full-width strip below header
**Style:** bg accent, font-mono 10px weight 700, uppercase, heading color
**Content:** `"SUPERSET - בחר תרגיל שני"` and `"2 / 2"`

### Water Reminder Toast
**Component:** `WaterReminderToast.tsx`
**Trigger:** Every X minutes (configurable, default 15min) when `workoutSettings.waterReminderEnabled`

### Saving Overlay
**Condition:** `isSaving === true`
**Content:** Full-screen blocking overlay with loading indicator

---

## 9. GESTURES AND INTERACTIONS

| Gesture | Where | Action |
|---------|-------|--------|
| Horizontal swipe | Scrollable content area | Navigate between exercises (70px min, 40px max vertical, 400ms max) |
| Tap weight card | SetInputCard | Opens NumpadOverlay for weight |
| Tap reps card | SetInputCard | Opens NumpadOverlay for reps |
| Slide thumb | SlideToComplete | Complete current set at 75% threshold |
| Press Enter/Space | SlideToComplete (focused) | Complete current set immediately |
| Arrow keys | Anywhere (not in inputs) | Navigate between exercises |
| +/- stepper buttons | SetInputCard | Increment/decrement value (weight plus/minus 2.5, reps plus/minus 1) |

---

## 10. DESIGN TOKENS REFERENCE

Use ONLY variables from `src/styles/tokens.css`. Key values:

```
Colors:       --fs-bg, --fs-surface, --fs-surface-2, --fs-ink, --fs-muted,
              --fs-heading, --fs-primary, --fs-accent, --fs-accent-2,
              --fs-steel, --fs-rubber, --fs-warn, --fs-signal
Fonts:        --font-display, --font-body, --font-mono
Radii:        --radius-chip (12px 8px 12px 8px)
              --radius-asymmetric (22px 16px 22px 16px)
              --radius-full (999px)
Shadows:      --shadow-card, --shadow-elevated
Motion:       --ease-premium, --duration-fast (150ms), --duration-base (200ms)
```

**RTL:** The app is `dir="rtl"`. Use logical properties: `inset-inline-start`, `inset-inline-end`, `margin-inline-start`, `padding-inline-start`. Never use `left`/`right` for directional positioning.

**Haptics:** Import `triggerHaptic` from `utils/haptics`. Use: `'light'` for taps, `'medium'` for threshold crosses, `'success'` for completions.

---

## 11. FILES TO MODIFY

| File | What to change |
|------|----------------|
| `components/WorkoutHeader.tsx` | Timer pill with pulsing dot, larger font (26px) |
| `components/ExerciseDisplay.tsx` | Replace hero panel with exercise card (accent top line + PR badge + set dots). Restructure actions into grouped container. Remove internal SlideToComplete. |
| `components/SetInputCard.tsx` | Adjust padding to 16px top. Keep existing radial gradient + shine. |
| `components/ExerciseNav.tsx` | Remove exercise rail tabs. Keep only: prev/next arrows + center panel + list button. Add optional NextUpStrip below. |
| `ActiveWorkoutNew.tsx` | Reorder bottom section: SlideToComplete first (top of bottom), then nav row, then "next up" strip. Remove `hideSlideButton` prop from ExerciseDisplay. |
| `components/SlideToComplete.tsx` | No changes needed (existing implementation is correct). |
| `components/InlineRestTimer.tsx` | No changes needed (existing implementation matches spec). |
| `overlays/NumpadOverlay.tsx` | No changes needed. |

### Files NOT to modify:
- `core/WorkoutContext.tsx`, `core/WorkoutProvider.tsx`, `core/workoutReducer.ts` — state management stays the same
- All overlay components — they work independently and do not need layout changes
- `hooks/*` — all hooks remain unchanged
- `src/styles/tokens.css` — do not change design tokens

---

## 12. NEW ELEMENT: NextUpStrip

Create inline in ActiveWorkoutNew.tsx or as a small component:

```tsx
// Shows the next exercise name + set count
// Only rendered when currentExerciseIndex < exercises.length - 1
interface NextUpStripProps {
  nextExerciseName: string;
  nextExerciseSets: number;
}
```

Style: bg `color-mix(in srgb, var(--fs-accent) 6%, var(--fs-surface))`, border `1px solid color-mix(in srgb, var(--fs-accent) 14%, transparent)`, border-radius 10px, padding 6px 12px, flex layout with label "הבא:" + name + set count.
