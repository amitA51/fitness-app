/**
 * VISUAL QA CAPTURE — not a regression test. Drives the app in guest mode and
 * captures full-page screenshots of the main surfaces in BOTH Fresh Steel
 * (light) and Obsidian (dark) so an agent can review coherence/contrast.
 * Output: ./visual-qa/*.png   Run: npx playwright test e2e/visual-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { expect, test } from '@playwright/test';

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
    /* /nutrition is gated (NUTRITION_TRAINEE_UI_ENABLED=false + NutritionGuard):
       for a non-admin it REDIRECTS home, so this entry used to file a dashboard
       screenshot under the name "04-nutrition" — evidence that lies. Kept, but
       renamed to what it actually photographs: the redirect target. */
    ['/nutrition', '04-nutrition-gate-redirect'],
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

  /* REMOVED: the nutrition goals editor (ערוך יעדים).
     It lived behind /nutrition, which NUTRITION_TRAINEE_UI_ENABLED=false now
     redirects home for every non-admin. The block still "passed": it navigated,
     found no button, and filed the dashboard as 31-goals-editor. There is no
     guest-reachable replacement for this overlay — capturing it needs an
     app_admins session, which this suite has no way to mint — so it is deleted
     rather than pointed at a lookalike. See reports/visual-qa-14bd.md. */

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


