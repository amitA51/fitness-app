# 04 — ביצועים (runtime + bundle) · תיק עבודה לסוכן Performance

> **תפקידך:** סוכן ביצועים. PWA מובייל-first; ה-bundle כבד (supabase ~191KB, ActiveWorkoutNew ~149KB, react-vendor ~171KB). היעד: אימון פעיל חלק, sync שלא מציף את הרשת, ניווט מהיר.

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד החי; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.** בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| P-1 | `syncAllData` fan-out — מאות בקשות upsert בודדות במקביל | **Critical** | M |
| P-2 | `WorkoutContent` נרשם ל-state מלא → re-render בכל dispatch באימון | High | M |
| P-3 | `WorkoutHistoryList` — `layout` על כל פריט, ללא virtualization | High | S |
| P-4 | `supabaseSync` — כל `fetch*` עם `select('*')` ללא pagination | High | M |
| P-5 | `analyticsService` שולף 1000 sessions מ-IDB בכל קריאה, ללא cache | Medium | M |
| P-6 | `Settings.tsx`/`Nutrition.tsx` מונוליטיים — re-render על כל הקלדה | Medium | M |
| P-7 | web-vitals מאותחל אך no-op בפרודקשן | Medium | S |
| P-8 | `AnimatePresence mode="wait"` במעברי route — עיכוב נתפס 640ms+ | Medium | S |
| P-9 | framer-motion 10 — ספרייה מלאה (~45KB gz), tree-shake חלש | Medium | M |
| P-10 | `initOfflineSync()` נקרא פעמיים (main.tsx + App.tsx) | Low | S |
| P-11 | lucide-react — 69 import sites, chunk icons אולי גדול מהנדרש | Low | S |
| P-12 | `WorkoutProvider` עושה `JSON.stringify(state)` כל 500ms + כל 30s | Low | S |
| P-13 | `DataContext` טוען 100 sessions eagerly ב-mount של האפליקציה | Low | S |

---

## ממצאים מפורטים

### P-1 · `syncAllData` fan-out — **Critical**
- **מיקום:** `src/services/supabaseSync.ts` `syncAllDataImpl()` — `syncPromises.push(...)` לכל רשומה בכל 10 ה-stores, ואז `Promise.allSettled`. משתמש עם 200 sessions+100 templates+300 exercises = 600+ בקשות במקביל → רוויית 6-connection limit, rate limits (429 שלא מנוסים מחדש), timeouts במובייל.
- **תיקון:** `.upsert([...array])` (בקשה אחת לטבלה) בקבוצות 50–100; או concurrency limiter (`p-limit`, conc=3); sync אינקרמנטלי לפי `updatedAt > lastSync`.
- **DoD:** sync מלא = מספר בקשות סביר; אין רוויה/429.
- **תיאום:** **08-Data הבעלים של הקובץ הזה (נכונות sync, F1/F2/F5). בצע אחרי 08**, ואז הוסף batching מעל התיקונים שלהם.

### P-2 · `WorkoutContent` re-render על כל dispatch — High
- **מיקום:** `ActiveWorkoutNew.tsx` — `const state = useWorkoutState()` נרשם ל-`WorkoutState` כולו. כל dispatch (rest timer, set, overlay, haptic, settings) מרנדר מחדש את כל הקומפוננטה (~1100 שורות) וילדיה — מספר פעמים בשנייה באימון.
- **תיקון:** השתמש ב-selector hooks הקיימים (`useWorkoutOverlays`, `useWorkoutCelebration`, `useCurrentExercise`); פצל ל-shell (overlays) + core (exercises/index); או `useSyncExternalStore` עם selector.
- **DoD:** dispatch של timer/overlay לא מרנדר את כל עץ האימון.
- **תיאום:** 06-Arch נוגע ב-`ActiveWorkoutNew` (פירוק קובץ ענק). תאמו — אתה ל-render scope, הם למבנה.

### P-3 · `WorkoutHistoryList` — `layout` ללא virtualization — High
- **מיקום:** `src/pages/progress/components/WorkoutHistoryList.tsx` — `<motion.div key=... layout>` לכל סשן (עד 50). FLIP על כל 50 בכל expand/collapse → jank.
- **תיקון:** הסר `layout` מה-wrapper החיצוני (הכרטיסים לא מסתדרים מחדש); השאר את אנימציית ה-expand על התוכן הפנימי בלבד; ל-50+ הוסף `@tanstack/react-virtual` (כבר תלות — חקה את `ExerciseList`).
- **DoD:** עם 200+ סשנים רק הנראים ב-DOM; גלילה חלקה; expand עובד.
- **תיאום:** משותף עם 02-Motion (G). אתה הבעלים.

