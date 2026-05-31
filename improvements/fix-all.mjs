export const meta = {
  name: 'sparkos-fix-all',
  description: 'Six Opus fixer agents repair sparkos-fitness-app findings in disjoint file groups, then verify+repair to green',
  phases: [
    { title: 'Fix', detail: 'six parallel fixers, disjoint file ownership' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix any failures to green' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const COMMON = [
  'You are fixing the React+TS+Vite+Supabase PWA at ' + ROOT + ' (package "sparkos-fitness-app").',
  'HARD RULES:',
  '- ONLY edit files in YOUR assigned list below. NEVER touch files owned by other groups — other agents edit them in parallel and you will create merge conflicts.',
  '- Make MINIMAL, surgical diffs that fix the specific finding. Do not reformat untouched code.',
  '- MATCH the existing code style, naming, imports, and patterns in each file. Read the file fully before editing.',
  '- Respect project rules in .claude/rules: immutability (never mutate, return new objects), explicit error handling (NEVER silently swallow — log via the project logger at minimum), files under 800 lines, functions under 50 lines.',
  '- Do NOT read or write any .md files.',
  '- When you fix logic, add or extend the relevant vitest test if a __tests__ folder exists nearby and the fix is unit-testable. Use the project AAA test style.',
  '- If a finding requires a breaking change to a shared type/signature that other groups import, DO NOT do it — add it to "deferred" with a reason. Prefer additive, non-breaking changes; when a rename is needed, keep a backward-compat re-export alias.',
  '- After editing, re-read your changed files to confirm coherence and that imports you reference exist. Do NOT run build/test yourself (a dedicated verify phase runs after).',
  '- Report in Hebrew in the structured output.',
].join('\n')

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          finding: { type: 'string' },
          what: { type: 'string', description: 'what was changed, Hebrew' },
          testsAddedOrUpdated: { type: 'array', items: { type: 'string' } },
        },
        required: ['file', 'finding', 'what'],
      },
    },
    deferred: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['group', 'changed', 'deferred', 'risks'],
}