test('capture exercise alternatives — choose from library', async ({ page }) => {
  test.setTimeout(180_000);
  await seedGuest(page);

  await page.goto('/workout');
  await page.waitForTimeout(2200);
  const start = page
    .getByRole('button', { name: /התחל את האימון|התחל אימון|התחילו אימון/ })
    .first();
  if (await start.isVisible().catch(() => false)) {
    await start.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // Pick one exercise + confirm to reach the live set screen.
  const card = page.getByText('בולגריאן ספליט סקוואט', { exact: false }).first();
  if (await card.isVisible().catch(() => false)) {
    await card.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  const confirm = page.getByRole('button', { name: /התחל עם|התחל \(/ }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  const goal = page
    .getByText('כללי', { exact: true })
    .or(page.getByText('כוח', { exact: true }))
    .first();
  if (await goal.isVisible().catch(() => false)) {
    await goal.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  const skipWarmup = page.getByRole('button', { name: /דלג על חימום/ }).first();
  if (await skipWarmup.isVisible().catch(() => false)) {
    await skipWarmup.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  // Open the exercise tools sheet (כלים) → "תרגילים חלופיים" → AlternativesSheet.
  const tools = page.getByRole('button', { name: 'כלים' }).first();
  if (await tools.isVisible().catch(() => false)) {
    await tools.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const alt = page.getByText('תרגילים חלופיים').first();
    if (await alt.isVisible().catch(() => false)) {
      await alt.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
      await both(page, '46-alternatives-sheet');

      // Switch to the library picker (built-ins + custom).
      const lib = page.getByRole('button', { name: /בחר מהספרייה/ }).first();
      if (await lib.isVisible().catch(() => false)) {
        await lib.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1200);
        await both(page, '47-alternatives-library');
      }
    }
  }
});

test('capture program warmup — skip-warmup-set button', async ({ page }) => {
  test.setTimeout(180_000);
  await seedGuest(page);

  // Start a real program day (BBT) — its exercises carry warmup sets.
  await page.goto('/program');
  await page.waitForTimeout(2200);
  const startDay = page.getByRole('button', { name: /התחל את האימון/ }).first();
  if (await startDay.isVisible().catch(() => false)) {
    await startDay.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  // PreWorkoutScreen → commit the workout (a second "התחל את האימון").
  const startWorkout = page.getByRole('button', { name: /התחל את האימון|התחל אימון/ }).first();
  if (await startWorkout.isVisible().catch(() => false)) {
    await startWorkout.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  // Goal selector (if shown).
  const goal = page
    .getByText('כללי', { exact: true })
    .or(page.getByText('כוח', { exact: true }))
    .first();
  if (await goal.isVisible().catch(() => false)) {
    await goal.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  // Skip the guided warmup ROUTINE to reach set-logging.
  const skipWarmup = page.getByRole('button', { name: /דלג על חימום/ }).first();
  if (await skipWarmup.isVisible().catch(() => false)) {
    await skipWarmup.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2800);
  }
  // The first SET of a program exercise is a warmup ⇒ the per-set
  // "דלג על סט החימום" affordance is shown (feature 1, already implemented).
  await both(page, '48-program-warmup-skip');
});

// ============================================================================
// 14bd — HIGH-CONTRAST MATRIX + NEVER-PHOTOGRAPHED SURFACES
// ============================================================================
// Added for the visual-QA pass on 14b3dbd. Everything below MEASURES rendered
// pixels rather than trusting the token arithmetic in tokens.css:
//
//   • the fill of a surface is the MODAL pixel colour of its element screenshot
//   • its ink is the pixel colour, occupying >=0.8% of that element, with the
//     greatest WCAG contrast against the fill (antialiasing fringe is below the
//     floor and cannot win)
//   • every ratio printed is computed from those two sampled colours
//
// Theme state is applied through the REAL product path — the `appSettings`
// record SettingsContext owns (darkMode + workoutSettings.highContrast) — read,
// mutated and written back so the stored shape is preserved, then reloaded so
// the provider itself paints <html>. The classes are asserted afterwards, so a
// combo that silently failed to apply fails the capture instead of filing a
// mislabelled PNG.
//
// Viewports are 390x1500 / 1280x1500 because `fullPage: true` captures only the
// first viewport in this app (the scrolling box is an inner MAIN, not the
// document).
// ============================================================================

type Rgb = [number, number, number];

interface Reading {
  surface: string;
  combo: string;
  viewport: string;
  png: string;
  fill: string;
  ink: string;
  inkOnFill: number;
  extra: Record<string, number>;
  note?: string;
}

const READINGS: Reading[] = [];
const MISSES: string[] = [];

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

function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
}

/** WCAG 2.x contrast ratio, rounded to 2dp. */
function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Modal fill + the extreme significant colours, sampled from real pixels.
 *
 * `ink` is the significant colour with the greatest contrast against the fill.
 * `inkShare` is published alongside it because on a wide element with small
 * text the glyph core is a genuinely tiny fraction of the pixels — a low share
 * means "this is a thin figure", not "this measurement is wrong", and a share
 * at the floor means the ink may be an antialiasing fringe rather than the
 * declared colour. Nothing downstream has to guess.
 */
async function palette(buf: Buffer): Promise<{
  fill: Rgb;
  fillShare: number;
  ink: Rgb;
  inkOnFill: number;
  inkShare: number;
  darkest: Rgb;
  lightest: Rgb;
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
  const fillShare = Math.round(((sorted[0]?.[1] ?? 0) / total) * 1000) / 1000;
  const SIGNIFICANT = 0.005;
  let ink = fill;
  let best = 1;
  let inkShare = fillShare;
  let darkest = fill;
  let lightest = fill;
  for (const [key, n] of sorted) {
    if (n / total < SIGNIFICANT) continue;
    const c = parse(key);
    const r = contrast(c, fill);
    if (r > best) {
      best = r;
      ink = c;
      inkShare = Math.round((n / total) * 1000) / 1000;
    }
    if (luminance(c) < luminance(darkest)) darkest = c;
    if (luminance(c) > luminance(lightest)) lightest = c;
  }
  return { fill, fillShare, ink, inkOnFill: best, inkShare, darkest, lightest };
}

/** Apply a theme combo the way the product does, then prove it landed. */
async function applyCombo(
  page: import('@playwright/test').Page,
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
        JSON.stringify({ ...stored, darkMode: dark, workoutSettings: { ...workout, highContrast: hc } })
      );
    },
    { dark: combo.dark, hc: combo.hc }
  );
  await page.reload();
  await page.waitForTimeout(1400);
  const applied = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    hc: document.documentElement.classList.contains('high-contrast'),
  }));
  expect(applied, `combo ${combo.id} must actually be on <html>`).toEqual({
    dark: combo.dark,
    hc: combo.hc,
  });
}

/** Resolved token values — exact, and a cross-check on the sampled pixels. */
async function tokenSnapshot(page: import('@playwright/test').Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const names = [
      '--fs-bg',
      '--fs-surface',
      '--fs-surface-2',
      '--fs-ink',
      '--fs-accent',
      '--fs-plate',
      '--nav-pill-bg',
      '--nav-pill-text',
      '--nav-bg',
      '--btn-primary-bg',
      '--btn-primary-text',
      '--btn-primary-bg-hover',
      '--color-surface-hover',
      '--fs-link',
      '--color-ink-on-accent',
    ];
    const out: Record<string, string> = {};
    for (const n of names) out[n] = cs.getPropertyValue(n).trim();
    return out;
  });
}

