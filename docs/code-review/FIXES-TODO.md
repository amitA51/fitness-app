# SparkOS Fitness — Production Readiness Fix Plan

> מסמך תיקונים מפורט ומסודר. כל פריט כתוב כך שסוכן בינה מלאכותית (או מפתח) יוכל לבצע אותו ישירות: מיקום מדויק, מה הבעיה, מה לעשות, ואיך לוודא.
>
> נכתב בעקבות סקירת קוד מול הקוד החי בתאריך 29.5.2026. חלק מהממצאים בדוחות הישנים (`01`–`08`) כבר תוקנו — המסמך הזה משקף את המצב **הנוכחי** בלבד.

## איך להשתמש במסמך

- העבודה מחולקת ל-3 רמות עדיפות: **P0 (חוסם פרודקשן)**, **P1 (לפני שחרור)**, **P2 (חוב טכני / ליטוש)**.
- לכל משימה יש: `מזהה`, `קבצים`, `חומרה`, `הבעיה`, `התיקון` (צעד-אחר-צעד), ו-`הגדרת סיום` (Definition of Done).
- אחרי כל שינוי קוד הריצו: `npm run verify` (typecheck + lint + format) ו-`npm run test:run`.
- אל תשנו מספר משימות במקביל אם הן נוגעות באותו קובץ — בצעו לפי הסדר.

## טבלת מעקב

| מזהה | תחום | עדיפות | סטטוס |
|------|------|:------:|:-----:|
| P0-1 | קונסולידציית תור סנכרון אופליין | P0 | [ ] |
| P0-2 | Last-write-wins דורס עריכות (טריגר DB) | P0 | [ ] |
| P0-3 | הסרת תלות `ecc-universal` (supply-chain) | P0 | [ ] |
| P0-4 | סוויטת בדיקות לא דטרמיניסטית + אימוג'י | P0 | [ ] |
| P1-1 | תאריכים UTC מול מקומי | P1 | [ ] |
| P1-2 | web-vitals no-op בפרודקשן | P1 | [ ] |
| P1-3 | וירטואליזציה ל-WorkoutHistoryList | P1 | [ ] |
| P1-4 | Focus trap + Escape ל-sheets בעמוד התקדמות | P1 | [ ] |
| P1-5 | reduced-motion לאנימציות framer-motion | P1 | [ ] |
| P1-6 | ניגודיות צבעים (contrast) | P1 | [ ] |
| P1-7 | כיסוי בדיקות לנתיבים קריטיים | P1 | [ ] |
| P2-1 | טקסונומיית שרירים אחת | P2 | [ ] |
| P2-2 | מנוע PR אחיד | P2 | [ ] |
| P2-3 | סקאלת z-index אחת | P2 | [ ] |
| P2-4 | `handleError` כפול | P2 | [ ] |
| P2-5 | SlideToComplete מול SwipeComplete | P2 | [ ] |
| P2-6 | dual-flag של "סט הושלם" | P2 | [ ] |
| P2-7 | מגבלות אימון כפולות | P2 | [ ] |
| P2-8 | מחיקת cascade לא אטומית | P2 | [ ] |
| P2-9 | אזהרות lint (useExhaustiveDependencies) | P2 | [ ] |
| P2-10 | טעינת טבלאות מלאה בסנכרון | P2 | [ ] |

---

# P0 — חוסמי פרודקשן (חובה לפני שחרור)

## P0-1 — קונסולידציית תור הסנכרון לאופליין

- **חומרה:** Critical (איבוד נתונים / סנכרון לא אמין)
- **קבצים:**
  - `src/services/offlineQueue.ts` (תור A — DB נפרד `SparkOS_Queue`, store `mutation_queue`)
  - `src/services/syncEngine.ts` (תור B — store `pending_sync` בתוך `sparkos-fitness-db`)
  - `src/services/indexedDBCore.ts` (re-export של `syncWithRetry` / `syncPendingToServer`)
  - `src/App.tsx` (קורא ל-`initOfflineSync()`)
  - כל מסלולי הכתיבה: `templateDb.ts`, `sessionDb.ts`, `exerciseDb.ts`, `bodyWeightDb.ts`, `bodyStatsService.ts`, `nutritionService.ts`, `waterService.ts`, `prService.ts`

