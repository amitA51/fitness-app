# Bundle, Motion, and PWA Performance Findings

## Scope and evidence

This is a read-only audit of the current working tree and generated service-worker output. No production build was rerun: chunk sizes, cold-route transfer, long-task, Pixel 5, and `2,533 KiB` precache figures marked **Audit input** are the requester-provided fresh measurements. Source-derived statements below cite `file:line`; generated-manifest observations cite `dist/sw.js:1`.

**Audit-input baseline.** The cold dashboard receives `index` (247.41 kB), `framer` (146.33 kB), and `gsap` (72.25 kB); the generated BBT payload is 217.98 kB; Supabase is 209.97 kB; `ActiveWorkoutNew` is 180.68 kB. Cold routes have 4–7 long tasks / 357–663 ms total blocking, and a live workout reaches 414 kB JavaScript. Treat all kB numbers as emitted-asset sizes unless explicitly called encoded wire transfer.

## Executive findings

| Priority | Finding | User-visible impact | Evidence |
|---|---|---|---|
| P0 | A dashboard visit always schedules the BBT catalog even when the user has never opted into the built-in program. A normal workout save and cloud restore can do so too. | Avoidable 217.98 kB generated-program download and parse for non-program users. | `[src/pages/Dashboard.tsx:23,550] [src/components/dashboard/ProgramCard.tsx:43–48,95–105] [src/components/workout/hooks/useWorkoutSave.ts:209–211] [src/services/supabaseSyncOrchestrator.ts:589–590]` |
| P1 | Dashboard has four static routes to the GSAP setup module; the requested dashboard cold load therefore fetches the `gsap` chunk. | Removing those dashboard paths saves the supplied 72.25 kB emitted GSAP chunk on that cold path. | `[src/pages/Dashboard.tsx:18,20,28,39,493,541,548,552,1029] [src/lib/gsap.ts:13–19] [vite.config.ts:151–153]` |
| P1 | Workbox precaches every built JS file, including route-only chunks; the current generated manifest has 139 entries, 110 of them JavaScript. | Large first-install storage/download cost, even for routes never visited. | `[vite.config.ts:58,67–99] [dist/sw.js:1]` |
| P2 | `domMax` is required by real sheet drag/reorder/layout behavior. Replacing it with `domAnimation` at the root is not a valid size optimization today. | Safe immediate saving is **0 kB**; a future feature-island refactor has only an ~11.95 kB Framer feature-budget opportunity, not a 146.33 kB guarantee. | `[src/main.tsx:5,121] [node_modules/framer-motion/dist/es/render/dom/features-animation.mjs:1–15] [node_modules/framer-motion/dist/es/render/dom/features-max.mjs:1–15] [node_modules/framer-motion/package.json:127–132]` |
| P2 | Several workout interactions animate layout properties or use `transition: all`; sheets can combine several costly blur/filter surfaces. | More main-thread layout/paint pressure under mid-range Android interaction, on top of the measured cold-route blocking. | `[src/components/workout/components/PRHighlights.tsx:112–113] [src/components/workout/WarmupCooldownSelectionStep.tsx:141,229,261] [src/components/workout/ExerciseSelector/index.tsx:225–226,382–383]` |

## 1. Why GSAP loads on Dashboard

### Verified import graph

`Dashboard` is route-lazy, but once `/` renders it statically imports several components/hooks that reach the common GSAP setup module:

```text
Dashboard:18 → components/charts/index:1–8 → ActivityRings:3 → lib/gsap:13–19
Dashboard:28 → WorkoutStreak:5 → lib/gsap:13–19
Dashboard:20 → CoachBriefCard:14 → lib/gsap:13–19
Dashboard:39,1029 → useCountUp:15 → lib/gsap:13–19
```

The rendered Dashboard call sites are `ActivityRings` at line 493, two `CoachBriefCard` variants at 541/548, `WorkoutStreak` at 552, and the direct count-up helper at 1029. `[src/pages/Dashboard.tsx:18,20,28,39,493,541,548,552,1029]`

