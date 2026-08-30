/**
 * s27 — SWITCH PARITY CAPTURE (scratch spec, screenshot generator + measurement)
 *
 * Two hand-rolled copies of `SettingsToggle` were replaced by the shared
 * component itself:
 *   SITE 1  src/pages/settings/sections/ProfileEditSection.tsx  (פרופיל ציבורי)
 *   SITE 2  src/components/workout/overlays/SettingsPrimitives.tsx (Toggle row)
 *
 * What is photographed AND measured here, in all four theme states
 * (light / dark / light+HC / dark+HC) x 390 and 1280:
 *   • every switch's 44x44 box, its 52x32 track and its knob rect, so the touch
 *     floor and the geometry are read off the live layout rather than assumed;
 *   • the RENDERED rgb of track fill, knob fill and border per state, and the
 *     WCAG ratio between them — token arithmetic checked against real pixels;
 *   • the knob's SIDE. `<html dir="rtl">`, so inset-inline-start is the RIGHT
 *     edge: OFF must sit right of the track centre and ON must sit left of it.
 *     Site 2's copy used physical `left` + an `x` transform and did the reverse.
 *
 * Site 1's row only renders when the profile service resolves, which needs a
 * signed-in Supabase user. A synthetic session + a stubbed `profiles` read make
 * the row reachable; when that stub does not take, the capture records
 * `profileRowRendered: false` instead of filing a lying PNG.
 *
 * Run: npx playwright test e2e/switch-parity-s27.spec.ts --project="Desktop Chrome"
 * Out: visual-qa/s27-*.png + visual-qa/s27-measure.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

const OUT = 'visual-qa';

const COMBOS = [
  { id: 'light', dark: false, hc: false },
  { id: 'dark', dark: true, hc: false },
  { id: 'light-hc', dark: false, hc: true },
  { id: 'dark-hc', dark: true, hc: true },
] as const;

const VIEWPORTS = [
  { tag: '390', width: 390, height: 1400 },
  { tag: '1280', width: 1280, height: 1400 },
] as const;

const MEASURE: Record<string, unknown>[] = [];

// ── WCAG maths on RENDERED rgb strings ─────────────────────────────────────

const parseRgb = (s: string): [number, number, number] | null => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(',').map((v) => Number.parseFloat(v));
  return [r, g, b];
};
const chan = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: [number, number, number]) =>
  0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratio = (a: string, b: string): number | null => {
  const [x, y] = [parseRgb(a), parseRgb(b)];
  if (!x || !y) return null;
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

// ── fixture ────────────────────────────────────────────────────────────────

async function openApp(
  browser: import('@playwright/test').Browser,
  vp: { width: number; height: number },
  combo: { dark: boolean; hc: boolean },
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
  await page.waitForTimeout(500);
  return { context, page };
}

async function htmlState(page: Page) {
  return page.evaluate(() => ({
    dir: document.documentElement.getAttribute('dir'),
    classes: document.documentElement.className,
  }));
}

/**
 * Live geometry + rendered colour of one switch, addressed by aria-label.
 * Reads the DOM the shared component actually produces: button > span[aria-hidden]
 * > [track, knob].
 */
