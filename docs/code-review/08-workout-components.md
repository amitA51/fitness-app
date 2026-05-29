# 08 — קומפוננטות Workout, Fitness, Nutrition

קבצים שנסקרו: כל `workout/components/*` (כולל `components/ui/*`), קומפוננטות `workout/*` ברמה העליונה, `workout/common/IconMap`, `fitness/WorkoutComparison`, `nutrition/WaterTracker`

> מימושים נקיים לדוגמה: `WorkoutAriaLive` (דפוס SR נכון — throttled, ref-based, polite region יחיד), `ExerciseCard`/`ExerciseForm` (style constants מחוץ ל-render). `icons.tsx` ו-`common/IconMap.tsx` נקיים.

---

## באג חוצה-קבצים מרכזי (High)

### סימון סט שהושלם לא עקבי
- **קבצים:** `core/workoutReducer.ts` (COMPLETE_SET), `useWorkoutSave.ts`, `analyticsService.ts`, `ForecastChart.tsx`, `fitness/WorkoutComparison.tsx`
- **תיאור:** `COMPLETE_SET` (workoutReducer ~L263) מציב רק `currentSet.completedAt` (אף פעם לא `isCompleted=true`); סטים נוצרים עם `isCompleted: false` ושום דבר לא הופך את זה. `useWorkoutSave` מסנן תרגילים לפי `completedAt` אבל **לא מנרמל** את הסטים — הוא שומר את אובייקטי הסט כמו שהם (ה-`isCompleted: true` שם הוא על מעטפת ה-`WorkoutExercise`, לא על ה-`WorkoutSet`), ו-`saveWorkoutSession` עושה `dbPut` ללא טרנספורמציה. לכן הסטים שנשמרים נושאים `isCompleted === false`, ו-`analyticsService` (set-level filter על `set.isCompleted`), `WorkoutDetail`, `Progress`, `Dashboard` ו-`exportService` מחשבים **0** ל-sessions אמיתיים.
  - **ניואנס חשוב (מאומת):** בזמן האימון החי הסטטיסטיקות מוצגות נכון כי הן משתמשות ב-`completedAt` — הבאג מתבטא רק **אחרי שמירה**, ולכן הוא חמק.
  - **תיקון:** להציב את שני הדגלים ב-COMPLETE_SET (ולנקות ב-undo), או לנרמל `isCompleted = !!completedAt` בעת השמירה ב-`useWorkoutSave`.

---

## High נוספים

### `ExerciseReorder.tsx`
- **[High] Bug** — `handleDelete` משתמש באינדקס המקומי (אחרי הסידור) כדי לקרוא `onDeleteExercise(index)`, ומוחק את התרגיל **הלא נכון** אצל ההורה אחרי reorder; effect ה-reconciliation גם מפיל תרגילים שנוספו.

### `AnalyticsDashboard.tsx`
- **[High] Bug** — effect `loadAnalytics` ללא try/catch/finally וללא unmount guard → spinner אינסופי בכשל fetch + state-on-unmount.

### `PRHighlights.tsx`
- **[High] Bug** — הפרת Rules of Hooks: `Confetti` קורא `if (!show) return null` **לפני** `useMemo`, יקרוס ("rendered fewer hooks") כשconfetti מתחלף.

### `WorkoutActions.tsx`
- **[High] Bug** — `FinishOverlay` ו-`SummaryOverlay` מוגדרים **בתוך** ה-hook `useWorkoutFinish` → זהות קומפוננטה חדשה בכל render → remount מלא, אובדן state של Suspense/אנימציה. גם empty catch בולע כשל אימות-שמירה; `localStorage.setItem` ללא try/catch.

### `SwipeComplete.tsx`
- **[High] Bug** — `maxDrag` נקרא מ-`containerRef.current?.offsetWidth` **במהלך render** (~L124-125) → ב-render הראשון `containerRef.current` הוא null אז נופל ל-fallback (300), לא מחושב מחדש ב-effect/resize, שובר מרחק גרירה והשלמה. אין מסלול מקלדת.
  - **הערה (מאומת):** `SlideToComplete.tsx` משרת את אותה מטרה (כפילות פונקציונלית) אבל הוא מימוש נפרד ו**תקין יותר** — pointer events + חישוב מחדש של הרוחב ב-`useEffect` עם resize listener, ואין בו את באג הרוחב. לא כפילות ברמת הקוד.
  - **תיקון:** לתקן את `SwipeComplete` (לחשב רוחב ב-effect) או לתקנן על `SlideToComplete` ולהסיר את `SwipeComplete`.

### `IntensityMeter.tsx`
- **[High] Bug** — gradient ids סטטיים (`intensity-gradient-${key}`) → מתנגשים על פני instances; גם אנימציה כפולה וצבעים dark-theme קשיחים.

### `ExerciseDisplay.tsx`
- **[High] Bug** — `setShowAlternatives` קיים (~L137) אבל נקרא **רק עם `false`** (למשל `onClose`, ~L572), אף פעם לא עם `true` → `AlternativesSheet` `isOpen` תמיד false, ה-UI בלתי-נגיש (dead). נקודות status של סט משתמשות ב-count (`i < completedSetsCount`) אז השלמה לא-רציפה מיוצגת שגוי.
  - **תיקון:** לחבר טריגר שקורא `setShowAlternatives(true)` (כפתור "תרגילים חלופיים"), ולמפות נקודות status לפי `set.completedAt` הספציפי ולא לפי count.

---

## Medium