- **הבעיה (מאומת בקוד):**
  קיימות שתי מערכות תור-אופליין מקבילות שאף אחת לא עובדת מקצה-לקצה:
  1. **תור B (`syncEngine.ts`)** — כל כתיבה עוברת דרך `syncWithRetry(...)`. בכשל סופי נשמר entry ב-`pending_sync`. אבל: (א) קריאות הכתיבה לא מעבירות `payload` מלא, ו-(ב) חיפוש בקוד מראה ש-`syncPendingToServer(...)` **לא נקרא מאף מקום באפליקציה** → ה-entries לעולם לא מנוגנים מחדש.
  2. **תור A (`offlineQueue.ts`)** — מימוש טוב יותר (`queueMutation` עם dedup, סיווג שגיאות retriable/permanent, ניקוז ב-`online` ובהפעלה דרך `initOfflineSync`), אבל `queueMutation(...)` **לא נקרא מאף מקום** → התור תמיד ריק.
  
  התוצאה: כתיבות אופליין שנכשלו נשארות ב-IDB המקומי (לא נמחקות) אבל ניתנות לשחזור רק דרך "סנכרון ידני" בהגדרות. ~500 שורות קוד מתות.

- **התיקון (לבחור אסטרטגיה אחת — מומלץ לאמץ את תור A ולמחוק את B):**
  1. הגדירו את `MutationType` ב-`offlineQueue.ts` כך שיכסה את כל סוגי הכתיבות (template/session/exercise/bodyWeight/measurement/recovery/nutrition/water/pr/setting).
  2. בכל פונקציית כתיבה בשירותים, אחרי הכתיבה המקומית המוצלחת ל-IDB, נסו push לענן; **בכשל** קראו ל-`queueMutation(type, payload)` במקום ל-`syncWithRetry`. ה-`payload` חייב להכיל `{ table, record }` (snapshot מלא של הרשומה) כדי שאפשר יהיה לנגן מחדש כ-upsert.
  3. ודאו ש-`processQueueInternal()` ב-`offlineQueue.ts` יודע למפות כל `MutationType` לקריאת ה-upsert הנכונה ב-`supabaseSync.ts`.
  4. מחקו את `pending_sync` ואת `queuePendingSync`/`syncWithRetry`/`syncPendingToServer` מ-`syncEngine.ts`, והסירו את ה-re-export ב-`indexedDBCore.ts`. עדכנו את כל ה-import sites.
  5. השאירו את `initOfflineSync()` ב-`App.tsx` (כבר מחובר נכון ל-startup ול-`online`).
  6. אם בוחרים את האסטרטגיה ההפוכה (לשמר את B) — יש להעביר `payload` בכל call site **וגם** לחבר את `syncPendingToServer` ל-listener של `online`/startup. פחות מומלץ כי B נחות ב-dedup וסיווג שגיאות.

- **הגדרת סיום:**
  - `grep` ל-`queueMutation(` מראה שימוש מכל מסלולי הכתיבה; `grep` ל-`syncPendingToServer`/`queuePendingSync` לא מחזיר שימושים (אם בוחרים אסטרטגיה A).
  - בדיקה ידנית: לנתק רשת, לבצע כמה כתיבות, לחזור online → כל הכתיבות מסתנכרנות אוטומטית.
  - בדיקת יחידה חדשה ל-dedup + retry של התור (ראו P1-7).

---

## P0-2 — Last-write-wins דורס עריכות בין מכשירים

- **חומרה:** Critical (איבוד עריכות בסנכרון מרובה-מכשירים)
- **קבצים:**
  - `supabase/schema.sql` (פונקציה `update_updated_at_column()` + טריגרים `BEFORE UPDATE`)
  - `supabase/migrations/20260528000000_add_workout_sessions_updated_at.sql`
  - `supabase/migrations/20260529000000_coach_platform.sql`
  - `src/services/supabaseSync.ts` (שולח `updated_at` ב-upsert)
  - `src/services/cloudMerge.ts` (השוואת timestamps)

- **הבעיה (מאומת בקוד):**
  כל הטבלאות המסונכרנות יש להן טריגר `BEFORE UPDATE ... EXECUTE FUNCTION update_updated_at_column()` שמכריח `NEW.updated_at = NOW()`. לכן כל upsert-כ-update דורס את `updated_at` בענן לזמן-שרת-עכשיו, ללא קשר לזמן העריכה האמיתי. תרחיש כשל: מכשיר A מבצע עריכה חדשה ב-10:00 ודוחף; מכשיר B (עם נתון ישן) דוחף ב-10:05 → הענן מקבל `updated_at=10:05` והעריכה החדשה של A נמחקת. אין version / content-hash / optimistic concurrency.

