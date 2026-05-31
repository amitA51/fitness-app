export const meta = {
  name: 'sparkos-build-redesign',
  description: 'Six Opus builder agents redesign the 6 surfaces + coach/role split in disjoint file groups, then verify+repair to green',
  phases: [
    { title: 'Build', detail: 'six parallel builders, disjoint ownership' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix failures to green' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const COMMON = [
  'You are building a coherent redesign of the React+TS+Vite+Supabase fitness PWA at ' + ROOT + ' (package "sparkos-fitness-app"). RTL Hebrew UI.',
  '',
  'SHARED PRODUCT DIRECTION (all groups must align to this):',
  '- ONE app, ADDITIVE role split. Role asked at onboarding ("מאמן"/"מתאמן"). Trainee = default; Coach = a coach_profiles row exists (isCoach from useCoach()). A user can be BOTH.',
  '- Trainee sees the normal app (4 tabs: בית/אימון/התקדמות/תזונה). Coach sees the SAME 4 tabs PLUS an additional management entry — NOT a forked app, NOT a replaced tab.',
  '- Coach assignments are surfaced INLINE in the trainee surfaces (program -> card atop /workout; nutrition_target -> already wired in nutrition; note -> banner). The separate /my-coach becomes a secondary history feed, not the only entry point.',
  '- Security is already enforced by Supabase RLS (is_coach_of/is_client_of on active relationship). Frontend guards are UX only.',
  '',
  'HARD RULES:',
  '- ONLY edit files in YOUR assigned list. NEVER touch other groups files (parallel edit -> conflicts). If you need a change in another group file, add it to "handoffs" instead.',
  '- Match existing code style, naming, imports, patterns. Read each file FULLY before editing. Use codegraph + Read/Grep to confirm call sites.',
  '- Respect .claude/rules: immutability, explicit error handling (never silently swallow — use the project logger), files under 800 lines, functions under 50 lines.',
  '- Do NOT read or write .md files.',
  '- Make REAL, working changes — wire real state/handlers, not stubs. If you add UI, wire it to real data/services that already exist.',
  '- Add/extend vitest tests where a __tests__ folder exists nearby and the logic is unit-testable (AAA style).',
  '- Prefer additive, non-breaking changes. If a shared type needs a field, add it OPTIONALLY so other groups still compile.',
  '- After editing, re-read your files to confirm coherence and that imports exist. Do NOT run build/test (a verify phase runs after).',
  '- Report in Hebrew in the structured output.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          what: { type: 'string', description: 'what was built/changed, Hebrew' },
          testsAddedOrUpdated: { type: 'array', items: { type: 'string' } },
        },
        required: ['file', 'what'],
      },
    },
    handoffs: { type: 'array', items: { type: 'string' }, description: 'changes needed in OTHER groups files, with file:line + what, Hebrew' },
    deferred: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['group', 'changed', 'handoffs', 'deferred', 'risks'],
}

