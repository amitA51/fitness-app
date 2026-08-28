/**
 * PICKER CHROME QA — measurement + screenshot capture, not a regression suite.
 *
 * Answers one question with numbers instead of estimates: how much fixed chrome
 * stacks above the FIRST exercise row in the picker, and how many whole exercise
 * rows are actually visible at 390x844.
 *
 * Output: ./visual-qa/picker-chrome-*.png
 * Run: npx playwright test e2e/picker-chrome-qa.spec.ts --project="Desktop Chrome"
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

async function openPicker(page: import('@playwright/test').Page) {
  await page.goto('/workout');
  await page.waitForTimeout(2200);

  // The pre-workout screen's "start without a template" CTA has been relabelled
  // more than once; accept either wording rather than pinning to one string.
  for (const pattern of [/התחילו בלי תבנית/, /התחילו אימון ריק/]) {
    const start = page.getByRole('button', { name: pattern }).first();
    if (await start.isVisible().catch(() => false)) {
      await start.click({ force: true }).catch(() => {});
      break;
    }
  }
  await page.locator('.exercise-card').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(600);
}

/**
 * Chrome above the first row, rows actually visible, and the smallest touch
 * target inside the sheet. Every number is read from live layout boxes.
 */
async function measureChrome(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const box = (el: Element | null | undefined) => el?.getBoundingClientRect() ?? null;

    const library = document.querySelector('.exercise-library');
    const toolbar = document.querySelector('.exercise-library__toolbar');
    const summary = document.querySelector('.exercise-library__summary');
    const search = document.querySelector('.exercise-search');
    const filterRow = document.querySelector('.exercise-filter-row');
    const tabs = document.querySelector('[aria-label="סוג בחירה"]');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.exercise-card'));
    const firstCard = cards
      .slice()
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];

    // The sheet is the outermost element that holds the library; its top edge is
    // where the chrome this component owns begins.
    const sheet = library?.closest<HTMLElement>('[style*="92dvh"], [style*="dvh"]') ?? null;

    const libraryBox = box(library);
    const toolbarBox = box(toolbar);
    const firstBox = box(firstCard);
    const sheetBox = box(sheet);

    // Visible band for rows: below the sticky toolbar, above whatever bottom
    // chrome the sheet pins (the action bar).
    const confirm = document.querySelector<HTMLElement>('[aria-label^="הוסיפו לאימון"]');
    const cancel = document.querySelector<HTMLElement>('[aria-label="סגור"]');
    const actionBar = confirm?.parentElement ?? null;
    const actionBox = box(actionBar);
    const bandTop = toolbarBox ? toolbarBox.bottom : (libraryBox?.top ?? 0);
    const bandBottom = Math.min(
      libraryBox ? libraryBox.bottom : window.innerHeight,
      actionBox ? actionBox.top : window.innerHeight
    );

    const rowPitch = (() => {
      if (cards.length < 2) return 0;
      const sorted = cards
        .slice()
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      return round(sorted[1].getBoundingClientRect().top - sorted[0].getBoundingClientRect().top);
    })();

    const wholeRowsVisible = cards.filter((card) => {
      const r = card.getBoundingClientRect();
      return r.top >= bandTop - 0.5 && r.bottom <= bandBottom + 0.5;
    }).length;

    // Smallest interactive box inside the sheet, so a density win cannot hide a
    // sub-44px tap target. No exemptions: every visible control counts.
    const interactive = Array.from(
      (library?.closest('[role="dialog"]') ?? document).querySelectorAll<HTMLElement>(
        'button, [role="button"], input, select'
      )
    ).filter((el) => el.offsetParent !== null);
    const smallest = interactive.reduce<{ h: number; what: string }>(
      (min, el) => {
        const h = round(el.getBoundingClientRect().height);
        if (h === 0) return min;
        return h < min.h
          ? { h, what: el.getAttribute('aria-label') || el.className || el.tagName }
          : min;
      },
      { h: Number.POSITIVE_INFINITY, what: 'none' }
    );

    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      // The headline number: everything above the first exercise row.
      chromeFromViewportTop: firstBox ? round(firstBox.top) : 0,
      chromeFromSheetTop: firstBox && sheetBox ? round(firstBox.top - sheetBox.top) : 0,
      sheetTop: sheetBox ? round(sheetBox.top) : 0,
      bars: {
        tabs: tabs ? round(box(tabs)?.height ?? 0) : 0,
        toolbar: toolbarBox ? round(toolbarBox.height) : 0,
        search: search ? round(box(search)?.height ?? 0) : 0,
        filterRow: filterRow ? round(box(filterRow)?.height ?? 0) : 0,
        summaryRow: summary ? round(box(summary)?.height ?? 0) : 0,
        actionBar: actionBox ? round(actionBox.height) : 0,
      },
      rowPitch,
      rowHeight: firstBox ? round(firstBox.height) : 0,
      visibleBand: round(bandBottom - bandTop),
      wholeRowsVisible,
      cardsRendered: cards.length,
      smallestTouchTarget: smallest.h === Number.POSITIVE_INFINITY ? 0 : smallest.h,
      smallestTouchTargetWhat: smallest.what,
      closeButtonHeight: cancel ? round(box(cancel)?.height ?? 0) : 0,
      hasSummaryRow: !!summary,
    };
  });
}

test('picker chrome — measure the stack above the first exercise', async ({ page }) => {
  test.setTimeout(180_000);
  const report: string[] = [];
  const label = process.env.PICKER_CHROME_LABEL ?? 'after';

  await page.setViewportSize(MOBILE);
  await seedGuest(page);
  await openPicker(page);

  report.push(`390 no-selection: ${JSON.stringify(await measureChrome(page))}`);

  await page.locator('.exercise-card').first().click({ force: true });
  await page.waitForTimeout(700);
  report.push(`390 one-selected: ${JSON.stringify(await measureChrome(page))}`);

  await setTheme(page, 'light');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-390-light.png` });
  await setTheme(page, 'dark');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-390-dark.png` });
  await setTheme(page, 'light');

  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(700);
  report.push(`1280 one-selected: ${JSON.stringify(await measureChrome(page))}`);

  await setTheme(page, 'light');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-1280-light.png` });
  await setTheme(page, 'dark');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-1280-dark.png` });

  // The two states this change relocated: the reset action now rides in the chips
  // row (only while filtered), and sort now lives in the סינון drawer.
  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'רגליים' }).first().click({ force: true });
  await page.waitForTimeout(400);
  await page
    .getByRole('button', { name: /^סינון/ })
    .first()
    .click({ force: true });
  await page.waitForTimeout(600);
  report.push(`390 filtered-drawer-open: ${JSON.stringify(await measureChrome(page))}`);

  await setTheme(page, 'light');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-390-filtered-light.png` });
  await setTheme(page, 'dark');
  await page.screenshot({ path: `visual-qa/picker-chrome-${label}-390-filtered-dark.png` });

  console.log(`PICKER_CHROME_REPORT label=${label}\n${report.join('\n')}`);
});