- **התיקון:**
  1. צרו migration חדש (למשל `supabase/migrations/20260530000000_honor_client_updated_at.sql`) שמסיר/מתקן את התנהגות הטריגר עבור הטבלאות המסונכרנות, כך שערך `updated_at` שמגיע מהלקוח יישמר. אופציות:
     - **אופציה א' (מומלץ):** לשנות את `update_updated_at_column()` כך שתדרוס רק אם `NEW.updated_at IS NULL` או לא השתנה (`NEW.updated_at = COALESCE(NEW.updated_at, NOW())` עם בדיקה ש-`NEW.updated_at >= OLD.updated_at`). אם הלקוח שלח `updated_at` תקין — לכבד אותו.
     - **אופציה ב':** להוסיף guard של optimistic concurrency — לעדכן רק אם `incoming.updated_at > existing.updated_at` (לדחות upsert ישן). אפשר לממש כ-`WHERE` ב-upsert או כ-trigger שמבטל update ישן.
  2. ודאו ש-`supabaseSync.ts` תמיד שולח `updated_at` אמיתי (לא `new Date().toISOString()` כ-fallback שמאפס). היום: `updated_at: session.updatedAt || session.startTime || new Date().toISOString()` — תקין כל עוד `updatedAt` מאוכלס.
  3. ב-`cloudMerge.ts`: עבור טיפוסים שיש להם רק `createdAt` (ראו P2 — PersonalRecord/BodyMeasurement/RecoveryLog/NutritionLog), ההשוואה `cloudTime > localTime` תמיד שווה → עריכות לא מתפשטות. הוסיפו `updatedAt` לטיפוסים האלה, או fallback ל-content-equality כשהזמנים שווים.

- **אזהרת בטיחות:** זהו שינוי schema על מסד נתונים חי. הריצו תחילה על branch של Supabase (לא על פרודקשן), בדקו עם נתוני בדיקה, וגבו לפני merge. השינוי הפיך אבל משפיע על כל הכתיבות.

- **הגדרת סיום:**
  - migration רץ נקי על branch.
  - תרחיש דו-מכשירי: עריכה במכשיר A → סנכרון; עריכה ישנה ממכשיר B → לא דורסת את A.
  - בדיקת `mcp_supabase_get_advisors` (security + performance) נקייה אחרי השינוי.

---

## P0-3 — הסרת תלות `ecc-universal` (supply-chain red flag)

- **חומרה:** High (סיכון שרשרת אספקה)
- **קבצים:** `package.json`, `package-lock.json`

- **הבעיה (מאומת):**
  `ecc-universal@1.10.0` נמצא ב-dependencies אך **לא מיובא משום מקום** ב-`src`. בעל `"hasInstallScript": true` (מריץ קוד ב-`npm install`), עם bins `ecc`/`ecc-install` ותלות ב-`sql.js`. דפוס קלאסי של typosquat / חבילה זדונית.

- **התיקון:**
  1. ודאו שאין שימוש: `grep -r "ecc-universal" src` (צריך להחזיר ריק).
  2. הסירו: `npm uninstall ecc-universal`.
  3. מחקו את הערך מ-`package-lock.json` (יתעדכן אוטומטית) והריצו `npm install` נקי.
  4. שקלו `npm ci --ignore-scripts` ב-CI.
  5. בדקו גם את `impeccable@2.3.1` ב-dependencies — אם אינו בשימוש ב-`src` (grep), הסירו גם אותו. (`impeccable` הוא סקיל עיצוב, לא תלות runtime — לא אמור להיות ב-`dependencies`.)

- **הגדרת סיום:**
  - `ecc-universal` (ואם רלוונטי `impeccable`) הוסר מ-`package.json` ו-`package-lock.json`.
  - `npm run build` ו-`npm run test:run` עוברים.
  - `npm audit` לא מצביע על החבילה.

---

## P0-4 — סוויטת בדיקות לא דטרמיניסטית + אימוג'י ב-JoinPage

- **חומרה:** High (CI לא אמין כשער שחרור)
- **קבצים:**
  - `src/pages/JoinPage.tsx` (שורה ~89 — `הוזמנת להתחבר למאמן 💪`)
  - `src/test/no-emoji.test.ts` (לוגיקת גילוי קבצים)

