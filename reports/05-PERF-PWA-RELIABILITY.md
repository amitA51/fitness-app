# דוח 05 — ביצועים, PWA, אמינות Offline/Sync ו־Observability

**סטטוס שחרור:** לא מומלץ לשחרר Sync רב־מכשירי/Offline ל־production לפני סגירת ה־P0. שמירת אימון מקומית טובה יחסית, אך ארבעה מסלולים יכולים לאבד, לשכתב או להחזיר נתוני ענן ללא אפשרות התאוששות מספקת.

**היקף ומתודולוגיה:** נבדק קוד production פעיל, תוצר build טרי, קונפיגורציות CI ובדיקות. לא נעשה שימוש בתוכניות או במסמכי Markdown ישנים תחת `plans/**`, `improvements/**`, `docs/**` או בשורש. לא נבדקו סביבת deployment, ערך `VITE_SENTRY_DSN` בפועל, או סטטוס יישום migrations ב־Supabase; לכן הדוח אינו טוען שהם קיימים או חסרים בפרודקשן.

## תקציר מנהלים

היישום כבר עושה כמה דברים חשובים נכון: מסלולים רבים נטענים ב־`React.lazy`, יש PWA עם `navigateFallback`, תור offline שומר סדר בעזרת `seq`, IndexedDB בגרסה ממוספרת, ושמירת אימון משלימה קודם כתיבה מקומית. הבנייה, בדיקת הטיפוסים ובדיקות Vitest עברו.

עם זאת, אמינות הענן אינה עומדת עדיין ברף production: `processQueue()` רץ בעת פתיחת האפליקציה גם ללא רשת, מעלה מונה retry ובמחזור החמישי מוחק mutation; full sync מבצע `upsert` עיוור של snapshot מקומי ישן; חלק מהמחיקות הן פיזיות ולכן מכשיר offline יכול להחזיר רשומה שנמחקה; וכשל בקריאת store מקומי מוחלף ב־`[]` ועדיין יכול להחזיר `success: true`. אלו אינם סיכוני UX תיאורטיים אלא מסלולי קוד ישירים עם תרחישי איבוד/שחיתת נתונים.

ה־PWA מתפקד כ־app shell offline, אך אין UX התקנה או טיפול iOS, ועדכון service worker יכול לטעון מחדש בזמן אימון פעיל. מבנית, `bbtProgram.generated` הוא chunk של `217.98 kB` שנשלף גם במצבים שאינם שימוש בתוכנית, וה־precache הרחב כולל את כל קובצי ה־JS. קיימות אופטימיזציות טובות ברשימת היסטוריית האימונים, אבל ספריית התרגילים עדיין מרנדרת את כל הרשומות.

בצד התפעולי, Sentry תלוי גם בהסכמה וגם ב־DSN שלא ניתן לאמת מהמקור, Web Vitals נכתבים רק כ־breadcrumbs, ואנליטיקת המוצר נשארת ב־`localStorage`. לכן אין מדידה אמינה של funnel, המרות או כשלי sync בקנה־מידה. ה־CI איכותי עבור type/lint/unit/build, אך לא מריץ Playwright; שלושת מסעות ה־E2E העסקיים המרכזיים מסומנים `test.fixme`.

**ספירה:** 4 ממצאי P0, 10 ממצאי P1 ו־5 ממצאי P2.

## מדידות

### פקודות ואימות שבוצעו

| פעולה | תוצאה | משמעות |
|---|---|---|
| `npm run build` | עבר ב־`9.93s`; ‏`3024 modules transformed` | build production עדכני הצליח, אך Vite התריע על chunks מעל `200 kB` ועל `dynamic import()` שאינו מפצל modules שכבר מיובאים סטטית. |
| PWA build | `vite-plugin-pwa 0.17.5`, מצב `generateSW`, ‏`137` entries ו־`2481.79 KiB` ב־precache | ה־service worker נוצר (`dist/sw.js`, `dist/workbox-835c8c05.js`), אך offline install קר עשוי לשמור נפח משמעותי. |
| `npx tsc --noEmit` | עבר | מקור TypeScript עבר בדיקת טיפוסים. |
| `npm run test:run` | עבר: `128` קובצי בדיקה, `1,149` בדיקות, `18.69s` | כיסוי unit/integration קיים, אך אינו הוכחה למסלולי E2E/רב־מכשיר. |

