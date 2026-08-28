/**
 * BACK-BUG REPRODUCTION — investigation harness, not a regression suite.
 *
 * Drives the REAL browser Back gesture (page.goBack) against the exercise picker
 * in both states the owner can be in, and reports the observable facts:
 * the URL, whether the sheet is still mounted, the history length, and the
 * persisted pre-workout intent flag.
 *
 * ASCII-only console output: the shell reading it truncates at the first Hebrew
 * character.
 *
 * Run: npx playwright test e2e/picker-back-repro.spec.ts --project="Desktop Chrome"
 */
import { test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const START_EMPTY_LABEL = /התחילו בלי תבנית|אימון ריק/;
const PREWO_KEY = 'sparkos_prewo_started';

async function seedGuest(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('skip_auth', 'true');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem(
      'user_profile',
      JSON.stringify({
        name: 'דנה',
        age: 30,
        height: 170,
        weight: 68,
        gender: 'female',
        weightGoal: 'עלייה במסה',
        activityLevel: 'פעיל מתון',
      })
    );
  });
  await page.reload();
  await page.waitForTimeout(2000);
  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

/** Observable state, all ASCII. */
async function probe(page: import('@playwright/test').Page, tag: string) {
  const snap = await page.evaluate((key) => {
    const sheet = document.querySelectorAll('.exercise-library').length;
    return {
      url: location.pathname,
      histLen: history.length,
      histState: JSON.stringify(history.state),
      sheetOpen: sheet > 0,
      flag: sessionStorage.getItem(key),
      cards: document.querySelectorAll('.exercise-card').length,
    };
  }, PREWO_KEY);
  console.log(`PROBE[${tag}] ${JSON.stringify(snap)}`);
  return snap;
}

test('BACK from picker at pre-workout (no exercises)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(MOBILE);
  await seedGuest(page);

  await page.goto('/workout');
  await page.waitForTimeout(2200);
  await probe(page, 'workout-landed');

  await page.getByRole('button', { name: START_EMPTY_LABEL }).first().click({ force: true });
  await page.locator('.exercise-card').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(500);
  await probe(page, 'picker-open');

  // THE REAL BACK GESTURE.
  await page.goBack();
  await page.waitForTimeout(1500);
  await probe(page, 'after-back-1');

  // Where the owner ends up if he taps the workout tab / navigates back in.
  await page.goto('/workout');
  await page.waitForTimeout(2200);
  await probe(page, 'revisit-workout');
});

test('BACK from picker mid-workout (exercises exist, guard sentinel armed)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(MOBILE);
  await seedGuest(page);

  await page.goto('/workout');
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: START_EMPTY_LABEL }).first().click({ force: true });
  await page.locator('.exercise-card').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(400);

  // Pick one and confirm, so the workout has an exercise and the popstate guard arms.
  await page.locator('.exercise-card').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('[aria-label^="הוסיפו לאימון"]').first().click({ force: true });
  await page.waitForTimeout(1500);
  await probe(page, 'live-session');

  // Re-open the picker mid-workout the way the owner does when adding a move.
  const adders = page.getByRole('button', { name: /הוסיפו תרגיל|הוסף תרגיל|תרגיל נוסף/ });
  const n = await adders.count();
  console.log(`PROBE[adders] count=${n}`);
  if (n > 0) {
    await adders.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await probe(page, 'picker-open-midworkout');

  await page.goBack();
  await page.waitForTimeout(1500);
  await probe(page, 'after-back-midworkout');
});