- **הבעיה (מאומת):**
  הרצת `npm run test:run` חוזרת על עצמה מחזירה תוצאות שונות (16 מול 17 קבצים, pass מול fail). `no-emoji.test.ts` נכשל לסירוגין על אימוג'י אמיתי `💪` ב-`JoinPage.tsx`. הקוד אוסר אימוג'י ב-`src` (ראו `CODING_STANDARDS.md`), אז הבדיקה צודקת — אבל היא צריכה להיכשל **בעקביות**, לא לסירוגין.

- **התיקון:**
  1. **תקנו את הסיבה האמיתית:** הסירו את האימוג'י `💪` מ-`JoinPage.tsx` (השאירו את הטקסט "הוזמנת להתחבר למאמן" בלבד, או החליפו באייקון מ-`lucide-react` כמו `Dumbbell`). ודאו שאין אימוג'ים נוספים בקובץ.
  2. **תקנו את אי-הדטרמיניזם** ב-`no-emoji.test.ts`: לוגיקת ה-`walk` משתמשת ב-`readdirSync` בלי מיון, ומסתמכת על סדר מערכת הקבצים. מיינו את התוצאות (`readdirSync(dir).sort()`) כדי שגילוי הקבצים יהיה דטרמיניסטי.
  3. הריצו את הסוויטה 3 פעמים ברצף לוודא תוצאה זהה.

- **הגדרת סיום:**
  - `npm run test:run` עובר ירוק 3 פעמים ברצף עם אותו מספר קבצים ובדיקות.
  - `grep` לאימוג'ים ב-`src/pages/JoinPage.tsx` מחזיר ריק.

---

# P1 — לתיקון לפני שחרור (חשוב, לא חוסם)

## P1-1 — טיפול עקבי בתאריכים (UTC מול מקומי)

- **חומרה:** High (off-by-one-day למשתמשים ב-UTC+, כמו ישראל, ליד חצות)
- **קבצים ושורות מדויקות (מאומת ב-grep):**
  - `src/services/analyticsService.ts:168` — `cutoff.toISOString().slice(0, 10)` (`filterByWeeks`)
  - `src/services/analyticsService.ts:368-369` — `startDate`/`endDate` עם `toISOString().slice(0,10)` (`getProgressData`)
  - `src/services/analyticsService.ts:763` — `new Date().toISOString().split('T')[0]` (`getMuscleGroupDaysSince`)
  - `src/services/analyticsService.ts:780-781` — `thisWeekStartStr`/`lastWeekStartStr` (`getWeekOverWeekProgress`)
  - `src/services/nutritionService.ts:802` — `date.toISOString().split('T')[0]`

- **הבעיה:**
  הרשומות נשמרות עם מפתח תאריך **מקומי** דרך `dateUtils.todayStr()`, אבל הסינונים לעיל ממירים ל-**UTC** (`toISOString`). בישראל (UTC+2/+3) ליד חצות זה גורם לסינון על יום שגוי — שבועות וחתכים זזים מול הנתונים השמורים.

- **התיקון:**
  1. בדקו את `src/utils/dateUtils.ts` — יש שם `todayStr()` ופונקציות עזר מקומיות. אם אין פונקציה שממירה `Date` → `YYYY-MM-DD` מקומי, הוסיפו אחת (למשל `toLocalDateStr(date: Date): string`).
  2. החליפו כל `X.toISOString().slice(0,10)` ו-`X.toISOString().split('T')[0]` ב-`toLocalDateStr(X)` בקבצים ובשורות לעיל.
  3. שימו לב: `supabaseSyncMappers.ts:223` משתמש ב-`startTime.slice(0,10)` — זה חיתוך מחרוזת ISO קיימת (לא המרת timezone), פחות קריטי, אבל עדיף לעבור דרך helper אחיד.
  4. אל תיגעו ב-`createdAt: new Date().toISOString()` — אלה timestamps מלאים (לא מפתחות-יום) ותקינים כ-UTC.

- **הגדרת סיום:**
  - בדיקת יחידה ל-`toLocalDateStr` עם זמן 23:30 מקומי שמחזיר את היום המקומי הנכון (לא UTC).
  - `grep` ל-`toISOString().slice` / `toISOString().split` ב-`analyticsService.ts` ו-`nutritionService.ts` מחזיר ריק.

---

## P1-2 — web-vitals הוא no-op בפרודקשן

- **חומרה:** High (אין RUM אמיתי בפרודקשן)
- **קבצים:** `src/services/webVitals.ts`

- **הבעיה (מאומת):**
  `logMetric` שולח רק ל-`console.log` בתוך `if (import.meta.env.DEV)`. בפרודקשן ה-handler לא עושה כלום. web-vitals "מחובר" אבל המדדים לא נשלחים לשום מקום.

