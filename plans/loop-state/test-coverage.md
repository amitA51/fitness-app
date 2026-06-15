# Loop state · test-coverage

Persistent memory for the test-coverage loop. The agent forgets between runs;
this file does not. Update it at the END of every run. See the loop definition in
`.claude/skills/test-coverage-loop/SKILL.md`.

## Gate
`npm run test:coverage` must exit 0 (full suite green + global thresholds hold),
the target file's coverage must rise, and an independent reviewer sub-agent must
confirm the tests assert behavior. Tests only — never production code.
NOTE: CI (`.github/workflows/ci.yml`) already runs this exact gate (+ typecheck,
lint, format, build) on every PR and push to master, on Node 20 & 22. So a green
PR is double-gated: local run + CI.

## Current thresholds (vitest.config.ts) — RATCHET UP, NEVER DOWN
statements 31 · branches 69 · functions 43 · lines 31 · target 80
> Raised 2026-06-15 from 20/63/37/20 after the datetime run. Bump to just below
> the measured global "All files" actual; never above actual, never down.

## Last run
2026-06-15 · run #2.
- Target: `src/utils/datetime.ts` → **0% → 98.25%** lines, 100% funcs, 81.4% branch.
- New file: `src/utils/__tests__/datetime.test.ts` (21 tests, green).
- Full gate `vitest run --coverage`: **EXIT 0** — 112 files / 1070 tests pass.
- Global "All files": **31.76%** stmts/lines · 69.67% branch · 43.3% funcs
  (was ~21.4 / 65.1 / 38.9 on 2026-06-09). Thresholds ratcheted to 31/69/43/31.

## In progress
- (none)

## Completed
- 2026-06-15 · run #1 (seed) · workoutFormatters.ts → 100%
- 2026-06-15 · run #2 · datetime.ts → 98.25%

## Backlog — prioritized (re-measure each run from the coverage table)
Pure / standalone first (no mocks, fastest green):
- `src/utils/zoneColor.ts` — 0%   (tiny, pure — good next pick)
- `src/utils/getInitials.ts` — 0% (tiny, pure)
- `src/utils/formatThousands.ts` — 0% (tiny, pure)
- `src/utils/animations.ts` — 0%
- `src/utils/audio.ts` — 0%
- `src/utils/externalLink.ts` — 0%
- `src/utils/platform.ts` — 0%

Partials worth raising:
- `src/utils/imageCompress.ts` — 30.8%
- `src/utils/styles.ts` — 45.2%
- `src/utils/units.ts` — 74.5%

Services at 0% (need Supabase/idb mocks — copy nearest sibling test setup):
- `src/services/community/communityService.ts` — 0%
- `src/services/profile/profileService.ts` — 0%
- `src/services/tracking/trackingConsent.ts` — 0%
- `src/services/consent/consentService.ts` — 41.5%

## Escalated to humans
- (none yet — put real bugs found by tests here; do NOT fix prod code in-loop)

## Lessons learned (write here, not in chat)
- 2026-06-15: The coverage gate is GLOBAL. Running `--coverage` on a single test
  file reports every other file at 0% and FAILS the thresholds. Always gate with
  the full `npm run test:coverage`.
- 2026-06-15: Time-dependent code → `vi.useFakeTimers()` + `vi.setSystemTime()`.
  For he-IL `toLocaleDateString` output assert structure (`.toContain`), not exact
  locale strings (ICU varies by environment).
- 2026-06-15: Timezone math is testable against fixed UTC instants. Keep test
  dates in June so Asia/Jerusalem is unambiguously IDT (UTC+3), no DST seam.
  `formatTime(10:00Z, 'Asia/Jerusalem')` → '13:00'; `startOfDayInTz` of a Jun-8
  Jerusalem day → '2026-06-07T21:00:00.000Z'.
- 2026-06-15: Error-path tests intentionally log to stderr (graceful degradation).
  stderr noise is not a failure — trust the exit code / failed-test count.
- 2026-06-15: `@` resolves to `src/`. `fake-indexeddb` + `src/test/setup.ts` are
  the harness for idb-backed modules.
- 2026-06-15: In Git Bash here, `npx`/`tail` can drop off PATH after a shell
  reset — run vitest via PowerShell (`npx vitest ...`) which keeps Node on PATH.

## Stop conditions met since last review
- 2026-06-15: gate green (exit 0) on runs #1 and #2; two modules shipped.
