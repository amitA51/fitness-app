# 05 — נגישות (a11y) · תיק עבודה לסוכן A11y

> **תפקידך:** סוכן נגישות. PWA עברית/RTL מובייל-first. `@axe-core/react` מותקן (DEV). המוקד: מודאלים (focus trap / Escape / scroll lock), הפעלה במקלדת של פקדים מותאמים, contrast, reduced-motion לאנימציות JS, ARIA, RTL.

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד החי; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.** בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| A-1 | מודאלי Progress (Weight/Recovery/Measurement) — אין focus trap/Escape/scroll lock | **Critical** | S |
| A-2 | `<MotionConfig reducedMotion="user">` חסר ב-App.tsx — מכסה את כל 73 הקבצים בשורה אחת | Medium | S |
| A-3 | `RPEPicker` — אין role/ARIA/ניווט מקלדת/Escape (פקד אימון ליבה) | High | M |
| A-4 | `Input` — חסר `aria-invalid`/`aria-describedby`/`role=alert` | High | S |
| A-5 | overlays מסך-מלא (PRCelebration, ExerciseTutorial, WarmupCooldown, delete dialog) — אין focus trap | High | S כל אחד |
| A-6 | `AddWeightModal`/`AddRecoveryModal` — inputs ללא labels | High | S |
| A-7 | contrast — `--fs-muted` על רקע בהיר ≈3.7:1 (טקסט קטן 10–12px) | Medium | S |
| A-8 | `LongPressMenu` — trigger לא נגיש למקלדת | Medium | M |
| A-9 | `PremiumSelect` — אין `aria-activedescendant`; options ב-tab order | Medium | M |
| A-10 | `Toast` — `role=alert` + `aria-live=polite` סותרים | Low | S |
| A-11 | `ToggleSwitch` — focus ring על אלמנט שגוי | Low | S |
| A-12 | manifest `theme_color` בהיר קבוע — לא תואם dark mode | Low | S |

---

## ממצאים מפורטים

### A-1 · מודאלי Progress ללא focus trap/Escape/scroll lock — **Critical**
- **מיקום:** `src/pages/progress/modals/AddWeightModal.tsx`, `AddRecoveryModal.tsx`, `AddMeasurementModal.tsx` — `motion.div` חשוף עם `role="dialog"` + `aria-modal="true"` אבל בלי focus trap, בלי Escape, בלי scroll lock, בלי focus restore. ה-`aria-modal` "משקר" ל-screen reader. הפרת WCAG 2.1.2 + 2.4.3.
- **תיקון:** עטוף ב-`<ModalOverlay>` הקיים (מספק focus trap+Escape+scroll lock+restore), או `useFocusTrap(ref, {isOpen, onClose, closeOnEscape:true, lockScroll:true})`.
- **DoD:** Tab לא יוצא; Escape סוגר; focus חוזר ל-trigger; בדיקת מקלדת-בלבד עוברת.

### A-2 · `<MotionConfig reducedMotion="user">` חסר — Medium (תיקון בשורה אחת!)
- **מיקום:** `src/App.tsx` (root). CSS media query מכסה רק CSS; אנימציות JS של framer (springs, `animate`, `whileTap/Hover`, drag, לולאות) לא מכוסות. רק ~19/73 קבצים בודקים `useReducedMotion`.
- **תיקון:** עטוף את האפליקציה ב-`<MotionConfig reducedMotion="user">` — framer יכבד אוטומטית את העדפת ה-OS לכל `motion.*`. למקרים שצריכים fallback מותאם (ספינר→סטטי) השאר `useReducedMotion()` מקומי.
- **DoD:** עם `prefers-reduced-motion: reduce` — אנימציות framer מיידיות בכל האפליקציה.
- **תיאום:** **02-Motion (M-1) תלוי בתיקון הזה. אתה הבעלים — בצע ראשון.**

### A-3 · `RPEPicker` לא נגיש — High
- **מיקום:** `src/components/workout/components/RPEPicker.tsx` — bottom-sheet בלי `role`/`aria-modal`/`aria-label`, בלי ניווט חיצים, בלי Escape, בלי focus trap. פקד ליבה באימון, בלתי נגיש לחלוטין למקלדת/SR.
- **תיקון:** `role="dialog"`+`aria-modal`+`aria-label="בחירת RPE"`; Escape; `radiogroup`/`radio` עם ניווט חיצים בין 5 הערכים; `useFocusTrap`.
- **DoD:** ניתן לבחור RPE במקלדת בלבד; SR מכריז נכון.

### A-4 · `Input` חסר ARIA לשגיאות — High
- **מיקום:** `src/components/ui/Input.tsx` — אין `aria-invalid={!!error}`, אין `aria-describedby` ל-error/helper, ה-error `<span>` בלי `role="alert"`/`id`. (`AccessibleInput` ב-`Accessible.tsx` עושה נכון — אבל `Input` בשימוש נרחב לא.)
- **תיקון:** הוסף `id` ל-error span; `aria-invalid` + `aria-describedby` ל-input; `role="alert"` ל-span.
- **DoD:** SR מכריז שגיאות ולידציה בכל טופס שמשתמש ב-`Input`.

