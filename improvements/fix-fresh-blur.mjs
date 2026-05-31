export const meta = {
  name: 'sparkos-fix-fresh-blur',
  description: 'Four Opus investigators diagnose the fresh-load "blur + stuck loading on התחל אימון" bug across 4 layers, a synthesizer applies the consensus fix, then verify+repair',
  phases: [
    { title: 'Investigate', detail: 'four parallel read-only investigators, different layers' },
    { title: 'Synthesize+Fix', detail: 'one agent applies the consensus root-cause fix' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix failures to green' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const SYMPTOM = [
  'THE BUG (exact user report, reproduced symptom):',
  '- On the workout screen there is a section "מה נתאמן היום?" (what shall we train today) with a "התחל אימון" (start workout) button.',
  '- Clicking "התחל אימון" makes the screen go BLUR and shows a LOADING state that NEVER resolves — it stays stuck blurred/loading.',
  '- CRITICAL DISCRIMINATOR: it WORKS when there is saved state/cookies/IndexedDB from a previous session, but FAILS in INCOGNITO / a completely FRESH profile (empty localStorage + empty IndexedDB). So this is a FIRST-LOAD / EMPTY-STORAGE bug.',
  '- A known related comment already exists at src/services/indexedDBCore.ts:28-32 describing a race: a second indexedDB.open() blocks until the first upgrade transaction completes, then "read an empty store before seeding has finished — producing a blank exercise list on first load."',
  '- Prior fix attempts (Suspense boundary split in ActiveWorkoutNew.tsx, mode="wait" in App.tsx, a duplicate-key fix in ExerciseReorder.tsx) did NOT resolve this. The exercise library DOES open fine when state is already present — so the selector component itself works; the failure is specific to the fresh-init data/seeding/loading path.',
].join('\n')

const COMMON = [
  'You are investigating ' + ROOT + ' (React+TS+Vite+Supabase fitness PWA "sparkos-fitness-app", RTL Hebrew, react-router v6, framer-motion, IndexedDB local-first, lazy/Suspense code-splitting).',
  '',
  SYMPTOM,
  '',
  'RULES for this INVESTIGATION phase:',
  '- READ-ONLY. Do NOT edit any file. Your job is to find the ROOT CAUSE in YOUR assigned layer and propose an EXACT fix.',
  '- Use codegraph_context / codegraph_trace / codegraph_node + Read/Grep to follow the REAL code path. Trace from the "התחל אימון" click all the way down through your layer.',
  '- Focus ONLY on the FRESH / EMPTY-STORAGE path. Always ask: "what happens here when IndexedDB and localStorage are completely empty and this runs for the very first time?"',
  '- Do NOT read or write .md files.',
  '- Be concrete: give file:line, the exact failing/hanging statement, WHY it hangs/blurs on fresh state but not with saved state, and the precise minimal code change to fix it.',
  '- Rate your confidence 0-100 that the cause you found is THE cause of the blur/stuck-loading symptom.',
  '- Report in Hebrew.',
].join('\n')

const INV_SCHEMA = {
  type: 'object',
  properties: {
    layer: { type: 'string' },
    rootCauseFound: { type: 'boolean' },
    confidence: { type: 'number', description: '0-100 that this is THE cause of the blur/stuck symptom' },
    diagnosis: { type: 'string', description: 'precise root cause in your layer with file:line and WHY fresh-only, Hebrew' },
    blurSource: { type: 'string', description: 'if found: the exact element/Suspense fallback/overlay that renders the blur and why it never clears, with file:line; else "not in my layer"' },
    proposedFix: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          change: { type: 'string', description: 'exact minimal change, Hebrew' },
        },
        required: ['file', 'change'],
      },
    },
    evidence: { type: 'array', items: { type: 'string' }, description: 'code snippets / file:line proving the diagnosis' },
  },
  required: ['layer', 'rootCauseFound', 'confidence', 'diagnosis', 'proposedFix', 'evidence'],
}

