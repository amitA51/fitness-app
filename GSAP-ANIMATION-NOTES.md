# GSAP Animation Suite — סיכום עבודה ומה כדאי בהמשך

> נכתב אוטומטית בסיום מעבר השדרוג. כל מה שמתואר כאן כבר **מומש, עבר typecheck, build ו-lint נקיים**. הקובץ נועד לבדיקה שלך בהמשך — מה לבדוק ידנית, ומה אפשר לשדרג הלאה.

---

## ✅ מה נעשה

### תשתית משותפת (הלב של הקוהרנטיות)
כל האנימציות נשענות על 4 קבצים משותפים — מקור-אמת אחד לתזמון, easing וחלקיקים:

| קובץ | תפקיד |
|------|-------|
| `src/lib/gsap.ts` | ייבוא מרכזי של GSAP + רישום `Physics2DPlugin`. מייצא טוקנים: `EASE` (reveal/out/in/pop/popHard/slide), `DUR` (micro/fast/base/count/slow), ו-`formatInt`/`formatThousands`. **תמיד מייבאים מכאן, לא מ-`gsap` ישירות.** |
| `src/hooks/useCountUp.ts` | count-up מבוסס RAF שכותב ישירות ל-`textContent` (אפס re-renders). מטפל פנימית ב-reduced-motion (snap לערך הסופי). |
| `src/lib/gsapSparks.ts` | מפעל חלקיקים אחיד (`fireSparks`) עם כוח-משיכה ומהירות אמיתיים. משמש את PR/Set-Complete/Summary/Water. |
| `vite.config.ts` | GSAP נארז ב-chunk ייעודי (`gsap-*.js`, ~72KB raw / ~26KB gzip), נפרד מ-framer ומ-route chunks. |

### 13 משטחים ששודרגו
- **גרפים:** `GlowAreaChart` (ציור-קו draw-on, משפיע על כל גרפי המגמה באפליקציה), `GradientSparkline` (ציור + נקודת-קצה pop).
- **דשבורד:** `ActivityRings` (טבעות נסגרות בסגנון Apple-Watch, מדורג חוץ→פנים) + `Dashboard` (מספרי ה-legend עולים בסנכרון מלא עם הטבעות), `WorkoutStreak` (count-up + pop).
- **ניווט:** `BottomNav` — pill תחתון יחיד שזורם בין הטאבים (במקום קפיצה), עם overshoot על האייקון הפעיל ו-pop על תג ההודעות.
- **אימון:** `PRCelebration` (מספרים מטפסים מהשיא הקודם + מניפת confetti), `SlideToComplete` (fling עם overshoot + spark stamp), `WorkoutSummary` + `StatsGrid` + `SummaryExerciseList` (כותרת-גיבור עולה, כרטיסים נכנסים מדורג, spark puff על שיא), `MuscleRadarChart` (סריקת סונאר שמודדת שריר-אחר-שריר).
- **תזונה:** `CalorieHero` (count-up + טבעת התקדמות מעגלית במקום בר שטוח), `MacroStrip` + `WaterTracker` (בָּרים שגדלים + מילוי מים עם splash).

### תהליך
- 11 סוכני מימוש במקביל על קבצים נפרדים + 2 סוקרים (תקינות/באגים, נגישות/RTL/קוהרנטיות).
- 2 סוכנים נתקעו (`BottomNav`, `SlideToComplete`) — **מומשו ידנית** עד הסוף.
- 16 הערות סקירה — **כולן טופלו** (scope ל-`toArray`, אחידות tabular-nums, עטיפות `dir="ltr"` למספרים עם פסיק-אלפים, אחידות טוקני `DUR`, hooks עקביים ל-reduced-motion, hover עטוף ב-`contextSafe`, aria-labels לגרפים).

### אימות
- `tsc --noEmit` → **0 שגיאות חדשות**.
- `npm run build` → **BUILD_OK**, 2419 מודולים.
- `biome check` → **נקי** על כל 15 הקבצים.

