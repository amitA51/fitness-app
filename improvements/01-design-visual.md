# 01 — עיצוב ומערכת עיצוב · תיק עבודה לסוכן Design

> **תפקידך:** סוכן עיצוב בכיר. המטרה מס' 1 של הבעלים: עיצוב **יוצא דופן, לא גנרי**, עם עומק (לא שטוח, לא עמוס), Dark+Light מלא, mobile-first, RTL עברית, **בלי אימוג'ים כאייקונים** (SVG בלבד — יש טסט שאוסר). הסקיל `impeccable` הוא מסגרת העבודה שלך.

---

## ⚠️ עבודה במקביל (קרא תחילה)
הבעלים וסוכנים אחרים עורכים במקביל. לפני כל עריכה: פתח מחדש את הקובץ החי, אמת את הממצא, התייחס למספרי שורות כקירוב (אַתֵּר לפי symbol/מחרוזת). **התעלם מ-`docs/` ו-`plans/` (מיושנים).** בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| D-1 | Contrast נכשל ב-WCAG AA (light) — `--fs-muted`, `--stone-light` | **Critical** | S |
| D-2 | Dark mode: כפתור primary בלתי נראה (`--fs-primary` ≈ שחור על שחור) | High | S |
| D-3 | "גנריות" — eyebrow מונוטוני `§ LABEL · LABEL` ×47 | High | M |
| D-4 | Token drift — hex קשיח ב-`tailwind.config.js` ללא dark variant | High | M |
| D-5 | באגי RTL — physical props (`ml/mr/pl/pr`, `borderLeft`) במקום logical | High | M |
| D-6 | יותר מדי glassmorphism (66 שימושים) — jank במובייל + אין היררכיה | Medium | M |
| D-7 | אסטרטגיית עומק שטוחה למרות 6 shadow tokens | Medium | M |
| D-8 | `PageThemeContext` — צבעי accent פר-עמוד לא באמת בשימוש | Medium | M |
| D-9 | Button — 17 variants (decision paralysis) | Medium | M |
| D-10 | "card soup" — כל אזור הוא אותו glass-card עם radius אסימטרי | Medium | L |
| D-11 | טיפוגרפיה — 4 משפחות גופנים (~400KB), IBM Plex Sans מיותר לעברית | Low | S |
| D-12 | spacing לא עקבי (18/22/28px מחוץ לרשת 4/8) | Low | S |
| D-13 | SkeletonLoader — כל ה-radii מאופסים ל-0, לא תואם תוכן | Low | S |

---

## ממצאים מפורטים

### D-1 · Contrast נכשל ב-WCAG AA (light mode) — **Critical**
- **מיקום:** `src/styles/tokens.css` — `--stone-light: #93a09e` (≈2.3:1 על `--fs-bg #eef3f1`), `--fs-muted: #60706f` (≈3.7:1). שניהם מתחת ל-4.5:1 הנדרש לטקסט גוף. Dark mode עובר.
- **תיקון:** הכהה ל-light: `--fs-muted` → `~#4d5c5a`, `--stone-light` → `~#5f6e6c` (≥4.5:1). אמת עם DevTools/axe.
- **DoD:** כל זוגות טקסט/רקע מרכזיים ≥4.5:1 (טקסט רגיל), ≥3:1 (טקסט גדול).
- **תיאום:** משותף עם **05-A11y** (אותו תיקון). אתה הבעלים.

### D-2 · Dark mode primary button בלתי נראה — High
- **מיקום:** `tokens.css` dark block `--fs-primary: #0a0a0a` משמש כרקע `btn-primary` על `--fs-bg: #000000`.
- **תיקון:** ב-dark, רקע כפתור primary = `--fs-accent` עם טקסט כהה, או surface נראה (`#1a1a1a`) עם border accent. הוסף token ייעודי `--btn-primary-bg`.
- **DoD:** כפתורי primary נראים ובעלי contrast מספק בשני המצבים.