`ActivityRings` imports GSAP / `useGSAP`, draws `strokeDashoffset` in a timeline, adds a scale pulse, and temporarily animates a `drop-shadow` filter for a completed goal. `[src/components/charts/ActivityRings.tsx:3,80–143]` `WorkoutStreak` imports the same GSAP helpers, uses the shared counter, and animates a filter glow. `[src/components/dashboard/WorkoutStreak.tsx:5,45–67]` The shared counter imports GSAP and writes text on each tween update. `[src/hooks/useCountUp.ts:15,52–91]`

`CoachBriefCard` is also an avoidable boundary violation: it imports only `DUR`, but that constant comes from the GSAP module, so evaluating the constant import evaluates the GSAP module; it also uses `useCountUp`. `[src/components/dashboard/CoachBriefCard.tsx:14,111–116]` The central module imports `@gsap/react`, `gsap`, and `Physics2DPlugin`, then registers plugins at module scope. `[src/lib/gsap.ts:13–19]` Vite explicitly groups GSAP and `@gsap/*` into a dedicated `gsap` vendor chunk. `[vite.config.ts:151–153]`

**Not the cause.** `AnimatedBar` is React-only and already uses compositor-friendly `scaleX` plus a transform-only transition. `[src/components/charts/AnimatedBar.tsx:1,86–91]` `RingProgress` imports only React types / `memo`; it does not import GSAP. `[src/components/charts/RingProgress.tsx:1–2]` The charts barrel is part of the resolution path, but the confirmed cause is `ActivityRings`’ direct GSAP import. `[src/components/charts/index.ts:1–8]`

### Recommended dashboard replacement

1. **Replace `ActivityRings`’ GSAP timeline with CSS or Framer Motion.** Animate SVG `stroke-dashoffset` with a staggered `m.circle` transition or a CSS transition/class trigger; retain the goal scale as a short transform animation and remove/soften the animated `filter` glow. Framer is already part of the supplied Dashboard cold path, whereas filter animation is paint-heavy. `[src/components/charts/ActivityRings.tsx:80–143] [src/main.tsx:5,121]`
2. **Replace Dashboard count-up selectively.** For glance values, render the final number; where a count-up is essential, use a tiny local `requestAnimationFrame` counter that writes `textContent`, not a general GSAP dependency. Framer does not turn numeric text interpolation into a zero-cost primitive. `[src/hooks/useCountUp.ts:52–91]`
3. **Move duration/easing primitives out of `lib/gsap.ts`.** Put shared scalar tokens in a GSAP-free `motionTokens` module, and update `CoachBriefCard` and any replacement animation to import that file instead. `[src/components/dashboard/CoachBriefCard.tsx:14] [src/lib/gsap.ts:23–45]`
4. **If deferring rather than removing, defer the whole dashboard GSAP island.** Lazily loading only `WorkoutStreak` is insufficient because `Dashboard` itself calls `useCountUp`. All direct dashboard GSAP consumers must move behind the idle/interaction boundary. `[src/pages/Dashboard.tsx:39,1029]`

The supplied 72.25 kB is the maximum emitted GSAP-chunk saving on Dashboard’s cold route once no Dashboard static path reaches GSAP. It is **not** an exact encoded transfer saving and does not remove GSAP from other routes. `BottomNav` demonstrates the desired non-critical pattern: it has a memoized dynamic `import('../../lib/gsap')` and loads only after navigation interaction, while using local primitive motion tokens until then. `[src/components/ui/BottomNav.tsx:26–37,369–385]`

## 2. Generated BBT program payload: static chains and exact split

### Static chains

The only literal static BBT imports are in `programService` and the Program page. `[src/services/programService.ts:21] [src/pages/Program.tsx:20]` They create these relevant chains:

