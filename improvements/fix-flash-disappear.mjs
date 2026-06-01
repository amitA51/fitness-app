export const meta = {
  name: 'sparkos-flash-disappear',
  description: 'One deep Opus investigator empirically reproduces the fresh-state "selector flashes then disappears" on התחל אימון, instruments mount/unmount + stacking, finds the lifecycle root cause, applies the fix, then verify',
  phases: [
    { title: 'Investigate+Fix', detail: 'reproduce empirically, instrument lifecycle, fix root cause' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix failures to green' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const CONTEXT = [
  'PROJECT: ' + ROOT + ' — React+TS+Vite+Supabase fitness PWA "sparkos-fitness-app". RTL Hebrew, react-router v6, framer-motion, IndexedDB local-first, lazy/Suspense code-splitting. A dev server is ALREADY RUNNING at http://localhost:3001 .',
  '',
  'THE BUG (exact user report, latest + most precise clue):',
  '- On a FRESH/incognito profile (empty IndexedDB + localStorage), go to the workout screen → section "מה נתאמן היום?" → click "התחל אימון" (start workout).',
  '- The screen goes slightly BLUR, the exercise library (selector) APPEARS FOR ~1 SECOND, then DISAPPEARS. Pressing "חזור"/back makes it flash again.',
  '- It WORKS when there is saved state (a previous workout with exercises). It FAILS only on FRESH state (no exercises).',
  '',
  'WHAT IS ALREADY PROVEN (do not re-litigate):',
  '- The exercise library DOES render: ~90 exercise buttons mount in the DOM (verified via playwright snapshot). So this is NOT a data/DB/seeding problem and NOT an empty-list problem. The data is present.',
  '- crypto.randomUUID is available on localhost (isSecureContext=true). The earlier crypto fix is for HTTP-on-IP (phone) only and is NOT this symptom.',
  '- ModalOverlay was already fixed to honor blur="none" (blurPxMap). ExerciseSelector passes blur="none", variant="none", zLevel="extreme".',
  '- So the symptom is a LIFECYCLE / STACKING issue: the selector mounts then unmounts (or gets covered/closed) almost immediately on the FRESH path only.',
  '',
  'KEY ARCHITECTURE (already traced — verify, do not assume):',
  '- src/components/workout/ActiveWorkoutNew.tsx WorkoutContent: if there is no current exercise it renders the PreWorkoutScreen branch (~line 316). In THAT branch the lazy <ExerciseSelector> is rendered INLINE under its own <React.Suspense fallback={null}> when state.showExerciseSelector is true (~line 362-381). When exercises exist it instead renders the main branch (~line 387+) where the selector comes from <WorkoutOverlays> (src/components/workout/active/WorkoutOverlays.tsx line 214). The fresh bug is on the PreWorkoutScreen INLINE path.',
  '- PreWorkoutScreen "התחל אימון" onStartWorkout (~line 335) dispatches: SET_MODAL_STATE goal=false, SET_MODAL_STATE warmup=false, setPreWorkoutScreenShown(true), dispatch OPEN_SELECTOR.',
  '- src/components/workout/active/useWorkoutEffects.ts has an effect (~line 158-179) that AUTO-RE-OPENS the selector: if (preWorkoutScreenShown && exercises.length===0 && !showExerciseSelector && !showQuickForm && !showGoalSelector && !showWarmup && !showCooldown) dispatch(OPEN_SELECTOR). There is also a start-flow effect (~line 127-151) gated on preWorkoutScreenShown && exercises.length>0.',
  '- preWorkoutScreenShown is LOCAL React state in WorkoutContent. If WorkoutContent/WorkoutProvider REMOUNTS, it resets to false. WorkoutProvider is wrapped by WorkoutPlaceholder in App.tsx (~line 999).',
  '',
  'PRIME SUSPECTS (confirm or refute empirically — do not guess):',
  '1. A close→reopen FLICKER LOOP: something dispatches CLOSE_SELECTOR (e.g. ModalOverlay onClose firing from a stray backdrop click / focus-trap / Escape / drag), and the auto-reopen effect immediately re-dispatches OPEN_SELECTOR — visually a flash.',
  '2. A REMOUNT of WorkoutContent/WorkoutProvider shortly after start (a changing key, a context value flip, an async init in WorkoutProvider that completes and resets state, or App.tsx AnimatePresence/route remount) resetting preWorkoutScreenShown=false and unmounting the selector.',
  '3. A STACKING/z-index or AnimatePresence exit issue: the selector renders then a sibling overlay (PreWorkoutScreen vs selector, or two AnimatePresence trees) animates it out.',
  '4. An effect dependency causing OPEN then a follow-up dispatch that closes it (e.g. exercises.length transient change, or a goal/warmup modal turning on invisibly and the auto-open guard turning it off).',
].join('\n')

const PROMPT = [
  'You are a senior debugger. Find and FIX the root cause of the fresh-state "selector flashes then disappears" bug. Investigate empirically FIRST, then fix.',
  '',
  CONTEXT,
  '',
  'YOUR PROCESS (do this in order):',
  '',
  'STEP 1 — EMPIRICAL REPRODUCTION (ground truth, do this before reading more code):',
  'Use the playwright browser tools against http://localhost:3001 . Reproduce a FRESH profile:',
  '  - navigate to http://localhost:3001/',
  '  - evaluate: indexedDB.deleteDatabase("sparkos-fitness-db"); localStorage.clear(); sessionStorage.clear();',
  '  - to skip auth+onboarding while keeping DB fresh, evaluate: localStorage.setItem("skip_auth","true"); localStorage.setItem("onboarding_completed","true");',
  '  - navigate to http://localhost:3001/workout , confirm you see "מה נתאמן היום?" + "התחל אימון".',
  'INSTRUMENT the lifecycle BEFORE clicking. Use browser_evaluate to install a MutationObserver on document.body that logs when a [role="dialog"] is added/removed, and patch nothing destructive. Then click "התחל אימון" and capture over ~3 seconds: how many times a [role="dialog"] (the selector) is added then removed (the flash count), the console logs/errors during the window, and for the dialog while present: its computed zIndex/position, what document.elementFromPoint(centerX,centerY) returns (is the dialog actually on top or is something covering it), and whether the dialog node is the SAME node re-toggled or a NEW node each time (mount/unmount vs close/reopen vs remount).',
  'IMPORTANT: the playwright tools may time out on the CLICK itself (animation) — that is fine, the click still lands; proceed to snapshot/evaluate after. If the browser crashes/closes, retry ONCE; if it still fails, fall back to static analysis (Step 2) and say so — do NOT loop on the browser more than twice.',
  'Distinguish the three scenarios with evidence: (a) SAME dialog node toggled open/closed repeatedly = close/reopen loop (suspect #1); (b) dialog node disappears and the surrounding WorkoutContent DOM also changes/remounts = remount (suspect #2); (c) dialog stays in DOM but is covered by another element at center point = stacking (suspect #3).',
  '',
  'STEP 2 — PINPOINT IN CODE:',
  'Based on the empirical scenario, read the exact responsible code and find WHY it only happens fresh (no exercises / PreWorkoutScreen branch). Read as needed: ActiveWorkoutNew.tsx (PreWorkoutScreen branch + inline selector ~316-383), useWorkoutEffects.ts (auto-open ~158-179, start-flow ~127-151), useWorkoutHandlers.ts (handleCloseSelector, handleAddExercise), workoutReducer.ts (OPEN_SELECTOR/CLOSE_SELECTOR/SET_MODAL_STATE), WorkoutProvider.tsx (any async init / state reset / key), PreWorkoutScreen.tsx (onStartWorkout, onCancel), ModalOverlay.tsx (onClose triggers: backdrop click, focus trap, escape), App.tsx (WorkoutPlaceholder ~999, AnimatePresence mode, any key on the workout route). Add temporary console.log instrumentation in the suspected spot, re-run the browser repro, and CONFIRM which dispatch/remount fires. Remove temporary logs before finishing.',
  '',
  'STEP 3 — FIX THE ROOT CAUSE (minimal, correct):',
  'Apply the smallest correct fix for the confirmed cause. Likely shapes (pick per evidence): if close/reopen loop — stop the spurious CLOSE (e.g. guard ModalOverlay onClose, or do not auto-reopen in a way that fights an intentional close; make the pre-workout selector open exactly once and stay until a real user action). If remount — stop the remount / lift preWorkoutScreenShown so it survives, or derive selector-open from reducer state not local state. If stacking — fix z-index/AnimatePresence exclusivity. Do NOT introduce a new architecture; keep the existing single-selector intent. Respect .claude/rules (immutability, explicit error handling via project logger — no silent swallow, files <800 lines, functions <50 lines). Do NOT read/write .md files.',
  '',
  'STEP 4 — CONFIRM THE FIX EMPIRICALLY:',
  'Re-run the SAME fresh browser repro. CONFIRM: after clicking "התחל אימון", the selector opens ONCE and STAYS open (flash count = 0 toggles after the initial open), exercises are visible, no blur covering it. Capture the after-state as proof.',
  '',
  'Return a Hebrew report: the empirical scenario you proved (with the flash/toggle/remount evidence), the exact root cause (file:line + which dispatch/remount), the fix (files changed + why), and the after-repro confirmation. If you could not use the browser, say so explicitly and give your best static diagnosis + fix.',
].join('\n')

phase('Investigate+Fix')
const fix = await agent(PROMPT, { label: 'flash-investigate-fix', phase: 'Investigate+Fix', model: 'opus' })

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
  'Run verification on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report passed + distinct error/failure messages with file:line. Confirm no temporary console.log/debug instrumentation was left behind in the touched files. No fixes. Return ONLY the structured object.',
  { label: 'verify', phase: 'Verify', model: 'opus', schema: VERIFY_SCHEMA },
)

phase('Repair')
let current = verify
let round = 0
while (round < 3 && !(current.typecheck.passed && current.lint.passed && current.tests.passed)) {
  round++
  log('Repair round ' + round)
  await agent(
    'Fix verification failures in ' + ROOT + '. Failures (JSON):\n\n' + JSON.stringify(current, null, 2) +
    '\n\nFix ROOT CAUSES with minimal diffs; preserve the flash-disappear fix. Remove any leftover temporary console.log/debug. You MAY edit any file needed. Return a short Hebrew summary.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  current = await agent(
    'Re-run on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

return { fix, finalVerify: current, green: current.typecheck.passed && current.lint.passed && current.tests.passed }
