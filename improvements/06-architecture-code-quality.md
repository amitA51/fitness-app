# 06 — ארכיטקטורה, חוב טכני והכנה ל-React Native · תיק עבודה לסוכן Architecture

> **תפקידך:** סוכן ארכיטקטורה. המוקד: איחוד מקורות-אמת כפולים, מחיקת dead code, פירוק קבצי ענק, והפרדת business logic מ-UI (קריטי — מתוכננת כתיבה מחדש ל-React Native שתשתמש מחדש ב-`services/`).

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד החי (כולל `grep` לשימושים לפני מחיקה!); מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.** בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| AR-1 | `Exercise` — god-object עם 25+ שדות אופציונליים (חוסם RN) | High | L |
| AR-2 | קבצי ענק (Settings 68KB, Nutrition 56KB, Onboarding 50KB, ActiveWorkoutNew 41KB, ExerciseReorder 42KB, Templates 40KB) | High | L |
| AR-3 | z-index — 3 מקורות סותרים (`zIndex.ts` 1100 vs tailwind 90 vs hardcoded) | High | M |
| AR-4 | business logic מוטמע ב-UI (חוסם RN) | High | L |
| AR-5 | Toast — `ui/Toast` dead, `workout/.../ui/Toast` בשימוש אפליקטיבי | Medium | S |
| AR-6 | `STORES` vs `STORAGE_KEYS`/`LOCAL_STORAGE_KEYS` כפול | Medium | S |
| AR-7 | `PersonalRecord` מוגדר פעמיים בצורות שונות | Medium | S |
| AR-8 | פער דיווח שגיאות ל-Sentry משכבת service | Medium | M |
| AR-9 | `syncEngine.ts` re-export דרך `indexedDBCore` + הערת dead `syncPendingToServer` | Medium | S |
| AR-10 | `SwipeComplete.tsx` — dead code (15KB, לא מיובא) | Low | S |
| AR-11 | `handleError` כפול — שניהם dead | Low | S |
| AR-12 | `AnimatedNumber` ×2 — שניהם אולי dead | Low | S |
| AR-13 | מגבלות אימון כפולות (`workoutConstants` vs `validation`) | Low | S |
| AR-14 | `initOfflineSync` כפול | Low | S |
| AR-15 | `dataEvents` event bus ללא type safety | Low | S |

---

## ממצאים מפורטים

### AR-1 · `Exercise` god-object — High (חוסם RN)
- **מיקום:** `src/types/index.ts` (interface `Exercise`, ~25 שדות אופציונליים). מערבב catalog (`name`,`targetMuscle`) + runtime (`sets?`,`isCompleted?`) + template (`targetSets?`,`restSeconds?`) + tracking + UI hints. `useWorkoutSave` נאלץ להמיר ידנית `Exercise[]→WorkoutExercise[]`.
- **תיקון:** פצל ל-`ExerciseCatalogEntry` / `ActiveExercise` (runtime+sets) / `TemplateExercise`. ה-reducer ישתמש ב-`ActiveExercise`. ניתן הדרגתי עם type aliases. קריטי ל-RN — services יחזירו אובייקטים מטופסים, לא bag of optionals.
- **DoD:** טיפוסים נפרדים; ה-reducer וה-save נקיים מהמרות ידניות; טייפצ'ק עובר.

### AR-2 · קבצי ענק — High
- **מיקום:** `Settings.tsx` (68KB), `Nutrition.tsx` (56KB), `OnboardingFlow.tsx` (50KB), `ActiveWorkoutNew.tsx` (41KB), `ExerciseReorder.tsx` (42KB), `Templates.tsx` (40KB). תת-קומפוננטות inline, לוגיקה מעורבת ב-render, state שצריך להיות hooks.
- **תיקון:** לכל קובץ — חלץ תת-קומפוננטות לקבצים; חלץ logic ל-hooks; השאר את העמוד כ-orchestrator דק (<200 שורות). סדר עדיפות: Settings → Nutrition → ActiveWorkoutNew (הכי משמעותי ל-RN).
- **DoD:** קבצים מתחת ל-~600 שורות; logic ב-hooks/services.
- **תיאום:** **04-Perf נוגע ב-`ActiveWorkoutNew`/`Settings`/`Nutrition` (memo/re-render). תאמו — אתה למבנה, הם ל-render. עדיף שתפצל ראשון, ואז 04 ממזכר.**