| Chain | Current result |
|---|---|
| `AppRouter` lazy Program route → `pages/Program` direct `BBT_PROGRAM` import | Correctly route-gated: it is acceptable after an explicit `/program` visit. `[src/AppRouter.tsx:77] [src/pages/Program.tsx:20]` |
| `AppRouter` lazy Program route → `pages/Program` → `programService` → static BBT import | A second Program-route path to the same generated catalog. `[src/AppRouter.tsx:77] [src/pages/Program.tsx:23–36] [src/services/programService.ts:21,81–90]` |
| `AppRouter` lazy workout content → `ActiveWorkoutNew` → `programService` → static BBT import | Opening any active workout imports program logic even where no built-in program is active. `[src/AppRouter.tsx:102–105] [src/components/workout/ActiveWorkoutNew.tsx:10–16,197–211,537] [src/services/programService.ts:21]` |

The monolithic service eagerly creates a day map from `BBT_PROGRAM`; it also uses the generated payload for block lookup, day materialization, and starting the program. `[src/services/programService.ts:81–90,195–199,431–457,544]`

### Dynamic paths that still violate the non-program-user goal

`ProgramCard` is dynamically importing both the generated catalog and service, but its mount effect immediately calls `refresh()`, which immediately runs `computeProgramView()`. Consequently every Dashboard mount schedules both downloads. `[src/components/dashboard/ProgramCard.tsx:43–48,95–105]` A normal workout completion dynamically imports `programService` solely to reconcile progress, and cloud pull does the same to restore progress. `[src/components/workout/hooks/useWorkoutSave.ts:209–211] [src/services/supabaseSyncOrchestrator.ts:589–590]`

### Required design, not a one-line lazy import

To make **“never opens the built-in program” imply “never downloads `bbtProgram.generated`”** true, split the current monolith along data dependency lines:

| New boundary | Contents | Consumers / required change |
|---|---|---|
| `programProgressService.ts` | `ProgramProgress`, `TRAINING_DAYS`, local-storage persistence, cloud mirror/restore, swaps, reset/start state, and reconciliation. It must use only small metadata (`id`, `totalWeeks`, title/block labels), never a generated day/exercise import. | `ProgramCard` first reads progress from this module; `useWorkoutSave` imports reconciliation here; `supabaseSyncOrchestrator` imports restore here. `[src/services/programService.ts:21,24–79,161–219,488–544] [src/components/workout/hooks/useWorkoutSave.ts:209–211] [src/services/supabaseSyncOrchestrator.ts:589–590]` |
| `bbtProgramMetadata.ts` | Tiny hand-authored/generated metadata sufficient for a not-started card and progress arithmetic. | Use it in `ProgramCard`; do **not** resolve a day or its exercise count until progress is active. `[src/components/dashboard/ProgramCard.tsx:43–68]` |
| `programCatalogService.ts` | The only service allowed to load `bbtProgram.generated`: `getProgramDay`, block/day/exercise lookup, options, and actual day-template materialization / `startProgramDay`. Use `import type` for `Bbt*` types where possible. | `Program.tsx` can statically use this because its route is already lazy. `ActiveWorkoutNew` loads it only after an active program exists or the user explicitly chooses a program day. `[src/pages/Program.tsx:20–36] [src/components/workout/ActiveWorkoutNew.tsx:197–211,537]` |

Concretely, change `ProgramCard` to render its no-progress state from the tiny metadata plus `getProgress()`; only dynamically load the catalog after it discovers active BBT progress or the user navigates to `/program`. `[src/components/dashboard/ProgramCard.tsx:43–68,95–105]` Change `ActiveWorkoutNew` to import progress-only state eagerly and dynamically import catalog/materialization only inside the built-in-program branch; the normal free/template workout path must never mention the catalog module. `[src/components/workout/ActiveWorkoutNew.tsx:10–16,197–211,537]` Keep `Program.tsx` route-gated, but make it consume the split services rather than the old monolith. `[src/AppRouter.tsx:77] [src/pages/Program.tsx:20–36]`

