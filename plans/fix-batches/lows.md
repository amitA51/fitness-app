## [0] LOW — ExerciseSelector recreates the `selectedIds` Set on every toggle, re-rendering all memoized ExerciseCards
**File:** src/components/workout/ExerciseSelector/index.tsx (line ~63)
**Dimension:** rerenders
**Description:** `handleSelect` builds a brand-new Set on each pick: `setSelectedExercises((prev) => { const next = new Set(prev); ... return next; })` (lines 63-71). This Set is threaded ExerciseSelector -> ExerciseLibraryTab (selectedIds prop) -> ExerciseList -> ExerciseCard. ExerciseCard is `memo`'d (ExerciseCard.tsx line 63) and its only changing prop on a toggle is `selectedIds`. Since the Set identity changes every toggle, the memo comparison fails for EVERY currently-rendered card, not just the one toggled — each tap re-renders all visible cards. ExerciseCard renders framer-motion `m.div` with inline style objects, so this is real work per card. Virtualization (ExerciseList.tsx VIRTUALIZE_THRESHOLD=15) caps the blast radius to on-screen rows, which keeps it minor.
**Proposed fix:** Pass a stable boolean instead of the Set. Either (a) compute `isSelected` in ExerciseList per item and pass `isSelected={selectedIds?.has(exercise.id)}` so ExerciseCard's only selection prop is a primitive, or (b) give ExerciseCard a custom memo comparator that compares `selectedIds.has(exercise.id)` rather than Set identity. Option (a) is cleaner and makes ExerciseCard re-render only when its own selected state flips.

