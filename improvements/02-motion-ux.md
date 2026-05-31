# 02 — תנועה, מיקרו-אינטראקציות ומחוות · תיק עבודה לסוכן Motion

> **תפקידך:** מהנדס design-motion בכיר. מסגרת: סקיל `design-motion-principles`. הקשר המוצר = **אפליקציית מובייל** → משקלל **Jakub (ליטוש פרודקשן) ראשי, Emil (ריסון/מהירות) משני, Jhey (delight) סלקטיבי**.
> **שער התדירות (Frequency Gate):** אינטראקציות באימון פעיל הן בתדירות גבוהה (מאות ביום) → **מיידי / מינימלי**. חגיגות (PR) הן נדירות → delight מותר. מקלדת → לעולם לא להנפיש.

---

## ⚠️ עבודה במקביל (קרא תחילה)
הבעלים וסוכנים אחרים עורכים במקביל. אמת כל ממצא מול הקוד החי לפני עריכה; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.** בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| M-1 | לולאות framer אינסופיות מתעלמות מ-reduced-motion (JS, לא CSS) ×10 | High | M |
| M-2 | `SwipeComplete` drag לא RTL-aware (מחווה בכיוון הפוך לעברית) | High | M |
| M-3 | `useSwipeGesture` ללא מודעות RTL | Medium | S |
| M-4 | הנפשת layout props (`width/height/left`) במקום transform ×17 | Medium | M |
| M-5 | `AnimatedProgressRing` קונפטי עם `Math.random()` ב-render | Medium | S |
| M-6 | `SPRING_BOUNCY` over-animated לתפריט הקשר (3–4 נדנודים) | Medium | S |
| M-7 | אין stagger ברשימות → "uniform reflex" של AI | Medium | M |
| M-8 | View Transitions hook מוגדר אך לא בשימוש | Low | M |
| M-9 | `usePullToRefresh` — stale closure על `pullDistance` | Medium | S |
| M-10 | 4 הגדרות "spring" סותרות — אין מקור אמת לתחושת תנועה | Low | L |

> ⚠️ **חיכוך קריטי:** M-2 ו-M-3 נוגעים ב-`SwipeComplete.tsx`, ש-**06-Arch סימן כ-dead code (15KB, לא מיובא)**. **בדוק עם 06 לפני שתשקיע ב-RTL fix** — אם מוחקים, דלג על M-2. אם הבעלים רוצה להחזיר אותו לשימוש במקום `SlideToComplete`, אז תקן. אַל תתקן רכיב שעומד להימחק.

---

## ממצאים מפורטים

### M-1 · לולאות framer אינסופיות מתעלמות מ-reduced-motion — High
- **מיקום:** `LoadingSpinner.tsx` (רק זה בודק `useReducedMotion`), אבל **לא** בודקים: `IntensityMeter.tsx` (PulsingDot), `ProgressBar.tsx` (shimmer+glow), `AnalyticsDashboard.tsx`, `PerformanceAnalytics.tsx` (LIVE dot), `WorkoutHistoryScreen.tsx`, `ui/OverlayLoader.tsx`, `SmoothLoader.tsx` (InlineLoader), `PullToRefresh.tsx`. כולם `repeat: Number.POSITIVE_INFINITY`. CSS media query לא מכסה אנימציות JS של framer.
- **תיקון:** הדרך הנקייה ביותר — **05-A11y מוסיף `<MotionConfig reducedMotion="user">` ב-`App.tsx`** שמכסה את כל ה-`motion.*`. עבור לולאות שצריכות fallback מותאם (ספינר→סטטי), השאר בדיקת `useReducedMotion()` מקומית. צור util `safeRepeat(reduce) => reduce ? 0 : Infinity`.
- **DoD:** עם `prefers-reduced-motion: reduce` — אין לולאות סיבוב/פעימה אינסופיות.
- **תיאום:** תלוי ב-**05-A11y** (`MotionConfig`). תאם סדר: 05 קודם.

### M-2 · `SwipeComplete` drag לא RTL-aware — High *(ראה אזהרת dead-code)*
- **מיקום:** `SwipeComplete.tsx` — `handleDragEnd` בודק `info.offset.x > THRESHOLD` (חיובי=ימינה, הפוך ל-RTL); `dragConstraints={{left:0,right:maxDrag}}`; handle ב-`left-[6px]`; חץ →. `SlideToComplete.tsx` עושה נכון (`sign = isRTL ? -1 : 1`).
- **תיקון:** חקה את `SlideToComplete`: ב-RTL `dragConstraints={{left:-maxDrag,right:0}}`, בדיקה `offset.x * sign > THRESHOLD`, מיקום `[isRTL?'right':'left']:'6px'`, הפוך כיוון חץ. גם כפתור undo `right-3`→`end-3`.
- **DoD:** משתמש עברית משלים סט במחווה בכיוון הטבעי.

### M-3 · `useSwipeGesture` ללא RTL — Medium
- **מיקום:** `src/hooks/useSwipeGesture.tsx` — `onSwipeLeft/Right` לפי `deltaX` גולמי; `SwipeableItem` מקבע צדדים. `useSwipeNavigation.ts` כן בודק `document.dir==='rtl'`.
- **תיקון:** הוסף `rtlAware?: boolean` (ברירת מחדל true) — ב-RTL החלף משמעות left/right; הפוך צדדי actions ב-`SwipeableItem`.
- **DoD:** מחוות ניווט תקינות סמנטית בעברית.

