/**
 * SMOKE TEST — SparkOS Fitness PWA
 *
 * This is the regression canary. It must pass on EVERY run with NO credentials,
 * NO seeded data, and NO network (Supabase is unconfigured / stubbed in preview).
 *
 * What it verifies:
 *  1. The app root mounts and the unauthenticated screen renders.
 *  2. At least one visible, stable Hebrew element is present.
 *  3. The page has a meaningful <title>.
 *  4. No uncaught JS errors are thrown during load.
 *  5. The document direction is RTL (this is a Hebrew RTL PWA).
 *
 * Selectors avoid hard-coded Hebrew strings where a role/structural selector
 * works.  Where Hebrew text IS the most stable anchor (the brand tagline is
 * the login screen's h1-equivalent), it is used deliberately.
 */

import { expect, test } from '@playwright/test';

test.describe('Smoke — unauthenticated landing', () => {
  test('app mounts, login screen renders, no JS errors', async ({ page }) => {
    // Collect page-level JS errors during the load.
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    // Collect console errors (severity "error" only — info/warn are ignored).
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // The React root must be hydrated — wait for the app shell or login page.
    // Without credentials, AppRouter renders Login (unauthenticated branch).
    // The login page root element has dir="rtl" lang="he".
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10_000 });

    // The page must have a non-empty, meaningful title.
    await expect(page).toHaveTitle(/.+/);

    // The brand masthead tagline is the most stable fixture on the login screen.
    // It is rendered immediately (no auth required) and is unique on the page.
    const tagline = page.getByText('כתוב סטים. תראה התקדמות.');
    await expect(tagline).toBeVisible({ timeout: 10_000 });

    // At least one login action button must be reachable.
    // "המשיכו כאורח" (Continue as Guest) is always visible regardless of whether
    // Supabase is configured — it is the safest stable CTA to assert on.
    const guestButton = page.getByRole('button', { name: 'המשיכו כאורח' });
    await expect(guestButton).toBeVisible();

    // RTL invariant — the document direction must be rtl (set in Login page root).
    const dir = await page.locator('[dir="rtl"]').first().getAttribute('dir');
    expect(dir).toBe('rtl');

    // ---- Error assertions ----
    // Filter known Sentry/analytics noise that fires when VITE_SENTRY_DSN is
    // absent in preview mode — those are expected and logged via the app's own
    // logger, not actual bugs.
    const realErrors = consoleErrors.filter(
      (msg) =>
        !msg.includes('Sentry') &&
        !msg.includes('analytics') &&
        // Supabase client logs a warning when env vars are empty placeholders.
        !msg.includes('supabase') &&
        !msg.includes('SUPABASE') &&
        // Service-worker registration failures are non-critical in preview mode.
        !msg.includes('service-worker') &&
        !msg.includes('serviceWorker')
    );

    expect(
      jsErrors,
      `Uncaught JS errors during load:\n${jsErrors.join('\n')}`
    ).toHaveLength(0);

    expect(
      realErrors,
      `Unexpected console errors during load:\n${realErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('page title is set correctly', async ({ page }) => {
    await page.goto('/');
    // Title is set by AppShell on navigation; for the login page the auth
    // redirect fires before the router sets a page-specific title, so we
    // assert on the generic app title pattern.
    const title = await page.title();
    // Must be non-empty — any non-trivial title is acceptable here.
    expect(title.length).toBeGreaterThan(0);
  });

  test('legal pages are reachable without auth', async ({ page }) => {
    // AppRouter exposes /legal/terms and /legal/privacy outside the auth wall
    // (required by App Store / Play Store guidelines).
    await page.goto('/legal/terms');
    // Wait for ANY heading-level element — the legal page renders its own heading.
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
