export const meta = {
  name: 'sparkos-prewo-persist',
  description: 'Replace the brittle local preWorkoutScreenShown flag with a trigger-agnostic sessionStorage-backed intent so the fresh-start exercise selector survives any remount (opens once and STAYS), cleared on cancel/exit; then verify+repair',
  phases: [
    { title: 'Implement', detail: 'sessionStorage-backed pre-workout intent + cleanup' },
    { title: 'Verify', detail: 'typecheck + lint + tests' },
    { title: 'Repair', detail: 'fix failures to green' },
    { title: 'Confirm', detail: 'best-effort empirical browser repro' },
  ],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const BUG = [
  'BUG (fresh/incognito only — empty IndexedDB+localStorage): on the workout screen, section "מה נתאמן היום?", clicking "התחל אימון" makes the exercise library (selector) APPEAR for ~1s then DISAPPEAR and STAY GONE. No console errors. Pressing back flashes it again. With saved state (existing exercises) it works fine.',
  '',
  'PROVEN FACTS (do not re-litigate, they are confirmed by reading the code):',
  '- The selector renders fine: ~90 exercise buttons mount. Not a data/DB/seeding/empty-list problem.',
  '- isSecureContext=true on localhost; crypto.randomUUID works. Not the crypto issue.',
  '- ModalOverlay already honors blur="none". ExerciseSelector passes blur="none"/variant="none"/zLevel="extreme".',
  '- The symptom is a LIFECYCLE issue: the selector opens then something resets it and it stays closed — ONLY on the fresh PreWorkoutScreen path.',
].join('\n')

const ROOTCAUSE = [
  'ROOT CAUSE (confirmed by reading the code — this is the design flaw to fix):',
  'Selector visibility on the fresh path is governed by TWO state sources that can DESYNC and where the recovery path is brittle:',
  '  1) state.showExerciseSelector — in the reducer (src/components/workout/core/workoutReducer.ts OPEN_SELECTOR/CLOSE_SELECTOR). It is sanitized to FALSE on every WorkoutProvider init (WorkoutProvider.tsx:112-155, createInitialState in workoutTypes.ts:266).',
  '  2) preWorkoutScreenShown — LOCAL React useState in WorkoutContent (ActiveWorkoutNew.tsx:85). Set to true exactly ONCE (ActiveWorkoutNew.tsx:341) and there is NO setter back to false anywhere. It RESETS to false whenever WorkoutContent remounts.',
  '',
  'The inline fresh-path selector is rendered conditioned ONLY on state.showExerciseSelector (ActiveWorkoutNew.tsx:362). The SAFETY NET that re-opens the selector after a transient close lives in useWorkoutEffects.ts:158-179 and is GATED on preWorkoutScreenShown===true. So:',
  '- "התחל אימון" → setPreWorkoutScreenShown(true) + OPEN_SELECTOR → selector opens. Good.',
  '- Something remounts WorkoutContent (~1s later). preWorkoutScreenShown resets to false. If the selector also gets closed/reset, the safety-net effect can NO LONGER fire (its guard preWorkoutScreenShown is false) → selector stays gone. EXACTLY the symptom.',
  '- IMPORTANT: the click does NOT navigate, so the App.tsx AnimatePresence key={location.pathname} is NOT the trigger. The exact remount trigger is NOT confirmed (could be an inner Suspense re-suspend remounting WorkoutContent, StrictMode, or an async state flip from the coachProgram load at ActiveWorkoutNew.tsx:97-113). We will fix in a TRIGGER-AGNOSTIC way so it does not matter what the trigger is.',
  '',
  'WHY the naive "lift preWorkoutScreenShown into the reducer" fix is WRONG: if the trigger is a WorkoutProvider remount, the reducer itself reinitializes (showExerciseSelector sanitized to false), so a reducer flag would ALSO be lost. The fix must survive remounts of BOTH WorkoutContent and WorkoutProvider.',
].join('\n')

const PROMPT = [
  'Implement a trigger-agnostic fix for the fresh-start "selector flashes then disappears" bug in ' + ROOT + '. Read the real code first; make the minimal correct change.',
  '',
  BUG,
  '',
  ROOTCAUSE,
  '',
  'THE FIX — make the "user has started a fresh workout and wants the selector" intent SURVIVE any remount, via sessionStorage (survives both WorkoutContent and WorkoutProvider remounts; cleared when the workout truly starts or is cancelled). Concretely:',
  '',
  '1) In src/components/workout/ActiveWorkoutNew.tsx:',
  '   - Replace the brittle `const [preWorkoutScreenShown, setPreWorkoutScreenShown] = useState(false)` (line ~85) with a sessionStorage-backed flag. Use a single, namespaced key, e.g. "sparkos_prewo_started". Lazy-init from sessionStorage so a remount RECOVERS the true value:',
  '       const [preWorkoutScreenShown, setPreWorkoutScreenShownState] = useState(() => { try { return sessionStorage.getItem("sparkos_prewo_started") === "1"; } catch { return false; } });',
  '       const setPreWorkoutScreenShown = useCallback((v: boolean) => { try { if (v) sessionStorage.setItem("sparkos_prewo_started","1"); else sessionStorage.removeItem("sparkos_prewo_started"); } catch (err) { logger.workout?.warn?.("prewo flag persist failed", err); } setPreWorkoutScreenShownState(v); }, []);',
  '     (import useCallback if not already imported; logger is already imported in this file.)',
  '   - onStartWorkout (line ~335): keep dispatch goal=false, warmup=false, then setPreWorkoutScreenShown(true), then dispatch OPEN_SELECTOR. (Unchanged behavior, now persisted.)',
  '   - onCancel (line ~344): ALSO call setPreWorkoutScreenShown(false) so the intent is cleared on explicit exit (before onExit()).',
  '   - CRUCIAL CLEANUP so the flag cannot leak into a later/normal session: clear it (setPreWorkoutScreenShown(false) / remove the key) as soon as the workout actually has exercises (we have left the empty fresh-start state). Add a small effect: when derived.currentExercise becomes truthy (exercises exist), if the flag is set, clear it. This guarantees the persisted intent only lives during the empty pre-workout window and never reopens the selector mid-workout.',
  '',
  '2) Confirm the safety-net effect in src/components/workout/active/useWorkoutEffects.ts:158-179 still receives preWorkoutScreenShown as a prop (it does) — now that the prop recovers true after a remount, this effect will re-dispatch OPEN_SELECTOR and the selector re-opens automatically. Do NOT weaken its guards (it must still NOT fire while a goal/warmup/quickform/cooldown modal is open, and only when exercises.length===0).',
  '',
  '3) Make sure the start-flow effect (useWorkoutEffects.ts:127-151, gated on preWorkoutScreenShown && exercises.length>0) is not adversely triggered: on the fresh path exercises.length===0 so it stays dormant; once exercises are added we clear the flag (step 1 cleanup) AND we leave this branch — verify there is no window where goal/warmup pops unexpectedly. If there is a risk, gate the start-flow with its existing startFlowRan ref (already present) — keep it intact.',
  '',
  'CONSTRAINTS: respect .claude/rules (immutability, explicit error handling via logger — never silent swallow, files <800 lines, functions <50 lines). Match existing code style. Do NOT read or write .md files. Do NOT change the reducer architecture. Keep the single-selector intent. Keep diffs minimal and focused on these files (ActiveWorkoutNew.tsx primarily; touch useWorkoutEffects.ts only if needed).',
  '',
  'After editing, re-read the changed regions and explain in Hebrew: the exact change, and WHY it now survives a remount (lazy-init recovers true → safety-net refires → selector reopens), and why it cannot leak past the pre-workout window (cleared when exercises exist / on cancel).',
].join('\n')

phase('Implement')
const impl = await agent(PROMPT, { label: 'implement-prewo-persist', phase: 'Implement', model: 'opus' })

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
let current = verify
let round = 0
while (round < 3 && !(current.typecheck.passed && current.lint.passed && current.tests.passed)) {
  round++
  log('Repair round ' + round)
  await agent(
    'Fix verification failures in ' + ROOT + '. Failures (JSON):\n\n' + JSON.stringify(current, null, 2) +
    '\n\nFix ROOT CAUSES with minimal diffs; preserve the sessionStorage-backed pre-workout intent fix. You MAY edit any file needed. Return a short Hebrew summary.',
    { label: 'repair:r' + round, phase: 'Repair', model: 'opus' },
  )
  current = await agent(
    'Re-run on ' + ROOT + ': npx tsc --noEmit ; npx biome check ./src ; npx vitest run. Report results. Return ONLY the structured object.',
    { label: 'reverify:r' + round, phase: 'Repair', model: 'opus', schema: VERIFY_SCHEMA },
  )
}

phase('Confirm')
const confirm = await agent(
  [
    'Best-effort EMPIRICAL confirmation in ' + ROOT + ' that the fresh-start selector now opens ONCE and STAYS open. A dev server is running at http://localhost:3001 .',
    'Using the playwright browser tools: navigate to http://localhost:3001/ ; evaluate to clear storage: indexedDB.deleteDatabase("sparkos-fitness-db"); localStorage.clear(); sessionStorage.clear(); then localStorage.setItem("skip_auth","true"); localStorage.setItem("onboarding_completed","true"); navigate to http://localhost:3001/workout ; confirm "מה נתאמן היום?" + "התחל אימון" are visible; install a MutationObserver that logs add/remove of [role="dialog"]; click "התחל אימון"; wait ~3s; report: did a [role="dialog"] appear and STAY (good) or appear-then-disappear (still broken); the add/remove counts; any console errors.',
    'The click may time out on animation — that is fine, the click lands; proceed. If the browser backend is unavailable/crashes, retry at most ONCE, then report that empirical confirmation was not possible and give a static confidence assessment instead. Do NOT loop on the browser.',
    'Return a Hebrew report of what you observed (selector stays vs disappears, counts, errors) or that the browser was unavailable.',
  ].join('\n'),
  { label: 'confirm-browser', phase: 'Confirm', model: 'opus' },
)

return { impl, finalVerify: current, green: current.typecheck.passed && current.lint.passed && current.tests.passed, confirm }