const GROUPS = [
  {
    key: 'A-sync-services',
    prompt: COMMON + '\n' + [
      'GROUP A — DATA SYNC / SERVICES. Edit ONLY these files:',
      'src/services/sessionDb.ts, src/services/templateDb.ts, src/services/cloudMerge.ts, src/services/supabaseSync.ts, src/services/waterService.ts, src/services/offlineQueue.ts, src/services/prService.ts, src/services/notificationService.ts, and src/services/__tests__/ (tests here only).',
      '',
      'FIX THESE FINDINGS:',
      '1. [CRITICAL] Deleted workout/template resurrects after pull. mergeWorkoutSessionsFromCloud (sessionDb.ts:196-230) and mergeWorkoutTemplatesFromCloud (templateDb.ts:184-218) ignore deletedAt, while mergeGenericRecords (cloudMerge.ts:122-146) deletes the local record when cloud.deletedAt is set. FIX: make both bespoke merges tombstone-aware exactly like mergeGenericRecords (if cloud.deletedAt set -> dbDelete local and skip; else LWW by updatedAt). ALSO make the merge writes atomic in a single readwrite IndexedDB transaction like cloudMerge.ts:148-164 (currently Promise.all of separate dbPut). ALSO make public reads exclude tombstoned rows: getWorkoutSessions / getAllWorkoutSessions (sessionDb.ts:64-136) and getWorkoutTemplates (templateDb.ts:20-23) must filter out records whose deletedAt is set, since analytics/PR scan all history.',
      '2. [HIGH] All fetch funcs return [] on error -> partial pull reported as success. In supabaseSync.ts fetch funcs (~80-160) catch and return []. FIX: distinguish empty from fetch-error (throw or return a discriminated error), and make pullAllDataImpl (1239-1251) use Promise.allSettled, mark success:false and include the failing stores in SyncResult.error when any fetch fails. Same for waterService.fetchWaterLogs (waterService.ts:99).',
      '3. [HIGH] limit(500) without pagination silently truncates history (supabaseSync.ts:82,155,236,306,367,438,513,589). FIX: implement keyset/range pagination that pulls ALL rows (loop with .range(from,to) until a short page returns), page size ~1000, and filter deleted_at in the fetch queries so tombstones do not eat the budget.',
      '4. [HIGH] mergeWaterLogsFromCloud only inserts (waterService.ts:108-116); deleteCloudWaterEntry hard-deletes (no tombstone). FIX: move water to soft-delete (deleted_at) and route through tombstone-aware merge, OR add update+delete reconciliation so deletions/updates propagate. Match how sessions handle it.',
      '5. [HIGH] AI conversation merge is whole-array LWW (cloudMerge.ts:184-186; syncAIConversation writes whole messages array, supabaseSync.ts:694-702) -> parallel edits lose messages. FIX: add a dedicated AI-conversation merge that unions messages by message.id (keep both sides, sort by timestamp) instead of replacing the whole array.',
      '6. [MEDIUM] offlineQueue ordering non-deterministic on equal timestamps (offlineQueue.ts:156-166,346-393). FIX: add a monotonic sequence counter per mutation and sort the queue by sequence (fallback timestamp) so create->delete->update FIFO holds.',
      '7. [LOW] user_settings delete does not propagate (supabaseSync.ts:628-647). Add soft-delete handling consistent with the generic merge (preferred), or leave a clear comment if intentional.',
      '8. [LOW] Empty .catch(()=>{}) swallow errors in prService.ts:230-235 and notificationService.ts:85,89,96,100. FIX: log via the project logger (logger.warn) inside the catch, preserving best-effort behavior.',
      '',
      'Trace deleteWorkoutSession -> tombstone -> pull to confirm fix #1. Add/extend tests in src/services/__tests__ for tombstone propagation and fetch-error handling.',
    ].join('\n'),
  },
  {
    key: 'B-workout-engine',
    prompt: COMMON + '\n' + [
      'GROUP B — WORKOUT STATE ENGINE. Edit ONLY these files:',
      'src/components/workout/core/workoutReducer.ts, src/components/workout/core/WorkoutProvider.tsx, src/components/workout/core/WorkoutContext.tsx, src/components/workout/hooks/useWorkoutTimer.ts, src/components/workout/hooks/useWorkoutSettings.ts, src/components/workout/hooks/usePreviousData.ts, src/services/workoutSessionBuilder.ts, and src/components/workout/core/__tests__/ (tests here only).',
      'NOTE: WorkoutProvider.tsx / WorkoutContext.tsx may contain uncommitted user refactors — read the CURRENT file state carefully before editing.',
      '',
      'FIX THESE FINDINGS:',
      '1. [HIGH] setReducer guard blocks EDIT_SPECIFIC_SET/DELETE_SET by CURRENT exercise instead of payload (guard at workoutReducer.ts:229-231; cases at 440-465). The early return when there is no current exercise prevents editing/deleting a set of ANOTHER exercise when currentExerciseIndex is invalid. FIX: move the no-current-exercise guard to ONLY the cases that read the active exercise (UPDATE_SET/COMPLETE_SET/etc); let EDIT_SPECIFIC_SET/DELETE_SET validate their own action.payload.exerciseIndex inside the case. Remove the dead SET_EXERCISES exception in this guard (SET_EXERCISES routes to exerciseReducer).',
      '2. [HIGH] Rest timer ending in FOREGROUND never fires REST_END; restTimer.active stuck true. Countdown runs locally every 100ms (useWorkoutTimer.ts:104-117) without dispatch; only SYNC_REST_TIMER (sent on visibilitychange, WorkoutProvider.tsx:211-231) clears active and sets pendingHaptic=REST_END (workoutReducer.ts:536-560). FIX: when useRestTimer detects timeLeft<=0, dispatch SYNC_REST_TIMER (or a new REST_TIMER_ENDED action) so active clears and pendingHaptic fires honoring vibrate/sound settings, not only on visibilitychange. Confirm the WorkoutProvider effect at 261-281 then runs.',
      '3. [MEDIUM] Confetti fires on EVERY completed set when prCelebrationIntensity is full (workoutReducer.ts:356-359) — and full is the default. FIX: gate showConfetti on an ACTUAL PR detection (reuse the existing showPRCelebration logic) rather than mere set completion.',
      '4. [HIGH] Name collision: two different useWorkoutSettings (WorkoutContext.tsx:111-115 returns raw workoutSettings||{}; hooks/useWorkoutSettings.ts:145-315 returns rich API with defaults). FIX: rename the Context one to useWorkoutSettingsRaw and update its in-file consumers in YOUR group only. If consumers exist in OTHER groups files, keep a backward-compat re-export alias of the old name and note it in risks. Prefer the non-breaking alias.',
      '5. [MEDIUM] activeSetIndex/currentSet logic duplicated 3x (workoutReducer.ts:138-141 getActiveSetIndex; WorkoutProvider.tsx:344-392; WorkoutContext.tsx:84-105 useCurrentExercise). FIX: extract one shared helper resolveActiveSet(sets) (in workoutReducer.ts or a small co-located util in core/) and use it in all three. Behavior identical.',
      '6. [MEDIUM] Auto-added set leaks to current exercise on superset transition (auto-add at workoutReducer.ts:275-285 runs before superset logic 304-327). FIX: compute superset membership/transition BEFORE the auto-add block and skip the auto-add when transitioning to the next exercise in a superset group.',
      '7. [LOW] Fallback path runs all slices for an unmapped action (workoutReducer.ts:798-842). FIX: replace the fallback with an explicit no-op (optionally a dev warning).',
      '8. [MEDIUM] type holes: as-number / as-string / appSettings casts (workoutReducer.ts:59,76-78,706-713; workoutSessionBuilder.ts:81). FIX: replace casts with explicit defaults from DEFAULT_WORKOUT_SETTINGS and proper undefined handling; goalType should be string|undefined not cast.',
      '9. [MEDIUM] usePreviousData caches the UNSORTED array with sorted:true (usePreviousData.ts:94-104; sortSessionsByRecent returns a new sorted array at 42-48 but the result is discarded). FIX: use the returned sorted array before caching.',
      '10. Add tests in core/__tests__ for EDIT_SPECIFIC_SET/DELETE_SET (incl. invalid currentExerciseIndex), ADD_REST_TIME both branches, and the rest-timer-end branch (active resets + pendingHaptic set).',
    ].join('\n'),
  },
  {
    key: 'C-data-types-utils',
    prompt: COMMON + '\n' + [
      'GROUP C — DATA / TYPES / UTILS (NON-BREAKING ONLY). Edit ONLY these files:',
      'src/services/supabaseSyncMappers.ts, src/utils/logger.ts, src/utils/dateUtils.ts, src/utils/units.ts, src/utils/id.ts, src/constants/workoutConstants.ts, src/types/index.ts (ADDITIVE changes only — do not change/remove existing exported shapes other files import), src/errors/index.ts, src/services/analyticsService.ts, and src/utils/__tests__/ + src/errors/__tests__/ (tests here only).',
      '',
      'FIX THESE FINDINGS:',
      '1. [MEDIUM] logger broken: currentLevel() reads window.__DEV__ (logger.ts:27) which is never set; rest of app uses import.meta.env.DEV, so debug/info NEVER log. FIX: replace window.__DEV__ with import.meta.env.DEV (and/or MODE). Also formatMessage (~41) returns the same expression in both ternary branches (dead branch) — fix so the data param is actually used, or remove the dead ternary. Ensure prod routes error to Sentry path, not console.',
      '2. [HIGH] No runtime validation at the Supabase boundary; zod is NOT installed; mappers cast unknown[] (supabaseSyncMappers.ts:225,241,254). FIX: add SMALL hand-rolled runtime guards (no new dependency) in toCanonicalSession/Template/PersonalExercise for the exercises[].sets[] structure — verify exercises is an array and each set has the expected primitive fields, coerce/fall back to a valid shape + logger.warn on malformed data, instead of a blind cast.',
      '3. [LOW] toCanonicalSession uses toISOString().slice(0,10) (supabaseSyncMappers.ts:238) — the exact UTC-shift anti-pattern dateUtils warns about. FIX: use toLocalDateStr from dateUtils.',
      '4. [MEDIUM] fmtDate computes today/yesterday by 24h windows not calendar days, and gives negative diffs for future dates (dateUtils.ts:29,32). FIX: compute the diff on dates normalized to local midnight (reuse toLocalDateStr/isToday) and guard future (negative) diffs in a separate branch.',
      '5. [MEDIUM] Duplicate computeSessionStats: analyticsService.ts:145 has its own impl vs the workoutMath SSOT. FIX: in analyticsService ONLY, replace the local computeSessionStats body with a call to computeSessionStats imported from utils/workoutMath, passing matching options (excludeWarmup, requireWeightAndReps). Do NOT edit workoutMath.ts.',
      '6. [MEDIUM] Constant/type drift: PR_TYPES (workoutConstants.ts:67) missing 1rm though the PR union + DB include it. FIX: add the 1rm member to PR_TYPES. ALSO merge duplicate WarmupMode into WarmupPreference and replace inline unions in WorkoutSettings (types/index.ts:434,461,465) with the named types — ONLY if non-breaking (identical string members). Align MEAL_TYPES vs MealType similarly if trivial.',
      '7. [LOW] Error classes do not restore the prototype chain (errors/index.ts:7,47). FIX: add Object.setPrototypeOf(this, new.target.prototype) in the AppError constructor so instanceof/isAppError is robust.',
      '8. [LOW] createWorkoutSet fallback id uses Math.random only (types/index.ts:441; cf utils/id.ts:11). FIX: make the fallback include Date.now()+random (or reuse generateId), keeping crypto.randomUUID as primary.',
      '',
      'DEFER (add to deferred, DO NOT do — breaking/ripples too far for a parallel pass):',
      '- Rewiring the kg/lb unit system (units.ts displayWeight/toStorageWeight dead exports).',
      '- Changing the Exercise base type / discriminated union (PersonalExercise extends Exercise).',
      'Add tests in utils/__tests__ for logger level, fmtDate calendar-day + future-date correctness, and errors instanceof.',
    ].join('\n'),
  },
  {
    key: 'D-ui-a11y',
    prompt: COMMON + '\n' + [
      'GROUP D — SHARED UI / ACCESSIBILITY. Edit ONLY these files:',
      'src/components/ui/SkeletonLoader.tsx, src/components/ui/AnimatedProgressRing.tsx, src/components/ui/EmptyState.tsx, src/components/workout/overlays/NumpadOverlay.tsx, src/components/charts/GradientSparkline.tsx, src/components/ui/Accessible.tsx.',
      '',
      'FIX THESE FINDINGS:',
      '1. [HIGH] Accessible.tsx (705 lines) is entirely DEAD CODE (nothing imports AccessibleButton/Input/Modal/Tabs/SkipLink/LiveRegion/FocusTrap/VisuallyHidden). DECISION (non-breaking): KEEP the genuinely reusable primitives VisuallyHidden and LiveRegion and USE them in your files (#2,#3). REMOVE the unused heavy duplicates (AccessibleButton/Input/Modal/Tabs/SkipLink/FocusTrap) ONLY after you grep-confirm nothing imports each symbol. If unsure about any symbol, keep it and note in risks.',
      '2. [HIGH] NumpadOverlay: value not announced to screen readers; mode toggle lacks aria-pressed (NumpadOverlay.tsx:63 AnimatedValue; 570-585 toggles). FIX: add an aria-live polite region announcing the current value+unit on change (reuse the kept LiveRegion or a VisuallyHidden live span), and add aria-pressed to the two toggle buttons (or role=tablist/tab + aria-selected).',
      '3. [MEDIUM] Skeletons do not announce loading (SkeletonLoader.tsx:231,333,744) — no role=status/aria-busy. FIX: wrap each full-screen skeleton in a container with role="status" aria-busy="true" aria-label (Hebrew loading text), or add a VisuallyHidden live message.',
      '4. [MEDIUM] NumpadButton memo broken: inline arrow onPress new each render (NumpadOverlay.tsx:619-629) defeats memo; keys array rebuilt each render (470). FIX: pass stable handlers (the useCallback handleInput/handleDelete) and the raw key to NumpadButton so it calls back with its own value; wrap keys in useMemo. Behavior identical.',
      '5. [MEDIUM] AnimatedProgressRing: hardcoded neon hex outside the token system (83,110,129) + role=progressbar with tabIndex=0 injecting tab stops. FIX: replace hardcoded hex with the project CSS var tokens where they exist; remove tabIndex=0 from the progressbar unless interactive.',
      '6. [LOW] Non-reactive document.dir / matchMedia read during render (NumpadOverlay.tsx:407 isRTL; GradientSparkline.tsx:84 matchMedia). FIX: use framer-motion useReducedMotion() instead of manual matchMedia; read dir via a small effect/state or existing hook rather than during render.',
      '7. [LOW] EmptyState injects a <style> per instance (453,549) and NumpadOverlay too (683). If quick and within your files, dedupe; if it needs files outside your group, add to deferred.',
      '8. [LOW] Some Numpad fade/opacity motions ignore prefers-reduced-motion (NumpadOverlay.tsx:102,521). FIX: gate them on shouldReduceMotion like the rest of the component.',
    ].join('\n'),
  },
  {
    key: 'E-pages-perf',
    prompt: COMMON + '\n' + [
      'GROUP E — PAGES / PERFORMANCE. Edit ONLY these files:',
      'src/App.tsx, src/pages/WorkoutDetail.tsx, src/pages/Dashboard.tsx, src/pages/Progress.tsx, src/components/workout/AnalyticsDashboard.tsx, src/pages/progress/components/WorkoutHistoryList.tsx, src/components/workout/components/ExerciseList.tsx.',
      '',
      'FIX THESE FINDINGS:',
      '1. [HIGH] Virtualization without scrollMargin -> wrong/disappearing items in deep lists. WorkoutHistoryList.tsx:88-102 and ExerciseList.tsx:95-110 use getScrollElement climbing to the scrolling <main> (App.tsx:496-508) but pass no scrollMargin, so useVirtualizer assumes the list starts at scrollTop=0; in Progress the list sits far below hero/charts. FIX: pass scrollMargin equal to the parentRef offset relative to the scroll element (measure parentRef.current.offsetTop vs the element returned by getScrollElement, update in useLayoutEffect + on resize) and offset virtual rows by scrollMargin (start = virtualRow.start - scrollMargin), per the @tanstack/react-virtual scrollMargin pattern. Touch App.tsx only minimally (a ref/data attribute if needed).',
      '2. [MEDIUM] Virtualization without measureElement -> variable-height items overlap (WorkoutHistoryList.tsx:99-135 estimate 220/64; ExerciseList.tsx:107-145 fixed 96). FIX: add ref={virtualizer.measureElement} and data-index to each row wrapper so heights are measured after render.',
      '3. [MEDIUM] window.matchMedia called in render per card/per muscle bar in WorkoutDetail (152-156 ExerciseCard; 532-536 MuscleBreakdown). FIX: call useReducedMotion() once in WorkoutDetail (as AnalyticsDashboard.tsx:147 does) and pass the boolean down, or call it once per child component, instead of matchMedia per item.',
      '4. [MEDIUM] Waterfall: two sequential IndexedDB reads on WorkoutDetail load (604-638 getWorkoutSession then usePreviousSession reads getWorkoutSessions(30)). FIX: load both in parallel (Promise.all) in the same effect and derive the previous session from the result.',
      '5. [MEDIUM] Dashboard filters completed-sessions separately in 4 useMemo (105,193,218,149). FIX: compute completedSessions once via useMemo at the top and feed all derived calcs from it.',
      '6. [MEDIUM] AnalyticsDashboard runs 7 heavy sync analytics over an UNBOUNDED sessions array on the main thread (149-184; getWorkoutSessions() with no limit at 153). FIX: bound getWorkoutSessions to a sane limit (Progress uses 50). Web Worker is out of scope.',
      '7. [LOW] Progress double-filters status completed (114 in loadData AND 128-131). FIX: remove the redundant filter; single completedSessions source feeds all derived useMemo.',
      '8. [LOW] App.tsx:463-478 setInterval(60s) runs materializeDueReminders even when the tab is hidden. FIX: pause when document.hidden (listen to visibilitychange, stop/resume).',
      '9. [LOW] App.tsx:424-459 scroll-restore useLayoutEffect forces reflow (reads window.scrollY) + 3 rAF per navigation. FIX: consolidate to a single rAF and avoid the forced reflow before paint where possible; keep the flag-gated restore-vs-top logic intact.',
      'NOTE: WorkoutDetail.tsx / AnalyticsDashboard.tsx monolith decomposition (>800 lines) is DEFERRED — do not split files in this pass; add to deferred.',
    ].join('\n'),
  },
  {
    key: 'F-config-security-backend',
    prompt: COMMON + '\n' + [
      'GROUP F — CONFIG / SECURITY / BACKEND. Edit ONLY these files:',
      'vite.config.ts, vitest.config.ts, biome.json, src/services/ai/core.ts, src/services/ai/bootstrap.ts, supabase/migrations/ (you may ADD a new timestamped migration; do not rewrite applied history), supabase/functions/ai-chat/index.ts, supabase/functions/coach-invite-accept/index.ts, supabase/functions/coach-push-send/index.ts, and .env.local (you may EDIT to rename the VITE_ key; NEVER print the secret VALUE).',
      '',
      'FIX THESE FINDINGS:',
      '1. [HIGH][SECURITY] Real DeepSeek key with VITE_ prefix in .env.local:16 (VITE_DEEPSEEK_API_KEY) — VITE_ embeds it into the public client bundle; DirectDeepSeekProvider (ai/core.ts:257-296) sends it from the browser. FIX: (a) in .env.local RENAME the var to drop the VITE_ prefix (e.g. DEEPSEEK_API_KEY) — do NOT echo the value; (b) remove or neutralize DirectDeepSeekProvider in ai/core.ts (dead code; bootstrap.ts:18 never instantiates it) so no client path can send a key; (c) add a code comment that DeepSeek must route through an Edge Function + Supabase Secrets like OPENROUTER_API_KEY. In risks, note the human must ROTATE the exposed key (you cannot).',
      '2. [HIGH][TESTING] Coverage thresholds are theater: vitest.config.ts:30-34 statements:3, lines:3 vs the project 80% rule. FIX: raise the global statements/lines floor to a meaningful but currently-passable value (you cannot run coverage here — set statements/lines to ~25, keep branches:50, functions:20 or slightly higher) with a comment that these must ratchet toward 80. Keep the per-file workoutReducer 60 threshold. Do not set so high it breaks CI; the repair phase will adjust if needed.',
      '3. [MEDIUM] drop_console:true removes console.error too in prod (vite.config.ts:95-98). FIX: replace blanket drop_console with pure_funcs limited to console.log/console.debug/console.info so console.error/warn survive.',
      '4. [MEDIUM][TYPE-SAFETY] Critical biome rules are warn not blocking (biome.json:11,13,25). FIX: raise useExhaustiveDependencies and noExplicitAny to error, and noUnusedVariables/noUnusedImports to error. This may surface pre-existing violations that fail lint; the repair phase can dial specific rules back if too many break. Prefer correctness; fix trivially-fixable ones if obvious, but do not stray outside your files.',
      '5. [MEDIUM][SECURITY] LWW trigger lets the client forge a future updated_at to win every merge (migrations/20260531120000_data_sync_correctness.sql). FIX: ADD a NEW timestamped migration that redefines update_updated_at_column to clamp NEW.updated_at = LEAST(COALESCE(NEW.updated_at, now()), now() + interval 5 minutes) while keeping the existing bump-to-now-if-stale logic. Do not edit the historical migration.',
      '6. [MEDIUM][SECURITY] ai-chat rate-limit fails OPEN on Deno KV failure (functions/ai-chat/index.ts:161-167,202-211). FIX: make it fail-closed (return 503 / allowed:false when KV is unavailable) consistent with coach-invite-accept. Prefer fail-closed.',
      '7. [LOW][SECURITY] coach functions default to hardcoded DEFAULT_ORIGINS when ALLOWED_ORIGIN is unset (coach-invite-accept/index.ts:22-26; coach-push-send/index.ts:26-30) while ai-chat blocks (returns null). FIX: align the coach functions to fail-closed like ai-chat (return null when ALLOWED_ORIGIN unset), or keep only localhost for dev.',
      '8. [LOW][SECURITY] ai-chat decodeJwtPayload only structurally validates the JWT, relying on platform verify_jwt=true (index.ts:99-138, config.toml:2). FIX: add an explicit warning comment near authorize() documenting the dependency on verify_jwt=true. Full signature verification is a larger change — add to deferred if not done.',
      '',
      'Config changes (#2,#4) can break the verify phase — choose strict-but-passable values; the repair phase will fine-tune.',
    ].join('\n'),
  },
]

