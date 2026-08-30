/**
 * T-099 — USE THE APP: cold launch → live workout → logged set → summary → Progress.
 *
 * Extends the T-097 probe harness (same logging/probe/tap primitives) but spends
 * its whole budget PAST onboarding: the live set-logging screen, the rest timer,
 * finishing, the summary, Progress cross-check, templates, and a can-I-leave
 * audit on every screen entered.
 *
 * Never fails: every wall is recorded as a finding and the walk continues.
 * Evidence is written incrementally to visual-qa/t099-journey.json after every
 * step, so a timeout still keeps everything found so far.
 *
 * Run: npx playwright test e2e/journey-t099.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import fs from 'node:fs';
import path from 'node:path';
import { type Page, test } from '@playwright/test';

const OUT = 'visual-qa';
const LOG = path.join(OUT, 't100-journey.json');

type Control = { tag: string; name: string; disabled: boolean; h: number; w: number };
type Probe = {
  step: string;
  url: string;
  text: string;
  controls: Control[];
  scrollWidth: number;
  innerWidth: number;
  exits: string[];
};

const log: {
  startedAt: string;
  viewport: string;
  taps: number;
  steps: { step: string; url: string; note: string }[];
  findings: { sev: string; step: string; expected: string; actual: string; frame?: string }[];
  notes: string[];
  consoleErrors: string[];
  pageErrors: string[];
  timeline: string[];
  loggedSets: { ex: string; set: number; typedWeight: string; typedReps: string; shown: string }[];
  notReached: string[];
  /** The three places a logged number can be read back, kept side by side. */
  numbers: {
    typed: { sets: number; volume: number; bestSets: string[] };
    finishDialog: { sets: string; volume: string; duration: string; raw: string };
    summary: { volume: string; sets: string; raw: string };
    progress: { tab: string; numbers: string[]; raw: string }[];
  };
  crossCheck: string[];
  screens: Record<string, { url: string; controls: string[]; text: string; exits: string[] }>;
} = {
  startedAt: new Date().toISOString(),
  viewport: '390x844',
  taps: 0,
  steps: [],
  findings: [],
  notes: [],
  consoleErrors: [],
  pageErrors: [],
  timeline: [],
  loggedSets: [],
  notReached: [],
  numbers: {
    typed: { sets: 0, volume: 0, bestSets: [] },
    finishDialog: { sets: '', volume: '', duration: '', raw: '' },
    summary: { volume: '', sets: '', raw: '' },
    progress: [],
  },
  crossCheck: [],
  screens: {},
};

function flush() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2), 'utf8');
}
function note(s: string) {
  log.notes.push(s);
  flush();
}
function mark(s: string) {
  log.timeline.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  flush();
}
function find(
  sev: 'HIGH' | 'MEDIUM',
  step: string,
  expected: string,
  actual: string,
  frame?: string
) {
  log.findings.push({ sev, step, expected, actual, frame });
  flush();
}
function unreached(what: string, why: string) {
  log.notReached.push(`${what} — ${why}`);
  flush();
}

async function shoot(page: Page, name: string): Promise<string> {
  const p = path.join(OUT, `t100-${name}.png`);
  await page.screenshot({ path: p, timeout: 15_000 }).catch(() => {});
  return p;
}

async function probe(page: Page, step: string): Promise<Probe> {
  const info = await page
    .evaluate(() => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.opacity !== '0';
      };
      const nodes = Array.from(
        document.querySelectorAll('button,a[href],[role="button"],input,select,textarea,[role="tab"]')
      ).filter(visible);
      const controls = nodes.slice(0, 80).map((el) => {
        const r = el.getBoundingClientRect();
        const raw =
          el.getAttribute('aria-label') ||
          (el as HTMLElement).innerText ||
          (el as HTMLInputElement).placeholder ||
          el.getAttribute('title') ||
          '';
        return {
          tag: el.tagName.toLowerCase(),
          name: raw.replace(/\s+/g, ' ').trim().slice(0, 80),
          disabled: (el as HTMLButtonElement).disabled === true,
          h: Math.round(r.height),
          w: Math.round(r.width),
        };
      });
      return {
        url: location.pathname + location.search,
        text: (document.body.innerText || '').replace(/\n{2,}/g, '\n').trim().slice(0, 2000),
        controls,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    })
    .catch(() => ({
      url: '<eval failed>',
      text: '',
      controls: [] as Control[],
      scrollWidth: 0,
      innerWidth: 0,
    }));

  const exits = info.controls
    .filter((c) => /חזור|חזרה|סגור|בטל|יציאה|back|close|×|✕/i.test(c.name))
    .map((c) => c.name);
  const p: Probe = { step, ...info, exits };
  log.screens[step] = {
    url: info.url,
    controls: info.controls.map((c) => c.name).filter(Boolean),
    text: info.text.slice(0, 700),
    exits,
  };
  log.steps.push({ step, url: info.url, note: '' });
  flush();
  return p;
}

async function tap(page: Page, sel: string, label: string, timeout = 4000): Promise<boolean> {
  const loc = page.locator(sel).first();
  try {
    await loc.waitFor({ state: 'visible', timeout });
  } catch {
    note(`tap MISS: ${label} (${sel})`);
    return false;
  }
  if (await loc.isDisabled().catch(() => false)) {
    note(`tap DISABLED: ${label}`);
    return false;
  }
  try {
    await loc.click({ timeout: 5000 });
  } catch {
    try {
      await loc.click({ force: true, timeout: 3000 });
      note(`tap needed force: ${label}`);
    } catch (e) {
      find('HIGH', label, 'the control responds to a tap', `present but not clickable: ${String(e).slice(0, 160)}`);
      return false;
    }
  }
  log.taps += 1;
  mark(`tap ${label}`);
  await page.waitForTimeout(450);
  return true;
}

async function clearGates(page: Page) {
  for (const label of ['אישור הכל', 'רק הכרחי', 'הבנתי']) {
    const b = page.getByRole('button', { name: label, exact: true }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click({ timeout: 3000 }).catch(() => {});
      log.taps += 1;
      mark(`gate ${label}`);
      await page.waitForTimeout(350);
    }
  }
}

/**
 * The first-run guidance coach ("מה עושים כאן?") renders over the home screen and
 * swallows taps on the real CTAs. A user dismisses it with "דילוג"; so do we.
 */
async function dismissCoach(page: Page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: 'דילוג', exact: true }).first();
    if (!(await skip.isVisible().catch(() => false))) return;
    await skip.click({ timeout: 3000 }).catch(() => {});
    log.taps += 1;
    mark('dismiss guidance coach (דילוג)');
    await page.waitForTimeout(700);
  }
}

async function phase(name: string, fn: () => Promise<void>) {
  mark(`===== ${name} =====`);
  try {
    await fn();
  } catch (e) {
    find('HIGH', name, 'the step completes', `the walk threw here: ${String(e).slice(0, 300)}`);
  }
  flush();
}