### AR-3 · z-index — 3 מקורות סותרים — High
- **מיקום:** `src/constants/zIndex.ts` (modal:1100, toast:1400), `tailwind.config.js` (modal:90, toast:100 — scale שונה לגמרי), + hardcoded `z-[15000]`/`z-[200]`/`z-[9999]`. רק `ModalOverlay.tsx` מייבא מ-`zIndex.ts`.
- **תיקון:** בחר מקור אמת אחד; יישר scales; החלף hardcoded ב-classes סמנטיים (`z-modal`/`z-toast`/`z-overlay`); מחק `zIndex.ts` אם בחרת ב-tailwind.
- **DoD:** ערך אחד לכל שכבה לוגית; אין hardcoded.
- **תיאום:** משותף שמית עם 01-Design (D-4, tailwind.config.js). תאמו עריכות באותו קובץ.

### AR-4 · business logic ב-UI — High (חוסם RN)
- **מיקום:** `Settings.tsx` (קורא `dbClear`,`calculateTDEE`,`getMacroGoalsForGoal`,`exportWorkoutHistoryCSV`), `useWorkoutSave.ts` (בניית `WorkoutSession` + חישוב קלוריות), `WorkoutProvider.tsx` (localStorage, wake lock, sound — platform concerns). services נקיים אך hooks/providers לא ניידים.
- **תיקון:** `services/workoutSessionBuilder.ts` (בניית סשן); `services/settingsService.ts` (TDEE/macro orchestration); `src/platform/web.ts` adapter (wake lock/visibility/localStorage) להחלפה ב-RN.
- **DoD:** logic ב-services; platform concerns מאחורי adapter.

### AR-5 · Toast כפול — Medium
- **מיקום:** `src/components/workout/components/ui/Toast.tsx` (singleton imperative `showToast`, בשימוש ב-9 קבצים כולל coach/JoinPage/AuthContext — לא רק workout!), `src/components/ui/Toast.tsx` (declarative, **0 imports** — dead, 7.9KB).
- **תיקון:** העבר את ה-imperative ל-`src/components/ui/GlobalToast.tsx`; מחק את `ui/Toast.tsx` הקיים; עדכן 9 imports; mount של `ToastContainer` ב-`App.tsx`, לא ב-`ActiveWorkoutNew`.
- **DoD:** מערכת Toast אחת, ממוקמת ב-ui, mounted גלובלית.
- **תיאום:** **05-A11y (A-10) רוצה לתקן ARIA ב-`ui/Toast.tsx`. תאם — אם תמחק/תעביר, יישמו את ה-ARIA fix על ה-imperative שנשאר.**

### AR-6 · `STORES` vs `STORAGE_KEYS` — Medium
- **מיקום:** `indexedDBCore.ts` (`STORES`) ו-`constants/index.ts` (`STORAGE_KEYS`/`LOCAL_STORAGE_KEYS`) — אותם ערכים. 4 service files מייבאים את שניהם.
- **תיקון:** הסר `STORAGE_KEYS`/`LOCAL_STORAGE_KEYS`; השתמש ב-`STORES` מ-`indexedDBCore`; barrel ה-constants יכלול רק zIndex+workoutConstants.
- **DoD:** מקור אחד לשמות stores.
- **תיאום:** 08-Data נוגע ב-`indexedDBCore`. תאמו.

### AR-7 · `PersonalRecord` כפול — Medium
- **מיקום:** `types/index.ts` (`type: ...`, `value?`,`maxWeight?`) vs `supabaseSyncMappers.ts` (`recordType: ...`, `user_id?`).
- **תיקון:** שנה שם ל-`PersonalRecordRow` ב-mapper (כמו שאר ה-row types) + JSDoc "Supabase row shape".
- **DoD:** אין התנגשות שמות; כוונה ברורה.

### AR-8 · פער דיווח שגיאות ל-Sentry — Medium
- **מיקום:** Sentry מאותחל ב-`main.tsx`, אבל `errors/index.ts::handleError` רק `logger.app.error`; `utils/errorReporting.ts` (dead) תוכנן להרחבה ולא חובר. שגיאות service נלכדות מקומית אך לא מדווחות ל-Sentry אלא אם בועטות כ-unhandled.
- **תיקון:** `src/services/errorReporter.ts` שעוטף `Sentry.captureException` עם tags (service, action, sync state); חבר ל-final-failure של ה-sync ול-catch blocks; מחק את `utils/errorReporting.ts`.
- **DoD:** שגיאות service מדווחות ל-Sentry עם הקשר.
- **תיאום:** 07-Testing (Sentry/observability) — תאמו; 07 מאמת כיסוי.

### AR-9 · `syncEngine` re-export מבלבל — Medium
- **מיקום:** `indexedDBCore.ts` (re-export של `syncWithRetry` + הערת dead `syncPendingToServer`). הצרכנים מייבאים מ-`./indexedDBCore` במקום `./syncEngine`.
- **תיקון:** מחק את ההערה המתה; עדכן 10+ צרכנים לייבא ישירות מ-`./syncEngine`; שקול מיזוג `syncEngine` (96 שורות) לתוך `indexedDBCore`.
- **DoD:** import path ברור; אין הערות מתות.
- **תיאום:** **08-Data הוא הבעלים של נתיב ה-sync. תאם לפני שינוי imports.**