### D-3 · ה"גנריות" — eyebrow מונוטוני (הגורם מס' 1 לתחושת "AI") — High
- **מיקום:** 47+ מופעים של `§ SECTION · LABEL` (`font-mono`, 10px, `letter-spacing 0.18–0.22em`, uppercase) — לדוגמה `§ WEEKLY · SUMMARY`, `§04 · STRENGTH`. ערבוב אנגלית-CAPS + עברית באפליקציית RTL.
- **תיקון (impeccable — "tiny uppercase eyebrow on every section" הוא ban):** הגבל ל-1–2 לכל מסך; החלף ברוב המקומות בכותרת עברית `font-display` 14–16px semibold sentence-case; הסר את ה-`§`; גוון פתיחות אזורים (קו מפריד / כותרת גדולה / כלום). לעולם לא eyebrow אחיד בכל אזור.
- **DoD:** אין יותר מ-2 eyebrows למסך; הפתיחות מגוונות; אין `§`.

### D-4 · Token drift — hex קשיח ב-tailwind.config.js — High
- **מיקום:** `tailwind.config.js` — scale `gray` (`gray-100:#F5F1EB`, `gray-900:#132018`) ו-`label-secondary/tertiary` כ-hex קשיח, ללא dark variant. כל קומפוננטה שמשתמשת ב-`bg-gray-*`/`text-label-*` נשברת ב-dark.
- **תיקון:** כל צבע ב-tailwind.config.js חייב להפנות ל-CSS var. הוסף overrides ל-`html.dark` עבור `--label-*`. הסר/מַפֵּה את scale `gray`.
- **DoD:** אין hex קשיח בצבעי tailwind; dark mode תקין לכל ה-utilities.
- **תיאום:** משותף עם **06-Arch**. אתה הבעלים.

### D-5 · באגי RTL — physical properties — High
- **מיקום (מאומת):** `Accessible.tsx` (`mr-1`), `PremiumSelect.tsx` (`pl-4 pr-9`), `AnnualInput.tsx` (`pl-12 pr-4`), `AnnualPasswordInput.tsx` (`pr-12` + `paddingLeft`), `Templates.tsx` (`mr-1`), `WorkoutDetail.tsx` (`marginRight:auto`), `StatsGrid.tsx` (`borderLeft`).
- **תיקון:** `ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`; inline `paddingLeft/Right → paddingInlineStart/End`; `marginRight→marginInlineEnd`; `borderLeft/Right→borderInlineStart/End`. חריג: `left:50%` למרכוז זה positional, להשאיר.
- **DoD:** סריקה ל-physical props בקומפוננטות UI ריקה; פריסה תקינה ב-RTL.

### D-6 · עודף glassmorphism — Medium
- **מיקום:** 66 שימושים ב-44 קבצים (`glass-surface`, `backdrop-blur`, `backdropFilter`). `impeccable`: glass כברירת מחדל = ban.
- **תיקון:** שמור glass ל-1–2 אלמנטים למסך (nav + אלמנט צף אחד); כרטיסים → `var(--fs-surface)` אטום + border; עומק דרך elevation (shadow) לא blur; `will-change` רק על ה-nav.
- **DoD:** ≤2 שכבות blur למסך; אין jank במובייל בינוני.

### D-7 · עומק שטוח למרות tokens — Medium
- **מיקום:** 6+ shadow tokens אך 90% מהכרטיסים משתמשים רק ב-`--shadow-card` הקל. ב-dark הצללים בלתי-נראים על שחור.
- **תיקון:** 3 רמות elevation ואכיפתן (0 flush / 1 card / 2 elevated / 3 modal). ב-dark — מדרגות surface (`#111→#1a1a1a→#222`) + top-edge highlight `inset 0 1px 0 rgba(255,255,255,.04)`.
- **DoD:** היררכיית עומק נראית לעין בשני המצבים.

### D-8 · accent פר-עמוד לא בשימוש — Medium
- **מיקום:** `PageThemeContext.tsx` מגדיר accent שונה לכל route, אבל `tokens.css` דורס הכול ל-`var(--fs-accent)`, ורוב הקומפוננטות מפנות ל-`--fs-accent` ישירות ולא ל-`--accent-current`.
- **תיקון:** או החלף ל-`var(--accent-current)` ברכיבים שמייצגים זהות-עמוד (progress, active, CTA), או ויתור על `PageThemeContext`. אם משאירים — סנכרן defaults ב-tokens.css ל-paint ראשוני נכון.
- **DoD:** זהות-צבע פר-עמוד נראית, או הוסר לטובת פשטות.

