export const meta = {
  name: 'sparkos-fix-two-bugs',
  description: 'Two Opus agents fix (1) exercise library not opening on start, (2) all-screens-stacked routing regression; then verify',
  phases: [
    { title: 'Fix', detail: 'two parallel agents, disjoint files' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix failures to green' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const COMMON = [
  'You are fixing a SPECIFIC user-reported bug in the React+TS+Vite+Supabase fitness PWA at ' + ROOT + ' (package "sparkos-fitness-app"). RTL Hebrew UI, react-router-dom v6, framer-motion.',
  'HARD RULES:',
  '- READ the real code and find the ROOT CAUSE before editing. Use codegraph_context / codegraph_trace + Read/Grep to follow the actual render/route path. Do NOT guess.',
  '- ONLY edit files in YOUR assigned list. The other agent edits a disjoint set in parallel — never touch their files.',
  '- Minimal, surgical diffs. Match existing style. Respect .claude/rules (immutability, explicit error handling via the project logger, no silent swallow).',
  '- Do NOT read or write .md files.',
  '- This is a behavioral bug — after fixing, trace the code path again to CONFIRM the fix actually resolves the reported symptom (not just compiles).',
  '- Report in Hebrew in the structured output.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    bug: { type: 'string' },
    rootCause: { type: 'string', description: 'the precise code cause with file:line, Hebrew' },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          what: { type: 'string', description: 'what changed, Hebrew' },
        },
        required: ['file', 'what'],
      },
    },
    confirmation: { type: 'string', description: 'why this resolves the symptom — trace the path after the fix, Hebrew' },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['bug', 'rootCause', 'changed', 'confirmation', 'risks'],
}

const AGENTS = [
  {
    key: 'bug1-exercise-library',
    prompt: COMMON + '\n' + [
      'BUG 1: Pressing "התחל אימון" on the workout screen does NOT open the exercise library. A previous fix attempt was made but the symptom PERSISTS — so re-investigate from scratch; the earlier diagnosis may have been incomplete.',
      '',
      'Edit ONLY these files:',
      'src/components/workout/ActiveWorkoutNew.tsx, src/components/workout/active/useWorkoutEffects.ts, src/components/workout/active/useWorkoutHandlers.ts, src/components/workout/states/PreWorkoutScreen.tsx, src/components/workout/ExerciseSelector/ (index + tabs + ExerciseLibraryTab), src/components/workout/core/workoutReducer.ts, src/components/workout/core/WorkoutProvider.tsx, src/components/workout/core/WorkoutContext.tsx.',
      '',
      'INVESTIGATE the full chain: PreWorkoutScreen "התחל אימון" button -> onStartWorkout -> dispatch(OPEN_SELECTOR) -> showExerciseSelector state -> the conditional that renders <ExerciseSelector>/ExerciseLibraryTab. Things to verify with real code:',
      '- Does the click handler actually fire and dispatch OPEN_SELECTOR? (trace handleStartWorkout -> onStartWorkout in ActiveWorkoutNew).',
      '- Does showExerciseSelector flip to true in the reducer, and is the <ExerciseSelector> render branch actually mounted in the PreWorkoutScreen branch (not only in the active-workout branch)?',
      '- Are stuck goal/warmup modal flags (showGoalSelector/showWarmup) still blocking it, or is the selector rendered but invisible (z-index/portal/lazy-Suspense not resolving)?',
      '- Is the lazy import of ExerciseSelector resolving (Suspense fallback)? Does ExerciseLibraryTab load its data or error out silently?',
      '- Does OPEN_SELECTOR route correctly through the sliced reducer (uiReducer) given the action-routing Set — i.e. is OPEN_SELECTOR in the right slice Set so it is actually handled?',
      'Find the REAL reason the library does not appear and fix it so that pressing "התחל אימון" reliably opens the exercise library/selector. Then re-trace to confirm.',
    ].join('\n'),
  },
  {
    key: 'bug2-all-screens-stacked',
    prompt: COMMON + '\n' + [
      'BUG 2 (regression, app-wide): clicking ANY bottom-nav tab renders ALL screens stacked vertically. E.g. tapping תזונה shows the Dashboard at the top, then Progress below it, then Nutrition — every route rendered at once, one under another, instead of only the selected route.',
      '',
      'Edit ONLY these files:',
      'src/App.tsx, src/components/ui/BottomNav.tsx, and any AppShell/layout component DEFINED INSIDE src/App.tsx. If the culprit is a shared layout/scroll/AnimatePresence wrapper, it is almost certainly in App.tsx. Do NOT edit page components (Dashboard/Progress/Nutrition) — the bug is in routing/shell, not the pages.',
      '',
      'INVESTIGATE: this is a react-router-dom v6 + framer-motion AnimatePresence setup. The symptom "all routes render stacked" means the <Routes> matching is broken so multiple/all <Route> elements render, OR AnimatePresence is rendering the outgoing AND incoming routes without exclusivity and they stack instead of overlay, OR a recent edit broke the single-match <Routes location=...> wrapping (e.g. routes moved outside <Routes>, a stray fragment, AnimatePresence mode missing, or the location/key not driving exclusivity).',
      'Check specifically:',
      '- Is every <Route> still INSIDE a single <Routes> element? A recent routing edit (CoachGuard/route tree changes) may have moved a route out, or duplicated a <Routes>/<Route>, causing multiple matches to render.',
      '- AnimatePresence: is mode="wait" set, and is the keyed element the location/pathname? Without exclusivity, motion pages can stack. Confirm the page transition wrapper keys on location.pathname and only one renders.',
      '- Is there a layout container with the wrong overflow/position that lets pages stack and become individually scrollable (the user sees them stacked vertically)?',
      '- Did the additive role-nav change or guard wrappers accidentally render siblings outside <Routes>?',
      'Find the REAL root cause of the stacking and fix it so only the selected route renders. Then re-trace to confirm a single page renders per navigation.',
    ].join('\n'),
  },
]

phase('Fix')
log('2 Opus agents fixing the two bugs in parallel (disjoint files)')
const fixes = (await parallel(
  AGENTS.map((a) => () =>
    agent(a.prompt, { label: 'fix:' + a.key, phase: 'Fix', model: 'opus', schema: SCHEMA }),
  ),
)).filter(Boolean)

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    typecheck: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'errors'] },
    lint: { type: 'object', properties: { passed: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'errors'] },
    tests: { type: 'object', properties: { passed: { type: 'boolean' }, failures: { type: 'array', items: { type: 'string' } } }, required: ['passed', 'failures'] },
  },
  required: ['typecheck', 'lint', 'tests'],
}

phase('Verify')
const verify = await agent(
  'Run verification on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report passed + distinct error/failure messages with file:line. No fixes. Return ONLY the structured object.',
  { label: 'verify', phase: 'Verify', model: 'opus', schema: VERIFY_SCHEMA },
)

phase('Repair')
const repairLog = []
let current = verify
let round = 0
while (round < 3 && !(current.typecheck.passed && current.lint.passed && current.tests.passed)) {
  round++
  log('Repair round ' + round)
  const r = await agent(
    'Fix verification failures in ' + ROOT + '. Failures (JSON):\n\n' + JSON.stringify(current, null, 2) +
    '\n\nFix ROOT CAUSES with minimal diffs; preserve the two bug fixes. You MAY edit any file needed. Return a short Hebrew summary.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  repairLog.push(r)
  current = await agent(
    'Re-run on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

return { fixes, finalVerify: current, green: current.typecheck.passed && current.lint.passed && current.tests.passed }