- **התיקון:**
  1. ב-`initWebVitals`, בפרודקשן שלחו את המדדים ל-Sentry (כבר מותקן `@sentry/react`). לדוגמה: `Sentry.captureMessage` עם `level: 'info'` ו-`extra: { value, rating }`, או טוב יותר — Sentry measurements / custom span.
  2. השאירו את ה-`console.log` הצבעוני ב-DEV בלבד.
  3. הזיזו את חישוב ה-`color` לתוך ה-guard של DEV (כרגע מחושב תמיד — עבודה מתה זניחה).

- **הגדרת סיום:**
  - בבילד פרודקשן, מדדי web-vitals מופיעים ב-Sentry.
  - הבדיקה הקיימת `src/test/webVitals.test.ts` עדיין עוברת (עדכנו אותה אם חתימת ה-handler משתנה).

---

## P1-3 — וירטואליזציה ל-WorkoutHistoryList

- **חומרה:** High (ביצועים עם היסטוריה ארוכה)
- **קבצים:** `src/pages/progress/components/WorkoutHistoryList.tsx`

- **הבעיה (מאומת):**
  הקומפוננטה מרנדרת את **כל** הסשנים דרך `sessions.map(...)`, כל אחד `motion.div` עם `layout`. אין וירטואליזציה (בניגוד ל-`ExerciseList` שמווירטואל מ-15+ פריטים). DOM כבד + עלות layout-animation עם היסטוריה גדולה.

- **התיקון:**
  1. עטפו את הרשימה ב-`@tanstack/react-virtual` (כבר תלות בפרויקט) — חקו את הדפוס מ-`ExerciseList`.
  2. שימו לב ש-`motion.div` עם `layout` יקר בתוך רשימה מווירטואלת — שקלו להסיר את `layout` מהפריטים, או להפעיל וירטואליזציה רק מעל סף (למשל 20+ סשנים) ולשמור על האנימציה ברשימות קצרות.
  3. שמרו על ה-expand/collapse הקיים (`expandedId`) — ודאו שהוא עובד עם הווירטואליזציה (גובה דינמי דורש `measureElement`).

- **הגדרת סיום:**
  - עם 200+ סשנים, רק הפריטים הנראים ב-DOM.
  - גלילה חלקה, expand/collapse עובד.

---

## P1-4 — Focus trap + Escape ל-sheets בעמוד ההתקדמות

- **חומרה:** High (נגישות — מקלדת לכודה / אין סגירה ב-Escape)
- **קבצים:**
  - `src/pages/progress/modals/AddWeightModal.tsx`
  - `src/pages/progress/modals/AddRecoveryModal.tsx` (או שם דומה)
  - `src/pages/progress/modals/AddMeasurementModal.tsx` (או שם דומה)

- **הבעיה (מאומת):**
  ל-sheets האלה יש `role`/`aria-modal` אבל הם `motion.div` חשופים — **ללא focus trap וללא סגירה ב-Escape**. משתמש מקלדת נתקע, ו-Escape לא סוגר.

- **התיקון:**
  1. נתבו את שלושת ה-modals דרך הקומפוננטה הקנונית `src/components/ui/ModalOverlay` (שכבר מספקת `role="dialog"` + focus trap + Escape).
  2. אם המבנה הוויזואלי שונה (bottom sheet), עטפו את התוכן ב-`ModalOverlay` ושמרו על העיצוב דרך props/children.
  3. ודאו שכל modal מעביר `ariaLabel` (ראו P1-6 / הערה על `aria-labelledby`).

- **הגדרת סיום:**
  - Tab לא יוצא מה-modal (focus trap).
  - Escape סוגר את ה-modal.
  - בדיקה עם מקלדת בלבד עוברת.

---

## P1-5 — reduced-motion לאנימציות framer-motion

- **חומרה:** Medium (נגישות — תנועה שמתעלמת מהעדפת המשתמש)
- **קבצים:**
  - `src/components/ui/LoadingSpinner.tsx`
  - `src/styles/global.css` (יש `@media (prefers-reduced-motion)` שמנטרל רק CSS, לא JS)
  - `src/hooks/useReducedMotion.ts` (קיים)

- **הבעיה (מאומת):**
  `LoadingSpinner` משתמש בלולאות `rotate` אינסופיות של framer-motion. ה-`@media (prefers-reduced-motion)` הגלובלי מנטרל רק אנימציות CSS — לא אנימציות מונעות-JS של framer.

