/**
 * REST-DAYS QA CAPTURE — visual + behavioral check for planned rest days:
 * tapping an untrained day in the WeeklyGrid marks it as a planned rest day
 * (dashed accent cell) which BRIDGES the streak instead of breaking it.
 *
 * Scenario: workouts 5/3/2/1 days ago → plain streak = 3 (yesterday..3d).
 * Marking "4 days ago" (untrained gap) as rest must lift the streak to 4.
 * Output: ./visual-qa/restdays-*.png
 * Run: npx playwright test e2e/restdays-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { expect, test } from '@playwright/test';

async function setTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
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
}

test('rest day bridges the streak', async ({ page }) => {
  test.setTimeout(180_000);

  // First load lets the app create the IndexedDB stores at its own version.
  await page.goto('/');
  await page.waitForTimeout(1500);

  await page.evaluate(async () => {
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

    const iso = (d: Date): string => d.toISOString();
    const day = (d: Date): string => d.toISOString().slice(0, 10);
    const mkSet = (n: number, doneAt: string) => ({
      id: `s-${n}`,
      setNumber: n,
      reps: 8,
      weight: 60,
      rpe: null,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      rpeTag: null,
      completedAt: doneAt,
    });
    const mkSession = (daysAgo: number, id: string) => {
      const when = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
      when.setHours(18, 0, 0, 0);
      return {
        id,
        date: day(when),
        startTime: iso(when),
        endTime: iso(new Date(when.getTime() + 45 * 60 * 1000)),
        exercises: [
          {
            id: `ex-${id}`,
            exerciseId: 'bench-press',
            exerciseName: 'לחיצת חזה | Bench Press',
            targetMuscle: 'Chest',
            muscleGroup: 'Chest',
            sets: [mkSet(1, iso(when)), mkSet(2, iso(when)), mkSet(3, iso(when))],
            notes: '',
            restSeconds: 90,
            isCompleted: true,
            order: 0,
          },
        ],
        duration: 2700,
        status: 'completed',
        templateId: null,
        notes: '',
        rating: 4,
        totalVolume: 1440,
        caloriesBurned: null,
        createdAt: iso(when),
        updatedAt: iso(when),
        muscleGroups: ['Chest'],
      };
    };

    // Workouts 1/2/3/5 days ago → the 4-days-ago gap splits two runs.
    const sessions = [mkSession(1, 'rd-1'), mkSession(2, 'rd-2'), mkSession(3, 'rd-3'), mkSession(5, 'rd-5')];

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('sparkos-fitness-db', 9);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('workout_sessions', 'readwrite');
          for (const s of sessions) tx.objectStore('workout_sessions').put(s);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error('tx error'));
          };
        } catch (err) {
          db.close();
          reject(err as Error);
        }
      };
      req.onerror = () => reject(req.error ?? new Error('open error'));
    });
  });

  // Clear any stale rest-day ledger from previous runs.
  await page.evaluate(() => localStorage.removeItem('workout_rest_days'));

  await page.reload();
  await page.waitForTimeout(2500);

  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  const streakChip = page.locator('[aria-label^="רצף אימונים"]').first();

  // Baseline: plain streak = 3 (the 4-days-ago gap breaks the walk).
  await expect(streakChip).toBeVisible({ timeout: 10_000 });
  const before = await streakChip.getAttribute('aria-label');
  await both(page, 'restdays-01-home-before');

  // Mark "4 days ago" as a planned rest day. The cell lives in the current
  // week when today is Thu..Sat; otherwise page back one week first.
  const gapCellIndex = (new Date().getDay() + 7 - 4) % 7;
  const gapIsThisWeek = new Date().getDay() >= 4; // Thu(4)..Sat(6) → 4-days-ago is this week
  const prevBtn = page.getByRole('button', { name: 'שבוע קודם' });
  if (!gapIsThisWeek) {
    await prevBtn.click();
    await page.waitForTimeout(600); // let the grid re-render with last week's dates
  }

  const gapCell = page.locator('.day-cell').nth(gapCellIndex);
  await gapCell.click();
  await page.waitForTimeout(800);
  // Capture the dashed rest-day cell while last week is still on screen.
  if (!gapIsThisWeek) await shoot(page, 'restdays-01b-restcell-lastweek');
  if (!gapIsThisWeek) {
    await page.getByRole('button', { name: 'שבוע הבא' }).click().catch(() => {});
    await page.waitForTimeout(600);
  }

  const after = await streakChip.getAttribute('aria-label');
  const ledgerDump = await page.evaluate(() => localStorage.getItem('workout_rest_days'));
  const restCellCount = await page.locator('.day-cell.rest').count();
  await both(page, 'restdays-02-home-after');

  await page.goto('/progress');
  await page.waitForTimeout(2000);
  await both(page, 'restdays-03-progress-after');

  console.log(
    `REST_DAYS_QA_LOG:\nstreak_before=${before}\nstreak_after=${after}\nledger=${ledgerDump}\nrest_cells_visible=${restCellCount}\nbridged=${Number(before?.match(/\d+/)?.[0] ?? 0) < Number(after?.match(/\d+/)?.[0] ?? 0)}`
  );
});