async function shootEl(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
  surface: string,
  combo: string,
  viewport: string,
  extra: Record<string, Rgb> = {}
): Promise<Rgb | null> {
  const el = locator.first();
  if (!(await el.isVisible().catch(() => false))) {
    MISSES.push(`${surface} @ ${combo}/${viewport}: element not visible`);
    return null;
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const png = `hc-${surface}-${combo}-${viewport}.png`;
  const buf = await el.screenshot({ path: `visual-qa/${png}` });
  const p = await palette(buf);
  const ratios: Record<string, number> = {};
  for (const [label, ref] of Object.entries(extra)) ratios[label] = contrast(p.fill, ref);
  ratios.fillShare = p.fillShare;
  ratios.inkShare = p.inkShare;
  ratios.darkestOnFill = contrast(p.darkest, p.fill);
  ratios.lightestOnFill = contrast(p.lightest, p.fill);
  READINGS.push({
    surface,
    combo,
    viewport,
    png,
    fill: toHex(p.fill),
    ink: `${toHex(p.ink)} (dark ${toHex(p.darkest)} / light ${toHex(p.lightest)})`,
    inkOnFill: p.inkOnFill,
    extra: ratios,
  });
  return p.fill;
}

/** Modal colour of an arbitrary viewport band — used for "the surface behind X". */
async function sampleBand(
  page: import('@playwright/test').Page,
  box: { x: number; y: number; width: number; height: number }
): Promise<Rgb | null> {
  const vp = page.viewportSize();
  if (!vp) return null;
  const clip = {
    x: Math.max(0, Math.min(box.x, vp.width - 2)),
    y: Math.max(0, Math.min(box.y, vp.height - 2)),
    width: Math.max(2, Math.min(box.width, vp.width - box.x)),
    height: Math.max(2, Math.min(box.height, vp.height - box.y)),
  };
  const buf = await page.screenshot({ clip });
  return (await palette(buf)).fill;
}

async function flushReadings(tag: string): Promise<void> {
  const fs = await import('node:fs');
  fs.mkdirSync('visual-qa', { recursive: true });
  fs.writeFileSync(
    `visual-qa/measure-${tag}.json`,
    JSON.stringify({ commit: '14b3dbd', tag, readings: READINGS, misses: MISSES }, null, 2),
    'utf8'
  );
}

/** Guest seed + a clean slate: no persisted workout can resume under a capture. */
async function seedFixture(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    // Every IndexedDB store, not just the app's own — an orphaned db from an
    // earlier combo is exactly how a stale in-progress workout resurfaces.
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
  await seedGuest(page);
}

/** Local (not UTC) date key — the week strip keys cells by local calendar day. */
function localDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function putRecords(
  page: import('@playwright/test').Page,
  store: string,
  records: unknown[]
): Promise<void> {
  await page.evaluate(
    ({ store, records }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sparkos-fitness-db');
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(store)) {
            db.close();
            return reject(new Error(`missing store ${store}`));
          }
          const tx = db.transaction(store, 'readwrite');
          const os = tx.objectStore(store);
          for (const r of records) os.put(r);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    { store, records }
  );
}

function completedSession(id: string, date: string) {
  return {
    id,
    date,
    startTime: `${date}T09:00:00.000Z`,
    endTime: `${date}T10:00:00.000Z`,
    status: 'completed',
    duration: 3300,
    totalVolume: 4200,
    exercises: [
      {
        id: 'e1',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
        sets: [
          { setNumber: 1, reps: 8, weight: 60, isCompleted: true },
          { setNumber: 2, reps: 8, weight: 62.5, isCompleted: true },
        ],
      },
      {
        id: 'e2',
        exerciseId: 'squat',
        exerciseName: 'Squat',
        targetMuscle: 'Legs',
        notes: '',
        restSeconds: 120,
        isCompleted: true,
        order: 1,
        sets: [{ setNumber: 1, reps: 5, weight: 100, isCompleted: true }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// A) Home: week strip, bottom-nav selected pill, interactive-card hover
// ---------------------------------------------------------------------------
test('14bd — home, week strip, nav pill, card hover across the 4 theme states', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await seedFixture(page);
  // A trained day so `.day-cell.done` exists to be photographed.
  await putRecords(page, 'workout_sessions', [completedSession('qa-today', localDay(0))]);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      await page.goto('/');
      await applyCombo(page, combo);
      expect(new URL(page.url()).pathname, 'home capture must be on /').toBe('/');

      const tokens = await tokenSnapshot(page);
      const fs = await import('node:fs');
      fs.mkdirSync('visual-qa', { recursive: true });
      fs.writeFileSync(
        `visual-qa/tokens-${combo.id}.json`,
        JSON.stringify(tokens, null, 2),
        'utf8'
      );

      // Create a planned REST day through the real affordance: tap an untrained
      // cell. This is the state whose polarity was inverted in light+HC.
      // Only when none exists yet — clicking once per combo would eat every
      // empty cell in the row and leave nothing to sample as "empty".
      if ((await page.locator('.day-cell.rest').count()) === 0) {
        const untrained = page.locator('.day-cell:not(.done):not(.rest)');
        if ((await untrained.count()) > 1) {
          await untrained.first().click({ force: true }).catch(() => {});
          await page.waitForTimeout(600);
        }
      }

      await page.screenshot({ path: `visual-qa/hc-home-${combo.id}-${vp.tag}.png` });

      // The card behind the strip: a band just under the grid, inside the card.
      const grid = page.locator('.day-cell').first();
      const gridBox = await grid.boundingBox();
      let cardBg: Rgb | null = null;
      if (gridBox) {
        cardBg = await sampleBand(page, {
          x: gridBox.x + 2,
          y: gridBox.y + gridBox.height + 6,
          width: Math.max(40, gridBox.width * 4),
          height: 6,
        });
      }

      const trained = await shootEl(page, page.locator('.day-cell.done'), 'daycell-done', combo.id, vp.tag, cardBg ? { vsCard: cardBg } : {});
      const rest = await shootEl(page, page.locator('.day-cell.rest'), 'daycell-rest', combo.id, vp.tag, cardBg ? { vsCard: cardBg } : {});
      const empty = await shootEl(page, page.locator('.day-cell:not(.done):not(.rest)'), 'daycell-empty', combo.id, vp.tag, cardBg ? { vsCard: cardBg } : {});

      // The three-state polarity claim: trained brightest, rest middle, empty darkest.
      if (trained && rest && empty) {
        READINGS.push({
          surface: 'weekstrip-polarity',
          combo: combo.id,
          viewport: vp.tag,
          png: `hc-home-${combo.id}-${vp.tag}.png`,
          fill: `${toHex(trained)}|${toHex(rest)}|${toHex(empty)}`,
          ink: '-',
          inkOnFill: 0,
          extra: {
            trainedVsRest: contrast(trained, rest),
            restVsEmpty: contrast(rest, empty),
            trainedVsEmpty: contrast(trained, empty),
            lumTrained: Math.round(luminance(trained) * 10000) / 10000,
            lumRest: Math.round(luminance(rest) * 10000) / 10000,
            lumEmpty: Math.round(luminance(empty) * 10000) / 10000,
          },
          note: 'polarity is correct only when lumTrained > lumRest > lumEmpty',
        });
      }

      // Bottom nav: the selected pill, and the bar it sits on.
      const navInactive = page.locator('nav a:not([aria-current="page"])');
      const barBg = await shootEl(page, navInactive, 'nav-inactive', combo.id, vp.tag);
      // The inactive icon + label are thin glyphs: every one of their pixel
      // colours sits below the 0.5% significance floor, so the pixel pass cannot
      // see them and reports ink==fill. Settle those two with computed colours
      // measured against the SAMPLED bar fill.
      if (barBg && (await navInactive.first().isVisible().catch(() => false))) {
        const inks = await navInactive.first().evaluate((el) => {
          const seen = new Set<string>();
          for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
            const c = getComputedStyle(node as Element).color;
            if (c) seen.add(c);
          }
          return [...seen];
        });
        for (const [i, raw] of inks.slice(0, 3).entries()) {
          const m = raw.match(/\d+(\.\d+)?/g) ?? [];
          const rgb: Rgb = [Number(m[0] ?? 0), Number(m[1] ?? 0), Number(m[2] ?? 0)];
          READINGS.push({
            surface: `nav-inactive-computed-${i}`,
            combo: combo.id,
            viewport: vp.tag,
            png: `hc-nav-inactive-${combo.id}-${vp.tag}.png`,
            fill: toHex(barBg),
            ink: toHex(rgb),
            inkOnFill: contrast(rgb, barBg),
            extra: {},
            note: 'computed colour vs sampled bar fill (glyph too thin to sample)',
          });
        }
      }
      await shootEl(
        page,
        page.locator('[style*="nav-pill-bg"]'),
        'nav-pill',
        combo.id,
        vp.tag,
        barBg ? { vsBar: barBg } : {}
      );
      const nav = page.locator('nav').first();
      const navBox = await nav.boundingBox();
      if (navBox) {
        await page.screenshot({
          path: `visual-qa/hc-navbar-${combo.id}-${vp.tag}.png`,
          clip: navBox,
        });
      }

      // Interactive card hover — --color-surface-hover.
      // `.card-interactive` is defined in components.css/global.css but applied
      // by NO tsx in src/, so a selector-based capture would just report "not
      // found" and prove nothing. Instead: hover the real interactive cards on
      // home and diff the sampled fill. A zero delta is the finding.
      const hoverTargets = page.locator(
        'main a[class*="card"], main button[class*="card"], main a[class*="glass"], main button[class*="glass"]'
      );
      const hoverCount = await hoverTargets.count();
      if (hoverCount > 0) {
        const target = hoverTargets.first();
        await target.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        const beforeBuf = await target.screenshot();
        const before = (await palette(beforeBuf)).fill;
        await target.hover().catch(() => {});
        await page.waitForTimeout(500);
        const afterFill = await shootEl(page, target, 'card-hover', combo.id, vp.tag, {
          vsResting: before,
        });
        const cls = (await target.getAttribute('class')) ?? '';
        READINGS.push({
          surface: 'card-hover-delta',
          combo: combo.id,
          viewport: vp.tag,
          png: `hc-card-hover-${combo.id}-${vp.tag}.png`,
          fill: `${toHex(before)}->${afterFill ? toHex(afterFill) : 'n/a'}`,
          ink: '-',
          inkOnFill: 0,
          extra: { changed: afterFill && toHex(afterFill) !== toHex(before) ? 1 : 0 },
          note: `hovered ${cls.slice(0, 90)}; card-interactive is applied by no tsx, so --color-surface-hover may have no consumer`,
        });
      } else {
        const inventory = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of Array.from(
            document.querySelectorAll('main a, main button, main [role="button"], main [onclick]')
          ).slice(0, 40)) {
            const cls = (el.getAttribute('class') ?? '').slice(0, 70);
            out.push(`${el.tagName.toLowerCase()}:${cls}`);
          }
          return out;
        });
        MISSES.push(
          `card-hover @ ${combo.id}/${vp.tag}: no interactive card element on /; inventory=${JSON.stringify(inventory.slice(0, 14))}`
        );
      }
    }
  }

  await flushReadings('home');
  console.log(`HC_HOME_CONSOLE_ERRORS:${JSON.stringify(errors.slice(0, 25))}`);
});

