# Active-Workout ↔ PDF Program Fidelity — Implementation Plan (handoff)

> **Goal:** make the active-workout experience faithfully reflect the built-in
> 12-week "Bodybuilding Transformation System" program (the user's PDF), so that
> running a program day *feels like looking at the PDF through the app*: warmups,
> rep/rest **ranges**, RPE, intensity techniques, real exercise swaps, and
> weight carry-over between sets.
>
> **Audience:** a fresh agent with no prior context. Everything needed is below.
> Read the "Codebase map" first, then do the tasks in order. Keep `typecheck`,
> `test:run`, and `build` green after every task. Respect the design system
> (tokens only, RTL/Hebrew, no emoji, Lucide icons, 44px targets, immutability).

---

## 0. TL;DR — what the user asked for

1. **Swapping an exercise must actually swap it in the active workout** (today it
   does nothing mid-workout — the "חלופות" sheet has no `onSelect` wired).
2. **Tidy up the "notes" at the top of the exercise card** and make them match
   the program — present the prescription cleanly (build extra structure if
   helpful). Today it's a cramped single coaching-note string.
3. **Add warmup set(s) at the start** of each exercise, as the PDF prescribes.
4. **Shorter rest** + **show a range** ("מנוחה 3–5 דק'") and rep range ("8–10")
   rather than one long fixed number.
5. **Carry the weight forward**: set 2 should pre-fill the weight from set 1
   (sets usually share a weight; don't make the user retype it).
6. **Overall: match the PDF, high quality.**

The user explicitly said *"do what you think"* — exercise judgment; these are the
intent, not pixel specs.

---

## 1. Codebase map (verified)

### Program data (source of truth for the prescription)
- `src/data/bbtProgram.generated.ts` — auto-generated, do **not** hand-edit.
  Regenerate via `scripts/generate_program_ts.py` from `program_extracted.json`.
  - `interface BbtExercise` fields: `order, name, nameHe, muscle,
    warmupSets (string e.g. "2-3"), workingSets (number), reps (string e.g.
    "8-10"), targetReps (number, low end), earlyRpe (string), lastRpe (string),
    rpeTarget (number|null), rest (string e.g. "3-5 min"), restSeconds (number,
    currently the HIGH end ~240), technique, techniqueHe, sub1/sub1He,
    sub2/sub2He, notes`.
  - `BBT_PROGRAM.days[]` = 60 days (12 weeks × 5 training days).

### Program service (materializes a day → hidden runner template)
- `src/services/programService.ts`
  - `buildTemplateForDay(day, swaps = {})` → `WorkoutTemplate` with
    `id = PROGRAM_DAY_TEMPLATE_ID ('__bbt_program_day__')`, `isProgramHidden:true`,
    and per-exercise `programExtras`. **This is where new prescription fields get
    populated.**
  - Substitutions: `getSwaps()`, `getSwapFor(week,dayType,order)`,
    `setSwap(week,dayType,order,choice|null)`, `getExerciseOptions(ex)` →
    `{ label: "Hebrew | English", he }[]`. Swap value stored is the **bilingual
    label**. `englishOf(label)` extracts the English (used for `exerciseId`).
  - `startProgramDay(week?,dayType?)` writes the template to IDB (store
    `WORKOUT_TEMPLATES`) and navigates to `/workout/<PROGRAM_DAY_TEMPLATE_ID>`.
  - Progress lives in `localStorage('bbt_program_progress_v1')`; swaps in
    `localStorage('bbt_program_swaps_v1')`.
- Tests: `src/services/__tests__/programService.test.ts` (progression + swap
  tests already exist — extend them).

### Active-workout loader (template → live exercises)
- `src/components/workout/active/useWorkoutEffects.ts` — `loadTemplate()` reads
  the template by id and, for each template exercise, builds an `Exercise` and
  dispatches `ADD_EXERCISE`. **Today:** `sets = Array.from({length:setCount}, () =>
  createWorkoutSet({ reps, weight: 0 }))` — all working sets, weight 0, **no
  warmup**. `isProgram = !!ex.programExtras`. This is where warmup sets get
  prepended and where new programExtras fields flow into the live exercise.

### Reducer (immer/use-immer — mutate the `draft`)
- `src/components/workout/core/workoutTypes.ts` — `WorkoutAction` union (e.g.
  `ADD_EXERCISE`, `COMPLETE_SET`, `ADD_SET`, ...). **Add `SWAP_EXERCISE` here.**
- `src/components/workout/core/workoutReducerExerciseHandlers.ts` — `ADD_EXERCISE`
  uses `draft.exercises.push(...)` (order preserved). `REMOVE_EXERCISE`.
  **Add the `SWAP_EXERCISE` handler here.**
- `src/components/workout/core/workoutReducerSetHandlers.ts` — `COMPLETE_SET`
  (~L39), `ADD_SET` (~L198, **already** "Seed the new set from the last existing
  one (weight/reps carry over)"), `EDIT_SET`. **Add carry-forward to the next
  pre-existing set in `COMPLETE_SET` here.**
- `src/components/workout/core/workoutReducerHelpers.ts` — `calculateRestTime`
  (priority: superset > `programExtras.restTime` > targetRestTime > smartRest >
  default). Rest comes from `programExtras.restTime`.

### Exercise card UI (the "top notes" + sets + sheets)
- `src/components/workout/components/ExerciseDisplay.tsx`
  - `ProgramCoachingRow` (added recently) renders `intensityTechnique`,
    `rpeTarget` (when rpe unset), and `notes`. **This is the "notes at the top"
    to redesign in Task 2.**
  - Title row has a mono `prInfo` pill (reuse this idiom).
  - `RPEPicker` gets `targetRPE = programExtras.rpeTarget`.
  - **BUG:** `<AlternativesSheet ... />` is rendered **without `onSelect`**, so
    selecting an alternative does nothing. Wire it in Task 1.
  - Tokens-only; mono labels via `var(--font-mono)`; color-mix accent tints.
- `src/components/workout/components/AlternativesSheet.tsx` — already supports
  `onSelect?(altName)`; just not passed by the parent.
- `src/components/workout/components/SetProgress.tsx` — segmented spine, already
  `direction:'ltr'`, already supports `warmupIndices: Set<number>` (renders
  warmup segments in a muted accent tint). Feed it warmup indices in Task 3.
- `src/components/workout/components/SetInputCard.tsx` — the per-set weight/reps
  input (already `direction:'ltr'` aware).

### Types
- `src/types/index.ts`
  - `WorkoutSet` (`isWarmup: boolean`, `weight`, `reps`, `completedAt`, `rpe`,
    `rpeTag`, `notes`, `duration`). `createWorkoutSet({...})` defaults
    `isWarmup:false`.
  - `SetTechnique = 'warmup' | 'dropSet' | 'failure' | 'restPause'`.
  - `ProgramExtras { rpeTarget?, restTime?, intensityTechnique?, alternatives?,
    notes?, [key:string]: unknown }` — **extend this** (Task 0/data-model).
  - `Exercise` / `ActiveExercise` carry `programExtras?`, `notes?`,
    `targetRestTime?`, `targetMuscle?`, `muscleGroup?`.

### Verification & environment gotchas (IMPORTANT)
- Gate: `npm run typecheck` (strict, `noUncheckedIndexedAccess` is ON — handle
  `arr[0]` possibly-undefined), `npm run test:run`, `npm run build`. All must stay
  green. Current baseline: **typecheck clean, 1027 tests pass, build OK.**
- **Do NOT run `npm run format` / `biome format --write` across `./src`.** The
  repo has `core.autocrlf=true` and **no `.gitattributes`**, while biome's
  default line-ending is LF — so a repo-wide write reformats *hundreds* of files
  (pure CRLF→LF churn). Only format files you actually edit, e.g.
  `npx @biomejs/biome check --write <specific files you changed>`.
- `npm run verify` (which runs `biome check`) currently fails on **12 pre-existing
  lint errors in unrelated files** (a11y `useFocusableInteractive`,
  `useExhaustiveDependencies`, test-mock `noThenProperty`) — **not yours**. Don't
  chase them. Verify via typecheck + tests + build instead.
- A `post-commit` hook rebuilds graphify (`graphify-out/`) and can leave
  CRLF-only working-tree churn; `git checkout HEAD -- .` cleans it (your commit is
  already clean — the hook runs after).
- Deploy: `master` auto-deploys to Netlify. Work on a feature branch; the program
  feature shipped in commits `d28e89d` + merge `7087a74`.

---

## 2. Data-model change (do this first)

Extend `ProgramExtras` in `src/types/index.ts` so the UI never re-parses strings:

```ts
export interface ProgramExtras {
  rpeTarget?: number;
  restTime?: number;            // seconds used by the rest timer (LOW end now)
  intensityTechnique?: string;
  alternatives?: string[];
  notes?: string;
  // NEW — verbatim-from-PDF presentation fields:
  repRange?: string;            // e.g. "8-10"  (render LTR/bdi)
  restRange?: string;           // e.g. "3-5 min" → display "3–5 דק'"
  restSecondsMin?: number;      // low end seconds (timer target)
  restSecondsMax?: number;      // high end seconds
  warmupSets?: number;          // resolved count of warmup sets
  earlyRpe?: string;            // e.g. "~6-7"
  lastRpe?: string;             // e.g. "~7-8"
  coachingNote?: string;        // the PDF's freeform cue (separate from the
                                // auto-composed `notes` so the UI can format it)
  [key: string]: unknown;
}
```

Then populate them in `buildTemplateForDay` (`programService.ts`). Add small
pure helpers near the top of that file:

```ts
// "3-5 min" / "90-120 sec" / "2 min" → { min, max } in seconds.
const parseRestRange = (rest: string): { min: number; max: number } => {
  const isMin = /min/i.test(rest);
  const isSec = /sec|ש'|שנ/i.test(rest);
  const nums = (rest.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const unit = isMin ? 60 : isSec ? 1 : 60; // default minutes
  const lo = (nums[0] ?? 1.5) * unit;
  const hi = (nums[1] ?? nums[0] ?? 2) * unit;
  return { min: Math.round(lo), max: Math.round(hi) };
};

// "2-3" / "2" → a sensible warmup count (low end, capped).
const parseWarmupCount = (s: string): number => {
  const n = (s.match(/\d+/g) ?? []).map(Number);
  return Math.min(4, Math.max(0, n[0] ?? 0));
};

// "3-5 min" → "3–5 דק'", "90-120 sec" → "90–120 שנ'"
const restRangeHe = (rest: string): string => { /* format with en-dash + unit */ };
```

In the `buildTemplateForDay` per-exercise map, set:
- `restTime: parseRestRange(ex.rest).min` (LOW end → **shorter** default rest).
- `restSecondsMin/Max`, `restRange: ex.rest`, `repRange: ex.reps`,
  `warmupSets: parseWarmupCount(ex.warmupSets)`, `earlyRpe: ex.earlyRpe`,
  `lastRpe: ex.lastRpe`, `coachingNote: ex.notes`.
- Keep `notes` (the composed coaching summary) for back-compat, but the UI should
  prefer the structured fields.

> Note: `restSeconds`/`targetRestTime` on the template exercise are still used as
> a fallback by `useWorkoutEffects` and `calculateRestTime`; set the template's
> `restSeconds`/`targetRestTime` to the **low end** too, so the timer is shorter
> even on the fallback path.

---

## 3. Tasks (in order)

### Task 1 — Real exercise swap, mid-workout
**Why:** `AlternativesSheet` in `ExerciseDisplay.tsx` is rendered without
`onSelect` → tapping an alternative does nothing.

1. Add a reducer action `SWAP_EXERCISE` in `workoutTypes.ts`:
   `{ type: 'SWAP_EXERCISE'; payload: { exerciseId: string; newName: string } }`
   (`newName` is the chosen bilingual label, e.g. `"לחיצת מוט בשיפוע 45° | 45°
   Incline Barbell Press"`).
2. Handle it in `workoutReducerExerciseHandlers.ts`: find the exercise by id; set
   `name`/`exerciseName` to `newName` and `exerciseId` to its English side
   (replicate `englishOf` or pass it in); rebuild
   `programExtras.alternatives` so the **previous** name becomes an alternative
   and the chosen one is removed (enables swap-back). Preserve all sets, RPE,
   rest, technique, notes (the prescription stays; only the movement changes).
   Keep it immutable per immer (`draft.exercises[i].name = ...`).
3. In `ExerciseDisplay.tsx`, thread an `onSwapExercise?(exerciseId, newName)` prop
   (wired from `ActiveWorkoutNew.tsx` → `dispatch({ type:'SWAP_EXERCISE', ... })`)
   and pass `onSelect={(alt) => onSwapExercise?.(exercise.id, alt)}` to
   `<AlternativesSheet/>`. The sheet already closes itself after select.
4. **Design decision:** mid-workout swap is **session-scoped** (only the live
   exercise changes). The persistent, next-time swap stays the Program-page swap
   (`setSwap`). Document this; optionally also call `setSwap` if the active
   exercise can be mapped back to `(week,dayType,order)` (it currently can't
   cheaply — leave as session-scoped unless you add that linkage).
5. Tests: a reducer unit test — dispatch `SWAP_EXERCISE`, assert name/exerciseId
   change and that the old name is now in `alternatives`.

### Task 2 — Redesign the prescription block ("the notes at the top")
**Why:** today it's a cramped coaching-note line; the user wants it to read like
the PDF.

In `ExerciseDisplay.tsx`, replace `ProgramCoachingRow` with a tidy, tokens-only
**prescription block** pinned under the exercise title, shown while the exercise
is in progress. Suggested layout (mono micro-labels + values, wrap-friendly):

```
[ חזרות 8–10 ]  [ RPE 7→8 ]  [ מנוחה 3–5 דק' ]  [ חימום ×2 ]
[ סט אחרון · דרופ-סט ]                      ← only if intensityTechnique
FileText  "1 שנייה השהיה בתחתית כל חזרה…"     ← coachingNote, 2-line clamp
```

Details:
- Reuse the existing mono-pill idiom (color-mix accent tint, `var(--font-mono)`,
  `dir`/`bdi` for numerics). Numbers/ranges/arrows must be bidi-isolated
  (`<bdi dir="ltr">`).
- Pull values from the new `programExtras` fields (`repRange`, `earlyRpe→lastRpe`
  or `rpeTarget`, `restRange`, `warmupSets`, `intensityTechnique`, `coachingNote`).
- Keep it compact (the app's "Log first" rule — don't push the inputs down too
  far). Collapse gracefully when fields are absent (regular templates).
- Make sure it reads correctly in both Fresh Steel (light) and Obsidian (dark).

### Task 3 — Warmup sets at the start
**Why:** the PDF prescribes warmup sets; today none are created.

In `useWorkoutEffects.ts` `loadTemplate()`, when `isProgram` and
`programExtras.warmupSets > 0`, build the sets array as:
`[ ...warmupSets (isWarmup:true), ...workingSets ]`.

```ts
const warmupCount = ex.programExtras?.warmupSets ?? 0;
const working = Array.from({ length: setCount }, () =>
  createWorkoutSet({ reps, weight: 0 }));
const warmups = Array.from({ length: warmupCount }, () =>
  createWorkoutSet({ reps: 0, weight: 0, isWarmup: true }));
const sets = [...warmups, ...working];
```

- Feed warmup indices to `SetProgress` (`warmupIndices = new Set of indices where
  set.isWarmup`) so they render muted — compute from `exercise.sets` where it's
  rendered (`ExerciseDisplay`/`SetProgress` call site).
- Warmups must **not** count as working sets for the "סט X מתוך Y" working-set
  label, PR detection, or target-set completion. Check how `completedSetsCount` /
  `totalSets` are derived in `ExerciseDisplay` and exclude `isWarmup` from the
  *working* tally (or label warmups separately, e.g. "חימום" badge).
- Optional nicety: a small "חימום" divider/label between warmup and working sets.
- Edge: regular (non-program) templates keep today's single-set behavior.

### Task 4 — Shorter rest + ranges (rest & reps)
**Why:** rest is currently the high end (~240s) and shown as one number.

- Already handled in the data-model step: `restTime`/`restSeconds` now use the
  **low end**. Verify the rest timer (`calculateRestTime` →
  `workoutReducerHelpers.ts`) picks it up (it reads `programExtras.restTime`).
- Display the **range** in the prescription block ("מנוחה 3–5 דק'") and in the
  Program page day card (it already shows `מנוחה {ex.rest}` — keep/normalize to
  the en-dash Hebrew format).
- Show the **rep range** ("8–10") as the target wherever a single rep number is
  shown today (Program day card already shows `{workingSets}×{reps}`; ensure the
  runner's prescription block shows `repRange`, not just `targetReps`).
- Keep the rest **timer** itself adjustable (the existing ±15s controls) so the
  user can extend if they want the high end.

### Task 5 — Carry weight forward to the next set
**Why:** sets usually share a weight; don't make the user retype it.

In `workoutReducerSetHandlers.ts` `COMPLETE_SET`: after marking the active set
complete, find the **next set in the same exercise that is still empty**
(`weight === 0 && !completedAt`, skipping warmups appropriately) and seed
`weight = completedSet.weight` (and `reps = completedSet.reps` if the next set's
reps is 0). Immutable via the immer draft. This makes set 2 pre-show set 1's
weight. (`ADD_SET` already does this for *newly added* sets — mirror that logic.)

- Warmups: decide whether a completed warmup seeds the first working set. Prefer
  **not** seeding working sets from warmups (warmups are lighter). Only carry
  working→working and warmup→warmup.
- Don't overwrite a set the user already typed into (only seed when still empty).
- Test: complete set 1 with weight 60 → assert set 2's weight becomes 60 and is
  not marked complete.

### Task 6 — Final polish to "match the PDF"
- Make sure the Program **day card** (`Program.tsx`) and the **runner** show the
  same prescription language (ranges, RPE arrow, rest, warmup, technique,
  substitutions) so they feel like one document.
- Tempo/pause cues live inside the PDF `notes` (e.g. "1 second pause at the
  bottom"). Surface them via `coachingNote` (Task 2), don't bury them.
- Keep everything tokenized, RTL-correct (numeric sequences `direction:'ltr'` /
  `<bdi>`), no emoji, Lucide icons, 44px tap targets.

---

## 4. Additional improvements worth adding (the "extra things")

These raise the PDF-fidelity / quality bar; do as many as time allows, each
behind the same green gate:

1. **"Last time" ghost values per program exercise.** The runner already has a
   previous-session ghost cache (`usePreviousData` / `usePreviousSetData`,
   `clearPreviousDataCache`). Ensure a program exercise keyed by its (English)
   `exerciseId` shows last session's weight×reps as a ghost and offers a one-tap
   "use last" — so week-over-week progression is effortless. Pairs with Task 5.
2. **RPE-aware weight suggestion (autoregulation).** Using `oneRepMax`/e1RM
   (`src/utils/workoutMath.ts`) + PR history (`prService`), suggest a working
   weight that lands near `rpeTarget` for the `repRange`. Show as a dimmed
   suggestion, never auto-fill. Guard the no-history case.
3. **Warmup weight auto-suggest.** Warmup sets at ~40–60% of the first working
   set's weight (computed once the working weight is entered). Pure suggestion.
4. **Intensity-technique helper.** When `intensityTechnique` is a drop set /
   rest-pause / failure, pre-toggle the matching `SetTechnique` on the **last**
   set and/or show a one-line "how to" so the user performs it correctly.
5. **Deload weeks.** Check whether the PDF/`bbtProgram.generated.ts` encodes
   deloads (lighter weeks). If so, surface a "שבוע פריקה / Deload" badge on the
   week and dial back volume/intensity copy. If not encoded, add it to the
   generator (`program_extracted.json` + `generate_program_ts.py`) rather than
   hand-editing the generated file.
6. **Per-exercise rest auto-start with the range.** Auto-start the rest timer at
   `restSecondsMin` after a working set, with quick "+30ש'" to reach the high end.
7. **Program-day summary tie-back.** On finish, the post-workout summary should
   say which program day/week was completed and what's next (the reconcile
   already advances the pointer — surface it: "סיימת שבוע 3 · יום פלג עליון → הבא:
   פלג תחתון").
8. **Persist mid-workout swaps back to the program** (optional): thread
   `(week,dayType,order)` from the program template into each materialized
   exercise (e.g. on `programExtras`), so a mid-workout `SWAP_EXERCISE` can also
   call `setSwap(...)` and stick for next time.
9. **Data QA pass on `bbtProgram.generated.ts`.** Spot-check that
   `warmupSets`/`rest`/`reps`/`rpe` parsed cleanly for all 60 days (the file was
   PDF-parsed). Fix systematic defects in the generator + regenerate, not by hand.
   (Known small item: a few `muscle:'Other'` entries — e.g. "45° Hyperextension"
   — could map to Back/Legs.)
10. **Accessibility:** announce swaps and warmup/working transitions via the
    existing `WorkoutAriaLive`; keep Hebrew `aria-label`s on the new controls.

---

## 5. Suggested execution order & commits

1. Data model (`ProgramExtras` + `buildTemplateForDay` parsing) — green.
2. Task 3 (warmups) + Task 5 (carry-forward) — green, with reducer tests.
3. Task 1 (real swap) — green, with reducer test.
4. Task 2 (prescription block redesign) + Task 4 (ranges) — green; visual QA in
   light + dark.
5. Pick from §4 (additional) — each its own small commit.

Commit style: small, scoped, `feat(program)/feat(workout)` prefixes; end messages
with the project's `Co-Authored-By` trailer. Don't push to `master` (auto-deploys)
without the user's go-ahead.

## 6. Definition of done
- Running a program day shows: warmup set(s) → working sets, each with the rep
  range, RPE, rest range, technique, and a clean coaching note — visually like the
  PDF.
- Tapping "חלופות" mid-workout **replaces** the exercise (and can swap back).
- Set 2+ pre-fills the weight from the prior set.
- Rest defaults to the low end of the PDF range; the range is visible.
- `typecheck` clean · `test:run` all green (with new tests) · `build` OK.
- No new biome errors in files you touched; design system respected; RTL correct.