לא הורצו `npm run test:coverage` או `npm run test:e2e`: ה־scope המותר של audit זה הוגבל לפקודות המפורטות לעיל. הרצת `test:run` לא מפעילה Playwright לפי `vitest.config.ts:18-19`.

### טבלת bundle אמיתית

הגדלים להלן הם פלט Vite של ה־build הטרי, אחרי minify ולפני דחיסת העברה ברשת. הם אינם אומדן Lighthouse או gzip.

| chunk / asset | גודל build | מסקנה |
|---|---:|---|
| `index-oQsKCm8v.js` | 226.90 kB | מעל סף האזהרה של Vite. |
| `bbtProgram.generated-CGCVwtou.js` | 217.98 kB | נתוני התוכנית הם payload ראשון במעלה שיש לפצל לפי שימוש. |
| `react-vendor-KjTFmhab.js` | 211.48 kB | vendor bundle גדול, מעל הסף. |
| `supabase-CrcKudes.js` | 209.97 kB | vendor bundle גדול, מעל הסף. |
| `ActiveWorkoutNew-I03B01d9.js` | 180.68 kB | מסלול האימון כבד גם לפני תלות נתוני התוכנית. |
| `framer-CAf99Exl.js` | 139.13 kB | עלות motion נפרדת ומדידה. |
| `index-CG7Bn4iv.css` | 106.54 kB | CSS ראשי משמעותי. |
| `Progress-gOaMk-ql.js` | 100.80 kB | מסלול Progress כבד יחסית. |
| `gsap-BFNVykWo.js` | 72.25 kB | vendor נוסף. |
| `Nutrition-C52VIckt.js` | 70.28 kB | מסלול Nutrition. |
| `Dashboard-2me3jYtQ.js` | 50.35 kB | מסלול Dashboard עצמו מפוצל. |
| `builtInExercises-CYImzAge.js` | 25.57 kB | טעינה עצלה טובה יותר של catalog התרגילים. |
| `tanstack-DFYXNanq.js` | 23.61 kB | תלות הווירטואליזציה קטנה יחסית. |

קונפיגורציית הבנייה מכוונת אזהרה ב־`200 kB` ומנטרלת source maps (`vite.config.ts:180-182`). ה־`manualChunks` הקיים נמצא ב־`vite.config.ts:138` ומתמקד ב־vendors; אין פיצול first-party ייעודי לנתוני תוכנית או לדומיין sync.

### נתונים ותצוגה: ממצאים שאינם בעיית אמינות בפני עצמם

מודולים ארוכים אינם הוכחה לבאג ריצה, אך הם מגדילים את מחיר שינוי והסיכוי ל־render חם בלתי נשלט: `src/pages/Dashboard.tsx:1-1095`, `src/components/workout/ExerciseTutorial.tsx:1-1060`, `src/pages/coach/ProgramBuilder.tsx:1-1043`, `src/pages/MyCoach.tsx:1-1000`, `src/components/workout/components/ExerciseDisplay.tsx:1-964`, `src/components/workout/WorkoutSummary.tsx:1-931`, `src/components/workout/history/WorkoutHistory.tsx:1-906`, `src/components/workout/ActiveWorkoutNew.tsx:1-888` ו־`src/pages/Program.tsx:1-701`.

לא נמצא במעבר זה חישוב hot מסוג `O(n²)` מאומת ב־`progressMetrics`; טרנספורמציות המדדים הן pure ומכוסות בבדיקות. הסיכון המאומת הוא DOM/קונטקסט וטעינות נתונים, לא טענה כללית על אלגוריתם ריבועי.

### מסלול נתוני BBT והמלצת פיצול קונקרטית