phase('Fix')
log('Launching 6 Opus fixer agents in parallel, disjoint file ownership')
const fixResults = await parallel(
  GROUPS.map((g) => () =>
    agent(g.prompt, { label: 'fix:' + g.key, phase: 'Fix', model: 'opus', schema: FIX_SCHEMA }),
  ),
)
const fixes = fixResults.filter(Boolean)

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    typecheck: { type: 'object', properties: { passed: { type: 'boolean' }, errorCount: { type: 'number' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'errors'] },
    lint: { type: 'object', properties: { passed: { type: 'boolean' }, errorCount: { type: 'number' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'errors'] },
    tests: { type: 'object', properties: { passed: { type: 'boolean' }, failedCount: { type: 'number' }, failures: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'failures'] },
  },
  required: ['typecheck', 'lint', 'tests'],
}

phase('Verify')
log('Running typecheck + lint + tests')
const verify = await agent(
  'Run verification on ' + ROOT + ' and report results. From the project root run, capturing output:\n' +
  '1. npx tsc --noEmit   (typecheck)\n' +
  '2. npx biome check ./src   (lint)\n' +
  '3. npx vitest run   (tests)\n' +
  'For each: report passed (true/false), counts, and the FULL list of distinct error/failure messages WITH file:line so they can be fixed. Do not attempt any fixes. Capture the first ~60 errors of each if there are many. Return ONLY the structured object.',
  { label: 'verify', phase: 'Verify', model: 'opus', schema: VERIFY_SCHEMA },
)

