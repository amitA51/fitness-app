---
name: test-coverage-loop
description: >
  Raise test coverage one module per run. Pick the next untested/under-tested
  module from the backlog, write meaningful vitest tests following project
  conventions, run the full coverage gate, ratchet the thresholds up, update the
  state file, and open a draft PR — only when the gate is green. Trigger on the
  test-coverage loop or whenever asked to add tests toward the 80% target.
---

# Test-coverage loop

A bounded, repeatable loop that grows coverage toward the 80% target in
`.claude/rules/common/testing.md`. **Tests only — never production code.** The
one exception is ratcheting the coverage thresholds in `vitest.config.ts`.

## The gate (objective, non-negotiable)

A run may open a PR only if ALL hold:

1. `npx vitest run <new-test-file>` is green.
2. `npm run test:coverage` exits 0 — the FULL suite passes and the GLOBAL
   thresholds in `vitest.config.ts` still hold. (Single-file coverage always
   fails the global thresholds — the gate is the full run.)
3. The target module's line coverage went UP versus the previous state entry.
4. An independent reviewer sub-agent (see "Maker/checker") confirms the tests
   assert behavior, not just execute lines.

If any fails: do NOT open a PR. Record the blocker in the state file and stop.

## Each run — the steps

1. **Read state.** `plans/loop-state/test-coverage.md`. Take the top backlog
   item not already in progress. Prefer pure/standalone modules (no IndexedDB /
   network mocks) before services that need mocks — faster, safer green.
2. **Read the target** module fully before writing anything.
3. **Write tests** in the sibling `__tests__/` dir, named `<module>.test.ts`.
   Follow the conventions below.
4. **Run the new file** alone first (`npx vitest run <path>`) until green.
5. **Run the gate** (`npm run test:coverage`); capture the target file's new %
   and the global totals.
6. **Maker/checker split.** Spawn a SEPARATE reviewer sub-agent
   (`ecc:typescript-reviewer` or `ecc:tdd-guide`) on the new test file. The
   model that wrote the tests does not get to approve them. Reject "coverage
   theater" — tests that call functions with no real assertions.
7. **Ratchet** `vitest.config.ts` thresholds up to just BELOW the new measured
   global actuals (never above actual, never down). The config documents this.
8. **Update state** (last run, completed, new actuals, backlog, lessons).
9. **Open a draft PR** on a `claude/test-coverage-<module>` branch. Never push
   to master directly. A human reviews before merge.
10. **Stop condition (the /goal):** stop this run after one module ships green,
    OR immediately if the gate cannot be made green without touching production
    code (that means you found a real bug — escalate it, don't paper over it).

## Project test conventions

- **AAA structure**, descriptive behavior names (`returns [] when the query
  errors`), per `.claude/rules/common/testing.md`.
- **Time-dependent code:** pin the clock with `vi.useFakeTimers()` +
  `vi.setSystemTime(...)` in `beforeEach`, `vi.useRealTimers()` in `afterEach`.
  See `src/utils/__tests__/workoutFormatters.test.ts` (the seed run).
- **Hebrew / he-IL output:** assert exact strings only where stable
  (`"25 דקות"`, `"12.5k"`). For locale-formatted dates assert structure
  (`.toContain('15')`, `.not.toBe('')`) — never pin full ICU locale strings,
  they vary by environment.
- **Error-path tests log to stderr** by design (graceful-degradation cases).
  stderr noise is NOT a failure — only the exit code and `Tests failed` count.
- **Mocks:** Supabase/idb modules are mocked in many existing service tests —
  copy the nearest sibling test's mock setup rather than inventing one. The
  setup file is `src/test/setup.ts`; `fake-indexeddb` is available.
- **`@` alias** resolves to `src/` (configured in `vitest.config.ts`).

## Guardrails (the security/comprehension tax)

- Tests only. The sole production-tree edit allowed is ratcheting thresholds.
- If a test can't pass because the code is wrong → escalate as a real bug in the
  state file's "Escalated" section. Do not weaken the test to make it pass, and
  do not silently change the implementation inside this loop.
- Never lower a threshold to make the gate pass. Lowering is forbidden.
- Keep diffs reviewable — one module per PR.

## How this gets run (automation)

Session-scoped cadence:

    /loop 6h run the test-coverage-loop skill: take the next module from
    plans/loop-state/test-coverage.md, add vitest tests, run the gate, ratchet
    thresholds, update state, open a draft PR if green.

Restart-surviving / cloud cadence: use /schedule (routines) with the same prompt.
Do NOT schedule until at least one manual run has shipped a green PR.
