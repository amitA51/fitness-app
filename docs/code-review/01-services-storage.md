# 01 — שכבת אחסון IndexedDB ושירותי נתונים

קבצים שנסקרו: `indexedDBCore.ts`, `dataService.ts`, `dataEvents.ts`, `workoutDb.ts`, `sessionDb.ts`, `templateDb.ts`, `exerciseDb.ts`, `personalItemsDb.ts`, `bodyWeightDb.ts`, `bodyStatsService.ts`, `offlineQueue.ts`

---

## ממצאים חוצי-קבצים (ארכיטקטורה)

### A1. שתי מערכות סנכרון-אופליין מקבילות ומנותקות
- **קבצים:** `offlineQueue.ts` (כל הקובץ) מול `syncEngine.ts` (`syncWithRetry` + store `pending_sync`)
- **חומרה:** [High] · **קטגוריה:** Code Quality / Bug
- **תיאור:** כל האפליקציה כותבת דרך `syncWithRetry(...)`, שמכניס כשלים ל-store `pending_sync` (ב-`sparkos-fitness-db`). `offlineQueue.ts` מממש תור נפרד ב-DB אחר (`SparkOS_Queue`, store `mutation_queue`) דרך `queueMutation()`. חיפוש מראה ש-`queueMutation` **אף פעם לא נקרא** — רק `initOfflineSync()` מחובר ב-`App.tsx`. כלומר תת-מערכת של ~500 שורות מעבדת תור שתמיד ריק.
- **תיקון:** או למחוק את `offlineQueue.ts` ולעבוד עם `pending_sync` של `syncEngine`, או להעביר את כל מסלולי הכתיבה ל-`queueMutation` ולמחוק את `pending_sync`. לבחור אסטרטגיה אחת.

### A2. `clear()` + `Promise.all(put)` לא אטומי → חלון לאיבוד נתונים
- **קבצים:** `sessionDb.replaceWorkoutSessionsFromCloud` (~L141), `templateDb.replaceWorkoutTemplatesFromCloud` (~L150), `bodyWeightDb.replaceBodyWeightFromCloud` (~L52), `exerciseDb.replacePersonalExercisesFromCloud` (~L246), `cloudMerge.replaceUserSettingsFromCloud`/`replaceAIConversationsFromCloud`
- **חומרה:** [High] · **קטגוריה:** Bug (איבוד נתונים)
- **תיאור:** כל אחד עושה `await dbClear(store)` ואז `await Promise.all(items.map(dbPut))`. ה-clear וה-puts רצים ב-transactions נפרדים. אם put כלשהו נדחה (quota, serialization) או הטאב נסגר באמצע, ה-store כבר רוקן אבל לא מולא מחדש — איבוד נתונים מקומי קבוע. בנוסף כל `dbPut` הוא transaction נפרד, אז אין rollback.
- **תיקון:** לבצע clear + כל ה-puts בתוך transaction יחיד מסוג `readwrite` על ה-store ולפתור על `tx.oncomplete`.

### A3. CRUD כפול למשקל גוף + טיפוסים כפולים
- **קבצים:** `bodyWeightDb.ts` מול `bodyStatsService.ts`
- **חומרה:** [Medium] · **קטגוריה:** Code Quality (DRY)
- **תיאור:** שני המודולים כותבים ל-`STORES.BODY_WEIGHT` עם פונקציות חופפות ומעט שונות: `saveBodyWeight` מול `addBodyWeight`, שני `deleteBodyWeight`, `getLatestBodyWeight` (מחזיר `number|null`) מול `getLatestWeight` (מחזיר entry). חשוב: `addBodyWeight` מאמת `0 < weight < 700` אבל `saveBodyWeight` לא מאמת כלום — אותו store, invariants שונים. `bodyStatsService.ts` גם מצהיר מחדש על `BodyWeightEntry`/`BodyMeasurement`/`RecoveryLog` שכבר קיימים ב-`src/types`.
- **תיקון:** לאחד למודול אחד של משקל גוף, לייבא טיפוסים מ-`src/types`, ולהפעיל ולידציה במסלול כתיבה יחיד.

---

## `src/services/indexedDBCore.ts`

