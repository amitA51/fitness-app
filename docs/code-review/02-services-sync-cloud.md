# 02 — סנכרון, ענן (Supabase), Auth ושירותים נלווים

קבצים שנסקרו: `cloudMerge.ts`, `supabaseSync.ts`, `supabaseSyncMappers.ts`, `syncEngine.ts`, `supabaseAuth.ts`, `lib/supabase.ts`, `nutritionService.ts`, `waterService.ts`, `exportService.ts`, `notificationService.ts`, `eventTracker.ts`, `webVitals.ts`

הקשר חוצה-קבצים: `STORES.USER_SETTINGS` משתמש ב-`keyPath: 'key'` (כל שאר ה-stores ב-`id`, `PENDING_SYNC` ב-`tag`); `syncPendingToServer` **ללא קוראים** באפליקציה.

---

## `src/services/syncEngine.ts`

### [Critical] Bug — תור ה-retry לאופליין לא ניתן לשחזור (איבוד נתונים שקט)
- **שורות:** ~55-70 (`queuePendingSync`), ~138-185 (`syncPendingToServer`)
- בכשל סופי, נשמרים רק `{ tag, operation }` (שתי מחרוזות) — ה-payload וה-`syncFn` נזרקים. `syncPendingToServer(syncFn)` מקבל `(tag) => Promise<void>` גנרי בלי נתונים לשחזר את הפעולה, ו**שום דבר באפליקציה לא קורא ל-`syncPendingToServer`**. תוצאה: כל סנכרון שנכשל אחרי retries מתור ואז ננטש לצמיתות.
- **תיקון:** לשמור את ה-payload המלא (table + snapshot של הרשומה) ב-entry, ולחבר את `syncPendingToServer` ל-handler של `online`/startup שמשחזר כל entry ל-upsert אמיתי.

### [Medium] Bug — Re-queue מאפס את retryCount, אז entries לא מתבגרים
- **שורות:** `queuePendingSync` ~L60 — תמיד כותב `retryCount: 0`, וה-keyPath הוא `tag`. כל כשל חוזר דורס את הקודם ומאפס את המונה, אז לוגיקת ה-discard לעולם לא תופעל.
- **תיקון:** לקרוא entry קיים קודם ולהעביר/להגדיל את `retryCount` במקום לאפס.

### [Medium] Performance — Backoff מעריכי בלי jitter או תקרה
- **שורות:** `tryExecuteSync` ~L38: `const delay = 1000 * 2 ** attempt;`. עם הרבה רשומות שנכשלות יחד, כל ה-retries יורים באותו לוח זמנים → thundering-herd נגד Supabase.
- **תיקון:** להוסיף jitter אקראי ותקרת delay מקסימלית.

### [Low] Code Quality — בדיקת תצורה כפולה
- **שורות:** `syncWithRetry` ~L98-108 קורא `import.meta.env` ישירות וגם קורא `isSupabaseConfigured()`.
- **תיקון:** להסתמך רק על `isSupabaseConfigured()`.

---

## `src/services/supabaseSync.ts`

### [High] Bug — Last-write-wins תמיד מעדיף את הענן ודורס עריכות חדשות שלא נמשכו
- **שורות:** כל `sync*` upsert חותם `updated_at: new Date().toISOString()` (templates ~60, sessions ~127, exercises ~205, AI ~640). מיזוג המשיכה (`mergeGenericRecords`) שומר את הצד עם ה-`updatedAt` הגדול יותר. מכיוון ש-push תמיד חותם "עכשיו", מכשיר שדוחף נתון ישן גובר על עריכה חדשה יותר ממכשיר אחר שלא נמשך עדיין → lost update. אין hash תוכן או השוואת גרסה.
- **תיקון:** לחתום `updated_at` מזמן השינוי האחרון של הרשומה עצמה ו/או להוסיף optimistic concurrency.

