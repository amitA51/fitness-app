# בדיקת ביצועים ורינדורים מקצה לקצה — SparkOS

**תאריך:** 2026-07-28 · **סוג:** מדידה חיה בדפדפן (Playwright + Chrome DevTools Protocol) על build production טרי, בתוספת ניתוח קוד.

## מתודולוגיה — מה נמדד ואיך

- **סביבה:** `vite build` טרי → `vite preview` על `localhost:4173`. אמולציית Pixel 5 (393×851, mobile UA), `he-IL`, `Asia/Jerusalem`, האטת CPU ×4 דרך CDP (`Emulation.setCPUThrottlingRate`) — פרוקסי סביר לאנדרואיד בינוני.
- **משתמש:** guest מאותחל (`skip_auth`, `onboarding_completed`, `user_profile`) שנזרע ב־`addInitScript` **לפני** הטעינה הראשונה, כדי שמדדי הטעינה הקרה יהיו אמיתיים ולא cache חם.
- **מדדי טעינה:** `PerformanceObserver` ל־`largest-contentful-paint`, `layout-shift`, `longtask`, `event` (`durationThreshold: 16`), plus Navigation/Paint Timing. תעבורת רשת נמדדה ב־`Network.loadingFinished.encodedDataLength` דרך CDP (resource timing מדווח 0 על cache).
- **מדידת רינדורים:** הוזרק shim של `__REACT_DEVTOOLS_GLOBAL_HOOK__` לפני עליית React, וב־`onCommitFiberRoot` נסרק עץ ה־fiber. רכיב נחשב "רונדר" רק אם `flags & PerformedWork` **וגם** `actualStartTime` שלו מאוחר מה־commit הקודם — בלי הסינון השני מתקבלות ספירות מנופחות מ־fibers בתתי־עץ שלא נגעו בהם ושומרים flags ישנים. מקור העדכון זוהה דרך `root.memoizedUpdaters` (אותו מנגנון שבו DevTools עונה "מה גרם ל־render").
- **מגבלות:** שמות רכיבים קריאים רק מול dev server (ב־production הם minified, ואין profiler timings) — לכן ספירת ה־commits נלקחה מ־production, וספירת הרכיבים ל־commit ושמותיהם מ־dev. מדידה אחת לכל תרחיש, לא ממוצע של הרצות; פערי FCP של ±100ms בין הרצות הם רעש.
- **סקריפט לשחזור:** `node scripts/perf-audit.mjs` (production) ו־`node scripts/perf-audit.mjs --dev --port 5199` (שמות רכיבים). פלט גולמי: `reports/perf-e2e-prod.json`, `reports/perf-e2e-dev.json`.

## תוצאות — טעינה קרה לכל מסלול (production, Pixel 5, CPU ×4)

