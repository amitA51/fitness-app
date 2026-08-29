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


// ===========================================================================
// s23 — CAPTURE-ONLY PASS. Raw measurements only; no verdicts in this file.
// ===========================================================================
// Why this exists: three rounds failed to photograph this screen because
// `fullPage: true` lies here. The scrolling box is the inner `#main-content`,
// not the document, so a tall viewport just paints the first N pixels and then
// blank canvas — which is how two of the five groups (`אימון והתראות`,
// `נתונים ופרטיות`) were never seen by anyone.
//
// The fix is mechanical: clip-screenshot the scrollport rect at successive
// `scrollTop` offsets and stitch the frames into one tall PNG, then ASSERT the
// stitched image actually carries pixel variance below y=1500 before moving on.
// Clipping to the scrollport also keeps the fixed bottom nav out of every frame.
//
// Every crop is labelled from the element's VERIFIED text content (read back
// from the DOM at capture time and written into the JSON), because the previous
// round filed 24 crops labelled `advanced-trigger` that were all a different
// control (`פרופיל ציבורי`) — the two real `מתקדם` triggers had never been
// measured.
//
// Output: PNGs in visual-qa/, and ONE json — visual-qa/s23-measure.json.
// Colour is reported as sampled pixel values; no contrast ratios, no
// conclusions. `sampledBackground` is the most frequent pixel in the crop and
// `sampledForeground` is the pixel furthest from it in plain RGB space among
// colours holding >=0.4% of the crop — a mechanical selection rule, stated here
// so the analyst can discount it, not a judgement.

type Rect = { x: number; y: number; width: number; height: number };
type ColorSample = { hex: string; rgb: Rgb; share: number };

const S23: Record<string, unknown>[] = [];
const S23_FOLD = 1500;

const S23_VIEWPORTS = [
  { tag: '390', width: 390, height: 844 },
  { tag: '1280', width: 1280, height: 800 },
] as const;

/** The two groups nobody has ever photographed. */
const S23_UNSEEN_GROUPS = ['אימון והתראות', 'נתונים ופרטיות'] as const;

async function flushS23(): Promise<void> {
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    `${OUT}/s23-measure.json`,
    JSON.stringify(
      {
        meta: {
          spec: 'e2e/settings-s20.spec.ts (s23 capture pass)',
          capturedAt: new Date().toISOString(),
          scrollContainer: '#main-content',
          captureMethod:
            'clip-screenshot of the #main-content rect at successive scrollTop offsets, stitched with sharp; fullPage is unusable on this screen',
          foldPx: S23_FOLD,
          themeStates: 'html.dark for dark; html.high-contrast stacks on it; four combos',
          colorSampling:
            'sampledBackground = most frequent pixel in the crop; sampledForeground = pixel furthest from it in RGB Euclidean distance among colours with share >= 0.004. No contrast ratios computed here.',
          note: 'raw measurements only — no analysis, no verdicts',
        },
        records: S23,
      },
      null,
      2
    ),
    'utf8'
  );
}

function s23Slug(text: string): string {
  const map: Record<string, string> = {
    מתקדם: 'metkadem',
    'פרופיל ציבורי': 'profil-tziburi',
    'אימון והתראות': 'imun-vehatraot',
    'נתונים ופרטיות': 'netunim-ufratiut',
    'תצוגה ונגישות': 'tetzuga-venegishut',
    חשבון: 'heshbon',
    'הפרופיל שלי': 'haprofil-sheli',
  };
  return map[text] ?? `x${Buffer.from(text, 'utf8').toString('hex').slice(0, 16)}`;
}

/** Geometry of the real scrolling box. */
async function scrollport(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('#main-content');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollTop: Math.round(el.scrollTop),
      overflowY: getComputedStyle(el).overflowY,
    };
  });
}

async function setScrollTop(page: Page, top: number): Promise<number> {
  const actual = await page.evaluate((t) => {
    const el = document.querySelector('#main-content');
    if (!el) return -1;
    el.scrollTop = t;
    return Math.round(el.scrollTop);
  }, top);
  await page.waitForTimeout(260);
  return actual;
}

/** Top-N most frequent colours of a PNG, plus the mechanical fg/bg pick. */
async function sampleColors(
  buf: Buffer
): Promise<{ width: number; height: number; top: ColorSample[]; bg: ColorSample; fg: ColorSample | null }> {
  const sharpMod = (await import('sharp')).default;
  const { data, info } = await sharpMod(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const total = info.width * info.height;
  const counts = new Map<string, number>();
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    counts.set(
      `${data[i]},${data[i + 1]},${data[i + 2]}`,
      (counts.get(`${data[i]},${data[i + 1]},${data[i + 2]}`) ?? 0) + 1
    );
  }
  const toSample = ([key, n]: [string, number]): ColorSample => {
    const [r, g, b] = key.split(',').map(Number);
    const rgb: Rgb = [r ?? 0, g ?? 0, b ?? 0];
    return { hex: toHex(rgb), rgb, share: Math.round((n / total) * 10000) / 10000 };
  };
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(toSample);
  const bg = sorted[0] ?? { hex: '#000000', rgb: [0, 0, 0] as Rgb, share: 0 };
  let fg: ColorSample | null = null;
  let best = -1;
  for (const c of sorted) {
    if (c.share < 0.004) continue;
    const d =
      (c.rgb[0] - bg.rgb[0]) ** 2 + (c.rgb[1] - bg.rgb[1]) ** 2 + (c.rgb[2] - bg.rgb[2]) ** 2;
    if (d > best) {
      best = d;
      fg = c;
    }
  }
  return { width: info.width, height: info.height, top: sorted.slice(0, 8), bg, fg };
}