### [High] Bug — `syncUserSetting` מייצר id חדש כשחסר → שורות כפולות ללא גבול
- **שורות:** ~520-530: `id: setting.id || crypto.randomUUID()`. ה-store המקומי `USER_SETTINGS` ממפתח על `key`, לא `id`, אז להרבה settings אין `id` יציב. כל push בלי `id` מכניס שורת ענן חדשה.
- **תיקון:** upsert עם `onConflict: 'user_id,key'` ומפתח יציב, או id דטרמיניסטי שנגזר מ-`(user_id, key)`.

### [High] Performance — משיכת טבלה מלאה ו-push לכל רשומה ללא pagination/batching
- **שורות:** כל `fetch*` משתמש ב-`.select('*')` ללא `limit`/range (~75, ~140), ו-`syncAllData` (~890-990) דוחף כל רשומה כ-`upsert` בודד בתוך `Promise.all` ללא גבול. למשתמש עם היסטוריה גדולה זה טוען טבלאות שלמות לזיכרון ויורה מאות/אלפי בקשות מקבילות.
- **תיקון:** לבחור רק עמודות נחוצות, paginate (`.range()`), ולהשתמש ב-array upserts (בקשה אחת לטבלה).

### [Medium] Bug — `success: true` מוחזר גם כשהרבה pushes/merges נכשלו
- **שורות:** `syncAllData` ~995-1010, `pullAllData` ~1080-1095 — מלוגגים `pushFailed`/`mergeFailed` אבל עדיין מחזירים `{ success: true }`.
- **תיקון:** להחזיר `success: false` (או flag של כשל חלקי) כשמשהו נדחה.

### [Medium] Bug — `created_at` נדרס בכל update
- **שורות:** `syncWorkoutSession` ~120 מציב `created_at: session.startTime` בכל upsert. על upserts חוזרים זה יכול לשכתב את חותמת היצירה המקורית בשרת.
- **תיקון:** לא לשלוח `created_at` ב-updates (לתת ל-DB לשמור), או default ב-DB ולהציב רק ב-insert.

### [Low] Code Quality — `pullAllData` חסר את guard ה-`isSupabaseConfigured` שיש ל-`syncAllData`
- **שורות:** ~1030 — מסתמך על כל `fetch*` שמחזיר `[]` כשלא מוגדר.
- **תיקון:** להוסיף את אותו guard מוקדם.

### [Low] Code Quality — ערוצי Realtime נשמרים ב-`Map` גלובלי למודול
- **שורות:** ~660-760 — `realtimeChannels` ממופתח רק ב-`table:userId`; callbacks מטופסים `(payload: unknown)`. יכול לדלוף ערוצים בין החלפות משתמש.
- **תיקון:** לקשור את מחזור החיים של הערוץ ל-owner מבוסס-auth ולטפל ב-`SUBSCRIBED`/`CHANNEL_ERROR`.

---

## `src/services/cloudMerge.ts`

### [High] Bug — `replaceUserSettingsFromCloud` / `replaceAIConversationsFromCloud` עדיין הרסניים
- **שורות:** ~61-72 — שניהם `dbClear(...)` ואז מכניסים שורות ענן מחדש. למרות שכותרת הקובץ טוענת שהמודול לא-הרסני, שני אלה מוחקים רשומות מקומיות-בלבד (settings/conversations שלא נדחפו) → איבוד נתונים. גם לא אטומיים.
- **תיקון:** לנתב דרך `mergeGenericRecords` כמו האחרים, או לעטוף clear+put ב-transaction יחיד.

### [Medium] Bug — `mergeGenericRecords` ממפתח שגוי user settings (id מול key)
- **שורות:** ~85-120 ממפים רשומות לפי `String(r.id ?? '')`, אבל ה-keyPath של `USER_SETTINGS` הוא `key`. settings ללא `id` כולם קורסים למפתח מחרוזת ריקה.
- **תיקון:** להפוך את שדה המפתח לניתן-לתצורה לכל store (ברירת מחדל `id`, `key` ל-settings).

