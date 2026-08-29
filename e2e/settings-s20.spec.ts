/**
 * s20 — SETTINGS REBUILD CAPTURE + HIGH-CONTRAST ROUND TRIP (scratch spec).
 *
 * Two things had never been observed end to end:
 *   A) the rebuilt Settings screen (5 groups, 3 `מתקדם` expanders, no jump nav)
 *      in all four theme states (light / dark / light+HC / dark+HC) x 390/1280;
 *   B) the fix for the setting-destroying bug — toggle `ניגודיות גבוהה` inside
 *      the in-workout settings overlay, leave the workout, and the Settings
 *      screen must READ it as ON; then toggling dark mode there must NOT wipe
 *      it.
 *
 * Everything is asserted from measured DOM state (aria-checked, <html> classes,
 * the persisted `appSettings` record) as well as photographed, so a capture that
 * silently landed on the wrong state fails instead of filing a lying PNG.
 *
 * Viewports are 390x1500 / 1280x1500 and screenshots are element- or
 * viewport-scoped: `fullPage: true` captures only the first viewport in this app
 * because the scrolling box is the inner `#main-content`, not the document.
 *
 * Run: npx playwright test e2e/settings-s20.spec.ts --project="Desktop Chrome"
 */
import { expect, test } from '@playwright/test';

const OUT = 'visual-qa';

const COMBOS = [
  { id: 'light', dark: false, hc: false },
  { id: 'light-hc', dark: false, hc: true },
  { id: 'dark', dark: true, hc: false },
  { id: 'dark-hc', dark: true, hc: true },
] as const;

const VIEWPORTS = [
  { tag: '390', width: 390, height: 1500 },
  { tag: '1280', width: 1280, height: 1500 },
] as const;

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;
type Rgb = [number, number, number];

const MEASURE: Record<string, unknown>[] = [];

// ── colour maths (WCAG 2.x), on sampled pixels rather than token arithmetic ──

function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Modal fill + the most-contrasting significant colour of a PNG buffer. */
async function palette(buf: Buffer): Promise<{
  width: number;
  height: number;
  fill: Rgb;
  ink: Rgb;
  inkOnFill: number;
  inkShare: number;
}> {
  const sharpMod = (await import('sharp')).default;
  const { data, info } = await sharpMod(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const total = info.width * info.height;
  const counts = new Map<string, number>();
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parse = (k: string): Rgb => {
    const [r, g, b] = k.split(',').map(Number);
    return [r ?? 0, g ?? 0, b ?? 0];
  };
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const fill = parse(sorted[0]?.[0] ?? '0,0,0');
  let ink = fill;
  let inkOnFill = 1;
  let inkShare = 0;
  for (const [key, n] of sorted) {
    if (n / total < 0.005) continue; // below the floor = antialiasing fringe
    const r = contrast(parse(key), fill);
    if (r > inkOnFill) {
      inkOnFill = r;
      ink = parse(key);
      inkShare = Math.round((n / total) * 1000) / 1000;
    }
  }
  return { width: info.width, height: info.height, fill, ink, inkOnFill, inkShare };
}

// ── fixture ────────────────────────────────────────────────────────────────

/** Wipe localStorage AND every IndexedDB store: a persisted in-progress
 *  workout has previously hijacked a capture and photographed set logging. */
async function wipe(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise<void>((resolve) => {
            if (!d.name) return resolve();
            const req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          })
      )
    );
  });
}

