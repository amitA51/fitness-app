import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDANCE_STEPS } from './guidanceSteps';

// THE BUG THIS PINS: step 1 told the reader to press "התחל אימון" on home. That
// button exists — but Dashboard wraps it in `{!showFirstRunHero && (`, and the
// welcome sheet is shown ONLY to brand-new users. So the instruction was correct
// for a returning user and wrong for the exact audience that reads it: on a
// zero-session home, FirstRunHero owns the start action with "בחרו תבנית מוכנה"
// and "התחילו בלי תבנית".
//
// Asserting the strings alone would rot the day someone renames a hero button,
// so the copy is checked AGAINST the Dashboard source that renders those
// buttons: if the control is renamed or removed, this test fails.

const DASHBOARD_SOURCE = readFileSync(
  join(__dirname, '..', '..', 'pages', 'Dashboard.tsx'),
  'utf8'
);

/** The FirstRunHero block only — the markup a zero-session home renders. */
const FIRST_RUN_HERO_SOURCE = (() => {
  const start = DASHBOARD_SOURCE.indexOf('const FirstRunHero = memo(');
  const end = DASHBOARD_SOURCE.indexOf('const DashboardSkeleton = memo(');
  if (start < 0 || end <= start) {
    throw new Error('FirstRunHero block not found in Dashboard.tsx — update this test');
  }
  return DASHBOARD_SOURCE.slice(start, end);
})();

const STEP_ONE = GUIDANCE_STEPS[0];

describe('guidanceSteps — step 1 names controls the first-run home really renders', () => {
  it('points at the FirstRunHero buttons, which exist in the first-run markup', () => {
    for (const label of ['בחרו תבנית מוכנה', 'התחילו בלי תבנית']) {
      expect(STEP_ONE?.body).toContain(label);
      expect(FIRST_RUN_HERO_SOURCE).toContain(label);
    }
  });

  it('does not point at the masthead CTA, which first-run home suppresses', () => {
    // The suppression is the reason the old copy misled: guard first, then copy.
    expect(DASHBOARD_SOURCE).toContain('{!showFirstRunHero && (');
    expect(STEP_ONE?.body).not.toContain('התחל אימון');
    expect(FIRST_RUN_HERO_SOURCE).not.toContain('התחל אימון');
  });

  it('keeps the plural-imperative register and short bodies', () => {
    for (const step of GUIDANCE_STEPS) {
      expect(step.body).toMatch(/לחצו|בחרו|הזינו|ראו|סיימו|התחילו/);
      expect(step.body.length).toBeLessThanOrEqual(180);
    }
  });
});
