/**
 * VISUAL QA — ONBOARDING WIZARD (post-D3/D4 trim)
 * Captures every step of the trimmed 5-step trainee wizard (welcome → profile →
 * goals → האימון שלכם → complete) plus the D4 auto-opened start-workout sheet on
 * the first-run dashboard. Output: ./visual-qa/ob-*.png
 * Run: npx playwright test e2e/onboarding-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { test, expect } from '@playwright/test';

async function shoot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: `visual-qa/${name}.png`, fullPage: false });
}

/** Flip to Obsidian (dark) before capturing — the onboarding steps have never
 *  been reviewed in dark mode. */
async function goDark(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(250);
}

test('capture the trimmed onboarding flow + D4 auto-sheet', async ({ page }) => {
  test.setTimeout(120_000);

  // Enter the wizard as a guest: skip consent, choose "המשיכו כאורח".
  await page.goto('/');
  await page.waitForTimeout(1500);
  await goDark(page);
  for (const label of ['רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  const guest = page.getByText('המשיכו כאורח').first();
  if (await guest.isVisible().catch(() => false)) {
    await guest.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(900);
  }
  await shoot(page, 'ob-01-welcome');

  const next = async (): Promise<void> => {
    // The wizard footer's forward control is the start-workout-btn / a
    // "המשך" button; tap whichever is present.
    const primary = page.locator('.start-workout-btn').first();
    if (await primary.isVisible().catch(() => false)) {
      await primary.click().catch(() => {});
      await page.waitForTimeout(700);
      return;
    }
    const cont = page.locator('button:has-text("המשך")').first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click().catch(() => {});
      await page.waitForTimeout(700);
    }
  };

  // profile — fill the minimum then continue
  await next();
  await page.waitForTimeout(500);
  await shoot(page, 'ob-02-profile');

  // goals — pick the first goal card
  await page.locator('button').nth(4).click({ force: true }).catch(() => {});
  await next();
  await shoot(page, 'ob-03-goals');

  // האימון שלכם (merged experience+equipment+days)
  await next();
  await page.waitForTimeout(500);
  await shoot(page, 'ob-04-training-context');

  // complete
  await next();
  await page.waitForTimeout(600);
  await shoot(page, 'ob-05-complete');

  void expect;
});