phase('Repair')
const repairLog = []
let current = verify
let round = 0
while (round < 3 && !(current.typecheck.passed && current.lint.passed && current.tests.passed)) {
  round++
  log('Repair round ' + round + ': typecheck=' + current.typecheck.passed + ' lint=' + current.lint.passed + ' tests=' + current.tests.passed)
  const repair = await agent(
    'You are fixing verification failures in ' + ROOT + ' after a multi-agent edit pass. Current failures (JSON):\n\n' +
    JSON.stringify(current, null, 2) +
    '\n\nFix the ROOT CAUSE of each failure with minimal diffs. Likely causes: a non-breaking type change that rippled, a renamed export missing an alias, or a config rule (biome/coverage) set too strict. Guidance:\n' +
    '- If a biome rule (e.g. noExplicitAny, useExhaustiveDependencies) now fails on MANY pre-existing violations, you may dial that specific rule back from error to warn in biome.json — but fix genuinely easy ones first.\n' +
    '- If coverage thresholds fail, lower the failing threshold in vitest.config.ts to just below actual, with a comment to ratchet up.\n' +
    '- If a useWorkoutSettings/type rename broke imports, add a backward-compat re-export alias.\n' +
    '- Do NOT introduce new functionality; only make verification green while preserving the intent of the fixes. You MAY edit any file needed to reach green.\n' +
    'Return a short Hebrew summary of what you changed as plain text.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  repairLog.push({ round, repair })
  current = await agent(
    'Re-run verification on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

return { fixes, finalVerify: current, repairRounds: repairLog.length, green: current.typecheck.passed && current.lint.passed && current.tests.passed }
