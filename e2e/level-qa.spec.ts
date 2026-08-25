/**
 * LEVEL QA CAPTURE — visual check for the XP-level surfaces added by the
 * gamification-coherence pass: the ambient level chip on DashboardHeader and
 * the LevelCard strip on Progress/Overview. Seeds a guest session WITH an
 * existing XP pool (1,240 XP → level 5) AND one completed workout in IndexedDB
 * (so Progress renders its populated overview, not the empty state).
 * Output: ./visual-qa/level-*.png
 * Run: npx playwright test e2e/level-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
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

test('capture XP level surfaces light + dark', async ({ page }) => {
  test.setTimeout(120_000);

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
    // Mid-ladder XP pool: T(5)=1000, T(6)=1500 → level 5, 240/500 into it.
    localStorage.setItem('gamification_xp_total', '1240');

    // One completed session (yesterday) so Progress shows its populated
    // overview — LevelCard sits under the week verdict there.
    const now = new Date();
    const yest = new Date(now.getTime() - 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString();
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const mkSet = (n: number) => ({
      id: `s-${n}`,
      setNumber: n,
      reps: 8,
      weight: 60 + n * 2.5,
      rpe: null,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      rpeTag: null,
      completedAt: iso(yest),
    });
    const session = {
      id: 'level-qa-session-1',
      date: day(yest),
      startTime: iso(yest),
      endTime: iso(new Date(yest.getTime() + 45 * 60 * 1000)),
      exercises: [
        {
          id: 'ex-1',
          exerciseId: 'bench-press',
          exerciseName: 'לחיצת חזה | Bench Press',
          targetMuscle: 'Chest',
          muscleGroup: 'Chest',
          sets: [mkSet(1), mkSet(2), mkSet(3), mkSet(4)],
          notes: '',
          restSeconds: 90,
          isCompleted: true,
          order: 0,
        },
        {
          id: 'ex-2',
          exerciseId: 'row',
          exerciseName: 'חתירה | Row',
          targetMuscle: 'Back',
          muscleGroup: 'Back',
          sets: [mkSet(5), mkSet(6), mkSet(7)],
          notes: '',
          restSeconds: 90,
          isCompleted: true,
          order: 1,
        },
      ],
      duration: 2700,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: 4,
      totalVolume: 2775,
      caloriesBurned: null,
      createdAt: iso(yest),
      updatedAt: iso(yest),
      muscleGroups: ['Chest', 'Back'],
    };

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('sparkos-fitness-db', 9);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('workout_sessions', 'readwrite');
          tx.objectStore('workout_sessions').put(session);
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

  await both(page, 'level-01-home');

  await page.goto('/progress');
  await page.waitForTimeout(2000);
  await both(page, 'level-02-progress');
});