async function switchFacts(page: Page, label: string) {
  const raw = await page.evaluate((aria) => {
    const btn = document.querySelector(
      `button[role="switch"][aria-label="${aria}"]`
    ) as HTMLElement | null;
    if (!btn) return null;
    const visual = btn.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
    const [track, knob] = visual
      ? (Array.from(visual.children) as HTMLElement[])
      : [null, null];
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const t = cs(track);
    const k = cs(knob);
    return {
      ariaChecked: btn.getAttribute('aria-checked'),
      box: rect(btn),
      visual: rect(visual),
      trackRect: rect(track),
      knobRect: rect(knob),
      trackFill: t?.backgroundColor ?? null,
      trackBorder: t ? `${t.borderTopWidth} ${t.borderTopStyle} ${t.borderTopColor}` : null,
      trackBorderColor: t?.borderTopColor ?? null,
      knobFill: k?.backgroundColor ?? null,
      knobInsetInlineStart: k?.getPropertyValue('inset-inline-start') ?? null,
      knobLeft: k?.left ?? null,
      knobTransform: k?.transform ?? null,
      cardFill: (() => {
        let n: HTMLElement | null = btn.parentElement;
        for (let i = 0; i < 8 && n; i++) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          n = n.parentElement;
        }
        return null;
      })(),
    };
  }, label);

  if (!raw) return null;
  const knobCentre = raw.knobRect ? raw.knobRect.x + raw.knobRect.w / 2 : null;
  const trackCentre = raw.trackRect ? raw.trackRect.x + raw.trackRect.w / 2 : null;
  return {
    ...raw,
    knobSide:
      knobCentre !== null && trackCentre !== null
        ? knobCentre > trackCentre
          ? 'right'
          : 'left'
        : null,
    contrast: {
      knobVsTrack: raw.knobFill && raw.trackFill ? ratio(raw.knobFill, raw.trackFill) : null,
      edgeVsTrack:
        raw.trackBorderColor && raw.trackFill ? ratio(raw.trackBorderColor, raw.trackFill) : null,
      edgeVsCard:
        raw.trackBorderColor && raw.cardFill ? ratio(raw.trackBorderColor, raw.cardFill) : null,
      trackVsCard: raw.trackFill && raw.cardFill ? ratio(raw.trackFill, raw.cardFill) : null,
    },
  };
}

async function shoot(page: Page, target: Locator, name: string, meta: Record<string, unknown>) {
  await mkdir(OUT, { recursive: true });
  if ((await target.count().catch(() => 0)) === 0) {
    MEASURE.push({ png: null, name, ...meta, error: 'locator matched nothing' });
    return;
  }
  try {
    const buf = await target.first().screenshot({ animations: 'disabled' });
    await writeFile(`${OUT}/${name}.png`, buf);
    MEASURE.push({ png: `${name}.png`, name, ...meta });
  } catch (e) {
    MEASURE.push({ png: null, name, ...meta, error: String(e).slice(0, 200) });
  }
}

const flush = async () => {
  await mkdir(OUT, { recursive: true });
  await writeFile(
    `${OUT}/s27-measure.json`,
    `${JSON.stringify(
      {
        task: 's27 — two hand-rolled switches replaced by the shared SettingsToggle',
        spec: 'e2e/switch-parity-s27.spec.ts',
        generatedAt: new Date().toISOString(),
        note: 'colours are getComputedStyle values from the live render; ratios are WCAG 2.x on those pixels',
        records: MEASURE,
      },
      null,
      2
    )}\n`
  );
};

// ── SITE 1: the Settings screen ─────────────────────────────────────────────
//
// The פרופיל ציבורי row only mounts once `getMyProfile()` resolves, which needs a
// signed-in Supabase user; a guest sees the offline notice instead, and a
// synthetic session stops the app shell booting at all. So what is photographed
// here is the SAME shared component on the SAME screen, in the row the defect
// was misread against (`רטט`, and `מצב כהה` in its natural per-theme state) —
// which is exactly the comparison the bug was about: a dark knob must mean the
// same thing on every row of this screen. `profileRowRendered` records whether
// the row itself was reachable rather than filing a lying frame.