/** Stitch the whole scrollport into one PNG and prove it has content below the fold. */
async function stitchScrollport(
  page: Page,
  name: string,
  meta: Record<string, unknown>
): Promise<{ height: number; belowFoldStdDev: number[] | null; hasContentBelowFold: boolean | null }> {
  const sp = await scrollport(page);
  if (!sp) {
    S23.push({ png: null, ...meta, error: 'no #main-content' });
    return { height: 0, belowFoldStdDev: null, hasContentBelowFold: null };
  }
  const sharpMod = (await import('sharp')).default;
  const fs = await import('node:fs');
  const step = sp.clientHeight;
  const offsets: number[] = [];
  for (let o = 0; o + step < sp.scrollHeight; o += step) offsets.push(o);
  offsets.push(Math.max(0, sp.scrollHeight - step)); // bottom-aligned final frame

  const frames: { top: number; buf: Buffer }[] = [];
  for (const o of offsets) {
    const actual = await setScrollTop(page, o);
    const buf = await page.screenshot({
      clip: { x: sp.x, y: sp.y, width: sp.width, height: step },
      animations: 'disabled',
    });
    frames.push({ top: actual < 0 ? o : actual, buf });
  }
  await setScrollTop(page, 0);

  const firstMeta = await sharpMod(frames[0].buf).metadata();
  const scale = (firstMeta.width ?? sp.width) / sp.width;
  const canvasW = Math.round(sp.width * scale);
  const canvasH = Math.round(sp.scrollHeight * scale);
  const stitched = await sharpMod({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 0, b: 255 }, // magenta = a gap the stitch failed to cover
    },
  })
    .composite(frames.map((f) => ({ input: f.buf, top: Math.round(f.top * scale), left: 0 })))
    .png()
    .toBuffer();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${name}.png`, stitched);

  // Did we actually paint below the old 1500px fold, or is it blank canvas again?
  let belowFoldStdDev: number[] | null = null;
  let hasContentBelowFold: boolean | null = null;
  const foldPx = Math.round(S23_FOLD * scale);
  if (canvasH > foldPx + 20) {
    const stats = await sharpMod(stitched)
      .extract({
        left: 0,
        top: foldPx,
        width: canvasW,
        height: Math.min(Math.round(900 * scale), canvasH - foldPx),
      })
      .stats();
    belowFoldStdDev = stats.channels.map((c) => Math.round(c.stdev * 100) / 100);
    hasContentBelowFold = belowFoldStdDev.some((s) => s > 1.5);
  }

  S23.push({
    png: `${name}.png`,
    ...meta,
    kind: 'scrollport-stitch',
    scrollport: sp,
    frameOffsets: frames.map((f) => f.top),
    frameCount: frames.length,
    pngWidth: canvasW,
    pngHeight: canvasH,
    dpr: scale,
    belowFoldStdDev,
    hasContentBelowFold,
  });
  return { height: canvasH, belowFoldStdDev, hasContentBelowFold };
}

/** All disclosure triggers, each with its VERIFIED text and a tight label rect. */
async function readTriggers(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x * 10) / 10,
        y: Math.round(r.y * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
    };
    type Rect = { x: number; y: number; width: number; height: number };
    return Array.from(document.querySelectorAll('#main-content button[aria-expanded]')).map(
      (b, index) => {
        let textBox: Rect | null = null;
        const textNode = Array.from(b.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0
        );
        if (textNode) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0)
            textBox = {
              x: Math.round(r.x * 10) / 10,
              y: Math.round(r.y * 10) / 10,
              width: Math.round(r.width * 10) / 10,
              height: Math.round(r.height * 10) / 10,
            };
        }
        const cs = getComputedStyle(b);
        return {
          index,
          verifiedText: (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ariaControls: b.getAttribute('aria-controls'),
          ariaExpanded: b.getAttribute('aria-expanded'),
          box: rect(b),
          textBox,
          computedColor: cs.color,
          computedBackgroundColor: cs.backgroundColor,
          computedBorderColor: cs.borderColor,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          fontFamily: cs.fontFamily.slice(0, 60),
        };
      }
    );
  });
}

/** Resolved token values + <html> classes: the mechanical theme fingerprint. */
async function themeFingerprint(page: Page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const read = (n: string) => cs.getPropertyValue(n).trim() || null;
    return {
      htmlClass: document.documentElement.className.trim(),
      tokens: {
        '--fs-accent-text': read('--fs-accent-text'),
        '--fs-accent': read('--fs-accent'),
        '--fs-ink': read('--fs-ink'),
        '--fs-bg': read('--fs-bg'),
        '--fs-surface': read('--fs-surface'),
        '--fs-surface-2': read('--fs-surface-2'),
        '--fs-muted': read('--fs-muted'),
      },
    };
  });
}

/** Tight crop around a rect, padded, with sampled pixel values recorded. */
async function cropRect(
  page: Page,
  rect: Rect,
  pad: number,
  name: string,
  meta: Record<string, unknown>
): Promise<void> {
  const sp = await scrollport(page);
  const clip = {
    x: Math.max(0, Math.round(rect.x - pad)),
    y: Math.max(0, Math.round(rect.y - pad)),
    width: Math.max(1, Math.round(rect.width + pad * 2)),
    height: Math.max(1, Math.round(rect.height + pad * 2)),
  };
  const insideScrollport =
    sp !== null && clip.y >= sp.y - 1 && clip.y + clip.height <= sp.y + sp.height + 1;
  if (!insideScrollport) {
    S23.push({ png: null, ...meta, clip, insideScrollport, error: 'rect outside the scrollport' });
    return;
  }
  const buf = await page.screenshot({ clip, animations: 'disabled' });
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const s = await sampleColors(buf);
  S23.push({
    png: `${name}.png`,
    ...meta,
    clip,
    insideScrollport: true,
    pngWidth: s.width,
    pngHeight: s.height,
    sampledBackground: s.bg,
    sampledForeground: s.fg,
    topColors: s.top,
  });
}

/** Bring a group heading to the top of the scrollport and frame it. */
async function frameGroup(
  page: Page,
  heading: string,
  name: string,
  meta: Record<string, unknown>
): Promise<boolean> {
  const h = page.locator('#main-content h2', { hasText: heading }).first();
  if (!(await h.count())) {
    S23.push({ png: null, ...meta, requestedHeading: heading, error: 'heading not in DOM' });
    return false;
  }
  await h.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(320);
  const info = await h.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      verifiedText: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      box: {
        x: Math.round(r.x * 10) / 10,
        y: Math.round(r.y * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      },
      color: getComputedStyle(el).color,
    };
  });
  const sp = await scrollport(page);
  const buf = await page.screenshot({
    clip: sp
      ? { x: sp.x, y: sp.y, width: sp.width, height: sp.height }
      : { x: 0, y: 0, width: 390, height: 800 },
    animations: 'disabled',
  });
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  const s = await sampleColors(buf);
  S23.push({
    png: `${name}.png`,
    ...meta,
    kind: 'group-frame',
    requestedHeading: heading,
    verifiedText: info.verifiedText,
    headingBox: info.box,
    headingComputedColor: info.color,
    scrollTopAtCapture: sp?.scrollTop ?? null,
    pngWidth: s.width,
    pngHeight: s.height,
    sampledBackground: s.bg,
    sampledForeground: s.fg,
    topColors: s.top,
  });
  return true;
}

// Serial: both s23 tests share the module-level S23 array and write ONE json,
// so they must run in the same worker.
test.describe('s23 capture', () => {
  test.describe.configure({ mode: 'serial' });

  // =========================================================================
  // 1) Settings, 4 theme states x 2 widths — full scroll stitch (the two unseen
  //    groups included), verified-text crops of both `מתקדם` triggers, and the
  //    same screen with both of them EXPANDED.
  // =========================================================================
  test('s23 — settings scroll-stitch, unseen groups, מתקדם crops + expanded', async ({ page }) => {
    test.setTimeout(1_500_000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`.slice(0, 300)));

    for (const vp of S23_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const combo of COMBOS) {
        // Fresh storage per combo: a persisted in-progress workout has hijacked
        // this capture before and photographed set logging instead.
        await seedGuest(page);
        await page.goto('/settings');
        await applyCombo(page, combo);
        await expect(page.getByRole('heading', { name: 'הגדרות' }).first()).toBeVisible();
        await page.waitForTimeout(500);

        const fp = await themeFingerprint(page);
        const base = { combo: combo.id, width: vp.width, viewport: `${vp.width}x${vp.height}` };
        S23.push({ kind: 'theme-fingerprint', ...base, ...fp, url: new URL(page.url()).pathname });

        // ── the whole screen, stitched ──────────────────────────────────────
        const collapsed = await stitchScrollport(page, `s23-settings-${combo.id}-${vp.tag}`, {
          ...base,
          surface: 'settings-collapsed',
          htmlClass: fp.htmlClass,
        });
        // The harness bug that ruined the last round: prove we got below 1500px.
        expect
          .soft(
            collapsed.hasContentBelowFold,
            `stitched capture must carry content below ${S23_FOLD}px (${combo.id} @ ${vp.tag})`
          )
          .toBe(true);

        // ── the two groups nobody has ever photographed ─────────────────────
        for (const heading of S23_UNSEEN_GROUPS) {
          await frameGroup(page, heading, `s23-group-${s23Slug(heading)}-${combo.id}-${vp.tag}`, {
            ...base,
            surface: 'unseen-group',
            htmlClass: fp.htmlClass,
          });
        }

        // ── every disclosure trigger, labelled from its VERIFIED text ───────
        const triggers = await readTriggers(page);
        S23.push({
          kind: 'trigger-inventory',
          ...base,
          htmlClass: fp.htmlClass,
          triggerCount: triggers.length,
          triggers,
        });
        const advanced = triggers.filter((t) => t.verifiedText === 'מתקדם');
        S23.push({
          kind: 'observation',
          ...base,
          note: 'count of triggers whose verified text is exactly מתקדם',
          value: advanced.length,
          allVerifiedTexts: triggers.map((t) => t.verifiedText),
        });

        // Tight crop of each מתקדם label so the glyph pixels dominate.
        for (const t of advanced) {
          const handle = page.locator('#main-content button[aria-expanded]').nth(t.index);
          await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.waitForTimeout(300);
          const after = (await readTriggers(page))[t.index];
          const label = `s23-label-${s23Slug(after.verifiedText)}-i${t.index}-${combo.id}-${vp.tag}`;
          await cropRect(page, after.textBox ?? after.box, 3, label, {
            ...base,
            surface: 'advanced-label-tight-crop',
            htmlClass: fp.htmlClass,
            verifiedText: after.verifiedText,
            triggerIndex: t.index,
            ariaControls: after.ariaControls,
            ariaExpanded: after.ariaExpanded,
            usedTextBox: after.textBox !== null,
            box: after.box,
            textBox: after.textBox,
            computedColor: after.computedColor,
            computedBackgroundColor: after.computedBackgroundColor,
            fontSize: after.fontSize,
            fontWeight: after.fontWeight,
          });
          // …and the full button row, for context.
          await cropRect(page, after.box, 2, `${label}-row`, {
            ...base,
            surface: 'advanced-row-crop',
            htmlClass: fp.htmlClass,
            verifiedText: after.verifiedText,
            triggerIndex: t.index,
          });
        }

        // ── now EXPAND both מתקדם triggers (verified by text) ───────────────
        for (const t of advanced) {
          const handle = page.locator('#main-content button[aria-expanded]').nth(t.index);
          const verified = (await handle.textContent())?.replace(/\s+/g, ' ').trim() ?? null;
          if (verified !== 'מתקדם') {
            S23.push({
              kind: 'observation',
              ...base,
              note: 'trigger index drifted before the expand click — skipped',
              triggerIndex: t.index,
              verifiedText: verified,
            });
            continue;
          }
          await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.waitForTimeout(200);
          await handle.click({ force: true }).catch(() => {});
          await page.waitForTimeout(450);
          S23.push({
            kind: 'expand-click',
            ...base,
            triggerIndex: t.index,
            verifiedText: verified,
            ariaExpandedAfterClick: await handle.getAttribute('aria-expanded'),
          });
        }

        const expandedTriggers = await readTriggers(page);
        const expandedAdvanced = expandedTriggers.filter((t) => t.verifiedText === 'מתקדם');
        S23.push({
          kind: 'trigger-inventory',
          ...base,
          phase: 'after-expand',
          htmlClass: fp.htmlClass,
          triggers: expandedTriggers,
        });
        expect
          .soft(
            expandedAdvanced.every((t) => t.ariaExpanded === 'true'),
            `both מתקדם disclosures must read expanded (${combo.id} @ ${vp.tag})`
          )
          .toBe(true);

        const expanded = await stitchScrollport(
          page,
          `s23-settings-expanded-${combo.id}-${vp.tag}`,
          { ...base, surface: 'settings-expanded', htmlClass: fp.htmlClass }
        );
        expect
          .soft(
            expanded.hasContentBelowFold,
            `expanded stitch must carry content below ${S23_FOLD}px (${combo.id} @ ${vp.tag})`
          )
          .toBe(true);

        // Tight crop of each מתקדם label while EXPANDED (same token, open state).
        for (const t of expandedAdvanced) {
          const handle = page.locator('#main-content button[aria-expanded]').nth(t.index);
          await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.waitForTimeout(280);
          const after = (await readTriggers(page))[t.index];
          await cropRect(
            page,
            after.textBox ?? after.box,
            3,
            `s23-label-${s23Slug(after.verifiedText)}-i${t.index}-open-${combo.id}-${vp.tag}`,
            {
              ...base,
              surface: 'advanced-label-tight-crop-expanded',
              htmlClass: fp.htmlClass,
              verifiedText: after.verifiedText,
              triggerIndex: t.index,
              ariaExpanded: after.ariaExpanded,
              computedColor: after.computedColor,
              computedBackgroundColor: after.computedBackgroundColor,
              box: after.box,
              textBox: after.textBox,
            }
          );
        }

        await flushS23(); // flush per combo so a later crash cannot lose data
      }
    }
    S23.push({ kind: 'console', pass: 'settings-capture', consoleErrors });
    await flushS23();
  });

  // =========================================================================
  // 2) THE 1280 ROUND TRIP — proven at 390 already, unverified at desktop width.
  //    Open a workout, turn HC ON inside the workout overlay, leave the workout,
  //    go to Settings, shoot; then toggle dark mode and shoot again. Both
  //    preferences must still read ON.
  // =========================================================================
  test('s23 — high-contrast round trip @ 1280', async ({ page }) => {
    test.setTimeout(900_000);
    const consoleErrors: string[] = [];
    const steps: Record<string, unknown>[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`.slice(0, 300)));

    const vpTag = '1280';
    await page.setViewportSize({ width: 1280, height: 800 });
    page.setDefaultTimeout(20_000);
    await seedGuest(page);
    await page.goto('/settings');
    await applyCombo(page, { id: 'light', dark: false, hc: false });

    const record = async (step: string, extra: Record<string, unknown> = {}) => {
      steps.push({
        step,
        url: new URL(page.url()).pathname,
        ...(await htmlState(page)),
        ...extra,
      });
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
      await tryClick(page.getByRole('button', { name: /התחילו בלי תבנית/ }), 'no-template', 2200);
      await tryClick(
        page.getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ }),
        'start',
        3000
      );
      if (await overflow.first().isVisible().catch(() => false)) break;
      const rows = page.locator('[role="listitem"]');
      if ((await rows.count()) > 1) {
        for (const idx of [0, 1]) await tryClick(rows.nth(idx), `pick:row${idx}`, 500);
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
    const reachedWorkout = await overflow
      .first()
      .isVisible()
      .catch(() => false);
    await record('01-in-workout', { flow, reachedWorkout });
    expect.soft(reachedWorkout, 'the live workout header must be reachable at 1280').toBe(true);
    await page.screenshot({ path: `${OUT}/s23-rt-${vpTag}-01-workout-hc-off.png` });

    // ── the in-workout settings overlay, מתקדם tab ─────────────────────────
    const settingsItem = page.getByRole('menuitem', { name: 'הגדרות' });
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt++) {
      await overflow
        .first()
        .click({ force: true })
        .catch(() => {});
      await page.waitForTimeout(600);
      if (await settingsItem.first().isVisible().catch(() => false)) {
        opened = true;
        break;
      }
      flow.push(`menu-attempt-${attempt}-failed`);
      await page.keyboard.press('Escape').catch(() => {});
      await tryClick(
        page.getByRole('button', { name: /דלגו? על חימום/ }),
        'skip-warmup-retry',
        3000
      );
      await tryClick(page.getByText('כללי', { exact: true }), 'goal-retry', 2000);
    }
    S23.push({ kind: 'observation', width: 1280, note: 'in-workout overflow menu opened', value: opened });
    expect.soft(opened, 'the in-workout overflow menu must open at 1280').toBe(true);
    if (!opened) {
      S23.push({ kind: 'roundtrip', width: 1280, steps, consoleErrors, aborted: 'menu never opened' });
      await flushS23();
      return;
    }
    await settingsItem.first().click({ force: true });
    await page.waitForTimeout(900);
    const overlayAdvancedTab = page.getByRole('button', { name: 'מתקדם', exact: true }).first();
    const overlayTabText = await overlayAdvancedTab.textContent().catch(() => null);
    await overlayAdvancedTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);

    const overlaySwitch = page.getByRole('switch', { name: /ניגודיות גבוהה/ }).first();
    await overlaySwitch.scrollIntoViewIfNeeded().catch(() => {});
    await record('02-overlay-open', {
      overlayAdvancedTabVerifiedText: overlayTabText?.trim() ?? null,
      overlayAriaChecked: await overlaySwitch.getAttribute('aria-checked').catch(() => null),
    });
    await page.screenshot({ path: `${OUT}/s23-rt-${vpTag}-02-overlay-advanced-before.png` });

    // ── toggle ניגודיות גבוהה ON inside the workout ────────────────────────
    await overlaySwitch.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await record('03-overlay-hc-toggled-on', {
      overlayAriaChecked: await overlaySwitch.getAttribute('aria-checked').catch(() => null),
    });
    await page.screenshot({ path: `${OUT}/s23-rt-${vpTag}-03-overlay-hc-on.png` });

    await page
      .getByRole('button', { name: 'סגור' })
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(900);
    await record('04-overlay-closed');
    await page.screenshot({ path: `${OUT}/s23-rt-${vpTag}-04-workout-hc-on.png` });

    // ── leave the workout (discard), then soft-navigate to Settings ─────────
    await overflow
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(400);
    await page
      .getByRole('menuitem', { name: 'בטל אימון' })
      .click({ force: true })
      .catch(() => {});
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
    await page.screenshot({ path: `${OUT}/s23-rt-${vpTag}-05-after-leaving-workout.png` });

    const gear = page.getByRole('link', { name: 'הגדרות' }).first();
    let navPath = 'gear-link';
    if (await gear.isVisible().catch(() => false)) {
      await gear.click({ force: true });
    } else {
      navPath = 'hard-goto (gear not reachable)';
      await page.goto('/settings');
    }
    await page.waitForTimeout(2000);
    await expect
      .soft(page.getByRole('heading', { name: 'הגדרות' }).first())
      .toBeVisible({ timeout: 15_000 });

    // ── does Settings READ high contrast as ON at 1280? ────────────────────
    const hcSwitch = page.getByRole('switch', { name: 'ניגודיות גבוהה' }).first();
    const darkSwitch = page.getByRole('switch', { name: 'מצב כהה' }).first();
    await hcSwitch.scrollIntoViewIfNeeded().catch(() => {});
    const hcOn = await hcSwitch.getAttribute('aria-checked').catch(() => null);
    await record('06-settings-after-workout', {
      navPath,
      settingsHcAriaChecked: hcOn,
      settingsDarkAriaChecked: await darkSwitch.getAttribute('aria-checked').catch(() => null),
    });
    await stitchScrollport(page, `s23-rt-${vpTag}-06-settings-hc-on`, {
      combo: 'light-hc',
      width: 1280,
      viewport: '1280x800',
      surface: 'settings-after-workout-hc',
      htmlClass: (await themeFingerprint(page)).htmlClass,
    });
    expect
      .soft(hcOn, 'Settings must READ the in-workout high-contrast change at 1280')
      .toBe('true');

    // ── now toggle dark mode: high contrast must survive ───────────────────
    await darkSwitch.scrollIntoViewIfNeeded().catch(() => {});
    await darkSwitch.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const hcAfterDark = await hcSwitch.getAttribute('aria-checked').catch(() => null);
    const darkAfter = await darkSwitch.getAttribute('aria-checked').catch(() => null);
    await record('07-after-dark-toggle', {
      settingsHcAriaChecked: hcAfterDark,
      settingsDarkAriaChecked: darkAfter,
    });
    const fpAfter = await themeFingerprint(page);
    await stitchScrollport(page, `s23-rt-${vpTag}-07-settings-dark-hc-still-on`, {
      combo: 'dark-hc',
      width: 1280,
      viewport: '1280x800',
      surface: 'settings-dark-plus-hc',
      htmlClass: fpAfter.htmlClass,
    });
    S23.push({ kind: 'theme-fingerprint', combo: 'dark-hc-roundtrip', width: 1280, ...fpAfter });
    expect.soft(hcAfterDark, 'high contrast survives the dark toggle at 1280').toBe('true');
    expect.soft(darkAfter, 'dark mode reads ON after the toggle at 1280').toBe('true');

    await page.reload();
    await page.waitForTimeout(2000);
    await record('08-after-reload');

    S23.push({ kind: 'roundtrip', width: 1280, steps, consoleErrors });
    await flushS23();
  });
});


// ===========================================================================
// s26 — CAPTURE-ONLY PASS. Three priority groups, no analysis in this file.
//
//   1. /settings in all four theme states at 390 AND 1280 (dark, dark+HC and
//      every state at 1280 had never been photographed).
//   2. Two just-changed controls, cropped, in all four theme states:
//      (a) the `מצב כהה` row's 32px IconBox chip;
//      (b) the `מעקב אנליטיקה ויציבות` switch in BOTH aria-checked states.
//   3. Five bottom sheets at 390 AND 1280 in light and dark. ModalOverlay's
//      bottomSheet content is `w-full max-w-lg` (512px) — the dialog rect is
//      recorded so the width change at 1280 is evidenced numerically.
//
// Frames are ONE `locator.screenshot()` call each — no scroll-and-stitch.
// Every crop is named from text/aria read out of the live DOM, and the raw
// pixel samples are stored as arrays. Nothing is aggregated into a single
// 'foreground' or 'inkOnFill' field: that has previously invented and
// concealed defects.
// ===========================================================================

const S26: Record<string, unknown>[] = [];

type S26Sample = { hex: string; rgb: Rgb; count: number; share: number };

/** Raw pixel census of a PNG buffer. No bg/fg pick, no contrast maths. */
async function s26Samples(
  buf: Buffer
): Promise<{ pngWidth: number; pngHeight: number; pixelSamples: S26Sample[]; distinctColors: number }> {
  const sharpMod = (await import('sharp')).default;
  const { data, info } = await sharpMod(buf).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const total = info.width * info.height;
  const counts = new Map<string, number>();
  for (let i = 0; i + ch - 1 < data.length; i += ch) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const pixelSamples: S26Sample[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([key, n]) => {
      const [r, g, b] = key.split(',').map(Number);
      const rgb: Rgb = [r ?? 0, g ?? 0, b ?? 0];
      return { hex: toHex(rgb), rgb, count: n, share: Math.round((n / total) * 100000) / 100000 };
    });
  return { pngWidth: info.width, pngHeight: info.height, pixelSamples, distinctColors: counts.size };
}

async function flushS26(): Promise<void> {
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    `${OUT}/s26-measure.json`,
    JSON.stringify(
      {
        meta: {
          spec: 'e2e/settings-s20.spec.ts (s26 capture pass)',
          capturedAt: new Date().toISOString(),
          bundle: 'npm run build ran immediately before this pass; served by npm run preview',
          scrollContainer: '#main-content',
          captureMethod:
            'ONE locator.screenshot() per frame. mainClientHeight/mainScrollHeight/pngHeight are all recorded so the reader can see for themselves whether a frame covered the whole scrollport.',
          themeStates:
            'html.dark = dark. html.high-contrast STACKS on dark (both classes = dark+HC). Applied through the product appSettings record, then re-read off <html>.',
          isolation:
            'localStorage + sessionStorage cleared and every IndexedDB database deleted before each combo, so a persisted in-progress workout cannot hijack a frame.',
          colorSampling:
            'pixelSamples is the RAW pixel census of each PNG: top 14 colours by count, with count and share. Deliberately NOT reduced to a foreground/background pair and NO contrast ratio is computed here.',
          labelling:
            'every crop records verifiedText / verifiedAriaLabel / verifiedAriaChecked read out of the live DOM at capture time; the filename is derived from those.',
          note: 'raw measurements only — no analysis, no verdicts, no recommendations',
        },
        records: S26,
      },
      null,
      2
    ),
    'utf8'
  );
}

/** Raw geometry + raw resolved colour strings for one element. */
async function s26Facts(page: Page, selector: string): Promise<Record<string, unknown> | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el) as unknown as Record<string, string>;
    const props = [
      'color',
      'backgroundColor',
      'backgroundImage',
      'borderTopColor',
      'borderBottomColor',
      'borderInlineStartColor',
      'borderInlineEndColor',
      'outlineColor',
      'boxShadow',
      'fill',
      'stroke',
      'opacity',
      'borderRadius',
      'width',
      'height',
      'minHeight',
      'fontSize',
      'fontWeight',
      'direction',
    ];
    const computed: Record<string, string> = {};
    for (const p of props) computed[p] = cs[p] ?? null;
    const svg = el.querySelector('svg');
    const svgCs = svg ? (getComputedStyle(svg) as unknown as Record<string, string>) : null;
    const knob = el.querySelector('span, div');
    const knobCs = knob ? (getComputedStyle(knob) as unknown as Record<string, string>) : null;
    return {
      selector: sel,
      rect: {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
      },
      computed,
      svgComputed: svgCs
        ? {
            color: svgCs.color,
            stroke: svgCs.stroke,
            fill: svgCs.fill,
            width: svgCs.width,
            height: svgCs.height,
            strokeWidth: svgCs.strokeWidth,
          }
        : null,
      firstChildComputed: knobCs
        ? {
            tag: (knob as HTMLElement).tagName,
            backgroundColor: knobCs.backgroundColor,
            color: knobCs.color,
            width: knobCs.width,
            height: knobCs.height,
            borderRadius: knobCs.borderRadius,
            transform: knobCs.transform,
            boxShadow: knobCs.boxShadow,
          }
        : null,
      verifiedText: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      verifiedAriaLabel: el.getAttribute('aria-label'),
      verifiedAriaChecked: el.getAttribute('aria-checked'),
      className: typeof el.className === 'string' ? el.className : null,
    };
  }, selector);
}

/** Scrollport geometry, so the reader can judge frame completeness themselves. */
async function s26Main(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('#main-content') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      overflowY: cs.overflowY,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}

/** ONE element screenshot. Never scroll-and-stitch. */
async function s26Shoot(
  page: Page,
  locator: Locator,
  name: string,
  meta: Record<string, unknown>
): Promise<boolean> {
  const el = locator.first();
  if (!(await el.count())) {
    S26.push({ png: null, name, ...meta, error: 'locator matched nothing' });
    return false;
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  let buf: Buffer;
  try {
    buf = await el.screenshot({ path: `${OUT}/${name}.png`, timeout: 25_000 });
  } catch (e) {
    S26.push({ png: null, name, ...meta, error: `screenshot failed: ${String(e).slice(0, 200)}` });
    return false;
  }
  S26.push({ png: `${name}.png`, name, ...meta, ...(await s26Samples(buf)) });
  return true;
}

/** A brand-new browser context per combo — the ONLY reliable isolation here.
 *
 *  The in-page wipe used by earlier rounds (`indexedDB.deleteDatabase` inside
 *  page.evaluate) hangs forever from the second call onwards: the registered
 *  PWA service worker keeps a connection open, so neither `onsuccess` nor
 *  `onblocked` settles and the single evaluate eats the whole test timeout.
 *  A fresh context starts with empty localStorage AND empty IndexedDB by
 *  construction, and `serviceWorkers: 'block'` keeps the SW from re-opening
 *  either — so a persisted in-progress workout cannot hijack a frame.
 *
 *  The theme state is written by an init script BEFORE the app boots, so no
 *  reload is needed and the very first paint is already in the right state. */
async function s26Open(
  browser: import('@playwright/test').Browser,
  vp: { width: number; height: number },
  combo: { id: string; dark: boolean; hc: boolean },
  path: string
) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    baseURL: 'http://localhost:4173',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    serviceWorkers: 'block',
  });
  await context.addInitScript(
    ({ dark, hc }) => {
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
      localStorage.setItem(
        'appSettings',
        JSON.stringify({ darkMode: dark, workoutSettings: { highContrast: hc } })
      );
    },
    { dark: combo.dark, hc: combo.hc }
  );
  const page = await context.newPage();
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(600);
  return { context, page };
}

/** Open every `מתקדם` expander so nothing stays hidden behind one. */
async function s26ExpandAdvanced(page: Page): Promise<number> {
  const triggers = page.getByRole('button', { name: /מתקדם/ });
  const n = await triggers.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    await triggers
      .nth(i)
      .click({ force: true, timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(400);
  return n;
}

/** Tag the `מצב כהה` row and its 32px IconBox chip, verifying the row text. */
async function s26TagDarkChip(page: Page) {
  return page.evaluate(() => {
    for (const n of Array.from(document.querySelectorAll('[data-s26]')))
      n.removeAttribute('data-s26');
    const sw = document.querySelector('[role="switch"][aria-label="מצב כהה"]');
    if (!sw) return { ok: false, reason: 'no מצב כהה switch', rowText: null, chipClass: null };
    let node = sw.parentElement as HTMLElement | null;
    for (let i = 0; i < 10 && node; i++) {
      const chip = node.querySelector('div.w-8.h-8') as HTMLElement | null;
      if (chip) {
        chip.setAttribute('data-s26', 'dark-chip');
        node.setAttribute('data-s26', 'dark-row');
        return {
          ok: true,
          reason: null,
          rowText: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
          chipClass: chip.className,
        };
      }
      node = node.parentElement;
    }
    return { ok: false, reason: 'no 32px IconBox above the switch', rowText: null, chipClass: null };
  });
}

// ── GROUP 1: the /settings screen, four theme states x 390 and 1280 ────────

for (const vp of VIEWPORTS) {
  test(`s26 g1 — settings screen, 4 theme states @ ${vp.tag}`, async ({ browser }) => {
    test.setTimeout(240_000);

    for (const combo of COMBOS) {
      const { context, page } = await s26Open(browser, vp, combo, '/settings');
      try {
        const fp = await themeFingerprint(page);
        const main = await s26Main(page);
        const base = {
          group: 'g1-settings-screen',
          combo: combo.id,
          viewport: vp.tag,
          width: vp.width,
        };

        await s26Shoot(page, page.locator('#main-content'), `s26-settings-${combo.id}-${vp.tag}`, {
          ...base,
          state: 'advanced-collapsed',
          htmlClass: fp.htmlClass,
          tokens: fp.tokens,
          htmlState: await htmlState(page),
          mainContent: main,
        });

        const expanders = await s26ExpandAdvanced(page);
        await s26Shoot(
          page,
          page.locator('#main-content'),
          `s26-settings-expanded-${combo.id}-${vp.tag}`,
          {
            ...base,
            state: 'advanced-expanded',
            advancedTriggersClicked: expanders,
            htmlClass: (await themeFingerprint(page)).htmlClass,
            mainContent: await s26Main(page),
          }
        );
      } finally {
        await context.close();
        await flushS26();
      }
    }
  });
}

// ── GROUP 2: the two just-changed controls, cropped, all four states ───────

for (const vp of VIEWPORTS) {
  test(`s26 g2 — dark-mode icon chip + analytics switch @ ${vp.tag}`, async ({ browser }) => {
    test.setTimeout(300_000);

    for (const combo of COMBOS) {
      const { context, page } = await s26Open(browser, vp, combo, '/settings');
      try {
        await s26ExpandAdvanced(page);
      const fp = await themeFingerprint(page);
      const base = {
        group: 'g2-controls',
        combo: combo.id,
        viewport: vp.tag,
        width: vp.width,
        htmlClass: fp.htmlClass,
        tokens: fp.tokens,
      };

      // (a) the `מצב כהה` row's 32px IconBox chip — component just changed.
      const tag = await s26TagDarkChip(page);
      S26.push({ kind: 'tag-dark-chip', ...base, ...tag });
      if (tag.ok) {
        await s26Shoot(
          page,
          page.locator('[data-s26="dark-chip"]'),
          `s26-chip-darkmode-${combo.id}-${vp.tag}`,
          {
            ...base,
            control: 'IconBox chip on the מצב כהה row',
            verifiedRowText: tag.rowText,
            chipClass: tag.chipClass,
            facts: await s26Facts(page, '[data-s26="dark-chip"]'),
          }
        );
        await s26Shoot(
          page,
          page.locator('[data-s26="dark-row"]'),
          `s26-row-darkmode-${combo.id}-${vp.tag}`,
          {
            ...base,
            control: 'whole מצב כהה row (chip in context)',
            verifiedRowText: tag.rowText,
            facts: await s26Facts(page, '[data-s26="dark-row"]'),
          }
        );
      }

      // (b) the analytics switch — new component, knob colours inverted.
      //     Photograph BOTH aria-checked states, named from the read value.
      const sel = '[role="switch"][aria-label="מעקב אנליטיקה ויציבות"]';
      const sw = page.locator(sel);
      if (await sw.count()) {
        for (const pass of ['as-found', 'after-toggle'] as const) {
          if (pass === 'after-toggle') {
            await sw.first().scrollIntoViewIfNeeded().catch(() => {});
            await sw
              .first()
              .click({ force: true, timeout: 5000 })
              .catch(() => {});
            await page.waitForTimeout(700);
          }
          const checked = await sw.first().getAttribute('aria-checked').catch(() => null);
          const stateTag = checked === 'true' ? 'on' : checked === 'false' ? 'off' : 'unknown';
          await s26Shoot(page, sw, `s26-switch-analytics-${stateTag}-${combo.id}-${vp.tag}`, {
            ...base,
            control: 'מעקב אנליטיקה ויציבות switch',
            pass,
            verifiedAriaChecked: checked,
            stateTag,
            facts: await s26Facts(page, sel),
          });
        }
      } else {
        S26.push({ kind: 'missing', ...base, control: 'analytics switch', error: 'not in DOM' });
      }
      } finally {
        await context.close();
        await flushS26();
      }
    }
  });
}

// ── GROUP 3: five bottom sheets, 390 and 1280, light and dark ─────────────
//
// At 1280 the bottomSheet content is `w-full max-w-lg` (512px) and centred
// where it used to be full-bleed; the dialog rect makes that measurable.

/** Drive a fresh guest into a live workout. Returns the flow actually taken. */
async function s26EnterWorkout(page: Page): Promise<{ reached: boolean; flow: string[] }> {
  const flow: string[] = [];
  const overflow = page.getByRole('button', { name: 'עוד פעולות' });
  const tryClick = async (loc: Locator, tag: string, waitMs = 2500) => {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc
        .first()
        .click({ force: true, timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(waitMs);
      flow.push(tag);
    }
  };
  await page.goto('/workout');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) {
    if (await overflow.first().isVisible().catch(() => false)) break;
    await tryClick(page.getByRole('button', { name: /התחילו בלי תבנית/ }), 'no-template', 2200);
    await tryClick(
      page.getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ }),
      'start',
      3000
    );
    if (await overflow.first().isVisible().catch(() => false)) break;
    const rows = page.locator('[role="listitem"]');
    if ((await rows.count()) > 1) {
      for (const idx of [0, 1]) await tryClick(rows.nth(idx), `pick:row${idx}`, 500);
    }
    await tryClick(
      page.getByRole('button', { name: /הוסיפו לאימון|התחל עם|התחל \(/ }),
      'confirm',
      2800
    );
    await tryClick(page.getByText('כללי', { exact: true }), 'goal');
    await tryClick(page.getByRole('button', { name: /דלגו? על חימום/ }), 'skip-warmup', 3000);
  }
  const reached = await overflow
    .first()
    .isVisible()
    .catch(() => false);
  flow.push(`url=${new URL(page.url()).pathname}`);
  return { reached, flow };
}

for (const vp of VIEWPORTS) {
  test(`s26 g3 — five bottom sheets, light + dark @ ${vp.tag}`, async ({ browser }) => {
    test.setTimeout(600_000);

    for (const combo of COMBOS.filter((c) => !c.hc)) {
      const { context, page } = await s26Open(browser, vp, combo, '/');
      try {
      const entry = await s26EnterWorkout(page);
      const fp = await themeFingerprint(page);
      const base = {
        group: 'g3-bottom-sheets',
        combo: combo.id,
        viewport: vp.tag,
        width: vp.width,
        htmlClass: fp.htmlClass,
        tokens: fp.tokens,
      };
      S26.push({ kind: 'workout-entry', ...base, ...entry });
      await flushS26();
      if (!entry.reached) continue;

      await s26Shoot(page, page.locator('#main-content'), `s26-workout-live-${combo.id}-${vp.tag}`, {
        ...base,
        surface: 'live workout, before any sheet',
        mainContent: await s26Main(page),
      });

      // Trigger table. `menu` triggers go through the overflow menu first.
      const SHEETS: {
        slug: string;
        via: 'direct' | 'menu';
        trigger: RegExp | string;
        expect: string;
      }[] = [
        { slug: 'numpad', via: 'direct', trigger: /הקש לעריכה/, expect: 'מקלדת מספרים' },
        { slug: 'reorder', via: 'direct', trigger: 'רשימת תרגילים', expect: 'סדר תרגילים' },
        { slug: 'tools', via: 'direct', trigger: 'כלים נוספים לתרגיל', expect: 'כלים' },
        { slug: 'add-exercise', via: 'direct', trigger: 'הוסף תרגיל', expect: '' },
        { slug: 'workout-settings', via: 'menu', trigger: 'הגדרות', expect: '' },
        { slug: 'tutorial', via: 'menu', trigger: 'מדריך', expect: '' },
      ];

      for (const s of SHEETS) {
        // Make sure no sheet is already up.
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(600);

        let clicked = false;
        if (s.via === 'menu') {
          const of = page.getByRole('button', { name: 'עוד פעולות' }).first();
          if (await of.isVisible().catch(() => false)) {
            await of.click({ force: true }).catch(() => {});
            await page.waitForTimeout(700);
            const item = page.getByRole('menuitem', { name: s.trigger as string }).first();
            if (await item.isVisible().catch(() => false)) {
              await item.click({ force: true }).catch(() => {});
              clicked = true;
            }
          }
        } else {
          const t = page.getByRole('button', { name: s.trigger }).first();
          if (await t.isVisible().catch(() => false)) {
            await t.click({ force: true }).catch(() => {});
            clicked = true;
          }
        }
        await page.waitForTimeout(1500);

        const dialog = page.locator('[role="dialog"]');
        const count = await dialog.count().catch(() => 0);
        if (!clicked || count === 0) {
          S26.push({
            kind: 'sheet-miss',
            ...base,
            sheet: s.slug,
            clicked,
            dialogCount: count,
            error: clicked ? 'no [role="dialog"] appeared' : 'trigger not visible',
          });
          continue;
        }

        // Label from what the DOM actually says, not from what we hoped for.
        const verified = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
          if (!d) return null;
          const labelledBy = d.getAttribute('aria-labelledby');
          const titleEl = labelledBy ? document.getElementById(labelledBy) : null;
          return {
            ariaLabel: d.getAttribute('aria-label'),
            ariaLabelledByText: titleEl ? (titleEl.textContent ?? '').trim() : null,
            headingText: (d.querySelector('h1,h2,h3') as HTMLElement | null)?.textContent?.trim() ?? null,
            firstText: (d.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
          };
        });
        const name = `s26-sheet-${s.slug}-${combo.id}-${vp.tag}`;
        await s26Shoot(page, dialog, name, {
          ...base,
          sheet: s.slug,
          expectedLabel: s.expect || null,
          verified,
          labelMatchesExpectation: s.expect
            ? verified?.ariaLabel === s.expect || verified?.ariaLabelledByText === s.expect
            : null,
          facts: await s26Facts(page, '[role="dialog"]'),
          windowInnerWidth: await page.evaluate(() => window.innerWidth),
        });
        await flushS26();
      }
      } finally {
        await context.close();
        await flushS26();
      }
    }
  });
}

test.afterAll(async () => {
  await flushS26();
});