/** Numbers only, in DOM order, from a string. */
function nums(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(',', '.'));
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('T-100 finish the workout, read the summary, cross-check Progress', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });

  page.on('console', (m) => {
    if (m.type() === 'error') log.consoleErrors.push(`@${log.timeline.length}| ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => {
    log.pageErrors.push(`@${log.timeline.length}| ${e.message.slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const line = `@${log.timeline.length}| ${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`;
      if (!log.notes.includes(line)) log.notes.push(line);
    }
  });

  // ═══════════════════════════════════════════ 0. COLD LAUNCH (fast, not the point)
  await phase('0-cold-launch', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      // biome-ignore lint/suspicious/noExplicitAny: feature-detect databases()
      const idb = indexedDB as any;
      if (typeof idb.databases === 'function') {
        const dbs = await idb.databases();
        await Promise.all(
          dbs.map(
            (d: { name?: string }) =>
              new Promise((res) => {
                if (!d.name) return res(null);
                const r = indexedDB.deleteDatabase(d.name);
                r.onsuccess = () => res(null);
                r.onerror = () => res(null);
                r.onblocked = () => res(null);
              })
          )
        );
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await probe(page, '0-cold-launch');
    await clearGates(page);
    if (!(await tap(page, 'button:has-text("המשיכו כאורח")', 'continue as guest'))) {
      find('HIGH', '0-cold-launch', 'a guest entry point on the launch screen', 'no "המשיכו כאורח" button');
    }
    await page.waitForTimeout(1600);
    await clearGates(page);
  });

  // ═══════════════════════════════════════════ 1. ONBOARDING (quick pass-through)
  await phase('1-onboarding', async () => {
    for (let i = 0; i < 8; i++) {
      const p = await probe(page, `1-onboarding-${i}`);
      const stillWizard =
        /דלגו/.test(p.text) || p.controls.some((c) => /חזרה לשלב הקודם|בואו נתחיל/.test(c.name));
      if (!stillWizard) {
        note(`onboarding done after ${i} screens`);
        break;
      }
      // fill anything empty
      const inputs = page.locator('input:visible');
      const n = await inputs.count().catch(() => 0);
      for (let k = 0; k < n; k++) {
        const inp = inputs.nth(k);
        const type = (await inp.getAttribute('type').catch(() => '')) || 'text';
        if (await inp.inputValue().catch(() => '')) continue;
        if (type === 'number') await inp.fill('76').catch(() => {});
        else if (type === 'text') await inp.fill('אמית').catch(() => {});
        else continue;
        mark(`onboarding typed ${type}`);
      }
      let moved = false;
      for (const sel of [
        'button:has-text("בואו נתחיל")',
        'button:has-text("הבא")',
        'button:has-text("המשך")',
        'button:has-text("סיום")',
      ]) {
        const b = page.locator(sel).first();
        if (!(await b.isVisible().catch(() => false))) continue;
        if (await b.isDisabled().catch(() => false)) continue;
        await b.click({ timeout: 4000 }).catch(() => {});
        log.taps += 1;
        mark(`onboarding forward ${sel}`);
        moved = true;
        break;
      }
      if (!moved) {
        // goals step: a card tap answers and finishes
        const card = page.getByRole('button', { name: /בניית שריר/ }).first();
        if (await card.isVisible().catch(() => false)) {
          await card.click({ timeout: 4000 }).catch(() => {});
          log.taps += 1;
          mark('onboarding goal card tap');
          moved = true;
        }
      }
      if (!moved) {
        const f = await shoot(page, `01-onboarding-stuck-${i}`);
        find('HIGH', `1-onboarding-${i}`, 'a way forward from this onboarding screen', 'nothing advanced', f);
        break;
      }
      await page.waitForTimeout(1100);
    }
    await clearGates(page);
    await page.waitForTimeout(1500);
    note(`taps spent reaching home: ${log.taps}`);
  });

  // ═══════════════════════════════════════════ 2. HOME
  let homeReached = false;
  await phase('2-home', async () => {
    const raw = await probe(page, '2-home-first-paint');
    // A first-run guidance coach covers the home screen; it must be dismissed
    // before any CTA is reachable. Record it, then get past it.
    const coachUp = /מה עושים כאן\?/.test(raw.text);
    if (coachUp) {
      note('first-run guidance coach is over the home screen on arrival');
      // Does its instruction match the UI it points at?
      if (/'בחרו תבנית מוכנה'/.test(raw.text)) {
        const hasThatButton = raw.controls.some((c) =>
          /^(בחרו תבנית מוכנה|התחילו בלי תבנית)$/.test(c.name.trim())
        );
        if (!hasThatButton) {
          const f = await shoot(page, '02-coach-copy-mismatch');
          find(
            'MEDIUM',
            '2-home',
            'the coach tells the user to press a button that exists',
            `it says press "בחרו תבנית מוכנה" but home's buttons are "${raw.controls
              .filter((c) => /תבנית|בלי תבנית/.test(c.name))
              .map((c) => c.name)
              .join('" / "')}"`,
            f
          );
        }
      }
      await dismissCoach(page);
    }
    const p = await probe(page, '2-home');
    homeReached = /בחרו תבנית|התחילו בלי תבנית|התחל אימון|אימון נוסף/.test(p.text) && !/דלגו/.test(p.text);
    if (!homeReached) {
      const f = await shoot(page, '02-home-not-reached');
      find('HIGH', '2-home', 'the home screen after onboarding', `still on: ${p.text.slice(0, 200)}`, f);
      return;
    }
    note(`home controls: ${JSON.stringify(p.controls.map((c) => c.name).filter(Boolean).slice(0, 30))}`);
    const starters = p.controls.filter((c) => /בחרו תבנית|בלי תבנית|התחל אימון|אימון נוסף/.test(c.name));
    if (starters.length === 0) {
      const f = await shoot(page, '02-home-no-start');
      find('HIGH', '2-home', 'a visible way to start a workout from home', 'no start-workout control found', f);
    }
  });

  // ═══════════════════════════════════════════ 3. P1 — REACH THE LIVE WORKOUT
  let liveReached = false;
  await phase('3-reach-live-workout', async () => {
    const started =
      (await tap(page, 'button:has-text("בחרו תבנית מוכנה")', 'home → pick a ready template')) ||
      (await tap(page, 'button:has-text("התחילו בלי תבנית")', 'home → start without a template')) ||
      (await tap(page, 'button[aria-label="התחל אימון"]', 'home → start workout')) ||
      (await tap(page, 'button[aria-label="אימון נוסף"]', 'home → another workout'));
    if (!started) {
      unreached('live workout', 'no start-workout control on home responded');
      return;
    }
    await page.waitForTimeout(1800);

    // Walk whatever sits between "start" and the live set UI (sheet, pre-workout,
    // empty-workout, exercise picker). Bounded, adaptive, and every hop recorded.
    for (let hop = 0; hop < 7; hop++) {
      const slider = page.locator('button[aria-label^="החליקו לסיום"]').first();
      if (await slider.isVisible().catch(() => false)) {
        liveReached = true;
        break;
      }
      const p = await probe(page, `3-hop-${hop}`);
      note(`hop ${hop} @${p.url}: ${JSON.stringify(p.controls.map((c) => c.name).filter(Boolean).slice(0, 22))}`);

      // (a) an empty workout asking for the first exercise
      if (
        (await tap(page, 'button[aria-label="הוסיפו תרגיל ראשון"]', `hop${hop} add first exercise`, 1500)) ||
        (await tap(page, 'button[aria-label="הוסף תרגיל"]', `hop${hop} add exercise`, 1200))
      ) {
        await page.waitForTimeout(900);
        // search + pick
        const search = page.locator('input[aria-label="חיפוש לפי שם, שריר או ציוד"]').first();
        if (await search.isVisible().catch(() => false)) {
          await search.fill('לחיצת').catch(() => {});
          mark('exercise search "לחיצת"');
          await page.waitForTimeout(1100);
        } else {
          note('exercise picker has no search field with the expected label');
        }
        const cands = page.locator('button:visible');
        const cc = await cands.count().catch(() => 0);
        let picked = '';
        for (let k = 0; k < cc; k++) {
          const b = cands.nth(k);
          const nm = ((await b.getAttribute('aria-label').catch(() => '')) ||
            (await b.innerText().catch(() => ''))) as string;
          const flat = (nm || '').replace(/\s+/g, ' ').trim();
          if (!flat || /סגור|נקה|סוג בחירה|תרגילים|תבניות|עם /.test(flat)) continue;
          if (!/לחיצת/.test(flat)) continue;
          await b.click({ timeout: 3000 }).catch(() => {});
          log.taps += 1;
          picked = flat.slice(0, 50);
          mark(`picked exercise "${picked}"`);
          break;
        }
        if (!picked) {
          const pp = await probe(page, `3-picker-empty-${hop}`);
          const f = await shoot(page, `03-picker-no-result-${hop}`);
          find(
            'HIGH',
            '3-reach-live-workout',
            'searching "לחיצת" lists a selectable exercise',
            `no selectable result: ${pp.text.slice(0, 220)}`,
            f
          );
        }
        await page.waitForTimeout(700);
        // confirm the selection (footer CTA carries "… עם N תרגילים")
        const confirm = page.locator('button[aria-label*=" עם "]').first();
        if (await confirm.isVisible().catch(() => false)) {
          const nm = await confirm.getAttribute('aria-label').catch(() => '');
          await confirm.click({ timeout: 4000 }).catch(() => {});
          log.taps += 1;
          mark(`confirm exercise selection "${String(nm).slice(0, 40)}"`);
        } else if (picked) {
          const f = await shoot(page, `03-no-confirm-${hop}`);
          find(
            'HIGH',
            '3-reach-live-workout',
            'a confirm button after picking an exercise',
            'the picker showed no confirm CTA once an exercise was selected',
            f
          );
        }
        await page.waitForTimeout(1500);
        continue;
      }

      // (b) a pre-workout / plan / sheet screen with a primary forward CTA
      await dismissCoach(page);
      const forwards = [
        'button[aria-label^="התחל תבנית"]',
        'button[aria-label^="התחל אימון:"]',
        'button[aria-label="התחל אימון לפי התוכנית"]',
        'button:has-text("אימון ריק")',
        'button:has-text("התחילו בלי תבנית")',
        'button:has-text("התחל אימון")',
        '.start-workout-btn',
      ];
      let moved = false;
      for (const sel of forwards) {
        if (await tap(page, sel, `hop${hop} forward ${sel}`, 1200)) {
          moved = true;
          break;
        }
      }
      if (!moved) {
        const f = await shoot(page, `03-stuck-hop-${hop}`);
        find(
          'HIGH',
          '3-reach-live-workout',
          'a way forward toward the live set screen',
          `dead end at ${p.url}: ${p.text.slice(0, 220)}`,
          f
        );
        break;
      }
      await page.waitForTimeout(1600);
    }

    const live = await probe(page, '3-live-workout');
    if (!liveReached) {
      liveReached = await page
        .locator('button[aria-label^="החליקו לסיום"]')
        .first()
        .isVisible()
        .catch(() => false);
    }
    if (!liveReached) {
      const f = await shoot(page, '03-live-not-reached');
      find(
        'HIGH',
        '3-reach-live-workout',
        'the live set-logging screen (slide-to-complete present)',
        `never got there. last screen ${live.url}: ${live.text.slice(0, 250)}`,
        f
      );
      unreached('P1 set logging', 'the live workout screen was never reached');
    } else {
      await shoot(page, '03-live-workout');
      note(`live workout reached in ${log.taps} taps from cold launch`);
    }
  });

  // ═══════════════════════════════════════════ 4. P1 — LOG A REAL SET, PROVE IT STUCK
  const TYPED = [
    { w: '47', r: '9' },
    { w: '52', r: '7' },
  ];
  let setsCommitted = 0;
  await phase('4-log-sets', async () => {
    if (!liveReached) {
      unreached('P1 log a set', 'no live workout screen');
      return;
    }

    const enterVia = async (field: 'משקל' | 'חזרות', digits: string): Promise<boolean> => {
      const opener = page.locator(`button[aria-label^="${field}:"]`).first();
      if (!(await opener.isVisible().catch(() => false))) {
        const f = await shoot(page, `04-no-${field}-target`);
        find('HIGH', '4-log-sets', `a tappable ${field} field on the live screen`, 'not present', f);
        return false;
      }
      const before = (await opener.getAttribute('aria-label').catch(() => '')) ?? '';
      await opener.click({ timeout: 4000 }).catch(() => {});
      log.taps += 1;
      await page.waitForTimeout(650);
      const pad = page.locator('[aria-label="מקלדת מספרים"]').first();
      if (!(await pad.isVisible().catch(() => false))) {
        const f = await shoot(page, `04-numpad-missing-${field}`);
        find(
          'HIGH',
          '4-log-sets',
          `tapping ${field} opens the number pad`,
          `no numpad appeared (field read "${before}")`,
          f
        );
        return false;
      }
      const clear = page.locator('button[aria-label="נקה את הערך"]').first();
      if (await clear.isVisible().catch(() => false)) {
        await clear.click().catch(() => {});
        log.taps += 1;
      }
      for (const d of digits.split('')) {
        const key = page.getByRole('button', { name: d, exact: true }).first();
        if (!(await key.isVisible().catch(() => false))) {
          const f = await shoot(page, `04-numpad-key-${d}-missing`);
          find('HIGH', '4-log-sets', `a "${d}" key on the number pad`, 'key not found', f);
          return false;
        }
        await key.click({ timeout: 3000 }).catch(() => {});
        log.taps += 1;
      }
      const ok = page.locator('button[aria-label="אישור ערך"]').first();
      if (!(await ok.isVisible().catch(() => false))) {
        const f = await shoot(page, `04-numpad-noconfirm-${field}`);
        find('HIGH', '4-log-sets', 'a confirm button on the number pad', 'אישור ערך missing', f);
        return false;
      }
      if (await ok.isDisabled().catch(() => false)) {
        const f = await shoot(page, `04-numpad-confirm-disabled-${field}`);
        find(
          'HIGH',
          '4-log-sets',
          `confirm is enabled after typing ${digits}`,
          `confirm disabled — ${field} cannot be committed`,
          f
        );
        return false;
      }
      await ok.click().catch(() => {});
      log.taps += 1;
      mark(`${field} = ${digits} committed`);
      await page.waitForTimeout(700);
      // did the pad close?
      if (await page.locator('[aria-label="מקלדת מספרים"]').first().isVisible().catch(() => false)) {
        const f = await shoot(page, `04-numpad-stayed-open-${field}`);
        find('HIGH', '4-log-sets', 'the number pad closes after confirm', 'the pad was still on screen', f);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }
      return true;
    };

    const readShown = async () => {
      const w =
        (await page.locator('button[aria-label^="משקל:"]').first().getAttribute('aria-label').catch(() => '')) ??
        '';
      const r =
        (await page.locator('button[aria-label^="חזרות:"]').first().getAttribute('aria-label').catch(() => '')) ??
        '';
      return { w, r };
    };

    for (let s = 0; s < TYPED.length; s++) {
      const { w, r } = TYPED[s];
      const okW = await enterVia('משקל', w);
      const okR = await enterVia('חזרות', r);
      const shown = await readShown();
      log.loggedSets.push({
        ex: 'exercise-1',
        set: s + 1,
        typedWeight: w,
        typedReps: r,
        shown: `${shown.w} | ${shown.r}`,
      });
      flush();

      // ── the P1 proof: does the screen show the number that was typed?
      if (okW) {
        const got = nums(shown.w)[0];
        if (got !== w) {
          const f = await shoot(page, `04-weight-mismatch-set${s + 1}`);
          find(
            'HIGH',
            '4-log-sets',
            `the weight field shows ${w} after typing ${w}`,
            `it shows "${shown.w}"`,
            f
          );
        }
      }
      if (okR) {
        const got = nums(shown.r)[0];
        if (got !== r) {
          const f = await shoot(page, `04-reps-mismatch-set${s + 1}`);
          find(
            'HIGH',
            '4-log-sets',
            `the reps field shows ${r} after typing ${r}`,
            `it shows "${shown.r}"`,
            f
          );
        }
      }
      if (s === 0) await shoot(page, '04-set1-typed');

      // commit the set
      // The workout position renders as "סט 0/1 · 3/6": the second pair is the
      // set index across the whole workout. Read it the SAME way before and
      // after, or the comparison is meaningless (the T-099 run read the two
      // sides with two different regexes and could not tell a commit from a
      // no-op).
      const readPos = async (): Promise<string> => {
        const t = (await page
          .locator('#main-content, main, body')
          .first()
          .innerText()
          .catch(() => '')) as string;
        const m = t.match(/·\s*(\d+)\s*\/\s*(\d+)/);
        return m ? `${m[1]}/${m[2]}` : '';
      };
      const posBefore = await readPos();
      const slider = page.locator('button[aria-label^="החליקו לסיום"]').first();
      if (!(await slider.isVisible().catch(() => false))) {
        const f = await shoot(page, `04-no-commit-set${s + 1}`);
        find('HIGH', '4-log-sets', 'a way to commit the set', 'no slide-to-complete control on screen', f);
        break;
      }
      const label = (await slider.getAttribute('aria-label').catch(() => '')) ?? '';
      await slider.focus().catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      log.taps += 1;
      mark(`commit set via Enter ("${label}")`);
      await page.waitForTimeout(1800);

      const after = await probe(page, `4-after-set-${s + 1}`);
      const posAfter = await readPos();
      const banner = new RegExp(`${w}\\s*ק`).test(after.text) && new RegExp(`${r}\\s*חזרות`).test(after.text);
      const moved = (posBefore !== '' && posAfter !== posBefore) || banner;
      note(`set ${s + 1}: pos "${posBefore}" → "${posAfter}", banner-with-typed-numbers=${banner}`);
      if (!moved) {
        const f = await shoot(page, `04-set${s + 1}-not-committed`);
        find(
          'HIGH',
          '4-log-sets',
          `committing set ${s + 1} registers it`,
          `nothing changed: position stayed "${posAfter}" and no confirmation named ${w}kg × ${r}`,
          f
        );
      } else {
        setsCommitted += 1;
        note(`set ${s + 1} committed (${w}kg × ${r})`);
        if (banner) note(`app confirmed the numbers back: ${after.text.slice(0, 180)}`);
      }
      if (s === 0) await shoot(page, '04-after-set1');
    }
    note(`sets committed: ${setsCommitted}/${TYPED.length}`);
    // Ground truth for P1: what the user actually typed and committed.
    log.numbers.typed = {
      sets: setsCommitted,
      volume: TYPED.slice(0, setsCommitted).reduce((a, t) => a + Number(t.w) * Number(t.r), 0),
      bestSets: TYPED.slice(0, setsCommitted).map((t) => `${t.w}×${t.r}`),
    };
    log.crossCheck.push(
      `TYPED (ground truth): ${log.numbers.typed.sets} sets = ${log.numbers.typed.bestSets.join(' + ')} → volume ${log.numbers.typed.volume} kg`
    );
    flush();
    if (setsCommitted === 0) unreached('P2 summary/progress cross-check', 'no set was ever committed');
  });

  // ═══════════════════════════════════════════ 5. P5 — REST TIMER
  await phase('5-rest-timer', async () => {
    if (!liveReached) {
      unreached('P5 rest timer', 'never reached the live workout');
      return;
    }
    const timer = page.locator('[aria-label="טיימר מנוחה"]').first();
    if (!(await timer.isVisible().catch(() => false))) {
      const p = await probe(page, '5-no-timer');
      const f = await shoot(page, '05-no-rest-timer');
      find(
        'HIGH',
        '5-rest-timer',
        'a rest timer after committing a set',
        `no rest timer on screen: ${p.text.slice(0, 200)}`,
        f
      );
      return;
    }
    const t0 = ((await timer.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    await page.waitForTimeout(3000);
    const t1 = ((await timer.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    note(`rest timer t0="${t0}" t+3s="${t1}"`);
    if (t0 === t1) {
      const f = await shoot(page, '05-timer-frozen');
      find('HIGH', '5-rest-timer', 'the rest timer counts down', `unchanged over 3s: "${t0}"`, f);
    }
    // extend
    const plus = page.locator('button[aria-label="הוסף 15 שניות"]').first();
    if (await plus.isVisible().catch(() => false)) {
      const b = ((await timer.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
      await plus.click().catch(() => {});
      log.taps += 1;
      await page.waitForTimeout(500);
      const a = ((await timer.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
      note(`+15s: "${b}" → "${a}"`);
      if (b === a) {
        const f = await shoot(page, '05-plus15-noop');
        find('HIGH', '5-rest-timer', '+15 seconds adds time', `the timer read "${b}" before and after`, f);
      }
    } else {
      find('MEDIUM', '5-rest-timer', 'a way to extend the rest', 'no "+15 שניות" control on the timer');
    }
    // skip
    const skip = page.locator('button[aria-label="דלג על המנוחה"]').first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
      log.taps += 1;
      await page.waitForTimeout(1200);
      const still = await page.locator('[aria-label="טיימר מנוחה"]').first().isVisible().catch(() => false);
      if (still) {
        const f = await shoot(page, '05-skip-noop');
        find('HIGH', '5-rest-timer', 'skip dismisses the rest timer', 'the timer was still on screen after skip', f);
      } else {
        note('skip rest works');
      }
    } else {
      const f = await shoot(page, '05-no-skip');
      find('HIGH', '5-rest-timer', 'a skip-rest control', 'none — the user is held by the timer', f);
    }
  });

  // ═══════════════════════════════════════════ 6. MID-WORKOUT RELOAD
  await phase('6-mid-workout-reload', async () => {
    if (!liveReached) {
      unreached('mid-workout reload', 'never reached the live workout');
      return;
    }
    const before = page.url().replace(/^https?:\/\/[^/]+/, '');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await clearGates(page);
    const after = await probe(page, '6-after-reload');
    const backOnWorkout = await page
      .locator('button[aria-label^="החליקו לסיום"]')
      .first()
      .isVisible()
      .catch(() => false);
    note(`reload: ${before} → ${after.url}; live set UI back: ${backOnWorkout}`);
    if (!backOnWorkout) {
      const f = await shoot(page, '06-reload-lost-workout');
      find(
        'HIGH',
        '6-mid-workout-reload',
        'a mid-workout reload returns the user to the workout in progress',
        `landed on ${after.url} with no set UI: ${after.text.slice(0, 200)}`,
        f
      );
    }
    // A mid-workout reload legitimately re-asks "continue or start over?" over the
    // workout. That modal's backdrop covers the header, so it MUST be answered
    // before anything else is tapped — an un-timeouted click on the finish button
    // otherwise waits behind it forever (the T-101 stall).
    if (/להמשיך או להתחיל מחדש/.test(after.text)) {
      note('reload raised the resume-decision modal — answering "המשך אימון" to keep the two logged sets');
      if (!(await tap(page, 'button:has-text("המשך אימון")', 'reload → המשך אימון', 5000))) {
        find(
          'HIGH',
          '6-mid-workout-reload',
          'the resume prompt after a reload can be answered',
          'the "המשך אימון" button did not respond — the workout stays behind the modal'
        );
      }
      await page.waitForTimeout(1400);
      await probe(page, '6-after-resume-answered');
    }
    // the numbers must still be there
    const w =
      (await page.locator('button[aria-label^="משקל:"]').first().getAttribute('aria-label').catch(() => '')) ?? '';
    note(`weight field after reload: "${w}"`);
  });

  // ═══════════════════════════════════════════ 7. P2 — FINISH + SUMMARY
  let summaryText = '';
  await phase('7-finish-and-summary', async () => {
    if (setsCommitted === 0) {
      // T-099 stopped here on a detector false-negative and never saw the
      // summary. Finishing an empty workout is still information, so walk it.
      note('finishing with 0 detected commits — walking anyway to see what the summary claims');
    }

    // The finish dialog asks "record this micro-session?" instead of showing the
    // stats grid when the session is under a minute old, and the whole walk to
    // here takes ~40s. Let the clock pass 60s so the dialog shows the numbers
    // the app believes it logged — that is the first cross-check surface.
    const elapsed = async (): Promise<number> => {
      const t = (await page
        .locator('#main-content, main, body')
        .first()
        .innerText()
        .catch(() => '')) as string;
      const m = t.match(/אימון פעיל\s*(\d{2}):(\d{2})/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
    };
    const e0 = await elapsed();
    note(`workout clock before finishing: ${e0}s`);
    if (e0 >= 0 && e0 < 68) {
      await page.waitForTimeout((68 - e0) * 1000);
      note(`waited out the short-session gate; clock now ${await elapsed()}s`);
    }

    const finish = page.locator('button[aria-label="סיים אימון"]').first();
    if (!(await finish.isVisible().catch(() => false))) {
      const p = await probe(page, '7-no-finish');
      const f = await shoot(page, '07-no-finish-control');
      find('HIGH', '7-finish-and-summary', 'a finish-workout control', `none on ${p.url}`, f);
      return;
    }
    await finish.click({ timeout: 10_000 }).catch(async (e) => {
      const f = await shoot(page, '07-finish-click-blocked');
      find(
        'HIGH',
        '7-finish-and-summary',
        'the finish-workout button accepts a tap',
        `it is on screen but did not receive the tap in 10s: ${String(e).slice(0, 220)}`,
        f
      );
    });
    log.taps += 1;
    mark('tap finish');
    await page.waitForTimeout(1200);
    const dialog = await probe(page, '7-finish-confirm');
    const dialogFrame = await shoot(page, '07-finish-confirm');
    note(`finish dialog: ${dialog.text.slice(0, 300)}`);

    // ── CROSS-CHECK SURFACE 1: the confirm dialog's own stats grid.
    // Layout is "<sets> סטים | <volume> ק״ג | <mm:ss> זמן".
    const dlgSets = (dialog.text.match(/(\d[\d,]*)\s*\n?\s*סטים/) ?? [])[1] ?? '';
    const dlgVolume = (dialog.text.match(/(\d[\d,]*)\s*\n?\s*ק״ג/) ?? [])[1] ?? '';
    const dlgDuration = (dialog.text.match(/(\d{2}:\d{2})\s*\n?\s*זמן/) ?? [])[1] ?? '';
    log.numbers.finishDialog = {
      sets: dlgSets,
      volume: dlgVolume,
      duration: dlgDuration,
      raw: dialog.text.slice(0, 400),
    };
    const shortAsk = /לרשום את האימון\?/.test(dialog.text);
    if (shortAsk) {
      note('finish dialog took the short-session branch — no stats grid to read');
      log.crossCheck.push('FINISH DIALOG: short-session ask, no numbers shown');
    } else {
      log.crossCheck.push(
        `FINISH DIALOG says: sets=${dlgSets || '<none>'} volume=${dlgVolume || '<none>'} kg duration=${dlgDuration || '<none>'}`
      );
      const wantSets = String(log.numbers.typed.sets);
      const wantVol = String(log.numbers.typed.volume);
      if (dlgSets && dlgSets !== wantSets) {
        find(
          'HIGH',
          '7-finish-and-summary',
          `the finish dialog counts the ${wantSets} sets that were committed`,
          `it says ${dlgSets} sets (typed: ${log.numbers.typed.bestSets.join(' + ')})`,
          dialogFrame
        );
      }
      if (dlgVolume && dlgVolume.replace(/,/g, '') !== wantVol) {
        find(
          'HIGH',
          '7-finish-and-summary',
          `the finish dialog reports ${wantVol} kg of volume (${log.numbers.typed.bestSets.join(' + ')})`,
          `it says ${dlgVolume} kg`,
          dialogFrame
        );
      }
    }
    // Filled-but-unchecked sets are dropped silently; the dialog is supposed to warn.
    if (/לא יישמר|לא יישמרו/.test(dialog.text)) {
      note(`dialog warns about pending sets: ${(dialog.text.match(/יש לך[^\n]*/) ?? [''])[0]}`);
    }
    flush();

    let confirmed = false;
    for (const label of ['סיים ושמור', 'כן, רשמו אותו', 'שמור', 'כן']) {
      const b = page.getByRole('button', { name: label, exact: true }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 8000 }).catch(() => {});
        log.taps += 1;
        mark(`confirm finish "${label}"`);
        confirmed = true;
        break;
      }
    }
    if (!confirmed) {
      const f = await shoot(page, '07-finish-no-confirm');
      find(
        'HIGH',
        '7-finish-and-summary',
        'a confirm button in the finish dialog',
        `controls were: ${dialog.controls.map((c) => c.name).filter(Boolean).join(' | ').slice(0, 250)}`,
        f
      );
      return;
    }
    await page.waitForTimeout(4500);
    const sum = await probe(page, '7-summary');
    summaryText = sum.text;
    const sumFrame = await shoot(page, '07-summary');
    note(`summary screen @${sum.url}: ${sum.text.slice(0, 500)}`);

    // ── CROSS-CHECK SURFACE 2: the summary screen.
    // It renders volume as `<n> ק"ג` and a per-exercise best set as
    // `<weight> ק״ג × <reps>`. Read each, then compare against what was typed.
    const sumVolume = (sum.text.match(/([\d,]+)\s*ק["״]ג/) ?? [])[1] ?? '';
    const sumSets = (sum.text.match(/(\d+)\s*סטים|סטים\s*(\d+)/) ?? []).slice(1).find(Boolean) ?? '';
    const bestSetPairs = Array.from(sum.text.matchAll(/(\d+(?:\.\d+)?)\s*ק["״]ג\s*×\s*(\d+)/g)).map(
      (m) => `${m[1]}×${m[2]}`
    );
    log.numbers.summary = { volume: sumVolume, sets: sumSets, raw: sum.text.slice(0, 900) };
    const expectedVolume = log.numbers.typed.volume;
    log.crossCheck.push(
      `SUMMARY says: volume=${sumVolume || '<none>'} kg sets=${sumSets || '<none>'} bestSets=[${bestSetPairs.join(', ')}]`
    );
    flush();

    const summaryNums = nums(sum.text);
    note(
      `expected volume ${expectedVolume} kg from ${setsCommitted} set(s); summary numbers: ${summaryNums.slice(0, 25).join(',')}`
    );

    // A disagreement is HIGH. Only a number the summary actually shows can
    // disagree — a missing number is a separate, softer problem.
    if (sumVolume && sumVolume.replace(/,/g, '') !== String(expectedVolume)) {
      find(
        'HIGH',
        '7-finish-and-summary',
        `the summary reports ${expectedVolume} kg — the volume of the sets just logged (${log.numbers.typed.bestSets.join(' + ')})`,
        `it reports ${sumVolume} kg`,
        sumFrame
      );
    } else if (!sumVolume) {
      find(
        'MEDIUM',
        '7-finish-and-summary',
        `the summary reports the ${expectedVolume} kg of volume just logged`,
        `no volume figure found; numbers present: ${summaryNums.slice(0, 20).join(',')}`,
        sumFrame
      );
    }
    if (sumSets && sumSets !== String(setsCommitted)) {
      find(
        'HIGH',
        '7-finish-and-summary',
        `the summary counts ${setsCommitted} sets`,
        `it counts ${sumSets}`,
        sumFrame
      );
    }
    // Per-exercise best sets must be exactly what was typed.
    for (const want of log.numbers.typed.bestSets) {
      if (bestSetPairs.length && !bestSetPairs.includes(want)) {
        find(
          'HIGH',
          '7-finish-and-summary',
          `the summary lists the set ${want} that was logged`,
          `its per-exercise best sets are [${bestSetPairs.join(', ')}]`,
          sumFrame
        );
      }
    }
    if (!bestSetPairs.length) {
      note('summary shows no per-exercise best-set line to compare');
    }
    // Dialog vs summary: the same session read twice must not differ.
    if (
      log.numbers.finishDialog.volume &&
      sumVolume &&
      log.numbers.finishDialog.volume.replace(/,/g, '') !== sumVolume.replace(/,/g, '')
    ) {
      find(
        'HIGH',
        '7-finish-and-summary',
        'the finish dialog and the summary report the same volume for the same session',
        `dialog said ${log.numbers.finishDialog.volume} kg, summary says ${sumVolume} kg`,
        sumFrame
      );
    }

    // can we leave the summary? (P3)
    const exits = sum.exits;
    const summaryExitCtas = sum.controls
      .map((c) => c.name)
      .filter((n) => /סיום|לדף הבית|בית|צפו בהתקדמות|חזרו על האימון/.test(n));
    note(`summary exits: ${JSON.stringify(exits)}; forward CTAs: ${JSON.stringify(summaryExitCtas)}`);
    if (exits.length === 0 && summaryExitCtas.length === 0) {
      const f = await shoot(page, '07-summary-no-exit');
      find('HIGH', '7-finish-and-summary', 'a way to leave the summary', 'no close/back/home affordance found', f);
    }
  });

  // ═══════════════════════════════════════════ 8. P2 — PROGRESS CROSS-CHECK
  await phase('8-progress', async () => {
    // P3 — the summary's own forward path. "צפו בהתקדמות" is the designed
    // route from summary to Progress; try it before falling back to the nav.
    let viaSummaryCta = false;
    if (await tap(page, 'button:has-text("צפו בהתקדמות")', 'summary → צפו בהתקדמות', 2000)) {
      await page.waitForTimeout(2500);
      const landed = page.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      viaSummaryCta = /progress/.test(landed);
      note(`summary "צפו בהתקדמות" landed on ${landed}`);
      if (!viaSummaryCta) {
        const f = await shoot(page, '08-summary-cta-wrong-target');
        find(
          'HIGH',
          '8-progress',
          'the summary\'s "צפו בהתקדמות" opens the Progress screen',
          `it landed on ${landed}`,
          f
        );
      }
    }
    if (!viaSummaryCta) {
      // Leave the summary the way a user would, then use the bottom nav.
      // T-107: "לדף הבית" matches nothing in current src — the summary's only
      // home/close action is the primary "סיום" (WorkoutSummary.tsx:1095). Kept
      // as a fallback branch rather than removed: it costs one tap MISS note and
      // the live sibling above it carries the coverage.
      let left = false;
      for (const sel of [
        'button:has-text("סיום")',
        'button:has-text("לדף הבית")',
        'button[aria-label*="סגור"]',
      ]) {
        if (await tap(page, sel, `summary → exit via ${sel}`, 1500)) {
          left = true;
          break;
        }
      }
      await page.waitForTimeout(1500);
      const afterExit = await probe(page, '8-after-summary-exit');
      const summaryStillUp = /סיום/.test(afterExit.text) && /ק["״]ג/.test(afterExit.text) && left;
      note(`left summary=${left}; landed ${afterExit.url}`);
      if (!left) {
        const f = await shoot(page, '08-summary-trapped');
        find('HIGH', '8-progress', 'the summary can be dismissed', 'no exit control responded', f);
      } else if (summaryStillUp && afterExit.url.startsWith('/workout')) {
        note('after "סיום" the walk is still on the workout route — checking it is not the summary');
      }
      await dismissCoach(page);

      const viaNav =
        (await tap(page, 'a[href$="/progress"]', 'nav → progress (link)', 2000)) ||
        (await tap(page, ':is(a,button):has-text("התקדמות")', 'nav → progress (text)', 1500)) ||
        (await tap(page, '[aria-label*="התקדמות"]', 'nav → progress (aria)', 1500));
      if (!viaNav) {
        find('MEDIUM', '8-progress', 'Progress reachable from the bottom nav', 'no obvious nav entry — deep-linked instead');
        await page.goto('/progress', { waitUntil: 'domcontentloaded' });
      }
    }
    await page.waitForTimeout(3500);
    await clearGates(page);
    const p = await probe(page, '8-progress');
    await shoot(page, '08-progress');
    note(`progress @${p.url}: ${p.text.slice(0, 600)}`);

    if (setsCommitted === 0) {
      unreached('P2 progress cross-check', 'no workout was saved to look for');
      return;
    }

    const expectedVolume = TYPED.slice(0, setsCommitted).reduce(
      (acc, t) => acc + Number(t.w) * Number(t.r),
      0
    );
    const emptyish = /טרם|אין נתונים|אין אימונים/.test(p.text);
    if (emptyish) {
      const f = await shoot(page, '08-progress-empty');
      find(
        'HIGH',
        '8-progress',
        'the workout just saved appears in Progress',
        `Progress still shows an empty state: ${p.text.slice(0, 220)}`,
        f
      );
    }

    // ── CROSS-CHECK SURFACE 3: every Progress tab, recorded verbatim.
    const tabs = page.locator('[role="tab"]');
    const tc = await tabs.count().catch(() => 0);
    note(`progress has ${tc} tabs`);
    let foundVolume = false;
    let foundWeight = false;
    let foundSetCount = false;
    let foundWorkoutCount = false;
    const tabNames: string[] = [];
    for (let i = 0; i < Math.min(tc, 6); i++) {
      const t = tabs.nth(i);
      const nm = ((await t.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim() || `tab${i}`;
      tabNames.push(nm);
      await t.click({ timeout: 3000 }).catch(() => {});
      log.taps += 1;
      await page.waitForTimeout(2000);
      const tp = await probe(page, `8-progress-tab-${i}-${nm.slice(0, 12)}`);
      const n = nums(tp.text);
      const volHere = n.includes(String(expectedVolume));
      const wHere = n.includes(TYPED[0].w) || n.includes(TYPED[1].w);
      const setsHere = new RegExp(`${setsCommitted}\\s*סטים|סטים[^\\d]{0,6}${setsCommitted}\\b`).test(tp.text);
      const woHere = /1\s*אימון(?!ים)|אימון אחד/.test(tp.text);
      if (volHere) foundVolume = true;
      if (wHere) foundWeight = true;
      if (setsHere) foundSetCount = true;
      if (woHere) foundWorkoutCount = true;
      log.numbers.progress.push({ tab: nm, numbers: n.slice(0, 40), raw: tp.text.slice(0, 900) });
      log.crossCheck.push(
        `PROGRESS tab "${nm}": volume ${expectedVolume}=${volHere}, typed weight=${wHere}, ${setsCommitted} sets=${setsHere}, 1 workout=${woHere}`
      );
      flush();
      await shoot(page, `08-progress-tab${i}-${nm.replace(/[^\wא-ת]/g, '').slice(0, 10)}`);
    }
    note(`progress tabs walked: ${JSON.stringify(tabNames)}`);

    // The workouts/history tab is where a saved session should be listed with
    // its own numbers — the single most direct place the logged set can be
    // contradicted. Read whatever session row exists.
    const sessionRow = (
      (await page
        .locator('#main-content, main')
        .first()
        .innerText()
        .catch(() => '')) as string
    ).slice(0, 1200);
    note(`progress body after tab walk: ${sessionRow.slice(0, 400)}`);

    log.crossCheck.push(
      `VERDICT INPUTS — typed: ${setsCommitted} sets / ${expectedVolume} kg / ${log.numbers.typed.bestSets.join(' + ')} · dialog: ${log.numbers.finishDialog.sets || '—'} sets, ${log.numbers.finishDialog.volume || '—'} kg · summary: ${log.numbers.summary.sets || '—'} sets, ${log.numbers.summary.volume || '—'} kg · progress: volume seen=${foundVolume}, weight seen=${foundWeight}, set count seen=${foundSetCount}, workout count seen=${foundWorkoutCount}`
    );
    flush();

    if (!foundVolume && !foundWeight && !foundSetCount && !foundWorkoutCount) {
      const f = await shoot(page, '08-progress-numbers-missing');
      find(
        'HIGH',
        '8-progress',
        `Progress reflects the session just saved (${setsCommitted} sets, ${expectedVolume} kg, top weight ${TYPED[1].w} kg)`,
        `no tab shows the volume, the typed weights, the set count or a workout count — the saved workout is invisible on Progress`,
        f
      );
    } else if (!foundVolume) {
      note(
        `Progress does not print the ${expectedVolume} kg total anywhere (it does show ${
          foundWeight ? 'the typed weight' : ''
        }${foundSetCount ? ' the set count' : ''}${foundWorkoutCount ? ' a workout count' : ''})`
      );
    }

    // P3 — can we get out of Progress?
    const px = await probe(page, '8-progress-exit-audit');
    const navHome = px.controls.map((c) => c.name).filter((n) => /^בית$/.test(n));
    note(`progress exits: ui=${JSON.stringify(px.exits)} bottom-nav-home=${JSON.stringify(navHome)}`);
    if (px.exits.length === 0 && navHome.length === 0) {
      const f = await shoot(page, '08-progress-no-exit');
      find('HIGH', '8-progress', 'a way off the Progress screen', 'no back control and no bottom-nav home entry', f);
    }
  });

  // ═══════════════════════════════════════════ 9. P3 — TEMPLATES
  await phase('9-templates', async () => {
    await dismissCoach(page);
    let viaNav =
      (await tap(page, 'a[href="/templates"]', 'nav → templates', 2000)) ||
      (await tap(page, 'nav button:has-text("תבניות")', 'nav → templates (button)', 1200));
    if (!viaNav) {
      // "עוד" is the overflow entry in the bottom nav — a user would look there.
      if (await tap(page, 'nav button:has-text("עוד"), button:has-text("עוד")', 'nav → more sheet', 2000)) {
        await page.waitForTimeout(900);
        const sheet = await probe(page, '9-more-sheet');
        note(`more sheet: ${JSON.stringify(sheet.controls.map((c) => c.name).filter(Boolean).slice(0, 25))}`);
        viaNav =
          (await tap(page, 'a[href="/templates"]', 'more sheet → templates', 2000)) ||
          (await tap(page, 'button:has-text("תבניות")', 'more sheet → templates (button)', 1500));
        if (!viaNav) {
          const f = await shoot(page, '09-more-sheet-no-templates');
          find(
            'MEDIUM',
            '9-templates',
            'templates reachable from the bottom nav or its More sheet',
            'neither the nav nor the More sheet offers a templates entry — deep-linked instead',
            f
          );
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    }
    if (!viaNav) {
      await page.goto('/templates', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(2500);
    await dismissCoach(page);
    const t = await probe(page, '9-templates');
    await shoot(page, '09-templates');
    note(`templates @${t.url}: ${JSON.stringify(t.controls.map((c) => c.name).filter(Boolean).slice(0, 25))}`);

    const opened =
      (await tap(page, 'button[aria-label="צור תבנית חדשה"]', 'templates → new', 2000)) ||
      (await tap(page, 'button:has-text("תבנית חדשה")', 'templates → new (text)', 1500)) ||
      (await tap(page, 'button:has-text("תבנית ראשונה")', 'templates → first template', 1500));
    if (!opened) {
      const f = await shoot(page, '09-no-create-control');
      find('HIGH', '9-templates', 'a create-template control', `none on ${t.url}`, f);
      unreached('P2 template creation', 'no create control');
      return;
    }
    await page.waitForTimeout(1000);
    const modal = await probe(page, '9-create-modal');
    await shoot(page, '09-create-modal');
    note(`create sheet controls: ${JSON.stringify(modal.controls.map((c) => c.name).filter(Boolean).slice(0, 25))}`);

    // ── name it. The sheet's own field carries data-template-name-input.
    const nameInput = page.locator('input[data-template-name-input]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('דחיפה A').catch(() => {});
      mark('template name typed');
    } else {
      const f = await shoot(page, '09-no-name-field');
      find('HIGH', '9-templates', 'a name field in the create-template sheet', 'no [data-template-name-input] found', f);
    }

    // ── add exercises. The button reads "הוסף תרגיל ראשון" while empty and
    // "הוסף תרגיל" afterwards; both are plain text, no aria-label.
    let added = 0;
    for (const wanted of ['לחיצת', 'חתירה']) {
      const addLabel = added === 0 ? 'הוסף תרגיל ראשון' : 'הוסף תרגיל';
      const addBtn = page.getByRole('button', { name: addLabel, exact: true }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        const f = await shoot(page, `09-no-add-exercise-${added}`);
        find(
          'HIGH',
          '9-templates',
          `a way to add exercise #${added + 1} to the template (expected "${addLabel}")`,
          `control not on screen; sheet offers: ${(await probe(page, `9-add-missing-${added}`)).controls
            .map((c) => c.name)
            .filter(Boolean)
            .join(' | ')
            .slice(0, 200)}`,
          f
        );
        break;
      }
      await addBtn.click({ timeout: 4000 }).catch(() => {});
      log.taps += 1;
      mark(`template add-exercise opened (${addLabel})`);
      await page.waitForTimeout(900);

      const search = page.locator('input[aria-label="חפש תרגיל"]').first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(wanted).catch(() => {});
        mark(`template exercise search "${wanted}"`);
        await page.waitForTimeout(1200);
      } else {
        find(
          'MEDIUM',
          '9-templates',
          'a search field in the template exercise picker',
          'no [aria-label="חפש תרגיל"] — picking from the full list instead'
        );
      }

      const pickerProbe = await probe(page, `9-template-picker-${added}`);
      if (/אין תרגיל בשם הזה/.test(pickerProbe.text)) {
        const f = await shoot(page, `09-template-picker-noresult-${added}`);
        find(
          'MEDIUM',
          '9-templates',
          `searching "${wanted}" in the template picker finds an exercise (the workout picker finds them)`,
          'the picker says אין תרגיל בשם הזה',
          f
        );
        await search.fill('').catch(() => {});
        await page.waitForTimeout(900);
      }

      // Results are plain buttons whose text is the exercise name. Take the
      // first one that is not the picker's own close button.
      const results = page.locator('button:visible');
      const rc = await results.count().catch(() => 0);
      let picked = '';
      for (let k = 0; k < rc; k++) {
        const b = results.nth(k);
        const aria = (await b.getAttribute('aria-label').catch(() => '')) ?? '';
        if (/סגור|הסר|צור תבנית|הוסף תרגיל/.test(aria)) continue;
        const txt = ((await b.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 60) continue;
        if (/הוסף תרגיל|צור תבנית|תבנית חדשה|בחר תרגיל|סגור|בית|אימון|התקדמות|עוד/.test(txt)) continue;
        await b.click({ timeout: 3000 }).catch(() => {});
        log.taps += 1;
        picked = txt;
        mark(`template exercise picked "${txt.slice(0, 40)}"`);
        break;
      }
      await page.waitForTimeout(900);
      if (!picked) {
        const f = await shoot(page, `09-template-picker-empty-${added}`);
        find(
          'HIGH',
          '9-templates',
          'the template exercise picker lists something selectable',
          `no selectable result: ${pickerProbe.text.slice(0, 220)}`,
          f
        );
        break;
      }
      // Did the chip actually land in the sheet?
      const chipCheck = await probe(page, `9-template-after-add-${added}`);
      const chipThere = chipCheck.text.includes(picked.split(' | ')[0].slice(0, 12));
      if (!chipThere) {
        const f = await shoot(page, `09-template-chip-missing-${added}`);
        find(
          'HIGH',
          '9-templates',
          `the picked exercise "${picked.slice(0, 30)}" appears in the template being built`,
          `it is not in the sheet: ${chipCheck.text.slice(0, 220)}`,
          f
        );
      } else {
        added += 1;
        note(`template now holds ${added} exercise(s); last added "${picked.slice(0, 40)}"`);
      }
    }
    await shoot(page, '09-template-filled');

    // ── P3: can the editor be left without saving? Escape must close the sheet.
    // Check it BEFORE submitting, then reopen the flow is not needed — the sheet
    // state survives because we re-open and re-fill only if Escape closed it.
    // Instead of destroying the draft, verify the sheet HAS a close affordance.
    const editorExits = (await probe(page, '9-template-editor-exits')).exits;
    note(`template editor exits: ${JSON.stringify(editorExits)}`);
    if (editorExits.length === 0) {
      const f = await shoot(page, '09-template-editor-no-exit');
      find(
        'HIGH',
        '9-templates',
        'a close control on the template editor sheet',
        'no close/back affordance among its controls',
        f
      );
    }

    // ── submit. "צור תבנית" is the sheet's submit; the page ALSO has
    // "צור תבנית חדשה", so match the submit button by its class, not by text
    // prefix, or the tap re-opens the sheet instead of saving.
    const submit = page.locator('form button.start-workout-btn').first();
    let submitted = false;
    if (await submit.isVisible().catch(() => false)) {
      await submit.click({ timeout: 5000 }).catch(() => {});
      log.taps += 1;
      mark('template submit');
      submitted = true;
    } else {
      submitted =
        (await tap(page, 'form button[type="submit"]', 'template → submit (type)', 1500)) ||
        (await tap(page, 'button:has-text("שמור תבנית")', 'template → save', 1500));
    }
    if (!submitted) {
      const f = await shoot(page, '09-template-no-submit');
      find('HIGH', '9-templates', 'a submit button on the create-template sheet', 'none found', f);
      return;
    }
    await page.waitForTimeout(3000);
    const after = await probe(page, '9-templates-after-create');
    await shoot(page, '09-templates-after');
    note(`after submit @${after.url}: ${after.text.slice(0, 300)}`);
    if (/מגבלת|לא הצלחנו|נסה שוב/.test(after.text)) {
      const f = await shoot(page, '09-template-save-refused');
      find(
        'HIGH',
        '9-templates',
        'a guest can save a template they just built',
        `the app refused: ${(after.text.match(/[^\n]*(?:מגבלת|לא הצלחנו|נסה שוב)[^\n]*/) ?? [''])[0]}`,
        f
      );
    }
    if (!/דחיפה A/.test(after.text)) {
      const f = await shoot(page, '09-template-vanished');
      find(
        'HIGH',
        '9-templates',
        'the template just created is listed on the templates screen',
        `"דחיפה A" is not on the list: ${after.text.slice(0, 250)}`,
        f
      );
      unreached('P2 start a workout from the new template', 'the template was not listed after saving');
      return;
    }
    note(`template created and listed with ${added} exercise(s)`);

    // ── start a workout from it.
    const startFromTemplate = page.locator('button[aria-label^="התחל אימון: דחיפה A"]').first();
    if (await startFromTemplate.isVisible().catch(() => false)) {
      await startFromTemplate.click().catch(() => {});
      log.taps += 1;
      mark('start workout from template');
      await page.waitForTimeout(3500);
      await clearGates(page);
      const w = await probe(page, '9-workout-from-template');
      await shoot(page, '09-workout-from-template');
      const live = await page
        .locator('button[aria-label^="החליקו לסיום"]')
        .first()
        .isVisible()
        .catch(() => false);
      const resumePrompt = /להמשיך או להתחיל מחדש/.test(w.text);
      const preWorkout = /התחל אימון|תוכנית/.test(w.text);
      note(`from-template entry @${w.url}: live=${live} resumePrompt=${resumePrompt} preWorkout=${preWorkout}`);
      if (resumePrompt) {
        note('an earlier session was still active — answering "התחל חדש"');
        if (await tap(page, 'button:has-text("התחל חדש")', 'template start → התחל חדש', 2000)) {
          await page.waitForTimeout(3000);
        }
      }
      const live2 =
        live ||
        (await page
          .locator('button[aria-label^="החליקו לסיום"]')
          .first()
          .isVisible()
          .catch(() => false));
      const w2 = await probe(page, '9-workout-from-template-final');
      // Does the workout actually contain the exercise the template holds?
      const exercisePresent = added === 0 || /לחיצת|חתירה/.test(w2.text);
      if (!live2 && !preWorkout) {
        const f = await shoot(page, '09-template-start-dead');
        find(
          'HIGH',
          '9-templates',
          'starting a workout from a template opens that workout',
          `landed on ${w2.url}: ${w2.text.slice(0, 220)}`,
          f
        );
      } else if (!exercisePresent) {
        const f = await shoot(page, '09-template-workout-empty');
        find(
          'HIGH',
          '9-templates',
          'the workout started from "דחיפה A" contains the exercises put in that template',
          `the workout screen names none of them: ${w2.text.slice(0, 220)}`,
          f
        );
      } else {
        note('workout from the new template opened with its exercises');
      }
    } else {
      const f = await shoot(page, '09-no-start-from-template');
      find(
        'HIGH',
        '9-templates',
        'a start-workout control on the template card',
        'the template card offers no way to start it',
        f
      );
    }
  });

  // ═══════════════════════════════════════════ 10. P4 — CAN YOU GET BACK OUT?
  await phase('10-exit-audit', async () => {
    const routes = ['/templates', '/progress', '/settings', '/program', '/workout'];
    for (const r of routes) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await clearGates(page);
      await page.goto(r, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2200);
      const at = await probe(page, `10-at${r.replace(/\W+/g, '_')}`);
      const hasUiExit = at.exits.length > 0;
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1800);
      const landed = page.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      note(`exit ${r}: ui-exits=${JSON.stringify(at.exits)} browser-back → "${landed}"`);
      if (landed === r) {
        // Is something intercepting the back (a confirm-exit overlay), or is the
        // screen simply unleavable?
        const blocked = await probe(page, `10-back-blocked${r.replace(/\W+/g, '_')}`);
        const overlay = /לבטל אימון\?|סיים אימון\?|לרשום את האימון/.test(blocked.text);
        const f = await shoot(page, `10-trapped${r.replace(/\W+/g, '_')}`);
        // Is there ANY working way off this screen? Try the pause control, which
        // is the only non-destructive exit an active workout offers.
        let escaped = '';
        if (await tap(page, 'button[aria-label="השהה אימון"]', `${r} → pause as an exit`, 1500)) {
          await page.waitForTimeout(2000);
          escaped = page.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
          const pausedProbe = await probe(page, `10-after-pause${r.replace(/\W+/g, '_')}`);
          note(`pause on ${r} → landed "${escaped}"; controls: ${pausedProbe.controls.map((c) => c.name).filter(Boolean).slice(0, 14).join(' | ')}`);
        }
        find(
          escaped && escaped !== r ? 'MEDIUM' : 'HIGH',
          '10-exit-audit',
          `back leaves ${r}`,
          `${
            overlay ? 'back opened a confirm overlay and stayed' : 'back was swallowed and stayed'
          } on ${landed}. ${
            escaped && escaped !== r
              ? `The only working exit is "השהה אימון", which lands on ${escaped}.`
              : 'Pause did not get out either.'
          } Visible controls: ${blocked.controls.map((c) => c.name).filter(Boolean).join(' | ').slice(0, 200)}`,
          f
        );
      } else if (!hasUiExit && landed !== '/' && r !== '/templates' && r !== '/progress') {
        note(`${r} has no in-page exit affordance (relies on the bottom nav / browser back)`);
      }
    }
  });

  log.notes.push(`FINAL taps=${log.taps} setsCommitted=${setsCommitted} liveReached=${liveReached}`);
  flush();
});


// ═══════════════════════════════════════════════════════════════════════════
// T-108 — THE OTHER HALF: build a template, train from it, and get back out.
// ═══════════════════════════════════════════════════════════════════════════
// Extends this file's proven harness: same aria-label selectors, same
// probe/tap/gate/coach semantics, same flush-after-every-step recorder.
//
// It keeps its OWN log object and its OWN output file (visual-qa/t108-templates.json)
// so a T-108 run can never overwrite the T-100 evidence already on disk, and the
// low-level page reader is duplicated rather than shared for the same reason:
// not one line of the passing T-100 test is touched.
//
// Run: npx playwright test e2e/journey-t099.spec.ts -g "T-108" --project="Mobile Chrome (Pixel 5)"

const LOG108 = path.join(OUT, 't108-templates.json');

/** What src/data/builtInWorkoutTemplates.ts promises a brand-new user. */
const BUILT_INS: { name: string; exercises: number }[] = [
  { name: 'אימון כללי', exercises: 7 },
  { name: 'חזה + כתפיים', exercises: 6 },
  { name: 'גב + זרועות', exercises: 7 },
  { name: 'רגליים', exercises: 7 },
  { name: 'בטן + ליבה', exercises: 6 },
];

/** אימון כללי, in template order, with its per-exercise targets. */
const FULL_BODY: { name: string; sets: number; reps: number }[] = [
  { name: 'סקוואט', sets: 4, reps: 8 },
  { name: 'לחיצת חזה', sets: 4, reps: 8 },
  { name: 'מתח', sets: 4, reps: 8 },
  { name: 'לחיצת כתפיים', sets: 3, reps: 10 },
  { name: 'כפיפת מוט', sets: 3, reps: 12 },
  { name: 'פשיטת מרפקים בכבל', sets: 3, reps: 12 },
  { name: 'פלאנק', sets: 3, reps: 60 },
];

const MY_TEMPLATE = 'אימון של אמית';
/** Two exercises added to the user's own template, by search term. */
const MY_EXERCISES = ['סקוואט', 'חתירה'];

/** Sheet's close button is aria-label="סגירה" — the T-100 regex misses it. */
const EXIT_RE = /חזור|חזרה|סגור|סגירה|בטל|יציאה|back|close|×|✕/i;

type Db108Template = { name: string; exercises: { name: string; sets: number; reps: number }[] };

const log108: {
  task: string;
  startedAt: string;
  viewport: string;
  taps: number;
  timeline: string[];
  notes: string[];
  steps: { step: string; url: string }[];
  findings: { sev: string; step: string; expected: string; actual: string; frame?: string }[];
  consoleErrors: string[];
  pageErrors: string[];
  notReached: string[];
  p1a_builtIns: {
    reachedVia: string;
    headerCount: string;
    seen: string[];
    missing: string[];
    cardExerciseCounts: Record<string, string>;
    startCtas: string[];
    db: Db108Template[];
  };
  p1b_fromBuiltIn: {
    template: string;
    landedOn: string;
    liveReached: boolean;
    currentExercise: string;
    setProgressAria: string;
    repsAria: string;
    drawerOrder: string[];
    expectedOrder: string[];
    orderMatches: boolean | null;
    left: string;
  };
  p1cd_myTemplate: {
    createLandedOn: string;
    toast: string;
    cardAfterCreate: string;
    addedChips: string[];
    countAfterEdit: string;
    countAfterReturn: string;
    dbAfterReturn: string[];
  };
  p1e_workoutFromMine: { landedOn: string; exercisesSeen: string[]; left: string };
  p2f_progress: {
    tabs: { tab: string; selected: string; heading: string; body: string }[];
    exitViaBottomNav: string;
    exitViaBrowserBack: string;
  };
  p2g_exits: { screen: string; uiExits: string[]; navHome: boolean; escaped: string }[];
  screens: Record<string, { url: string; controls: string[]; text: string; exits: string[] }>;
} = {
  task: 'T-108 templates end to end + getting out',
  startedAt: new Date().toISOString(),
  viewport: '390x844',
  taps: 0,
  timeline: [],
  notes: [],
  steps: [],
  findings: [],
  consoleErrors: [],
  pageErrors: [],
  notReached: [],
  p1a_builtIns: {
    reachedVia: '',
    headerCount: '',
    seen: [],
    missing: [],
    cardExerciseCounts: {},
    startCtas: [],
    db: [],
  },
  p1b_fromBuiltIn: {
    template: 'אימון כללי',
    landedOn: '',
    liveReached: false,
    currentExercise: '',
    setProgressAria: '',
    repsAria: '',
    drawerOrder: [],
    expectedOrder: FULL_BODY.map((e) => e.name),
    orderMatches: null,
    left: '',
  },
  p1cd_myTemplate: {
    createLandedOn: '',
    toast: '',
    cardAfterCreate: '',
    addedChips: [],
    countAfterEdit: '',
    countAfterReturn: '',
    dbAfterReturn: [],
  },
  p1e_workoutFromMine: { landedOn: '', exercisesSeen: [], left: '' },
  p2f_progress: { tabs: [], exitViaBottomNav: '', exitViaBrowserBack: '' },
  p2g_exits: [],
  screens: {},
};

function flush108() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(LOG108, JSON.stringify(log108, null, 2), 'utf8');
}
function note108(s: string) {
  log108.notes.push(s);
  flush108();
}
function mark108(s: string) {
  log108.timeline.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  flush108();
}
function find108(
  sev: 'HIGH' | 'MEDIUM',
  step: string,
  expected: string,
  actual: string,
  frame?: string
) {
  log108.findings.push({ sev, step, expected, actual, frame });
  flush108();
}
function unreached108(what: string, why: string) {
  log108.notReached.push(`${what} — ${why}`);
  flush108();
}
async function shoot108(page: Page, name: string): Promise<string> {
  const p = path.join(OUT, `t108-${name}.png`);
  await page.screenshot({ path: p, timeout: 15_000 }).catch(() => {});
  return p;
}
function urlOf(page: Page): string {
  return page.url().replace(/^https?:\/\/[^/]+/, '');
}

async function probe108(page: Page, step: string): Promise<Probe> {
  const info = await page
    .evaluate(() => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.opacity !== '0';
      };
      const nodes = Array.from(
        document.querySelectorAll(
          'button,a[href],[role="button"],input,select,textarea,[role="tab"]'
        )
      ).filter(visible);
      const controls = nodes.slice(0, 90).map((el) => {
        const r = el.getBoundingClientRect();
        const raw =
          el.getAttribute('aria-label') ||
          (el as HTMLElement).innerText ||
          (el as HTMLInputElement).placeholder ||
          el.getAttribute('title') ||
          '';
        return {
          tag: el.tagName.toLowerCase(),
          name: raw.replace(/\s+/g, ' ').trim().slice(0, 90),
          disabled: (el as HTMLButtonElement).disabled === true,
          h: Math.round(r.height),
          w: Math.round(r.width),
        };
      });
      return {
        url: location.pathname + location.search,
        text: (document.body.innerText || '').replace(/\n{2,}/g, '\n').trim().slice(0, 2600),
        controls,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    })
    .catch(() => ({
      url: '<eval failed>',
      text: '',
      controls: [] as Control[],
      scrollWidth: 0,
      innerWidth: 0,
    }));
  const exits = info.controls.filter((c) => EXIT_RE.test(c.name)).map((c) => c.name);
  log108.screens[step] = {
    url: info.url,
    controls: info.controls.map((c) => c.name).filter(Boolean),
    text: info.text.slice(0, 900),
    exits,
  };
  log108.steps.push({ step, url: info.url });
  flush108();
  return { step, ...info, exits };
}

async function tap108(page: Page, sel: string, label: string, timeout = 4000): Promise<boolean> {
  const loc = page.locator(sel).first();
  try {
    await loc.waitFor({ state: 'visible', timeout });
  } catch {
    note108(`tap MISS: ${label} (${sel})`);
    return false;
  }
  if (await loc.isDisabled().catch(() => false)) {
    note108(`tap DISABLED: ${label}`);
    return false;
  }
  try {
    await loc.click({ timeout: 5000 });
  } catch {
    try {
      await loc.click({ force: true, timeout: 3000 });
      note108(`tap needed force: ${label}`);
    } catch (e) {
      find108(
        'HIGH',
        label,
        'the control responds to a tap',
        `present but not clickable: ${String(e).slice(0, 160)}`
      );
      return false;
    }
  }
  log108.taps += 1;
  mark108(`tap ${label}`);
  await page.waitForTimeout(450);
  return true;
}

async function gates108(page: Page) {
  for (const label of ['אישור הכל', 'רק הכרחי', 'הבנתי']) {
    const b = page.getByRole('button', { name: label, exact: true }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click({ timeout: 3000 }).catch(() => {});
      log108.taps += 1;
      mark108(`gate ${label}`);
      await page.waitForTimeout(350);
    }
  }
}
async function coach108(page: Page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: 'דילוג', exact: true }).first();
    if (!(await skip.isVisible().catch(() => false))) return;
    await skip.click({ timeout: 3000 }).catch(() => {});
    log108.taps += 1;
    mark108('dismiss guidance coach (דילוג)');
    await page.waitForTimeout(650);
  }
}
async function phase108(name: string, fn: () => Promise<void>) {
  mark108(`===== ${name} =====`);
  try {
    await fn();
  } catch (e) {
    find108('HIGH', name, 'the step completes', `the walk threw here: ${String(e).slice(0, 300)}`);
  }
  flush108();
}

/** The app's own stored truth, read straight out of IndexedDB. */
async function templatesFromDb(page: Page): Promise<Db108Template[]> {
  return page
    .evaluate(
      () =>
        new Promise<Db108Template[]>((resolve) => {
          const req = indexedDB.open('sparkos-fitness-db');
          req.onerror = () => resolve([]);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('workout_templates')) {
              db.close();
              return resolve([]);
            }
            const all = db
              .transaction('workout_templates', 'readonly')
              .objectStore('workout_templates')
              .getAll();
            all.onerror = () => {
              db.close();
              resolve([]);
            };
            all.onsuccess = () => {
              // biome-ignore lint/suspicious/noExplicitAny: raw IDB records
              const rows = (all.result || []) as any[];
              const out = rows.map((t) => ({
                name: String(t?.name ?? ''),
                // biome-ignore lint/suspicious/noExplicitAny: raw IDB records
                exercises: ((t?.exercises ?? []) as any[]).map((e) => ({
                  name: String(e?.exerciseName ?? e?.name ?? ''),
                  sets: Number(e?.targetSets ?? 0),
                  reps: Number(e?.targetReps ?? 0),
                })),
              }));
              db.close();
              resolve(out);
            };
          };
        })
    )
    .catch(() => [] as Db108Template[]);
}

/** Bottom nav → templates: "עוד" sheet then תבניות, the real user route. */
async function gotoTemplates(page: Page, why: string): Promise<string> {
  await coach108(page);
  if (await tap108(page, 'nav button[aria-label="עוד"]', `${why}: nav → עוד`, 3000)) {
    await page.waitForTimeout(700);
    if (await tap108(page, 'a[href="/templates"]', `${why}: עוד → תבניות`, 2500)) {
      await page.waitForTimeout(2200);
      return 'bottom nav → עוד → תבניות';
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  find108(
    'MEDIUM',
    why,
    'the templates screen is reachable from the bottom nav',
    'neither the nav nor its "עוד" sheet got there — deep-linked to /templates instead'
  );
  await page.goto('/templates', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return 'deep link /templates';
}

/** Wait out the templates screen's loading skeleton. */
async function settleTemplates(page: Page): Promise<Probe> {
  for (let i = 0; i < 8; i++) {
    const p = await probe108(page, `templates-settle-${i}`);
    if (/תבניות אימון/.test(p.text) || /אין תבניות עדיין/.test(p.text)) return p;
    await page.waitForTimeout(1200);
  }
  return probe108(page, 'templates-settle-final');
}

/** How many exercises the card for `name` claims, read from the card's stats line. */
function cardExerciseCount(text: string, name: string): string {
  const at = text.indexOf(name);
  if (at < 0) return '<card not on screen>';
  const after = text.slice(at, at + 220);
  const m = after.match(/(\d+)\s*תרגילים/);
  return m ? m[1] : '<no count on card>';
}

/** Leave an active workout through the header menu → בטל אימון → confirm. */
async function discardWorkout(page: Page, why: string): Promise<string> {
  if (await tap108(page, 'button[aria-label="עוד פעולות"]', `${why}: open workout menu`, 3000)) {
    await page.waitForTimeout(600);
    if (await tap108(page, 'button:has-text("בטל אימון")', `${why}: בטל אימון`, 2500)) {
      await page.waitForTimeout(900);
      const confirm = page.getByRole('button', { name: 'בטל אימון', exact: true }).last();
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click({ timeout: 5000 }).catch(() => {});
        log108.taps += 1;
        mark108(`${why}: confirm בטל אימון`);
      }
      await page.waitForTimeout(2500);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  return urlOf(page);
}

/** Push forward from whatever /workout/:id renders until the live set UI is up. */
async function reachLive(page: Page, why: string): Promise<boolean> {
  for (let hop = 0; hop < 4; hop++) {
    if (
      await page
        .locator('button[aria-label^="החליקו לסיום"]')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return true;
    }
    const p = await probe108(page, `${why}-hop-${hop}`);
    if (/להמשיך או להתחיל מחדש/.test(p.text)) {
      await tap108(page, 'button:has-text("התחל חדש")', `${why}: התחל חדש`, 2500);
      await page.waitForTimeout(2500);
      continue;
    }
    const forwards = [
      'button[aria-label^="התחל תבנית"]',
      'button[aria-label^="התחל אימון:"]',
      'button[aria-label="התחל אימון לפי התוכנית"]',
      'button:has-text("התחל אימון")',
    ];
    let moved = false;
    for (const sel of forwards) {
      if (await tap108(page, sel, `${why}: forward ${sel}`, 1200)) {
        moved = true;
        break;
      }
    }
    if (!moved) break;
    await page.waitForTimeout(2000);
  }
  return page
    .locator('button[aria-label^="החליקו לסיום"]')
    .first()
    .isVisible()
    .catch(() => false);
}

test('T-108 templates: see them, run them, build one, and get back out', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(OUT, { recursive: true });

  page.on('console', (m) => {
    if (m.type() === 'error') {
      log108.consoleErrors.push(`@${log108.timeline.length}| ${m.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (e) => {
    log108.pageErrors.push(`@${log108.timeline.length}| ${e.message.slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const line = `@${log108.timeline.length}| ${r.status()} ${r.request().method()} ${r.url().slice(0, 150)}`;
      if (!log108.notes.includes(line)) log108.notes.push(line);
    }
  });

  // ─────────────────────────────── A. COLD LAUNCH (genuinely first run)
  await phase108('A-cold-launch', async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      // biome-ignore lint/suspicious/noExplicitAny: feature-detect databases()
      const idb = indexedDB as any;
      if (typeof idb.databases === 'function') {
        const dbs = await idb.databases();
        await Promise.all(
          dbs.map(
            (d: { name?: string }) =>
              new Promise((res) => {
                if (!d.name) return res(null);
                const r = indexedDB.deleteDatabase(d.name);
                r.onsuccess = () => res(null);
                r.onerror = () => res(null);
                r.onblocked = () => res(null);
              })
          )
        );
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await probe108(page, 'A-launch');
    await gates108(page);
    if (!(await tap108(page, 'button:has-text("המשיכו כאורח")', 'continue as guest'))) {
      find108('HIGH', 'A-cold-launch', 'a guest entry point', 'no "המשיכו כאורח" button');
    }
    await page.waitForTimeout(1600);
    await gates108(page);
  });

  // ─────────────────────────────── B. ONBOARDING → HOME
  await phase108('B-onboarding', async () => {
    for (let i = 0; i < 8; i++) {
      const p = await probe108(page, `B-onboarding-${i}`);
      const stillWizard =
        /דלגו/.test(p.text) || p.controls.some((c) => /חזרה לשלב הקודם|בואו נתחיל/.test(c.name));
      if (!stillWizard) {
        note108(`onboarding done after ${i} screens`);
        break;
      }
      const inputs = page.locator('input:visible');
      const n = await inputs.count().catch(() => 0);
      for (let k = 0; k < n; k++) {
        const inp = inputs.nth(k);
        const type = (await inp.getAttribute('type').catch(() => '')) || 'text';
        if (await inp.inputValue().catch(() => '')) continue;
        if (type === 'number') await inp.fill('76').catch(() => {});
        else if (type === 'text') await inp.fill('אמית').catch(() => {});
      }
      let moved = false;
      for (const sel of [
        'button:has-text("בואו נתחיל")',
        'button:has-text("הבא")',
        'button:has-text("המשך")',
        'button:has-text("סיום")',
      ]) {
        const b = page.locator(sel).first();
        if (!(await b.isVisible().catch(() => false))) continue;
        if (await b.isDisabled().catch(() => false)) continue;
        await b.click({ timeout: 4000 }).catch(() => {});
        log108.taps += 1;
        mark108(`onboarding forward ${sel}`);
        moved = true;
        break;
      }
      if (!moved) {
        const card = page.getByRole('button', { name: /בניית שריר/ }).first();
        if (await card.isVisible().catch(() => false)) {
          await card.click({ timeout: 4000 }).catch(() => {});
          log108.taps += 1;
          moved = true;
        }
      }
      if (!moved) {
        const f = await shoot108(page, `B-onboarding-stuck-${i}`);
        find108('HIGH', `B-onboarding-${i}`, 'a way forward', 'nothing advanced', f);
        break;
      }
      await page.waitForTimeout(1100);
    }
    await gates108(page);
    await page.waitForTimeout(1200);
    await coach108(page);
    note108(`taps spent reaching home: ${log108.taps}`);
  });

  // ─────────────────────────────── P1a. ARE THE 5 BUILT-INS THERE?
  let templatesReached = false;
  await phase108('P1a-builtin-templates', async () => {
    log108.p1a_builtIns.reachedVia = await gotoTemplates(page, 'P1a');
    const t = await settleTemplates(page);
    templatesReached = /תבניות/.test(t.text);
    const frame = await shoot108(page, 'P1a-templates-screen');

    log108.p1a_builtIns.headerCount = (t.text.match(/(\d+)\s*תבניות אימון/) ?? [])[1] ?? '<none>';
    const startCtas = t.controls
      .map((c) => c.name)
      .filter((n) => /^התחל אימון:/.test(n) || /^הוסף תרגילים לתבנית:/.test(n));
    log108.p1a_builtIns.startCtas = startCtas;

    for (const b of BUILT_INS) {
      const onScreen = t.text.includes(b.name) || startCtas.some((c) => c.includes(b.name));
      if (onScreen) log108.p1a_builtIns.seen.push(b.name);
      else log108.p1a_builtIns.missing.push(b.name);
      log108.p1a_builtIns.cardExerciseCounts[b.name] = cardExerciseCount(t.text, b.name);
    }
    log108.p1a_builtIns.db = await templatesFromDb(page);
    flush108();
    note108(
      `templates screen: header says ${log108.p1a_builtIns.headerCount}; DB holds ${log108.p1a_builtIns.db.length}; seen=${JSON.stringify(log108.p1a_builtIns.seen)}`
    );

    const emptyState = /אין תבניות עדיין/.test(t.text);
    if (emptyState || log108.p1a_builtIns.seen.length === 0) {
      find108(
        'HIGH',
        'P1a-builtin-templates',
        'a new user opening the templates screen sees the 5 built-in ready-made templates',
        emptyState
          ? `the screen shows the empty state "אין תבניות עדיין" (DB holds ${log108.p1a_builtIns.db.length} templates)`
          : `none of the 5 built-in names is on screen. Screen reads: ${t.text.slice(0, 220)}`,
        frame
      );
      return;
    }
    if (log108.p1a_builtIns.missing.length > 0) {
      find108(
        'HIGH',
        'P1a-builtin-templates',
        `all 5 built-in templates are listed (${BUILT_INS.map((b) => b.name).join(', ')})`,
        `${log108.p1a_builtIns.missing.length} missing: ${log108.p1a_builtIns.missing.join(', ')} — screen lists ${log108.p1a_builtIns.seen.join(', ')}`,
        frame
      );
    }
    // Each built-in is supposed to arrive already holding 6–7 exercises.
    for (const b of BUILT_INS) {
      const shown = log108.p1a_builtIns.cardExerciseCounts[b.name];
      if (!log108.p1a_builtIns.seen.includes(b.name)) continue;
      if (shown === String(b.exercises)) continue;
      if (shown === '0') {
        find108(
          'HIGH',
          'P1a-builtin-templates',
          `"${b.name}" arrives holding ${b.exercises} exercises`,
          `its card says 0 תרגילים — the ready-made template is empty`,
          frame
        );
      } else {
        find108(
          'MEDIUM',
          'P1a-builtin-templates',
          `"${b.name}" holds ${b.exercises} exercises`,
          `its card says "${shown}"`,
          frame
        );
      }
    }
  });

  // ─────────────────────────────── P1b. TRAIN FROM A BUILT-IN TEMPLATE
  await phase108('P1b-workout-from-builtin', async () => {
    if (!templatesReached || !log108.p1a_builtIns.seen.includes('אימון כללי')) {
      unreached108('P1b workout from a built-in template', 'אימון כללי was not on the screen');
      return;
    }
    const started = await tap108(
      page,
      'button[aria-label="התחל אימון: אימון כללי"]',
      'P1b: start אימון כללי',
      4000
    );
    if (!started) {
      const f = await shoot108(page, 'P1b-no-start-cta');
      find108(
        'HIGH',
        'P1b-workout-from-builtin',
        'the built-in template card has a working start-workout control',
        'no "התחל אימון: אימון כללי" control responded',
        f
      );
      return;
    }
    await page.waitForTimeout(3000);
    await gates108(page);
    log108.p1b_fromBuiltIn.landedOn = urlOf(page);
    const live = await reachLive(page, 'P1b');
    log108.p1b_fromBuiltIn.liveReached = live;
    const w = await probe108(page, 'P1b-workout');
    flush108();

    if (!live) {
      const f = await shoot108(page, 'P1b-not-live');
      find108(
        'HIGH',
        'P1b-workout-from-builtin',
        'starting אימון כללי opens its live workout',
        `landed on ${urlOf(page)} with no set UI: ${w.text.slice(0, 220)}`,
        f
      );
    }

    // The exercise the app opened on, and what it thinks the set target is.
    log108.p1b_fromBuiltIn.currentExercise =
      (w.text.match(/סקוואט[^\n]*|לחיצת חזה[^\n]*|מתח[^\n]*/) ?? ['<none found>'])[0];
    log108.p1b_fromBuiltIn.setProgressAria =
      (await page
        .locator('[aria-label^="התקדמות סטים"]')
        .first()
        .getAttribute('aria-label')
        .catch(() => '')) || '<no set-progress control>';
    log108.p1b_fromBuiltIn.repsAria =
      (await page
        .locator('button[aria-label^="חזרות:"]')
        .first()
        .getAttribute('aria-label')
        .catch(() => '')) || '<no reps field>';
    flush108();

    // Its full exercise list, in order, from the drawer the nav opens.
    if (await tap108(page, 'button[aria-label="רשימת תרגילים"]', 'P1b: open exercise list', 3000)) {
      await page.waitForTimeout(1200);
      const d = await probe108(page, 'P1b-exercise-drawer');
      const positions = FULL_BODY.map((e) => ({ name: e.name, at: d.text.indexOf(e.name) }));
      log108.p1b_fromBuiltIn.drawerOrder = positions
        .filter((p) => p.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((p) => p.name);
      const present = positions.filter((p) => p.at >= 0);
      const missing = positions.filter((p) => p.at < 0).map((p) => p.name);
      log108.p1b_fromBuiltIn.orderMatches =
        present.length === FULL_BODY.length &&
        log108.p1b_fromBuiltIn.drawerOrder.join('|') ===
          FULL_BODY.map((e) => e.name).join('|');
      flush108();
      if (missing.length === FULL_BODY.length) {
        const f = await shoot108(page, 'P1b-drawer-empty');
        find108(
          'HIGH',
          'P1b-workout-from-builtin',
          'the workout started from אימון כללי contains that template\'s 7 exercises',
          `the exercise list names none of them: ${d.text.slice(0, 240)}`,
          f
        );
      } else if (missing.length > 0) {
        const f = await shoot108(page, 'P1b-drawer-partial');
        find108(
          'HIGH',
          'P1b-workout-from-builtin',
          `all 7 exercises of אימון כללי are in the workout (${FULL_BODY.map((e) => e.name).join(', ')})`,
          `${missing.length} missing: ${missing.join(', ')}`,
          f
        );
      } else if (log108.p1b_fromBuiltIn.orderMatches === false) {
        const f = await shoot108(page, 'P1b-drawer-order');
        find108(
          'MEDIUM',
          'P1b-workout-from-builtin',
          `the exercises appear in template order: ${FULL_BODY.map((e) => e.name).join(' → ')}`,
          `the list reads: ${log108.p1b_fromBuiltIn.drawerOrder.join(' → ')}`,
          f
        );
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(800);
      const closed = !/רשימת תרגילים/.test((await probe108(page, 'P1b-after-drawer-close')).text);
      log108.p2g_exits.push({
        screen: 'live workout → exercise-list drawer',
        uiExits: d.exits,
        navHome: false,
        escaped: closed ? 'Escape closed it' : 'Escape did not close it',
      });
      flush108();
    } else {
      note108('no "רשימת תרגילים" control — reading the exercise list from the screen text only');
      const seen = FULL_BODY.filter((e) => w.text.includes(e.name)).map((e) => e.name);
      log108.p1b_fromBuiltIn.drawerOrder = seen;
      if (seen.length === 0) {
        const f = await shoot108(page, 'P1b-no-template-exercises');
        find108(
          'HIGH',
          'P1b-workout-from-builtin',
          'the workout contains the exercises of אימון כללי',
          `none of them is on the workout screen: ${w.text.slice(0, 240)}`,
          f
        );
      }
    }

    // The first exercise is 4×8 in the template. Does the live screen agree?
    const totalSets = (log108.p1b_fromBuiltIn.setProgressAria.match(/מתוך\s*(\d+)/) ?? [])[1] ?? '';
    const firstIsSquat = /סקוואט/.test(log108.p1b_fromBuiltIn.currentExercise);
    if (live && firstIsSquat && totalSets && totalSets !== String(FULL_BODY[0].sets)) {
      const f = await shoot108(page, 'P1b-set-count-mismatch');
      find108(
        'HIGH',
        'P1b-workout-from-builtin',
        `the first exercise carries the template's ${FULL_BODY[0].sets} sets`,
        `the live screen says "${log108.p1b_fromBuiltIn.setProgressAria}"`,
        f
      );
    }
    note108(
      `P1b live: current="${log108.p1b_fromBuiltIn.currentExercise}" sets="${log108.p1b_fromBuiltIn.setProgressAria}" reps="${log108.p1b_fromBuiltIn.repsAria}"`
    );

    // P2g — can we get out of the live workout without saving?
    const before = urlOf(page);
    const wx = await probe108(page, 'P1b-exit-audit');
    const left = await discardWorkout(page, 'P1b');
    log108.p1b_fromBuiltIn.left = left;
    log108.p2g_exits.push({
      screen: `live workout from built-in (${before})`,
      uiExits: wx.exits,
      navHome: wx.controls.some((c) => c.name === 'בית'),
      escaped: left,
    });
    flush108();
    if (left.startsWith('/workout')) {
      const f = await shoot108(page, 'P1b-cannot-leave-workout');
      find108(
        'HIGH',
        'P1b-workout-from-builtin',
        'a workout started from a template can be abandoned (בטל אימון) and left',
        `still on ${left} after the cancel flow`,
        f
      );
    }
  });

  // ─────────────────────────────── P1c. CREATE A NEW TEMPLATE
  let myTemplateExists = false;
  await phase108('P1c-create-template', async () => {
    if (!urlOf(page).startsWith('/templates')) await gotoTemplates(page, 'P1c');
    await settleTemplates(page);
    const opened =
      (await tap108(page, 'button[aria-label="צור תבנית חדשה"]', 'P1c: create template', 3000)) ||
      (await tap108(page, 'button:has-text("צור תבנית ראשונה")', 'P1c: first template', 2000));
    if (!opened) {
      const f = await shoot108(page, 'P1c-no-create-control');
      find108('HIGH', 'P1c-create-template', 'a create-template control', 'none on the screen', f);
      unreached108('P1c/P1d/P1e', 'no create-template control');
      return;
    }
    await page.waitForTimeout(1000);
    const sheet = await probe108(page, 'P1c-create-sheet');
    log108.p2g_exits.push({
      screen: 'create-template sheet',
      uiExits: sheet.exits,
      navHome: false,
      escaped: '<tested after save>',
    });
    const nameInput = page.locator('input[data-template-name-input]').first();
    if (!(await nameInput.isVisible().catch(() => false))) {
      const f = await shoot108(page, 'P1c-no-name-field');
      find108('HIGH', 'P1c-create-template', 'a name field in the sheet', 'no [data-template-name-input]', f);
      return;
    }
    await nameInput.fill(MY_TEMPLATE).catch(() => {});
    mark108(`typed template name "${MY_TEMPLATE}"`);

    const submitted =
      (await tap108(page, 'form button[type="submit"]', 'P1c: submit new template', 3000)) ||
      (await tap108(page, 'button:has-text("צור תבנית")', 'P1c: submit (text)', 1500));
    if (!submitted) {
      const f = await shoot108(page, 'P1c-no-submit');
      find108('HIGH', 'P1c-create-template', 'a submit button on the sheet', 'none found', f);
      return;
    }
    await page.waitForTimeout(2600);
    const after = await probe108(page, 'P1c-after-create');
    log108.p1cd_myTemplate.createLandedOn = after.url;
    log108.p1cd_myTemplate.toast = /התבנית נשמרה/.test(after.text) ? 'התבנית נשמרה' : '<no toast seen>';
    log108.p1cd_myTemplate.cardAfterCreate = cardExerciseCount(after.text, MY_TEMPLATE);
    myTemplateExists = after.text.includes(MY_TEMPLATE);
    flush108();
    note108(
      `after save: url=${after.url} listed=${myTemplateExists} count="${log108.p1cd_myTemplate.cardAfterCreate}" toast=${log108.p1cd_myTemplate.toast}`
    );

    if (!after.url.startsWith('/templates')) {
      const f = await shoot108(page, 'P1c-thrown-off-screen');
      find108(
        'HIGH',
        'P1c-create-template',
        'saving a template leaves the user on the templates screen',
        `it navigated to ${after.url} instead`,
        f
      );
    }
    if (!myTemplateExists) {
      const f = await shoot108(page, 'P1c-template-not-listed');
      find108(
        'HIGH',
        'P1c-create-template',
        `the template just created ("${MY_TEMPLATE}") is listed`,
        `it is not on the screen: ${after.text.slice(0, 240)}`,
        f
      );
      if (/לא הצלחנו|נסה שוב|מגבלת/.test(after.text)) {
        find108(
          'HIGH',
          'P1c-create-template',
          'a guest can save a template they just built',
          `the app refused: ${(after.text.match(/[^\n]*(?:לא הצלחנו|נסה שוב|מגבלת)[^\n]*/) ?? [''])[0]}`
        );
      }
    }
  });

  // ─────────────────────────────── P1d. FILL IT, LEAVE, COME BACK
  await phase108('P1d-add-exercises-and-persist', async () => {
    if (!myTemplateExists) {
      unreached108('P1d add exercises to my template', 'the template was never listed');
      return;
    }
    const opened =
      (await tap108(
        page,
        `button[aria-label="הוסף תרגילים לתבנית: ${MY_TEMPLATE}"]`,
        'P1d: open my empty template',
        3000
      )) ||
      (await tap108(page, `button[aria-label="ערוך תבנית: ${MY_TEMPLATE}"]`, 'P1d: edit my template', 2000));
    if (!opened) {
      const f = await shoot108(page, 'P1d-no-way-in');
      find108(
        'HIGH',
        'P1d-add-exercises-and-persist',
        'an empty template can be opened to add exercises to it',
        'its card offers no way in',
        f
      );
      return;
    }
    await page.waitForTimeout(1200);
    const editor = await probe108(page, 'P1d-editor');
    note108(`editor title present: ${/עריכת תבנית/.test(editor.text)}; exits=${JSON.stringify(editor.exits)}`);
    if (!/עריכת תבנית/.test(editor.text)) {
      const f = await shoot108(page, 'P1d-not-editing');
      find108(
        'MEDIUM',
        'P1d-add-exercises-and-persist',
        'tapping "הוסף תרגילים" opens that template for editing (title "עריכת תבנית")',
        `the sheet reads: ${editor.text.slice(0, 200)}`,
        f
      );
    }

    let added = 0;
    for (const wanted of MY_EXERCISES) {
      const addLabel = added === 0 ? 'הוסף תרגיל ראשון' : 'הוסף תרגיל';
      const addBtn = page.getByRole('button', { name: addLabel, exact: true }).first();
      if (!(await addBtn.isVisible().catch(() => false))) {
        const f = await shoot108(page, `P1d-no-add-${added}`);
        find108(
          'HIGH',
          'P1d-add-exercises-and-persist',
          `a way to add exercise #${added + 1} (expected "${addLabel}")`,
          'the control is not on screen',
          f
        );
        break;
      }
      await addBtn.click({ timeout: 4000 }).catch(() => {});
      log108.taps += 1;
      mark108(`P1d: open picker (${addLabel})`);
      await page.waitForTimeout(900);

      const search = page.locator('input[aria-label="חפש תרגיל"]').first();
      if (await search.isVisible().catch(() => false)) {
        await search.fill(wanted).catch(() => {});
        await page.waitForTimeout(1100);
      } else {
        find108(
          'MEDIUM',
          'P1d-add-exercises-and-persist',
          'a search field in the template exercise picker',
          'no [aria-label="חפש תרגיל"] — picking from the unfiltered list'
        );
      }
      const picker = await probe108(page, `P1d-picker-${added}`);
      if (/אין תרגיל בשם הזה/.test(picker.text)) {
        note108(`picker found nothing for "${wanted}" — clearing the search and taking the first row`);
        await search.fill('').catch(() => {});
        await page.waitForTimeout(900);
      }
      const results = page.locator('button:visible');
      const rc = await results.count().catch(() => 0);
      let picked = '';
      for (let k = 0; k < rc; k++) {
        const b = results.nth(k);
        const aria = (await b.getAttribute('aria-label').catch(() => '')) ?? '';
        if (/סגור|סגירה|הסר|צור תבנית|שמור תבנית|הוסף תרגיל/.test(aria)) continue;
        const txt = ((await b.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 60) continue;
        if (/הוסף תרגיל|צור תבנית|שמור תבנית|בחר תרגיל|סגור|בית|אימון$|התקדמות|עוד|תזונה/.test(txt))
          continue;
        await b.click({ timeout: 3000 }).catch(() => {});
        log108.taps += 1;
        picked = txt;
        mark108(`P1d: picked "${txt.slice(0, 40)}"`);
        break;
      }
      await page.waitForTimeout(900);
      if (!picked) {
        const f = await shoot108(page, `P1d-picker-empty-${added}`);
        find108(
          'HIGH',
          'P1d-add-exercises-and-persist',
          'the template exercise picker lists something selectable',
          `nothing selectable for "${wanted}": ${picker.text.slice(0, 220)}`,
          f
        );
        break;
      }
      const chipCheck = await probe108(page, `P1d-after-add-${added}`);
      if (!chipCheck.text.includes(picked.split(' | ')[0].slice(0, 12))) {
        const f = await shoot108(page, `P1d-chip-missing-${added}`);
        find108(
          'HIGH',
          'P1d-add-exercises-and-persist',
          `the picked exercise "${picked.slice(0, 30)}" lands in the template being built`,
          `it is not in the sheet: ${chipCheck.text.slice(0, 220)}`,
          f
        );
      } else {
        added += 1;
        log108.p1cd_myTemplate.addedChips.push(picked.slice(0, 50));
        flush108();
      }
    }

    if (added === 0) {
      unreached108('P1d persistence check', 'no exercise could be added to the template');
      return;
    }
    const saved =
      (await tap108(page, 'form button[type="submit"]', 'P1d: save template', 3000)) ||
      (await tap108(page, 'button:has-text("שמור תבנית")', 'P1d: save (text)', 1500));
    if (!saved) {
      const f = await shoot108(page, 'P1d-no-save');
      find108('HIGH', 'P1d-add-exercises-and-persist', 'a save button on the editor', 'none found', f);
      return;
    }
    await page.waitForTimeout(2600);
    const afterSave = await probe108(page, 'P1d-after-save');
    log108.p1cd_myTemplate.countAfterEdit = cardExerciseCount(afterSave.text, MY_TEMPLATE);
    flush108();
    note108(`after adding ${added}: card says "${log108.p1cd_myTemplate.countAfterEdit}"`);
    if (log108.p1cd_myTemplate.countAfterEdit !== String(added)) {
      const f = await shoot108(page, 'P1d-count-wrong-after-save');
      find108(
        'HIGH',
        'P1d-add-exercises-and-persist',
        `the card counts the ${added} exercise(s) just added`,
        `it says "${log108.p1cd_myTemplate.countAfterEdit}"`,
        f
      );
    }

    // LEAVE the screen entirely, then come back the way a user would.
    await tap108(page, 'nav a[href="/"]', 'P1d: bottom nav → בית', 3000);
    await page.waitForTimeout(2000);
    await coach108(page);
    const home = urlOf(page);
    note108(`left templates → ${home}`);
    await gotoTemplates(page, 'P1d-return');
    const back = await settleTemplates(page);
    log108.p1cd_myTemplate.countAfterReturn = cardExerciseCount(back.text, MY_TEMPLATE);
    const db = await templatesFromDb(page);
    const mine = db.find((t) => t.name === MY_TEMPLATE);
    log108.p1cd_myTemplate.dbAfterReturn = mine ? mine.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`) : [];
    flush108();
    note108(
      `after leaving and returning: card="${log108.p1cd_myTemplate.countAfterReturn}" db=${JSON.stringify(log108.p1cd_myTemplate.dbAfterReturn)}`
    );
    if (!back.text.includes(MY_TEMPLATE)) {
      const f = await shoot108(page, 'P1d-template-vanished');
      find108(
        'HIGH',
        'P1d-add-exercises-and-persist',
        `"${MY_TEMPLATE}" is still listed after leaving the screen and coming back`,
        `it is gone: ${back.text.slice(0, 240)}`,
        f
      );
    } else if (log108.p1cd_myTemplate.countAfterReturn !== String(added)) {
      const f = await shoot108(page, 'P1d-exercises-vanished');
      find108(
        'HIGH',
        'P1d-add-exercises-and-persist',
        `the ${added} exercise(s) added are still on the template after leaving and returning`,
        `the card now says "${log108.p1cd_myTemplate.countAfterReturn}" (IndexedDB holds ${log108.p1cd_myTemplate.dbAfterReturn.length})`,
        f
      );
    }
  });

  // ─────────────────────────────── P1e. TRAIN FROM MY OWN TEMPLATE
  await phase108('P1e-workout-from-my-template', async () => {
    if (log108.p1cd_myTemplate.countAfterReturn === '' ) {
      unreached108('P1e workout from my template', 'the template never reached a usable state');
      return;
    }
    const started = await tap108(
      page,
      `button[aria-label="התחל אימון: ${MY_TEMPLATE}"]`,
      'P1e: start my template',
      4000
    );
    if (!started) {
      const f = await shoot108(page, 'P1e-no-start');
      find108(
        'HIGH',
        'P1e-workout-from-my-template',
        'the card for a template with exercises offers "התחל אימון"',
        'no start control responded on my template',
        f
      );
      return;
    }
    await page.waitForTimeout(3000);
    await gates108(page);
    const live = await reachLive(page, 'P1e');
    const w = await probe108(page, 'P1e-workout');
    log108.p1e_workoutFromMine.landedOn = urlOf(page);
    const chipNames = log108.p1cd_myTemplate.addedChips.map((c) => c.split(' | ')[0].slice(0, 12));
    log108.p1e_workoutFromMine.exercisesSeen = chipNames.filter((n) => n && w.text.includes(n));
    flush108();
    if (!live) {
      const f = await shoot108(page, 'P1e-not-live');
      find108(
        'HIGH',
        'P1e-workout-from-my-template',
        'starting my own template opens its live workout',
        `landed on ${urlOf(page)}: ${w.text.slice(0, 220)}`,
        f
      );
    } else if (log108.p1e_workoutFromMine.exercisesSeen.length === 0) {
      const f = await shoot108(page, 'P1e-exercises-missing');
      find108(
        'HIGH',
        'P1e-workout-from-my-template',
        `the workout contains the exercises put in "${MY_TEMPLATE}" (${chipNames.join(', ')})`,
        `none of them is on the workout screen: ${w.text.slice(0, 240)}`,
        f
      );
    }
    const ex = await probe108(page, 'P1e-exit-audit');
    const left = await discardWorkout(page, 'P1e');
    log108.p1e_workoutFromMine.left = left;
    log108.p2g_exits.push({
      screen: 'live workout from my template',
      uiExits: ex.exits,
      navHome: ex.controls.some((c) => c.name === 'בית'),
      escaped: left,
    });
    flush108();
  });

  // ─────────────────────────────── P2f. EVERY PROGRESS TAB, THEN OUT
  await phase108('P2f-progress-tabs-and-exit', async () => {
    const viaNav = await tap108(page, 'nav a[href="/progress"]', 'P2f: nav → התקדמות', 4000);
    if (!viaNav) {
      find108(
        'MEDIUM',
        'P2f-progress-tabs-and-exit',
        'Progress is reachable from the bottom nav',
        'no nav entry responded — deep-linked instead'
      );
      await page.goto('/progress', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(3000);
    await gates108(page);
    await coach108(page);
    const p = await probe108(page, 'P2f-progress');
    note108(`progress @${p.url}`);

    const TABS108 = [
      { key: 'overview', label: 'סקירה' },
      { key: 'workouts', label: 'אימונים' },
      { key: 'body', label: 'גוף' },
      { key: 'recovery', label: 'התאוששות' },
    ];
    for (const t of TABS108) {
      const btn = page.locator(`#progress-tab-${t.key}`).first();
      if (!(await btn.isVisible().catch(() => false))) {
        const f = await shoot108(page, `P2f-tab-missing-${t.key}`);
        find108(
          'HIGH',
          'P2f-progress-tabs-and-exit',
          `the "${t.label}" tab is on the Progress screen`,
          'the tab is not there',
          f
        );
        continue;
      }
      await btn.click({ timeout: 5000 }).catch(() => {});
      log108.taps += 1;
      mark108(`P2f: tab ${t.label}`);
      await page.waitForTimeout(1800);
      const selected = (await btn.getAttribute('aria-selected').catch(() => '')) ?? '';
      const panel = await page
        .locator('[role="tabpanel"]')
        .first()
        .innerText()
        .catch(() => '');
      const body = (panel || '').replace(/\s+/g, ' ').trim();
      log108.p2f_progress.tabs.push({
        tab: t.label,
        selected,
        heading: body.slice(0, 80),
        body: body.slice(0, 500),
      });
      flush108();
      if (selected !== 'true') {
        const f = await shoot108(page, `P2f-tab-dead-${t.key}`);
        find108(
          'HIGH',
          'P2f-progress-tabs-and-exit',
          `tapping "${t.label}" selects that tab`,
          `after the tap aria-selected is "${selected || '<absent>'}" — the tab did not take`,
          f
        );
      }
      if (!body) {
        const f = await shoot108(page, `P2f-tab-blank-${t.key}`);
        find108(
          'HIGH',
          'P2f-progress-tabs-and-exit',
          `the "${t.label}" tab renders content`,
          'its panel is empty',
          f
        );
      }
    }

    // Out via the bottom nav.
    const px = await probe108(page, 'P2f-progress-exit-audit');
    const wentHome = await tap108(page, 'nav a[href="/"]', 'P2f: nav → בית', 4000);
    await page.waitForTimeout(2200);
    log108.p2f_progress.exitViaBottomNav = `${wentHome ? 'tapped' : 'no nav home control'} → ${urlOf(page)}`;
    flush108();
    if (urlOf(page).split('?')[0] !== '/') {
      const f = await shoot108(page, 'P2f-nav-home-failed');
      find108(
        'HIGH',
        'P2f-progress-tabs-and-exit',
        'the bottom-nav בית tab leaves Progress and lands on the home screen',
        `it landed on ${urlOf(page)}`,
        f
      );
    }
    // Out via browser back.
    await tap108(page, 'nav a[href="/progress"]', 'P2f: back into progress', 3000);
    await page.waitForTimeout(2200);
    const inAgain = urlOf(page);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    log108.p2f_progress.exitViaBrowserBack = `${inAgain} → ${urlOf(page)}`;
    log108.p2g_exits.push({
      screen: '/progress',
      uiExits: px.exits,
      navHome: px.controls.some((c) => c.name === 'בית'),
      escaped: log108.p2f_progress.exitViaBrowserBack,
    });
    flush108();
    if (urlOf(page).split('?')[0].startsWith('/progress')) {
      const f = await shoot108(page, 'P2f-back-trapped');
      find108(
        'HIGH',
        'P2f-progress-tabs-and-exit',
        'browser back leaves the Progress screen',
        `back was swallowed: still on ${urlOf(page)}`,
        f
      );
    }
  });

  // ─────────────────────────────── P2g. CAN YOU GET OUT OF WHAT YOU OPENED?
  await phase108('P2g-exit-audit', async () => {
    // /templates itself: an in-page exit, the bottom nav, and browser back.
    await gotoTemplates(page, 'P2g');
    const t = await settleTemplates(page);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    const landed = urlOf(page).split('?')[0];
    log108.p2g_exits.push({
      screen: '/templates',
      uiExits: t.exits,
      navHome: t.controls.some((c) => c.name === 'בית'),
      escaped: `browser back → ${landed}`,
    });
    flush108();
    if (landed.startsWith('/templates')) {
      const f = await shoot108(page, 'P2g-templates-back-trapped');
      find108(
        'HIGH',
        'P2g-exit-audit',
        'browser back leaves the templates screen',
        `still on ${landed}`,
        f
      );
    }

    // The create sheet: Escape must close it, and the picker inside it must
    // close before the sheet (one Escape each).
    await gotoTemplates(page, 'P2g-sheet');
    await settleTemplates(page);
    if (await tap108(page, 'button[aria-label="צור תבנית חדשה"]', 'P2g: open create sheet', 3000)) {
      await page.waitForTimeout(1000);
      const openPicker = page.getByRole('button', { name: 'הוסף תרגיל ראשון', exact: true }).first();
      if (await openPicker.isVisible().catch(() => false)) {
        await openPicker.click({ timeout: 3000 }).catch(() => {});
        log108.taps += 1;
        await page.waitForTimeout(900);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(800);
        const afterFirst = await probe108(page, 'P2g-after-escape-1');
        const sheetStillOpen = await page
          .locator('input[data-template-name-input]')
          .first()
          .isVisible()
          .catch(() => false);
        const pickerClosed = !(await page
          .locator('input[aria-label="חפש תרגיל"]')
          .first()
          .isVisible()
          .catch(() => false));
        note108(`Escape #1: picker closed=${pickerClosed} sheet still open=${sheetStillOpen}`);
        if (!pickerClosed) {
          const f = await shoot108(page, 'P2g-picker-wont-close');
          find108(
            'MEDIUM',
            'P2g-exit-audit',
            'Escape closes the exercise picker inside the template sheet',
            'the picker stayed open',
            f
          );
        }
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(1000);
      const afterSecond = await probe108(page, 'P2g-after-escape-2');
      // Structural, NOT text: the templates screen carries its own "תבנית חדשה"
      // button, so a text match on the sheet title reports "still open" forever
      // (it did, in the first T-108 run — a harness bug, filed and retracted).
      // The name field only exists while the sheet is mounted.
      const closed = !(await page
        .locator('input[data-template-name-input]')
        .first()
        .isVisible()
        .catch(() => false));
      log108.p2g_exits.push({
        screen: 'create-template sheet (escape test)',
        uiExits: afterSecond.exits,
        navHome: false,
        escaped: closed ? 'Escape closed the sheet' : 'sheet stayed open after Escape',
      });
      flush108();
      if (!closed) {
        const sheetProbe = await probe108(page, 'P2g-sheet-stuck');
        let byButton = false;
        if (await tap108(page, 'button[aria-label="סגירה"]', 'P2g: sheet close button', 2000)) {
          await page.waitForTimeout(900);
          byButton = !(await page
            .locator('input[data-template-name-input]')
            .first()
            .isVisible()
            .catch(() => false));
        }
        const f = await shoot108(page, 'P2g-sheet-no-escape');
        find108(
          byButton ? 'MEDIUM' : 'HIGH',
          'P2g-exit-audit',
          'the template sheet can be dismissed without saving',
          `${byButton ? 'Escape did nothing; only the "סגירה" button closes it' : 'neither Escape nor a close control dismissed it'}. Controls: ${sheetProbe.controls.map((c) => c.name).filter(Boolean).join(' | ').slice(0, 200)}`,
          f
        );
      }
    }
  });

  // ─────────────────────────────── CONSOLE HEALTH
  await phase108('Z-console', async () => {
    const noise = /favicon|manifest|sw\.js|service worker|net::ERR|Failed to load resource|supabase|401|403|ERR_INTERNET/i;
    const real = log108.consoleErrors.filter((e) => !noise.test(e));
    note108(
      `console errors: ${log108.consoleErrors.length} (${real.length} not obvious network/PWA noise); uncaught page errors: ${log108.pageErrors.length}`
    );
    if (log108.pageErrors.length > 0) {
      find108(
        'HIGH',
        'Z-console',
        'no uncaught JavaScript error during a normal templates walk',
        `${log108.pageErrors.length} uncaught: ${log108.pageErrors.slice(0, 3).join(' || ')}`
      );
    }
    if (real.length > 0) {
      find108(
        'HIGH',
        'Z-console',
        'no console errors during a normal templates walk',
        `${real.length}: ${real.slice(0, 4).join(' || ')}`
      );
    }
  });

  log108.notes.push(
    `FINAL taps=${log108.taps} findings=${log108.findings.length} builtInsSeen=${log108.p1a_builtIns.seen.length}/5`
  );
  flush108();
});
