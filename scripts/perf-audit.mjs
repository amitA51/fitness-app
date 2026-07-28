/**
 * End-to-end performance + render audit (Playwright, Pixel-5 emulation).
 *
 * Measures, per route:
 *   - load timings (TTFB, FCP, LCP, DCL, load)
 *   - long tasks (count / total blocking-ish time) during load and while idle
 *   - React commit count during load, while idle, and per interaction
 *   - DOM node count, JS heap, transferred JS/CSS bytes
 *
 * React commits are counted by installing a minimal __REACT_DEVTOOLS_GLOBAL_HOOK__
 * shim before the app boots. Because the hook is present, React tags fibers with
 * ProfileMode, so `actualDuration > 0` identifies the components that actually
 * rendered in each commit (names are only readable against a dev server).
 *
 * Usage:
 *   node scripts/perf-audit.mjs                 # prod preview @ 4173, 4x CPU throttle
 *   node scripts/perf-audit.mjs --dev --port 5199
 *   PERF_CPU=1 node scripts/perf-audit.mjs      # no CPU throttling
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';

const argv = process.argv.slice(2);
const DEV = argv.includes('--dev');
const portArg = argv.indexOf('--port');
const PORT = portArg !== -1 ? argv[portArg + 1] : DEV ? '5199' : '4173';
const BASE = process.env.PERF_BASE || `http://localhost:${PORT}`;
const CPU = Number(process.env.PERF_CPU || 4);
const IDLE_MS = Number(process.env.PERF_IDLE_MS || 5000);
const ONLY = process.env.PERF_ONLY || '';
const OUT = path.resolve('reports', DEV ? 'perf-e2e-dev.json' : 'perf-e2e-prod.json');

/** Injected before any app script: perf observers + React commit counter. */
const initScript = () => {
  const P = {
    longTasks: [],
    lcp: 0,
    cls: 0,
    events: [],
    commits: [],
  };
  window.__PERF__ = P;

  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.longTasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.lcp = Math.max(P.lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) P.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        P.events.push({ name: e.name, dur: e.duration, start: e.startTime });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch {}

  // ---- React commit counter -------------------------------------------------
  const nameOf = (fiber) => {
    const t = fiber.type ?? fiber.elementType;
    const fnName = (f) => (f ? f.displayName || f.name : null);
    switch (fiber.tag) {
      case 3:
        return 'HostRoot';
      case 4:
        return 'Portal';
      case 7:
        return 'Fragment';
      case 9:
        return `Consumer(${t?._context?.displayName || t?.displayName || '?'})`;
      case 10: {
        const ctx = t?._context || t;
        return `Provider(${ctx?.displayName || fnName(ctx?.Provider) || '?'})`;
      }
      case 11:
        return `ForwardRef(${fnName(t?.render) || t?.displayName || '?'})`;
      case 13:
        return 'Suspense';
      case 14:
      case 15:
        return `Memo(${fnName(t?.type) || t?.displayName || '?'})`;
      case 16:
        return 'Lazy';
      case 22:
        return 'Offscreen';
      default:
        break;
    }
    if (typeof t === 'string') return t;
    if (typeof t === 'function') return fnName(t) || 'Anonymous';
    if (t && typeof t === 'object') {
      if (t.displayName) return t.displayName;
      if (t._context) return `Provider(${t._context.displayName || '?'})`;
      const inner = t.type || t.render;
      if (typeof inner === 'function') return `Wrapped(${fnName(inner) || '?'})`;
      return `obj:tag${fiber.tag}`;
    }
    return `tag:${fiber.tag}`;
  };

  // Fibers that bail out are cloned with PerformedWork stripped, but fibers in
  // untouched subtrees are not cloned at all and keep the flag from the last
  // time they rendered. actualStartTime (available because the hook enables
  // ProfileMode) gates on "rendered since the previous commit", removing those
  // false positives. Dev builds only.
  let lastCommitAt = 0;
  const walk = (root, sinceT) => {
    const rendered = [];
    const roots = [];
    // DFS carrying "an ancestor already rendered" so we can report the SHALLOWEST
    // components that rendered — i.e. where the update actually originated.
    const stack = [[root.current, false]];
    let nodes = 0;
    while (stack.length) {
      const [f, above] = stack.pop();
      if (!f) continue;
      nodes++;
      if (nodes > 60000) break;
      // flags & PerformedWork(1) is exactly what React DevTools uses to decide
      // "this component actually rendered".
      const fresh =
        typeof f.actualStartTime !== 'number' || f.actualStartTime < 0
          ? true
          : f.actualStartTime >= sinceT;
      const did = (f.flags & 1) !== 0 && fresh && f.tag !== 5 && f.tag !== 6;
      if (did) {
        rendered.push(nameOf(f));
        if (!above) roots.push(nameOf(f));
      }
      if (f.child) stack.push([f.child, above || did]);
      if (f.sibling) stack.push([f.sibling, above]);
    }
    return { rendered, roots };
  };

  let rid = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) {
      const id = ++rid;
      this.renderers.set(id, renderer);
      return id;
    },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      try {
        const { rendered, roots } = walk(root, lastCommitAt);
        lastCommitAt = performance.now();
        P.commits.push({ t: lastCommitAt, rendered, roots });
        if (P.commits.length > 3000) P.commits.shift();
      } catch {}
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    emit() {},
    on() {},
    off() {},
    sub() {
      return () => {};
    },
    getFiberRoots() {
      return new Set();
    },
    setStrictMode() {},
  };
};