### AR-10 · `SwipeComplete` dead code — Low
- **מיקום:** `src/components/workout/components/SwipeComplete.tsx` (15.4KB) — מיוצא מ-barrel אך **לא מיובא** (האימון משתמש ב-`SlideToComplete`).
- **תיקון:** מחק + הסר export מ-barrel.
- **DoD:** הקובץ נמחק; build עובר.
- **תיאום:** **⚠️ 02-Motion (M-2/M-3) רצה לתקן RTL בקובץ הזה. סנכרן: אם מוחקים — הודע ל-02 לדלג. אל תמחק לפני שווידאת עם הבעלים שלא רוצים להחזירו לשימוש.**

### AR-11 · `handleError` כפול (שניהם dead) — Low
- **מיקום:** `utils/errorReporting.ts` (`{userMessage,error}`) ו-`errors/index.ts` (void). **0 imports** לשניהם. (error classes מ-`errors/index.ts` כן בשימוש.)
- **תיקון:** מחק את `utils/errorReporting.ts` (ראה AR-8); הסר את export ה-`handleError` מ-`errors/index.ts`; שמור את ה-error classes.
- **DoD:** אין שתי `handleError`.

### AR-12 · `AnimatedNumber` ×2 — Low
- **מיקום:** `ui/AnimatedNumber.tsx` (4.5KB) ו-`workout/components/ui/AnimatedNumber.tsx` (2.3KB). grep: **0 imports** לשניהם.
- **תיקון:** אמת tree-shaking; אם dead — מחק את שניהם; אם צריך אחד — שמור את העשיר (`ui/` עם `format`/`AnimatedProgress`).
- **DoD:** אין רכיב כפול/מת.

### AR-13 · מגבלות אימון כפולות — Low
- **מיקום:** `constants/workoutConstants.ts` (`MAX_SETS:20`...) ו-`utils/validation.ts` (`WORKOUT_LIMITS`). אותם ערכים, אף אחד לא מפנה לשני.
- **תיקון:** `validation.ts` ייבא מ-`workoutConstants.ts` (מקור אמת אחד). יישב `reps.min=0` vs `MIN_REPS=1`.
- **DoD:** מקור אחד; אין סתירות.

### AR-14 · `initOfflineSync` כפול — Low
- **מיקום:** `main.tsx` + `App.tsx`. idempotent אך import מיותר ל-App chunk.
- **תיקון:** הסר מ-`App.tsx`.
- **DoD:** קריאה אחת. **תיאום:** משותף עם 04-Perf (P-10).

### AR-15 · event bus ללא types — Low
- **מיקום:** `src/services/dataEvents.ts` — `window.dispatchEvent(new Event(...))` בלי payload. מקובל כרגע (2 events, 5 consumers).
- **תיקון:** אם יתווספו events — `TypedEventTarget`/`mitt`. עדיפות נמוכה.
- **DoD:** מתועד; שדרוג רק בעת הצורך.

---

## הזדמנויות שדרוג
- **Platform abstraction** `src/platform/{web,rn}.ts` (storage/haptics/wakeLock/audio/notifications) — RN רק מחליף מימוש.
- **Zustand/Jotai** במקום 5 contexts + localStorage + window events + IDB.
- **`supabase gen types typescript`** — טיפוסי שורה מהסכמה החיה, מחליף את `supabaseSyncMappers` הידני.
- **barrel `src/services/index.ts`** — API surface מפורש + אימות tree-shaking.

## תיאום ונקודות חיכוך
- `ActiveWorkoutNew`/`Settings`/`Nutrition` (AR-2) → תאם עם **04-Perf**.
- `tailwind.config.js` z-index (AR-3) → תאם עם **01-Design**.
- `Toast` (AR-5) → תאם עם **05-A11y**.
- `SwipeComplete` (AR-10) → **תאם עם 02-Motion לפני מחיקה.**
- `indexedDBCore`/`syncEngine` (AR-6, AR-9) → **08-Data הבעלים של נתיב ה-sync.**
- `package.json` deps → **03-Security הבעלים** (אל תסיר deps בעצמך).

## הגדרת סיום (תיק)
AR-1/AR-2/AR-4 התקדמו משמעותית (לפחות הקבצים הקריטיים ל-RN); z-index מאוחד; dead code נמחק (בתיאום); `npm run verify && npm run test:run` ירוקים.
