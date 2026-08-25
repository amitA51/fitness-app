/**
 * BIG-THREE QA CAPTURE — visual check for the BigThreeCard widget
 * (Progress/Overview): squat/bench/deadlift e1RM cells with trend deltas.
 * Seeds a guest session with THREE completed sessions across different days,
 * each containing one big lift (bench / squat / deadlift) plus a row, so the
 * widget renders all three cells with non-zero e1RM and deltas.
 * Output: ./visual-qa/bigthree-*.png
 * Run: npx playwright test e2e/bigthree-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { test } from '@playwright/test';

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

test('capture the big-three widget light + dark', async ({ page }) => {
  test.setTimeout(120_000);

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

    const day = (offsetDays: number) => {
      const d = new Date(Date.now() - offsetDays * 24 * 3600 * 1000);
      return { iso: d.toISOString(), date: d.toISOString().slice(0, 10) };
    };
    const mkSet = (n: number, weight: number, reps: number, when: string) => ({
      id: `s-${n}`,
      setNumber: n,
      reps,
      weight,
      rpe: null,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      rpeTag: null,
      completedAt: when,
    });

    const sessions = [
      // Bench day — 3 days ago.
      (() => {
        const d = day(3);
        return {
          id: 'big3-qa-bench',
          date: d.date,
          startTime: d.iso,
          endTime: d.iso,
          exercises: [
            {
              id: 'ex-bench',
              exerciseId: 'bench-press',
              exerciseName: 'לחיצת חזה במוט | Barbell Bench Press',
              targetMuscle: 'Chest',
              muscleGroup: 'Chest',
              sets: [mkSet(1, 60, 8, d.iso), mkSet(2, 65, 6, d.iso), mkSet(3, 70, 5, d.iso)],
              notes: '',
              restSeconds: 90,
              isCompleted: true,
              order: 0,
            },
          ],
          duration: 2400,
          status: 'completed',
          templateId: null,
          notes: '',
          rating: null,
          totalVolume: 1030,
          caloriesBurned: null,
          createdAt: d.iso,
          updatedAt: d.iso,
          muscleGroups: ['Chest'],
        };
      })(),
      // Squat day — 2 days ago.
      (() => {
        const d = day(2);
        return {
          id: 'big3-qa-squat',
          date: d.date,
          startTime: d.iso,
          endTime: d.iso,
          exercises: [
            {
              id: 'ex-squat',
              exerciseId: 'squat',
              exerciseName: 'סקוואט במוט | Barbell Squat',
              targetMuscle: 'Legs',
              muscleGroup: 'Legs',
              sets: [mkSet(1, 90, 6, d.iso), mkSet(2, 100, 4, d.iso)],
              notes: '',
              restSeconds: 120,
              isCompleted: true,
              order: 0,
            },
            {
              id: 'ex-row',
              exerciseId: 'row',
              exerciseName: 'חתירה | Row',
              targetMuscle: 'Back',
              muscleGroup: 'Back',
              sets: [mkSet(3, 55, 10, d.iso), mkSet(4, 55, 10, d.iso)],
              notes: '',
              restSeconds: 90,
              isCompleted: true,
              order: 1,
            },
          ],
          duration: 3000,
          status: 'completed',
          templateId: null,
          notes: '',
          rating: 5,
          totalVolume: 1420,
          caloriesBurned: null,
          createdAt: d.iso,
          updatedAt: d.iso,
          muscleGroups: ['Legs', 'Back'],
        };
      })(),
      // Deadlift + bench PR day — yesterday (bench improves vs 3 days ago).
      (() => {
        const d = day(1);
        return {
          id: 'big3-qa-dead',
          date: d.date,
          startTime: d.iso,
          endTime: d.iso,
          exercises: [
            {
              id: 'ex-dead',
              exerciseId: 'deadlift',
              exerciseName: 'דדליפט | Deadlift',
              targetMuscle: 'Back',
              muscleGroup: 'Back',
              sets: [mkSet(1, 120, 5, d.iso), mkSet(2, 130, 3, d.iso)],
              notes: '',
              restSeconds: 150,
              isCompleted: true,
              order: 0,
            },
            {
              id: 'ex-bench-2',
              exerciseId: 'bench-press',
              exerciseName: 'לחיצת חזה במוט | Barbell Bench Press',
              targetMuscle: 'Chest',
              muscleGroup: 'Chest',
              sets: [mkSet(3, 72.5, 5, d.iso), mkSet(4, 75, 3, d.iso)],
              notes: '',
              restSeconds: 90,
              isCompleted: true,
              order: 1,
            },
          ],
          duration: 3300,
          status: 'completed',
          templateId: null,
          notes: '',
          rating: null,
          totalVolume: 1587.5,
          caloriesBurned: null,
          createdAt: d.iso,
          updatedAt: d.iso,
          muscleGroups: ['Back', 'Chest'],
        };
      })(),
    ];

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
  await page.reload();
  await page.waitForTimeout(2500);

  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  await page.goto('/progress');
  await page.waitForTimeout(2000);
  await both(page, 'bigthree-01-overview');

  // Deep link check: tap the squat cell → strength drill-down opens pre-selected.
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const cell = page.getByRole('button', { name: /סקוואט/ }).first();
  if (await cell.isVisible().catch(() => false)) {
    await cell.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shoot(page, 'bigthree-02-deeplink-dark');
  }
});