// ---------------------------------------------------------------------------
// B) Progress tab row, primary CTA (resting + pressed), Settings toggle
// ---------------------------------------------------------------------------
test('14bd — active tab, primary CTA resting/pressed, settings toggle ON/OFF', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await seedFixture(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      // --- Progress tab row ---
      // NOT `.tab-row .tab.active`: that class pair is live only in the numpad
      // overlay and the post-workout summary. The Progress tab bar is
      // role="tab" buttons with `background:'none'` — selection is carried by
      // ink colour + weight, so the figure that matters is label vs surface.
      await page.goto('/progress');
      await applyCombo(page, combo);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `visual-qa/hc-progress-${combo.id}-${vp.tag}.png` });
      const inactiveTab = await shootEl(
        page,
        page.locator('[role="tab"][aria-selected="false"]'),
        'tab-inactive',
        combo.id,
        vp.tag
      );
      await shootEl(
        page,
        page.locator('[role="tab"][aria-selected="true"]'),
        'tab-active',
        combo.id,
        vp.tag,
        inactiveTab ? { vsTrack: inactiveTab } : {}
      );

      // --- Primary CTA (Button.tsx variant=primary — the ONLY consumer of
      //     --btn-primary-bg-hover, which is the pressed-CTA token) ---
      // `:not([disabled])` matters: the MyCoach connect CTA is disabled until a
      // code is typed, and a disabled Button renders at opacity .4, so sampling
      // it measures the disabled treatment (exempt from contrast minimums) and
      // never changes on press. Type a code first, then require an enabled one.
      let ctaRoute = '';
      const cta = page.locator(
        'button[class*="btn-primary-bg)"]:not([disabled]), a[class*="btn-primary-bg)"]:not([disabled])'
      );
      for (const route of ['/my-coach', '/settings', '/templates', '/community', '/progress', '/']) {
        await page.goto(route);
        await page.waitForTimeout(1600);
        if (route === '/my-coach') {
          const codeInput = page.locator('main input[type="text"], main input:not([type])').first();
          if (await codeInput.isVisible().catch(() => false)) {
            await codeInput.fill('QA14BD').catch(() => {});
            await page.waitForTimeout(400);
          }
        }
        if ((await cta.count()) > 0 && (await cta.first().isVisible().catch(() => false))) {
          ctaRoute = route;
          break;
        }
      }
      if (ctaRoute) {
        const pageBg = await sampleBand(page, { x: 4, y: 4, width: 40, height: 6 });
        // Park the pointer off the control FIRST. Playwright's fill() leaves the
        // mouse where it clicked and mouse.up() leaves it on the button, so
        // without this the "resting" sample is really the :hover fill — which is
        // exactly how a press that changes nothing can look like a pass.
        await page.mouse.move(2, 2);
        await page.waitForTimeout(350);
        await shootEl(page, cta, 'cta-resting', combo.id, vp.tag, pageBg ? { vsPage: pageBg } : {});
        const box = await cta.first().boundingBox();
        if (box) {
          // --btn-primary-bg-hover backs BOTH :hover and :active on this Button,
          // so hover is sampled separately: it tells apart "the press does
          // nothing" from "the press does nothing the hover had not already done".
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(400);
          await shootEl(page, cta, 'cta-hover', combo.id, vp.tag, pageBg ? { vsPage: pageBg } : {});
          await page.mouse.down();
          await page.waitForTimeout(400);
          const pressed = await shootEl(page, cta, 'cta-pressed', combo.id, vp.tag, pageBg ? { vsPage: pageBg } : {});
          await page.mouse.up();
          await page.mouse.move(2, 2);
          const rest = READINGS.find(
            (r) => r.surface === 'cta-resting' && r.combo === combo.id && r.viewport === vp.tag
          );
          if (pressed && rest) {
            READINGS.push({
              surface: 'cta-press-delta',
              combo: combo.id,
              viewport: vp.tag,
              png: `hc-cta-pressed-${combo.id}-${vp.tag}.png`,
              fill: `${rest.fill}->${toHex(pressed)}`,
              ink: '-',
              inkOnFill: 0,
              extra: { pressedVsResting: contrast(pressed, hexToRgb(rest.fill)) },
              note: `route ${ctaRoute}; press must be perceptible (>=3:1 is the house floor cited in tokens.css)`,
            });
          }
        }
      } else {
        MISSES.push(`cta @ ${combo.id}/${vp.tag}: no Button variant=primary found on any probed route`);
      }

      // --- Settings toggle, ON and OFF ---
      await page.goto('/settings');
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `visual-qa/hc-settings-${combo.id}-${vp.tag}.png` });
      const switches = page.locator('button[role="switch"]');
      const n = await switches.count();
      let offIdx = -1;
      let onIdx = -1;
      for (let i = 0; i < n; i++) {
        const checked = await switches.nth(i).getAttribute('aria-checked');
        if (checked === 'false' && offIdx < 0) offIdx = i;
        if (checked === 'true' && onIdx < 0) onIdx = i;
      }
      // Sample the 52x32 VISUAL track (the aria-hidden span), not the >=44px tap
      // target: the tap target's modal pixel is the card behind it, which made
      // ON and OFF measure identically. Inside the track span the fill IS the
      // track and the highest-contrast significant colour IS the knob.
      if (offIdx >= 0) {
        await shootEl(
          page,
          switches.nth(offIdx).locator('span[aria-hidden="true"]'),
          'toggle-off',
          combo.id,
          vp.tag
        );
      } else {
        MISSES.push(`toggle-off @ ${combo.id}/${vp.tag}: no unchecked switch in Settings`);
      }
      if (onIdx < 0 && offIdx >= 0) {
        // Turn one on so the ON state is photographable.
        await switches.nth(offIdx).click({ force: true }).catch(() => {});
        await page.waitForTimeout(600);
        onIdx = offIdx;
      }
      if (onIdx >= 0) {
        await shootEl(
          page,
          switches.nth(onIdx).locator('span[aria-hidden="true"]'),
          'toggle-on',
          combo.id,
          vp.tag
        );
      } else {
        MISSES.push(`toggle-on @ ${combo.id}/${vp.tag}: no checked switch in Settings`);
      }
    }
  }

  await flushReadings('controls');
  console.log(`HC_CONTROLS_CONSOLE_ERRORS:${JSON.stringify(errors.slice(0, 25))}`);
});