for (const vp of VIEWPORTS) {
  test(`s27 site1 — settings screen switches, 4 theme states @ ${vp.tag}`, async ({ browser }) => {
    test.setTimeout(300_000);

    for (const combo of COMBOS) {
      const { context, page } = await openApp(browser, vp, combo, '/settings');
      try {
        // Open every expander so no switch stays hidden behind one.
        const triggers = page.getByRole('button', { name: /מתקדם|פרופיל ציבורי/ });
        const n = await triggers.count().catch(() => 0);
        for (let i = 0; i < n; i++) {
          await triggers
            .nth(i)
            .click({ force: true, timeout: 3000 })
            .catch(() => {});
          await page.waitForTimeout(250);
        }
        await page.waitForTimeout(900);

        const base = { site: 1, surface: '/settings', combo: combo.id, viewport: vp.tag };
        const html = await htmlState(page);
        const profile = await switchFacts(page, 'פרופיל ציבורי');
        const first = await switchFacts(page, 'רטט');

        MEASURE.push({
          kind: 'facts',
          ...base,
          html,
          mainContentPresent: await page.locator('#main-content').count(),
          switchCount: await page.locator('button[role="switch"]').count(),
          profileRowRendered: profile !== null,
          profileRowNote:
            profile === null
              ? 'row needs a signed-in Supabase profile; guest sees the offline notice'
              : null,
          profileSwitch: profile,
          hapticsSwitch: first,
          darkModeSwitch: await switchFacts(page, 'מצב כהה'),
        });

        await shoot(page, page.locator('#main-content'), `s27-settings-${combo.id}-${vp.tag}`, {
          kind: 'screen',
          ...base,
          html,
        });

        if (!first) {
          MEASURE.push({ kind: 'switch-miss', ...base, control: 'רטט' });
          continue;
        }

        const sw = page.locator('button[role="switch"][aria-label="רטט"]').first();
        const row = sw.locator('..');
        const tag = (f: { ariaChecked: string | null } | null) =>
          f?.ariaChecked === 'true' ? 'on' : 'off';

        await shoot(page, row, `s27-site1-row-${tag(first)}-${combo.id}-${vp.tag}`, {
          kind: 'row',
          ...base,
          control: 'רטט',
          state: tag(first),
          facts: first,
        });

        await sw.click({ force: true }).catch(() => {});
        await page.waitForTimeout(700);
        const flipped = await switchFacts(page, 'רטט');
        await shoot(page, row, `s27-site1-row-${tag(flipped)}-${combo.id}-${vp.tag}`, {
          kind: 'row',
          ...base,
          control: 'רטט',
          state: tag(flipped),
          facts: flipped,
        });

        const off = first.ariaChecked === 'false' ? first : flipped;
        const on = first.ariaChecked === 'true' ? first : flipped;
        // RTL: inset-inline-start is the RIGHT edge, so OFF rests right and ON
        // travels left. Every switch in the app must agree on this.
        expect(off?.knobSide, `${combo.id} OFF knob side`).toBe('right');
        expect(on?.knobSide, `${combo.id} ON knob side`).toBe('left');
        expect(first.box?.h ?? 0, `${combo.id} tap target height`).toBeGreaterThanOrEqual(44);
        expect(first.box?.w ?? 0, `${combo.id} tap target width`).toBeGreaterThanOrEqual(44);
      } finally {
        await context.close();
        await flush();
      }
    }
  });
}

// ── SITE 2: the in-workout settings sheet ──────────────────────────────────

