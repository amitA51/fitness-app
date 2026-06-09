/**
 * JOURNEY: Workout Start → Save → Summary
 *
 * Tests the core workout loop:
 *   (guest or authed) → tap template → active workout → log sets →
 *   finish → summary screen → entry appears in history.
 *
 * STATUS: fixme — the workout flow requires onboarding_completed + a
 * template to exist in localStorage/Supabase.  The app redirects
 * unauthenticated / un-onboarded users to the login/onboarding gate.
 *
 * To un-fixme (guest / local-only path — NO Supabase needed):
 *  1. In the test, inject onboarding_completed = "true" and a minimal
 *     workout template into localStorage BEFORE navigating to "/".
 *     Example:
 *       await page.addInitScript(() => {
 *         localStorage.setItem('onboarding_completed', 'true');
 *         localStorage.setItem('auth_guest', 'true');
 *         localStorage.setItem('personal_items', JSON.stringify([{
 *           id: 'e2e-template-1',
 *           title: 'Test Push Day',
 *           exercises: [{ name: 'לחיצת חזה', sets: [] }],
 *           createdAt: new Date().toISOString(),
 *         }]));
 *       });
 *  2. Remove the `test.fixme(...)` calls below.
 *  3. Adjust selectors to match actual template card / set-logger UI.
 *
 * For the authenticated + Supabase path also set:
 *   E2E_SUPABASE_EMAIL / E2E_SUPABASE_PASSWORD (see auth-cloud-sync.spec.ts).
 */

import { expect, test } from '@playwright/test';

test.describe('Journey: Workout Start → Save → Summary', () => {
  test('can start a workout from a template', async ({ page }) => {
    // TODO: Remove fixme and inject localStorage seed (see file header).
    test.fixme(
      true,
      'Requires onboarding_completed + template in localStorage — see file header'
    );

    // Seed localStorage so the app skips onboarding and enters guest mode.
    await page.addInitScript(() => {
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('auth_guest', 'true');
    });

    await page.goto('/');

    // Navigate to Templates tab via bottom nav.
    await page.getByRole('link', { name: /תבניות|templates/i }).click();

    // Tap the first available template card.
    const templateCard = page.locator('[data-testid="template-card"]').first();
    await expect(templateCard).toBeVisible({ timeout: 10_000 });
    await templateCard.click();

    // The workout screen should be active.
    await expect(page).toHaveURL(/\/workout/);
  });

  test('can log a set and finish workout', async ({ page }) => {
    test.fixme(
      true,
      'Requires active workout state — implement after start-workout test passes'
    );

    // Outline:
    // 1. Start a workout (as above).
    // 2. Tap the + button to add a set for the first exercise.
    // 3. Fill in weight and reps.
    // 4. Tap "סיים אימון" (Finish Workout).
    // 5. Assert the summary screen appears with at least one set listed.
    // 6. Assert total duration > 0.
  });

  test('finished workout appears in history', async ({ page }) => {
    test.fixme(
      true,
      'Requires completed workout fixture — implement after save test passes'
    );

    // Outline:
    // 1. Complete a workout (as above).
    // 2. Navigate to Dashboard or Progress.
    // 3. Assert the workout entry appears in the history list.
    // 4. Tap the entry to open the detail view.
    // 5. Assert exercise names and set data match what was logged.
  });
});