function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [Number.parseInt(m[1] ?? '0', 16), Number.parseInt(m[2] ?? '0', 16), Number.parseInt(m[3] ?? '0', 16)];
}

// ---------------------------------------------------------------------------
// C) ReadinessReadingCard — both states, and the קריאה חלקית badge
// ---------------------------------------------------------------------------
test('14bd — ReadinessReadingCard: with a reading and with none', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const httpFailures: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const u = new URL(r.url());
      httpFailures.push(`${r.status()} ${u.host}${u.pathname}`);
    }
  });
  const log: string[] = [];

  await seedFixture(page);

  const openRecoveryTab = async (): Promise<void> => {
    await page.goto('/progress');
    await page.waitForTimeout(2000);
    const tab = page
      .getByRole('tab', { name: 'התאוששות' })
      .or(page.getByRole('button', { name: 'התאוששות' }))
      .first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1600);
    } else {
      MISSES.push('recovery tab: no התאוששות tab found on /progress');
    }
  };

  // ---- STATE 1: NO recovery log. The card must show no score and no "/ 100".
  await putRecords(page, 'workout_sessions', [completedSession('qa-empty-1', localDay(1))]);
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      await page.goto('/progress');
      await applyCombo(page, combo);
      await openRecoveryTab();
      const card = page.locator('div').filter({ hasText: 'אין עדיין קריאת מוכנות' }).last();
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        await card.screenshot({ path: `visual-qa/hc-readiness-empty-${combo.id}-${vp.tag}.png` });
        const text = (await card.textContent()) ?? '';
        log.push(
          `empty ${combo.id}/${vp.tag}: hasSlash100=${/\/\s*100/.test(text)} hasHedgeBadge=${text.includes('קריאה חלקית')}`
        );
        // The whole point of the card: no number is printed without a log.
        expect(text, 'empty readiness state must not print /100').not.toMatch(/\/\s*100/);
      } else {
        MISSES.push(`readiness-empty @ ${combo.id}/${vp.tag}: empty-state card not found`);
      }
      await page.screenshot({ path: `visual-qa/hc-recoverytab-empty-${combo.id}-${vp.tag}.png` });
    }
  }

  // ---- STATE 2: a recovery log exists -> score + recommendation + badge.
  await page.setViewportSize({ width: 390, height: 1500 });
  await page.goto('/progress');
  await putRecords(page, 'recovery_logs', [
    {
      id: '5f1c1d64-4a5e-4f6a-9c1e-2b7d9a0e1f11',
      date: localDay(0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sleepHours: 7.5,
      sleepQuality: 4,
      sorenessLevel: 4,
      energyLevel: 4,
      stressLevel: 3,
      tightAreas: [],
    },
  ]);
  await putRecords(page, 'workout_sessions', [
    completedSession('qa-load-1', localDay(1)),
    completedSession('qa-load-2', localDay(3)),
  ]);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      await page.goto('/progress');
      await applyCombo(page, combo);
      await openRecoveryTab();
      const card = page.locator('div').filter({ hasText: 'קריאת מוכנות' }).last();
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        await card.screenshot({ path: `visual-qa/hc-readiness-data-${combo.id}-${vp.tag}.png` });
        const text = (await card.textContent()) ?? '';
        log.push(`data ${combo.id}/${vp.tag}: hasSlash100=${/\/\s*100/.test(text)} partial=${text.includes('קריאה חלקית')}`);
      } else {
        MISSES.push(`readiness-data @ ${combo.id}/${vp.tag}: card not found`);
      }
      // The badge whose contrast has never been measured.
      const badge = page.getByText('קריאה חלקית', { exact: true }).first();
      if (await badge.isVisible().catch(() => false)) {
        const bBox = await badge.boundingBox();
        let behind: Rgb | null = null;
        if (bBox) {
          behind = await sampleBand(page, {
            x: bBox.x,
            y: bBox.y + bBox.height + 8,
            width: Math.max(40, bBox.width),
            height: 5,
          });
        }
        await shootEl(page, badge, 'partial-badge', combo.id, vp.tag, behind ? { vsCard: behind } : {});

        // The badge glyph is ~0.6% of the pill, so the DARKEST SAMPLED colour can
        // be an antialiased mid-tone rather than the declared one. Settle it: take
        // the computed text colour (exact) against the sampled pill fill (real
        // pixels). This is the figure to quote for an 11px label.
        const computed = await badge.evaluate((el) => {
          const cs = getComputedStyle(el);
          const parse = (v: string): [number, number, number] => {
            const m = v.match(/\d+(\.\d+)?/g) ?? [];
            return [Number(m[0] ?? 0), Number(m[1] ?? 0), Number(m[2] ?? 0)];
          };
          return { color: parse(cs.color), bg: parse(cs.backgroundColor), fontSize: cs.fontSize };
        });
        const badgeFill = READINGS.find(
          (r) => r.surface === 'partial-badge' && r.combo === combo.id && r.viewport === vp.tag
        );
        if (badgeFill) {
          READINGS.push({
            surface: 'partial-badge-computed',
            combo: combo.id,
            viewport: vp.tag,
            png: badgeFill.png,
            fill: `${toHex(computed.bg)} (sampled ${badgeFill.fill})`,
            ink: toHex(computed.color),
            inkOnFill: contrast(computed.color, hexToRgb(badgeFill.fill)),
            extra: { computedOnComputed: contrast(computed.color, computed.bg) },
            note: `fontSize ${computed.fontSize}; AA for this size needs 4.5:1`,
          });
        }
      } else {
        MISSES.push(`partial-badge @ ${combo.id}/${vp.tag}: badge not rendered`);
      }
      await page.screenshot({ path: `visual-qa/hc-recoverytab-data-${combo.id}-${vp.tag}.png` });
    }
  }

  await flushReadings('readiness');
  console.log(`HC_READINESS_LOG:${JSON.stringify(log)}`);
  console.log(`HC_READINESS_CONSOLE_ERRORS:${JSON.stringify(errors.slice(0, 25))}`);
  console.log(`HC_HTTP_FAILURES:${JSON.stringify([...new Set(httpFailures)].slice(0, 20))}`);
});

