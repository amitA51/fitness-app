/**
 * VISUAL QA CAPTURE — not a regression test. Drives the app in guest mode and
 * captures full-page screenshots of the main surfaces in BOTH Fresh Steel
 * (light) and Obsidian (dark) so an agent can review coherence/contrast.
 * Output: ./visual-qa/*.png   Run: npx playwright test e2e/visual-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { test } from '@playwright/test';

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    const el = document.documentElement;
    el.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(250);
}

async function shoot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: `visual-qa/${name}.png`, fullPage: true });
}

async function both(page: import('@playwright/test').Page, name: string) {
  await setTheme(page, 'light');
  await shoot(page, `${name}-light`);
  await setTheme(page, 'dark');
  await shoot(page, `${name}-dark`);
  await setTheme(page, 'light');
}

test('capture main surfaces light + dark', async ({ page }) => {
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`[console.error] ${m.text()}`);
  });

  // 1) Login
  await page.goto('/');
  await page.waitForTimeout(1500);
  await both(page, '01-login');

  // 2) Seed a guest + onboarded session so the gate chain (age/consent are
  // fail-open for guests; onboarding_completed unblocks the app) is satisfied
  // and the REAL app screens render (empty-state is itself a key surface).
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
  await page.waitForTimeout(2500);

  // Dismiss first-run overlays (welcome-guide skip, then cookie consent).
  // Best-effort, force + short timeout so an intercept never hangs the run.
  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  log.push(`after-seed url=${page.url()}`);
  await both(page, '02-home-seeded');

  // 3) Walk the main routes directly; screenshot whatever renders.
  const routes: Array<[string, string]> = [
    ['/', '03-dashboard'],
    ['/nutrition', '04-nutrition'],
    ['/progress', '05-progress'],
    ['/program', '06-program'],
    ['/templates', '07-templates'],
    ['/settings', '08-settings'],
    ['/workout', '09-workout'],
  ];
  for (const [route, name] of routes) {
    try {
      await page.goto(route);
      await page.waitForTimeout(1800);
      log.push(
        `${route} -> url=${page.url()} head=${await page
          .locator('h1,h2')
          .first()
          .textContent()
          .catch(() => '?')}`
      );
      await both(page, name);
    } catch (e) {
      log.push(`${route} FAILED: ${String(e)}`);
    }
  }

  console.log(`VISUAL_QA_LOG:\n${log.join('\n')}`);
});


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

test('capture active workout flow', async ({ page }) => {
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`[err] ${m.text()}`);
  });
  await seedGuest(page);

  // Pre-workout screen (program day ready to start).
  await page.goto('/workout');
  await page.waitForTimeout(2200);
  await both(page, '10-preworkout');

  // Start the workout.
  const start = page
    .getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ })
    .first();
  if (await start.isVisible().catch(() => false)) {
    await start.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  log.push(`after-start url=${page.url()}`);
  await both(page, '11-active-workout');

  // We're on the exercise selector. Select two exercises, then confirm to reach
  // the live set-logging screen (the core "log a set" surface).
  for (const exName of ['בולגריאן ספליט סקוואט', 'בוקר טוב']) {
    const card = page.getByText(exName, { exact: false }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  const confirm = page.getByRole('button', { name: /התחל עם|התחל \(/ }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  log.push(`after-confirm url=${page.url()}`);
  await both(page, '12-goal-selector');

  // Select a goal to reach the live set-logging screen (the core surface).
  const goal = page
    .getByText('כללי', { exact: true })
    .or(page.getByText('כוח', { exact: true }))
    .first();
  if (await goal.isVisible().catch(() => false)) {
    await goal.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  log.push(`after-goal url=${page.url()}`);
  await both(page, '13-warmup-select');

  // Skip the warm-up to reach the actual set-logging screen.
  const skipWarmup = page.getByRole('button', { name: /דלג על חימום/ }).first();
  if (await skipWarmup.isVisible().catch(() => false)) {
    await skipWarmup.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  log.push(`after-skip-warmup url=${page.url()}`);
  await both(page, '14-set-logging');

  // Tap the first "+" stepper to log a value.
  const plus = page.locator('.step-btn.plus').first();
  if (await plus.isVisible().catch(() => false)) {
    await plus.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await both(page, '15-set-logging-after-plus');
  }

  // Open the exercise tutorial (⋯ → מדריך) to verify the MuscleMap integration.
  const more = page.getByRole('button', { name: 'עוד פעולות' }).first();
  if (await more.isVisible().catch(() => false)) {
    await more.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const guide = page
      .getByRole('button', { name: 'מדריך' })
      .or(page.getByText('מדריך', { exact: true }))
      .first();
    if (await guide.isVisible().catch(() => false)) {
      await guide.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      await both(page, '16-tutorial-musclemap');
    }
  }

  console.log(`WORKOUT_QA_LOG:\n${log.join('\n')}`);
});


test('capture coach surfaces light + dark', async ({ page }) => {
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`[err] ${m.text()}`);
  });
  await seedGuest(page);

  // Switch to the coach view via the masthead role toggle (מאמן).
  const coachToggle = page.getByRole('button', { name: 'מאמן' }).first();
  if (await coachToggle.isVisible().catch(() => false)) {
    await coachToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  log.push(`after-coach-toggle url=${page.url()}`);

  const routes: Array<[string, string]> = [
    ['/coach', '20-coach-home'],
    ['/coach/clients', '21-coach-clients'],
    ['/coach/programs', '22-coach-programs'],
    ['/coach/messages', '23-coach-messages'],
    ['/coach/invites', '24-coach-invites'],
  ];
  for (const [route, name] of routes) {
    try {
      await page.goto(route);
      await page.waitForTimeout(1800);
      log.push(
        `${route} -> url=${page.url()} head=${await page
          .locator('h1,h2')
          .first()
          .textContent()
          .catch(() => '?')}`
      );
      await both(page, name);
    } catch (e) {
      log.push(`${route} FAILED: ${String(e)}`);
    }
  }
  console.log(`COACH_QA_LOG:\n${log.join('\n')}`);
});


test('capture reachable overlays light + dark', async ({ page }) => {
  test.setTimeout(180_000);
  const log: string[] = [];
  await seedGuest(page);

  // "עוד" (more) bottom-sheet — the secondary-nav IA surface.
  await page.goto('/');
  await page.waitForTimeout(1500);
  const more = page.getByRole('link', { name: 'עוד' }).or(page.getByRole('button', { name: 'עוד' })).first();
  if (await more.isVisible().catch(() => false)) {
    await more.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await both(page, '30-more-sheet');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }

  // Nutrition goals editor (ערוך יעדים).
  await page.goto('/nutrition');
  await page.waitForTimeout(1800);
  const editGoals = page.getByRole('button', { name: /ערוך יעדים/ }).first();
  if (await editGoals.isVisible().catch(() => false)) {
    await editGoals.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    await both(page, '31-goals-editor');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }

  // Settings — scroll to the backup/restore (export) section.
  await page.goto('/settings');
  await page.waitForTimeout(1500);
  const restoreRow = page.getByText('שחזור מגיבוי (JSON)').first();
  if (await restoreRow.isVisible().catch(() => false)) {
    await restoreRow.scrollIntoViewIfNeeded().catch(() => {});
  } else {
    await page.evaluate(() => window.scrollTo(0, 1400));
  }
  await page.waitForTimeout(500);
  await both(page, '32-settings-backup-restore');

  console.log(`OVERLAY_QA_LOG:\n${log.join('\n')}`);
});

test('capture workout detail — muscle breakdown + map', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuest(page);

  // Seed a completed session straight into IndexedDB so /detail/<id> renders.
  await page.evaluate(
    (session) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sparkos-fitness-db');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('workout_sessions', 'readwrite');
          tx.objectStore('workout_sessions').put(session);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    {
      id: 'demo-detail-1',
      date: '2026-06-20',
      startTime: '2026-06-20T10:00:00.000Z',
      endTime: '2026-06-20T11:00:00.000Z',
      status: 'completed',
      duration: 3600,
      totalVolume: 4800,
      exercises: [
        {
          id: 'e1', exerciseId: 'bench', exerciseName: 'Bench Press', targetMuscle: 'Chest',
          notes: '', restSeconds: 90, isCompleted: true, order: 0,
          sets: [
            { setNumber: 1, reps: 8, weight: 60, isCompleted: true },
            { setNumber: 2, reps: 8, weight: 60, isCompleted: true },
          ],
        },
        {
          id: 'e2', exerciseId: 'squat', exerciseName: 'Squat', targetMuscle: 'Legs',
          notes: '', restSeconds: 120, isCompleted: true, order: 1,
          sets: [{ setNumber: 1, reps: 5, weight: 100, isCompleted: true }],
        },
        {
          id: 'e3', exerciseId: 'row', exerciseName: 'Row', targetMuscle: 'Back',
          notes: '', restSeconds: 90, isCompleted: true, order: 2,
          sets: [{ setNumber: 1, reps: 10, weight: 50, isCompleted: true }],
        },
      ],
    }
  );

  await page.goto('/detail/demo-detail-1');
  await page.waitForTimeout(2000);
  // Scroll the 'פילוח שרירים' (muscle breakdown) section into view.
  const breakdown = page.getByText('פילוח שרירים').first();
  if (await breakdown.isVisible().catch(() => false)) {
    await breakdown.scrollIntoViewIfNeeded().catch(() => {});
  }
  await page.waitForTimeout(500);
  await both(page, '40-workout-detail-muscles');
});


test('capture progress — weekly muscle map', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuest(page);

  await page.evaluate(
    (sessions) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sparkos-fitness-db');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('workout_sessions', 'readwrite');
          const store = tx.objectStore('workout_sessions');
          for (const s of sessions) store.put(s);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    (() => {
      const now = new Date().toISOString();
      const day = now.slice(0, 10);
      const set = (n: number, reps: number, weight: number) => ({
        setNumber: n,
        reps,
        weight,
        isCompleted: true,
      });
      const ex = (id: string, name: string, muscle: string, sets: unknown[]) => ({
        id,
        exerciseId: id,
        exerciseName: name,
        targetMuscle: muscle,
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
        sets,
      });
      return [
        {
          id: 'demo-p1', date: day, startTime: now, status: 'completed', duration: 3000,
          totalVolume: 3000,
          exercises: [
            ex('bench', 'Bench Press', 'Chest', [set(1, 8, 60), set(2, 8, 60)]),
            ex('tri', 'Pushdown', 'Triceps', [set(1, 12, 30)]),
          ],
        },
        {
          id: 'demo-p2', date: day, startTime: now, status: 'completed', duration: 3200,
          totalVolume: 4000,
          exercises: [
            ex('row', 'Row', 'Back', [set(1, 10, 50), set(2, 10, 50)]),
            ex('curl', 'Curl', 'Biceps', [set(1, 12, 15)]),
            ex('squat', 'Squat', 'Legs', [set(1, 5, 100)]),
          ],
        },
      ];
    })()
  );

  await page.goto('/progress');
  await page.waitForTimeout(2200);
  const card = page.getByText('חלוקת נפח · השבוע').first();
  if (await card.isVisible().catch(() => false)) {
    await card.scrollIntoViewIfNeeded().catch(() => {});
  }
  await page.waitForTimeout(500);
  await both(page, '41-progress-muscle-map');
});


test('capture exercise library — equipment filter + chips', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuest(page);

  await page.goto('/workout');
  await page.waitForTimeout(2200);

  // Start the workout to reach the exercise selector (ExerciseLibraryTab).
  const start = page
    .getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ })
    .first();
  if (await start.isVisible().catch(() => false)) {
    await start.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // The selector shows the filter (now with the equipment pills row) + cards
  // (now with Hebrew muscle + equipment chips).
  await both(page, '42-exercise-library');

  // Filter by barbell ("מוט") to show equipment filtering in action.
  const barbell = page.getByRole('button', { name: 'מוט' }).first();
  if (await barbell.isVisible().catch(() => false)) {
    await barbell.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    await both(page, '43-exercise-library-barbell');
  }

  // Open the create-exercise form (search to empty so the in-list create CTA
  // shows) to verify the new "ציוד" field + Hebrew select labels.
  const search = page.getByPlaceholder(/חיפוש תרגיל/).first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill('zzzzz');
    await page.waitForTimeout(600);
  }
  const createBtn = page.getByRole('button', { name: /צור תרגיל חדש/ }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await both(page, '44-exercise-form');
  }
});

test('capture progress workouts — calendar heatmap', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuest(page);

  await page.evaluate(
    (sessions) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sparkos-fitness-db');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('workout_sessions', 'readwrite');
          const store = tx.objectStore('workout_sessions');
          for (const s of sessions) store.put(s);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    (() => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const days = [...new Set([3, 8, 12, 15, 20, now.getDate()])];
      return days.map((d, i) => {
        const date = `${ym}-${String(d).padStart(2, '0')}`;
        return {
          id: `cal-${i}`,
          date,
          startTime: `${date}T09:00:00.000Z`,
          endTime: `${date}T10:00:00.000Z`,
          status: 'completed',
          duration: 3000,
          totalVolume: 3000,
          exercises: [
            {
              id: 'e',
              exerciseId: 'e',
              exerciseName: 'Bench',
              targetMuscle: 'Chest',
              notes: '',
              restSeconds: 90,
              isCompleted: true,
              order: 0,
              sets: [{ setNumber: 1, reps: 8, weight: 60, isCompleted: true }],
            },
          ],
        };
      });
    })()
  );

  await page.goto('/progress');
  await page.waitForTimeout(2000);

  // Switch to the "אימונים" (workouts) tab where the calendar now lives.
  const tab = page
    .getByRole('tab', { name: 'אימונים' })
    .or(page.getByRole('button', { name: 'אימונים' }))
    .first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const cal = page.getByText('לוח אימונים').first();
  if (await cal.isVisible().catch(() => false)) {
    await cal.scrollIntoViewIfNeeded().catch(() => {});
  }
  await page.waitForTimeout(600);
  await both(page, '45-progress-calendar');
});
