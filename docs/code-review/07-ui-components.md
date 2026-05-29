# 07 — קומפוננטות UI, Dashboard, Charts, Animations, Icons

קבצים שנסקרו: כל `components/ui/*`, `components/dashboard/*`, `components/charts/*`, `components/animations/*`, `components/icons/*`

> מימושים נקיים לדוגמה: `charts/RingProgress`, `charts/AnimatedBar`, `charts/ActivityRings`, `ui/Input` (label/aria + logical RTL props), `icons/CustomDumbbellIcon`.

---

## ממצאים בעדיפות גבוהה

### התנגשויות SVG id (High)
- **קבצים:** `AnimatedProgressRing.tsx` (filter `glow` קשיח + `progress-gradient-${size}`), `LoadingSpinner.tsx` (`gradient-spinner`), `EmptyState.tsx` (gradients בעלי שם כמו `tasksGradient`).
- **תיאור:** מספר instances מתנגשים. ה-charts כבר משתמשים נכון ב-`useId()`.
  - **תיקון:** להחיל `useId()` בכל מקום שמייצר SVG ids.

### `AnimatedProgressRing.tsx` (High)
- `setPrevPercentage` מוצב מחוץ לענף ה-celebration עם early return, אז ב-100% ה-`setTimeout` של confetti יכול להתזמן מחדש שוב ושוב.

### `AnnualPasswordInput.tsx` (High)
- `autoComplete` מוסק מ-`label === 'Password'` (אנגלית) באפליקציה עברית — תמיד false, אז כל שדה הופך ל-`new-password`, שובר autofill של password managers.
  - **תיקון:** prop מפורש למצב.

### `AuroraBackground.tsx` (High)
- שלוש אנימציות Framer אינסופיות תמיד-פעילות על orbs ענקיים מטושטשים (120-140px, 50-60vw), ללא reduced-motion guard — עלות GPU גבוהה בנייד + בעיית a11y.

### `Premium3DCard.tsx` (High)
- gradient של glare קורא MotionValue דרך `x.get()`/`y.get()` בגוף ה-render (לא ריאקטיבי), אז מיקום ה-glare קפוא.

### `LongPressMenu.tsx` & `PremiumSelect.tsx` (High)
- widgets אינטראקטיביים מותאמים ללא ARIA roles (menu/menuitem, combobox/listbox), ללא תמיכת מקלדת, ו-(PremiumSelect) ללא סגירה בנגיעה-בחוץ בנייד.

### `Button.tsx` (High)
- כל כפתור variant ברירת-מחדל הוא `motion.button` (instance Framer לכל כפתור) ועושה spread של `{...(props as any)}` (מפר כלל no-any).

### `Accessible.tsx` (High)
- `setTimeout` של focus לא מנוקה; focus-trap לא מסנן אלמנטים disabled/hidden.

### `Toast.tsx` (High)
- lifecycle של timer/exit עם eslint-disable יכול לקרוא `onDismiss` על עץ שלא mounted; toasts לא ב-aria-live region.

---

## ממצאים בינוניים

### `dashboard/WeeklyGrid.tsx`
- **[Medium] Bug (timezone)** — משתמש ב-UTC `toISOString().split('T')[0]` בעוד `dateUtils.todayStr()` של הפרויקט משתמש בכוונה בתאריך מקומי כדי לתקן off-by-one (ישראל UTC+2/+3). הרשת יכולה לסמן יום שגוי כ-active/today.

### `dashboard/RecentPRBanner.tsx`
- **[Medium] Bug** — effect async ללא mounted guard (state-on-unmount). `OfflineIndicator` עושה זאת נכון.

### `ui/OfflineIndicator.tsx`
- **[Medium] Performance** — polling כל 5 שניות לנצח גם כשonline + תור ריק.

### `ui/SmoothLoader.tsx`
- **[Medium] Bug** — `AnimatePresence mode="sync"` עם children לא-absolute גורם ל-layout shift שהוא אמור למנוע.

### `ui/SettingsToggle.tsx` / `ui/ToggleSwitch.tsx`
- **[Medium] Performance** — מאנימים `left` (layout) במקום transform.

### קישורי label חסרים (Medium Accessibility)
- `AnnualInput`, `AnnualPasswordInput`, `PremiumSelect`, `SettingsNumberInput` — labels לא קשורים פרוגרמטית לקלט.

### `ui/UltraCard.tsx`
- **[Medium] Code Quality** — double prop-spread שבור/מבלבל + IIFE שמפשיט style; משתמש בסט tokens legacy מחוץ ל-palette.

### `ui/SkeletonLoader.tsx`
- **[Medium] Bug** — `SkeletonCalendarGrid` משתמש ב-`Math.random()` במהלך render (flicker לא דטרמיניסטי).

---

## נושאים חוצי-קבצים

### Reduced motion (Accessibility)
- מכובד טוב ב-`AnimatedProgressRing`/`ModalOverlay`; **חסר** ב-`AuroraBackground`, `LoadingSpinner`, `Premium3DCard`, SMIL של `GradientSparkline`, toggles.

### Drift של design-tokens
- צבעים קשיחים (`red-400/500`) מול `--fs-warn`; radius אסימטרי `'22px 16px 22px 16px'` מועתק על פני ~6 קבצים; `UltraCard` על palette ישן.

### כפילויות
- שני מודולי skeleton עם `screenSkeletonMaps` מתחרים + primitives כפולים.
- שלושה מימושי toggle.
- שני mastheads ל-dashboard (`Greeting` מול `DashboardHeader`).
- שתי מערכות modal (`Accessible`'s `AccessibleModal` מול `ModalOverlay` הקנוני).

### `animations/config.ts`
- **[Low]** — חושף `enableAnimations: true` כקבוע compile-time (ללא חיווט runtime/reduced-motion) מוטמע בתוך מפת ה-variants.

---

## סיכום פריטים בעדיפות גבוהה
1. התנגשויות SVG id (`AnimatedProgressRing`, `LoadingSpinner`, `EmptyState`) — להחיל `useId()`.
2. `AnimatedProgressRing` — confetti `setTimeout` שמתזמן מחדש ב-100%.
3. `AnnualPasswordInput` — `autoComplete` שגוי שובר autofill.
4. `AuroraBackground` — אנימציות אינסופיות כבדות ללא reduced-motion.
5. `Premium3DCard` — glare קפוא (קריאת MotionValue ב-render).
6. `LongPressMenu`/`PremiumSelect`/`Button`/`Accessible`/`Toast` — פערי a11y וביצועים.