async function seedGuest(page: Page): Promise<void> {
  await wipe(page);
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

/** Apply a theme state through the product's own record, then prove it landed.
 *  Dark mode is `html.dark` (not the OS query) and HC is `html.high-contrast`,
 *  which STACKS — so all four states are reachable and must be asserted. */
async function applyCombo(
  page: Page,
  combo: { id: string; dark: boolean; hc: boolean }
): Promise<void> {
  await page.evaluate(
    ({ dark, hc }) => {
      let stored: Record<string, unknown> = {};
      try {
        stored = JSON.parse(localStorage.getItem('appSettings') ?? '{}');
      } catch {
        stored = {};
      }
      const workout = (stored.workoutSettings ?? {}) as Record<string, unknown>;
      localStorage.setItem(
        'appSettings',
        JSON.stringify({
          ...stored,
          darkMode: dark,
          workoutSettings: { ...workout, highContrast: hc },
        })
      );
    },
    { dark: combo.dark, hc: combo.hc }
  );
  await page.reload();
  await page.waitForTimeout(1200);
  expect(await htmlState(page), `combo ${combo.id} must be on <html>`).toMatchObject({
    dark: combo.dark,
    highContrast: combo.hc,
  });
}

async function htmlState(page: Page) {
  return page.evaluate(() => {
    const c = document.documentElement.classList;
    let stored: { darkMode?: boolean; workoutSettings?: { highContrast?: boolean } } = {};
    try {
      stored = JSON.parse(localStorage.getItem('appSettings') ?? '{}');
    } catch {
      /* ignore */
    }
    return {
      dark: c.contains('dark'),
      highContrast: c.contains('high-contrast'),
      largeText: c.contains('large-text'),
      reduceMotion: c.contains('reduce-motion'),
      storedDarkMode: stored.darkMode ?? null,
      storedHighContrast: stored.workoutSettings?.highContrast ?? null,
    };
  });
}

const settingsRoot = (page: Page): Locator => page.locator('#main-content div[dir="rtl"]').first();

/** Element screenshot + palette, recorded. Element-scoped so a tall screen is
 *  captured whole instead of the first viewport. */
async function shootEl(
  page: Page,
  locator: Locator,
  name: string,
  meta: Record<string, unknown>
): Promise<void> {
  const el = locator.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const buf = await el.screenshot({ path: `${OUT}/${name}.png` });
  const p = await palette(buf);
  MEASURE.push({
    png: `${name}.png`,
    ...meta,
    pngWidth: p.width,
    pngHeight: p.height,
    fill: toHex(p.fill),
    ink: toHex(p.ink),
    inkOnFill: p.inkOnFill,
    inkShare: p.inkShare,
  });
}

/** Tappable geometry + horizontal overflow + Hebrew-with-digits strings. */
async function auditSettings(page: Page, combo: string, vp: string) {
  const audit = await page.evaluate(() => {
    const root = document.querySelector('#main-content div[dir="rtl"]');
    if (!root) return null;
    const sel = 'button, a[href], [role="switch"], input, select, textarea, summary';
    const small: Record<string, unknown>[] = [];
    const overflow: Record<string, unknown>[] = [];
    for (const el of Array.from(root.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const name =
        el.getAttribute('aria-label') ||
        (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48) ||
        el.tagName;
      if (Math.min(r.width, r.height) < 44) {
        small.push({
          name,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') ?? null,
          type: (el as HTMLInputElement).type ?? null,
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
        });
      }
    }
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className ?? '').toString().slice(0, 40),
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }
    // Mixed Hebrew+digit strings: the classic RTL reversal risk.
    const mixed: Record<string, unknown>[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      const t = (n.textContent ?? '').trim();
      if (t && /[\u0590-\u05FF]/.test(t) && /\d/.test(t)) {
        const parent = n.parentElement;
        mixed.push({
          text: t.slice(0, 60),
          direction: parent ? getComputedStyle(parent).direction : null,
          unicodeBidi: parent ? getComputedStyle(parent).unicodeBidi : null,
          hasDirChild: parent ? Boolean(parent.querySelector('[dir]')) : null,
        });
      }
      n = walker.nextNode();
    }
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      rootHeight: Math.round(root.getBoundingClientRect().height),
      groupHeadings: Array.from(root.querySelectorAll('h2')).map((h) =>
        (h.textContent ?? '').trim()
      ),
      expanders: Array.from(root.querySelectorAll('button[aria-expanded]')).map((b) => ({
        label: (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
        expanded: b.getAttribute('aria-expanded'),
        h: Math.round(b.getBoundingClientRect().height),
      })),
      switches: Array.from(root.querySelectorAll('[role="switch"]')).map((b) => ({
        name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 32),
        checked: b.getAttribute('aria-checked'),
      })),
      smallTargets: small,
      overflowing: overflow.slice(0, 12),
      mixedHebrewDigits: mixed.slice(0, 20),
    };
  });
  MEASURE.push({ audit: `settings-${combo}-${vp}`, combo, vp, ...(audit ?? { missing: true }) });
  return audit;
}

