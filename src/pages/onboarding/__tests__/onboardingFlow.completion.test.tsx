/**
 * T-098 — a brand-new user must be able to FINISH onboarding, and must be able
 * to SKIP it. Both paths were dead and 1606 tests missed it, because every one
 * of them called the wizard's functions directly. None of them clicked the real
 * button through the real component tree, which is the only way the defect is
 * reachable: React only hands a MouseEvent to `goNext` when a real DOM click is
 * dispatched at a real `onClick={goNext}`.
 *
 * So these tests drive actual clicks, and they wire `onComplete`/`onSkip` to the
 * REAL `appOnboarding` writers in the same order AppRouter does — the save
 * first, the "onboarding is done" signal second. That order is what makes the
 * assertions load-bearing: when a save throws, the done-signal must not fire,
 * exactly as `setOnboardingDone(true)` did not fire in production.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveOnboardingData, savePartialOnboardingData } from '../../../appOnboarding';
import { logger } from '../../../utils/logger';
import OnboardingFlow from '../../OnboardingFlow';
import { DEFAULT_ONBOARDING, type OnboardingData } from '../types';
import { useOnboardingWizard } from '../useOnboardingWizard';

const ONBOARDING_FIELDS = Object.keys(DEFAULT_ONBOARDING).sort();

/**
 * Mirrors AppRouter's `handleOnboardingComplete` / `handleOnboardingSkip`:
 * persist, THEN record that the app would have flipped `onboardingDone`. A
 * throw in the persist step must leave `doneSignals` empty.
 */