const GROUPS = [
  {
    key: 'G1-role-foundation',
    prompt: COMMON + '\n' + [
      'GROUP G1 — ROLE FOUNDATION: onboarding role step, app routing, nav, coach context. Edit ONLY:',
      'src/services/coach/relationshipService.ts, src/contexts/CoachContext.tsx, src/App.tsx, src/components/ui/BottomNav.tsx, src/pages/onboarding/ (steps + types + wizard), src/pages/login/steps/SignUpStep.tsx.',
      '',
      'BUILD:',
      '1. [CRITICAL BLOCKER — do this first] Fix isCoach always false: in relationshipService.ts:28 getMyCoachProfile selects a non-existent column "specialties". Remove it from the select (keep id, business_name, bio, settings, created_at, updated_at). This unblocks the ENTIRE coach platform. Verify toCoachProfile mapping still works.',
      '2. Add a ROLE step to onboarding: after "welcome", a step asking "האם אתה מאמן או מתאמן?" with two clear choices. Add an optional role field to OnboardingData (onboarding types). Persist the choice. On onboarding complete (App.tsx handleOnboardingComplete / saveOnboardingData ~620-650): if role==="coach" AND authenticated -> call enableCoachMode() (from relationshipService) so the coach_profiles row is created. If guest (no session), store the intent and redirect to sign-up (coach requires a session — enableCoachMode needs getCurrentUser).',
      '3. Fix onboarding_completed not user-scoped (survives signOut -> new user skips onboarding): add "onboarding_completed" to USER_SCOPED_LS_KEYS (in supabaseAuth.ts IF that file is reachable — if it is NOT in your file list, add a handoff). Otherwise scope the key by user id where read in App.tsx:184-186.',
      '4. App routing + nav for the additive role split: coaches get the normal 4 tabs PLUS an additional management entry to /coach (do NOT replace the 5th tab — ADD an entry). Trainees: normal tabs; the 5th "מאמן" entry routes to /my-coach. Make sure a user who is BOTH coach and someone-else-trainee can reach both /coach and /my-coach. Add a lightweight RoleGuard around /coach/* (redirect non-coach to /) and /my-coach (redirect guest to login). Keep the unread-messages badge working.',
      '5. CoachContext: ensure enable() does not immediately re-break via the fixed getMyCoachProfile; confirm isCoach derives correctly after enableCoachMode.',
      '',
      'Coordinate: G6 owns the coach panel pages; you own routing/nav/context/onboarding only. The inline coach cards on /workout and /nutrition are built by G2/G4 — you just ensure assignments are reachable (listMyAssignments already exists).',
    ].join('\n'),
  },
  {
    key: 'G2-start-workout',
    prompt: COMMON + '\n' + [
      'GROUP G2 — START-WORKOUT FLOW (issue #1). Edit ONLY:',
      'src/components/workout/states/PreWorkoutScreen.tsx, src/components/workout/ActiveWorkoutNew.tsx, src/components/workout/active/useWorkoutEffects.ts, src/components/workout/active/useWorkoutHandlers.ts, src/components/workout/ExerciseSelector/ (index + tabs), src/components/workout/WorkoutTemplates.tsx.',
      '',
      'BUILD:',
      '1. [BUG A — exercise library does not open] Root cause: the start-flow effect (active/useWorkoutEffects.ts:121-148) dispatches goal/warmup modals on mount while still on the PreWorkoutScreen branch, but those modals are rendered ONLY in WorkoutOverlays inside the main workout branch (ActiveWorkoutNew.tsx:397-449), NOT in the PreWorkoutScreen branch (268-309). So showGoalSelector/showWarmup turn on invisibly and block the auto-open-selector effect (which requires !showGoalSelector && !showWarmup). FIX: make the start flow deterministic. Cleanest: do NOT run the goal/warmup start-flow while on PreWorkoutScreen; only run it after the workout actually starts (preWorkoutScreenShown && exercises.length>0). When the user taps "התחל אימון", onStartWorkout must clear any stuck goal/warmup modal state and then OPEN_SELECTOR. Ensure the ExerciseSelector reliably opens (both via the button and via auto-open). Verify with the reducer state transitions.',
      '2. [BUG B — empty area under the greeting] PreWorkoutScreen stat cards (300-407) show "—" when there is no history. FIX: add a real empty-state — for a user with no last workout / no streak, show guiding content ("האימון הראשון שלך") or hide the stat row, instead of three dashes. Prefer pulling the same data the dashboard already computes rather than a duplicate getWorkoutSessions(50). If pre-workout metrics stay, show RELEVANT pre-workout info (weekly goal, a neglected muscle via getMuscleGroupDaysSince which is already loaded) as a real number.',
      '3. [SPA nav bug] PreWorkoutScreen onSelectTemplate does window.location.href = "/workout/"+id (ActiveWorkoutNew.tsx:289) — a full page reload that loses state. FIX: use react-router navigate instead.',
      '4. Coherent redesign of the start screen so all three entry paths work cleanly: (a) start EMPTY and add exercises on the fly, (b) start from a SELF-MADE template, (c) start from a COACH-ASSIGNED program. For (c): render a card atop the pre-workout/start screen "האימון שהמאמן הקצה לך" when a coach program assignment exists — read assignments via listMyAssignments (kind==="program"); tapping it starts that template. Handle offline gracefully (assignments come from Supabase, not local cache). This is the inline coach-injection for the workout surface.',
      '5. Reduce template duplication/awkwardness across Dashboard/Selector/PreWorkout per the investigation — keep one coherent template entry.',
      '',
      'Make the start-workout screen genuinely useful and correct. Add tests in workout/core/__tests__ ONLY if reducer logic changes (that file is owned by nobody this round, but avoid editing the reducer — it is not in your list; if you need a reducer change, add a handoff).',
    ].join('\n'),
  },
  {
    key: 'G3-progress',
    prompt: COMMON + '\n' + [
      'GROUP G3 — PROGRESS (issue #2). Edit ONLY:',
      'src/pages/Progress.tsx, src/pages/progress/ (tabs/, components/, modals/), src/components/charts/, and DELETE-or-empty src/components/workout/AnalyticsDashboard.tsx (confirmed dead code, 1027 lines, imported nowhere — grep-verify before removing; if anything imports it, do not delete, just note).',
      '',
      'BUILD:',
      '1. [BUG — "shows all screens"] Root cause: tabs ARE correctly gated by activeTab (Progress.tsx:711/732/750/769), but ABOVE the tabs there is a permanent analytics dashboard (312-642) and BELOW them a permanent workout-history list (787-811) — both always rendered with every tab, so scrolling looks like "all screens at once". FIX: make Progress tabs-only with no permanent mega-dashboard. Proposed structure: default tab "סקירה" = ONE compact summary (streak, weekly volume vs goal, workout count, 1-2 real recent PRs). Tab "אימונים" = volume-trend chart + workout history (move the currently-permanent bottom list here). Tab "כוח" = real PR board (e1RM based) + selected-exercise curve (remove the duplicate "הרמות מובילות" sparklines from the top). Keep tabs משקל/מדידות/ריקאברי. At any time the user sees ONE logical section.',
      '2. [Duplicate strength/PR data] Remove the "הרמות מובילות" sparklines (Progress.tsx:432-489) that duplicate the Strength tab PR board. Unify PR definition to a single source (prService.getAllPRs) — fix ProgressInsightCard which mislabels rating>=4 as "PRs".',
      '3. [Double/triple session fetch] Progress.tsx:103 getWorkoutSessions(50) + StrengthTab.tsx:16 getWorkoutSessions(100) + RecoveryTab independent fetch. FIX: lift all session/recovery loading to ONE source (a useProgressData hook or loadData) with a uniform time window, pass down as props; remove duplicate fetches.',
      '4. [Dead data] weeklyRecovery computes avgSoreness/avgStress but RecoveryTab only shows sleep/energy. FIX: show all four weekly averages (sleep/energy/soreness/stress).',
      '5. Cut junk: delete dead AnalyticsDashboard.tsx, remove the generic ProgressInsightCard filler or make it a real insight. Add streak + per-muscle volume (analyticsService already exists) where valuable.',
      '',
      'Goal: a purposeful, accurate Progress screen — exactly the data a lifter needs, no junk, one section at a time.',
    ].join('\n'),
  },
  {
    key: 'G4-nutrition',
    prompt: COMMON + '\n' + [
      'GROUP G4 — NUTRITION (issue #3) + move nutrition goals here from Settings (issue #6). Edit ONLY:',
      'src/pages/Nutrition.tsx, src/pages/nutrition/ (components/, hooks/), src/services/nutritionService.ts, src/services/waterService.ts, src/components/nutrition/.',
      '',
      'BUILD:',
      '1. [BUG — past-day meal saved to today] createQuickMeal (nutritionService.ts:849) and addFoodFromPreset (609) hardcode date: todayStr(); handleSaveMeal/handleQuickPreset (useNutritionData.ts) do not pass selectedDate. So logging while viewing a past day writes to today and seems to vanish. FIX: thread selectedDate through createQuickMeal/addFoodFromPreset (date param) so retroactive logging works.',
      '2. [BUG — water not synced to date nav] WaterTracker always reads getTodayWaterTotal() on todayStr(); does not receive selectedDate; chart shows fixed 7 days. FIX: thread selectedDate to water (load getWaterByDateRange for the selected day) OR clearly scope water as "today only" visually. Make it coherent with the date navigator.',
      '3. [BUG — water chart stale after adding a glass] WaterTracker only updates local state; loadWaterHistory runs once on mount. FIX: lift water state to the shared hook or broadcast a "water-updated" event that loadWaterHistory listens to (mirror the existing "settings-updated" pattern).',
      '4. [Move goals editing INTO nutrition (issue #6)] Today nutrition goals are read-only here and edited ONLY in Settings (writes localStorage "nutrition_goals" + broadcasts "settings-updated"). BUILD an "ערוך יעדים" entry (sheet/modal) from CalorieHero/MacroStrip that writes the SAME "nutrition_goals" key and broadcasts the SAME "settings-updated" event (so existing listeners keep working), including a "חשב מהפרופיל (TDEE)" button (computeMacrosFromProfile already exists). This is the daily control point; Settings keeps a mirror (G5 removes/links its section).',
      '5. Coach target precedence: when a coach nutrition_target exists (listMyAssignments, already wired in useNutritionData:191-216 and shown as "יעד מהמאמן"), the trainee edit must behave sanely — either disable editing with a clear note "היעד נקבע ע\"י המאמן", or allow override with explicit feedback. Do NOT let a silent localStorage write get overwritten on next load without feedback.',
      '6. UX cleanup: group the meal journal by meal type with per-group macro summary (instead of a flat list); fix the duplicate eyebrow/title (createQuickMeal name == computed mealLabel); make the water goal a stored value (getWaterGoal()) instead of the 2500 magic number duplicated in 3 places; remove the dead brand search; unify macro math through one calcMacroTotals with consistent rounding; show a 7-day calories/macros trend (getWeeklyNutritionSummary already exists but unused).',
      '',
      'Goal: highest-possible nutrition UX — one day, one source of truth, fast logging, targets vs actual editable in place.',
    ].join('\n'),
  },
  {
    key: 'G5-settings',
    prompt: COMMON + '\n' + [
      'GROUP G5 — SETTINGS cleanup (issue #6). Edit ONLY:',
      'src/pages/Settings.tsx, src/pages/settings/ (sections/, hooks/).',
      '',
      'BUILD a clean, minimal Settings containing ONLY what belongs, with consistent section numbering. Final structure: (1) חשבון (email, sign-out — wired, keep). (2) פרופיל (name/age/height/WEIGHT/GENDER/weight-goal/activity — ADD weight+gender fields which are currently missing, see bug #3). (3) תצוגה ונגישות — merge dark mode with reducedAnimations/largeText/highContrast which are currently misplaced under "אימון" (all already wired to SettingsContext). (4) אימון — only REAL workout prefs (default rest time, auto-start, vibrate). (5) התראות — see bug fix below. (6) פרטיות ונתונים — unify export (CSV/JSON/report), cloud sync, and danger-zone (delete) under one category.',
      '',
      'FIX dead controls (do not leave toggles that move but do nothing — it destroys trust):',
      '1. [Notifications toggles dead] toggleNotification writes localStorage "notification_settings" but notificationService reads a DIFFERENT key CONFIG_KEY="sparkos_notification_config". FIX: wire the toggles directly to notificationService.saveNotificationConfig (unified key) and call requestNotificationPermission (exists in the service) from the UI. If you cannot add a real scheduler, at least make the persisted config real and request permission; if still meaningless, REMOVE the section rather than fake it. Note your choice.',
      '2. [Units selector dead] settings.unitSystem is read only inside ProfileSection for button highlight; utils/units conversions are never called app-wide. Since wiring full kg/lb conversion across all screens is out of YOUR scope (other groups own those screens), either keep the selector but add a handoff listing where conversion must be applied, OR hide the selector until supported. Do NOT leave it as a no-op illusion — pick one and note it.',
      '3. [TDEE uses fixed 70kg/male] handleAutoCalc reads weight/gender from user_profile, but the profile form never collects them -> always 70kg/male. FIX: since you add weight+gender to the profile form (structure item 2), feed those into computeMacrosFromProfile.',
      '',
      'MOVE OUT (remove from Settings, since other groups now own the destination):',
      '- Nutrition goals section (NutritionSection + TDEE button): G4 builds goal editing inside the Nutrition screen using the SAME "nutrition_goals" localStorage key + "settings-updated" event. REMOVE the nutrition-goals section from Settings (or reduce to a one-line deep-link to Nutrition). Keep the localStorage key/event contract intact.',
      '- Coach section (CoachingSection: coach-mode toggle + nav to /coach,/my-coach): role is now handled at onboarding + the coach panel (G1/G6). REMOVE CoachingSection from Settings (or leave only a small link). Do NOT keep the coach-mode toggle buried in settings.',
      '',
      'Delete the static DataAboutSection (version text) or shrink to a tiny footer line. Fix the broken section numbering (01/01b/01c/02...).',
      'IMPORTANT contracts to preserve: keep writing the same localStorage keys (user_profile, nutrition_goals, notification config) and broadcasting "settings-updated" where other screens listen, and keep SettingsContext as the source of truth for darkMode/units/workoutSettings so accessibility/audio keep applying app-wide.',
    ].join('\n'),
  },
  {
    key: 'G6-coach-panel',
    prompt: COMMON + '\n' + [
      'GROUP G6 — COACH MANAGEMENT PANEL (issues #4 + #5). Edit ONLY:',
      'src/pages/coach/ (CoachHome, ClientDetail, ProgramBuilder, CoachGroups, etc.), src/pages/MyCoach.tsx, src/services/coach/ EXCEPT relationshipService.ts and EXCEPT CoachContext.tsx (G1 owns those two). You MAY edit assignmentService.ts, coachApi.ts, coachAnalytics.ts, messageService.ts, mappers.ts.',
      '',
      'CONTEXT: the coach infra is rich and mostly works once G1 fixes the specialties bug (isCoach). Your job is to make the coach experience powerful and to feed inline trainee surfaces. The app is sold to a COACH who onboards their trainees and tracks them.',
      '',
      'BUILD (make the coach able to control everything and track clients easily):',
      '1. Coach overview dashboard on CoachHome: an aggregate view across ALL clients — who is at risk / who has not checked in / who is progressing — not just a flat roster. Use coachAnalytics (currently per-client). Fix the N+1: RosterRow fetching 100 sessions per client individually (CoachHome.tsx:260) — batch or summarize.',
      '2. ClientDetail enrichment: add assignment EDIT and ARCHIVE (archiveAssignment exists in assignmentService:90-94 but is called nowhere — wire it so a coach can revoke a sent recommendation); show body_measurements (getClientMeasurements exists in coachApi:153 but is not displayed) and recovery; show adherence stats (did they do the assigned workouts? progress trend).',
      '3. ProgramBuilder: link to the canonical exercise library instead of free-text exerciseId="" (ProgramBuilder.tsx:70) — add exercise search/autocomplete from the built-in exercises. Group a multi-day program as ONE program unit (programName) instead of N independent "program" assignments so the trainee sees a structured weekly plan, not N separate "התחל אימון" rows.',
      '4. Assignment creation completeness: AssignBox currently creates only note + nutrition_target; ProgramBuilder only program. Either add announcement + group assignment UI (schema supports kind=announcement and group_id) OR clearly remove the unsupported kinds. Wire client_groups into the assignment flow (assignment with groupId) so CoachGroups is not a dead feature — or note removal.',
      '5. MyCoach.tsx (trainee side): turn "נשלח אליי" from the ONLY entry point into a secondary history feed. The primary surfacing of program/note happens inline in /workout (G2 builds the program card) and /nutrition (already wired). Keep MyCoach for invite-code entry, coach list, weekly check-in, and an assignments history.',
      '6. Fix the seat_limit inconsistency: enableCoachMode seeds seat_limit=3 (relationshipService — NOT yours, add a handoff) while getSeatUsage/triggers default to 1. Reconcile on YOUR side (getSeatUsage/coachApi) and hand off the relationshipService part.',
      '',
      'Everything touching client data must go through coachApi/RLS (never bypass). Coach mode is online-only (requireClient throws offline) — handle that gracefully in the UI.',
    ].join('\n'),
  },
]