async function flush(tag: string): Promise<void> {
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/s20-${tag}.json`, JSON.stringify(MEASURE, null, 2), 'utf8');
}

// ===========================================================================
// A) Settings — four theme states x two widths, every מתקדם COLLAPSED
// ===========================================================================
test('s20 — settings screen, 4 theme states x 2 widths, advanced collapsed', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await seedGuest(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      await page.goto('/settings');
      await applyCombo(page, combo);
      expect(new URL(page.url()).pathname, 'capture must be on /settings').toBe('/settings');
      await expect(page.getByRole('heading', { name: 'הגדרות' }).first()).toBeVisible();
      await page.waitForTimeout(600);

      const audit = await auditSettings(page, combo.id, vp.tag);
      // The rebuild's shape, asserted rather than eyeballed off a PNG.
      expect(audit?.expanders.every((e) => e.expanded === 'false')).toBe(true);
      await shootEl(page, settingsRoot(page), `s20-settings-${combo.id}-${vp.tag}`, {
        surface: 'settings-collapsed',
        combo: combo.id,
        vp: vp.tag,
      });

      // The three highest-risk text figures, measured from real pixels.
      for (const [label, loc] of [
        ['group-heading', page.getByRole('heading', { name: 'תצוגה ונגישות' })],
        ['advanced-trigger', page.locator('button[aria-expanded]').first()],
        ['legal-label', page.getByText('משפטי ופרטיות', { exact: true })],
      ] as [string, Locator][]) {
        if (await loc.first().isVisible().catch(() => false)) {
          await shootEl(page, loc, `s20-txt-${label}-${combo.id}-${vp.tag}`, {
            surface: label,
            combo: combo.id,
            vp: vp.tag,
          });
        }
      }
    }
  }
  MEASURE.push({ consoleErrors: errors });
  await flush('measure');
});

// ===========================================================================
// B) Settings — all three מתקדם EXPANDED (children are unmounted while closed)
// ===========================================================================
test('s20 — settings screen with all three advanced expanders open', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await seedGuest(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS.filter((c) => c.id === 'light' || c.id === 'dark')) {
      await page.goto('/settings');
      await applyCombo(page, combo);
      await expect(page.getByRole('heading', { name: 'הגדרות' }).first()).toBeVisible();

      const triggers = page.locator('#main-content button[aria-expanded]');
      const n = await triggers.count();
      for (let i = 0; i < n; i++) {
        const t = triggers.nth(i);
        if ((await t.getAttribute('aria-expanded')) === 'false') {
          await t.scrollIntoViewIfNeeded().catch(() => {});
          await t.click({ force: true }).catch(() => {});
          await page.waitForTimeout(350);
        }
      }
      await page.waitForTimeout(900);
      const audit = await auditSettings(page, `${combo.id}-expanded`, vp.tag);
      MEASURE.push({
        note: 'expanded pass',
        combo: combo.id,
        vp: vp.tag,
        expanderCount: n,
        expandedStates: audit?.expanders,
      });
      expect(n, 'settings must expose exactly three progressive-disclosure triggers').toBe(3);
      expect(audit?.expanders.every((e) => e.expanded === 'true')).toBe(true);

      await shootEl(page, settingsRoot(page), `s20-settings-expanded-${combo.id}-${vp.tag}`, {
        surface: 'settings-expanded',
        combo: combo.id,
        vp: vp.tag,
      });
    }
  }
  MEASURE.push({ consoleErrorsExpandedPass: errors });
  await flush('measure-expanded');
});

// ===========================================================================
// C) THE ROUND TRIP — in-workout overlay HC ON -> Settings reads ON -> dark
//    mode must not destroy it. Every state read from the DOM, then photographed.
// ===========================================================================
for (const vp of VIEWPORTS) {
  test(`s20 — high-contrast round trip @ ${vp.tag}`, async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    const steps: Record<string, unknown>[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.setViewportSize({ width: vp.width, height: vp.height });
    page.setDefaultTimeout(20_000);
    await seedGuest(page);
    await page.goto('/settings');
    await applyCombo(page, { id: 'light', dark: false, hc: false });

    const record = async (step: string, extra: Record<string, unknown> = {}) => {
      steps.push({ step, url: new URL(page.url()).pathname, ...(await htmlState(page)), ...extra });
    };
    await record('00-baseline-light-hc-off');

    // ── into a live workout ────────────────────────────────────────────────
    await page.goto('/workout');
    await page.waitForTimeout(2500);
    const overflow = page.getByRole('button', { name: 'עוד פעולות' });
    const flow: string[] = [];
    const tryClick = async (loc: Locator, tag: string, waitMs = 2500) => {
      if (await loc.first().isVisible().catch(() => false)) {
        await loc.first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(waitMs);
        flow.push(tag);
      }
    };
    for (let i = 0; i < 3; i++) {
      if (await overflow.first().isVisible().catch(() => false)) break;
      // Fresh guest lands on "האימון הראשון שלך": template or free-form start.
      await tryClick(page.getByRole('button', { name: /התחילו בלי תבנית/ }), 'no-template', 2200);
      await tryClick(
        page.getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ }),
        'start',
        3000
      );
      if (await overflow.first().isVisible().catch(() => false)) break;
      // Exercise selector: take the first two rows, whatever the catalog order.
      const rows = page.locator('[role="listitem"]');
      if ((await rows.count()) > 1) {
        for (const idx of [0, 1]) {
          await tryClick(rows.nth(idx), `pick:row${idx}`, 500);
        }
        flow.push(`rows=${await rows.count()}`);
      }
      await tryClick(
        page.getByRole('button', { name: /הוסיפו לאימון|התחל עם|התחל \(/ }),
        'confirm',
        2800
      );
      await tryClick(page.getByText('כללי', { exact: true }), 'goal');
      await tryClick(page.getByRole('button', { name: /דלגו? על חימום/ }), 'skip-warmup', 3000);
    }
    flow.push(`url=${new URL(page.url()).pathname}`);
    await expect(overflow.first(), 'the live workout header must be reachable').toBeVisible({
      timeout: 15_000,
    });
    await record('01-in-workout', { flow });
    await page.screenshot({ path: `${OUT}/s20-rt-${vp.tag}-01-workout-hc-off.png` });

    // ── the in-workout settings overlay, מתקדם tab ─────────────────────────
    // The overflow trigger exists in the DOM on the warm-up screen too, where a
    // click cannot reach it — so the gate is "the menu actually opened", and a
    // failed attempt retries after skipping whatever intermediate screen is up.
    const settingsItem = page.getByRole('menuitem', { name: 'הגדרות' });
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt++) {
      await overflow.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      if (await settingsItem.first().isVisible().catch(() => false)) {
        opened = true;
        break;
      }
      flow.push(`menu-attempt-${attempt}-failed`);
      await page.keyboard.press('Escape').catch(() => {});
      await tryClick(page.getByRole('button', { name: /דלגו? על חימום/ }), 'skip-warmup-retry', 3000);
      await tryClick(page.getByText('כללי', { exact: true }), 'goal-retry', 2000);
    }
    expect(opened, 'the in-workout overflow menu must open').toBe(true);
    await settingsItem.first().click({ force: true });
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'מתקדם', exact: true }).first().click({ force: true });
    await page.waitForTimeout(700);

    const overlaySwitch = page.getByRole('switch', { name: /ניגודיות גבוהה/ }).first();
    await overlaySwitch.scrollIntoViewIfNeeded().catch(() => {});
    await expect(overlaySwitch).toBeVisible();
    const overlayGeom = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      const tabs = Array.from(document.querySelectorAll('button')).filter((b) =>
        ['כללי', 'מנוחה', 'שמע', 'אימון', 'מתקדם'].includes((b.textContent ?? '').trim())
      );
      return {
        tabs: tabs.map((t) => ({ label: (t.textContent ?? '').trim(), ...box(t) })),
        hcRow: box(
          Array.from(document.querySelectorAll('[role="switch"]')).find((s) =>
            (s.textContent ?? '').includes('ניגודיות גבוהה')
          ) ?? null
        ),
        closeBtn: box(document.querySelector('[aria-label="סגור"]')),
      };
    });
    await record('02-overlay-open', {
      overlayAriaChecked: await overlaySwitch.getAttribute('aria-checked'),
      overlayGeom,
    });
    await page.screenshot({ path: `${OUT}/s20-rt-${vp.tag}-02-overlay-advanced-before.png` });
    expect(await overlaySwitch.getAttribute('aria-checked'), 'HC starts OFF').toBe('false');

    // ── toggle ניגודיות גבוהה ON inside the workout ────────────────────────
    await overlaySwitch.click({ force: true });
    await page.waitForTimeout(900);
    await record('03-overlay-hc-toggled-on', {
      overlayAriaChecked: await overlaySwitch.getAttribute('aria-checked'),
    });
    await page.screenshot({ path: `${OUT}/s20-rt-${vp.tag}-03-overlay-hc-on.png` });
    expect(await overlaySwitch.getAttribute('aria-checked')).toBe('true');
    expect((await htmlState(page)).highContrast, 'app must render high contrast now').toBe(true);

    // Close the overlay and photograph the workout under high contrast.
    await page.getByRole('button', { name: 'סגור' }).first().click({ force: true });
    await page.waitForTimeout(900);
    await record('04-overlay-closed');
    await page.screenshot({ path: `${OUT}/s20-rt-${vp.tag}-04-workout-hc-on.png` });

    // ── leave the workout (discard), then SOFT-navigate to Settings ────────
    await overflow.first().click({ force: true });
    await page.waitForTimeout(400);
    await page.getByRole('menuitem', { name: 'בטל אימון' }).click({ force: true });
    await page.waitForTimeout(900);
    for (const label of ['בטל אימון', 'לא, בטלו אותו']) {
      const btn = page.getByRole('button', { name: label, exact: true }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);
        flow.push(`discard:${label}`);
        break;
      }
    }
    await page.waitForTimeout(1500);
    await record('05-left-workout', { flow });
    await page.screenshot({ path: `${OUT}/s20-rt-${vp.tag}-05-after-leaving-workout.png` });

    // In-app (client-side) navigation, NOT a reload: a reload would re-read the
    // store and could mask a live divergence between the two writers.
    const gear = page.getByRole('link', { name: 'הגדרות' }).first();
    let navPath = 'gear-link';
    if (await gear.isVisible().catch(() => false)) {
      await gear.click({ force: true });
    } else {
      navPath = 'hard-goto (gear not reachable)';
      await page.goto('/settings');
    }
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'הגדרות' }).first()).toBeVisible({
      timeout: 15_000,
    });

    // ── does the Settings control READ it as ON? ───────────────────────────
    const hcSwitch = page.getByRole('switch', { name: 'ניגודיות גבוהה' }).first();
    const darkSwitch = page.getByRole('switch', { name: 'מצב כהה' }).first();
    await hcSwitch.scrollIntoViewIfNeeded().catch(() => {});
    await record('06-settings-after-workout', {
      navPath,
      settingsHcAriaChecked: await hcSwitch.getAttribute('aria-checked'),
      settingsDarkAriaChecked: await darkSwitch.getAttribute('aria-checked'),
    });
    await shootEl(page, settingsRoot(page), `s20-rt-${vp.tag}-06-settings-hc-on`, {
      surface: 'settings-after-workout-hc',
      combo: 'light-hc',
      vp: vp.tag,
    });
    await page
      .locator('div')
      .filter({ has: hcSwitch })
      .last()
      .screenshot({ path: `${OUT}/s20-rt-${vp.tag}-06b-hc-row.png` })
      .catch(() => {});
    expect(
      await hcSwitch.getAttribute('aria-checked'),
      'Settings must READ the in-workout high-contrast change'
    ).toBe('true');

    // ── now tap dark mode: high contrast must SURVIVE ──────────────────────
    await darkSwitch.scrollIntoViewIfNeeded().catch(() => {});
    await darkSwitch.click({ force: true });
    await page.waitForTimeout(1200);
    await record('07-after-dark-toggle', {
      settingsHcAriaChecked: await hcSwitch.getAttribute('aria-checked'),
      settingsDarkAriaChecked: await darkSwitch.getAttribute('aria-checked'),
    });
    await shootEl(page, settingsRoot(page), `s20-rt-${vp.tag}-07-settings-dark-hc-still-on`, {
      surface: 'settings-dark-plus-hc',
      combo: 'dark-hc',
      vp: vp.tag,
    });
    await page
      .locator('div')
      .filter({ has: hcSwitch })
      .last()
      .screenshot({ path: `${OUT}/s20-rt-${vp.tag}-07b-hc-row.png` })
      .catch(() => {});

    const after = await htmlState(page);
    expect(await hcSwitch.getAttribute('aria-checked'), 'HC survives the dark toggle').toBe('true');
    expect(await darkSwitch.getAttribute('aria-checked')).toBe('true');
    expect(after).toMatchObject({
      dark: true,
      highContrast: true,
      storedDarkMode: true,
      storedHighContrast: true,
    });

    // And it must still be true after a cold reload (the persisted record).
    await page.reload();
    await page.waitForTimeout(2000);
    await record('08-after-reload');
    expect(await htmlState(page)).toMatchObject({ dark: true, highContrast: true });

    const fs = await import('node:fs');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      `${OUT}/s20-roundtrip-${vp.tag}.json`,
      JSON.stringify({ viewport: vp, steps, consoleErrors: errors }, null, 2),
      'utf8'
    );
  });
}