`AppRouter` מפצל את עמוד Program ברמת route (`src/AppRouter.tsx:63-70`), אך העמוד עצמו מייבא את כל `BBT_PROGRAM` סטטית (`src/pages/Program.tsx:20`), וכך גם `programService` (`src/services/programService.ts:17`). `ActiveWorkoutNew` מייבא את השירות ברמת module (`src/components/workout/ActiveWorkoutNew.tsx:16`), ולכן טעינת מסך אימון גוררת את נתוני BBT גם כשאימון הגיע מתבנית רגילה. `ProgramCard` אמנם משתמש ב־`import()` (`src/components/dashboard/ProgramCard.tsx:46-47`), אבל עושה זאת עם mount של Dashboard ולא אחרי בחירה מפורשת של המשתמש.

לעומת זאת, catalog התרגילים המובנה מפוצל נכון יותר: `exerciseDb` טוען את `builtInExercises` דינמית רק במסלול ה־DB הרלוונטי (`src/services/exerciseDb.ts:34`).

**תיקון מוצע:** ליצור `programCatalog.ts` קטן מאוד (id, title, totalWeeks, progress labels), וליצור chunks סטטיים נפרדים לכל שבוע או יום, למשל `bbt/weeks/week-01.ts`. `programService` יחזיק map מפורש של loaders (`1: () => import('./bbt/weeks/week-01')`) ויטען יום רק לאחר `startProgramDay`; `ProgramCard` ישתמש רק ב־catalog; ו־`ActiveWorkoutNew` יקרא loader רק עבור `PROGRAM_DAY_TEMPLATE_ID`. בעת הצטרפות לתוכנית יש prefetch של השבוע הנוכחי והבא ושמירה ב־IDB/cache כדי לשמור offline. מאחר שה־precache הנוכחי תופס כל `**/*.js` (`vite.config.ts:58`), יש גם להחריג chunks אלה מה־precache הגלובלי ולהוסיף runtime cache עם limit; אחרת הפיצול יחסוך parse/transition אך לא בהכרח את נפח ה־install הראשוני.

## P0 — לעצור לפני production sync

| בעיה | file:line | תרחיש כשל | תיקון |
|---|---|---|---|
| **התור מנסה replay offline ומוחק mutation לאחר חמישה ניסיונות.** `initOfflineSync()` קורא `processQueue()` מיד, בעוד שה־guard של `navigator.onLine` קיים רק בטיימר המחזורי. failure retriable מגדיל `retryCount`; ב־`MAX_RETRIES = 5` הרשומה נמחקת. | `src/services/offlineQueue.ts:61,479-606,657-687`; הבדיקה אף מקבעת את ההתנהגות: `src/services/__tests__/offlineQueueFeed.test.ts:83-92` | משתמש ביצע אימון offline, פותח את האפליקציה חמש פעמים בלי חיבור; כל startup נכשל ב־network request, ובפתיחה החמישית השינוי נמחק מהתור. ההודעה “לא נשמרו בענן” אינה recovery: payload כבר אינו קיים. | לא לספור ניסיון כשהדפדפן offline; להוסיף `nextAttemptAt` עם exponential backoff durable; להחזיק רשומות כושלות ב־dead-letter store עם payload, סיבת כשל ו־Retry/Export UI. מחיקה אוטומטית רק לאחר אישור משתמש או מדיניות retention מתועדת. |
| **Full sync מאפשר ל־snapshot מקומי ישן לדרוס שורה חדשה בענן.** `batchUpsert` מבצע `upsert` ללא compare-and-swap/condition. trigger השרת מחליף timestamp ישן ב־`now()`, ולכן הוא אינו מונע את עדכון השדות הישנים; pull-side merge רק בוחר ענן אם הזמן גדול strictly. | `src/services/supabaseSyncOrchestrator.ts:197-237,254-417`; `supabase/migrations/20260531160000_clamp_updated_at_future.sql:16-21`; `src/services/cloudMerge.ts:153-156` | Device B משנה תוכנית ב־10:00. Device A נשאר offline עם עותק 09:00 ואז מריץ full sync. ה־upsert מחליף את תוכן B בתוכן A; ה־trigger נותן ל־A `updated_at = now()`, ולכן pull עתידי מתייחס לתוכן הישן כחדש. | להעביר כל write mutable ל־RPC/SQL optimistic concurrency: `revision` מונוטוני או `expected_updated_at`, ו־`UPDATE ... WHERE revision = expected`/`WHERE stored.updated_at < incoming`. על conflict להחזיר את השורה העננית, לבצע merge מפורש ולהציג החלטה; לא לבצע blind bulk upsert. |
| **מחיקות פיזיות מאפשרות resurrection של רשומות ממכשיר offline.** יש tombstones בסכימה, אך templates, personal exercises, body measurements ו־personal records משתמשים ב־`.delete()`. ה־queue מפנה את מחיקת template/exercise לאותם handlers. | `src/services/supabaseSync.ts:76-83,241-248,365-372,457-464`; `src/services/offlineQueue.ts:270-283`; הסכימה דווקא מספקת `deleted_at`: `supabase/migrations/20260531140000_tombstones.sql:4-21` | Device A מוחק template. Device B היה offline ושומר עותק חי. אחרי ה־hard delete אין tombstone בענן, ו־full upsert של B מכניס את הרשומה מחדש בשקט. המחיקה של המשתמש מתהפכת. | לאחד את כל סוגי המחיקה ל־soft delete אטומי: `deleted_at`, `updated_at`/`revision` ו־tombstone גם ב־queue. להסתיר tombstones ב־UI אך לשמור אותם עד waterline/retention בטוח; garbage collection רק בשרת לאחר חלון התאוששות. |
| **כשל בקריאת store מקומי יכול להסתיים בדיווח `success: true`.** `Promise.allSettled` מתעד קריאה שנדחתה אך `unwrapRead` מחליף אותה ב־array ריק; תנאי ההצלחה בודק רק כשלי push ו־`failedItems`. | `src/services/supabaseSyncOrchestrator.ts:132-173,434-465` | IndexedDB נכשל בקריאת `personal_records` (quota, upgrade או corruption). full sync דוחף את שאר ה־stores, מחזיר “הסתנכרן”, אך לא גיבה ולא העלה את ה־records של המשתמש. | `readFailed.length > 0` חייב להחזיר failure/degraded state ולהפסיק full push של snapshot חלקי, או לפחות לשמור retryable job נפרד עם store IDs ולהציג UI “X מקורות לא גובו”. למדוד ולדווח לכל store. |