phase('Build')
log('Launching 6 Opus builder agents in parallel — coherent role-split redesign')
const buildResults = await parallel(
  GROUPS.map((g) => () =>
    agent(g.prompt, { label: 'build:' + g.key, phase: 'Build', model: 'opus', schema: SCHEMA }),
  ),
)
const builds = buildResults.filter(Boolean)

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
  '1. npx tsc --noEmit\n2. npx biome check ./src\n3. npx vitest run\n' +
  'For each: report passed (true/false), counts, and the FULL list of distinct error/failure messages WITH file:line. Do not attempt fixes. Capture the first ~80 errors of each if many. Return ONLY the structured object.',
  { label: 'verify', phase: 'Verify', model: 'opus', schema: VERIFY_SCHEMA },
)

phase('Repair')
const repairLog = []
let current = verify
let round = 0
while (round < 4 && !(current.typecheck.passed && current.lint.passed && current.tests.passed)) {
  round++
  log('Repair round ' + round + ': tc=' + current.typecheck.passed + ' lint=' + current.lint.passed + ' tests=' + current.tests.passed)
  const repair = await agent(
    'Fix verification failures in ' + ROOT + ' after a multi-agent redesign pass. Current failures (JSON):\n\n' +
    JSON.stringify(current, null, 2) +
    '\n\nFix ROOT CAUSES with minimal diffs. Likely causes: cross-group handoff not applied (a file one group needed but could not edit), a renamed/added export missing somewhere, an optional type field used as required, a biome rule too strict on new code, or a coverage threshold. Guidance:\n' +
    '- If a biome rule fails on many pre-existing/new violations, fix the easy ones; you may dial a specific rule back to warn if it is noise.\n' +
    '- If coverage thresholds fail, lower the failing threshold in vitest.config.ts just below actual with a comment.\n' +
    '- If imports broke from a rename, add a backward-compat re-export alias.\n' +
    '- Apply any obvious cross-group handoff (e.g. add a field to a shared type, add a key to USER_SCOPED_LS_KEYS, reconcile seat_limit) that a builder flagged but could not make.\n' +
    '- Do NOT remove features to pass; preserve the redesign intent. You MAY edit any file needed to reach green.\n' +
    'Return a short Hebrew summary of what you changed.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  repairLog.push({ round, repair })
  current = await agent(
    'Re-run verification on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

return { builds, finalVerify: current, repairRounds: repairLog.length, green: current.typecheck.passed && current.lint.passed && current.tests.passed }
