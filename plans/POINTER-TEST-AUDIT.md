# Pointer-event test audit — are any of these tests asserting on nothing?

Read-only audit. No source, test, or config file was modified. One throwaway probe was
created, run, and deleted (see *Gate output*).

---

## 1. Verdict

**PASS — nothing in `src/` is currently vacuous.** Exactly one test file in the repo
dispatches pointer events, and it is the one that already carries the polyfill. The
premise is fully confirmed, but its blast radius is one file, and that file is already
protected.

The finding worth acting on is prospective, not retrospective: the polyfill is
file-local, so **the next pointer test written anywhere else in this repo will be
silently vacuous**, and two assertions already in the protected file are the exact
shape that passes for the wrong reason without it.

Moving the polyfill to the shared setup file would **break no currently-passing test**
(verified empirically, section 5). It also fixes nothing retroactively. Its entire value
is preventing the next one.

---

## 2. The premise, verified in this repo

`jsdom` is **23.2.0** (`node_modules/jsdom/package.json:3`), matching the version named in
the existing polyfill comment.

Probe results, measured inside this repo's own vitest environment (with
`src/test/setup.ts` loaded):

| Check | Result |
| --- | --- |
| `typeof window.PointerEvent` | `"undefined"` |
| `typeof globalThis.PointerEvent` | `"undefined"` |
| `typeof HTMLElement.prototype.setPointerCapture` | `"undefined"` |
| `typeof HTMLElement.prototype.releasePointerCapture` | `"undefined"` |
| `typeof window.TouchEvent` | `"function"` (contrast: touch events *do* survive) |

What `fireEvent.pointerMove(el, { clientX: 42, clientY: 7, pointerId: 1 })` actually
delivers to a listener:

```
ctor:              "Event"          <- not PointerEvent, not even MouseEvent
isMouseEvent:      false
clientX:           UNDEFINED
clientY:           UNDEFINED
pointerId:         UNDEFINED
'clientX' in e:    false            <- the property does not exist at all
```

The mechanism, read at source in `node_modules/@testing-library/dom/dist/events.js`:

```js
:56   const EventConstructor = window[EventType] || window.Event;
:60   event = new EventConstructor(eventName, eventInit);
```

`eventMap` types `pointerdown`/`pointermove`/`pointerup` as `EventType: 'PointerEvent'`.
With `window.PointerEvent` undefined this falls through to `window.Event`, whose
constructor ignores every unknown key in the init dict. Lines `:76`–`:93` re-attach
exactly two dropped properties — `dataTransfer` and `clipboardData`. Coordinates and
`pointerId` are not among them, so they are gone with no warning.

With the reference polyfill applied, the same call delivers:

```
ctor: "TestPointerEvent"   isMouseEvent: true   clientX: 42   clientY: 7   pointerId: 1
                                                pointerType: UNDEFINED
```

**A second, independent finding: pointer *capture* fails harder than coordinates do.**
jsdom ships no `setPointerCapture` on `HTMLElement.prototype` at all, so a handler calling
it does not silently no-op — it throws:

```
THREW: TypeError: el.setPointerCapture is not a function
```

`src/components/workout/components/SlideToComplete.tsx:364` calls
`e.currentTarget.setPointerCapture(e.pointerId)` and `:428` calls
`releasePointerCapture`. It is the only component in `src/` that does either. Its test
stubs both (`SlideToComplete.test.tsx:57-60`), which is why the file runs at all.

---

## 3. Shapes searched, and shapes actually found

Searched across all of `src/` for: `pointerDown`, `pointerMove`, `pointerUp`,
`pointerCancel`, `PointerEvent`, `setPointerCapture`, `releasePointerCapture`,
`userEvent.pointer`.

**Found in test files:**

| Shape | Occurrences | Where |
| --- | --- | --- |
| `fireEvent.pointerDown/Move/Up(el, { pointerId, clientX })` | 24 call sites, **1 file** | `SlideToComplete.test.tsx` |
| `userEvent.setup().click()` / `.type()` / `.keyboard()` — dispatches `pointerdown`/`pointerup` internally | 14 files | see section 4 |

**Searched for and confirmed absent (zero occurrences anywhere in `src/`):**

- `fireEvent(el, new PointerEvent(...))` — the hand-constructed shape
- `userEvent.pointer(...)` — the coordinate-driving user-event API
- `fireEvent.pointerCancel(...)`
- any test calling `setPointerCapture` other than the one stub above

So the vulnerable shape (`fireEvent.pointerX` with coordinates) exists in precisely one
file, and the other shape present (`userEvent`) turns out not to be vulnerable at all —
see section 5.

---

## 4. Per-file verdicts

### `src/components/workout/components/SlideToComplete.test.tsx` — **REAL**

It polyfills at `:61-75` (`TestPointerEvent extends MouseEvent`, guarded by
`if (typeof window.PointerEvent === 'undefined')`) and stubs pointer capture at `:52-60`.
Both are load-bearing, and I can show the polyfill is not merely decorative by tracing
what the handler would compute without it:

