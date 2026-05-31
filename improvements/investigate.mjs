export const meta = {
  name: 'sparkos-investigate-surfaces',
  description: 'Read-only deep investigation of 6 product surfaces + coach/role architecture to plan a coherent redesign',
  phases: [{ title: 'Investigate' }],
}

const ROOT = 'C:/Users/amit0/Desktop/fitness-app'

const COMMON = [
  'You are doing a READ-ONLY investigation of the React+TS+Vite+Supabase fitness PWA at ' + ROOT + ' (package "sparkos-fitness-app").',
  'GOAL: understand the CURRENT state of your assigned surface so a coherent redesign can be planned. Do NOT edit anything.',
  'RULES:',
  '- READ-ONLY. No edits, no writes.',
  '- DIG INTO REAL SOURCE. Open the .ts/.tsx files, read the actual implementation, trace the real code paths (use codegraph_context / codegraph_trace / codegraph_explore + Read/Grep).',
  '- Do NOT read .md files. Conclusions must come from the CODE.',
  '- Cite real file:line for every claim. If you did not open it, do not claim it.',
  '- For every named bug, find the ROOT CAUSE in the code (the specific line/handler), do not guess.',
  '- Be concrete and high-signal. Report in Hebrew in the structured object.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    surface: { type: 'string' },
    currentState: { type: 'string', description: 'What this surface currently does / renders, prose, Hebrew' },
    keyFiles: { type: 'array', items: { type: 'string' }, description: 'main files with role, file:line' },
    namedBugs: {
      type: 'array',
      description: 'root-cause analysis of the specific bugs the user named',
      items: {
        type: 'object',
        properties: {
          bug: { type: 'string' },
          rootCause: { type: 'string', description: 'the actual code cause, Hebrew' },
          files: { type: 'array', items: { type: 'string' } },
          fix: { type: 'string', description: 'concrete fix direction, Hebrew' },
        },
        required: ['bug', 'rootCause', 'files', 'fix'],
      },
    },
    gapsAndJunk: { type: 'array', items: { type: 'string' }, description: 'missing things that SHOULD be there, and junk/dead UI that should NOT, Hebrew' },
    recommendation: { type: 'string', description: 'how to redesign this surface to be coherent + high UX, Hebrew' },
    crossCutting: { type: 'array', items: { type: 'string' }, description: 'anything that affects other surfaces (esp. coach/role split), Hebrew' },
  },
  required: ['surface', 'currentState', 'keyFiles', 'namedBugs', 'gapsAndJunk', 'recommendation', 'crossCutting'],
}