## P1 — לתכנן וליישם לפני הרחבת השימוש

| בעיה | file:line | תרחיש כשל | תיקון |
|---|---|---|---|
| **Mutation ללא `userId` יכול להישלח לחשבון המחובר כעת.** השדה אופציונלי, ומבחן קיים מאשר ש־legacy entry ללא בעלים יעובד עבור המשתמש הנוכחי. | `src/services/offlineQueue.ts:48,243-325,377-433`; `src/services/__tests__/offlineQueueFeed.test.ts:119-132` | שינוי שנוצר ללא auth/בגרסה ישנה נשאר במכשיר משותף. משתמש אחר נכנס מאוחר יותר, והנתון הישן נכתב לחשבון שלו. זהו ערבוב נתונים בין חשבונות. | לחייב `userId` בזמן enqueue. נתון guest יישב ב־namespace guest מפורש; רשומה legacy ללא בעלים תיכנס ל־quarantine עם Export/Discard, ולעולם לא תשויך אוטומטית לחשבון חדש. |
| **אין נעילה בין tabs לתור או ל־full sync.** `isProcessing` ו־`syncAllInFlight` הם state בזיכרון של tab/JS realm בלבד. | `src/services/offlineQueue.ts:473-489`; `src/services/supabaseSyncOrchestrator.ts:99-108,469-475` | שני tabs פתוחים מעבדים אותו mutation או עושים full upsert במקביל. גם אם write idempotent בחלקו, retry counts, סדר mutation והתנגשות LWW הופכים לא־דטרמיניסטיים. | להשתמש ב־`navigator.locks.request('sparkos-sync')`; fallback: lease אטומי ב־IndexedDB עם TTL וחידוש, בתוספת `BroadcastChannel` להצגת מצב. כל replay/pull/push יעבור באותה critical section. |
| **התור אינו מוגבל בגודל ואוסף/ממיין את כל הרשומות.** קיימים רק indexes של זמן, וה־replay קורא/ממיין את כל התור; dedup נעשה ב־cursor. אין cap לפי כמות, bytes או גיל ואין dead-letter durable. | `src/services/offlineQueue.ts:163,182-195,396-433,479-606` | ימים של עבודה offline יוצרים אלפי updates. פתיחת האפליקציה גורמת לזמן/זיכרון גדלים, storage quota, ולבסוף כשל שהמשתמש אינו יכול לשחזר. | coalesce לפי entity ל־mutation האחרון התקין, להגדיר quota (`count`, `bytes`, `age`), לשמור `lastError/nextAttemptAt`, ולהתריע לפני quota. לא למחוק payload כדי לעמוד במגבלה; להעביר אותו ל־recovery/export. |
| **pagination בענן היא offset/range ולא cursor יציב.** | `src/services/supabaseSyncPagination.ts:12-45`; שימוש ב־fetchers: `src/services/supabaseSync.ts:53-60,122-131` | בזמן pull של יותר מ־1,000 שורות, insert/update משנה סדר בין page 1 ל־page 2. Range offset עלול לדלג או להכפיל רשומות, וה־merge מייצר snapshot לא עקבי. | להשתמש ב־keyset cursor יציב (`updated_at,id`) וב־order מפורש, או snapshot watermark מהשרת (`updated_at <= syncStartedAt`) עם cursor. לתעד tie-breaker ותנועה של tombstones. |
| **טיוטת אימון אינה durable מספיק עבור crash/eviction ממושך.** היא נשמרת ל־`localStorage` לאחר debounce של 500ms, ומוחקת עצמה אחרי 12 שעות; חריגת storage רק נתפסת/logged. | `src/components/workout/core/WorkoutProvider.tsx:39,63-100,135-148,216-287` | OS מפנה את ה־PWA או quota מונע כתיבה, או שהמשתמש חוזר לאחר יותר מ־12 שעות. הטיוטה נמחקת אף שעדיין מייצגת אימון לא גמור. | לשמור draft גם ב־IndexedDB עם revision ו־last-known-good, להציג warning מתמשך כאשר persistence נכשל, ולהחליף מחיקה אוטומטית ב־מסך recovery/Discard מפורש. לשמור synchronously לפני update/reload. |
| **עדכון PWA יכול לרענן באמצע אימון.** ה־prompt מפעיל `updateServiceWorker(true)`, כלומר skip-wait/reload, ללא בדיקת `active workout` או flush של draft. | `src/components/pwa/PWAUpdatePrompt.tsx:7,22-30,41-100`; חלון ה־persist הוא `src/components/workout/core/WorkoutProvider.tsx:230-266` | המשתמש לוחץ “עדכן” מיד לאחר הזנת סט; reload מגיע לפני debounce/flush האחרון ועלול לאבד את השינוי האחרון. | בעת אימון פעיל להציג “העדכון יותקן בסיום האימון”, לשמור state מיד לפני activation, ולהציע “עדכן עכשיו” רק לאחר אישור סיכון. לשמור service worker waiting עד safe point. |
| **נתוני BBT גדולים נטענים מוקדם מדי, וגם נכנסים ל־precache הרחב.** | `src/services/programService.ts:17`; `src/pages/Program.tsx:20`; `src/components/workout/ActiveWorkoutNew.tsx:16`; `src/components/dashboard/ProgramCard.tsx:46-47`; `vite.config.ts:58,138,180` | מבקר Dashboard שלא בחר תוכנית או משתמש שמתחיל אימון מתבנית רגילה מוריד/מפרש chunk של `217.98 kB`; install PWA שומר כל JS התואם glob. זמן מעבר ורשת חלשה נפגעים. | לפצל catalog/שבועות/ימים ולקרוא loader רק במסלול התוכנית; prefetch מודע־offline לשבוע הנוכחי; להגדיר Workbox cache ייעודי ומוגבל לנתוני תוכנית במקום precache אוניברסלי. |
| **Observability אינו מספק גילוי או אבחון production אמין.** Sentry נטען רק אחרי consent ורק אם DSN קיים; source maps כבויים. Web Vitals נשלחים כ־breadcrumb בלבד, וה־event store הוא local בלבד. | `src/main.tsx:28-75`; `src/lib/sentryLazy.ts:11-18,51-60`; `src/services/webVitals.ts:1-35`; `src/services/eventTracker.ts:20-36`; `vite.config.ts:182` | ללא הסכמה, DSN או exception עוקב אין telemetry. גם כאשר יש שגיאה, stack minified וללא source map; LCP/INP אינם זמינים כמדד מצטבר, ואין דרך לדעת אם checkout או sync כושלים. | להחליט מדיניות privacy/consent מפורשת ל־error telemetry, להבטיח DSN ב־release CI, להעלות hidden source maps ל־Sentry עם release ID, לשלוח Web Vitals ל־endpoint/metrics, ולהוסיף alerts ל־sync failure, dead-letter, queue depth ו־IDB errors. מקור בלבד אינו מוכיח אם DSN מוגדר בפרודקשן. |
| **CI אינו מריץ E2E, והמסעות העסקיים החשובים קיימים אך מנוטרלים.** | `.github/workflows/ci.yml:39-67`; `e2e/journeys/auth-cloud-sync.spec.ts:52-89`; `e2e/journeys/workout-start-save-summary.spec.ts:36-80`; `e2e/journeys/paywall-entitlement.spec.ts:32-72` | pull request יכול לעבור coverage/build אף ששמירת אימון, re-login cloud sync, entitlement או checkout נשברו. אין regression test ל־PWA/offline, race רב־tab או מחיקה בין מכשירים. | להפעיל Playwright חובה לפחות ב־Chrome/Pixel על preview; לבטל `fixme` בעזרת Supabase test project ו־payment mock; להוסיף fixture/chaos tests ל־offline reopen, crash/reload, שני tabs ושני devices עם update/delete מתנגשים. |
| **רצפת coverage נמוכה אינה רף production.** | `vitest.config.ts:18-19,21-55` | `1,149` tests עוברים, אבל threshold כללי של `20%` statements/lines ו־`37%` functions מאפשר regression באזורים קריטיים ללא כיסוי. | להעלות thresholds בהדרגה לפי domain, לא רק כמות: `offlineQueue`, orchestrator, tombstones, workout recovery ו־billing. להוסיף mutation/contract tests ל־RPC sync לפני העלאה גלובלית. |