`SlideToComplete.tsx:370` does `e.clientX - startXRef.current`. With `clientX`
undefined, `startXRef` is set to `undefined` on pointer-down (`:361`), so
`undefined - undefined` → `NaN`. That `NaN` then propagates:
`next = Math.max(0, Math.min(maxOffset, startOffset + NaN))` → `NaN`;
`nextRatio = NaN / 232` → `NaN`; and `NaN >= THRESHOLD` is `false`. Every commit gate in
the component fails closed.

That splits the file's tests into two groups:

**Three tests would FAIL without the polyfill — these are the ones proving it works:**

| Test | Line | Why it would fail |
| --- | --- | --- |
| `completes on a FAST FLICK released well short of the position threshold` | `:311-321` | expects `onComplete` called once; `NaN` projected rest never clears the commit point, so it would be called zero times |
| `continues from the live thumb position instead of jumping to the finger` | `:433-457` | asserts `transform === 'translateX(100px)'` then `'translateX(110px)'`; would read `translateX(NaNpx)` |

**Two tests would PASS FOR THE WRONG REASON without the polyfill** — flagged because they
are the canonical vacuous shape, and are only safe today because this file happens to
polyfill locally:

| Test | Line | What it would really be measuring |
| --- | --- | --- |
| `does NOT complete on a slow CRAWL to the same distance` | `:330-348` | claims to prove the release gate is *momentum* and not a lowered distance threshold. Without coordinates it proves only that `NaN >= commitPoint` is false — i.e. that arithmetic on `undefined` does not complete a set. It would pass identically against a component with the momentum logic deleted, or with the gate inverted. |
| `gives a finger that STOPPED before lifting no momentum credit` | `:355-371` | claims stale velocity samples are not credited. Without coordinates all samples are `NaN`, so the sample-trimming window it exists to test is never exercised. Same pass against no trimming at all. |

Both negatives sit in the same `describe` as the FAST FLICK positive, which is the
control that would catch a regression. The file is correctly constructed; I am naming
these two so it is on record which assertions depend on the polyfill staying put.

**Coordinate-independent tests in the file** (all pass `clientX: 0` and assert on focus
or on fake timers): `:85-101` focus-on-pointer-down, `:104-116` disabled does not steal
focus, `:139-151` hold completes, `:154-170` brief tap does not, `:174-193` hold cancelled
on release, `:238-259` ramp fires exactly once. These are **UNAFFECTED** by the coordinate
drop — but note they still require the `setPointerCapture` stub, without which the
handler throws before reaching any assertion.

### The 14 `userEvent` files — **UNAFFECTED**

`BottomNav.test.tsx`, `ExerciseReorderItem.test.tsx`, `ExerciseLibraryFilters.test.tsx`,
`ExerciseLibraryTab.test.tsx`, `ExercisePicker.performance.test.tsx`, `AdminUsers.test.tsx`,
`CreateTemplateModal.test.tsx`, `OfflineIndicator.test.tsx`, `PageErrorBoundary.test.tsx`,
`MobileInput.test.tsx`, `SectionCard.test.tsx`, `SliderInput.test.tsx`,
`AlternativesSheet.test.tsx`, `SettingsToggle.test.tsx`.

These dispatch real `pointerdown`/`pointerup` events, so they do exercise handlers like
`BottomNav.tsx:533` (`onPointerDown={ensureGsap}`) and the `onPointerDown` handlers in
`ExerciseReorderItem.tsx`. Two reasons they are not at risk:

1. **user-event does not depend on `window.PointerEvent`.** It ships its own fallback —
   `node_modules/@testing-library/user-event/dist/cjs/event/createEvent.js:85`:
   `window.PointerEvent ?? class PointerEvent extends MouseEvent {}`, then `initPointerEvent`
   (`:192`) explicitly assigns `pointerId`, `pointerType`, `isPrimary`, `pressure`,
   `width`, `height`, `tiltX`, `tiltY`, `twist`. Probed: `userEvent.click()` delivered
   `pointerdown` as `ctor: "PointerEvent", clientX: 0, pointerId: 1, pointerType: "mouse"`
   **with no polyfill installed**.
2. **None of them asserts on a coordinate.** They assert on `onMove` callbacks, focus,
   `aria-current`, rendered links and sheet contents. `ExerciseReorderItem.test.tsx` is
   keyboard-only (`{ArrowUp}`/`{ArrowDown}`) despite the component having pointer drag.

---

## 5. The polyfill's correct home, and the regression question

**Home: `src/test/setup.ts`.**

This is the *only* entry in `setupFiles`, declared at `vitest.config.ts` in the `test`
block:

```ts
setupFiles: ['./src/test/setup.ts'],
```

Note there are two configs. `vite.config.ts` has **no `test` block at all**, so it is not
the file to touch — `vitest.config.ts` is what the runner reads.

