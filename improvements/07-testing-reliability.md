# 07 — בדיקות, אמינות, CI/CD וניטור · תיק עבודה לסוכן QA

> **תפקידך:** סוכן בדיקות ואמינות. runner = vitest; `@testing-library` + `fake-indexeddb` מותקנים. המוקד: כיסוי לנתיבים קריטיים שאינם מכוסים, דטרמיניזם, שערי CI, וניטור פרודקשן (Sentry/web-vitals).

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד החי; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.** בכל commit: `npm run verify && npm run test:run`.
**הערה מיוחדת:** אתה רשת הביטחון של הצוות. עדיף שתוסיף בדיקות ל-`workoutReducer`/sync **לפני** שסוכנים אחרים מרפקטרים אותם — כך תתפוס רגרסיות שלהם.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| T-1 | `workoutReducer` — אפס בדיקות (הלוגיקה המורכבת ביותר) | **Critical** | M |
| T-2 | ספי coverage ≈6% — אין הגנת רגרסיה | High | S |
| T-3 | אין fake timers — בדיקות תלויות-זמן לא דטרמיניסטיות | High | S |
| T-4 | `syncEngine.ts` — אין בדיקות (retry/backoff/queue-on-failure) | High | S |
| T-5 | CI — אין העלאת coverage / gate / artifact | Medium | S |
| T-6 | web-vitals — no-op בפרודקשן (אין observability) | Medium | S |
| T-7 | `PageErrorBoundary` לא מדווח ל-Sentry (בניגוד ל-Root) | Medium | S |
| T-8 | `offlineQueue.processQueue` — אין בדיקה ל-MAX_RETRIES exhaustion | Medium | S |
| T-9 | `personalItemsDb` — IDs לפי `Date.now()` (סיכון collision) | Medium | S |
| T-10 | `no-emoji.test.ts` — `readFileSync` סינכרוני, תלוי סדר FS | Low | S |
| T-11 | Sentry init מותנה — אין אזהרה אם DSN חסר בפרודקשן | Low | S |
| T-12 | CI לא מצמיד גרסת npm / בדיקת תקינות lockfile | Low | S |

---

## ממצאים מפורטים

### T-1 · `workoutReducer` אפס בדיקות — **Critical**
- **מיקום:** `src/components/workout/core/workoutReducer.ts` (~400 שורות). מטפל בכל מוטציות האימון: השלמת סט+auto-increment, superset auto-advance, freeze/thaw של rest timer ב-pause, undo, numpad, reorder. אפס קבצי בדיקה מפנים אליו.
- **תיקון:** `src/components/workout/core/__tests__/workoutReducer.test.ts`: `COMPLETE_SET` (מוסיף סט הבא, auto-increment, מפעיל rest), `UNDO_LAST_SET`, `TOGGLE_PAUSE` (freeze/thaw timer), `NUMPAD_SUBMIT`, superset advance, edge cases (exercises ריק, NaN, drop-set rest=0). אמת ש-`completedAt` ו-`isCompleted` נשארים מסונכרנים.
- **DoD:** כל action מכוסה; edge cases מכוסים.
- **תיאום:** **06-Arch (AR-1) ישנה טיפוסים ב-reducer; 04-Perf (P-2) ישנה subscription. בדיקות שלך יתפסו רגרסיות שלהם — בצע מוקדם.**

### T-2 · ספי coverage ≈6% — High
- **מיקום:** `vitest.config.ts` — `statements:6, branches:40, functions:18, lines:6`. אפשר למחוק חצי מהבדיקות וה-CI יעבור.
- **תיקון:** הרץ `vitest run --coverage`, קבע ספים = ערך נוכחי פחות 1% (רצפת רגרסיה אמיתית); ratchet up עם הוספת בדיקות; ספים פר-קובץ לקריטיים (`workoutReducer`,`offlineQueue`,`cloudMerge`,`syncEngine`); אל תוריד.
- **DoD:** ספים משקפים מציאות; ירידת coverage מפילה CI.

### T-3 · אין fake timers — High
- **מיקום:** `personalItemsDb.test.ts` (workaround `setTimeout(resolve,2)`), `aiContextBuilder.test.ts`, `analyticsService.test.ts`, `dateUtils.test.ts` (`todayStr` מול `new Date()` — עלול ליפול בחצות).
- **תיקון:** `vi.useFakeTimers()`+`vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))`; החלף את ה-`tick()` ב-`vi.advanceTimersByTime`; קבע זמן ל-`todayStr`.
- **DoD:** אין כשלים אקראיים בגבולות זמן.
- **תיאום:** 08-Data מתקן את לוגיקת התאריכים (UTC); תאם בדיקות `dateUtils`/`todayStr`.

### T-4 · `syncEngine.ts` ללא בדיקות — High
- **מיקום:** `src/services/syncEngine.ts` — `syncWithRetry` (exp backoff+jitter+max retries+fallback ל-offlineQueue). שער כל ה-sync. רק `prService.test.ts` מ-mock אותו.
- **תיקון:** `__tests__/syncEngine.test.ts`: הצלחה מיידית; כשל זמני→הצלחה ב-2; מיצוי retries→`queueMutation` עם type/payload נכונים; `isSupabaseConfigured()===false`→false מיידי; `vi.useFakeTimers()` להימנע מ-sleep אמיתי.
- **DoD:** retry/backoff/queue מכוסים.
- **תיאום:** **08-Data הבעלים של נתיב ה-sync.** תאם — בדיקותיך מגנות על שינוייהם.