## P2 — שיפור ביצועים, שקיפות וחוויית PWA

| בעיה | file:line | תרחיש כשל | תיקון |
|---|---|---|---|
| **ספריית התרגילים מסננת וממיינת את כל הרשומות ומרנדרת את כולן.** `React.memo` קיים, אך אין virtualizer ברשימה. | `src/components/workout/ExerciseLibraryTab.tsx:161-188,302-335`; `src/components/workout/components/ExerciseList.tsx:19-55` | בחיפוש בכל הקלדה על catalog אישי גדול, מתבצע `filter` + `sort`, ולאחר מכן מאות `ExerciseCard` נשארים ב־DOM. במכשיר חלש מתקבל scroll/input lag. | להשתמש ב־`@tanstack/react-virtual` גם כאן, `useDeferredValue`/debounce לחיפוש, ו־normalized search key/cache. להשאיר DOM מלא רק במצב accessibility מפורש אם נדרש, עם pagination חלופית. |
| **"selectors" של workout עדיין נרשמים לכל state object.** פיצול contexts קיים, אך `useWorkoutState()` צורך את context השלם ואז hooks גוזרים ממנו ערך. | `src/components/workout/core/WorkoutContext.tsx:13-27,35-40,72-181`; `src/components/workout/ActiveWorkoutNew.tsx:95` | שינוי timer, overlay או set אחד יכול לרנדר מחדש consumers רבים שאינם תלויים בשדה שהשתנה. באימון ארוך זה מגביר jank. | לפצל state context לפי slices חמים או להשתמש ב־`useSyncExternalStore`/selector library עם subscription אמיתי; למדוד React Profiler לפני ואחרי ולשמור derived values מחוץ ל־render hot path. |
| **Progress טוען חלון של שנה אך חותך sessions ב־400.** | `src/pages/progress/useProgressData.ts:40-46,91-105` | משתמש עם יותר מ־400 אימונים בחלון (למשל שני אימונים ביום) מקבל גרפים/PRs חסרים ללא סימון truncation. | להשתמש ב־pagination/cursor או aggregate queries, ולהחזיר `hasMore/truncated` כדי שה־UI יציג גבול נתונים. |
| **הגדרת התראות יכולה להיראות מאופשרת לאחר denial.** תוצאת `requestNotificationPermission()` אינה נבחנת לפני שמירת `nextEnabled`. | `src/services/notificationService.ts:47-57`; `src/pages/settings/hooks/useSettingsState.ts:137-146` | משתמש דוחה permission, אך switch נשמר enabled; הוא מצפה להתראות שלא יגיעו. | לשמור enabled רק אם התוצאה `true`; במצב `denied` להציג סטטוס והנחיה לפתיחת הגדרות מערכת. |
| **חסרים install UX, זיהוי iOS והסבר מגבלות Web Push.** רכיב ה־PWA היחיד הוא update prompt; ה־push worker עצמו תקין מבחינת push/click/RTL. | `src/components/pwa/PWAUpdatePrompt.tsx:13-100`; `public/push-sw.js:11-41`; `vite.config.ts:34-67` | משתמש iPhone/דפדפן שאינו תומך install/push אינו מקבל דרך ברורה “הוספה למסך הבית” או ציפיות נכונות לגבי התראות. | להוסיף install state machine סביב `beforeinstallprompt`, הוראות Share → Add to Home Screen עבור iOS, זיהוי standalone ו־feature detection ל־Push/Notification; למדוד accepted/dismissed/unsupported. |