This removes the supplied **217.98 kB emitted BBT chunk** from Dashboard, ordinary workout, ordinary workout-save, and authenticated-sync paths for a user who has not opted in. It does not prevent an opted-in program user from loading the catalog, which is the correct product behavior. Regression coverage should split the existing service tests and retain cloud restore and card behavior tests. `[src/services/__tests__/programService.test.ts:1–269] [src/services/__tests__/programProgressCloudBackup.test.ts:45–96] [src/components/dashboard/ProgramCard.test.tsx:4–24]`

## 3. Entry graph and boot work

### What currently happens at boot

`main.tsx` statically imports Framer features, the app shell, PWA prompt, lightweight Sentry facade, AI bootstrap, notification service, offline queue, tracking consent, and `web-vitals`. `[src/main.tsx:5–22]` It immediately calls `initAI()` and `initOfflineSync()`, and calls the missed-workout check when notification permission is already granted. `[src/main.tsx:104–115]` `initWebVitals()` is consent-gated at runtime, but its module is still a static import, so the `web-vitals` package belongs to the initial module graph. `[src/main.tsx:16,28–67] [src/services/webVitals.ts:1–34]`

| Category | Current behavior | Recommendation |
|---|---|---|
| Keep eager | Locale/settings and the motion preference wrapper prevent RTL/theme/preference flash; the app root mounts those providers around Auth and Entitlement. `[src/App.tsx:1–8,31–36]` DataContext loads recent IndexedDB sessions on mount, which powers visible Dashboard content. `[src/contexts/DataContext.tsx:62–101]` | Do not trade correct first paint / session data for a superficial import reduction. |
| Already correctly deferred | `loadSentry()` dynamically imports `@sentry/react` only after analytics consent; the static facade uses type-only imports and no-op methods until then. `[src/main.tsx:28–67] [src/lib/sentryLazy.ts:1–49]` | Leave Sentry’s deferred design intact; do **not** report the SDK as eager. |
| Easy / medium deferral | Move `webVitals` to `await import('./services/webVitals')` inside `startAnalytics()`. Defer AI provider selection to first AI use or idle. Defer the already-permitted missed-workout check until after first paint. `[src/main.tsx:12–16,28–67,104–115] [src/services/ai/bootstrap.ts:12–29] [src/services/notificationService.ts:171–190]` | Removes `web-vitals` from consentless boot and shifts two non-visual tasks after first paint. Exact byte/ms delta needs a rebuild/trace; it is not measurable from source alone. |
| Correctness-sensitive deferral | Offline queue startup installs listeners, processes pending mutations, and starts a 90-second retry interval. `[src/main.tsx:108] [src/services/offlineQueue.ts:1123–1157]` | Schedule after first paint **and after auth resolves**, but retain immediate online wiring / pending-mutation recovery. Do not defer blindly. `OfflineIndicator` also statically imports queue APIs and reads queue depth, so changing only `main.tsx` cannot remove its graph. `[src/components/ui/OfflineIndicator.tsx:1–50]` |
| PWA timing | `PWAUpdatePrompt` registers the worker on mount and keeps update checks alive. `[src/main.tsx:9,121–130] [src/components/pwa/PWAUpdatePrompt.tsx:10–39]` | Treat deferral as low-return and medium-risk: it changes update/offline timing, not a proven large bundle bottleneck. |

### Supabase and the guest path

The root app statically mounts Auth and Entitlement. `[src/App.tsx:5–6,31–36]` `AuthContext` statically imports the client, and its effect only early-returns for unconfigured Supabase; it still calls `getSession()` and subscribes when the configured app is in explicit guest mode. `[src/contexts/AuthContext.tsx:18,57–69,140–153]` The client is created at module evaluation when environment configuration exists. `[src/lib/supabase.ts:31–41]`

Adding an `isGuest` guard to the network effect is worthwhile, but it does **not** remove the bundle: root imports also pull cloud-oriented entitlement, age, consent, coach, and navigation service code. `[src/App.tsx:6] [src/AppRouter.tsx:32–40,347–355,850–916] [src/contexts/EntitlementContext.tsx:16–23,49–61] [src/contexts/AgeGateContext.tsx:39–53] [src/contexts/ConsentContext.tsx:62–76] [src/contexts/CoachContext.tsx:25–26,151–206] [src/components/ui/BottomNav.tsx:20]`