const collect = async (page, sinceMs = 0) =>
  page.evaluate((since) => {
    const P = window.__PERF__ || { longTasks: [], commits: [], events: [], lcp: 0, cls: 0 };
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const res = performance.getEntriesByType('resource');
    const bytes = (re) =>
      Math.round(
        res
          .filter((r) => re.test(r.name))
          .reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0) / 1024
      );
    const lt = P.longTasks.filter((t) => t.start >= since);
    const commits = P.commits.filter((c) => c.t >= since);
    const tally = {};
    for (const c of commits) for (const n of c.rendered) tally[n] = (tally[n] || 0) + 1;
    const rootTally = {};
    for (const c of commits) for (const n of c.roots || []) rootTally[n] = (rootTally[n] || 0) + 1;
    return {
      ttfb: nav ? Math.round(nav.responseStart) : null,
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      fcp: Math.round(paints.find((p) => p.name === 'first-contentful-paint')?.startTime || 0),
      lcp: Math.round(P.lcp),
      cls: Number(P.cls.toFixed(4)),
      longTasks: lt.length,
      longTaskMs: Math.round(lt.reduce((s, t) => s + t.dur, 0)),
      longestTaskMs: Math.round(Math.max(0, ...lt.map((t) => t.dur))),
      slowEvents: P.events
        .filter((e) => e.start >= since && e.dur >= 100)
        .map((e) => `${e.name}:${Math.round(e.dur)}ms`),
      commits: commits.length,
      topRendered: Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([n, c]) => `${n} x${c}`),
      updateRoots: Object.entries(rootTally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([n, c]) => `${n} x${c}`),
      renderedPerCommit: commits.length
        ? Number((Object.values(tally).reduce((s, n) => s + n, 0) / commits.length).toFixed(1))
        : 0,
      domNodes: document.getElementsByTagName('*').length,
      heapMB: performance.memory
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : null,
      jsKB: bytes(/\.js(\?|$)/),
      cssKB: bytes(/\.css(\?|$)/),
      resources: res.length,
    };
  }, sinceMs);

const now = (page) => page.evaluate(() => performance.now());

/** Seed as an onboarded guest BEFORE first paint so cold-load numbers are real
 *  (a seed-then-reload flow would warm the HTTP cache and hide transfer cost). */
const seedScript = () => {
  try {
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
  } catch {}
};

const dismissOverlays = async (page) => {
  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
};

const ROUTES = [
  ['/', 'Dashboard'],
  ['/workout', 'Workout (pre-workout)'],
  ['/progress', 'Progress'],
  ['/nutrition', 'Nutrition'],
  ['/templates', 'Templates'],
  ['/program', 'Program'],
  ['/settings', 'Settings'],
];