const INVESTIGATORS = [
  {
    key: 'INV1-data-seeding',
    prompt: COMMON + '\n' + [
      'YOUR LAYER — DATA / INDEXEDDB INIT + SEEDING on a completely empty DB.',
      'Trace: initDB() (src/services/indexedDBCore.ts) on first-ever open (DB_VERSION 8, onupgradeneeded creates all stores) → getPersonalExercises() (src/services/exerciseDb.ts:21, seeds built-in exercises if empty) → getBuiltInWorkoutTemplates / getWorkoutTemplates seeding → the data that powers "מה נתאמן היום" and the exercise library.',
      'Key questions: On a fresh empty DB, does the seed read happen BEFORE seeding completes (the documented race at indexedDBCore.ts:28-32)? Can initDB reject/hang (onblocked/onerror) and leave dbOpenPromise stuck so every downstream await never resolves (→ perpetual loading)? In incognito, can the upgrade transaction or a Promise.all of dbPut hang or throw and get swallowed? Does ExerciseLibraryTab.loadExercises (300ms retry) actually recover, or can it set an empty list and never a loaded state? Is there any await that never resolves on first load specifically?',
      'Find the precise statement that hangs or returns empty-forever on fresh init, and the minimal fix (e.g. await the seeding write, fix the open-promise memoization, ensure a resolved state even when empty).',
    ].join('\n'),
  },
  {
    key: 'INV2-blur-suspense',
    prompt: COMMON + '\n' + [
      'YOUR LAYER — RENDER / SUSPENSE / THE BLUR OVERLAY itself. This is the most important visual clue: the screen goes BLUR and stays loading.',
      'Find EXACTLY what renders the blur. Grep the whole start-workout path for: backdrop-filter: blur, "blur(", Suspense fallback components (PageLoader, OverlayLoader, the fixed inset-0 fallback), and any loading/skeleton overlay. Candidates: src/components/workout/ActiveWorkoutNew.tsx (PreWorkoutScreen branch + the lazy ExerciseSelector Suspense), src/components/workout/active/WorkoutOverlays.tsx, src/components/workout/states/PreWorkoutScreen.tsx, src/components/workout/components/ui/OverlayLoader.tsx, src/components/ui/ModalOverlay.tsx, App.tsx PageLoader.',
      'Key questions: When showExerciseSelector flips true on a FRESH load, which Suspense boundary mounts and what is its fallback? Does the lazy import of ExerciseSelector / ExerciseLibraryTab / WorkoutTemplates resolve on first load, or does the chunk request hang / 404 / fail and leave the Suspense fallback (a blur) forever? Is there a component that SUSPENDS forever because a data promise thrown to Suspense never resolves on empty DB? Is the blur a backdrop that mounts while the inner content is suspended/empty?',
      'Pinpoint the exact blur element and why it never clears on fresh state, and the minimal fix.',
    ].join('\n'),
  },
  {
    key: 'INV3-provider-state',
    prompt: COMMON + '\n' + [
      'YOUR LAYER — WORKOUT PROVIDER / REDUCER / onStartWorkout state machine on FRESH state (no saved session).',
      'Trace: src/components/workout/core/WorkoutProvider.tsx (how it initializes with no persisted workout — placeholderItem in App.tsx:119, any async hydration), src/components/workout/core/workoutReducer.ts (initial state, OPEN_SELECTOR), the PreWorkoutScreen onStartWorkout handler in ActiveWorkoutNew.tsx (dispatch SET_MODAL_STATE goal/warmup false → OPEN_SELECTOR), useWorkoutEffects.ts, useWorkoutHandlers.ts.',
      'Key questions: On a fresh WorkoutProvider with no saved item, is there an async init (load templates/exercises/previous-data) that gates rendering and never resolves on empty DB, leaving a loading state? Does derived.currentExercise / the PreWorkoutScreen-vs-active branch behave differently with zero data? Does onStartWorkout depend on data that is empty on fresh load? Is there a useEffect that awaits something that hangs on first load? Does WorkoutProvider show its own loader until some data arrives?',
      'Pinpoint the exact gating state that stays loading on fresh init, and the minimal fix.',
    ].join('\n'),
  },
  {
    key: 'INV4-empirical-repro',
    prompt: COMMON + '\n' + [
      'YOUR LAYER — EMPIRICAL REPRODUCTION + the data-fetch that powers "מה נתאמן היום" and the selector tabs.',
      'A dev server is running at http://localhost:3001 . Try to reproduce in a FRESH context: if you can use the playwright browser tools, open a context with CLEARED storage (evaluate: indexedDB.deleteDatabase("sparkos-fitness-db"); localStorage.clear(); then reload), go to /workout, click "התחל אימון", and capture: console errors, any PENDING/failed network request for a lazy JS chunk, and the DOM/CSS of the stuck blur element (which element has backdrop-filter blur, what is inside it). If the browser tools are unavailable/crash, DO NOT loop on them — instead statically analyze the data-fetch path: ExerciseSelector/index.tsx, ExerciseLibraryTab.tsx (loadExercises), WorkoutTemplates.tsx (how it loads templates for "מה נתאמן היום"), and getWorkoutTemplates/getPersonalExercises on empty DB.',
      'Key questions: What is the ACTUAL stuck state — a never-resolving lazy chunk, a never-resolving data promise, or an empty list rendered under a blur? Which component owns "מה נתאמן היום" and its "התחל אימון" button, and what does that button do on fresh state? Capture ground-truth evidence.',
      'Report the empirical findings (or, if browser unavailable, the static data-fetch analysis) and the minimal fix.',
    ].join('\n'),
  },
]

