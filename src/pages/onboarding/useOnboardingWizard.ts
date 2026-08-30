import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '../../utils/logger';
import { DEFAULT_ONBOARDING, type OnboardingData, type OnboardingStep, STEPS } from './types';

/**
 * Is `value` a plain data object, i.e. something that may legitimately be
 * spread into the wizard data?
 *
 * `goNext(updates?)` looks exactly like an event handler, so `onClick={goNext}`
 * is a mistake a reader cannot see: React then passes the MouseEvent in as
 * `updates`. A SyntheticEvent is truthy, so an unguarded spread merged all 36 of
 * its own properties into the wizard data. Several of them are circular — `view`
 * (the Window) in a real browser, plus `target` / `currentTarget` — so the finish
 * payload's `JSON.stringify` threw and froze the last onboarding step with no
 * message at all (T-098).
 *
 * The prototype check is what rejects it: a SyntheticEvent, a native Event, a
 * DOM node and a Window are all class instances, so their prototype is not
 * `Object.prototype`. Object literals (`{ primaryGoal: 'muscle' }`) and
 * null-prototype objects pass; arrays do not (their prototype is Array's).
 */
function isOnboardingUpdates(value: unknown): value is Partial<OnboardingData> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function useOnboardingWizard(onComplete: (data: OnboardingData) => void) {
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_step');
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });
  // Nav direction for the step transition: +1 = forward (next), -1 = back.
  // Steps read this so a "back" tap reverses the slide instead of always
  // sliding in from the forward (inline-start) side.
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<OnboardingData>(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_draft');
      return saved ? { ...DEFAULT_ONBOARDING, ...JSON.parse(saved) } : DEFAULT_ONBOARDING;
    } catch {
      return DEFAULT_ONBOARDING;
    }
  });

  // One flat step list for everybody — there is no role branch in onboarding.
  // All indexing below runs against this list.
  const activeSteps: OnboardingStep[] = useMemo(() => STEPS, []);

  // A draft persisted by an older (longer) step list can hold an index past the
  // end of this one; clamp it so it can never point outside the list.
  const safeStep = Math.min(currentStep, activeSteps.length - 1);
  const stepId = activeSteps[safeStep]?.id ?? 'welcome';

  useEffect(() => {
    try {
      sessionStorage.setItem('onboarding_step', String(currentStep));
      sessionStorage.setItem('onboarding_draft', JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [currentStep, data]);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Advance one step, or finish the wizard on the last one.
   *
   * `updates` exists for the auto-advancing terminal step: a goal-card tap both
   * answers and advances, and passing the answer through here is what keeps it
   * out of the finish payload's stale closure. Calling `updateData` and then
   * `goNext` in the same handler would complete onboarding with the PREVIOUS
   * data, silently dropping the goal the user just picked.
   *
   * A non-plain-object `updates` is a wiring bug at the call site, never a user
   * intent, so the argument is DROPPED rather than merged — the navigation it
   * asked for still happens, and the corrupt value never reaches state. It is
   * reported through `logger.error` (console in dev, Sentry in prod), so it is
   * refused loudly rather than swallowed. Throwing here instead would only
   * trade one screen the user cannot leave for another.
   */
  const goNext = useCallback(
    (updates?: Partial<OnboardingData>) => {
      setDirection(1);
      let merge: Partial<OnboardingData> | undefined;
      if (updates === undefined || updates === null) {
        merge = undefined;
      } else if (isOnboardingUpdates(updates)) {
        merge = updates;
      } else {
        merge = undefined;
        logger.ui.error(
          'goNext received a non-data argument and ignored it — a handler is probably wired as onClick={goNext} instead of onClick={() => goNext()}',
          { received: Object.prototype.toString.call(updates) }
        );
      }
      const next = merge ? { ...data, ...merge } : data;
      if (merge) setData(next);
      if (safeStep < activeSteps.length - 1) {
        setCurrentStep(safeStep + 1);
      } else {
        onComplete(next);
      }
    },
    [safeStep, activeSteps.length, data, onComplete]
  );

  const goBack = useCallback(() => {
    setDirection(-1);
    if (safeStep > 0) {
      setCurrentStep(safeStep - 1);
    }
  }, [safeStep]);

  // Per-step reason the user cannot advance yet — null when the step is valid.
  // Surfaced near the disabled "הבא" button so the block is explained, not silent.
  // Keyed by step id (not index) so it survives any reordering of the list.
  //
  // The name is the ONLY gate in the flow. gender and age used to gate the
  // profile step; neither is collected here any more (both have their own row in
  // Settings › פרטים אישיים, and age is asked again seconds later as a date of
  // birth by the age gate). Goals has no gate either — it auto-advances on a
  // card tap, so there is no disabled button to explain. Weight and height stay
  // optional but, when entered, must be sane: a decorative min/max used to let
  // weight 999 through and poison every downstream calculation.
  const validationHint = useCallback((): string | null => {
    if (stepId !== 'profile') return null;
    if (data.name.trim().length === 0) return 'הזינו שם כדי להמשיך';
    if (data.height !== '' && (data.height < 100 || data.height > 250))
      return 'הזינו גובה בין 100 ל-250 ס״מ';
    if (data.weight !== '' && (data.weight < 30 || data.weight > 300))
      return 'הזינו משקל בין 30 ל-300 ק״ג';
    return null;
  }, [stepId, data]);

  const canProceed = useCallback(() => validationHint() === null, [validationHint]);

  return {
    currentStep: safeStep,
    stepId,
    activeSteps,
    data,
    direction,
    updateData,
    goNext,
    goBack,
    canProceed,
    validationHint,
  };
}