### [Medium] Bug — רשומות עם תיקו/חותמת חסרה לעולם לא מתעדכנות, השוואת NaN
- **שורות:** ~100-112: `new Date(local.updatedAt || local.createdAt || '').getTime()` נותן `NaN` כשהשניים חסרים, ו-`cloudTime > localTime` הוא `false` לתיקו ולכל `NaN`. טיפוסים שנושאים רק `createdAt` לעולם לא מקבלים עדכוני ענן.
- **תיקון:** לטפל בחותמות חסרות במפורש (fallback ל-deep-equality או `>=` עם בדיקת תוכן).

### [Medium] Performance — `await dbPut` סדרתי בתוך לולאת המיזוג
- **שורות:** ~98-115 — כל רשומה נכתבת אחת-אחת.
- **תיקון:** batch לכתיבות (איסוף ואז `Promise.all`, או transaction יחיד).

### [Low] Code Quality — מקור קבועי-store לא עקבי (`LS` מול `STORES`)
- **שורות:** ~44, ~54, ~63-64, ~71 משתמשים ב-`LS.*` בעוד פונקציות אחיות משתמשות ב-`STORES.*`. עובד רק כי הערכים זהים במקרה.
- **תיקון:** להשתמש ב-`STORES.*` בעקביות.

---

## `src/services/supabaseSyncMappers.ts`

### [Medium] Code Quality — `unknown[]` + casts של `as` מבטלים בטיחות טיפוסים
- **שורות:** ~205-215, ~225-240 — `exercises: unknown[]` וקסטים כמו `(t.exercises ?? []) as ...` עוקפים את כלל "ללא any"; נתוני ענן פגומים עוברים ללא בדיקה.
- **תיקון:** להגדיר `ExerciseRow`/שכבה מסודרת ולאמת (runtime guard קל) במקום cast.

### [Low] Bug — ברירת מחדל תאריך ב-`toCanonicalSession` מניחה קלט ISO-8601
- **שורות:** ~225: `s.startTime.slice(0, 10)` מניח ש-`startTime` הוא מחרוזת ISO.
- **תיקון:** לפרסר דרך `new Date(...)` ולפרמט הגנתית.

### [Low] Code Quality — `toCanonicalPersonalExercise` עושה spread של השורה הגולמית כולל עמודות DB
- **שורות:** ~250: `({ ...e, id, name })` מעתיק `user_id` ושדות transport לאובייקט הדומיין.
- **תיקון:** למפות שדות מפורשים במקום spread.

---

## `src/services/supabaseAuth.ts`

### [High] Performance — `getCurrentUser()` עושה round-trip רשת בכל כתיבה
- **שורות:** ~135-150 — `getCurrentUser` קורא `supabase.auth.getUser()`, שפוגע בשרת ה-auth. נקרא בכל כתיבת nutrition/water/meal.
- **תיקון:** להשתמש ב-`getSession()` (קורא session מקומי, ללא רשת) למסלול הנפוץ, ולשמור cache ל-id.

### [Medium] Bug — מפתח localStorage שמתנקה לא תואם למפתח אחסון ה-session של supabase-js
- **שורות:** `handleExpiredSession` ~115, `signOut` ~300 עושים `localStorage.removeItem('supabase_session')`, אבל supabase-js v2 שומר תחת `sb-<project-ref>-auth-token`.
- **תיקון:** להגדיר `auth.storageKey` מפורש ב-`createClient` ולמחוק את המפתח המדויק, או להסתמך על `auth.signOut()`.

### [Low] Security — metadata של הרשמה נשמר ב-user_metadata
- **שורות:** `signUp` ~165 מעביר `metadata` ל-`options.data` (→ `user_metadata`), שניתן לעריכה ע"י המשתמש. לעולם לא לבסס authorization על זה.
- **תיקון:** לשמור שדות authz-רלוונטיים ב-`app_metadata` (צד שרת).

### [Low] Security — שגיאות auth מלאות נרשמות בלוג
- **שורות:** ~225 `logger.auth.error('Sign in error', error)` יכול לכלול את האימייל שהוגש.
- **תיקון:** ללוגג רק `error.message`/`error.code`.

---

## `src/lib/supabase.ts`

