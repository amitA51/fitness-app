# DEPLOY-TODO — מה חייב לקרות בפריסה הבאה

> **סטטוס: שלבים 0–2 נפרסו ואומתו (28.07.2026). שלבים 3–5 טרם בוצעו.**
> נכתב ב-26.07.2026. כל מה שמסומן `[ ]` להלן טרם בוצע מול Supabase החי.
> אחרי שמסיימים — למחוק את הסעיף שבוצע, לא להשאיר "וי" מטעה.

---

## שלב 0–2 — בוצע ב-28.07.2026

Migrations ו-Edge Functions נפרסו מול הפרויקט החי `qxhgmqxiomidmimpnjvs`
ואומתו. ההוראות המקוריות הוסרו כדי שלא יקראו כמשהו שעוד צריך לעשות.

**מה שנפרס בפועל — שמונה migrations, לא שש:**

| # | migration | הערה |
|---|---|---|
| 1 | `clamp_updated_at_future` | **לא היה מתועד כחסר.** התגלה שהוא מעולם לא הוחל: ל-`update_updated_at_column` בפרודקשן לא היה clamp של 5 דקות. |
| 2 | `account_deletion_audit` | |
| 3 | `billing_core` | |
| 4 | `product_events` | |
| 5 | `sync_integrity` | החליף טריגרים ב-11 טבלאות. |
| 6 | `rate_limit_atomic` | |
| 7 | `community_write_rpcs` | נכשל ב-42P13 בהרצה ראשונה — ראה "drift" למטה. |
| 8 | `workout_sessions_status_template` | **חדש.** `status` ו-`template_id` נזרקו בכל סנכרון. |
| 9 | `revoke_trigger_function_grants` | **חדש.** סגירת פער שנוצר ב-`billing_core` ו-`sync_integrity`. |
| 10 | `water_logs_updated_at` | **hotfix.** `sync_integrity` הצמיד `sync_lww_guard` ל-`water_logs`, שאין בה `updated_at` — כל UPDATE נכשל ב-`record "new" has no field "updated_at"`. אומת מול ה-DB החי לפני ואחרי. |
| 11 | `recover_dropped_columns` | עמודות לשדות שהאפליקציה כותבת אבל לא היה איפה לשמור: `workout_templates.is_builtin/is_favorite/times_used/last_used/muscle_groups`, `workout_sessions.rating/calories_burned`, `nutrition_logs.name`. |

**אימות שעבר:**

- `select public.consume_rate_limit('deploy_check','x',60,1)` → `true`
- `sync_lww_guard` על 11 הטבלאות, **אפס** `update_updated_at_column` עליהן
- שלוש ה-RPC של הקהילה קיימות; INSERT ישיר ל-`posts`/`post_comments`/`post_reports`
  שלול מ-`authenticated`, ואפס policies של INSERT על `posts`
- הטריגר נבדק בפועל מול שורה אמיתית: כתיבה עם `updated_at` של 2020 דווחה
  כ-0 שורות ולא שינתה דבר (הוכחת `RETURN NULL`)

**DB drift שהתגלה:** בפרודקשן היה
`create_post(text, text DEFAULT NULL, text DEFAULT NULL)` שהוחל דרך ה-dashboard
ואינו קיים ב-repo. `CREATE OR REPLACE` נכשל ב-42P13. `20260726140000` תוקן
והוא מריץ `DROP FUNCTION` קודם. **המשמעות הרחבה: יש migrations בפרודקשן שאינם
ב-repo** (`wave2_hardening`, `tier3_rate_limit_waitlist`, `create_fitness_tables`,
`enable_rls_policies`) — לא להניח שה-repo הוא מקור האמת.

**Functions:** כל השש נפרסו. `verify_jwt` **אינו** נלקח מ-`config.toml`
של פונקציה בודדת ע"י ה-CLI — צריך לאמת אחרי כל פריסה:

- `billing-webhook` נפרס בטעות עם `verify_jwt = true` (היה חוסם כל webhook
  מהספק) → נפרס מחדש עם `--no-verify-jwt`
- `coach-push-send` היה `false` בפרודקשן למרות ש-`config.toml` אומר `true`
  → תוקן ל-`true`
- מצב סופי: הכול `true` פרט ל-`billing-webhook` ו-`reminders-dispatch`

**⚠️ שינוי התנהגות חי:** `billing_core` התקין
`trg_enforce_free_template_quota` (BEFORE INSERT על `workout_templates`,
מקסימום 3 לחשבון חינמי). ל-`entitlements` אין שורות, כלומר **כל** המשתמשים
חינמיים. שורות קיימות אינן נפגעות (upsert של קיים הולך ל-UPDATE), אבל
**תבנית חדשה תידחה**. למשתמש `c363a4e2` יש 7 תבניות בענן.

**Rollback:** לפני `sync_integrity` היו ל-10 טבלאות
`update_<table>_updated_at`; ל-`water_logs` לא היה טריגר בכלל.

---

## שלב 3 — משתני סביבה וסודות

### חייבים

- [ ] `ALLOWED_ORIGIN` — כולל את דומיין הפרודקשן. ה-CORS הוא fail-closed:
      בלי זה הדפדפן ייחסם.
- [ ] `VITE_DEMO_VIEW_SWITCH` — **להשאיר סגור בפרודקשן.**
      מעכשיו build של פרודקשן דורש `'true'` מפורש כדי לפתוח, כך שמשתנה חסר
      הוא המצב הבטוח. אם הוא נפתח, כל משתמש מחובר יכול להפוך את עצמו למאמן
      מחוץ לכל משפך מסחרי.

### החלטות שלך