phase('Investigate')
log('4 Opus investigators diagnosing the fresh-load blur/stuck bug in parallel')
const diagnoses = (await parallel(
  INVESTIGATORS.map((inv) => () =>
    agent(inv.prompt, { label: 'inv:' + inv.key, phase: 'Investigate', model: 'opus', schema: INV_SCHEMA }),
  ),
)).filter(Boolean)

phase('Synthesize+Fix')
log('Synthesizer applying the consensus root-cause fix')
const fix = await agent(
  [
    'You are fixing the fresh-load "blur + stuck loading on התחל אימון" bug in ' + ROOT + '.',
    SYMPTOM,
    '',
    'Four investigators analyzed four layers. Their diagnoses (JSON):',
    '',
    JSON.stringify(diagnoses, null, 2),
    '',
    'YOUR JOB:',
    '1. Weigh the diagnoses by confidence + evidence. Identify the TRUE root cause of the blur/stuck-loading on fresh/empty storage. There may be ONE primary cause and secondary contributors — fix the primary cause, and any secondary issue that clearly also breaks the fresh path.',
    '2. Apply the minimal, correct fix(es). Edit whatever files are needed. Common likely fixes: ensure IndexedDB seeding writes are awaited before the read returns (kill the empty-list race); ensure initDB never leaves a stuck/rejected open-promise; ensure the Suspense fallback that shows the blur actually resolves (lazy chunk + data); ensure no data promise is thrown to Suspense and never resolved on empty DB; ensure a loading gate flips to loaded even when the dataset is legitimately empty on first run.',
    '3. Respect .claude/rules (immutability, explicit error handling via the project logger — never silently swallow, files <800 lines, functions <50 lines). Match existing style. Do NOT read/write .md files.',
    '4. Add a regression test if the root cause is unit-testable (e.g. getPersonalExercises seeding on an empty/mock DB resolves a non-empty list; initDB resolves once). Put it next to existing tests.',
    '5. After editing, re-trace the fresh-load path to CONFIRM the blur/loading now resolves: התחל אימון → selector mounts → data loads → exercises render, on empty storage.',
    'Return a Hebrew summary: the chosen root cause, the files changed and why, and the confirmation trace.',
  ].join('\n'),
  { label: 'synthesize-fix', phase: 'Synthesize+Fix', model: 'opus' },
)

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
    '\n\nFix ROOT CAUSES with minimal diffs; preserve the fresh-load bug fix. You MAY edit any file needed. Return a short Hebrew summary.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  repairLog.push(r)
  current = await agent(
    'Re-run on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

return { diagnoses, fix, finalVerify: current, green: current.typecheck.passed && current.lint.passed && current.tests.passed }
