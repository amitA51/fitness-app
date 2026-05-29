# 04 — Hooks, Utils, Contexts, Constants, Types, Errors, Data, Config

לא נמצא שימוש ב-`any` בקבצים שנסקרו (כלל #1 בתקנים מוחזק). הנושא החוזר החזק ביותר: **מקורות אמת כפולים** וטיפוסי "grab-bag" אופציונליים מדי.

---

## CONFIG

### `vite.config.ts`
- **[High] Bug — `visualizer` בשימוש בלי import** (~L71). `visualizer({...})` תחת `VITE_ENABLE_BUNDLE_ANALYZER === 'true'` אבל אין `import { visualizer } from 'rollup-plugin-visualizer'`. ה-`&&` עושה short-circuit כשהדגל כבוי, אבל הפעלת ה-analyzer זורקת `ReferenceError`.
  - **תיקון:** להוסיף את ה-import בראש הקובץ.
- **[Low] Code Quality** — `import path from 'path'` → להשתמש ב-`node:path` לעקביות עם `vitest.config.ts`.
- **[Low] Code Quality** — `drop_console: true` בprod מסיר console; Sentry עדיין מקבל אירוע. כדאי הערה שמסבירה את ההסתמכות על Sentry.

### `vitest.config.ts`
- **[Low] Code Quality** — ספי coverage ~6% (floor של regression / חוב טכני). לא באג; מצוין כדי שלא ייחשב לכיסוי אמיתי.

### `tsconfig.json` / `tsconfig.node.json`
- מצב strict, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` — מצוין. אין בעיות.

### `biome.json`
- **[Low] Code Quality** — `noExplicitAny: "warn"` בעוד התקן אומר "לעולם לא any"; warn מאפשר ל-`any` לחמוק ב-CI. להעלות ל-`"error"` כשהקוד נקי.

### `tailwind.config.js`
- **[Medium] Code Quality** — שתי סקאלות z-index חופפות (Tailwind + `-legacy`) משוכפלות מ-`src/constants/zIndex.ts` עם ערכים שונים לגמרי (Tailwind `modal: 90` מול constants `modal: 1100`). שני מקורות אמת לסדר stacking.
  - **תיקון:** לבחור מקור אחד ולגזור ממנו את השני.

### `index.html` / `netlify.toml` / `postcss.config.js`
- **[Low]** — `theme-color` ב-`index.html` (`#F2F4EC`) ≠ `theme_color` ב-manifest (`#EEF3F1`). חוסר עקביות ויזואלי קל.
- netlify.toml: CSP וכותרות אבטחה חזקות. `style-src 'unsafe-inline'` נדרש בגלל inline styles רבים; קביל.

---

## HOOKS

### `src/hooks/useFocusTrap.ts`
- **[High] Bug — קריאות hooks מותנות לפי טיפוס ארגומנט** (~L30-90). מסתעף על `typeof refOrActive === 'boolean'` וקורא `useRef`/`useEffect` בתוך כל ענף — הפרת Rules of Hooks.
  - **תיקון:** לפצל לשני hooks נפרדים (`useFocusTrapRef(isActive)` ו-`useFocusTrap(ref, options)`).
- **[Medium] Code Quality** — `closeOnClickOutside` קוד מת (~L110): מפורק ונמצא ב-deps אבל אין listener.
- **[Low] Bug** — `autoFocus` `setTimeout(…, 50)` לא מנוקה ב-cleanup (~L165).
- **[Low] Accessibility** — selector של focusable משמיט `audio[controls]`, `video[controls]`, `details`, `iframe`.

### `src/hooks/useCelebration.ts`
- **[Medium] Bug — `triggerConfetti` מיתם timer קודם** (~L48). קריאה פעמיים תוך 4 שניות דורסת את `timerRef.current` בלי לנקות; הטיימר הראשון עדיין יורה `setShowCelebration(false)`.
  - **תיקון:** `if (timerRef.current) clearTimeout(timerRef.current)` לפני הגדרת החדש.
- **[Medium] Bug — `celebrate()` קורא `navigator.vibrate` ישירות** (~L35), עוקף את gating ה-haptics. משתמש שכיבה haptics עדיין ירגיש רטט.
  - **תיקון:** לנתב דרך `utils/haptics`.
- **[Low] Code Quality** — `currentPR` state מת (`setCurrentPR` רק עם `null`).

### `src/hooks/useHaptics.ts`
- **[Low] Code Quality** — double-gating (~L80): `hapticsEnabled ?? soundEnabled` מבלבל שתי הגדרות.
- **[Low] Code Quality** — `LUXURY_HAPTIC_PATTERNS`/`HABIT_HAPTIC_PATTERNS` חופפים ל-`EFFECT_PATTERNS` ב-`utils/haptics`.

### `src/hooks/useMobileKeyboard.ts`
- **[Medium] Performance — עדכוני state בתדירות גבוהה ללא throttle** (~L70-95). listeners של `resize`/`scroll` קוראים `setState` בכל אירוע.
  - **תיקון:** throttle/rAF-batch ל-`updateKeyboardState`, או bail מוקדם כשהמצב לא השתנה.
- **[Medium] Bug (leak) — `preventInputZoom()` מוסיף listener `touchend` קבוע** שלא ניתן להסרה (~L210-225).
  - **תיקון:** להחזיר פונקציית cleanup שמסירה את ה-listener.
- **[Low] Performance** — effect של focus/blur נרשם מחדש כש-`onFocus`/`onBlur` משתנים.

### `src/hooks/usePullToRefresh.ts`
- **[Low] Performance** — `handleTouchEnd` משתנה בכל touchmove (תלוי ב-`pullDistance`). לעקוב במ-ref.
- **[Low] Bug** — אין `preventDefault` במהלך ה-pull; overscroll נייטיב יכול להפריע.

### `src/hooks/useReducedMotion.ts`
- נקי. אין בעיות.

### `src/hooks/useSwipeGesture.tsx`
- **[Low] Code Quality** — hook ו-component (`SwipeableItem`) באותו קובץ עם `import` באמצע הקובץ (~L230).
- **[Low] Performance** — `setState` בכל move; לשקול rAF batching לרשימות ארוכות.

### `src/hooks/useViewTransition.ts`
- **[Medium] Bug — `isTransitioning` מוחזר כ-snapshot לא ריאקטיבי** (~L78). זו קריאת ref בזמן render, אז consumers לא ירנדרו מחדש כשהוא מתהפך.
  - **תיקון:** לגבות ב-`useState` אם נדרשת ריאקטיביות.

### `src/hooks/fitness/useFitnessInsights.ts`
- **[Medium] Bug — `selectedExerciseDelta` לא באמת ספציפי-לתרגיל** (~L150-156). gated ע"י `selectedExercise` אבל קורא `getWeekOverWeekProgress(sessions)` שלא מקבל ארגומנט תרגיל.
  - **תיקון:** להעביר `selectedExercise` לפונקציה per-exercise, או לשנות שם השדה.
- **[Low] Code Quality** — `window.addEventListener('WORKOUT_COMPLETED', ...)` מסתמך על מחרוזת קסם.

---

## UTILS

### `src/utils/animations.ts`
- **[Low] Code Quality (DRY)** — קבועי duration כפולים: `ANIMATIONS.duration` ו-`DURATION` זהים.

### `src/utils/audio.ts`
- **[High] Bug (resource leak) — `AudioContext` חדש בכל `playBeep` ולא נסגר** (~L6-12). דפדפנים מגבילים ~6 contexts; ביפים חוזרים יכשלו בשקט וידלפו.
  - **תיקון:** ליצור `AudioContext` יחיד ברמת המודול (lazy), לעשות בו שימוש חוזר, ו-`resume()` אם `suspended`.
- **[Medium] Bug — מדיניות autoplay לא מטופלת**. ללא `resume()` אחרי gesture, ביפים אולי לא ינוגנו.
- **[Low] Code Quality** — `catch (e) {}` ריק בולע שגיאות.

### `src/utils/dateUtils.ts`
- **[Low] Code Quality** — `MONO_STYLE` (אובייקט `React.CSSProperties`) חי ב-util של תאריכים (~L95-99). שייך ל-styles.
- **[Low] Bug (timezone edge)** — `formatHebrewDate`/`formatDateISO`/`fmtDate` מפרסרים `new Date('YYYY-MM-DD')` כ-UTC. סיכון נמוך בישראל (UTC+); `todayStr` כבר נכון מקומי.
- `getWeekNumber`/`getWeekStart` נכונים.

### `src/utils/errorReporting.ts`
- **[Medium] Code Quality — `handleError` כפול**. המודול הזה מייצא `handleError(error, context, fallback)` שמחזיר `{userMessage, error}`, בעוד `src/errors/index.ts` מייצא `handleError(error, context): void` שונה. שני שמות זהים, חוזים שונים.
  - **תיקון:** לאחד, או לשנות שם לאחד (`handleErrorWithMessage`).

### `src/utils/haptics.ts`
- מודול מרכזי מוצק. **[Low]** — `HAPTIC_PATTERNS` legacy חופף ל-`EFFECT_PATTERNS`.

### `src/utils/id.ts`
- **[Low] Code Quality** — מבוסס `Math.random` (מתועד לא-crypto). חוסר עקביות עם `createWorkoutSet` ב-`types/index.ts` שמשתמש ב-`crypto.randomUUID?.()`.

### `src/utils/logger.ts`
- **[Low] Code Quality — טרינרי מת ב-`formatMessage`** (~L46): שני הענפים זהים, `data` מתעלם.
- **[Low]** — `Sentry.captureException` בכל לוג ברמת `error`.

### `src/utils/plateCalculator.ts`
- נקי. אין בעיות.

### `src/utils/routePrefetch.ts`
- **[Low] Bug** — unhandled rejection על `loader()` (~L22). אם chunk נכשל. → `loader().catch(() => {})`.

### `src/utils/safeJson.ts`
- נקי, הגנתי, SSR-guarded.

### `src/utils/styles.ts`
- **[Low] Bug** — `getContrastColor` מניח `#rrggbb` תקין; 3-ספרות או חסר `#` → `NaN`.
- **[Low] DRY** — `formatNumber` (K/M) משכפל את `formatVolume` ב-dateUtils.

### `src/utils/tdee.ts`
- **[Medium] Bug — macros לא תואמים ליעד הקלוריות שנבחר** (~L95-120). `calories` עובר ל-`cut`/`bulk`, אבל `protein/carbs/fat` תמיד מה-maintenance. לחיטוב, הקלוריות = TDEE−500 אבל המאקרו עדיין מסתכם ל-~TDEE.
  - **תיקון:** לחשב מחדש macros מ-`calories` המותאם ליעד.
- **[Low] Code Quality** — `gender: 'other'` ממופה לקבוע הגברי (`s = +5`), לא מתועד.

### `src/utils/units.ts`
- **[Low] Bug (precision)** — round-tripping kg→lbs→kg לא בדיוק זהות. לשמור אחסון ביחידה קנונית אחת (kg).

### `src/utils/validation.ts`
- **[Medium] Code Quality — חוסר עקביות במגבלות**: `WORKOUT_LIMITS.weight.max = 999` כאן, אבל `workoutConstants.MAX_WEIGHT = 1000`; `reps.max = 999` מול `MAX_REPS = 100`.
  - **תיקון:** לגזור אחד מהשני או לאחד.
- **[Low]** — `sanitizeText` מסיר רק `<>`; לא תחליף ל-DOMPurify אם ערכים מגיעים ל-`dangerouslySetInnerHTML`.

### `src/utils/workoutMath.ts`
- מקור אמת יחיד מתועד היטב ל-volume/stats. אין בעיות.

---

## CONTEXTS

### `src/contexts/AuthContext.tsx`
- דפוס חזק: `isGuestRef` קורא את הדגל העדכני בלי re-subscribe; guard של `cancelled`; value memoized. לא נמצאו באגים.
- **[Low]** — `import('…/Toast')` דינמי בכל אירוע `session-expired` (module cache הופך את זה לזול).

### `src/contexts/DataContext.tsx`
- `initialLoadRef` מגן על double-invoke של StrictMode; value memoized. אין בעיות.

### `src/contexts/PageThemeContext.tsx`
- **[Low] Code Quality** — לא באמת React Context (אין provider value), רק wrapper עם side-effect ששמו `…Context`.

### `src/contexts/SettingsContext.tsx`
- **[Medium] Bug — `updateSettings` יכול לדרוס `workoutSettings`** (~L150). `setSettings(prev => mergeSettings({ ...prev, ...updates }))`. אם קורא מעביר `updateSettings({ workoutSettings: {...} })`, `mergeSettings` ממזג מול `DEFAULT_WORKOUT_SETTINGS` (לא `prev.workoutSettings`), ומאפס בשקט התאמות workout קודמות.
  - **תיקון:** ב-`updateSettings`, למזג `workoutSettings` מקונן מול `prev.workoutSettings`.
- טוב: updaters טהורים + effect פרסיסטנס נפרד, `hydratedRef` מדלג על persist ראשוני.

---

## OTHER

### `src/constants/*`
- **[Low] Code Quality** — `STORAGE_KEYS` לא שלם; האפליקציה שומרת תחת מפתחות ad-hoc (`user_profile`, `onboarding_data`, `appSettings`) ב-`App.tsx`/`SettingsContext`.
- **[Medium] Code Quality** — `workoutConstants` muscle groups משתמשים ב-`ARMS` בעוד קבצי data משתמשים ב-`Biceps`/`Triceps`.
- **[Medium] Code Quality** — סקאלת `zIndex.ts` מתנגשת עם סקאלת ה-z של Tailwind.

### `src/errors/index.ts`
- היררכיית error מותאמת נקייה. שם `handleError` כפול (ראה errorReporting).

### `src/errors/PageErrorBoundary.tsx` & `RootErrorBoundary.tsx`
- מימוש class-boundary נכון; `role="alert"`, reset + reload, Sentry guarded. טוב.
- **[Low]** — שני ה-boundaries משכפלים markup רב (אחד Tailwind, אחד inline). קביל כי Root לא יכול לסמוך על CSS שאולי נכשל.

### `src/data/builtInExercises.ts`
- **[Medium] Bug/Code Quality — אי-התאמת טקסונומיית `muscleGroup`** — שימוש ב-`'Biceps'`/`'Triceps'`/`'Cardio'`/`'Core'` שלא תואם ל-`MUSCLE_GROUPS` (`ARMS`).
- **[Low] Performance** — 1100+ שורות data מיובאות eagerly; לשקול lazy-load כשה-picker נפתח.
- **[Low] Code Quality** — שם export `getBUILT_IN_EXERCISES` מערבב camelCase + SCREAMING_SNAKE.

### `src/data/builtInWorkoutTemplates.ts`
- **[Medium] Bug — `exerciseId` מוגדר לשם התצוגה** (~L300). שימוש בשם locale כמפתח זהות שביר (rename/locale שובר references/PR matching).
  - **תיקון:** להקצות slug ids יציבים.
- **[Low]** — `muscleGroup` באנגלית בעוד `muscleGroups` ברמת ה-template בעברית.

### `src/types/index.ts`
- **[Medium] Code Quality — ממשקי grab-bag עם אופציונליות כבדה** — `Exercise` נושא ~25 שדות אופציונליים; `PersonalItem` ממראה רבים מהם. הקומפיילר לא יכול לתפוס שדות חובה חסרים.
  - **תיקון:** לפצל לטיפוסים ממוקדים (`LibraryExercise`, `TemplateExercise`, `ActiveSetExercise`).
- **[Medium]** — aliases כפולים (`name`/`exerciseName`, `muscleGroup`/`targetMuscle`) דורשים מכל consumer לנחש.
- **[Low]** — `ProgramExtras` עם index signature `[key: string]: unknown`.

### `src/App.tsx`
- **[Medium] Bug — `SettingsProvider`/`DataProvider` עוטפים רק את העץ המאומת+onboarded** (~L210-245). `Login` ו-`OnboardingFlow` מרונדרים מחוץ להם — כרגע לא קורסים, אבל (א) latent crash אם ישתמשו ב-hooks, ו(ב) effect ה-SettingsContext שמחיל `dark`/`high-contrast`/`large-text` לא רץ במסכים אלה.
  - **תיקון:** להרים את `SettingsProvider` מעל ענף ה-auth/onboarding.
- **[Low] Code Quality (DRY)** — `saveOnboardingData` וה-effect משכפלים `localStorage.setItem`.

### `src/main.tsx`
- **[Medium] UX — `requestNotificationPermission()` נקרא בטעינת האפליקציה** (~L55-65). בקשת הרשאת Notification ב-first paint (לא מ-gesture) היא UX גרוע ופוגעת ב-grant rates.
  - **תיקון:** להפעיל מ-action מפורש (הפעלת תזכורות ב-Settings).
- **[Low] Performance** — `initAI()` רץ eagerly בהפעלה.

---

## סיכום פריטים בעדיפות גבוהה
1. **[High] vite.config.ts** — `visualizer` בלי import (שובר build כשהדגל פעיל).
2. **[High] utils/audio.ts** — `AudioContext` חדש לכל ביפ, לא נסגר; ידלוף.
3. **[High] hooks/useFocusTrap.ts** — קריאות hooks מותנות מפרות Rules of Hooks.
4. **[Medium] utils/tdee.ts** — macros לא תואמים לקלוריות המותאמות ליעד.
5. **[Medium] hooks/useFitnessInsights.ts** — `selectedExerciseDelta` מתעלם מהתרגיל הנבחר.
6. **[Medium] contexts/SettingsContext.tsx** — `updateSettings` יכול לאפס `workoutSettings`.
7. **[Medium] App.tsx** — Providers לא עוטפים Login/Onboarding.
8. **כפילויות מקור אמת** — z-index, מגבלות משקל/חזרות, טקסונומיית שרירים, `handleError`, קבועי duration.