## מה כבר תקין

- **Route splitting קיים:** מסלולי אפליקציה רבים, כולל `Program`, `Progress`, `Settings` ו־מסכי coach, נטענים ב־`lazy()` (`src/AppRouter.tsx:63-95`). רכיבי overlay כבדים באימון נטענים עצלנית (`src/components/workout/active/WorkoutFlowOverlays.tsx:17-23`).
- **`builtInExercises` מפוצל לפי שימוש:** `exerciseDb` משתמש ב־dynamic import (`src/services/exerciseDb.ts:34`), וה־build מאשר chunk נפרד של `25.57 kB`.
- **היסטוריית אימונים כן משתמשת בווירטואליזציה:** `@tanstack/react-virtual` מיובא ומופעל ב־`WorkoutHistory` (`src/components/workout/history/WorkoutHistory.tsx:19,650`), עם threshold של 20 פריטים.
- **שמירת אימון משלימה כתיבה מקומית לפני cloud:** `saveWorkoutSession` ממתין ל־`dbPut` לפני sync (`src/services/sessionDb.ts:27-34`), ו־UI הסיום שומר שגיאה/יכולת retry (`src/components/workout/hooks/useWorkoutSave.ts:68-123,214-216`).
- **מיזוגים מקומיים אטומיים במקומות מרכזיים:** merge של workout sessions משתמש ב־IndexedDB readwrite transaction (`src/services/sessionDb.ts:211-270`), ו־IDB משתמש ב־schema version, יצירת stores הגנתית ו־`onblocked` (`src/services/indexedDBCore.ts:6-7,55-155`).
- **לתור יש בסיס שימושי:** סדר `seq` מתקן התנגשויות timestamp (`src/services/offlineQueue.ts:49-55,171-195`), ו־sync engine מפעיל exponential backoff עם jitter עד `30s` (`src/services/syncEngine.ts:22-61`). אלה אינם פותרים את מחיקת retry או race רב־tab, אך הם תשתית טובה לתיקון.
- **PWA בסיסי והגנת פרטיות קיימים:** manifest standalone/portrait/RTL/עברית, cleanup ו־SPA fallback מוגדרים (`vite.config.ts:34-67`). runtime cache מוגדר לפונטים ונכסים, לא ל־Supabase REST, וכך נמנעת cache משותפת בין חשבונות באותו browser (`vite.config.ts:67-100`).
- **Push worker תקין ברמת ה־browser:** הוא מציג notification RTL בעברית ומנווט click ל־URL המתאים (`public/push-sw.js:11-41`); service notification מעדיף registration API עם fallback (`src/services/notificationService.ts:57-89`).
- **אבטחת telemetry טובה כברירת מחדל:** Sentry נטען lazily ואינו מכניס SDK כבד ל־entry bundle (`src/lib/sentryLazy.ts:4-18`), ו־`errorReporter` מצרף tags מובְנים (`src/services/errorReporter.ts:19-36`). יש להשלים transport/release observability, לא לבטל את שיקולי ה־consent.
- **CI בסיסי מוצק:** Node 20 ו־22, `npm ci`, typecheck, lint, format, coverage artifact ו־build מופעלים (`.github/workflows/ci.yml:16-67`). Playwright מכוון ל־Desktop Chrome ול־Pixel 5 בעברית/אזור זמן ירושלים (`playwright.config.ts:15-75`), אך טרם מחובר ל־CI.

