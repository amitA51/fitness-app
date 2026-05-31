# 08 — שכבת נתונים, sync אופליין ונכונות backend · תיק עבודה לסוכן Data

> **תפקידך:** סוכן נתונים וסנכרון. הארכיטקטורה: IndexedDB-first + sync ל-Supabase; multi-device הוא יעד; offline חובה. **זהו התחום עם החוסמים הקריטיים ביותר במוצר — multi-device sync שבור כרגע.**

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד/הסכמה החיים; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.**
**שינויי DB/טריגרים/אינדקסים — רק על Supabase branch, עם גיבוי, אף פעם לא ישירות בפרודקשן.** הרץ `get_advisors` (security+performance) אחרי. בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| DA-1 | `fetchWorkoutSessions` משמיט `updatedAt` → merge תמיד שומר מקומי (multi-device שבור) | **Critical** | S |
| DA-2 | טריגר `update_updated_at_column` דורס ts מהלקוח → LWW תלוי סדר-sync, איבוד נתונים | **Critical** | S |
| DA-3 | Water logs מחוץ ל-full sync ול-offline queue → אובד אופליין/multi-device | High | M |
| DA-4 | מפתחות תאריך UTC ב-UI → off-by-one 00:00–03:00 בישראל | High | S |
| DA-5 | `syncAllData` fan-out — N upserts בודדים ללא batching | High | M |
| DA-6 | טבלאות ללא `updated_at` (5 טבלאות) → עריכות לא מתפשטות | High | M |
| DA-7 | מחיקת cascade של תרגיל — אין tombstones, מחיקות לא מתפשטות ב-pull | High | L |
| DA-8 | store `PENDING_SYNC` מת — Settings מציג ספירה שגויה (תמיד 0) | Medium | S |
| DA-9 | `processQueue` — אין retry תקופתי, רק על `online` event | Medium | S |
| DA-10 | `cloudMerge` כתיבות מקבילות — אין אטומיות transaction | Medium | S |
| DA-11 | `getWeeklyNutritionSummary` — full-table scan בכל render | Medium | S |
| DA-12 | `bodyStatsService` מכפיל את `bodyWeightDb` — API סותר | Low | S |
| DA-13 | אין sync אוטומטי ב-login — המשתמש חייב pull ידני | Medium | S |

---

## ממצאים מפורטים

### DA-1 · `fetchWorkoutSessions` משמיט `updatedAt` — **Critical**
- **מיקום:** `src/services/supabaseSync.ts` `fetchWorkoutSessions` — מחזיר `createdAt: row.created_at` אבל **לא** `updatedAt: row.updated_at`. ב-`mergeWorkoutSessionsFromCloud` (`sessionDb.ts`) `cloudTime` נופל ל-`createdAt`. מקומי תמיד "חדש יותר" → **עריכות ענן ממכשירים אחרים תמיד נדחות.**
- **תיקון:** הוסף `updatedAt: row.updated_at` ל-mapping; גם ב-`toCanonicalSession` אם נדרש.
- **DoD:** עריכת סשן במכשיר A מתפשטת ל-B.

### DA-2 · טריגר `update_updated_at_column` דורס ts מהלקוח — **Critical**
- **מיקום:** `supabase/schema.sql` (trigger `update_updated_at_column` מכריח `NEW.updated_at = NOW()`); `supabaseSync.ts` שולח `updated_at`. התוצאה: LWW תלוי **סדר sync**, לא סדר עריכה → תרחיש איבוד נתונים (עריכה ישנה שמסונכרנת מאוחר זוכה).
- **תיקון (migration נפרד על branch):**
  ```sql
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
      NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;
  ```
- **DoD:** ts מהלקוח נשמר כשהוא חדש יותר; תרחיש דו-מכשירי לא דורס עריכה חדשה. `get_advisors` נקי.
- **תיאום:** **03-Security נוגע ב-RLS באותם migrations. צור migration נפרד (אל תערכו את אותו קובץ).**

### DA-3 · Water logs מחוץ ל-sync ול-queue — High
- **מיקום:** `supabaseSync.ts` (אין `water_logs`); `offlineQueue.ts` `MutationType` (אין `water:*`); `waterService.ts` קורא `syncWithRetry` בלי פרמטר `queue` → כשל=אובדן שקט.
- **תיקון:** הוסף `'water:create'|'water:delete'` ל-`MutationType`; הוסף `queue` ל-call; הוסף `fetchWaterLogs`/`mergeWaterLogsFromCloud` ל-`syncAllData`/`pullAllData`.
- **DoD:** מים שורדים אופליין ומסתנכרנים בין מכשירים.