- **התיקון:**
  1. ב-`LoadingSpinner` קראו ל-`useReducedMotion()` והפכו את לולאת ה-`rotate` למצב סטטי (או מעבר עדין יחיד) כשהמשתמש מבקש פחות תנועה.
  2. סרקו קומפוננטות נוספות עם `animate`/`repeat: Infinity` של framer (`grep` ל-`repeat: Infinity`) והחילו את אותו דפוס.

- **הגדרת סיום:**
  - עם `prefers-reduced-motion: reduce` במערכת, אין לולאות סיבוב אינסופיות.

---

## P1-6 — ניגודיות צבעים (WCAG AA)

- **חומרה:** Medium (נגישות — contrast מתחת לסף)
- **קבצים:**
  - `src/styles/tokens.css` (`--fs-muted`, `--fs-accent`, `--fs-bg`)
  - `src/components/workout/overlays/PlateCalculatorOverlay.tsx`

- **הבעיה (מאומת):**
  - `--fs-muted` (#60706f) על `--fs-bg` (#eef3f1) ≈ 4.5:1 — גבולי בטקסט mono קטן.
  - טקסט לבן על `--fs-accent` (#43c7a5) ≈ 2:1 — **נכשל ב-AA**.

- **התיקון:**
  1. הכהו מעט את `--fs-muted` כדי לעבור 4.5:1 בנוחות בכל הגדלים.
  2. לטקסט על רקע accent: השתמשו ב-token כהה (למשל `--color-ink-on-accent`) במקום לבן, או הכהו את ה-accent עצמו לטקסט.
  3. ודאו עם בודק contrast (למשל DevTools / axe) שכל זוגות הצבע עוברים AA (4.5:1 לטקסט רגיל, 3:1 לטקסט גדול).

- **הגדרת סיום:**
  - כל זוגות הטקסט/רקע המרכזיים עוברים WCAG AA.
  - הערה: `@axe-core/react` כבר מותקן — אפשר להריץ בדיקת axe ב-DEV.

> הערה: ולידציית WCAG מלאה דורשת בדיקה ידנית עם טכנולוגיות מסייעות וסקירת מומחה נגישות. הבדיקות לעיל מכסות את החלק הניתן לאוטומציה.

---

## P1-7 — כיסוי בדיקות לנתיבים קריטיים

- **חומרה:** High (כיסוי ~6.6%, הליבה לא מכוסה)
- **קבצים:**
  - `src/components/workout/core/workoutReducer.ts` (אין בדיקה)
  - `src/utils/dateUtils.ts` (אין בדיקה — ראו P1-1)
  - `src/services/offlineQueue.ts` (אין בדיקה — ראו P0-1)
  - `src/services/cloudMerge.ts` / `syncEngine.ts` (כיסוי דל)
  - `vitest.config.ts` (thresholds נמוכים מאוד)

- **הבעיה (מאומת):**
  כיסוי שורות ~6.6%. הנתיבים הקריטיים ביותר (reducer של האימון, תאריכים, תור אופליין, merge ענן) ללא בדיקות. `vitest.config.ts` מגדיר thresholds: `statements: 6, lines: 6, functions: 18, branches: 40` עם הערה שזה "regression floor" והיעד הוא 80%.

- **התיקון (לפי סדר עדיפות):**
  1. **workoutReducer** — בדקו כל action (COMPLETE_SET/UNDO/ADD_SET/REORDER/...), כולל ש-`completedAt` ו-`isCompleted` נשארים מסונכרנים (ראו P2-6).
  2. **dateUtils** — בדקו `todayStr`/`toLocalDateStr` בגבולות (23:30, 00:30) מול timezone מקומי.
  3. **offlineQueue** — בדקו dedup, סיווג retriable מול permanent, וניקוז ב-`processQueue`.
  4. **cloudMerge** — בדקו last-write-wins, מקרי tie של timestamp, ורשומות `createdAt`-only.
  5. העלו את ה-thresholds ב-`vitest.config.ts` בהדרגה (ratchet up) ככל שמוסיפים בדיקות. אל תורידו.

- **הגדרת סיום:**
  - כיסוי שורות עולה משמעותית (יעד ביניים ריאלי: 30%+, ארוך טווח: 80%).
  - הנתיבים הקריטיים לעיל מכוסים בבדיקות משמעותיות.
  - `npm run test:coverage` עובר עם thresholds מעודכנים.

---

# P2 — חוב טכני וליטוש (אחרי שחרור / כשמתפנים)

> אלה בעיות "מקור אמת כפול" וניקיון. לא חוסמות, אבל מצטברות לחוב שמסכן פיצ'רים עתידיים. עדיף לטפל לפני הוספת פיצ'רים גדולים.

## P2-1 — טקסונומיית שרירים אחת
- **חומרה:** Medium · **קבצים:** `src/constants/workoutConstants.ts` (`MUSCLE_GROUPS` עם `'Arms'`), `src/data/builtInExercises.ts` / `builtInWorkoutTemplates.ts` (`'Biceps'`/`'Triceps'`/`'Core'`/`'Cardio'`).
- **הבעיה:** `analyticsService.getMuscleKey()` מקבץ לפי המחרוזת הגולמית → דליים של איזון/חלוקת שרירים מתפצלים.
- **התיקון:** הגדירו enum קנוני אחד לשרירים; מפו את כל קבצי הדאטה אליו; השתמשו בו ב-`getMuscleKey`.
- **סיום:** מקור אחד ל-muscle groups; אנליטיקת שרירים לא מפצלת דליים.

## P2-2 — מנוע PR אחיד
- **חומרה:** Medium · **קבצים:** `src/services/prService.ts`.
- **הבעיה:** `diffSetAgainstPRs` (real-time, דרך `checkForNewPR`) עוקב אחרי weight + volume + **reps**, אבל `calculatePRsFromHistory` (rebuild, דרך `rebuildPRsFromHistory`) עוקב רק אחרי weight + volume. שחזור מהיסטוריה מאבד reps-PR בשקט; אף אחד לא שומר type `'1rm'`.
- **התיקון:** הוציאו פונקציית diff אחת משותפת לשני המסלולים; הוסיפו `'1rm'` אם רוצים.
- **סיום:** real-time ו-rebuild מחזירים אותם PRs לאותם נתונים.

## P2-3 — סקאלת z-index אחת
- **חומרה:** Medium · **קבצים:** `src/constants/zIndex.ts` (`modal:1100, toast:1400`), `tailwind.config.js` (`modal:90, toast:100` + סט `-legacy`).
- **הבעיה:** שני מקורות אמת ל-stacking → התנגשויות שכבות.
- **התיקון:** גזרו את סקאלת ה-Tailwind מ-`zIndex.ts` (או להפך). מקור אחד.
- **סיום:** ערך z-index אחד לכל שכבה לוגית.

## P2-4 — `handleError` כפול
- **חומרה:** Medium · **קבצים:** `src/utils/errorReporting.ts` מול `src/errors/index.ts`.
- **הבעיה:** אותו שם, חוזים שונים: אחד מחזיר `{userMessage, error}`, השני `void` → עמימות ב-import.
- **התיקון:** שנו שם לאחד (למשל `handleErrorWithMessage`); עדכנו את כל ה-import sites.
- **סיום:** אין שתי פונקציות `handleError` בעלות חוזים שונים.

## P2-5 — SlideToComplete מול SwipeComplete
- **חומרה:** Low-Medium · **קבצים:** `src/components/.../SlideToComplete.tsx`, `.../SwipeComplete.tsx`.
- **הבעיה:** שתי קומפוננטות slide/swipe-to-confirm כמעט זהות (threshold, haptics, RTL, keyboard fallback) → תחזוקה כפולה.
- **התיקון:** השאירו אחת, פרמטרו את הסטיילינג; הסירו את השנייה ועדכנו שימושים.
- **סיום:** קומפוננטת swipe-to-confirm אחת בלבד.

## P2-6 — dual-flag של "סט הושלם"
- **חומרה:** Medium (latent) · **קבצים:** `src/types/index.ts` (`WorkoutSet`), `workoutReducer.ts`, ~10 קומפוננטות.
- **הבעיה:** הבאג המקורי **תוקן** (`workoutReducer` מסמן גם `completedAt` וגם `isCompleted`, השמירה גוזרת `isCompleted: !!completedAt`). אבל הדואליות נשארה: חלק מהקומפוננטות מסננות לפי `completedAt` ואחרות לפי `isCompleted` → desync סמוי אם כותב עתידי יסמן רק אחד.
- **התיקון:** בחרו שדה קנוני אחד (מומלץ `completedAt`), גזרו את `isCompleted` ממנו (או הסירו אותו לגמרי), והאחידו את כל הסינונים.
- **סיום:** מקור אמת אחד ל"סט הושלם".

## P2-7 — מגבלות אימון כפולות
- **חומרה:** Low · **קבצים:** `src/utils/validation.ts` מול `src/constants/workoutConstants.ts`.
- **הבעיה:** רוב הערכים כבר תואמים (weight.max=1000, reps.max=100, sets.max=20), אבל עדיין שתי הצהרות נפרדות, ועדיין מחלוקת על `reps.min=0` מול `MIN_REPS=1`.
- **התיקון:** גזרו אחד מהשני; יישבו את `reps.min`.
- **סיום:** מקור אחד למגבלות; אין סתירות.

## P2-8 — מחיקת cascade לא אטומית
- **חומרה:** Low · **קבצים:** `src/services/exerciseDb.ts` (`deletePersonalExercise`).
- **הבעיה:** מוחק PRs ואז את התרגיל ב-transaction נפרד → כשל באמצע משאיר orphans / מחיקה חלקית. בנוסף `getPersonalExercises` זורע מחדש built-ins לפי `name` בכל קריאה.
- **התיקון:** transaction רב-store יחיד למחיקה; seeding מאחורי דגל חד-פעמי לפי id יציב.
- **סיום:** מחיקה אטומית; אין re-seed בכל קריאה.

## P2-9 — אזהרות lint (useExhaustiveDependencies)
- **חומרה:** Low · **קבצים:** 18 אזהרות, בעיקר `lint/correctness/useExhaustiveDependencies` — הכבדות ב-`ActiveWorkoutNew.tsx` (~7), `MuscleRadarChart.tsx` (×3), `RPEPicker.tsx`, `WarmupCooldownFlow.tsx` (×2), `RecoveryTab.tsx`, `StrengthTab.tsx`, `Progress.tsx`. בנוסף `biome-ignore` מת ב-`WorkoutAriaLive.tsx:124`.
- **הבעיה:** typecheck ו-lint **עוברים** (0 שגיאות), אבל 18 אזהרות — חלקן עלולות להסתיר באגי תלויות אמיתיים.
- **התיקון:** עברו אזהרה-אזהרה; הוסיפו תלויות חסרות או נמקו השמטה מכוונת ב-`biome-ignore` ברור; הסירו את ההשמטה המתה ב-`WorkoutAriaLive.tsx:124`.
- **סיום:** `npm run lint:check` עם 0 אזהרות (או רק השמטות מנומקות).

## P2-10 — טעינת טבלאות מלאה בסנכרון
- **חומרה:** Low-Medium · **קבצים:** `src/services/supabaseSync.ts`.
- **הבעיה:** כל ה-`fetch*` עם `.select('*')` ללא `.range()`/`limit`; `syncAllData` דוחף כל רשומה כ-upsert בודד ב-`Promise.allSettled` לא חסום → טעינת טבלאות שלמות לזיכרון + מאות בקשות מקבילות בהיסטוריה גדולה. ממותן רק בכך שהסנכרון ידני (הגדרות).
- **התיקון:** paginate ב-fetch; upsert מערכי (בקשה אחת לטבלה); הגבילו concurrency.
- **סיום:** סנכרון לא טוען טבלאות שלמות לזיכרון; מספר בקשות סביר.

---

# סיכום והמלצת ביצוע

**מצב נוכחי:** האפליקציה לא מוכנה לפרודקשן עם סנכרון מרובה-מכשירים, אבל קרובה. RLS, auth, ארכיטקטורה ו-UX חזקים. החולשות המרכזיות: סנכרון ענן, כיסוי בדיקות, ותלות חשודה אחת.

**סדר ביצוע מומלץ:**
1. **שבוע 1 — P0:** קונסולידציית תור (P0-1) → תיקון last-write-wins (P0-2) → הסרת `ecc-universal` (P0-3) → ייצוב סוויטת הבדיקות (P0-4). אחרי זה האפליקציה בטוחה למולטי-דיווייס.
2. **שבוע 2 — P1:** תאריכים (P1-1) → web-vitals (P1-2) → וירטואליזציה (P1-3) → נגישות modals + reduced-motion + contrast (P1-4/5/6) → בדיקות קריטיות (P1-7).
3. **לאחר שחרור — P2:** פירעון חוב "מקור אמת כפול" לפי קצב הצוות.

**בכל commit:** `npm run verify && npm run test:run`. שינויי DB (P0-2) — על Supabase branch בלבד, עם גיבוי, לפני merge לפרודקשן.

**ציון מוכנות נוכחי:** ~6.6/10 משוקלל. אחרי P0 — צפי ~8/10. אחרי P1 — צפי ~9/10 ומוכן לשחרור.
