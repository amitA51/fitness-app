/**
 * JOURNEY: Paywall / Entitlement Gate
 *
 * Tests the premium entitlement flow:
 *   premium-gated feature → paywall screen renders → plan selection →
 *   purchase (mocked) → entitlement granted → feature accessible.
 *
 * STATUS: fixme — requires:
 *  a) An authenticated test user whose entitlement state can be controlled.
 *  b) A way to mock / stub the payment provider so real charges don't occur.
 *     In the current codebase the paywall is at /paywall (PaywallScreen).
 *     The EntitlementContext reads from Supabase `subscriptions` table.
 *
 * To un-fixme (read-only paywall render — no purchase):
 *  1. Seed localStorage with onboarding_completed + guest mode (same as
 *     workout journey) so the app shell renders.
 *  2. Navigate directly to /paywall.
 *  3. Assert the paywall screen mounts and plan cards are visible.
 *  4. Remove the first test's fixme.
 *
 * To un-fixme (full purchase flow):
 *  1. Add Supabase credentials (E2E_SUPABASE_EMAIL / PASSWORD).
 *  2. Mock the payment provider API (intercept fetch/XHR calls in the test).
 *  3. Stub the `subscriptions` INSERT to return a successful subscription row.
 *  4. Assert EntitlementContext grants `isPremium = true` after the stub.
 *  5. Remove the second and third tests' fixme calls.
 */

import { expect, test } from '@playwright/test';

test.describe('Journey: Paywall / Entitlement Gate', () => {
  test('paywall screen renders plan cards', async ({ page }) => {
    // TODO: Remove fixme — only needs guest + onboarding seed, no Supabase.
    test.fixme(
      true,
      'Needs onboarding_completed in localStorage — see file header step 1-4'
    );

    // Seed guest + onboarding so the app shell is accessible.
    await page.addInitScript(() => {
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('auth_guest', 'true');
    });

    await page.goto('/paywall');

    // The PaywallScreen should render at least one plan / pricing card.
    // Adjust the selector once the actual PaywallScreen markup is known.
    const planCard = page
      .getByRole('button', { name: /פרימיום|premium|חודשי|שנתי|monthly|annual/i })
      .first();
    await expect(planCard).toBeVisible({ timeout: 10_000 });
  });

  test('premium-gated feature redirects unauthenticated user to paywall', async ({
    page,
  }) => {
    test.fixme(
      true,
      'Needs knowledge of which routes are gated — implement after paywall render test'
    );

    // Outline:
    // 1. Seed localStorage with guest mode (no premium).
    // 2. Navigate to a premium-gated route (once identified from EntitlementContext).
    // 3. Assert redirect to /paywall or an upgrade prompt modal.
  });

  test('mock purchase grants entitlement and unlocks feature', async ({ page }) => {
    test.fixme(
      true,
      'Needs Supabase auth + payment API mock — see file header for full setup'
    );

    // Outline:
    // 1. Sign in as E2E test user with FREE tier.
    // 2. Intercept the payment/subscription API call:
    //    await page.route('**/subscriptions**', async (route) => {
    //      await route.fulfill({ status: 200, body: JSON.stringify({ active: true }) });
    //    });
    // 3. Navigate to /paywall and tap a plan button.
    // 4. Assert the success state (confirmation UI shown).
    // 5. Assert the previously-gated feature is now accessible.
  });
});