The high-impact option is a **guest/local shell versus authenticated capability-tree split**: resolve explicit local guest state without statically importing the cloud provider tree, then lazy-load Auth/Supabase, Entitlement, AgeGate, Consent, Coach, and cloud navigation features for login/resumed sessions. The supplied upside is **up to 209.97 kB emitted Supabase vendor code on explicit guest cold load**, not a saving for signed-in boot. This is an L/high-risk change because auth restoration, guest-to-login migration, guards, background sync, and RLS-backed flows must remain correct. The existing provider guards avoid guest network calls but do not make their code lazy. `[src/contexts/EntitlementContext.tsx:49–61] [src/contexts/ConsentContext.tsx:62–76] [src/contexts/AgeGateContext.tsx:39–53] [src/contexts/CoachContext.tsx:151–206]`

## 4. Framer Motion: `domMax` verdict

**Verdict: keep `LazyMotion features={domMax}` today.** `domAnimation` contains the renderer, animation features, and gesture animations; `domMax` adds the drag and layout features on top. `[node_modules/framer-motion/dist/es/render/dom/features-animation.mjs:1–15] [node_modules/framer-motion/dist/es/render/dom/features-max.mjs:1–15]` The root installs `domMax`. `[src/main.tsx:5,121]`

Actual `domMax` consumers are not speculative:

| Needed feature | Current consumers |
|---|---|
| Drag sheet / pan behavior | Generic `ModalOverlay`; `ExerciseSelector`; `ExerciseReorder`; `WorkoutSettingsOverlay`; `SupersetPicker`. `[src/components/ui/ModalOverlay.tsx:5,162,357,364–365] [src/components/workout/ExerciseSelector/index.tsx:4,87,213–218] [src/components/workout/ExerciseReorder.tsx:256,447–480] [src/components/workout/overlays/WorkoutSettingsOverlay.tsx:109–112] [src/components/workout/components/SupersetPicker.tsx:111–114]` |
| Drag reorder plus layout projection | `ExerciseReorderItem` uses `Reorder.Item`, `useDragControls`, `whileDrag`, and `layout`. `[src/components/workout/reorder/ExerciseReorderItem.tsx:1,63,68–82]` |
| Layout / shared-layout animation | `GlobalToast` uses `layout`; `SegmentedControl` and onboarding `ProgressDots` use `layoutId`. `[src/components/ui/GlobalToast.tsx:133] [src/pages/progress/components/SegmentedControl.tsx:127] [src/pages/onboarding/components/ProgressDots.tsx:29]` |

The package’s declared size budgets are 17.85 kB for `domAnimation` and 29.8 kB for `domMax`, an **approximately 11.95 kB feature-budget difference**. `[node_modules/framer-motion/package.json:127–132]` That is neither a measured Vite delta nor a reason to claim a 146.33 kB saving: Vite currently groups every `framer-motion` module into the shared `framer` chunk. `[vite.config.ts:148–150]`

A future optimization requires: (1) retain `domAnimation` for the root, (2) put all drag/reorder/layout consumers behind deferred feature islands, (3) dynamically load the `domMax` feature bundle only with those islands, and (4) revise the one-chunk Framer manual-chunk rule. Until all four are true, switching the root prop risks broken drag, reorder, and layout functionality for **0 safe kB saving**.

## 5. Mid-range Android motion/rendering findings

### Layout and paint work

