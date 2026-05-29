# 05 — דפים (Pages)

קבצים שנסקרו: `Dashboard`, `Login`, `Nutrition`, `OnboardingFlow`, `Progress`, `Settings`, `Templates`, `WorkoutDetail`, כל `pages/login/*` וכל `pages/progress/*`

---

## ממצאים מרכזיים

### `Nutrition.tsx`
- **[High] Bug — יעדי מאקרו לא מתרעננים בתוך הטאב** (~L196). משתמש ב-`window.addEventListener('storage')`, שלא נורה לכתיבות באותו טאב; Settings שומר דרך `localStorage.setItem` רגיל ללא dispatch של אירוע.
  - **תיקון:** לפלוט `CustomEvent` בעת שמירת ההגדרות ולהאזין לו, או לקרוא דרך SettingsContext.
- **[Low] Performance** — רשימת ספריית המזון ללא גבול; `searchFoods` ללא debounce; `getFoodLibrary()` נקרא שוב ב-`MealPresetCard`.

### `OnboardingFlow.tsx`
- **[Medium] Bug — הזנת משקל עשרוני שבורה** (MobileInput ~L150). `Number()` מפיל את הנקודה הסופית, אז "70.5" לא ניתן להקלדה.
  - **תיקון:** לשמור ערך ביניים כמחרוזת ולהמיר רק ב-blur/submit.

### `Templates.tsx`
- **[Medium] Bug** — `springTransition` נעשה לו spread לתוך target של variant ב-Framer (~L36) במקום תחת `transition`.
- **[Medium] Bug** — index keys על רשימת תרגילים ניתנת-להסרה עם AnimatePresence (~L250).
  - **תיקון:** keys יציבים מבוססי id.
- **[Low] Bug** — stale closure ב-`handleDuplicate`.

### `Settings.tsx`
- שומר הגדרות דרך `localStorage.setItem` ללא dispatch של אירוע — הגורם השורשי ל-Nutrition High למעלה.

---

## PROGRESS

### `tabs/RecoveryTab.tsx`
- **[Medium] Bug — היסטוריית 7 ימים ישנה אחרי הוספת log** (~L24). effect עם deps ריקים על child memoized לא רץ שוב.

### `tabs/MeasurementsTab.tsx`
- **[Medium] Bug — diff של מדידה קודמת מניח סדר oldest→newest שלא מובטח** (~L24); ה-latest מגיע מ-fetch נפרד.

### `modals/AddWeightModal.tsx`
- **[Medium] Bug — יכול להיתקע disabled לצמיתות** אם `onSave` נדחה (אין try/finally) (~L140).

### `modals/AddRecoveryModal.tsx` & `AddMeasurementModal.tsx`
- **[Medium] Bug** — חסר saving guard (double-submit) ו-try/catch.

### `tabs/StrengthTab.tsx`
- **[Low] Bug** — exhaustive-deps / stale-closure hazard.

---

## נגישות (חוצה כל ה-modals וה-tabs)

- **[Medium] Accessibility** — כל 5 ה-bottom-sheet modals ללא `role="dialog"`/`aria-modal`/focus trap/Escape.
- **[Medium] Accessibility** — מספר כפתורי סגירה <44px.
- **[Medium] Accessibility** — `SliderInput` range ללא קישור label.
- **[Medium] Accessibility** — שורה ניתנת-להרחבה ב-`WorkoutHistoryList` היא `div` ללא תמיכת מקלדת/role.
- **[Medium] Accessibility** — skip link ב-Login כנראה שבור ע"י `top:-100%` inline שדורס את ה-reveal ב-`:focus`.

---

## RTL

- **[Medium] UX (RTL)** — bars של accent מערבבים `insetInlineStart` לוגי (WorkoutDetail ExerciseCard/StatItem) מול `left` פיזי (רוב שאר הכרטיסים), ומרונדרים בצדדים מנוגדים.
  - **תיקון:** לעבור ל-properties לוגיים בכל מקום.

---

## איכות קוד (נושאים נמוכים חוצי-קבצים)

- **[Low] Code Quality** — אובייקטי inline style נרחבים במקום tokens של Tailwind, עם card shell / accent bar / metric card / modal chrome משוכפלים על פני ~10 קבצים. הזדמנות refactor מרכזית לפי התקנים של הפרויקט עצמו.
- **[Low] Code Quality** — `emailRef` לא בשימוש ב-`SignInStep`.

### login/*
- מבנה נקי בסך הכל; הבעיה העיקרית היא ה-skip link (למעלה) וה-`emailRef` הלא-בשימוש.