### [Low] Security — anon key מוטמע בלקוח (צפוי) — תלות RLS חייבת להחזיק
- **שורות:** ~9-15 — `VITE_SUPABASE_ANON_KEY` הוא נכון מפתח anon. כל טבלה דרך ה-Data API סומכת באופן מובלע על RLS.
- **תיקון:** לוודא ש-RLS מופעל עם policies per-user בכל טבלה מסונכרנת; להתייחס לזה כ-release gate.

### [Low] Code Quality — אין תצורת אחסון auth מפורשת
- **שורות:** `createClient` נקרא ללא אפשרויות.
- **תיקון:** להעביר `auth: { storageKey, persistSession, autoRefreshToken }` מפורש.

---

## `src/services/nutritionService.ts`

### [Medium] Bug — unhandled rejection ב-fire-and-forget sync של preset
- **שורות:** `addFoodFromPreset` ~470-505 עוטף sync ב-`void (async () => {...})()` ללא try/catch.
- **תיקון:** להוסיף `.catch()`/try-catch בתוך ה-IIFE.

### [Medium] Code Quality — לוגיקת מיפוי-ענן משוכפלת שלוש פעמים
- **שורות:** מיפוי payload זהה של `syncNutritionLog(...)` ב-`addFoodFromPreset`, `addMealEntry`, `updateMealEntry` (~480, ~545, ~580).
- **תיקון:** לחלץ helper `toNutritionLogPayload(entry)`.

### [Medium] Performance — סריקות store מלאות לכל שאילתה
- **שורות:** `getMealEntriesByDate`, `getMealEntriesByDateRange`, `getDailyMacros`, `getWeeklyNutritionSummary` (~620-700) כולם `dbGetAll` ואז filter ב-JS.
- **תיקון:** להשתמש באינדקס `date` (IDB key range).

### [Low] Bug — id של ארוחה `m-${Date.now()}` יכול להתנגש
- **שורות:** ~475, ~720 — שתי ארוחות באותה millisecond מתנגשות.
- **תיקון:** להשתמש ב-`generateId('meal')` הקיים.

### [Low] Bug — casing לא עקבי ב-`searchFoods`
- **שורות:** ~415 — השאילתה `toLowerCase()` אבל `f.name.includes(q)` לא (רק `brand`).
- **תיקון:** `f.name.toLowerCase().includes(q)`.

---

## `src/services/waterService.ts`

### [Medium] Bug — id מיוצר קצר מסתכן בהתנגשות בין-מכשירית / lost update
- **שורות:** `addWaterEntry` ~33: `generateId('water', 5)` משתמש בסיומת אקראית קצרה מאוד. שני מכשירים יכולים לייצר אותו id; ה-`upsert(..., { onConflict: 'id' })` דורס.
- **תיקון:** להשתמש ב-UUID מלא (`crypto.randomUUID()`).

### [Low] Performance — סריקת store מלאה לכל קריאה
- **שורות:** ~50-80 — `getTodayWaterTotal`/`getTodayWaterEntries`/`getWaterByDateRange` עושים `dbGetAll` ואז filter למרות אינדקס `date` קיים.
- **תיקון:** לשאול דרך אינדקס `date`.

### [Low] Security — מסתמך על RLS ל-`water_logs`
- **תיקון:** לוודא policy per-user ל-`water_logs`.

---

## `src/services/exportService.ts`

### [Medium] Security — CSV formula injection
- **שורות:** `downloadCSV` ~150-165 עוטף תאים במרכאות אבל לא מנטרל `=`, `+`, `-`, `@` מובילים. שדות כמו `exerciseName`, `notes` ושמות ארוחות נשלטים ע"י המשתמש, אז ערך מעוצב מתבצע כנוסחה כשפותחים את ה-CSV ב-Excel/Sheets.
- **תיקון:** להוסיף prefix `'` או רווח לתאים שמתחילים ב-`= + - @` (וטאב/CR) לפני העטיפה.

### [Medium] Bug — ציטוט תאי CSV לא מבריח מרכאות/שורות חדשות מוטמעות
- **שורות:** אותה פונקציה — תאים נפלטים כ-`"${cell}"` ללא הכפלת `"` פנימי.
- **תיקון:** להבריח `"` כ-`""` ולוודא ששורות חדשות נשארות בתוך השדה המצוטט (RFC 4180).