## [1] LOW — WaterTracker reads localStorage (getWaterGoal/getGlassSize) in the render body on every render
**File:** src/components/nutrition/WaterTracker.tsx (line ~38)
**Dimension:** rerenders
**Description:** `const goalMl = getWaterGoal();` and `const glassMl = getGlassSize();` (lines 38-39) run inside the component body, so they execute on every render. WaterTracker is memo'd but it has its own state (totalMl, addTick) and re-renders on each add/remove tap and on each WATER_UPDATED_EVENT; each of those re-runs these synchronous localStorage reads (getWaterGoal/getGlassSize parse JSON from localStorage). The values only change when the user edits settings (already broadcast via events), so reading them every render is wasted work and means goalMl/glassMl are not reactive to settings changes anyway (they update only incidentally when some other state forces a re-render).
**Proposed fix:** Hold goal/glass size in state seeded from a lazy initializer and refresh them in the existing `settings-updated`/storage event listener pattern used elsewhere (e.g. useNutritionData's goals effect), e.g. `const [goalMl, setGoalMl] = useState(getWaterGoal)` plus an effect subscribing to the settings-updated event. This removes the per-render localStorage reads and makes the goal correctly reactive.

## [3] LOW — Rest-end ding from the local timer is not gated by the user's sound/vibrate settings
**File:** src/components/workout/hooks/useWorkoutTimer.ts (line ~120)
**Dimension:** bugs-state
**Description:** When the foreground rest timer reaches zero the hook calls `playDing()` unconditionally (line 120) before dispatching SYNC_REST_TIMER. The reducer's REST_END haptic/sound path is carefully gated on settings (WorkoutProvider lines 291-301 honor restTimerVibrate, restTimerSound and soundEnabled), but this local `playDing()` bypasses all of those gates, so a user who disabled rest-timer sound still hears the ding when the timer ends in the foreground. (playDing itself may consult the global audio gate, but it ignores the restTimerSound-specific setting that the reducer path respects.)
**Proposed fix:** Read the rest-timer sound settings (restTimerSound && soundEnabled) before calling playDing(), or remove the local playDing() and let the existing settings-gated REST_END handler in WorkoutProvider own all rest-end audio so there is a single, consistent code path.

## [4] LOW — Hardcoded '#30D158' celebration/PR green duplicated across components instead of --fs-signal/--color-success
**File:** src/components/workout/components/PerformanceAnalytics.tsx (line ~273)
**Dimension:** design-tokens
**Description:** The Apple '#30D158' green appears as a literal in multiple workout components (PerformanceAnalytics lines 273/426/468, IntensityMeter VolumeBar 'isComplete' gradient and box-shadow at lines 282-284). Completion/celebration is exactly the semantic the design system reserves --fs-signal (lime) and --color-success for. Hardcoding a third green here both violates token discipline and means completion states won't track the dark-mode success token (#34d98c).
**Proposed fix:** Replace literal '#30D158'/'#34C759' completion colors with var(--color-success) (or var(--fs-signal) where celebration is intended) so completion states are tokenized and dark-mode aware; centralize once rather than repeating the hex.

## [5] LOW — Hairline-on-every-row anti-pattern: divide-y AND per-row border-b on the same list
**File:** src/components/fitness/WorkoutComparison.tsx (line ~267)
**Dimension:** ui-mechanical
**Description:** The per-exercise comparison list is `<ul className='divide-y divide-[var(--color-separator)]'>` (267) where EACH `<li>` ALSO carries `border-b border-[var(--color-separator)] last:border-b-0` (280). That double-draws separators (divide-y already inserts a border between items, and border-b adds another), and it is exactly the 'border-t + border-b hairline on every row of a long list' lazy default that ui-preflight.md flags. Redundant and visually heavier than intended.
**Proposed fix:** Drop one of the two separator mechanisms — remove `border-b ... last:border-b-0` from the `<li>` and keep `divide-y` on the `<ul>` (or vice-versa). One separator system per list.

## [6] LOW — Raw <button> filter/sort/mood chips have no press feedback (active:scale / whileTap)
**File:** src/pages/coach/CoachHome.tsx (line ~197)
**Dimension:** ui-mechanical
**Description:** The shared Button component bakes in tactile press feedback (whileTap scale 0.98, src/components/ui/Button.tsx:323), but several interactive controls are hand-rolled raw `<button>` elements that bypass it and add no `active:scale`/transform. In CoachHome: the tag-filter chips (lines 197-215) and the SortButton (258-280) have inline styles with `cursor:'pointer'` but no press transform. Same in MyCoach.tsx mood buttons (lines 252-273) and the FoodLibrary accordion toggle (src/pages/nutrition/components/FoodLibrary.tsx:54-100). ui-preflight.md requires interactive elements to get `active:scale-[0.98]` or equivalent (respecting prefers-reduced-motion).
**Proposed fix:** Either route these through the shared Button (variant='pill'/'ghost') to inherit press feedback, or add a small press response (e.g. an `active:scale-[0.98]` Tailwind class / onPointerDown transform) gated by prefers-reduced-motion.

## [7] LOW — Numbers concatenated into Hebrew strings without dir="ltr", risking bidi flips
**File:** src/components/dashboard/CoachBriefCard.tsx (line ~173)
**Dimension:** hebrew-copy
**Description:** The weekly-volume delta renders `{sign}{facts.volumeChangePercent}%` (lines 173-174) with no dir="ltr" wrapper, so a value like '-12%' can bidi-reorder next to adjacent RTL/mono content. Similarly the readiness '/100' (line 132) and weeklyVolume (line 159) sit beside Hebrew 'ק"ג' without an ltr boundary. ui-preflight.md requires numbers render dir="ltr". CalorieHero and WorkoutSummary already do this correctly (dir="ltr" spans), so this card is the outlier; project-wide only 26 files use dir="ltr" vs many numeric surfaces.
**Proposed fix:** Wrap the numeric runs (percent, score, volume) in `<span dir="ltr">…</span>` as done in CalorieHero.tsx (line 189) and WorkoutSummary.tsx (line 517).

## [8] LOW — Hebrew greeting forced to LTR + left alignment in PreWorkoutScreen masthead
**File:** src/components/workout/states/PreWorkoutScreen.tsx (line ~308)
**Dimension:** hebrew-copy
**Description:** The h1 greeting ('בוקר טוב' / 'ערב טוב') is rendered with `direction: 'ltr'` and `textAlign: 'left'` (lines 308-309). For a pure-Hebrew word the visual order is unaffected, but it left-anchors the headline in an RTL screen (sitting on the wrong side of the masthead) and is semantically wrong direction for Hebrew text. Same forced-LTR pattern is applied to the 'אימון אחרון … תרגילים' label (line 471), which mixes Hebrew words with a number under direction:ltr and can misorder the trailing 'תרגילים'.
**Proposed fix:** Remove direction:'ltr'/textAlign:'left' from the Hebrew greeting (let it inherit RTL, align right/start). For mixed number+Hebrew lines, keep the container RTL and wrap only the number in dir="ltr".

## [9] LOW — Stale/incorrect design-system header comment ('Sport Annual', Big Shoulders) on a live screen
**File:** src/components/workout/states/PreWorkoutScreen.tsx (line ~2)
**Dimension:** hebrew-copy
**Description:** The file header comment names the design system as 'Sport Annual Editorial Design (VISION) Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono' (lines 2-5). Per design-aesthetics.md, the real system is 'Fresh Steel / Obsidian' and component headers must not name the legacy 'Sport Annual / Big Shoulders'. The body already uses var(--fs-*) tokens, so the comment is misleading drift that contradicts the project's own anti-slop rule (and the sibling WorkoutPlanScreen.tsx correctly says 'Fresh Steel / Obsidian').
**Proposed fix:** Update the header comment to reference Fresh Steel / Obsidian and the real token/font system, matching WorkoutPlanScreen.tsx.

## [10] LOW — JS smooth scrolling ignores prefers-reduced-motion
**File:** src/components/ui/BottomNav.tsx (line ~401)
**Dimension:** a11y
**Description:** scrollToTop() calls `window.scrollTo({ top: 0, behavior: 'smooth' })`. The global CSS `@media (prefers-reduced-motion: reduce){ ... scroll-behavior: auto !important }` (global.css line 918) only governs CSS-initiated scrolling, not the JS `behavior:'smooth'` option, so an animated scroll still plays for users who requested reduced motion. Same pattern in useMobileKeyboard.ts (lines 55, 204) and MessageThread.tsx scrollIntoView (line 62). WCAG 2.2 2.3.3 (Animation from Interactions, AAA) / honoring user motion preference.
**Proposed fix:** Gate the behavior on the media query, e.g. `const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });` and reuse a shared helper across the scrollTo/scrollIntoView call sites.

## [11] LOW — Always-on animated status dot (breathing-dot) in primary nav
**File:** src/components/ui/BottomNav.tsx (line ~101)
**Dimension:** a11y
**Description:** The active tab renders `<span className="breathing-dot" aria-hidden="true" />`. components.css (line 1136-1143) defines `.breathing-dot { animation: bd-breath 2.4s ... infinite; }` — a perpetually pulsing dot. The global reduced-motion rule sets `animation-iteration-count: 1` so it stops for reduced-motion users (good), but for everyone else it is a continuously animating indicator. The project's own design-aesthetics rule lists "Blinking 'live'/AI status dot → No animated status indicators" as a fingerprint to avoid. It is correctly aria-hidden, so this is a motion/design-polish issue rather than a screen-reader bug.
**Proposed fix:** Drop the infinite animation (make it a static accent dot), or limit it to a one-shot landing pulse keyed to tab change rather than an `infinite` loop, consistent with the no-animated-status-indicator rule.

## [12] LOW — errorReporter swallows Sentry failures, so service errors routed only through it can vanish entirely
**File:** src/services/errorReporter.ts (line ~30)
**Dimension:** error-handling
**Description:** reportError wraps Sentry.captureException in try/catch with an empty body: `} catch { // Sentry not initialized — swallow silently }`. syncEngine.syncWithRetry routes final sync failures to reportError (not to logger) as the sole record before queueing. If Sentry isn't initialized (the documented case) the error is logged nowhere — no console, no logger, no breadcrumb — making offline/sync failures undiagnosable in environments without Sentry.
**Proposed fix:** In the catch, fall back to logger.app.error(...) (or logger.sync.error) with the original error and context so the failure is still recorded locally when Sentry is unavailable, instead of being dropped.

## [13] LOW — manualChunks uses fragile substring match `id.includes('/react/')` that can misclassify vendor modules
**File:** vite.config.ts (line ~136)
**Dimension:** perf-bundle
**Description:** The manualChunks function routes modules with `id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')` into `react-vendor` (vite.config.ts line 136). The `/react/` substring is brittle: any node_modules package whose path contains a `/react/` segment (e.g. `@gsap/react`, `use-immer`-adjacent helpers, or transitive deps with `react` in the path) can be misrouted into react-vendor, and the ordering means earlier branches (`@tanstack`, `framer-motion`, `lucide-react`) must catch their packages first or they'd also match loosely. This works today but is a latent chunking-correctness bug as dependencies change.
**Proposed fix:** Match package boundaries explicitly, e.g. test against `id.includes('node_modules/react/')`, `id.includes('node_modules/react-dom/')`, `id.includes('node_modules/react-router')` / `react-router-dom`, anchoring on `node_modules/<pkg>/` rather than a bare `/react/` substring. Note `@gsap/react` is already intended for the gsap chunk, so ensure the gsap branch (which checks `@gsap`) stays ordered before any react branch.