// ---------------------------------------------------------------------------
// D) The two gates: hidden nutrition, admin-only paywall
// ---------------------------------------------------------------------------
test('14bd — gates: no תזונה tab, /nutrition redirects, no פרימיום row, /paywall redirects', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const findings: string[] = [];
  await seedFixture(page);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const combo of COMBOS) {
      await page.goto('/');
      await applyCombo(page, combo);

      // 1) The trainee bottom nav must not carry a תזונה tab.
      const navNutrition = page.locator('nav').getByText('תזונה', { exact: true });
      const navCount = await navNutrition.count();
      findings.push(`${combo.id}/${vp.tag} nav-nutrition-count=${navCount}`);
      expect(navCount, 'bottom nav must have no תזונה tab for a non-admin').toBe(0);
      const nav = page.locator('nav').first();
      const navBox = await nav.boundingBox();
      if (navBox) {
        await page.screenshot({
          path: `visual-qa/gate-nav-no-nutrition-${combo.id}-${vp.tag}.png`,
          clip: navBox,
        });
      }

      // 2) /nutrition must not open.
      await page.goto('/nutrition');
      await page.waitForTimeout(1800);
      const nutritionPath = new URL(page.url()).pathname;
      findings.push(`${combo.id}/${vp.tag} /nutrition -> ${nutritionPath}`);
      await page.screenshot({
        path: `visual-qa/gate-nutrition-redirect-${combo.id}-${vp.tag}.png`,
      });
      expect(nutritionPath, '/nutrition must redirect for a non-admin').not.toBe('/nutrition');

      // 3) Settings must not show the פרימיום row.
      await page.goto('/settings');
      await page.waitForTimeout(2000);
      const premium = page.getByText('פרימיום', { exact: false });
      const premiumCount = await premium.count();
      findings.push(`${combo.id}/${vp.tag} premium-row-count=${premiumCount}`);
      await page.screenshot({ path: `visual-qa/gate-settings-no-premium-${combo.id}-${vp.tag}.png` });
      expect(premiumCount, 'Settings must not show the פרימיום row for a non-admin').toBe(0);

      // 4) /paywall must redirect.
      await page.goto('/paywall');
      await page.waitForTimeout(2000);
      const paywallPath = new URL(page.url()).pathname;
      findings.push(`${combo.id}/${vp.tag} /paywall -> ${paywallPath}`);
      await page.screenshot({ path: `visual-qa/gate-paywall-redirect-${combo.id}-${vp.tag}.png` });
      expect(paywallPath, '/paywall must redirect for a non-admin').not.toBe('/paywall');
    }
  }

  const fs = await import('node:fs');
  fs.mkdirSync('visual-qa', { recursive: true });
  fs.writeFileSync('visual-qa/gates-14bd.json', JSON.stringify({ commit: '14b3dbd', findings }, null, 2), 'utf8');
  console.log(`HC_GATES:${JSON.stringify(findings)}`);
});