const run = async () => {
  const browser = await chromium.launch();
  const results = { base: BASE, dev: DEV, cpuThrottle: CPU, routes: {}, scenarios: {} };

  const newPage = async () => {
    const ctx = await browser.newContext({
      ...devices['Pixel 5'],
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
    });
    await ctx.addInitScript(seedScript);
    await ctx.addInitScript(initScript);
    const page = await ctx.newPage();
    // Real transfer accounting via CDP (resource timing reports 0 for cached
    // hits and vite preview omits content-length on chunked responses).
    const wire = { js: 0, css: 0, font: 0, img: 0, other: 0, requests: 0 };
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    const types = new Map();
    cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
    cdp.on('Network.loadingFinished', (e) => {
      const t = types.get(e.requestId);
      const len = e.encodedDataLength || 0;
      wire.requests++;
      if (t === 'Script') wire.js += len;
      else if (t === 'Stylesheet') wire.css += len;
      else if (t === 'Font') wire.font += len;
      else if (t === 'Image') wire.img += len;
      else wire.other += len;
    });
    if (CPU > 1) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    }
    return { ctx, page, wire };
  };

  const wireKB = (w) => ({
    jsKB: Math.round(w.js / 1024),
    cssKB: Math.round(w.css / 1024),
    fontKB: Math.round(w.font / 1024),
    imgKB: Math.round(w.img / 1024),
    requests: w.requests,
  });

  // ---------- 1. Cold load per route (fresh context each time) ----------
  for (const [route, label] of ONLY && !ONLY.includes('routes') ? [] : ROUTES) {
    const { ctx, page, wire } = await newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(BASE + route, { waitUntil: 'load' });
      await page.waitForTimeout(2500);
      const load = await collect(page, 0);
      const transfer = wireKB(wire);
      await dismissOverlays(page);

      // idle window: no input at all — anything rendering here is timer/subscription churn
      const t0 = await now(page);
      await page.waitForTimeout(IDLE_MS);
      const idle = await collect(page, t0);

      results.routes[route] = {
        label,
        load: { ...load, transfer },
        idle: {
          seconds: IDLE_MS / 1000,
          commits: idle.commits,
          commitsPerSec: Number((idle.commits / (IDLE_MS / 1000)).toFixed(2)),
          longTasks: idle.longTasks,
          longTaskMs: idle.longTaskMs,
          topRendered: idle.topRendered,
          updateRoots: idle.updateRoots,
          renderedPerCommit: idle.renderedPerCommit,
        },
        pageErrors: errors.slice(0, 5),
      };
      console.log(
        `${route.padEnd(12)} FCP ${load.fcp}ms LCP ${load.lcp}ms CLS ${load.cls} JS ${transfer.jsKB}kB(${transfer.requests}req) DOM ${load.domNodes} commits(load) ${load.commits} longTasks ${load.longTasks}/${load.longTaskMs}ms(max ${load.longestTaskMs}) | idle commits/s ${results.routes[route].idle.commitsPerSec}`
      );
    } catch (e) {
      results.routes[route] = { label, error: String(e) };
      console.log(`${route} FAILED: ${e}`);
    }
    await ctx.close();
  }

  // ---------- 2. Client-side navigation cost ----------
  if (!ONLY || ONLY.includes('nav')) {
    const { ctx, page } = await newPage();
    try {
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await dismissOverlays(page);
      await page.waitForTimeout(1500);
      const navs = [];
      for (const [route] of ROUTES.slice(1)) {
        const t0 = await now(page);
        const start = Date.now();
        // In-app navigation via the router (no full reload) where a tab exists,
        // otherwise fall back to history pushState through the link.
        await page.evaluate((r) => {
          window.history.pushState({}, '', r);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, route);
        await page.waitForTimeout(1500);
        const m = await collect(page, t0);
        navs.push({
          route,
          wallMs: Date.now() - start,
          commits: m.commits,
          longTasks: m.longTasks,
          longTaskMs: m.longTaskMs,
          longestTaskMs: m.longestTaskMs,
          domNodes: m.domNodes,
          heapMB: m.heapMB,
        });
      }
      results.scenarios.navigation = navs;
      console.log(
        `spa-nav ${navs.map((n) => `${n.route}:${n.commits}c/${n.longTaskMs}ms`).join(' ')}`
      );
    } catch (e) {
      results.scenarios.navigation = { error: String(e) };
    }
    await ctx.close();
  }

  // ---------- 3. Active workout: start, log a set, idle with rest timer ----------
  if (!ONLY || ONLY.includes('workout')) {
    const { ctx, page } = await newPage();
    const steps = {};
    try {
      await page.goto(BASE + '/workout', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await dismissOverlays(page);

      const click = async (locator, waitMs = 2000) => {
        if (await locator.isVisible().catch(() => false)) {
          await locator.click({ force: true, timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(waitMs);
          return true;
        }
        return false;
      };

      steps.started = await click(
        page.getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ }).first(),
        3000
      );

      // Exercise picker: measure the cost of rendering the full built-in catalog.
      const cards = page.locator('.exercise-card[role="button"]');
      steps.cardCount = await cards.count();
      const pickerMetrics = await collect(page, 0);
      steps.pickerDomNodes = pickerMetrics.domNodes;

      let t0 = await now(page);
      for (let i = 0; i < 2 && i < steps.cardCount; i++) {
        await cards.nth(i).click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
      const selectMetrics = await collect(page, t0);
      steps.commitsPerCardTap = selectMetrics.commits;

      steps.confirmed = await click(
        page.locator('button').filter({ hasText: /\(2\)/ }).first(),
        2500
      );
      steps.goal = await click(
        page.getByText('כללי', { exact: true }).or(page.getByText('כוח', { exact: true })).first(),
        2800
      );
      steps.warmupSkipped = await click(
        page.getByRole('button', { name: /דלג על חימום/ }).first(),
        2800
      );
      steps.url = page.url();
      const plus = page.locator('button').filter({ hasText: /^\+$/ }).first();
      steps.hasStepper = await plus.isVisible().catch(() => false);

      // idle on the set-logging screen (elapsed timer runs here)
      t0 = await now(page);
      await page.waitForTimeout(IDLE_MS);
      const idle = await collect(page, t0);

      // stepper taps
      const taps = [];
      if (steps.hasStepper) {
        for (let i = 0; i < 5; i++) {
          t0 = await now(page);
          await plus.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
          const m = await collect(page, t0);
          taps.push({
            commits: m.commits,
            longTasks: m.longTasks,
            longTaskMs: m.longTaskMs,
            slowEvents: m.slowEvents,
            rendered: m.topRendered.slice(0, 10),
            updateRoots: m.updateRoots,
            renderedPerCommit: m.renderedPerCommit,
          });
        }
      }

      // mark the set done (the swipe track is keyboard-activatable) -> rest timer
      const doneTrack = page.getByRole('button', { name: /החלק לסיום סט/ }).first();
      let completed = false;
      if (await doneTrack.isVisible().catch(() => false)) {
        await doneTrack.focus().catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(1500);
        completed = true;
      }
      t0 = await now(page);
      await page.waitForTimeout(IDLE_MS);
      const restIdle = await collect(page, t0);

      const full = await collect(page, 0);
      results.scenarios.activeWorkout = {
        steps,
        setLoggingIdle: {
          seconds: IDLE_MS / 1000,
          commits: idle.commits,
          commitsPerSec: Number((idle.commits / (IDLE_MS / 1000)).toFixed(2)),
          longTasks: idle.longTasks,
          longTaskMs: idle.longTaskMs,
          topRendered: idle.topRendered,
          updateRoots: idle.updateRoots,
          renderedPerCommit: idle.renderedPerCommit,
        },
        stepperTaps: taps,
        setCompleted: completed,
        restTimerIdle: {
          seconds: IDLE_MS / 1000,
          commits: restIdle.commits,
          commitsPerSec: Number((restIdle.commits / (IDLE_MS / 1000)).toFixed(2)),
          longTasks: restIdle.longTasks,
          longTaskMs: restIdle.longTaskMs,
          topRendered: restIdle.topRendered,
          updateRoots: restIdle.updateRoots,
          renderedPerCommit: restIdle.renderedPerCommit,
        },
        totals: {
          jsKB: full.jsKB,
          domNodes: full.domNodes,
          heapMB: full.heapMB,
          slowEvents: full.slowEvents,
          longTaskMs: full.longTaskMs,
        },
      };
      console.log(
        `active-workout idle commits/s ${results.scenarios.activeWorkout.setLoggingIdle.commitsPerSec} | rest-timer commits/s ${results.scenarios.activeWorkout.restTimerIdle.commitsPerSec} | tap commits ${taps.map((t) => t.commits).join(',')} | JS ${full.jsKB}kB DOM ${full.domNodes}`
      );
    } catch (e) {
      results.scenarios.activeWorkout = { steps, error: String(e) };
      console.log(`active-workout FAILED: ${e}`);
    }
    await ctx.close();
  }

  // ---------- 4. Exercise library: search typing cost ----------
  if (!ONLY || ONLY.includes('search')) {
    const { ctx, page } = await newPage();
    try {
      await page.goto(BASE + '/workout', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      await dismissOverlays(page);
      const start = page
        .getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ })
        .first();
      if (await start.isVisible().catch(() => false)) {
        await start.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
      }
      const search = page.locator('input[type="search"], input[type="text"]').first();
      const out = { found: false, cards: await page.locator('.exercise-card[role="button"]').count() };
      if (await search.isVisible().catch(() => false)) {
        out.found = true;
        const t0 = await now(page);
        await search.click({ force: true }).catch(() => {});
        await search.type('סקוו', { delay: 150 });
        await page.waitForTimeout(1200);
        const m = await collect(page, t0);
        out.commits = m.commits;
        out.longTasks = m.longTasks;
        out.longTaskMs = m.longTaskMs;
        out.longestTaskMs = m.longestTaskMs;
        out.slowEvents = m.slowEvents;
        out.domNodesAfter = m.domNodes;
        out.cardsAfter = await page.locator('.exercise-card[role="button"]').count();
        out.topRendered = m.topRendered;
        out.updateRoots = m.updateRoots;
        out.renderedPerCommit = m.renderedPerCommit;
      }
      results.scenarios.exerciseSearch = out;
      console.log(
        `exercise-search cards ${out.cards}->${out.cardsAfter} commits ${out.commits} longTasks ${out.longTasks}/${out.longTaskMs}ms(max ${out.longestTaskMs}) slowEvents ${(out.slowEvents || []).join(',')}`
      );
    } catch (e) {
      results.scenarios.exerciseSearch = { error: String(e) };
    }
    await ctx.close();
  }

  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nwrote ${OUT}`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