### M-4 · הנפשת layout props — Medium
- **מיקום:** `Nutrition.tsx` (`animate={{width}}`), `PerformanceAnalytics.tsx`, `ProgressBar.tsx`, `SettingsPrimitives.tsx` (`animate={{left}}`), `SwipeComplete.tsx` (undo `width`), `WeightTab.tsx`/`AnalyticsDashboard.tsx` (`height`). reflow בכל frame → jank במובייל באימון.
- **תיקון:** progress → `scaleX` + `transformOrigin` (`right center` ל-RTL); toggle → `translateX`; height → `scaleY` היכן שאפשר. (SwipeComplete כבר משתמש ב-`scaleX` ל-fill — טוב; רק ה-undo countdown צריך תיקון.)
- **DoD:** סרגלי התקדמות חמים על transform בלבד; אין reflow.

### M-5 · קונפטי עם `Math.random()` ב-render — Medium
- **מיקום:** `AnimatedProgressRing.tsx` — `ConfettiParticle` קורא `Math.random()` בגוף הקומפוננטה. `PRCelebration.tsx`/`SwipeComplete.tsx` עושים נכון (config מחושב מראש).
- **תיקון:** חשב configs ב-`useMemo`/מחוץ לקומפוננטה; העבר ערכים דטרמיניסטיים כ-props.
- **DoD:** קונפטי יציב גם ב-re-render / StrictMode.

### M-6 · `SPRING_BOUNCY` over-animated לתפריט — Medium
- **מיקום:** `presets.ts` `{stiffness:400, damping:10}` ב-`LongPressMenu.tsx`. iOS context menus = critically-damped. נדנוד מעכב אינטראקטיביות נתפסת.
- **תיקון (Jakub):** השתמש ב-`snappy` (`{stiffness:300,damping:30}`) או צור `crisp` (`{stiffness:400,damping:28}`). שמור bounce לחגיגות בלבד.
- **DoD:** התפריט מרגיש מדויק ומיידי.

### M-7 · אין stagger → "uniform reflex" — Medium
- **מיקום:** רק 4 קבצים משתמשים ב-`staggerChildren` (LongPressMenu, PreWorkoutScreen, login, Templates). Dashboard/Progress/AnalyticsDashboard/WorkoutHistory — הכל קופץ בבת אחת.
- **תיקון:** הוסף stagger variants למיכלי רשימה (תבנית `login/animations.ts`). 40–60ms ל-3–6 פריטים, 30ms ל-7+. כל reveal יתאים לתוכן (לא reflex אחיד) — Jakub.
- **DoD:** רשימות מרכזיות נכנסות ב-stagger מדורג, לא בבת אחת.

### M-8 · View Transitions hook לא בשימוש — Low
- **מיקום:** `src/hooks/useViewTransition.ts` (מימוש מלא עם RTL + shared element) — אף קומפוננטה לא מייבאת. `global.css` מכיל חלק מה-styles → אינטגרציה חלקית שלא הושלמה.
- **תיקון:** חבר ל-ניווט הראשי (bottom nav, back). הוסף `view-transition-name` לכרטיסי hero ל-shared-element בין list↔detail.
- **DoD:** מעברי עמוד חלקים בעלי המשכיות מרחבית.
- **תיאום:** 04-Perf שוקל View Transitions במקום framer למעברי route. תאם גישה.

### M-9 · `usePullToRefresh` stale closure — Medium
- **מיקום:** `usePullToRefresh.ts` `handleTouchEnd` — `useCallback` עם תלות `pullDistance` → נבנה מחדש בכל frame של touch move (GC pressure).
- **תיקון:** השתמש ב-`pullDistanceRef.current` לבדיקת הסף; הסר `pullDistance` מ-deps; השאר state ל-render בלבד.
- **DoD:** אין יצירת callback מחדש בכל frame.

### M-10 · 4 הגדרות spring סותרות — Low
- **מיקום:** `utils/animations.ts` (`cubic-bezier(.175,.885,.32,1.275)`), `tokens.css` (`--ease-spring: cubic-bezier(.34,1.56,.64,1)`), `presets.ts` (`{400,10}`), `login/animations.ts` (`[.16,1,.3,1]`).
- **תיקון:** אחֵד ל-3 עקומות סמנטיות: `ease-out-expo [.16,1,.3,1]` (מעברים/reveal), `spring-settle {300,30}` (פידבק), `spring-playful {400,20}` (חגיגות בלבד). הוצא משימוש את עקומות ה-overshoot הישנות.
- **DoD:** מקור אמת אחד לתנועה; אופי עקבי.

---

## הזדמנויות שדרוג
- **Scroll-driven animations** (`animation-timeline: scroll()`) ל-headers/progress — אפס JS, רץ על ה-compositor.
- **`useScroll`+`useTransform`** לקריסת header חלקה.
- **`layoutId`** ל-shared layout בין רשימת תרגילים↔תרגיל פעיל (המשכיות מרחבית).
- **סנכרון haptics לקיפול אנימציה** (`onUpdate`/`onAnimationComplete`) — tick בדיוק ב-100%.
- **spring לפי velocity** — העבר `info.velocity.x` מ-`onDragEnd` ל-`velocity` של ה-spring.

## תיאום ונקודות חיכוך
- `<MotionConfig>` ב-`App.tsx` → **05-A11y** הבעלים; M-1 תלוי בו.
- `SwipeComplete.tsx` → **06-Arch** עשוי למחוק. בדוק לפני M-2.
- `motion.css`/`presets.ts`/`animations.ts` → שלך. צבעים ו-tokens של עיצוב → **01-Design**.
- View Transitions → תאם עם **04-Perf** (M-8).

## הגדרת סיום (תיק)
reduced-motion מכוסה לכל לולאות framer; מחוות תקינות RTL (או SwipeComplete נמחק בתיאום); אין הנפשת layout-props בנתיבים חמים; אחידות easing; `npm run verify && npm run test:run` ירוקים.
