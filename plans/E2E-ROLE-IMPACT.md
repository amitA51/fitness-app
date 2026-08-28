# E2E + unit test impact: removing the view-mode toggle and self-serve coach

**Scope of this document.** Read-only inventory of every test and e2e spec that
depends on the client-side coach/trainee view toggle, or on a user being able to
promote themselves to coach through the UI. Nothing was executed and nothing was
modified except this file.

**Snapshot taken:** 2026-08-27, ~21:20 UTC.

## Read this first — the change is already half-landed

The repo mutated while this inventory was being taken (a second worker is
active). Verified by reading the live files:

| Thing | Live state |
| --- | --- |
| `src/components/ui/ViewModeBar.tsx` | **deleted** |
| `src/components/ui/ViewModeBar.test.tsx` | **deleted** (it still existed at the start of this pass; its content is reproduced below so the next batch does not resurrect it) |
| `src/contexts/CoachContext.tsx` | **rewritten** — the context value is now `{ isCoach, role, coachProfile, subscription, loading, refresh, enable, disable }`. No `viewMode`, no `isCoachView`, no `canSwitchView`, no `setViewMode`. Its header comment now says: *"There is deliberately NO local preference that can put a user into the coach shell"* |
| `src/components/ui/BottomNav.tsx:251` | now `const { isCoach } = useCoach();` — branches on the server role |
| `src/AppRouter.tsx:335-352` | `CoachGuard` / `TraineeGuard` / `RoleHome` all branch on `isCoach` (server role) |
| `src/contexts/__tests__/CoachContext.test.tsx` | **not** updated — still destructures all four removed fields |
| `src/pages/settings/sections/CoachSection.tsx:27` | **still there** — `enable`/`disable` + the `"הפוך למאמן"` button. Self-serve coach promotion has *not* been removed yet |
| `src/pages/onboarding/steps/RoleStep.tsx`, `types.ts:71` (`{ id: 'role' … }`), `stepsForRole`, `OnboardingData.role`, `pending_coach_intent` | **all still there**. The onboarding role step has *not* been removed yet |

Caveat on method: the `grep` index in this workspace served **stale content**
for files under `src/` (it returned `canSwitchView` at `CoachContext.tsx:202`, a
line past the current end of file). Every source-file claim in this document was
re-verified by reading the file. Test/spec line numbers were cross-checked
against full-file reads. Per the task constraints, Playwright, `test:e2e`, and
any server were not run; `tsc` was also not run, because with another worker
deleting files mid-pass a type-check snapshot would be noise rather than
evidence.

---

## Findings, worst first

### 1. `src/contexts/__tests__/CoachContext.test.tsx` — already failing (blocker)

Nine entries in one file. This is the only test file that is broken *right now*,
before the rest of the change lands.

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 32 | `const { isCoach, role, loading, viewMode, isCoachView, canSwitchView, setViewMode } = useCoach();` | 4 × TS2339 — none of `viewMode`, `isCoachView`, `canSwitchView`, `setViewMode` exist on the live `CoachContextValue`. Type-check gate fails; the whole suite fails to compile | rewrite the `Probe` to read only `{ isCoach, role, loading }` |
| 38-40 | renders `viewMode`, `isCoachView`, `canSwitchView` into `data-testid` spans | same removed fields | delete the three spans |
| 41-46 | two buttons calling `setViewMode('coach')` / `setViewMode('trainee')` | removed API | delete both buttons |
| 157 | `describe('CoachContext active view mode')` — the whole block, 5 tests | the concept is gone | delete as obsolete |
| 158-170 | *"defaults the active view to the resolved role (coach → coach view)"* — asserts `viewMode === 'coach'`, `isCoachView === true` | no active view exists; the role alone decides the shell | delete as obsolete (already covered by the role-SSOT test at 59) |
| 172-190 | *"defaults a trainee to the trainee view but lets anyone switch (demo)"* — asserts `canSwitchView === 'true'` for a **trainee** | this is the demo back door the change exists to close | delete as obsolete |
| 192-215 | *"lazily enables coach mode … when a trainee switches to coach view"* — clicks `toCoach`, expects `enableCoachMode` to have been called and `localStorage.view_mode === 'coach'` | client-side self-promotion via a view switch is exactly what is being removed | delete as obsolete |
| 217-232 | *"respects an explicit stored view choice over the resolved role"* — seeds `localStorage.view_mode = 'trainee'` and expects a **coach** to render the trainee shell | inverted after the change: the server role must win unconditionally | rewrite to server role — assert a stale `view_mode` key is ignored |
| 108-127 | *"honors a pending guest coach intent by promoting once after sign-in"* — seeds `pending_coach_intent`, expects `enableCoachMode` called once | still passes today (`CoachContext.tsx` keeps this path). Dies with the self-serve coach removal, since `pending_coach_intent` is written by the onboarding role step | delete as obsolete, in the same batch that deletes `RoleStep` |