### D-9 · Button — 17 variants — Medium
- **מיקום:** `src/components/ui/Button.tsx` — `ButtonVariant` עם 17 ערכים + 3 מסלולי render.
- **תיקון:** צמצם ל-5–6 (`primary/secondary/ghost/danger/glass/pill`). ההבדל editorial↔fs הוא shape → prop נפרד `shape: sharp|rounded|asymmetric`. הסר `card-action`/`start`.
- **DoD:** ≤6 variants; קומפוננטות עודכנו.

### D-10 · "card soup" — Medium→L
- **מיקום:** `Dashboard.tsx`, `Progress.tsx`, `Nutrition.tsx` — כל אזור: eyebrow→glass-card→`borderRadius:'22px 16px 22px 16px'` (×74)→אותו padding/border/shadow.
- **תיקון (impeccable — identical card grids = ban):** 3 רמות מיכל (flush/card/elevated); radius אסימטרי ל-1–2 hero בלבד; standard `border-radius:16–20px`; color-blocking בין אזורים (dark↔light); רגע טיפוגרפי בולט אחד למסך ששובר את הרשת; אסימטריה (2-col עם יחס 2:1, full-bleed).
- **DoD:** לפחות 3 מודי פריסה למסך; שבירת "card soup".

### D-11 · 4 משפחות גופנים — Low
- **מיקום:** `index.html` + `tokens.css` — IBM Plex Sans/Mono, Bricolage Grotesque, Assistant (~14 קבצים, ~400KB). IBM Plex Sans חסר גליפים עבריים → Assistant נושא את רוב הטקסט.
- **תיקון:** הפל IBM Plex Sans, השתמש ב-Assistant לגוף (גם Latin טוב) → 3 משפחות; subset אגרסיבי; `preload` לגופן עברי קריטי.
- **DoD:** ≤3 משפחות; payload גופנים יורד.

### D-12 · spacing לא עקבי — Low
- **מיקום:** ערכים 18/22/28px ב-`Dashboard.tsx`, `DashboardHeader.tsx` ועוד, מחוץ לרשת 4/8 (`--space-*`).
- **תיקון:** padding תוכן עמוד = `--content-padding` (20px); padding כרטיס = `--space-4/5`; הסר ערכים מחוץ לרשת.
- **DoD:** כל ה-spacing נצמד לרשת.

### D-13 · SkeletonLoader radii=0 — Low
- **מיקום:** `src/components/ui/SkeletonLoader.tsx` — `RADIUS_MAP` ממפה הכל ל-`'0'`, לא תואם את ה-radius האמיתי של התוכן.
- **תיקון:** מַפֵּה ל-radii אמיתיים (`full:9999px`, כרטיס:`22px 16px 22px 16px`, וכו') או העבר את `borderRadius` כ-prop.
- **DoD:** skeletons תואמים לצורת התוכן הנטען.

---

## הזדמנויות שדרוג
- **OKLCH** לכל הצבעים — פותר contrast באופן שיטתי (הבטחת מרחק lightness מינימלי).
- **Variable fonts** — מ-14 קבצים סטטיים (~400KB) ל-~150KB + אנימציית משקל.
- **Container queries** (`@container`) לכרטיסים — חשוב לפלטפורמת המאמן (אותו כרטיס בהקשרים שונים).
- **CSS `@layer` + `@property`** — שליטה ב-specificity + מעבר צבע חלק בין themes.
- **`prefers-color-scheme`** כברירת מחדל לפני toggle ידני.

## תיאום ונקודות חיכוך
- `tokens.css` (D-1) — משותף עם 05-A11y, אתה הבעלים.
- `tailwind.config.js` (D-4) — משותף עם 06-Arch, אתה הבעלים.
- `motion.css`/אנימציות — **לא שלך**, שייך ל-02-Motion.

## הגדרת סיום (תיק)
D-1, D-2 (Critical/High) נסגרו; ה"גנריות" (D-3, D-10) טופלה ברמת מסך; RTL נקי; `npm run verify && npm run test:run` ירוקים; בדיקה ויזואלית Dark+Light.