### `ExerciseCard.tsx`
- **[Medium] Bug** — `onClick` של כפתור delete לא עושה `stopPropagation` → לחיצה על delete גם יורה את ה-`onClick` של הכרטיס. אינטראקטיב מקונן (`role=button` שמכיל button).

### `ExerciseList.tsx`
- **[Medium] Bug** — DOM-walk של `getScrollElement` בvirtualizer שברירי (יכול להחזיר null); שורות בגובה קבוע 96px ללא `measureElement` → כרטיסים עם notes חופפים.

### `PerformanceAnalytics.tsx`
- **[Medium] Bug** — prop ברירת מחדל `currentTime = new Date()` → new Date בכל render, memo thrash; חלוקה ב-0 כש-`previousWorkout.totalVolume === 0`.

### `MuscleRadarChart.tsx` & `TrendLineOverlay.tsx`
- **[Medium] Bug** — חלוקה-ב-0/NaN בגאומטריית SVG כש-`numPoints`/`maxVolume` הם 0; "רגרסיה ליניארית" של `TrendLineOverlay` היא בעצם רק נקודה ראשונה→אחרונה.

### `PlanEditorModal.tsx`
- **[Medium] Bug** — `Array(n).fill({reps,weight})` חולק reference אחד של אובייקט על פני כל הסטים; `editorExToTemplateEx` מקבע `order:0` אז reorder לא נשמר.

### `WarmupCooldownFlow.tsx`
- **[Medium] Bug** — side effects (`onComplete()`, `navigator.vibrate`) רצים **בתוך** ה-reducer (לא טהור; יורה כפול ב-StrictMode); toggle של pause לטיימר הוא `div` ללא מקלדת.

### `WorkoutSummary.tsx`
- **[Medium] Bug** — `workoutRating` נאסף אבל אף פעם לא נשמר (נשמר כ-`rating:null`).

### `WaterTracker.tsx`
- **[Medium] Bug** — עדכוני state אופטימיים ללא rollback/reconcile בכשל כתיבה; סיכון חלוקה-ב-0 אם goal/glass size הוא 0.

### Timers / guards (Medium)
- timers של אישור 3 שניות לא מנוקים (`ExerciseReorder` SetEditRow); unmount guards חסרים (`ExerciseLibraryTab` loadExercises, `WorkoutSummary` loadComparison, `ExerciseSuggestionLoader`).

---

## נגישות (Medium, חוצה-קבצים)
- כרטיסים/טיימרים ניתנים-ללחיצה שאינם button ללא תמיכת מקלדת (`WorkoutHistoryScreen` SessionCard, `WarmupCooldownFlow` timer, `ExerciseReorder` drag).
- focus trap / initial focus חסר במספר modals (`ExerciseTutorial`, `QuickExerciseForm`, `WorkoutGoalSelector`, `PRCelebration`).
- `RPEPicker` / `SwipeComplete` — overlays ללא סמנטיקת dialog/focus trap/Escape.
- `InlineRestTimer` — aria-live region מיותר שמכריז ספירה לאחור לכל שנייה (מציף SR) בעוד `WorkoutAriaLive` כבר מטפל נכון.
- bottom sheets מתויגים דרך `ariaLabel` של `ModalOverlay` במקום `aria-labelledby` לכותרת הנראית.

---

## Low / איכות קוד
- **theme tokens**: `PRHistoryTab` + `ProgressionRecommendation` משתמשים ב-dark slate/white של Tailwind במקום `var(--fs-*)`; `ForecastChart` trend colors קשיחים; `PRCelebration` press state.
- **אשכול האנליטיקה** (IntensityMeter, PerformanceAnalytics, MuscleRadarChart, AnimatedNumber, Badge) הוא dark-theme עם text-white/bg-white/hex קשיחים בעוד השאר משתמש ב-`--fs-*` בהיר → בעיית קונטרסט/WCAG על משטחים בהירים.
- **keys לא יציבים/כפולים** by name (`PerformanceAnalytics`, `SummaryExerciseList`, `AlternativesSheet`, `ProgressionHistory` key=session.date, `WorkoutSummary` key=ex.name).
- **UTC מול מקומי**: `WorkoutCalendar` today highlight, `ForecastChart` formatShortDate.
- **casts**: `as unknown as` / `as` (`ExerciseLibraryTab`, `QuickExerciseForm`) מפרים את כלל ה-no-loosening.
- **קוד מת**: `themes.ts` stub, `ExerciseLibraryTab` selectedCategory.
- **אנימציות אינסופיות תמיד-פעילות** מתעלמות מ-prefers-reduced-motion (`ProgressBar`, `OverlayLoader`, `PRHighlights` confetti, `IntensityMeter`).
- **touch targets <44px**: clear-search 24px, pills ~30px, steppers 40px, close buttons 36px, header 42px.
- `estimateDuration` — באג עיגול/דקדוק ב-`WorkoutTemplates`.
- RTL — כיווני חצים (`ExerciseTutorial`, `WarmupCooldownFlow`).

---

## סיכום פריטים בעדיפות גבוהה
1. סימון סט לא עקבי (`completedAt` מול `isCompleted`) → אנליטיקות/השוואות מציגות 0.
2. `ExerciseReorder` מוחק את התרגיל הלא נכון אחרי reorder.
3. `PRHighlights` — הפרת Rules of Hooks (יקרוס).
4. `WorkoutActions` — קומפוננטות overlay מוגדרות בתוך hook (remount).
5. `SwipeComplete` — `maxDrag` קפוא שנקרא ב-render.
6. `AnalyticsDashboard` — spinner אינסופי בכשל fetch.
7. `IntensityMeter`/`ExerciseDisplay` — התנגשות SVG id ו-UI בלתי-נגיש.
