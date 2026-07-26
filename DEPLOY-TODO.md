# DEPLOY-TODO — מה חייב לקרות בפריסה הבאה

> **סטטוס: הקוד ב-master, ה-DB לא נפרס.**
> נכתב ב-26.07.2026. כל מה שכאן טרם בוצע מול Supabase החי.
> אחרי שמסיימים — למחוק את הסעיף שבוצע, לא להשאיר "וי" מטעה.

---

## ⚠️ קודם כל: שתי דרכים לשבור את האפליקציה

הפריסה הזאת **אינה** אופציונלית ואינה תלוית-סדר-חופשי.

1. **פריסת Functions בלי Migrations → ה-AI, ההזמנות והמחיקה יחזירו 503.**
   `ai-chat`, `coach-invite-accept`, `coach-push-send`, `account-delete`
   ו-`billing-checkout` קוראים ל-RPC חדש בשם `consume_rate_limit`, והם
   **fail-closed** בכוונה: אם ה-RPC לא קיים הם מסרבים לשרת בקשה במקום להגיש
   תנועה שאי אפשר למדוד. זו התנהגות נכונה, אבל היא הופכת את הסדר לקריטי.

2. **פריסת Migrations בלי Functions → ה-rate limiting יישאר שבור.**
   הפונקציות הקיימות ימשיכו להריץ את הגרסה הלא-אטומית (התבנית הישנה
   read-then-insert, שבה 50 בקשות במקביל מול מכסה 5 עוברות כמעט כולן).

**הסדר: Migrations קודם, Functions אחריהם.** לא הפוך.

---

## שלב 0 — לפני שנוגעים בפרודקשן

- [ ] **גיבוי / snapshot של ה-DB.** לא דילוג. `sync_lww_guard` **מחליף
      טריגרים קיימים** ב-11 טבלאות (מסיר את `update_<table>_updated_at`
      ומתקין `<table>_sync_lww_guard` במקומו).
- [ ] להריץ על **staging** קודם. אם אין staging — לבקש מהעוזר להרים את
      ה-schema המלא בקונטיינר ולהריץ את ה-migrations מולו.
      > הערה על מה שכן נבדק: `npm run db:test` מריץ את כל ה-migrations על
      > Postgres 16 בקונטיינר עם schema **מינימלי** ומעביר 6 חבילות
      > assertions + הוכחת idempotency + בדיקת concurrency. זה **לא**
      > תחליף להרצה מול ה-schema האמיתי.
- [ ] לוודא שאין מכשיר של משתמש אמיתי באמצע אימון בזמן הפריסה (טיוטת אימון).

---

## שלב 1 — Migrations

```bash
supabase db push
```

שש מיגרציות חדשות (בסדר הזה):

| # | קובץ | מה זה עושה |
|---|---|---|
| 1 | `20260726090000_account_deletion_audit.sql` | טבלת audit למחיקת חשבון. RLS דלוקה ללא policies — service role בלבד. |
| 2 | `20260726100000_billing_core.sql` | קטלוג מחירים, לקוחות, מנויים, checkout sessions, `has_feature_access`, מכסת 3 תבניות חינמיות, `current_entitlement` שמפוגג תקופה שהסתיימה. |
| 3 | `20260726110000_product_events.sql` | טבלת אירועי funnel. INSERT-own בלבד עם allowlist של שמות. |
| 4 | `20260726120000_sync_integrity.sql` | ⚠️ **מחליף טריגרים ב-11 טבלאות.** `sync_lww_guard` — דוחה כתיבה ישנה, שומר tombstones, מוסיף `deleted_at` ל-`water_logs`. |
| 5 | `20260726130000_rate_limit_atomic.sql` | `consume_rate_limit` — ה-RPC שכל ה-Functions תלויות בו. |
| 6 | `20260726140000_community_write_rpcs.sql` | `create_post` / `create_comment` (שלא היו קיימים בכלל — הקהילה לא עבדה), ומסיר את policies + privilege של INSERT ישיר. |

### אימות אחרי הפריסה

- [ ] ה-RPC קיים: `select public.consume_rate_limit('deploy_check','x',60,1);` → `true`
- [ ] הטריגרים הוחלפו, ואין כפילות:
      ```sql
      select c.relname, t.tgname, p.proname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_proc  p on p.oid = t.tgfoid
      where not t.tgisinternal
        and p.proname in ('sync_lww_guard','update_updated_at_column')
      order by 1, 2;
      ```
      מצפים ל-`sync_lww_guard` על 11 הטבלאות, ו-**אפס** `update_updated_at_column` עליהן.
- [ ] `create_post` ו-`create_comment` קיימים, ו-INSERT ישיר ל-`posts` נחסם למשתמש מחובר.

---

## שלב 2 — Edge Functions

**כולן, כולל הקיימות.** שלוש מהן עברו ל-limiter המשותף
(`supabase/functions/_shared/rateLimit.ts`) ופונקציה שלא נפרסה מחדש תמשיך
להריץ את הגרסה השבורה.

```bash
# עודכנו — חייבות פריסה מחדש
supabase functions deploy ai-chat
supabase functions deploy coach-invite-accept
supabase functions deploy coach-push-send

# חדשות
supabase functions deploy account-delete
supabase functions deploy billing-checkout
supabase functions deploy billing-webhook --no-verify-jwt
```

`billing-webhook` נפרס עם `--no-verify-jwt` **בכוונה**: ספק תשלומים אינו יכול
להציג JWT של Supabase. האימות שלו הוא חתימת HMAC על ה-raw body, מאומתת בתוך
הפונקציה. ה-`config.toml` שלה כבר מקבע `verify_jwt = false` כדי שההגדרה לא
תיסחף בין סביבות.

### אימות אחרי הפריסה

- [ ] `ai-chat` מחזיר תשובה תקינה (ולא 503 — 503 = ה-RPC חסר, חזור לשלב 1).
- [ ] פרסום פוסט בקהילה עובד מהאפליקציה.
- [ ] מחיקת חשבון על **חשבון בדיקה**: לוודא שה-Storage והשורות נמחקו ושיש
      שורת audit.

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