---

## 🔍 מה כדאי לבדוק ידנית (לא ניתן לאמת ב-build)

1. **תזמון ויזואלי במכשיר אמיתי** — כל המשכים כוילו "בעיניים" לפי טוקני `DUR`. שווה לעבור בטלפון אמיתי ולוודא שהקצב מרגיש נכון, במיוחד ה-cascade של הטבעות מול ה-count-up של המספרים (אמורים לסיים ביחד).
2. **RTL** — לוודא חזותית שה-pill ב-`BottomNav` זורם בכיוון הנכון (ימין→שמאל), ושה-fling ב-`SlideToComplete` הולך לכיוון הנכון. שניהם מודדים rect פיזי / משתמשים ב-`sign` כך שאמורים להיות תקינים, אבל זו בדיקה ויזואלית.
3. **`prefers-reduced-motion`** — להפעיל במערכת ההפעלה ולוודא שהכל "קופץ" למצב סופי בלי תנועה (DevTools → Rendering → Emulate CSS prefers-reduced-motion).
4. **ביצועים** — `GradientSparkline` מופיע ברשימות; לוודא 60fps כשיש כמה בו-זמנית.

---

## 🛠️ Follow-ups מומלצים (לא חוסם, לא טופל בכוונה)

### חוב קיים מראש (לא קשור לעבודה הזו)
- **`src/pages/coach/ClientDetail.tsx`** — 6 שגיאות typecheck קיימות מלפני העבודה (`Textarea`/`Input` לא מיובאים, פרמטרים `any`). שווה לתקן בנפרד.
- **`src/pages/onboarding/components/ProgressDots.tsx`** — שגיאת a11y קיימת (`role="progressbar"` לא focusable) — אותו דפוס שתיקנתי ב-`CalorieHero`. כדאי ליישר.

### הערות סקירה ברמת "note only" (השארתי בכוונה)
- **CSS reduced-motion** — שתי אנימציות CSS אינסופיות (`spin` בריענון-משיכה ב-Dashboard, ו-`breathing-dot` ב-`WorkoutStreak`) צריכות להיעטף ב-`@media (prefers-reduced-motion: reduce){ animation:none }` ב-stylesheet. ה-stylesheet היה מחוץ ל-scope של העבודה הזו.
- **`MacroStrip` transformOrigin** — מקודד קשיח כ-`'right center'` (נכון לאפליקציה RTL-only). אם תרצה portability עתידי: `document.dir==='rtl' ? 'right center' : 'left center'`.

### `GlowAreaChart` — ציור חוזר בהחלפת טאבים
הציור מתרענן בכל שינוי של `linePath`. אם בהחלפת טאבים ב-Progress הגרף מצטייר מחדש בצורה מציקה עם אותו data — אפשר לשער ב-`hasDrawn` ref כך שהציור ירוץ רק במאונט הראשון.

---

## 🚀 שדרוגים עתידיים אפשריים (Tier 3)
- **מעברי מסכים (route transitions)** — כרגע אין; אפשר GSAP/View-Transitions בין הטאבים הראשיים.
- **Skeleton → content handoff** — מעבר חלק מ-`SkeletonLoader` לתוכן האמיתי במקום החלפה פתאומית.
- **Pull-to-refresh** — האנימציה כרגע בסיסית; אפשר אלסטיות עם GSAP.
- **מקלדת מספרים (`NumpadOverlay`)** — feedback על הקשה.
- **גרף `MuscleRadarChart`** — להוסיף ניווט מקלדת לנקודות (כרגע הטולטיפ נגיש רק בעכבר; הוספתי `aria-label` מסכם ל-screen-readers).

---

## 📋 הערה על עלות
הסשן רץ ב-high cost (~$108+ בזמן הכתיבה) בגלל 13 סוכנים מקבילים. מכאן והלאה כל התיקונים נעשו ידנית כדי לחסוך. אם תרצה עוד שדרוגים — שווה לעשות אותם ב-batch ממוקד יותר.