| מסלול | FCP | LCP | CLS | JS על החוט | בקשות | DOM nodes | Long tasks | חסימת main thread |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | 424ms | 424ms | 0 | 326 kB | 40 | 209 | 5 | 447ms (מקס' 155) |
| `/workout` | 372ms | 372ms | 0 | 362 kB | 41 | 130 | 6 | 456ms (137) |
| `/progress` | 384ms | 384ms | 0 | 350 kB | 43 | 216 | 5 | 431ms (167) |
| `/nutrition` | 388ms | **1220ms** | **0.0577** | 333 kB | 43 | 401 | 6–7 | 563–622ms (166) |
| `/templates` | 368ms | 368ms | 0 | 268 kB | 21 | 169 | 4 | 357ms (153) |
| `/program` | 392ms | 392ms | 0 | 278 kB | 24 | 279 | 5 | 438ms (151) |
| `/settings` | 384ms | 384ms | 0 | 291 kB | 32 | **750** | 5 | 497ms (168) |

ניווט פנימי (SPA, ללא reload): 4–8 commits למסלול, 0–146ms long tasks. אימון פעיל מגיע ל־**414 kB JS**, 189 DOM nodes, 10MB heap.

## תוצאות — רינדורים במסך האימון

| תרחיש | commits | רכיבים שרונדרו לכל commit | מקור העדכון (React updater tracking) |
|---|---:|---:|---|
| מסך רישום סט, **ללא נגיעה**, 5 שניות | 5 (1/שנייה) | **1** | `Memo(MonoTimer)` |
| טיימר מנוחה רץ, **ללא נגיעה**, 5 שניות | **54–55 (10.8/שנייה)** | **1** | `Memo(InlineRestTimer)` |
| נגיעה אחת ב־`+` של המשקל | **2–3** | **19–28** (סה"כ ~48–57) | `WorkoutProvider` |
| הקלדה בחיפוש תרגילים (4 תווים) | 4 | 15 | `ExerciseFilter` |

זמן תגובה לאינטראקציה (Event Timing, production, CPU ×4): `click` **224–240ms**, `input` בחיפוש **112–128ms** עם long task של **107ms**.

בורר התרגילים מרנדר **90 כרטיסים בבת אחת → 2402 DOM nodes**, כל כרטיס `m.div` של framer עם `whileTap`.

## הממצאים — מדורג

### 1. טיימר המנוחה מבצע 10 commits בשנייה בשביל תצוגה של שניות שלמות (P1, תיקון קטן)

`useRestTimer` קורא `setTimeLeft(left)` כל **100ms** (`src/components/workout/hooks/useWorkoutTimer.ts:215-237`) עם ערך float, אבל התצוגה היא `formatTime(Math.ceil(timeLeft))` (`useWorkoutTimer.ts:246`) — כלומר משתנה פעם בשנייה. הצרכן היחיד הוא `InlineRestTimer` (`src/components/workout/components/InlineRestTimer.tsx:84-89`), רכיב של 521 שורות עם עץ inline-styles גדול, שמתרנדר מחדש 10 פעמים בשנייה בזמן שהמשתמש לא נוגע במסך. נמדד: 54 commits ב־5 שניות ב־production.

מה שכן עובד: הבידוד עצמי תקין — רק רכיב אחד מתרנדר לכל tick, לא כל העץ (בניגוד למה שהערת ה־"PERFORMANCE FIX" ב־`useWorkoutTimer.ts:30-33` נועדה למנוע, והיא אכן מחזיקה).

**תיקון:** לפצל את ה־state — `seconds` שלם שמתעדכן ב־1Hz עבור הטקסט, ואת ה־progress של הטבעת להזיז ל־`ref` שנכתב ב־`requestAnimationFrame` או ל־CSS animation עם `animation-duration` = משך המנוחה (הטבעת ממילא לינארית). לחלופין, מינימלי: `setTimeLeft` רק כשה־`Math.ceil` משתנה, ולשמור את הערך המדויק ב־ref. הפחתה צפויה: ~90% מה־commits בזמן מנוחה. קבצים: `useWorkoutTimer.ts:196-247`, `InlineRestTimer.tsx:84-120`.

### 2. חמישה bottom sheets סגורים מתרנדרים בכל שינוי state של האימון (P1, תיקון קטן)

`ExerciseDisplay` מרנדר את `WorkoutToolsSheet`, `SetEditBottomSheet`, `RPEPicker`, `DropSetSheet`, `AlternativesSheet` **תמיד**, ומעביר `isOpen` (`src/components/workout/components/ExerciseDisplay.tsx:892-955`). כל אחד מהם עובר דרך `Sheet` (`src/components/ui/Sheet.tsx:40-52`) → `ModalOverlay`, שמריץ hooks (focus trap, `useEffect` על `isOpen`, motion value `sheetY`), מרנדר `AnimatePresence` ו־`createPortal` (`src/components/ui/ModalOverlay.tsx:122-380`) — גם כשסגור.

זה נמדד ישירות: בנגיעה אחת ב־`+`, בין הרכיבים שרונדרו יש `Sheet x5`, `ModalOverlay x5`, `AnimatePresence x6`, `Memo(WorkoutToolsSheet) x1` — כלומר בערך שליש עד מחצית מ־48–57 הרינדורים לנגיעה מגיעים ממשטחים שהמשתמש לא רואה.

**תיקון:** `{showToolsSheet && <WorkoutToolsSheet ... />}` וכן הלאה לחמשתם; מי שכולל תוכן כבד (`AlternativesSheet` עם ספריית תרגילים) גם `lazy()`. סיכון נמוך: אנימציית ה־exit מנוהלת ב־`AnimatePresence` שבתוך `ModalOverlay`, ולכן צריך לוודא שה־unmount לא חותך אנימציית סגירה — הפתרון המקובל הוא להשאיר mount עד סוף ה־exit (`onExitComplete`) ולא להשאיר mount לנצח.

### 3. נגיעה אחת = 2–3 commits של כל עץ האימון (P1, בדיקה + תיקון בינוני)

בכל אחת מחמש הנגיעות שנמדדו התקבלו 2–3 commits נפרדים, כשמקור העדכון הוא `WorkoutProvider` — כלומר כל commit מרנדר את `WorkoutContent` ואת כל הצאצאים (`src/components/workout/ActiveWorkoutNew.tsx:94-97, 669-860`). שתי בעיות נפרדות מצטברות כאן:

1. **מספר dispatch-ים רצופים לאותה פעולת משתמש** (עדכון הסט, ואז ניקוי `pendingHaptic`/סנכרון נגזרות) — צריך למזג לפעולה אחת בריducer או לאחד ל־`dispatch` בודד; כל dispatch נוסף = עוד סריקה של כל העץ.
2. **context אחד שמחזיק את כל ה־state.** `WorkoutStateContext` מחזיק את אובייקט ה־state כולו (`src/components/workout/core/WorkoutContext.tsx:13, 35-41`), ו"הסלקטורים" שנבנו מעליו (`useWorkoutOverlays`, `useWorkoutCelebration`, `useCurrentExercise`, `useRestTimer` — `WorkoutContext.tsx:81-181`) הם `useContext(WholeState)` + `useMemo`. חשוב להבין: `useMemo` מייצב את **הערך המוחזר**, אבל **לא מונע את הרינדור של הרכיב הצורך** — הרכיב מתרנדר בכל dispatch בכל מקרה. הצרכנים: `WorkoutContent` (`ActiveWorkoutNew.tsx:94-96`), `WorkoutAriaLive` (`src/components/workout/components/WorkoutAriaLive.tsx:21-22`), `WorkoutActions` (`src/components/workout/components/WorkoutActions.tsx:171-173`).

**תיקון ארכיטקטוני (M/L):** להחליף את ה־context בחנות עם `useSyncExternalStore` וסלקטורים אמיתיים (`subscribe(selector)`), כך שרכיב מתרנדר רק כשה־slice שלו השתנה. זהו אותו ממצא שדוח `05-PERF-PWA-RELIABILITY.md` סימן כ־P2 — עכשיו יש לו מספרים: ~50 רינדורי רכיב לכל הקשה על `+`, ו־224–240ms השהיית אינטראקציה במכשיר מואט.

### 4. בורר התרגילים: 90 כרטיסים ללא וירטואליזציה, וחיפוש ללא deferral (P1, תיקון קטן־בינוני)

`ExerciseList` ממפה את כל המערך ל־`ExerciseCard` בלי virtualizer (`src/components/workout/components/ExerciseList.tsx:41-53`) → 2402 DOM nodes בבורר, כשכל כרטיס הוא `m.div` של framer עם `whileTap` (`src/components/workout/components/ExerciseCard.tsx:71-92`). הסינון והמיון ממומואיזים נכון (`src/components/workout/ExerciseLibraryTab.tsx:161-196`), אבל ה־state של החיפוש מתעדכן סינכרונית בכל תו — אין `useDeferredValue`, `startTransition` או debounce באפליקציה כולה (חיפוש ב־`src/` מצא שימוש רק ב־`AppRouter.tsx`). נמדד: `input` של 112–128ms ו־long task של 107ms על הקלדה.

**תיקון:** `const deferredQuery = useDeferredValue(searchQuery)` והזנתו לסינון, plus `@tanstack/react-virtual` — התלות כבר בפרויקט ובשימוש מוצלח ב־`src/components/workout/history/WorkoutHistory.tsx:19,650` (threshold של 20 פריטים). זה מוריד גם את זמן פתיחת הבורר וגם את השהיית ההקלדה.

### 5. `/nutrition`: CLS 0.0577 ו־LCP 1220ms — קריסת skeleton (P2, תיקון קטן)

ייחוס ישיר מ־`LayoutShift.sources`: ב־1349ms הכרטיס "מים היום" זז מ־`y:578` ל־`y:0`, ובמקביל שורת הטאבים "יומן/מזון/ארוחות" מ־`y:716` ל־`y:0`. כלומר תוכן שמעליהם נעלם — ה־skeleton (`SkeletonBox height={150}` + 3×`height={96}` ב־`src/pages/Nutrition.tsx:124-133`) גבוה מהתוכן האמיתי שמחליף אותו, וכל העמוד נקפץ מעלה. `/settings` באותה מדידה: CLS 0.

בנוסף, אלמנט ה־LCP הוא אותו כרטיס, וה־resource שלו הוא **data-URL של SVG עם פילטר** (`feTurbulence`/noise) — פילטר SVG הוא מהדברים היקרים לצייר על GPU של אנדרואיד בינוני, וכאן הוא בדיוק על ה־LCP.

**תיקון:** להתאים את גובה ה־skeleton לגובה התוכן (או `min-height` על המכל), ולהחליף את טקסטורת ה־noise ב־PNG/WebP קטן שמצויר פעם אחת או להסירה ממסלול ה־LCP.

### 6. חבילות וטעינה — פירוט מלא בדוח נפרד

ראו `reports/perf-findings-bundle-motion.md` (מבוסס אותן מדידות build). התמצית:

- `bbtProgram.generated` (218 kB) נגיש דרך `ProgramCard` שמפעיל `refresh()` ב־mount של ה־Dashboard, וגם דרך `useWorkoutSave` ו־`supabaseSyncOrchestrator` — כלומר מי שלא נגע בתוכנית המובנית מוריד אותה בכל זאת. הפיצול הנדרש: `programProgressService` / `bbtProgramMetadata` / `programCatalogService`.
- `gsap` (72 kB) נטען ב־Dashboard דרך ארבעה מסלולי import סטטיים (`ActivityRings`, `WorkoutStreak`, `CoachBriefCard`, `useCountUp`) — כולם ניתנים למימוש ב־framer (שכבר נטען) או ב־CSS.
- precache של 2533 KiB (139 entries, 110 מהם JS) בגלל glob של `**/*.js` — צריך allowlist ל־app shell + runtime cache ל־chunks של מסלולים.
- `LazyMotion domMax` **מוצדק** כרגע (drag/reorder/layout בשימוש אמיתי); המעבר ל־`domAnimation` שווה ~12 kB בלבד ורק אחרי בידוד ה־drag לאיים — לא 146 kB.
- `transition: all` בשבעה מקומות, אנימציות `width`/`height: auto`, `will-change` קבוע ב־`.magnetic-card`, וערימת `backdrop-filter: blur(20px)` על גבי sheets — כל אלה עלות layout/paint ישירה במכשיר בינוני.

### 7. `/settings` עם 750 DOM nodes (P2)

ה־DOM הגדול ביותר באפליקציה, בעמוד שרוב הזמן גלול לחלק העליון. שווה פיצול לפי section (accordion/route) או `content-visibility: auto` על סקציות מתחת לקיפול.

## מה כבר טוב — ואל תשבור

- **בידוד הטיימרים עובד**: `MonoTimer` מרנדר רכיב אחד בשנייה, לא את העץ (`useWorkoutTimer.ts:30-33` מתאר בדיוק את ה־regression שנמנע, והמדידה מאשרת).
- **פיצול מסלולים**: FCP של 368–484ms על CPU מואט ×4, ו־CLS 0 בשישה מתוך שבעה מסלולים.
- **וירטואליזציה קיימת** בהיסטוריית אימונים (`WorkoutHistory.tsx:19,650`) — התשתית קיימת, צריך להחיל אותה גם על בורר התרגילים.
- **`builtInExercises` נטען דינמית** (`src/services/exerciseDb.ts:34`) — chunk נפרד של 25 kB.
- **Sentry נטען lazily** אחרי הסכמה בלבד (`src/lib/sentryLazy.ts`), ולא נכנס ל־entry bundle.
- אפס `pageerror` בכל שבעת המסלולים במהלך המדידה.

## סדר עבודה מוצע

1. טיימר מנוחה ל־1Hz + טבעת ב־rAF/CSS (S, סיכון נמוך, ~-90% commits במנוחה).
2. mount מותנה לחמשת ה־sheets (S, סיכון נמוך, ~-40% רינדורים לנגיעה).
3. `useDeferredValue` + virtualizer בבורר התרגילים (S/M, סיכון נמוך, השהיית הקלדה ו־2402 nodes).
4. skeleton בגובה התוכן ב־`/nutrition` + הוצאת ה־SVG filter ממסלול ה־LCP (S).
5. איחוד ה־dispatch-ים לנגיעה אחת (M) — ואז מדידה חוזרת לפני שמחליטים על 6.
6. מעבר ל־store עם סלקטורים (`useSyncExternalStore`) במקום context של כל ה־state (L, סיכון בינוני).
7. פיצול `programService` ו־gsap מה־Dashboard, וצמצום ה־precache (מ־`reports/perf-findings-bundle-motion.md`).

לאימות: `node scripts/perf-audit.mjs` לפני ואחרי כל שלב, והשוואה מול המספרים בטבלאות שלמעלה.
