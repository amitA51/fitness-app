/**
 * VISUAL QA CAPTURE — /admin (the hidden operator screen). Not a regression
 * test: it writes PNGs for a human/agent to review.
 *
 * /admin sits behind AdminGuard, which asks the REAL Supabase client two
 * questions: "is there a session?" and "is there a row for me in app_admins?".
 * A guest preview session answers no to both, so this spec seeds a local
 * session and intercepts the PostgREST reads instead of weakening the guard —
 * the app under test is the shipped one, only its network is canned.
 *
 * Output: ./visual-qa/50-admin-users-*.png
 * Run: npx playwright test e2e/admin-qa.spec.ts --project="Mobile Chrome (Pixel 5)"
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

/** Users the stubbed admin_list_users RPC returns. */
const USERS = [
  {
    user_id: '11111111-1111-4111-8111-111111111111',
    email: 'dana@example.com',
    display_name: 'דנה לוי',
    role: 'trainee',
  },
  {
    user_id: '22222222-2222-4222-8222-222222222222',
    email: 'yossi@example.com',
    display_name: 'יוסי כהן',
    role: 'coach',
  },
  {
    user_id: '33333333-3333-4333-8333-333333333333',
    email: 'noa.b@example.com',
    display_name: 'נועה בר-אור',
    role: 'trainee',
  },
];

/**
 * supabase-js persists the session under `sb-<project-ref>-auth-token`, where
 * the ref is the first label of the project hostname. Read from .env.local in
 * Node (never logged) so the key matches the client the bundle was built with.
 */
function authStorageKey(): string {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  const url = /^VITE_SUPABASE_URL\s*=\s*(.+)$/m.exec(env)?.[1]?.trim() ?? '';
  const ref = new URL(url).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}

const b64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=+$/, '');

/** A structurally valid, unsigned JWT — enough for the SDK's local session read. */
function fakeSession(): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86_400;
  const token = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: ADMIN_ID, aud: 'authenticated', role: 'authenticated', iat: now, exp }),
    'visual-qa-signature',
  ].join('.');

  return JSON.stringify({
    access_token: token,
    token_type: 'bearer',
    expires_in: 86_400,
    expires_at: exp,
    refresh_token: 'visual-qa-refresh',
    user: {
      id: ADMIN_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'owner@example.com',
      created_at: new Date(0).toISOString(),
      app_metadata: {},
      user_metadata: {},
    },
  });
}

async function stubSupabase(page: Page) {
  const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  // Playwright matches route handlers in REVERSE registration order, so the
  // catch-all is registered FIRST and the specific tables/RPCs after it.
  // Everything unlisted (profiles, consent documents, sync pulls) reads as empty.
  await page.route('**/rest/v1/**', (route) => route.fulfill(json([])));
  // Age gate is fail-CLOSED on a missing row — hand it a verified one.
  await page.route('**/rest/v1/user_age_verification*', (route) =>
    route.fulfill(json([{ age_verified: true, parental_consent_status: 'not_required' }]))
  );
  // The admin gate: one row means "this user is an operator".
  await page.route('**/rest/v1/app_admins*', (route) =>
    route.fulfill(json([{ user_id: ADMIN_ID }]))
  );
  await page.route('**/rest/v1/rpc/admin_set_coach*', (route) => route.fulfill(json(null)));
  await page.route('**/rest/v1/rpc/admin_list_users*', (route) => route.fulfill(json(USERS)));
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(250);
}

async function shootBoth(page: Page, name: string) {
  for (const [width, height, tag] of [
    [390, 844, '390'],
    [1280, 900, '1280'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      await page.screenshot({ path: `visual-qa/${name}-${tag}-${theme}.png`, fullPage: true });
    }
    await setTheme(page, 'light');
  }
}

test('capture /admin — user list + set-as-coach form', async ({ page }) => {
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') log.push(`[console.error] ${m.text()}`);
  });

  await stubSupabase(page);

  // Seed the session first, then reload so the auth transition settles before
  // the onboarding/profile seeds are written (a new user id wipes local data).
  const storageKey = authStorageKey();
  await page.goto('/');
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, session),
    [storageKey, fakeSession()] as const
  );
  await page.reload();
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem(
      'user_profile',
      JSON.stringify({ name: 'עמית', age: 34, height: 178, weight: 76, gender: 'male' })
    );
  });
  await page.reload();
  await page.waitForTimeout(2500);

  // Dismiss first-run overlays (welcome guide, cookie banner) — best effort.
  for (const label of ['דילוג', 'רק הכרחי', 'אישור הכל']) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  await page.goto('/admin');
  await page.waitForTimeout(2500);
  log.push(`admin url=${page.url()} h1=${await page.locator('h1').first().textContent()}`);
  await shootBoth(page, '50-admin-users');

  // Open the per-row "set as coach" form on the first trainee row.
  await page.setViewportSize({ width: 390, height: 844 });
  const promote = page.getByRole('button', { name: /^הגדרת/ }).first();
  if (await promote.isVisible().catch(() => false)) {
    await promote.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
  log.push(`form-open businessField=${await page.getByLabel('שם העסק').count()}`);
  await shootBoth(page, '51-admin-set-coach-form');

  // The search field with a query that matches nothing (empty state).
  await page.route('**/rest/v1/rpc/admin_list_users*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.getByLabel('חיפוש משתמש').fill('zzzz');
  await page.waitForTimeout(1200);
  await shootBoth(page, '52-admin-empty-search');

  console.log(`ADMIN_QA_LOG:\n${log.join('\n')}`);
});