### [Low] Code Quality — בליעת שגיאות שקטה
- **שורות:** `shareReport` ו-`copyToClipboard` ~190-210 `catch { return false; }` ללא לוג.
- **תיקון:** ללוגג את השגיאה (debug) לפני החזרת false.

---

## `src/services/notificationService.ts`

### [Low] Bug — helpers של תזכורות קוראים ל-`showNotification` async ללא catch
- **שורות:** ~95-115 — `showWorkoutReminder`/`showMissedWorkoutAlert`/`showPRNotification`/`showNutritionReminder` מפעילים `showNotification(...)` ללא `await`/`.catch()`.
- **תיקון:** `void showNotification(...).catch(() => {})` או להפוך לקוראים await.

### [Low] Code Quality — כתיבת `saveNotificationConfig` לא מוגנת
- **שורות:** ~50 — `localStorage.setItem(...)` יכול לזרוק (quota/privacy mode).
- **תיקון:** לעטוף ב-try/catch עקבי עם מסלול הקריאה.

---

## `src/services/eventTracker.ts`

### [Medium] Performance — parse מלא + stringify מלא בכל אירוע
- **שורות:** `trackEvent`/`trackPageView` ~35-55 קוראים `getStore()` (parse של מערך שלם) ו-`save()` (stringify של מערך שלם) בכל קריאה — I/O סינכרוני על ה-main thread.
- **תיקון:** לשמור store בזיכרון ולעשות debounce/batch לפרסיסטנס (flush על interval / `visibilitychange`).

### [Low] Bug — race של read-modify-write יכול להפיל אירועים
- **שורות:** `getStore → push → save` לא אטומי.
- **תיקון:** buffer append-only ש-flushed אטומית.

### [Low] Code Quality — parsing JSON לא עקבי
- **שורות:** ~16 — `getStore` משתמש ב-`JSON.parse` גולמי בעוד `notificationService` משתמש ב-`safeJsonParse`.
- **תיקון:** להשתמש ב-`safeJsonParse`.

### [Low] Security — אין guardrail על תוכן `props`
- **שורות:** `props: Record<string, string | number>` נשמר verbatim; קוראים יכולים לשים PII.
- **תיקון:** לתעד/לאכוף ש-`props` לא יכיל PII, או whitelist למפתחות.

---

## `src/services/webVitals.ts`

### [Low] Code Quality — מטריקות נזרקות בproduction
- **שורות:** `logMetric` ~5-20 רק `console.log` בתוך `import.meta.env.DEV`; ב-production ה-handler לא עושה כלום.
- **תיקון:** לשלוח מטריקות ל-sink אנליטי/RUM ב-production, או לתעד שזה מכוון.

### [Low] Code Quality — `color` מחושב ללא תנאי אבל בשימוש רק ב-DEV
- **שורות:** ~7-15.
- **תיקון:** להעביר את חישוב ה-`color` לתוך ה-`if (import.meta.env.DEV)`.

---

## סיכום פריטים בעדיפות גבוהה
1. [Critical] `syncEngine.ts` — תור ה-retry לא שומר payload ולא מנוגן אף פעם → איבוד שקט של עריכות אופליין.
2. [High] `supabaseSync.ts` — last-write-wins תמיד חותם `updated_at: now`, דורס עריכות חדשות; אין זיהוי התנגשות.
3. [High] `supabaseSync.ts` — `syncUserSetting` מייצר UUID חדש כש-`id` חסר → שורות ענן כפולות בכל sync.
4. [High] `supabaseSync.ts` — `select('*')` ללא pagination + push לכל רשומה → payloads גדולים וסופת בקשות.
5. [High] `cloudMerge.ts` — `replaceUserSettingsFromCloud`/`replaceAIConversationsFromCloud` עדיין `dbClear` → הרסני, לא אטומי.
6. [High] `supabaseAuth.ts` — `getCurrentUser()` (רשת) נקרא בכל כתיבה מקומית.