- [ ] `AI_REQUIRES_ENTITLEMENT=true` — רק אם ה-AI אמור להיות לפרימיום בלבד.
      כרגע הוא פתוח לכל משתמש מחובר (בכפוף למכסה).
- [ ] `VITE_SENTRY_DSN` — בלי זה אין telemetry בפרודקשן.
      ה-build כבר מייצר source maps מוסתרים ומוציא אותם מ-`dist/`
      (`npm run build:release`), אבל **אף אחד לא מעלה אותם ל-Sentry** —
      זה עדיין ידני.

---

## שלב 4 — Billing (כבוי; לא לפתוח לפני שהכול מוכן)

הקוד המלא קיים ו**מכוון להיות כבוי**: `VITE_BILLING_LIVE=false` וקטלוג
המחירים ריק בכוונה. שום דבר אינו ניתן לרכישה עד שיוכנסו שורות מחיר.
**לא הומצא תמחור.**

- [ ] **החלטה עסקית/משפטית:** ספק תשלומים וישות סוחר. שימו לב:
      Stripe אינו מפרט את ישראל כמדינת סוחר נתמכת (נבדק 26.07.2026);
      merchant-of-record כמו Paddle דורש אישור חוזי.
- [ ] **החלטה עסקית/משפטית:** מחיר, מטבע, מע"מ (כלול/לא), תקופת ניסיון,
      מדיניות ביטול והחזר, חשבונית/קבלה — באישור רו"ח ועו"ד.
- [ ] `supabase secrets set BILLING_PROVIDER=paddle PADDLE_API_KEY=... PADDLE_WEBHOOK_SECRET=... PADDLE_API_BASE=https://api.paddle.com`
- [ ] להכניס שורות מחיר מאושרות ל-`public.billing_prices`
      (יש תבנית INSERT מוערת בסוף `20260726100000_billing_core.sql`, §9).
- [ ] לרשום את כתובת ה-webhook אצל הספק.
- [ ] **sandbox מלא לפני כסף אמיתי:** checkout, success, cancel, duplicate
      delivery, expiry, refund, **failure-injection** — להפיל בכוונה את
      `billing_apply_subscription` ולוודא שה-retry של הספק מגיע למנוי נכון
      אחד. (`billing_events.processed_at` מפריד "נראה" מ"הוחל" בדיוק בשביל זה.)
- [ ] להפוך את המסמכים המשפטיים ל-`isDraft: false` — **רק** לאחר אישור.
- [ ] רק בסוף: `VITE_BILLING_LIVE=true`.
- [ ] מסלול מכירת **מאמנים** להשאיר כבוי עד שיהיה יעד אמיתי לכפתור השדרוג.

---

## שלב 5 — מה שנשאר פתוח ולא נבדק

- [ ] **E2E של שני מכשירים** מול Supabase אמיתי: לערוך אותה רשומה משני
      מכשירים, למחוק במכשיר אחד בזמן שהשני offline, ולוודא שאין דריסה או
      החייאה. הלוגיקה אומתה מול Postgres, המסלול המלא לא.
- [ ] **מדיניות retention ל-tombstones** — כרגע הם נשמרים לנצח.
- [ ] שלושה מסעות E2E מסומנים `test.fixme` (auth+sync, workout, paywall) —
      דורשים פרויקט Supabase לבדיקות עם seed.
- [ ] רצפות coverage עדיין `20%/37%` ב-`vitest.config.ts`.
- [ ] `reminders-dispatch` דורש `CRON_SECRET`, VAPID ו-cron ידני ב-`pg_cron`.
- [ ] ייצוא DSAR מלא (הייצוא הנוכחי קורא IndexedDB/localStorage בלבד).
- [ ] מעבר guest→cloud הוא כפתור ידני ב-Settings ולא בחירה אחרי הרשמה.
- [ ] `record_consent` מקבל `is_minor` / `guardian_ack` **מהלקוח** במקום
      לגזור אותם מטבלת הגיל בשרת.
- [ ] אחראי/ת נגישות מזוהה בשם בהצהרה (יש הערת `OWNER ACTION` בקוד),
      ובדיקה ידנית עם NVDA/JAWS/VoiceOver/TalkBack.
- [ ] `bbtProgram.generated` — chunk של ~218kB שנטען מוקדם מדי.

---

## rollback

אם משהו נשבר אחרי שלב 1:

- **הטריגר** הוא החלק ההפיך בקלות. להחזיר טבלה בודדת להתנהגות הקודמת:
  ```sql
  drop trigger if exists <table>_sync_lww_guard on public.<table>;
  create trigger update_<table>_updated_at
    before update on public.<table>
    for each row execute function update_updated_at_column();
  ```
  ⚠️ זה מחזיר גם את הבאג: כתיבה עם timestamp ישן תתקבל ותיחתם כחדשה.
- **טבלאות חדשות** (billing, product_events, audit) אינן נוגעות בקיים —
  אפשר להשאיר אותן גם אם מגלגלים אחורה.
- **`community_write_rpcs`** מסיר policies של INSERT. לגלגול אחורה יש להחזיר
  אותם *וגם* `grant insert` — הרשאת הטבלה נשללה בנפרד מה-policy.

---

## פקודות לבדיקה מקומית (לא נוגעות בפרודקשן)

```bash
npm run verify      # tsc + lint + format
npm run test:run    # 1202 בדיקות יחידה
npm run test:e2e    # Playwright, כולל שער נגישות axe
npm run db:test     # מיגרציות + RLS + concurrency על Postgres בקונטיינר (דורש Docker)
npm run build:release
```

---

הקשר מלא, כולל GO/NO-GO ומרשם סיכונים:
[`reports/00-MASTER-PRODUCTION-READINESS.md`](reports/00-MASTER-PRODUCTION-READINESS.md)