### DA-4 · מפתחות תאריך UTC ב-UI — High
- **מיקום:** `Nutrition.tsx` L70 (`toISOString().split('T')[0]`), `Progress.tsx` L92-93 (`.slice(0,10)`), `nutritionService.ts` L807, `insightsAggregator.ts` L96-97. `todayStr()` ב-`dateUtils.ts` משתמש נכון ב-local; אלה עוקפים אותו → 00:00–03:00 בישראל מציג אתמול (ארוחה "נעלמת").
- **תיקון:** החלף ב-`todayStr()`; צור `toLocalDateStr(date)` לתאריכים שאינם היום; החלף בכל ~15 ה-call sites.
- **DoD:** בדיקה ב-01:30 מקומי מחזירה היום הנכון; אין `toISOString().slice/split` למפתחות-יום.
- **תיאום:** **07-Testing מוסיף בדיקות `dateUtils`/`todayStr` עם fake timers.** תאם.

### DA-5 · `syncAllData` fan-out — High
- **מיקום:** `supabaseSync.ts` `syncAllDataImpl` — Promise לכל רשומה בכל 10 stores → 700+ בקשות במקביל → 429 (לא מנוסים), רוויה, timeouts.
- **תיקון:** `.upsert([...])` בקבוצות 50–100; concurrency limiter (conc=3); sync אינקרמנטלי `updatedAt > lastSync`.
- **DoD:** מספר בקשות סביר; sync מלא לא נכשל למשתמש פעיל.
- **תיאום:** **משותף עם 04-Perf (P-1/P-4). אתה הבעלים (נכונות); בצע ראשון, ואז 04 מצרף batching/pagination.**

### DA-6 · טבלאות ללא `updated_at` — High
- **מיקום:** `schema.sql` — `body_weight`, `body_measurements`, `personal_records`, `recovery_logs`, `nutrition_logs` עם `created_at` בלבד. `cloudMerge.mergeGenericRecords` נופל ל-`createdAt` → עריכות לא מזוהות כחדשות (מקומי זוכה ב-tie). **עריכות ב-B נזרקות ב-A.**
- **תיקון (migration על branch):** הוסף `updated_at TIMESTAMPTZ DEFAULT NOW()` + טריגר (המתוקן מ-DA-2) ל-5 הטבלאות; עדכן mappers לקרוא/לכתוב `updated_at`.
- **DoD:** עריכות 5 סוגי הרשומות מתפשטות בין מכשירים.

### DA-7 · cascade delete ללא tombstones — High
- **מיקום:** `exerciseDb.ts` `deletePersonalExercise` — מוחק PRs מקומית + ב-cloud (cascade שרת תקין). אבל **pull רק ממזג (add/update), לא מוחק** רשומות מקומיות שנעלמו מהענן → מכשיר אחר נשאר עם PRs יתומים.
- **תיקון:** מנגנון tombstone / `deleted_at` (soft delete), או ב-pull זהה רשומות מקומיות שחסרות בתגובת הענן והסר אותן.
- **DoD:** מחיקה במכשיר A מתפשטת ל-B.

### DA-8 · `PENDING_SYNC` store מת — Medium
- **מיקום:** `indexedDBCore.ts` יוצר `PENDING_SYNC` (אף פעם לא נכתב אליו — התור האמיתי ב-`SparkOS_Queue` של `offlineQueue.ts`). `Settings.tsx` קורא ממנו → תמיד מציג 0 (מטעה).
- **תיקון:** Settings ישתמש ב-`getQueueDepth()` מ-`offlineQueue.ts`; הסר את `PENDING_SYNC` ב-bump עתידי.
- **DoD:** ספירת pending אמיתית.
- **תיאום:** 06-Arch (AR-9) ו-04-Perf נוגעים ב-`indexedDBCore`/Settings. תאמו.

### DA-9 · אין retry תקופתי — Medium
- **מיקום:** `offlineQueue.ts` `setupOnlineListener` — מעבד רק ב-startup וב-`online`. ברשת רעועה (timeouts אך `navigator.onLine===true`) מוטציות נתקעות עד restart.
- **תיקון:** `setInterval(processQueue, 60–120s)` ב-`initOfflineSync` כש-online ו-depth>0.
- **DoD:** מוטציות תקועות מנוגנות מחדש בלי restart.