function renderFlow() {
  const doneSignals: { path: 'complete' | 'skip'; data: OnboardingData }[] = [];

  const handleComplete = (data: OnboardingData) => {
    saveOnboardingData(data);
    doneSignals.push({ path: 'complete', data });
  };

  const handleSkip = (data: OnboardingData) => {
    savePartialOnboardingData(data);
    // AppRouter writes this flag itself on the skip path.
    localStorage.setItem('onboarding_completed', 'true');
    doneSignals.push({ path: 'skip', data });
  };

  render(<OnboardingFlow onComplete={handleComplete} onSkip={handleSkip} />);
  return { doneSignals, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('onboarding — a new user can get into the app', () => {
  it('completes the wizard by clicking through it, and writes onboarding_completed', async () => {
    const { doneSignals, user } = renderFlow();

    // Step 1 — welcome. This is the tap that used to poison the wizard data
    // with the MouseEvent (and therefore the Window it references).
    await user.click(screen.getByRole('button', { name: /בואו נתחיל/ }));

    // Step 2 — profile. The name is the flow's only gate.
    const nameField = await screen.findByLabelText('שם');
    await user.type(nameField, 'דני');
    await user.click(screen.getByRole('button', { name: /הבא/ }));

    // Step 3 — goals. A card tap answers and finishes in one action.
    const goalCard = await screen.findByRole('button', { name: /בניית שריר/ });
    await user.click(goalCard);

    // (1) + (2) The two things a new user needs: the flag is written and the app
    // is told onboarding is over. In a real browser these are the assertions the
    // bug killed outright (`view` is the Window there, so the finish payload's
    // stringify always threw). In jsdom they can survive it — see (4) — so they
    // are kept as the user-facing contract, not as the defect's tripwire.
    await waitFor(() => {
      expect(localStorage.getItem('onboarding_completed')).toBe('true');
    });
    expect(doneSignals).toHaveLength(1);
    expect(doneSignals[0]?.path).toBe('complete');

    // (3) The answers actually collected survived the trip.
    const saved = JSON.parse(localStorage.getItem('onboarding_data') ?? '{}') as OnboardingData;
    expect(saved.name).toBe('דני');
    expect(saved.primaryGoal).toBe('muscle');

    // (4) LOAD-BEARING, and the one that pins the defect in every environment:
    // only wizard fields may reach the payload. On the broken build this saw the
    // 36 own properties of a MouseEvent (`_reactName`, `_targetInst`, `target`,
    // `currentTarget`, …) merged into the user's data.
    expect(Object.keys(saved).sort()).toEqual(ONBOARDING_FIELDS);
    expect(() => JSON.stringify(doneSignals[0]?.data)).not.toThrow();
  });

  it('skips the wizard from the confirm dialog, and writes onboarding_completed', async () => {
    const { doneSignals, user } = renderFlow();

    // The skip affordance only exists past the welcome screen, so the poisoning
    // tap is on the skip path too — which is why both exits died together.
    await user.click(screen.getByRole('button', { name: /בואו נתחיל/ }));

    const nameField = await screen.findByLabelText('שם');
    await user.type(nameField, 'דני');

    await user.click(screen.getByRole('button', { name: 'דלגו' }));

    // "דלגו" is both the trigger and the dialog's confirm label — scope to the
    // dialog so the click lands on the confirm, not back on the trigger.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'דלגו' }));

    // (1) LOAD-BEARING in a real browser: savePartialOnboardingData stringifies
    // as its FIRST statement, so AppRouter's next line never ran and the escape
    // hatch was as dead as the forward path.
    await waitFor(() => {
      expect(localStorage.getItem('onboarding_completed')).toBe('true');
    });

    // (2) The app must be told to leave the wizard.
    expect(doneSignals).toHaveLength(1);
    expect(doneSignals[0]?.path).toBe('skip');

    // (3) The skip dialog promises the details can be finished later, so what
    // was already typed must be persisted.
    const profile = JSON.parse(localStorage.getItem('user_profile') ?? '{}') as { name?: string };
    expect(profile.name).toBe('דני');

    // (4) LOAD-BEARING: the raw draft this path saves must carry wizard fields
    // and nothing else. On the broken build the welcome tap merged 36 MouseEvent
    // properties into the data, and every one of them was persisted here.
    //
    // This is the assertion that pins the defect in BOTH environments. Whether
    // the `JSON.stringify` on the next line up throws depends on when it runs
    // relative to React nulling the event's `currentTarget`, so the throw itself
    // is not a reliable signal in jsdom — the polluted payload always is.
    const draft = JSON.parse(localStorage.getItem('onboarding_data') ?? '{}') as OnboardingData;
    expect(Object.keys(draft).sort()).toEqual(ONBOARDING_FIELDS);
  });
});

/**
 * Deliberately re-commits the ORIGINAL mistake against the hardened hook. The
 * call-site fix removes the instance; this covers the defect. Delete the guard
 * in `useOnboardingWizard` and this test fails.
 *
 * Note the shape: a DIRECT `onClick={goNext}` does not compile, because
 * `goNext`'s parameter is not a MouseEvent. The defect can only exist by
 * laundering `goNext` through a prop typed `() => void` — which erases the
 * parameter and makes both hops legal — and that is precisely what WelcomeStep
 * did. So this reproduces the real smuggling route, not a hypothetical one.
 */
function BadlyWiredStep({ onNext }: { onNext: () => void }) {
  return (
    <button type="button" onClick={onNext}>
      המשך
    </button>
  );
}

function BadlyWiredWizard({ onComplete }: { onComplete: (data: OnboardingData) => void }) {
  const { goNext, stepId } = useOnboardingWizard(onComplete);
  return (
    <div>
      <span data-testid="step">{stepId}</span>
      <BadlyWiredStep onNext={goNext} />
    </div>
  );
}

describe('useOnboardingWizard — goNext refuses a non-data argument', () => {
  it('drops the MouseEvent instead of merging it, and still advances', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(logger.ui, 'error').mockImplementation(() => {});
    const payloads: OnboardingData[] = [];

    render(<BadlyWiredWizard onComplete={(data) => payloads.push(data)} />);
    const badButton = screen.getByRole('button');

    // welcome -> profile -> goals -> finish
    await user.click(badButton);
    await user.click(badButton);
    await user.click(badButton);

    // Navigation still works: refusing the argument must not trap the user,
    // which is the whole failure being fixed.
    expect(payloads).toHaveLength(1);

    // The event never reached the data, so the payload is still serialisable.
    expect(() => JSON.stringify(payloads[0])).not.toThrow();
    expect(Object.keys(payloads[0] ?? {}).sort()).toEqual(ONBOARDING_FIELDS);

    // Refused loudly, not swallowed.
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0]?.[0]).toMatch(/non-data argument/);
  });
});