Survives and should be kept: lines 59-106 (role derives from `profiles.role`,
`coach_profiles` fallback), 129-140 (`cached_role` first-paint hint), 142-154
(guests are trainees without a network call). These are the tests the new model
wants.

### 2. Zero e2e coverage of any `/coach` route — the real gap (high)

No spec in `e2e/` navigates to `/coach` or any child. Verified against every
`page.goto` in the tree:

- `e2e/a11y.spec.ts:44-49` — `PUBLIC_ROUTES` is `/`, `/legal/terms`,
  `/legal/privacy`, `/accessibility`. axe never sees an authenticated screen.
- `e2e/visual-qa.spec.ts:76-84` — the route walk is `/`, `/nutrition`,
  `/progress`, `/program`, `/templates`, `/settings`, `/workout`.
- `e2e/level-qa.spec.ts:34`, `restdays-qa.spec.ts:35`, `bigthree-qa.spec.ts:33`
  — seeded guest, trainee routes only.
- `e2e/journeys/*` — guest seed or `test.fixme`.

Nothing breaks. That is the problem: after `CoachGuard` (`AppRouter.tsx:335-341`)
trusts only the server role, the coach shell has **no automated coverage at all**
and no test will notice a regression in it. Fix: needs a seeded coach fixture
(see the last section).

### 3. `e2e/onboarding-qa.spec.ts` — will silently capture the wrong steps (high)

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 3-4 | header: *"the trimmed 6-step trainee wizard (welcome → role → profile → goals → האימון שלכם → complete)"* | becomes a 5-step wizard | update the header |
| 58-61 | `// role` → `await next()` → `shoot(page, 'ob-02-role')` | the role step no longer exists, so `next()` lands on `profile`; `ob-02-role.png` captures the profile step | delete the role hop and renumber `ob-02…ob-06` |
| 62-67 | `page.getByText('מתאמן').first()` then click, *"pick trainee so the personal steps appear"* | the locator finds nothing. The click is `.catch(() => {})` best-effort, so the spec **still exits 0** while every later screenshot is off by one step | delete as obsolete |

Severity is high precisely because it cannot fail: it is screenshot evidence, and
after the change it produces confidently mislabelled PNGs.

### 4. `src/pages/onboarding/__tests__/onboardingFlow.logic.test.ts` — 3 entries (high)

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 16-18 | `postOnboardingDestination({ role: 'coach' })` → `'/coach/invites'` | nobody can finish onboarding as a coach; a self-declared `role: 'coach'` must no longer route into the coach shell | delete as obsolete, or rewrite to assert every onboarding completion lands on `/` and let `RoleHome` redirect a server-side coach |
| 39-43 | `stepsForRole('coach')` → `['welcome', 'role', 'profile', 'complete']` | both the `'role'` step and the coach branch of `stepsForRole` disappear | delete as obsolete |
| 20-27 | trainee / role-less → `'/'` | passes either way, but `role: ''` / `role: undefined` stop being meaningful inputs once `OnboardingData.role` is dropped | rewrite to server role — collapse to one "onboarding always lands on `/`" case |

### 5. `src/pages/onboarding/__tests__/useOnboardingWizard.equipment.test.ts` — 2 entries (medium)

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 10 | `stepsForRole('trainee').findIndex(s => s.id === 'equipment')` to compute `EQUIPMENT_INDEX` | `stepsForRole` loses its reason to exist; with the role step gone every index shifts by one | rewrite against `STEPS` directly |
| 16 | seeds `onboarding_draft` with `{ ...DEFAULT_ONBOARDING, role: 'trainee', equipment }` | `role` leaves `OnboardingData` → TS error on the object literal, and the seeded step index points at the wrong step | drop `role` from the seed |