### A-5 · overlays מסך-מלא ללא focus trap — High
- **מיקום:** `PRCelebration.tsx` (גם `pointer-events-none` שובר dismiss), `ExerciseTutorial.tsx` (יש Escape, אין trap/focus-in), `WarmupCooldownFlow.tsx` (אין role/aria/trap/Escape), `WorkoutTemplates.tsx` delete dialog (יש Escape, אין trap).
- **תיקון:** `useFocusTrap` + ניהול focus-on-open + scroll lock; ל-WarmupCooldown הוסף `role="dialog"`+`aria-modal`+`aria-label`; הסר `pointer-events-none` החיצוני ב-PRCelebration.
- **DoD:** משתמש מקלדת לכוד נכון בכל overlay מסך-מלא; Escape סוגר.

### A-6 · inputs ללא labels — High
- **מיקום:** `AddWeightModal.tsx` (weight number, notes text), `AddRecoveryModal.tsx` (notes) — בלי `<label>`/`aria-label`/`id`.
- **תיקון:** `aria-label="משקל בק״ג"`, `aria-label="הערות"`, או labels גלויים עם `htmlFor`.
- **DoD:** אין inputs ללא תווית.

### A-7 · contrast `--fs-muted` — Medium
- **מיקום:** `src/styles/tokens.css` — `--fs-muted #60706f` על `--fs-bg #eef3f1` ≈3.7:1, בשימוש בטקסט 10–12px (דורש 4.5:1). dark עובר.
- **תיקון:** הכהה ל-light (`~#4d5c5b`) או הגדל פונט מושפע ל-14px+.
- **DoD:** טקסט muted עובר AA.
- **תיאום:** **משותף עם 01-Design (D-1) — אותו tokens.css. 01 הבעלים; אתה רק מאמת. אל תערוך את הקובץ אם 01 כבר תיקן.**

### A-8 · `LongPressMenu` לא נגיש למקלדת — Medium
- **מיקום:** `src/components/ui/LongPressMenu.tsx` — נפתח רק ב-long-press; אין trigger מקלדת, אין `role`/`aria-haspopup` על ה-wrapper. (התפריט עצמו: `role=menu`/`menuitem`+Escape — טוב.)
- **תיקון:** `role="button"`+`aria-haspopup="menu"`+`tabIndex={0}`+`onKeyDown` (Enter/Space/ContextMenu/Shift+F10).
- **DoD:** התפריט נפתח ונשלט במקלדת.

### A-9 · `PremiumSelect` ARIA combobox — Medium
- **מיקום:** `src/components/ui/PremiumSelect.tsx` — options ב-tab order, אין `aria-activedescendant`, האופציה הפעילה לא מוכרזת.
- **תיקון:** `aria-activedescendant={activeOptionId}` על ה-trigger בפתיחה; `id` לכל option; `tabIndex={-1}` ל-options.
- **DoD:** combobox תקין לפי ARIA 1.2; SR מכריז אופציה פעילה.

### A-10 · `Toast` ARIA סותר — Low
- **מיקום:** `src/components/ui/Toast.tsx` — גם `role="alert"` (מרמז assertive) וגם `aria-live="polite"`.
- **תיקון:** `role="status"`+`aria-live="polite"` ל-info/success; `role="alert"` (בלי aria-live מפורש) ל-error/warning.
- **DoD:** אין הכרזה כפולה/בלתי-צפויה.
- **תיאום:** **06-Arch ממזג את systems ה-Toast (F5). תאם — ייתכן שהקובץ הזה יוחלף/יועבר.**

### A-11 · `ToggleSwitch` focus ring — Low
- **מיקום:** `src/components/ui/ToggleSwitch.tsx` — `focus-within:ring-2` על ה-track (radius~2, לא תואם), ה-input `sr-only`.
- **תיקון:** ודא focus indicator ברור (peer/`focus-visible`).
- **DoD:** focus נראה וברור.

### A-12 · manifest theme_color — Low
- **מיקום:** `public/manifest.webmanifest` — `theme_color` בהיר קבוע; ב-dark ה-status bar בהיר (jarring).
- **תיקון:** `<meta name="theme-color" media="(prefers-color-scheme: dark)">` ב-`index.html` לשני המצבים.
- **DoD:** chrome הדפדפן תואם את ה-theme.

---

## הזדמנויות שדרוג
- **`<MotionConfig reducedMotion="user">`** (A-2) — תיקון יחיד שמכסה 73 קבצים.
- **מעבר כל המודאלים ל-`ModalOverlay`** — תאימות a11y מיידית (כבר בנוי היטב).
- **דפוס `aria-activedescendant`** ל-selects/pickers — שימוש עם VoiceOver/TalkBack ללא עזרה.
- **שער a11y ב-CI** — Playwright + `@axe-core/playwright` (כיום רק DEV console).
- **`inert`** על `#main-content` כשמודאל פתוח — חזק מ-focus trap לבדו.

## תיאום ונקודות חיכוך
- `tokens.css` (A-7) → **01-Design הבעלים.** רק אמת.
- `<MotionConfig>` (A-2) → שלך; **02-Motion תלוי בך.**
- `Toast.tsx` (A-10) → **06-Arch** ממזג. תאם.
- `ModalOverlay`/`useFocusTrap` → תשתית קיימת, השתמש בה, אל תכפיל.

## הגדרת סיום (תיק)
A-1 (מודאלי Progress) ו-A-2 (`MotionConfig`) נסגרו; פקדי הליבה (RPEPicker, Input) נגישים; overlays מסך-מלא עם trap; `npm run verify && npm run test:run` ירוקים; ריצת axe ללא violations קריטיים.

> הערה: ולידציית WCAG מלאה דורשת בדיקה ידנית עם טכנולוגיות מסייעות (VoiceOver/TalkBack) — האוטומציה מכסה רק חלק.