| Finding | Locations | Recommended change |
|---|---|---|
| Width animation triggers layout | PR highlight and muscle bars animate `width` from zero to a percentage. `[src/components/workout/components/PRHighlights.tsx:112–113] [src/pages/workout-detail/MuscleBreakdown.tsx:121–122]` | Use a full-width fill and animate `scaleX` from the RTL-correct origin, following `AnimatedBar`’s existing pattern. `[src/components/charts/AnimatedBar.tsx:86–91]` |
| `height: 'auto'` requires measurement/layout during expansion | Workout history, reorder-item detail, food library, strength section, and template creation. `[src/components/workout/PRHistoryTab.tsx:137–139] [src/components/workout/reorder/ExerciseReorderItem.tsx:329–331] [src/pages/nutrition/components/FoodLibrary.tsx:194–196] [src/pages/progress/tabs/StrengthSection.tsx:335–337] [src/pages/templates/components/CreateTemplateModal.tsx:378–380]` | On frequent workout surfaces, make outer layout instant and animate a short child opacity/transform; use a bounded/clip expansion only after visual and a11y testing. |
| `transition: all` asks the browser to consider unrelated properties | Warmup/cooldown selection (three sites), active step, pre-workout, summary, chart, recovery modal, and workout preferences. `[src/components/workout/WarmupCooldownSelectionStep.tsx:141,229,261] [src/components/workout/WarmupCooldownActiveStep.tsx:294] [src/components/workout/states/PreWorkoutScreen.tsx:667] [src/components/workout/WorkoutSummary.tsx:759] [src/components/charts/GlowAreaChart.tsx:380] [src/pages/progress/modals/AddRecoveryModal.tsx:168] [src/pages/settings/sections/WorkoutPrefsSection.tsx:63]` | Replace each with only the properties that change, normally `background-color`, `border-color`, `color`, `opacity`, and/or `transform`. |
| Filter / painted effects | Dashboard streak and rings animate `filter`; skeleton shimmer animates a moving background. `[src/components/dashboard/WorkoutStreak.tsx:57–67] [src/components/charts/ActivityRings.tsx:120–143] [src/styles/motion.css:58–65] [src/styles/components.css:412–434]` | Dashboard GSAP removal eliminates the first two. Keep skeletons modest and avoid treating background-position shimmer as compositor-only. |

None of the listed changes has a trustworthy source-only millisecond saving. Their value is avoiding repeated layout/paint work within the 16.7 ms frame budget; validate their impact with Android Performance traces rather than inventing a ms number.

### `will-change` and layer lifetime

The global loop classes retain `will-change: transform, opacity` for the entire node lifetime; `AppPageLoader` actively uses `animate-shimmer`. `[src/styles/global.css:960–963] [src/AppPageLoader.tsx:24]` This is more bounded than applying it to every entrance row, but it should remain limited to genuinely animating loaders/spinners and be removed when an animation settles.

`.magnetic-card` has permanent `will-change: transform`, while Dashboard’s coach card applies that class. `[src/styles/components.css:1497–1508] [src/components/dashboard/CoachBriefCard.tsx:176]` This can increase layer-memory pressure across cards and gives touch-first Android no hover benefit. Restrict hover lift and the hint to `@media (hover: hover) and (pointer: fine)`, or apply the hint only for the active hover/press interval. The BottomNav pill is a positive counterexample: it hints only `transform` for one shared element and explicitly avoids width/height. `[src/components/ui/BottomNav.tsx:537–540]`

### Backdrop-filter stack

The app intentionally has a reduced-transparency fallback for glass surfaces. `[src/styles/components.css:1326–1359]` Nevertheless, visible interaction surfaces include a 20 px BottomNav and Dashboard header, 18 px workout header/bottom bar, and ExerciseSelector’s 24 px header plus 20 px footer. `[src/components/ui/BottomNav.tsx:507–512] [src/components/dashboard/DashboardHeader.tsx:47–48] [src/components/workout/components/WorkoutHeader.tsx:238–239] [src/components/workout/active/WorkoutBottomBar.tsx:85–86] [src/components/workout/ExerciseSelector/index.tsx:225–226,382–383]` Generic modal overlays and several workout panels add further blur. `[src/components/ui/ModalOverlay.tsx:322–323] [src/components/ui/GlobalToast.tsx:144–145] [src/components/workout/WorkoutSummary.tsx:884–885] [src/components/workout/ExerciseTutorial.tsx:384–385] [src/components/workout/states/WorkoutPlanScreen.tsx:465–466]`