const AREAS = [
  {
    key: 'start-workout',
    prompt: COMMON + '\n' + [
      'SURFACE: START-WORKOUT FLOW (the heart of issue #1).',
      'Investigate the entry point for starting a workout and the pre-workout screen.',
      'Files to start from: src/components/workout/states/PreWorkoutScreen.tsx, src/components/workout/ExerciseSelector/, src/components/workout/WorkoutTemplates.tsx, src/pages/Dashboard.tsx (the "start workout" button + the greeting "ערב טוב"/good-evening area), src/pages/templates/, the active workout entry (src/components/workout/active/, ActiveWorkoutNew.tsx).',
      'USER-REPORTED BUGS to root-cause:',
      'A) When pressing to start a workout, the EXERCISE LIBRARY does not open. Trace the click handler from the start-workout button to where the exercise selector/library is supposed to mount. Find exactly why it does not open (missing state, broken conditional, unmounted modal, navigation that goes nowhere).',
      'B) On the start-workout / pre-workout area, ABOVE the exercises, under the greeting ("ערב טוב" = good evening) there is an EMPTY area where "kilograms" and "days" labels show nothing. Find what component renders that area, what data it expects, and why it renders empty (missing data source, undefined props, stat cards with no values). Report what SHOULD be there.',
      'ALSO map: can the user currently (1) start an empty workout and add exercises on the fly, (2) start from a self-made template, (3) start from a coach-assigned template? Trace each path and report which work and which are broken/missing.',
      'Recommendation: how should the start-workout screen be redesigned to be coherent and genuinely useful (build-on-the-fly OR from template [self or coach]).',
    ].join('\n'),
  },
  {
    key: 'progress',
    prompt: COMMON + '\n' + [
      'SURFACE: PROGRESS SCREEN (issue #2).',
      'Files: src/pages/Progress.tsx, src/pages/progress/ (tabs/, components/, modals/), src/components/workout/AnalyticsDashboard.tsx, src/components/charts/.',
      'USER-REPORTED BUG: the Progress screen "shows all the screens" — investigate what this means in code. Likely a tab/conditional-render bug where all tabs render at once, or a layout bug, or every section mounts regardless of selection. Find the root cause (tab state not gating render, missing display:none, all tabs mapped without active check).',
      'Map every section/tab the Progress screen currently renders and judge: which are genuinely useful progress data vs which are junk/placeholder/duplicated/empty.',
      'Recommendation: how to make Progress purposeful and accurate — exactly the progress data a lifter needs (volume trends, PRs, streak, per-muscle, body metrics?), and what to cut.',
    ].join('\n'),
  },
  {
    key: 'nutrition',
    prompt: COMMON + '\n' + [
      'SURFACE: NUTRITION (issue #3).',
      'Files: src/pages/Nutrition.tsx, src/pages/nutrition/ (components/, hooks/), src/services/nutritionService.ts, src/components/nutrition/.',
      'Map what nutrition currently does: logging meals? macros/calories? goals? water? Trace the data model and the UI flow.',
      'Judge the UX: what does a user actually need from a nutrition screen in a fitness app (quick meal/macro logging, daily targets vs actual, water, history)? What is missing, what is awkward, what is junk.',
      'IMPORTANT cross-cut: nutrition GOALS currently live in Settings (per issue #6) — report how nutrition goals are defined/stored today and how they should move INTO the nutrition screen.',
      'Recommendation: a coherent, high-UX nutrition screen design grounded in the existing data model.',
    ].join('\n'),
  },
  {
    key: 'coach-platform',
    prompt: COMMON + '\n' + [
      'SURFACE: COACH PLATFORM — FULL MAP, frontend AND backend (issues #4 + #5). This is the most important investigation.',
      'Frontend files: src/pages/coach/, any coach components, src/services/coach/ (+ __tests__), src/services/ai/ (coach suggestions?).',
      'Backend files: supabase/migrations/ (esp. *coach_platform*.sql and *security_rls*), supabase/functions/coach-invite-accept/, coach-push-send/, ai-chat/.',
      'MAP EXACTLY what coach infrastructure ALREADY EXISTS:',
      '- DB schema: what tables/columns model the coach<->client relationship, roles, invites, messages, assigned templates/plans, status (active/ended). Quote the relevant migration lines.',
      '- RLS policies: what can a coach read/write about a client, and vice versa.',
      '- Edge functions: what coach actions are implemented (invite, push, messaging).',
      '- Frontend: what coach UI exists today, what works, what is stub.',
      '- Is there ANY role concept (coach vs trainee) already in the user model / auth / profile? Where is it stored?',
      'Then ANALYZE the product direction the user wants: a single app that asks at start "are you a coach or a trainee?", where TRAINEES get the normal app and COACHES get everything trainees have PLUS a management panel with full control — assign templates/plans, push to clients, view each client\'s stats/progress/adherence, message them. The app is sold to the coach who onboards their trainees.',
      'Recommendation: concrete architecture for the role split — where role is stored, how the start/login screen branches, how the coach management panel is structured, and where coach SUGGESTIONS should be surfaced inline inside the trainee app (instead of a separate dead screen) — e.g. on the workout/nutrition/progress screens. Be specific about what to build vs what already exists to wire up.',
    ].join('\n'),
  },
  {
    key: 'settings',
    prompt: COMMON + '\n' + [
      'SURFACE: SETTINGS (issue #6).',
      'Files: src/pages/Settings.tsx, src/pages/settings/ (sections/, hooks/).',
      'Enumerate EVERY item/section currently in Settings. For each, determine: (a) is it actually wired to real state/behavior, or a dead toggle that does nothing? (b) does it belong in Settings, or should it move elsewhere (e.g. nutrition goals -> Nutrition screen; workout defaults -> maybe pre-workout; theme/units/account -> stay)?',
      'Find dead/disconnected settings (toggles with no effect, handlers that are no-ops) by tracing each control to its consumer.',
      'Recommendation: a clean, minimal Settings containing only what genuinely belongs (account, units, theme, notifications, privacy/data, sign-out), with a clear list of what to MOVE OUT and where, and what to WIRE UP that is currently dead.',
    ].join('\n'),
  },
  {
    key: 'role-auth-onboarding',
    prompt: COMMON + '\n' + [
      'SURFACE: AUTH / ONBOARDING / APP-SHELL ROUTING — to support the coach/trainee role split (#4).',
      'Files: src/pages/login/ (+ steps/, components/), src/pages/onboarding/ (+ steps/, components/), src/App.tsx (routing + AppShell + bottom nav), src/contexts/, src/lib/supabase.ts, any auth/profile service.',
      'Map: how does login + onboarding currently work, what user profile/state is created, and how is the bottom-nav / route set built (which tabs, where defined)?',
      'Determine where a ROLE (coach vs trainee) could be captured (a new onboarding step? a field on the profile / a Supabase table?) and how the App shell + navigation would conditionally render a DIFFERENT experience per role (trainees: normal tabs; coaches: normal tabs PLUS a management panel/tab).',
      'Cross-check with the coach-platform agent\'s domain: if the DB already has a role/coach concept, report exactly where, so the frontend can read it.',
      'Recommendation: the minimal, clean way to (1) ask role at start, (2) persist it, (3) branch the app shell + navigation, without duplicating the whole app — coaches get an additive panel, not a forked codebase.',
    ].join('\n'),
  },
]

phase('Investigate')
log('6 Opus read-only investigators mapping the surfaces + coach/role architecture')
const results = await parallel(
  AREAS.map((a) => () =>
    agent(a.prompt, { label: 'inv:' + a.key, phase: 'Investigate', model: 'opus', schema: SCHEMA }),
  ),
)
return { investigations: results.filter(Boolean) }