The three equipment assertions themselves (28-42) are role-independent and should
survive unchanged.

### 6. `src/components/ui/BottomNav.test.tsx` — stale mock, misleading doc (medium)

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 14-15 | comment: *"BottomNav branches on the ACTIVE VIEW (isCoachView), not the server role, so the top mode bar can swap the whole shell"* | factually wrong as of the live `BottomNav.tsx:251`, which reads `isCoach`. A comment that lies about the role model is how the toggle gets reintroduced | rewrite to server role |
| 20 | mock supplies `isCoachView: mockIsCoach` | dead key — nothing reads it | delete the key |
| 22 | mock supplies `viewMode: mockIsCoach ? 'coach' : 'trainee'` | dead key | delete the key |

No test in this file fails: the mock also supplies `isCoach`, which is what
`BottomNav` now reads. Worth noting that lines 63-127 (the coach tab set, the
`/coach/*` hrefs, the unread badge moving to `הודעות`, the `/me` personal-mode
link) already prove the coach shell **by flipping a mocked role, never by
clicking a toggle** — this file is the pattern the e2e side should copy.

### 7. `src/services/__tests__/supabaseAuth.test.ts` — 2 entries (medium)

| Line | Currently asserts / does | What breaks | Suggested fix |
| --- | --- | --- | --- |
| 349-359 | *"removes coach view/role/reminder localStorage keys"* — seeds `view_mode`, `cached_role`, `coach_reminders_fired` and asserts `signOut()` nulls all three | `view_mode` is never written again. The assertion keeps passing by accident (removing an absent key) until someone drops `view_mode` from the cleanup list in `signOut`, at which point it fails for a reason that no longer matters | rewrite to server role — keep `cached_role` + `coach_reminders_fired`, drop the `view_mode` leg (or keep it deliberately as a one-release migration test and say so in a comment) |
| 179-184 | `signUp('a@b.com', 'pw', { role: 'athlete' })` → asserts `options.data.role === 'athlete'` | a client-supplied role at signup contradicts "server-assigned only". Not a break, a policy contradiction to resolve | flag for the owning batch — decide whether signup metadata may still carry a role hint |

### 8. Screenshot baselines shift, nothing asserts on them (low)

`e2e/visual-qa.spec.ts` (`02-home-seeded` at 73 and the whole walk at 85-95),
`e2e/level-qa.spec.ts:34-53`, `e2e/restdays-qa.spec.ts:35-41`,
`e2e/bigthree-qa.spec.ts:33-39` all seed a guest via `localStorage`
(`skip_auth` / `onboarding_completed` / `user_profile`) and screenshot trainee
routes. Under the old `canSwitchView = authed && (DEMO_OPEN_VIEW_SWITCH || role === 'coach')`
a **guest counted as `authed`**, so these runs rendered the mode bar and every
frame will now shift vertically. `visual-qa.spec.ts:82` (`/settings`) also still
captures `CoachSection`'s `"הפוך למאמן"` block, which disappears in the second
half of the change. No assertions involved — regenerate baselines, no code fix.

### 9. Nothing tests the thing being deleted (low, but name it)

- `become_coach` appears in **zero** `*.test.ts*` files. `enableCoachMode` /
  `leaveCoachMode` have no direct unit test — they only appear as `vi.mock`
  stubs (`src/services/coach/__tests__/messageService.threads.test.ts:38`,
  `programAssignment.test.ts:28`, `messageService.bulk.test.ts:20`).
- `src/pages/settings/sections/CoachSection.tsx` — the `"הפוך למאמן"` toggle
  itself — has **no test file**.

Consequence: deleting the self-serve flow will produce no red test, and no test
guards the server-assigned replacement. Whoever lands it needs a new test, not
just deletions.

### Confirmed unaffected

`e2e/smoke.spec.ts` (public landing only), `e2e/journeys/paywall-entitlement.spec.ts`,
`e2e/journeys/workout-start-save-summary.spec.ts` (guest seed, trainee flow),
`src/__tests__/appRouterHelpers.test.ts:13-28` and
`src/pages/coach/__tests__/resolveCoachBackTarget.test.ts:6-16` (pure `/coach/*`
path-shape helpers — the routes survive, only who reaches them changes), and the
whole `src/services/coach/__tests__/**` suite (mocks Supabase directly, never a
UI toggle). `src/test/setup.ts` does not stub `useCoach` — no global blast radius.