### DA-10 · `cloudMerge` כתיבות לא אטומיות — Medium
- **מיקום:** `cloudMerge.ts` `mergeGenericRecords` — `Promise.all(writes.map(dbPut))` (transaction ל-`dbPut`). crash באמצע → חלקי. גם `sessionDb`/`templateDb` merge.
- **תיקון:** transaction יחיד: `tx = db.transaction(store,'readwrite')`, `for (...) store.put(...)`, המתן ל-`tx.oncomplete`.
- **DoD:** merge אטומי.

### DA-11 · `getWeeklyNutritionSummary` full-table scan — Medium
- **מיקום:** `nutritionService.ts` L810 — `dbGetAll(NUTRITION_LOGS)` ואז סינון JS. גם `getMealEntriesByDate`/`ByDateRange`/water totals. ~1000 רשומות בכל ביקור.
- **תיקון:** הוסף index `date` ל-`NUTRITION_LOGS` (bump ל-v8, כמו `WATER_LOGS`); `dbGetByRange(...,'date',start,end)`.
- **DoD:** queries לפי טווח דרך index, לא full scan.

### DA-12 · `bodyStatsService` מכפיל `bodyWeightDb` — Low
- **מיקום:** `bodyStatsService.ts` (`addBodyWeight`/`updateBodyWeight`/`deleteBodyWeight`, id `generateId('bw')`) vs `bodyWeightDb.ts` (`saveBodyWeight`/`deleteBodyWeight`/`getBodyWeightHistory`). שניהם מסנכרנים → סיכון double-sync.
- **תיקון:** אחֵד למודול קנוני אחד; השני מאציל אליו.
- **DoD:** מודול אחד ל-body weight CRUD.
- **תיאום:** 06-Arch (איחוד מקורות אמת). תאמו.

### DA-13 · אין sync אוטומטי ב-login — Medium
- **מיקום:** `main.tsx` — `initOfflineSync()` רק מנגן את התור, לא קורא `pullAllData`. משתמש חדש/אחרי ניקוי רואה אפליקציה ריקה עד pull ידני.
- **תיקון:** ב-handler של auth state change (או אחרי login מוצלח) קרא `pullAllData()` אם ה-stores ריקים או `lastSyncTime` ישן.
- **DoD:** login במכשיר חדש מושך אוטומטית מהענן.

---

## הזדמנויות שדרוג
- **Incremental/Delta sync** — `last_synced_at` פר-store, sync רק מאז (חיסכון 95%+).
- **Conflict resolution UI** — לנתונים חשובים (sessions/templates) דיאלוג במקום LWW שקט.
- **Supabase Realtime** מחובר ל-merge — עדכון multi-device מיידי (subscriptions קיימים, לא מחוברים).
- **Background Sync API** — ניגון התור גם כשהאפליקציה סגורה.
- **Unified Sync Engine** — WAL יחיד במקום dual-system, עם hybrid logical clocks + tombstones.
- **CRDT (Yjs/Automerge)** למערך ה-exercises (JSONB) — עריכה מקבילית אמיתית בלי דריסה.

## תיאום ונקודות חיכוך
- `supabaseSync.ts` (DA-1, DA-5) → **אתה הבעלים. 04-Perf מצרף batching אחריך.**
- migrations/schema (DA-2, DA-6) → **רק על branch.** **03-Security נוגע ב-RLS — צור migrations נפרדים.**
- `indexedDBCore`/`syncEngine`/Settings (DA-8) → תאם עם **06-Arch** (AR-6/AR-9) ו-04-Perf.
- תאריכים (DA-4) → **07-Testing** מוסיף בדיקות. תאם.
- `bodyStatsService`/`bodyWeightDb` (DA-12) → תאם עם **06-Arch**.

## הגדרת סיום (תיק)
DA-1+DA-2 נסגרו ו-multi-device sync עובד (תרחיש דו-מכשירי מאומת); DA-4 (UTC) תוקן; water sync (DA-3) עובד; migrations עברו על branch + `get_advisors` נקי; `npm run verify && npm run test:run` ירוקים; בדיקות sync חדשות (בתיאום עם 07).