### Would adding it there make a currently-passing test start failing?

**No. I found no such test, and I checked all three ways it could happen:**

1. **`fireEvent.pointerX` callers.** Only `SlideToComplete.test.tsx`, and its own
   installation is guarded by `if (typeof window.PointerEvent === 'undefined')`. With a
   global polyfill present, that block becomes a no-op and the class shape is identical.
   No change.
2. **`userEvent` callers.** Probed both ways. Before polyfill: `pointerdown` →
   `clientX: 0, pointerId: 1, pointerType: "mouse"`. After polyfill: `clientX: 0,
   pointerId: 1, pointerType: "mouse"` (constructor name changes to `TestPointerEvent`;
   `initPointerEvent` re-applies the pointer properties on top). Behaviourally unchanged.
3. **App-side feature detection.** Grepped `src/` for `window.PointerEvent`,
   `'PointerEvent' in`, `maxTouchPoints`, `ontouchstart`. **No source file branches on
   `PointerEvent` existing.** The only `window.PointerEvent` references in `src/` are
   inside `SlideToComplete.test.tsx` itself. So defining it globally cannot flip a code
   path from a touch fallback to a pointer path mid-test.

This is the honest and slightly deflating answer to the most interesting question in the
brief: **there is no test here whose failure would be "the truth finally arriving."** The
one file that could have produced one already polyfills, so its truth arrived when the
polyfill was written.

### Two things to carry over with it

- **Move the `setPointerCapture` / `releasePointerCapture` stub too.** It is a separate
  gap from the constructor (jsdom has neither) and it fails loudly rather than silently.
  A future test of `SlideToComplete` — or of anything that adopts pointer capture — throws
  a `TypeError` without it.
- **The `MouseEvent`-based polyfill carries no `pointerType` / `isPrimary` / `pressure`.**
  Probed: `pointerType` is `UNDEFINED` on a polyfilled `fireEvent.pointerDown`. No current
  handler reads them, so this is not a bug today. If it becomes the shared implementation,
  defaulting `pointerType` to `'mouse'` and `isPrimary` to `true` in the constructor
  costs two lines and removes the next silent-undefined trap of the same species.

---

## 6. Coordinate paths with no test at all

Not vacuous — absent. Listing only because both would need the polyfill on day one, so
they are the concrete reason the shared home matters:

- **`src/components/charts/GlowAreaChart.tsx:313`** — `onPointerDown: (e) => hitTest(e.clientX)`,
  plus `onPointerMove` at `:314`. `GlowAreaChart.test.tsx` exists and is thorough, but tests
  y-domain geometry only from the rendered SVG; it dispatches no events. The hit-test /
  tooltip path is untested. This chart backs six surfaces.
- **`src/components/workout/hooks/useSwipeNavigation.ts:172-236`** — reads `e.clientX`,
  `e.clientY`, `e.pointerId`, and gates on `start.id !== e.pointerId`. No test file. Worth
  noting the gate's failure mode: with bare Events both sides are `undefined`, so
  `undefined !== undefined` is `false` and the multi-pointer guard *appears* to pass while
  the `dx`/`dy` arithmetic it protects is `NaN`. A test written against it today would be
  vacuous in both halves at once.

---

## 7. Gate output

One command was run, as permitted:

```
npx vitest run src/test/__pointerProbe.test.ts > probe-run.log 2>&1
EXITCODE=0
```

The probe asserted nothing about the app; it recorded what jsdom and Testing Library
deliver and wrote the findings to `probe-out.json`, which is where every measured value in
sections 2 and 5 came from. stdout was redirected to a log because this shell truncates at
the first non-ASCII character (vitest's reporter glyphs) while still returning exit 0.

All three artefacts were deleted and their absence confirmed:
`src/test/__pointerProbe.test.ts`, `probe-out.json`, `probe-run.log`.

No other command was run. `npm run verify`, `npm run test:run`, `npm run test:e2e` and
`npm run db:test` were **not** run — no source, test, or config file was changed, so there
is nothing for them to regress, and the brief scoped the work to a read-only audit.

---

## 8. Not covered

- **The full 167-file / 1462-test suite was not run.** Not needed: the audit question is
  answered by static search plus one environment probe.
- **Cross-file leakage of `window.PointerEvent` was not empirically tested.** Vitest's
  default `isolate: true` gives each test file a fresh jsdom, which is why
  `SlideToComplete.test.tsx`'s polyfill does not reach other files — but I reasoned that
  from the default rather than measuring it. It does not change any verdict here: no other
  test file uses `fireEvent.pointerX`, so there is nothing for a leak to have rescued.
- **`e2e/` Playwright specs were not examined.** They run in real Chromium, which ships a
  native `PointerEvent`, so this failure mode cannot occur there. Playwright was excluded
  by the brief.
- **No judgement on whether the two uncovered paths in section 6 *should* have tests.**
  That is a coverage decision, not a verification finding.