## backlog ממוספר

1. **לחסום את ארבעת מסלולי ה־P0 בשרת ובקליינט.** קודם RPC/versioned writes ו־tombstones לכל table, אחר כך queue שלא מוחק payload על network failure, ולבסוף full sync שנכשל על local-read חלקי. להוסיף test דו־מכשירי לכל אחד לפני rollout.
2. **להחליף retry-count בהפצת תור durable.** `nextAttemptAt`, backoff persisted, בדיקת online לפני attempt, dead-letter/retry/export, quota ו־telemetry. להוסיף `navigator.locks`/IDB lease כדי שכל tab יעבוד תחת lock יחיד.
3. **ליישר את מודל המחיקה.** audit לכל `deleteCloud*`, להמיר hard delete ל־tombstone עם revision, ולממש server-side retention/GC. תרחיש חובה: delete ב־A, offline update ב־B, reconnect, והרשומה נשארת מחוקה.
4. **להפוך full sync ל־snapshot עקבי.** keyset pagination עם watermark, pull-before-push לפי revision, conflict envelope מפורש, ודיווח store-level על partial failure. לא להסתמך על client clock או trigger כ־conflict resolver.
5. **לחזק crash recovery של אימון.** mirror ל־IndexedDB, last-known-good snapshot, הודעת persistence failure, recovery UI במקום מחיקת 12 שעות, ו־flush לפני service-worker activation.
6. **לפצל BBT לפי שימוש.** catalog קטן + chunks שבוע/יום + loader מפורש, prefetch offline לפי enrollment, ואסטרטגיית Workbox מוגבלת לנתונים שנבחרו. לקבל baseline Web Vitals לפני/אחרי על Pixel 5 ורשת איטית.
7. **למדוד ולשלוח telemetry אמיתי.** Sentry release + hidden source maps, RUM Web Vitals transport, dashboards/alerts ל־sync/IDB/queue. להגדיר אירועים consent-aware לפחות ל־`signup_completed`, `onboarding_completed`, `workout_started`, `workout_completed`, `paywall_viewed`, `checkout_started`, `checkout_succeeded`, `checkout_failed`, `install_prompted`, `install_accepted`, `notification_permission_result`, `sync_failed` ו־`sync_recovered`.
8. **להפוך E2E לשער CI.** ליצור Supabase test project ו־payment mock, להסיר `fixme` משלושת journeys, ולהריץ Desktop+Pixel. להוסיף בדיקות PWA install/update/offline fallback, crash/reload, five-retry recovery, multi-tab lock ושני devices עם stale update/delete.
9. **לשפר render scaling.** לוירטואל את Exercise Library, ליצור subscriptions גרנולריים ל־Workout state, לטעון Progress בפאג'ינציה ולהציג truncation, ולפרק את הקומפוננטות הארוכות לפי גבולות state/IO.
10. **להשלים PWA ו־notification UX.** install prompt מותאם iOS, feature detection, סטטוס permission אמיתי, ודחיית update בזמן אימון. למדוד את מסלול ההתקנה והכשל כדי לוודא שהשיפור עובד.

## החלטת שחרור מוצעת

אפשר להמשיך עם שימוש מקומי/guest ובדיקות UI, אבל יש לחסום או להכריז beta על cloud sync רב־מכשירי עד שסעיפים 1–4 ב־backlog מאומתים. אישור production צריך לכלול: migration/RPC שנבדקו בסביבת Supabase נפרדת, chaos/E2E לשני devices ולשני tabs, מדדי retry/dead-letter אפסיים או מטופלים, ו־Sentry/Web Vitals פעילים ומאומתים בסביבת release ללא חשיפת source maps לציבור.
