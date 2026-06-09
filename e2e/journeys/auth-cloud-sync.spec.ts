/**
 * JOURNEY: Auth + Cloud-Sync Round-Trip
 *
 * Tests the full lifecycle: sign-in → data write → sign-out → sign-in →
 * verify data persisted in Supabase.
 *
 * STATUS: fixme — requires Supabase test credentials + seeded database.
 *
 * To un-fixme:
 *  1. Provision a Supabase project (or use the existing one with a test-only
 *     service-role key — NEVER the prod key).
 *  2. Create a dedicated E2E test user (e.g. e2e-test@sparkos.test) with a
 *     known password.  Seed it with `supabase db seed` or a migration fixture.
 *  3. Set the following environment variables before running the suite:
 *       E2E_SUPABASE_EMAIL=e2e-test@sparkos.test
 *       E2E_SUPABASE_PASSWORD=<test-user-password>
 *       VITE_SUPABASE_URL=https://<project>.supabase.co
 *       VITE_SUPABASE_ANON_KEY=<anon-key>
 *  4. Remove the `test.fixme(...)` call on the individual tests below.
 *  5. Run:  npm run test:e2e -- --grep "auth-cloud-sync"
 *
 * Page Object used: LoginPage, DashboardPage (see e2e/pages/ when scaffolded).
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Inline minimal Page Objects (expand into e2e/pages/ when un-fixme-d)
// ---------------------------------------------------------------------------

class LoginPage {
  constructor(private readonly page: import('@playwright/test').Page) {}

  async goto() {
    await this.page.goto('/');
  }

  async signInWithEmail(email: string, password: string) {
    // Click "כניסה עם חשבון" to reveal the credentials form.
    await this.page.getByRole('button', { name: 'כניסה עם חשבון' }).click();
    await this.page.getByLabel(/אימייל|מייל|email/i).fill(email);
    await this.page.getByLabel(/סיסמה|password/i).fill(password);
    await this.page.getByRole('button', { name: /כניסה|התחבר/i }).click();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Journey: Auth + Cloud-Sync Round-Trip', () => {
  test('sign-in persists session and reflects cloud data', async ({ page }) => {
    // TODO: Remove this fixme when E2E credentials are available.
    // Required env: E2E_SUPABASE_EMAIL, E2E_SUPABASE_PASSWORD,
    //               VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
    test.fixme(true, 'Needs Supabase E2E credentials — see file header for setup');

    const loginPage = new LoginPage(page);
    const email = process.env.E2E_SUPABASE_EMAIL ?? '';
    const password = process.env.E2E_SUPABASE_PASSWORD ?? '';

    await loginPage.goto();
    await loginPage.signInWithEmail(email, password);

    // After sign-in the router should land on the dashboard (or onboarding).
    // Wait for navigation away from the login screen.
    await expect(page).not.toHaveURL('/login', { timeout: 15_000 });

    // A stable authenticated-only element (e.g. bottom nav or dashboard heading).
    // Adjust the selector to match the actual authenticated landing once known.
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test('cloud sync: write → re-login → data still present', async ({ page }) => {
    // TODO: Remove this fixme and implement the write-verify cycle.
    // Depends on: seeded Supabase test user + workout template fixture.
    test.fixme(true, 'Needs Supabase seed data — see file header for setup');

    // Outline (implement when un-fixme-d):
    // 1. Sign in as E2E test user.
    // 2. Create a workout entry via the UI.
    // 3. Sign out (Settings → account → sign out).
    // 4. Sign back in.
    // 5. Assert the workout entry is still visible in the history.
  });

  test('sign-out clears session and returns to login', async ({ page }) => {
    test.fixme(true, 'Needs authenticated session — see file header for setup');

    // Outline:
    // 1. Sign in.
    // 2. Navigate to Settings.
    // 3. Tap sign-out.
    // 4. Assert redirect back to login screen.
    // 5. Assert localStorage sparkos_* keys are cleared.
  });
});
