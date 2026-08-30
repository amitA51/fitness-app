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
      if (/הכפתור הגדול 'התחל אימון'/.test(raw.text)) {
        const hasThatButton = raw.controls.some((c) => /^התחל אימון$/.test(c.name.trim()));
        if (!hasThatButton) {
          const f = await shoot(page, '02-coach-copy-mismatch');
          find(
            'MEDIUM',
            '2-home',
            'the coach tells the user to press a button that exists',
            `it says press "התחל אימון" but home's buttons are "${raw.controls
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
