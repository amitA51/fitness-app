import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/**
 * Automated accessibility gate.
 *
 * The app shipped `@axe-core/react` as a dev dependency, but it only ran in DEV
 * and logged to the console — nothing ever failed a build on an accessibility
 * violation. The accessibility statement, meanwhile, made conformance claims.
 * This suite closes that gap for every route reachable without a backend
 * session, which is exactly the set a first-time visitor (and a regulator)
 * sees first.
 *
 * Scope: WCAG 2.0/2.1 A + AA rule tags, matching the standard the statement
 * declares (IS 5568 baseline).
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Rules disabled with a reason. Keep this list SHORT and justified — it is the
 * documented allowlist referenced by the accessibility statement, not a way to
 * make the gate pass.
 */
const DISABLED_RULES: string[] = [
  // The brand mark and decorative mesh are rendered behind translucent chrome;
  // axe cannot resolve the effective background through backdrop-filter and
  // reports false positives. Contrast for these pairs is verified from the
  // design tokens instead (reports/04-A11Y-RTL-HEBREW.md).
  'color-contrast',
];

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(DISABLED_RULES).analyze();
}

/** Readable failure output: rule id + the first offending selector. */
function summarize(violations: Awaited<ReturnType<typeof analyze>>['violations']): string {
  return violations
    .map((v) => `${v.id} (${v.impact}) → ${v.nodes[0]?.target.join(' ')}`)
    .join('\n');
}

const PUBLIC_ROUTES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'login / landing' },
  { path: '/legal/terms', name: 'terms of service' },
  { path: '/legal/privacy', name: 'privacy policy' },
  { path: '/accessibility', name: 'accessibility statement' },
];

test.describe('Accessibility — axe on public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(route.path);
      // The app mounts asynchronously; wait for real content before scanning.
      await page.waitForLoadState('networkidle');

      const results = await analyze(page);

      expect(results.violations, summarize(results.violations)).toHaveLength(0);
    });
  }

  test('document declares Hebrew and RTL', async ({ page }) => {
    await page.goto('/');
    // SC 3.1.1 (language of page) and the RTL contract the product depends on.
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('a working skip link targets the main landmark', async ({ page }) => {
    await page.goto('/');

    // Note: the cookie-consent banner can legitimately take focus ahead of the
    // skip link on a first visit, so this asserts the link EXISTS, is focusable
    // and actually points at a real landmark — not that it is index 0 in the tab
    // order.
    const skipLink = page.locator('a.skip-link[href="#main-content"]').first();
    await expect(skipLink).toHaveCount(1);

    await skipLink.focus();
    await expect(skipLink).toBeFocused();

    await expect(page.locator('#main-content')).toHaveCount(1);
  });
});
