/**
 * PICKER DENSITY QA — measurement + screenshot capture, not a regression suite.
 *
 * Opens the exercise picker, selects one exercise so the bottom action area is
 * on screen, then reports the two numbers the density change is judged on:
 * the exercise row height and the action-area height at 390px width.
 *
 * Output: ./visual-qa/picker-*.png
 * Run: npx playwright test e2e/picker-density-qa.spec.ts --project="Desktop Chrome"
 *
 * All console output is deliberately ASCII-only: the shell that reads this
 * output truncates at the first Hebrew character.
 */
import { test } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(250);
}

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

/** Open the picker from the pre-workout screen and select the first exercise. */
async function openPickerWithSelection(page: import('@playwright/test').Page) {
  await page.goto('/workout');
  await page.waitForTimeout(2200);

  const start = page.getByRole('button', { name: /התחילו אימון ריק/ }).first();
  if (await start.isVisible().catch(() => false)) {
    await start.click({ force: true }).catch(() => {});
  }
  await page.locator('.exercise-card').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(600);
}

/** Row height, action-area height, and how many whole rows fit the viewport. */
async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const card = document.querySelector('.exercise-card');
    const confirm = document.querySelector<HTMLElement>('[aria-label^="הוסיפו לאימון"]');
    const actions = confirm?.parentElement ?? null;
    const list = document.querySelector('.exercise-library__scroll');
    const scroller = document.querySelector('.exercise-library');

    const cardBox = card?.getBoundingClientRect();
    const rowPitch = (() => {
      const cards = Array.from(document.querySelectorAll('.exercise-card'));
      if (cards.length < 2) return 0;
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return round(Math.abs(b.top - a.top));
    })();
    const listBox = scroller?.getBoundingClientRect();
    const part = (sel: string) => {
      const el = card?.querySelector(sel);
      return el ? round(el.getBoundingClientRect().height) : 0;
    };

    // Both actions must stay >= 44px tall, must not overflow the row, and the
    // icon must sit at the START of the reading direction (right, in RTL).
    const plan = actions?.querySelector<HTMLElement>('[aria-label^="תכננו מראש"]') ?? null;
    const iconBox = confirm?.querySelector('svg')?.getBoundingClientRect();
    const textBox = confirm?.querySelector('span')?.getBoundingClientRect();

    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      rowHeight: cardBox ? round(cardBox.height) : 0,
      rowPitch,
      titleRow: part('.exercise-card__title-row'),
      metaRow: part('.exercise-card__meta'),
      notesRow: part('.exercise-card__notes'),
      actionAreaHeight: actions ? round(actions.getBoundingClientRect().height) : 0,
      confirmHeight: confirm ? round(confirm.getBoundingClientRect().height) : 0,
      planHeight: plan ? round(plan.getBoundingClientRect().height) : 0,
      actionsOverflow: actions ? actions.scrollWidth > actions.clientWidth : false,
      iconAtStart: iconBox && textBox ? iconBox.x > textBox.x : null,
      listViewportHeight: listBox ? round(listBox.height) : 0,
      wholeRowsVisible: listBox && rowPitch ? Math.floor(listBox.height / rowPitch) : 0,
      cardsRendered: document.querySelectorAll('.exercise-card').length,
      listPresent: !!list,
    };
  });
}

test('picker density — measure + capture with a selection', async ({ page }) => {
  test.setTimeout(180_000);
  const report: string[] = [];

  // ---- 390px ----
  await page.setViewportSize(MOBILE);
  await seedGuest(page);
  await openPickerWithSelection(page);

  const before = await measure(page);
  report.push(`390 unselected: ${JSON.stringify(before)}`);

  await page.locator('.exercise-card').first().click({ force: true });
  await page.waitForTimeout(700);

  const selected = await measure(page);
  report.push(`390 selected: ${JSON.stringify(selected)}`);

  await setTheme(page, 'light');
  await page.screenshot({ path: 'visual-qa/picker-selected-390-light.png' });
  await setTheme(page, 'dark');
  await page.screenshot({ path: 'visual-qa/picker-selected-390-dark.png' });
  await setTheme(page, 'light');

  // ---- 1280px ----
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(600);
  const wide = await measure(page);
  report.push(`1280 selected: ${JSON.stringify(wide)}`);

  await setTheme(page, 'light');
  await page.screenshot({ path: 'visual-qa/picker-selected-1280-light.png' });
  await setTheme(page, 'dark');
  await page.screenshot({ path: 'visual-qa/picker-selected-1280-dark.png' });

  console.log(`PICKER_DENSITY_REPORT\n${report.join('\n')}`);
});

test('picker back gesture — closing the sheet keeps it closed', async ({ page }) => {
  test.setTimeout(120_000);

  await page.setViewportSize(MOBILE);
  await seedGuest(page);
  await openPickerWithSelection(page);

  // The library section only exists inside the picker sheet, so its presence is
  // a direct read of "is the sheet open" that does not depend on the overlay's
  // ARIA plumbing.
  const sheet = page.locator('.exercise-library');
  await sheet.waitFor({ state: 'visible', timeout: 10_000 });

  const closers = page.getByRole('button', { name: 'סגור' });
  const closerCount = await closers.count();
  await closers.first().click({ force: true });
  const trace: string[] = [];
  for (const ms of [200, 400, 1200]) {
    await page.waitForTimeout(ms);
    trace.push(`t+${ms}=${await page.locator('.exercise-library').count()}`);
  }
  const flag = await page.evaluate(() => sessionStorage.getItem('sparkos_prewo_started'));
  console.log(`PICKER_BACK_TRACE closers=${closerCount} flag=${flag} libs ${trace.join(' ')}`);

  const stillOpen = (await page.locator('.exercise-library').count()) > 0;
  const backOnWelcome = await page
    .getByRole('button', { name: /התחילו אימון ריק/ })
    .first()
    .isVisible()
    .catch(() => false);

  console.log(`PICKER_BACK_REPORT sheetStillOpen=${stillOpen} preWorkoutVisible=${backOnWelcome}`);
  if (stillOpen) throw new Error('picker reopened itself after dismiss');
  if (!backOnWelcome) throw new Error('pre-workout screen not reachable after dismiss');
});