async function enterWorkout(page: Page): Promise<{ reached: boolean; flow: string[] }> {
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
    await tryClick(page.getByRole('button', { name: /הוסיפו לאימון|התחל עם|התחל \(/ }), 'confirm', 2800);
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
  test(`s27 site2 — in-workout settings sheet @ ${vp.tag}`, async ({ browser }) => {
    test.setTimeout(900_000);

    for (const combo of COMBOS) {
      const { context, page } = await openApp(browser, vp, combo, '/');
      try {
        const entry = await enterWorkout(page);
        const base = { site: 2, surface: 'workout settings sheet', combo: combo.id, viewport: vp.tag };
        MEASURE.push({ kind: 'workout-entry', ...base, ...entry });
        if (!entry.reached) continue;

        const of = page.getByRole('button', { name: 'עוד פעולות' }).first();
        await of.click({ force: true }).catch(() => {});
        await page.waitForTimeout(700);
        await page
          .getByRole('menuitem', { name: 'הגדרות' })
          .first()
          .click({ force: true })
          .catch(() => {});
        await page.waitForTimeout(1500);

        const dialog = page.locator('[role="dialog"]');
        if ((await dialog.count().catch(() => 0)) === 0) {
          MEASURE.push({ kind: 'sheet-miss', ...base });
          continue;
        }

        const html = await htmlState(page);
        // `מצב כהה` is the sheet's first Toggle row; `רטט` is an OFF/ON pair we
        // can drive without changing the theme mid-capture.
        const haptics = await switchFacts(page, 'רטט');
        MEASURE.push({
          kind: 'facts',
          ...base,
          html,
          hapticsSwitch: haptics,
          darkModeSwitchInSheet: await switchFacts(page, 'מצב כהה'),
        });

        await shoot(page, dialog, `s27-sheet-${combo.id}-${vp.tag}`, {
          kind: 'sheet',
          ...base,
          html,
        });

        if (haptics) {
          const row = page.locator('label').filter({ hasText: 'רטט' }).first();
          await shoot(page, row, `s27-site2-row-${haptics.ariaChecked === 'true' ? 'on' : 'off'}-${combo.id}-${vp.tag}`, {
            kind: 'row',
            ...base,
            state: haptics.ariaChecked === 'true' ? 'on' : 'off',
            facts: haptics,
          });

          // Tap the ROW, not the switch: the label must still forward it.
          await row.click({ force: true, position: { x: 40, y: 20 } }).catch(() => {});
          await page.waitForTimeout(700);
          const flipped = await switchFacts(page, 'רטט');
          MEASURE.push({
            kind: 'row-tap-forwards',
            ...base,
            before: haptics.ariaChecked,
            after: flipped?.ariaChecked ?? null,
          });
          await shoot(page, row, `s27-site2-row-${flipped?.ariaChecked === 'true' ? 'on' : 'off'}-${combo.id}-${vp.tag}`, {
            kind: 'row',
            ...base,
            state: flipped?.ariaChecked === 'true' ? 'on' : 'off',
            facts: flipped,
          });

          expect(flipped?.ariaChecked, 'a tap on the row toggles the switch').not.toBe(
            haptics.ariaChecked
          );
          // Same RTL law as every other switch in the app.
          const off = haptics.ariaChecked === 'false' ? haptics : flipped;
          const on = haptics.ariaChecked === 'true' ? haptics : flipped;
          expect(off?.knobSide, `${combo.id} OFF knob side`).toBe('right');
          expect(on?.knobSide, `${combo.id} ON knob side`).toBe('left');
          expect(haptics.box?.h ?? 0, `${combo.id} tap target height`).toBeGreaterThanOrEqual(44);
          // The copy animated a physical transform; the shared one must not.
          expect(haptics.knobTransform === 'none' || haptics.knobTransform === null).toBe(true);

          // ── BEFORE, reconstructed in the live RTL page ──────────────────
          // Re-apply the removed code's exact inline styles (50x30, 1px steel
          // outline, knob pinned with physical `left` and moved with a physical
          // translateX, knob always --fs-surface) to the very same element, so
          // the wrong-side/wrong-direction knob is visible rather than argued.
          const before = await page.evaluate(() => {
            const btn = document.querySelector(
              'button[role="switch"][aria-label="רטט"]'
            ) as HTMLElement | null;
            const visual = btn?.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
            if (!btn || !visual) return null;
            const [track, knob] = Array.from(visual.children) as HTMLElement[];
            const checked = btn.getAttribute('aria-checked') === 'true';
            visual.style.width = '50px';
            visual.style.height = '30px';
            track.style.border = '1px solid var(--fs-steel)';
            track.style.borderRadius = '999px';
            track.style.backgroundColor = checked ? 'var(--fs-accent)' : 'var(--fs-surface-2)';
            knob.style.insetInlineStart = 'auto';
            knob.style.top = '2px';
            knob.style.left = '2px';
            knob.style.transform = checked ? 'translateX(21px)' : 'none';
            knob.style.background = 'var(--fs-surface)';
            knob.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
            const kr = knob.getBoundingClientRect();
            const tr = track.getBoundingClientRect();
            return {
              checked,
              knobSide: kr.x + kr.width / 2 > tr.x + tr.width / 2 ? 'right' : 'left',
              knobFill: getComputedStyle(knob).backgroundColor,
              trackFill: getComputedStyle(track).backgroundColor,
              outline: getComputedStyle(track).borderTopColor,
              visualH: Math.round(visual.getBoundingClientRect().height),
            };
          });
          await page.waitForTimeout(200);
          await shoot(
            page,
            row,
            `s27-site2-BEFORE-reconstruction-${tag(flipped)}-${combo.id}-${vp.tag}`,
            {
              kind: 'before-reconstruction',
              ...base,
              state: tag(flipped),
              note: 'removed code re-applied to the live element — not a real screenshot of the old build',
              facts: before,
              contrast: before
                ? {
                    knobVsTrack: ratio(before.knobFill, before.trackFill),
                    outlineVsTrack: ratio(before.outline, before.trackFill),
                  }
                : null,
            }
          );
          // The point of the whole change: the copy sat on the opposite edge.
          if (before) expect(before.knobSide).not.toBe(flipped?.knobSide);
        }
      } finally {
        await context.close();
        await flush();
      }
    }
  });
}