These are coexisting surfaces, not proof that every blur overlaps every pixel. On a sheet route, however, overlay plus sheet chrome and persistent chrome can multiply backdrop sampling/compositing cost. Preserve the nav treatment and accessibility fallback, but use opaque sheet header/footer backgrounds, choose one blur plane per interaction, and cap non-navigation interaction blur around 8–12 px. The existing modal utility’s 8 px definition is a sensible reference point. `[src/styles/global.css:1270–1272]`

## 6. PWA precache: narrow the shell and runtime-cache route chunks

The current Workbox glob is universal: `**/*.{js,css,html,ico,png,svg,woff2}`. `[vite.config.ts:58]` Its runtime routes cover Google styles, Google fonts, and image/font extensions, but not same-origin hashed JavaScript route chunks. `[vite.config.ts:67–99]` The checked generated worker contains 139 precache entries, including 110 JS assets and named lazy chunks such as BBT, ActiveWorkout, Progress, Nutrition, Settings, and GSAP. `[dist/sw.js:1]`

The generated HTML shows the current app-shell entry plus modulepreloads for React vendor, Supabase, Framer, icons, and Immer. `[dist/index.html:24–30]` Replace the universal glob with an explicit shell allowlist (adapt names after each build rather than assuming hash values):

```ts
// Representative allowlist; retain the manifest icons and push worker.
globPatterns: [
  'index.html',
  'assets/index-*.js',
  'assets/react-vendor-*.js',
  'assets/supabase-*.js', // only while the current root remains cloud-eager
  'assets/framer-*.js',
  'assets/icons-*.js',
  'assets/immer-*.js',
  'assets/index-*.css',
  'assets/workbox-window*.js',
  'push-sw.js',
  'favicon.ico', 'favicon.svg', 'favicon-*.png', 'apple-touch-icon.png',
  'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png',
]
```

Keep `cleanupOutdatedCaches`, navigation fallback, and the explicit `push-sw.js` import. `[vite.config.ts:61–66]` Do **not** cache Supabase REST responses at the service-worker layer; the current source intentionally avoids that because responses are user-scoped and the app is IndexedDB-first. `[vite.config.ts:69–72]`

Add a same-origin `/assets/*.js` **runtime** `CacheFirst` rule with conservative expiration (for example 60–90 entries / 30 days, cacheable 0/200 responses). Content-hashed route assets are suitable for this: first online use fills the cache, subsequent visits work offline until the entry expires. The pre-cache route will continue to win for shell assets.

Move BBT, Program, Progress, Nutrition, Settings, coach/community, and other route-only JS to that runtime cache. Images/fonts already have an assets runtime cache; retain only launch/manifest branding assets in the precache. `[vite.config.ts:92–99]` For `ActiveWorkoutNew`, make the product choice explicit:

* **Strong first-offline workout guarantee:** keep it precached, or warm it immediately on explicit “start workout” intent.
* **Smallest install:** runtime-cache it too, accepting that a user must visit/prefetch it online before a first offline workout.

Using the supplied sizes, moving BBT + Progress + Nutrition + Settings is about **450.55 kB emitted**; moving ActiveWorkout too makes the named total **631.23 kB**. After the Dashboard GSAP fix, GSAP adds **72.25 kB**, for about **703.48 kB**. Those are lower-bound, approximate 18% / 25% / 28% comparisons against the supplied 2,533 KiB precache because the figures mix build kB and Workbox KiB and omit other lazy chunks. Re-check the generated manifest, first-install bytes, and route behavior after implementation.

## 7. Ranked remediation list