### P-4 · `select('*')` ללא pagination — High
- **מיקום:** `supabaseSync.ts` כל `fetch*`; גם `coach/coachApi.ts`, `assignmentService.ts`, `relationshipService.ts`, `reminderService.ts` (35 מופעים סה"כ). `fetchWorkoutSessions` מוריד את כל ה-`exercises` JSONB (5–50KB/שורה).
- **תיקון:** רשימת עמודות מפורשת; `.limit(500)` / cursor pagination; סינון אינקרמנטלי `updated_at > lastSync` (מ-localStorage).
- **DoD:** payload sync יורד 50–80%.
- **תיאום:** **08-Data הבעלים של הקובץ. בצע אחרי 08.**

### P-5 · `analyticsService` שולף 1000 sessions ללא cache — Medium
- **מיקום:** `analyticsService.ts` `getAnalyticsSummary()`/`getProgressData()` — `getWorkoutSessions(1000)` בכל קריאה; חישוב in-memory; אין cache בין מעברי טאב.
- **תיקון:** cache עם TTL (invalidate בשמירת סשן); pre-compute aggregates בזמן שמירה; queries לפי date range דרך IDB index.
- **DoD:** מעבר טאב ב-Progress לא שולף+מחשב מחדש הכול.

### P-6 · `Settings`/`Nutrition` מונוליטיים — Medium
- **מיקום:** `Settings.tsx` (68KB), `Nutrition.tsx` (56KB) — lazy ברמת route (טוב) אך קומפוננטה אחת; כל הקלדה מרנדרת את כל העץ.
- **תיקון:** חלק לתת-קומפוננטות עם state מקומי + `React.memo`; lazy לתת-פיצ'רים כבדים (export/CSV, TDEE).
- **DoD:** הקלדה בשדה אחד לא מרנדרת אזורים אחרים.
- **תיאום:** 06-Arch הבעלים של פירוק הקבצים האלה (F8). תאמו — אתה ל-memo/re-render, הם למבנה.

### P-7 · web-vitals no-op בפרודקשן — Medium
- **מיקום:** `src/services/webVitals.ts` — `logMetric` רק `console.log` תחת `if (import.meta.env.DEV)`; בפרודקשן הספרייה (~5KB) נטענת לחינם.
- **תיקון:** שלח מדדים ל-Sentry בפרודקשן (`@sentry/react` מותקן), או ייבא web-vitals רק ב-DEV.
- **DoD:** מדדים מגיעים ל-Sentry בפרודקשן.
- **תיאום:** משותף עם 07-Testing (D). אתה הבעלים.

### P-8 · `AnimatePresence mode="wait"` — Medium
- **מיקום:** `src/App.tsx` `AppShell` — `mode="wait"` → exit מלא (320ms) לפני enter; עם Suspense fallback = 640ms+ נתפס; `key={location.pathname}` מפרק וממנף מחדש את כל עץ ה-route.
- **תיקון:** `mode="sync"` או הסר מעבר route; crossfade קצר (150ms); ברירת מחדל reduced-motion למובייל.
- **DoD:** ניווט מיידי/כמעט-מיידי; אין איבוד state מיותר.
- **תיאום:** 02-Motion/M-8 שוקל View Transitions API. תאמו גישה למעברי route.

### P-9 · framer-motion 10 מלא — Medium
- **מיקום:** `package.json` `framer-motion@^10`; `motion` ב-12+ קבצים; tree-shake חלש.
- **תיקון:** שדרג ל-11 + `LazyMotion`/`domAnimation` (חוסך ~30%); החלף אנימציות פשוטות (opacity/translateY) ב-CSS + `@starting-style`.
- **DoD:** chunk framer קטן יותר; אנימציות פשוטות ללא JS.
- **תיאום:** **02-Motion עובד על אותם רכיבים. תאם שדרוג framer לפני refactor תנועה.**

### P-10 · `initOfflineSync` כפול — Low
- **מיקום:** `main.tsx` + `App.tsx`. idempotent (guard) אך מושך את המודול ל-App chunk.
- **תיקון:** הסר מ-`App.tsx`; השאר ב-`main.tsx`.
- **DoD:** קריאה אחת.
- **תיאום:** משותף עם 06-Arch (F13). תאמו מי מסיר.

### P-11 · lucide icons chunk — Low
- **מיקום:** 69 import sites; ~80+ אייקונים. tree-shake תקין ב-Vite אך ה-chunk אולי גדול.
- **תיקון:** ביקורת שימוש; `dynamicIconImports` לאייקונים ב-overlays עצלים. עדיפות נמוכה.
- **DoD:** chunk icons מינימלי.

### P-12 · persist יקר ב-`WorkoutProvider` — Low
- **מיקום:** `WorkoutProvider.tsx` — `JSON.stringify(state)` (debounce 500ms) + interval 30s; state 20–50KB → 1–3ms חסימת main thread + GC.
- **תיקון:** persist רק על שינוי משמעותי (set/exercise), לא על כל toggle/tick; dirty flag; `requestIdleCallback`/Web Worker.
- **DoD:** persist רק כשהמצב באמת השתנה מהותית.

### P-13 · `DataContext` 100 sessions eager — Low
- **מיקום:** `DataContext.tsx` — `getWorkoutSessions(100)` ב-mount של ה-shell, לפני שהמשתמש רואה dashboard.
- **תיקון:** הקטן ל-10–20; טען עוד ב-mount של Progress; או `requestIdleCallback`/`startTransition`.
- **DoD:** mount ראשוני קל יותר.

---

## הזדמנויות שדרוג
- **React 19 + React Compiler** — auto-memoization, מבטל רוב ה-`useMemo`/`memo` הידני (פותר P-2/P-6).
- **Vite 6 + Rolldown** — build מהיר + chunking טוב יותר.
- **Incremental sync + Realtime** — מחליף full-table pulls (פותר P-1/P-4).
- **View Transitions API** למעברי route — אפס JS bundle.
- **Shared Worker** ל-IDB+sync — משחרר את ה-main thread (פותר P-5/P-12/P-13).
- **`motion` (standalone)** — חצי מגודל framer-motion.

## תיאום ונקודות חיכוך
- `supabaseSync.ts` (P-1, P-4) → **08-Data הבעלים. בצע אחריהם.**
- `webVitals.ts` (P-7) → שלך; 07 מאמת.
- `ActiveWorkoutNew`/`Settings`/`Nutrition` (P-2/P-6) → **06-Arch** מפרק מבנה; אתה ל-render. תאמו.
- framer + View Transitions → **02-Motion**.

## הגדרת סיום (תיק)
P-1 (fan-out) ו-P-3 (virtualization) נסגרו; re-render באימון (P-2) צומצם; `npm run verify && npm run test:run` ירוקים; מדידה לפני/אחרי (web-vitals/Lighthouse) מתועדת.