### For the record: the deleted `ViewModeBar.test.tsx`

It existed at the start of this pass and is now gone along with its component.
What it covered, so nobody re-adds it: a `radiogroup` named
`'החלפת תצוגה בין מתאמן למאמן'` with radios `'תצוגת מתאמן'` / `'תצוגת מאמן'`
(31-38); the active highlight tracking `isCoachView` (40-45);
`setViewMode('coach')` + `navigate('/coach')` on switch (47-55); no-op on
re-clicking the active segment (57-65); and rendering nothing when
`canSwitchView` is false (67-71). All five are obsolete by construction.

---

## Specs that need a coach-role fixture instead of a UI toggle

Once nobody can self-promote through the UI, the only way into `/coach` is an
account whose `profiles.role` is already `'coach'` server-side. Today **no e2e
spec reaches the coach shell at all**, so this section is less "repair these
specs" than "these are the specs that must gain a seeded coach, or the coach half
of the app ships untested".

The existing seeding mechanisms, for reference:

- guest + onboarded, pure `localStorage` (`visual-qa.spec.ts:44-59`,
  `level-qa.spec.ts:38-53`, `journeys/workout-start-save-summary.spec.ts:44`) —
  **cannot** produce a coach any more; `CoachContext.refresh()` returns early for
  non-`authenticated` status and `role` stays `null`.
- real Supabase sign-in (`journeys/auth-cloud-sync.spec.ts:34-46`) — currently
  all three tests are `test.fixme`; its header (11-20) documents provisioning
  **one** E2E user.

What each spec needs:

| Spec | Why it needs a coach fixture | Shape of the fixture |
| --- | --- | --- |
| `e2e/a11y.spec.ts:44-49` | The brief's own instruction is to extend this file rather than start fresh. `PUBLIC_ROUTES` cannot reach `/coach`, so IS 5568 / WCAG AA is unverified for the entire coach shell — the half of the app with the densest tables and forms | a second, authenticated `test.describe` with a `storageState` for a seeded coach user, scanning `/coach`, `/coach/clients`, `/coach/clients/:id`, `/coach/messages`, `/coach/programs`. Keep the existing public block untouched |
| `e2e/journeys/auth-cloud-sync.spec.ts:11-20, 34-46` | Its un-fixme instructions describe exactly one seeded user. Under server-assigned roles, one user can no longer exercise both shells | extend the header to require **two** seeded users — `e2e-trainee@sparkos.test` and `e2e-coach@sparkos.test` (the latter with `profiles.role = 'coach'` set by migration/seed, not by the app) — plus `E2E_COACH_EMAIL` / `E2E_COACH_PASSWORD` |
| `e2e/visual-qa.spec.ts:76-84` | The route walk stops at trainee routes; there is no visual evidence of any coach screen, at 390px or otherwise | after the auth fixture exists, a sibling walk over the `/coach/*` routes reusing `both()`; until then, note in the file that coach screens are uncovered |
| `e2e/onboarding-qa.spec.ts:58-67` | Loses its role hop entirely (finding 3). The coach onboarding path it half-covered ceases to exist | no coach fixture needed — delete the role hop. Coach *screens* are covered by the a11y/visual specs above, not by the wizard |
| new spec (does not exist) | `CoachGuard` / `TraineeGuard` / `RoleHome` (`AppRouter.tsx:335-352`) become the entire enforcement surface, and nothing tests them | one spec asserting a **trainee** hitting `/coach` is redirected to `/`, and a **seeded coach** hitting `/` is redirected to `/coach`. This is the regression test the change is actually about |

Recommended fixture mechanism, in preference order:

1. **Playwright `storageState` per role project.** A `global-setup` signs in each
   seeded user once and writes `e2e/.auth/coach.json` / `trainee.json`; specs opt
   in per project. Cheapest to run, no per-test login cost.
2. **A seeded coach in the Supabase test DB** with `profiles.role = 'coach'` set
   by seed/migration — never through the app. This is the point of the change, so
   the fixture must respect it.
3. **Not** a `localStorage` shortcut. `cached_role` is only a first-paint hint;
   `CoachContext.refresh()` overwrites it from `getMyProfile()` on hydration, and
   a `role` faked in `localStorage` would give a green e2e against a shell the
   RLS policies would refuse in production — a false pass, which is worse than
   no coverage.