### T-5 · CI ללא coverage gate — Medium
- **מיקום:** `.github/workflows/ci.yml` — מריץ `test:coverage` אך לא מעלה/לא מגיב ב-PR.
- **תיקון:** `actions/upload-artifact` ל-coverage; `davelosert/vitest-coverage-report-action` להערת PR diff.
- **DoD:** coverage גלוי ב-PR; רגרסיה נראית.

### T-6 · web-vitals no-op בפרודקשן — Medium
- **מיקום:** `src/services/webVitals.ts` — `logMetric` רק `console.log` תחת DEV; נאסף ונזרק בפרודקשן.
- **תיקון:** שלח ל-Sentry/analytics בפרודקשן.
- **DoD:** מדדים מגיעים ל-Sentry.
- **תיאום:** **04-Perf (P-7) הבעלים של התיקון. אתה מאמת ומוסיף בדיקה.**

### T-7 · `PageErrorBoundary` לא מדווח ל-Sentry — Medium
- **מיקום:** `src/errors/PageErrorBoundary.tsx` `componentDidCatch` — רק `logger.app.error`; ה-logger עוטף ב-`Error(context)` חדש ומאבד stack/componentStack. `RootErrorBoundary` כן קורא `Sentry.captureException` עם componentStack.
- **תיקון:** הוסף `Sentry.captureException(error, {contexts:{react:{componentStack:info.componentStack}}, tags:{page:pageLabel}})`.
- **DoD:** שגיאות עמוד מדווחות עם componentStack.
- **תיאום:** 06-Arch (AR-8) בונה `errorReporter`. תאמו.

### T-8 · אין בדיקה ל-MAX_RETRIES — Medium
- **מיקום:** `src/services/offlineQueue.ts` (retryCount), `__tests__/offlineQueueFeed.test.ts` (בודק retry יחיד + non-retriable drop, לא מיצוי 5 retries).
- **תיקון:** בדיקה שקוראת `processQueue()` 5 פעמים עם שגיאה retriable→המוטציה נזרקת, queue depth=0.
- **DoD:** גבול איבוד הנתונים מכוסה.

### T-9 · `personalItemsDb` IDs לפי `Date.now()` — Medium
- **מיקום:** `src/services/personalItemsDb.ts` — `item-${Date.now()}`. הבדיקה מתעדת collision ב-ms זהה (workaround `setTimeout`).
- **תיקון:** `crypto.randomUUID()` (כבר בשימוש ב-`offlineQueue`); הסר את ה-workaround.
- **DoD:** אין סיכון collision; הבדיקה ללא delay.

### T-10 · `no-emoji.test.ts` סינכרוני — Low
- **מיקום:** `src/test/no-emoji.test.ts` — `readdirSync`/`readFileSync` בלי sort.
- **תיקון:** מיין entries (הודעות שגיאה דטרמיניסטיות) או המר לכלל Biome.
- **DoD:** דטרמיניסטי ומהיר.

### T-11 · Sentry init מותנה ללא אזהרה — Low
- **מיקום:** `src/main.tsx` — Sentry רק אם `VITE_SENTRY_DSN`. אם חסר בפרודקשן — דיווח שגיאות נכשל בשקט.
- **תיקון:** `if (!dsn && import.meta.env.PROD) logger.app.warn('Sentry NOT initialized')`.
- **DoD:** אזהרה ברורה כש-DSN חסר בפרודקשן.

### T-12 · CI לא מצמיד npm — Low
- **מיקום:** `.github/workflows/ci.yml` — `npm ci` (טוב) אך בלי הצמדת גרסת npm.
- **תיקון:** `"npm": ">=10"` ב-engines, או `corepack enable`.
- **DoD:** סביבת CI עקבית.

---

## הזדמנויות שדרוג
- **Playwright E2E** לנתיבים קריטיים: offline→online sync, השלמת אימון, auth (לא ניתן ל-unit).
- **Vitest browser mode** — בדיקות עם IDB/SW אמיתיים בלי מגבלות jsdom.
- **Stryker mutation testing** — מכמת איכות בדיקות (ב-6% רוב המוטציות שורדות).
- **Contract testing** מול Supabase / טיפוסים מ-`supabase gen types` — תופס schema drift.
- `"test:ui": "vitest --ui"` ל-package.json.

## תיאום ונקודות חיכוך
- `workoutReducer` (T-1) → 06-Arch + 04-Perf ישנו אותו. בצע ראשון.
- `syncEngine`/`offlineQueue`/`cloudMerge` (T-4, T-8) → **08-Data הבעלים.** בדיקות מגנות עליהם.
- `webVitals` (T-6) → **04-Perf הבעלים.**
- `dateUtils`/`todayStr` (T-3) → **08-Data מתקן UTC.** תאם בדיקות.
- Sentry/`errorReporter` (T-7) → **06-Arch.**

## הגדרת סיום (תיק)
`workoutReducer` ו-`syncEngine` מכוסים; ספי coverage עלו ומאכפים רגרסיה; fake timers בכל בדיקה תלוית-זמן; web-vitals מדווח בפרודקשן; CI מעלה coverage; `npm run test:run` ירוק ויציב 3 פעמים ברצף.