| Rank | Fix and exact files to touch | Effort / risk | Expected outcome |
|---|---|---|---|
| 1 | Split `src/services/programService.ts` into new progress, metadata, and catalog services; update `src/components/dashboard/ProgramCard.tsx`, `src/components/workout/ActiveWorkoutNew.tsx`, `src/components/workout/hooks/useWorkoutSave.ts`, `src/services/supabaseSyncOrchestrator.ts`, and `src/pages/Program.tsx`; split/update the program tests. | L / medium-high (persisted progress + cloud restore) | **217.98 kB emitted** BBT payload no longer downloads for users who never opt in; verify Dashboard, ordinary workout, save, and sync have no BBT request. |
| 2 | Replace Dashboard GSAP paths in `src/pages/Dashboard.tsx`, `src/components/charts/ActivityRings.tsx`, `src/components/dashboard/WorkoutStreak.tsx`, `src/components/dashboard/CoachBriefCard.tsx`, and `src/hooks/useCountUp.ts`; introduce GSAP-free tokens if needed. | M / low-medium (visual parity/reduced motion) | **72.25 kB emitted** removed from Dashboard cold path; lower filter/paint work. |
| 3 | Narrow `vite.config.ts` Workbox shell glob; add same-origin route-script runtime caching; use `src/utils/routePrefetch.ts` / explicit workout intent if choosing active-workout warming. | M / medium (offline first-use policy, SW updates) | **450.55–631.23 kB emitted** named precache reduction before GSAP; **+72.25 kB** after Dashboard GSAP change. |
| 4 | Split guest shell from authenticated cloud capability tree across `src/main.tsx`, `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/AppRouter.tsx`, Entitlement/Age/Consent/Coach contexts, and cloud navigation imports. | L / high (auth/session/sync correctness) | Up to **209.97 kB emitted** Supabase vendor code avoided on explicit guest cold boot; zero such saving for signed-in users. |
| 5 | Move `web-vitals` dynamic import into `startAnalytics`; defer AI bootstrap and permitted missed-workout check in `src/main.tsx` / their services. | S–M / low | Removes web-vitals from no-consent initial graph and shifts non-visual boot work after paint; **byte/ms delta unmeasured**, so re-profile rather than promise one. |
| 6 | Redesign queue boot as an auth-aware post-paint bootstrap and decouple the eager queue import from `src/components/ui/OfflineIndicator.tsx`; touch `src/main.tsx`, `src/services/offlineQueue.ts`, and the indicator. | M / high (durability and sync recovery) | No assured kB saving until imports are split; moves queue replay work out of critical startup without dropping online recovery. |
| 7 | Replace `transition: all`, width/height animations, and lifetime card `will-change` in the cited workout/chart/styles files; reduce sheet blur. | S–M / low-medium (visual behavior) | **0 JS kB**; removes avoidable layout/paint/layer pressure. Measure frame time on Pixel-class Android. |
| 8 | Consider `domAnimation` feature islands only after isolating all current drag/reorder/layout consumers and revising `vite.config.ts` Framer manual chunking. | L / medium-high (gesture/reorder breakage) | **0 safe kB now**; at most about **11.95 kB** Framer feature-budget opportunity after the full refactor, not 146.33 kB. |

## Validation gates after implementation

1. Rebuild production and compare emitted assets, encoded transfer, precache count/bytes, and long tasks with the supplied Pixel 5 / 4× baseline.
2. In an incognito/cleared-cache guest session, verify no `bbtProgram.generated` request from Dashboard, a normal active workout, an ordinary workout save, or sync; then verify an opted-in program still starts, advances, swaps exercises, restores cloud progress, and works offline after the chosen warm/cache policy.
3. Verify explicit guest load has no Supabase modulepreload/request only after the whole capability tree is split; separately test returning authenticated sessions, login, logout, and account switching.
4. Test PWA first-launch offline shell, post-visit offline lazy routes, first-offline active workout according to the selected policy, update prompt behavior, and confirm authenticated API data remains outside the service-worker cache.
5. Record Android Performance traces while opening/dragging sheets, reordering exercises, expanding accordions, and honoring reduced motion/reduced transparency; accept visual changes only if interaction stays responsive and RTL behavior remains intact.