### C1. כתיבות resolve על `request.onsuccess`, לא על `tx.oncomplete`
- **שורות:** `dbPut` ~L210, `dbDelete` ~L224, `dbClear` ~L238
- **חומרה:** [Medium] · **קטגוריה:** Bug (durability)
- **תיאור:** `request.onsuccess` נורה לפני שה-transaction עושה commit. אם ה-transaction נכשל בזמן commit (quota וכו'), ה-Promise כבר נפתר כהצלחה, אז הקורא חושב שהנתונים נשמרו כשלא.
- **תיקון:** לפתור על `tx.oncomplete` ולדחות על `tx.onabort`/`tx.onerror` בכתיבות.

### C2. אין טיפול ב-`onversionchange` / `onblocked`
- **שורות:** `initDB` ~L52–86 (`onsuccess`), ולבקשת ה-open אין `onblocked`
- **חומרה:** [Medium] · **קטגוריה:** Bug
- **תיאור:** אם טאב אחר פותח `DB_VERSION` חדש יותר, החיבור הזה לא נסגר (אין `db.onversionchange = () => db.close()`), אז שדרוג הטאב השני נחסם לנצח. ל-`indexedDB.open` גם אין `onblocked`, אז שדרוג חסום תקוע בשקט.
- **תיקון:** להוסיף `dbInstance.onversionchange = () => { dbInstance?.close(); dbInstance = null; }` ב-`onsuccess`, ולהוסיף `request.onblocked`.

### C3. טיפוס ההחזרה של `dbGet` מסתיר `undefined`
- **שורות:** ~L160–171
- **חומרה:** [Low] · **קטגוריה:** Code Quality (typing)
- **תיאור:** `dbGet<T>(...): Promise<T>` פותר `request.result as T`, אבל מפתח חסר נותן `undefined`. קוראים כמו `getWorkoutTemplate` עושים `res || null`, מה שמסתיר שהטיפוס שיקר.
- **תיקון:** לטפס כ-`Promise<T | undefined>` ולתת לקוראים לטפל במקרה החסר.

### C4. `dbOpenPromise` מיושן לא מתאפס בשגיאות חיבור מאוחרות
- **שורות:** ~L75–84
- **חומרה:** [Low] · **קטגוריה:** Bug
- **תיאור:** אחרי open מוצלח `dbOpenPromise` מתנקה, אבל אם החיבור נכשל/נסגר מאוחר יותר רק `dbInstance` מתאפס. כדאי לרכז את ניקוי החיבור (איפוס של שניהם) ב-handler אחד יחד עם C2.

---

## `src/services/dataService.ts`

### D1. Seeding סדרתי עם cloud sync לכל פריט
- **שורות:** `initializeBuiltInWorkoutTemplates` ~L40–66 (`for ... await createWorkoutTemplate`)
- **חומרה:** [Low] · **קטגוריה:** Performance
- **תיאור:** 5 ה-built-ins נוצרים אחד-אחד עם `await` בלולאה; כל `createWorkoutTemplate` גם מפעיל `syncWithRetry` נפרד.
- **תיקון:** לבנות את כל אובייקטי ה-template ולעשות `await Promise.all(...)`; לשקול bulk insert.

### D2. בדיקת ה-seed גזעית (double-seed)
- **שורות:** ~L48–53
- **חומרה:** [Low] · **קטגוריה:** Bug
- **תיאור:** שתי קריאות מקבילות (למשל שני מסכים שעולים) יכולות שתיהן לקרוא "אין built-ins" ושתיהן יזרעו, ויוצרות templates כפולים.
- **תיקון:** לשמור promise יחיד in-flight (memoize), או dedup לפי id יציב דרך `put`.

---

## `src/services/dataEvents.ts`

### E1. אירוע גלובלי לא מטופס וללא payload
- **שורות:** כל הקובץ (`WORKOUT_SAVED` כ-`Event` רגיל)
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** משתמש ב-`Event` רגיל עם מחרוזת קסם וללא detail, אז כל listener חייב למשוך הכל מחדש.
- **תיקון:** לשקול `CustomEvent` עם detail מטופס, או emitter קטן מטופס.

---

## `src/services/workoutDb.ts`

### W1. Barrel של `export *` מסתכן בהתנגשויות שמות שקטות
- **שורות:** L1–סוף (`export * from` שישה מודולים)
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** `export *` מהרבה מודולים גורם לכך ששם export כפול בין מודולים נפתר באופן עמום/שקט.
- **תיקון:** להעדיף re-exports מפורשים בשם, או להוסיף בדיקת build להתנגשויות.

---

## `src/services/sessionDb.ts`

### S1. `getWorkoutSession` בולע את כל השגיאות כ-`null`
- **שורות:** ~L36–54 (`catch { return null; }`)
- **חומרה:** [Medium] · **קטגוריה:** Bug (error swallowing)
- **תיאור:** כל כשל (DB פגום, abort) לא ניתן להבחנה מ"לא נמצא". הקוראים לא יכולים להבדיל שגיאה אמיתית מרשומה חסרה.
- **תיקון:** להחזיר `null` רק לרשומות שבאמת חסרות; לתת לשגיאות אמיתיות לעבור הלאה או ללוגג אותן.

### S2. `mergeWorkoutSessionsFromCloud` כותב סדרתית בלולאה
- **שורות:** ~L160–183 (`for (const cloud ...) await dbPut(...)`)
- **חומרה:** [Medium] · **קטגוריה:** Performance
- **תיאור:** כל רשומת ענן נכתבת ב-transaction נפרד שעוברים עליו await (N round-trips). להיסטוריה גדולה זה anti-pattern של N+1.
- **תיקון:** לאסוף רשומות ולכתוב ב-transaction יחיד (או `Promise.all` בתוך transaction אחד).

### S3. פתרון התנגשויות תלוי ב-`updatedAt` שעשוי לחסר
- **שורות:** ~L172–178
- **חומרה:** [Low] · **קטגוריה:** Bug
- **תיאור:** `cloudTime`/`localTime` נופלים ל-`''` → `NaN`. `NaN > NaN` הוא false, אז כשחותמות הזמן חסרות זה שומר את המקומי בשקט; בשילוב עם templates שלא מרעננים `updatedAt` (T1) זה הופך last-writer-wins ללא אמין.
- **תיקון:** לנרמל חותמות זמן חסרות ל-`0` ולוודא שכותבים תמיד מציבים `updatedAt`.

---

## `src/services/templateDb.ts`

### T1. `updateWorkoutTemplate` אף פעם לא מרענן `updatedAt`
- **שורות:** ~L66–80
- **חומרה:** [Medium] · **קטגוריה:** Bug
- **תיאור:** עדכונים עושים spread של `{ ...template, ...updates, id }` אבל לא מציבים `updatedAt`. `createWorkoutTemplate` גם מציב רק `createdAt`. אבל `mergeWorkoutTemplatesFromCloud` פותר התנגשויות לפי `updatedAt`. לכן templates שנערכו מקומית שומרים `updatedAt` ישן/חסר, ומיזוג ענן יכול לדרוס עריכות מקומיות חדשות בשקט.
- **תיקון:** להציב `updatedAt: new Date().toISOString()` בכל create ו-update.

### T2. חוזה id-חסר לא עקבי מול sessions
- **שורות:** `getWorkoutTemplate` ~L29 (`throw new ValidationError`)
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** `getWorkoutTemplate('')` זורק, אבל `getWorkoutSession('')` מחזיר `null`. אותה פעולה רעיונית, שני חוזים.
- **תיקון:** לתקנן את התנהגות "id חסר" בין ה-getters.

### T3. `loadWorkoutFromTemplate` משתמש מחדש ב-id של תרגילי ה-template
- **שורות:** ~L110–125 (`id: ex.id`)
- **חומרה:** [Low] · **קטגוריה:** Bug
- **תיאור:** התרגילים של האימון החדש משתמשים מחדש ב-id של תרגילי ה-template. טעינת אותו template פעמיים (או עריכת שני העותקים) נותנת id מתנגשים בין אימונים פעילים.
- **תיקון:** לייצר id חדשים לתרגילים שנוצרו.

---

## `src/services/exerciseDb.ts`

### X1. `removeDuplicateExercises` עושה await על `IDBRequest` גולמי (מחיקות לא מחכות)
- **שורות:** ~L226–233
- **חומרה:** [High] · **קטגוריה:** Bug
- **תיאור:** `Promise.all(remove.map((ex) => { const tx = ...; return store.delete(ex.id); }))`. `store.delete()` מחזיר `IDBRequest`, לא Promise. `Promise.all` על non-thenables נפתר **מיד** בלי לחכות שהמחיקות יעשו commit, ושגיאות לא נתפסות. כל מחיקה גם פותחת transaction חדש. `removedCount` מדווח כהצלחה גם אם מחיקה נכשלה.
- **תיקון:** לעטוף מחיקות ב-Promises שנפתרים על `onsuccess`/נדחים על `onerror` (או להשתמש ב-`dbDelete`), אידיאלית לבצע batch של כל המחיקות בקבוצה ל-transaction אחד.

### X2. ה-cascade של `deletePersonalExercise` עושה סריקה מלאה במקום שימוש באינדקס `exerciseId`
- **שורות:** ~L155–158 (`dbGetAll(PERSONAL_RECORDS).filter(...)`)
- **חומרה:** [Medium] · **קטגוריה:** Performance
- **תיאור:** ל-`PERSONAL_RECORDS` יש אינדקס `exerciseId` (נוצר ב-v3), אבל זה טוען את כל ה-PRs לזיכרון ומסנן ב-JS.
- **תיקון:** להשתמש ב-`dbGetByIndex(STORES.PERSONAL_RECORDS, 'exerciseId', id)` כדי למשוך רק את הרשומות התואמות.

### X3. מחיקת cascade לא אטומית
- **שורות:** ~L156–186
- **חומרה:** [Medium] · **קטגוריה:** Bug
- **תיאור:** מחיקות PR ומחיקת התרגיל רצות ב-transactions נפרדים. כשל בין שניהם משאיר או PRs יתומים או תרגיל מחוק עם PRs ישנים.
- **תיקון:** למחוק את התרגיל ואת ה-PRs שלו ב-transaction רב-store יחיד.

### X4. Re-seeding של built-ins מבוסס על שם התרגיל
- **שורות:** `getPersonalExercises` ~L23–40
- **חומרה:** [Medium] · **קטגוריה:** Bug
- **תיאור:** built-ins חסרים מזוהים לפי `name`. אם משתמש משנה שם של תרגיל built-in, השם המקורי "חסר" ונזרע מחדש, ויוצר כפילויות בטעינה הבאה. ה-seeding גם רץ ב**כל** קריאה (בונה `Set` ומסנן את רשימת ה-built-in כל פעם), לא רק בפעם הראשונה.
- **תיקון:** לזרוע לפי id/flag יציב של built-in ולשמור seeding מאחורי סמן "seeded" חד-פעמי.

### X5. `removeDuplicateExercises` נכנס שוב ל-seeding
- **שורות:** ~L205 (`await getPersonalExercises()`)
- **חומרה:** [Low] · **קטגוריה:** Bug
- **תיאור:** הוא קורא ל-`getPersonalExercises()`, שעלול לזרוע built-ins כתופעת לוואי, אז ה-dedup פועל על רשימה ששינה זה עתה.
- **תיקון:** לקרוא raw דרך `dbGetAll` עבור dedup, לא דרך getter שזורע.

---

## `src/services/personalItemsDb.ts`

### P1. תופעת לוואי של `initDB()` ברמת המודול עם unhandled rejection
- **שורות:** ~L6 (`initDB();`)
- **חומרה:** [Medium] · **קטגוריה:** Bug
- **תיאור:** קריאה ל-`initDB()` ב-module scope יורה promise לא-await; אם ה-open נכשל זה הופך ל-unhandled rejection, והקריאה מיותרת כי כל helper קורא `initDB()` בעצמו.
- **תיקון:** להסיר את הקריאה ברמת המודול.

### P2. `updatePersonalItem` עושה read-modify-write על כל ה-store
- **שורות:** ~L31–49
- **חומרה:** [Medium] · **קטגוריה:** Performance + Bug (lost update)
- **תיאור:** הוא טוען את **כל** הפריטים דרך `dbGetAll`, `findIndex`, ואז מחזיר אחד. זו קריאה לא חסומה לעדכון רשומה בודדת לפי מפתח, וה-read-then-write קורה בין transactions, אז עדכונים מקבילים יכולים לאבד נתונים.
- **תיקון:** להשתמש ב-`dbGet(STORES.PERSONAL_ITEMS, id)` ואז `dbPut`, אידיאלית בתוך transaction `readwrite` יחיד.

### P3. No-op שקט כשהפריט חסר
- **שורות:** ~L35–39 (`if (index === -1) return;`)
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** עדכון id לא קיים מצליח בשקט (`void`), ומסתיר באגים אצל הקוראים.
- **תיקון:** לזרוק `NotFoundError` (עקבי עם `updatePersonalExercise`/`updateWorkoutTemplate`).

---

## `src/services/bodyWeightDb.ts`

### B1. אין אינדקס `date` → סריקה מלאה + מיון JS
- **שורות:** `getBodyWeightHistory` ~L33–36, `getLatestBodyWeight` ~L41–44
- **חומרה:** [Low] · **קטגוריה:** Performance
- **תיאור:** ל-`BODY_WEIGHT` אין אינדקס `date` (בניגוד ל-`workout_sessions`/`recovery_logs`/`water_logs`), אז ההיסטוריה תמיד טוענת את כל השורות וממיינת ב-JS, ו"latest" ממיין את כל הסט רק כדי לקחת `[0]`.
- **תיקון:** להוסיף אינדקס `date` ב-upgrade של `indexedDBCore` ולקרוא latest דרך cursor הפוך.

### B2. אין ולידציה ב-`saveBodyWeight`
- **שורות:** ~L20–28
- **חומרה:** [Low] · **קטגוריה:** Bug (invariant לא עקבי)
- **תיאור:** `bodyStatsService.addBodyWeight` אוכף `0 < weight < 700`; הכותב הזה לאותו store לא אוכף כלום. (ראה A3.)
- **תיקון:** להחיל את אותה ולידציה כאן, או לנתב דרך כותב משותף אחד.

---

## `src/services/bodyStatsService.ts`

### Y1. חלונות "היום"/שבוע משתמשים בתאריך UTC, לא מקומי
- **שורות:** `getTodayRecoveryLog` ~L300 (`now.toISOString().split('T')[0]`), `getWeeklyRecoveryAverage` ~L430
- **חומרה:** [Medium] · **קטגוריה:** Bug (timezone)
- **תיאור:** `toISOString()` נותן את תאריך ה-**UTC**. למשתמשים ב-offset שלילי/חיובי ליד חצות, "היום" יכול להיפתר ליום הלא נכון, אז ה-log של היום לא נמצא או נספר פעמיים.
- **תיקון:** לחשב `YYYY-MM-DD` מקומי (דרך getFullYear/getMonth/getDate מקומיים) עקבי עם איך שה-`date` של הרשומות נכתב.

### Y2. הצהרות טיפוס כפולות שסוטות מ-`src/types`
- **שורות:** ~L9–95 (`BodyWeightEntry`, `BodyMeasurement`, `RecoveryLog`)
- **חומרה:** [Medium] · **קטגוריה:** Code Quality (DRY)
- **תיאור:** הצהרות מקומיות של טיפוסי דומיין שכבר קיימים ב-`src/types/index.ts`, מזמינות drift.
- **תיקון:** לייבא מ-`src/types`.

### Y3. ה-dedup של `addRecoveryLog` גזעי וסורק את כל הלוגים
- **שורות:** ~L250–290
- **חומרה:** [Medium] · **קטגוריה:** Bug + Performance
- **תיאור:** הוא טוען את **כל** לוגי ה-recovery (יש אינדקס `date` ל-`RECOVERY_LOGS` שלא בשימוש כאן), מסנן לפי תאריך, בוחר רשומה קנונית, כותב, ומוחק את השאר ב-transactions נפרדים. שתי קריאות מקבילות לאותו תאריך יכולות שתיהן לבחור "אין קנוני" וליצור כפילויות. הוא גם מעביר dummy `{ id: '', createdAt: '' }` ל-`calculateRecoveryScore`.
- **תיקון:** לשאול דרך אינדקס `date`, ולבצע את ה-upsert+dedup ב-transaction יחיד; לגרום ל-`calculateRecoveryScore` לקבל רק את השדות שהוא משתמש בהם.

### Y4. מחרוזות locale בשימוש כ-TypeScript union type
- **שורות:** `WeightTrend.direction: 'עלייה' | 'ירידה' | 'יציב'` ~L99
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** מחרוזות תצוגה בעברית מוטמעות בטיפוס, מצמידות את מודל הנתונים ל-locale של ה-UI וחוסמות i18n.
- **תיקון:** להשתמש ב-literals סמנטיים (`'up' | 'down' | 'stable'`) ולמפות לטקסט תצוגה בשכבת ה-UI.

### Y5. `getLatestWeight`/`getLatestMeasurement` ממיינים את כל ה-store לשורה אחת
- **שורות:** ~L165–170, ~L240–246
- **חומרה:** [Low] · **קטגוריה:** Performance
- **תיאור:** `dbGetAll` מלא + מיון כדי לקחת `[0]`; אין אינדקס `date` ל-`body_measurements`.
- **תיקון:** להוסיף אינדקס `date` ולהשתמש ב-cursor הפוך; אותו דפוס כמו B1.

---

## `src/services/offlineQueue.ts`

### O1. התור מעובד בסדר שרירותי (key), לא לפי timestamp
- **שורות:** `getAllMutations` ~L150 + לולאת `processQueue` ~L370
- **חומרה:** [Medium] · **קטגוריה:** Bug (ordering)
- **תיאור:** `store.getAll()` מחזיר רשומות לפי primary key (UUID אקראי), לא לפי סדר הכנסה. `create` ואז `delete`/`update` מאוחר יותר לאותה רשומה יכולים לשחק שוב מחוץ לסדר (delete לפני create). אינדקס `timestamp` קיים אבל לא בשימוש.
- **תיקון:** לקרוא mutations ממוינים לפי אינדקס `timestamp` לפני עיבוד.

### O2. Re-entrancy של `processQueue` מוגן רק לאירוע `online`
- **שורות:** guard של `isProcessing` ~L470 (רק ב-listener של online); הרצת startup ~L500
- **חומרה:** [Medium] · **קטגוריה:** Bug (race)
- **תיאור:** הרצת ה-startup ב-`initOfflineSync` ואירוע `online` מקביל יכולים שניהם לקרוא `processQueue` בו-זמנית, ושולחים mutations כפול.
- **תיקון:** להעביר את ה-guard של `isProcessing` לתוך `processQueue` עצמו.

### O3. ה-union של `MutationType` לא שלם/א-סימטרי
- **שורות:** ~L20–45
- **חומרה:** [Low] · **קטגוריה:** Code Quality
- **תיאור:** חלק מהישויות חושפות create/update/delete, אחרות רק create/delete, בלי סיבה מתועדת.
- **תיקון:** להפוך את הסט לעקבי או לתעד את ההשמטות המכוונות.

### O4. אין backoff בין retries; חסר `onversionchange`
- **שורות:** retry ~L420–445; `openQueueDB` ~L120–145
- **חומרה:** [Low] · **קטגוריה:** Code Quality / Bug
- **תיאור:** mutations שנכשלו נכתבים מחדש ומנוסים בטריגר הבא ללא delay/backoff. `openQueueDB` גם חסר `onversionchange`.
- **תיקון:** להוסיף metadata של backoff ו-handler של `onversionchange` — אבל אידיאלית לפתור קודם את A1 (המודול אולי יימחק).

---

## סיכום פריטים בעדיפות גבוהה
1. **A1** — תת-מערכת offline-queue מתה/כפולה (`offlineQueue.ts` לא נקרא אף פעם).
2. **A2** — פונקציות replace לא אטומיות מסתכנות באיבוד נתונים מקומי קבוע (5 מקומות).
3. **X1** — `removeDuplicateExercises` עושה await על `IDBRequest` גולמי, אז מחיקות לא באמת מחכות/מאומתות.
4. **C1 / C2** — כתיבות resolve לפני commit; אין טיפול ב-`onversionchange`/`onblocked`.
5. **T1 / S3** — פתרון התנגשויות מסתמך על `updatedAt` שמסלולי העדכון לא מציבים.
6. **Y1** — באג UTC-מול-מקומי בחלונות "היום"/שבועי של recovery.
