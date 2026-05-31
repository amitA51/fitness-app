# 00 — תיק שיפורים ושדרוגים · README למתאם (Coordinator)

> **נכתב על ידי Kiro בתפקיד מנהל צוות**, על בסיס חקירה של **הקוד החי בלבד** (31.05.2026).
> 8 סוכני מחקר נפרדים חקרו 8 תחומים. כל קובץ כאן הוא **תיק עבודה (brief) לסוכן אחד**.
> מקור האמת היחיד הוא הקוד עצמו. **התעלם מ-`docs/` ומ-`plans/` — הם מיושנים ולא אמינים.**

---

## ⚠️ הערת עבודה במקביל — קרא לפני הכול (תקף לכל סוכן, עכשיו ובעתיד)

הבעלים עובד על הקוד **במקביל** אליך, וגם סוכנים אחרים מהצוות הזה עשויים לערוך קבצים בו-זמנית. לכן:

1. **לפני כל עריכה** — פתח מחדש את הקובץ החי וּוַדא שהממצא עדיין קיים. ייתכן שכבר תוקן.
2. **מספרי שורות הם קירוב בלבד.** הקבצים משתנים. אַתֵּר לפי שם הפונקציה / ה-symbol / מחרוזת ייחודית, לא לפי מספר שורה.
3. **קבצים משותפים** — בכל תיק יש סעיף "תיאום ונקודות חיכוך". אם אתה נוגע בקובץ שמופיע שם, ודא שאינך דורס עבודה של תחום אחר.
4. **אל תיגע ב-`docs/` ו-`plans/`** — מיושנים. הסתמך אך ורק על הקוד החי.
5. **לא בטוח אם ממצא עדיין תקף?** אל תנחש — אמת מול הקוד, ואם השתנה מהותית, דווח ועצור במקום לתקן עיוור.

---

## מוסכמות עבודה (לכל הסוכנים)

- **שפה:** קוד, נתיבים ו-symbols באנגלית; הסבר ותיעוד בעברית.
- **אחרי כל שינוי:** `npm run verify` (typecheck + lint + format) **וגם** `npm run test:run`.
- **שינויי DB / Supabase** (תחום 08): רק על **branch** של Supabase, עם גיבוי, אף פעם לא ישירות על פרודקשן. הרץ `get_advisors` (security + performance) אחרי.
- **דרגות חומרה:** Critical (חוסם / איבוד נתונים / פרצת אבטחה) · High · Medium · Low.
- **מאמץ:** S (שעות) · M (יום-יומיים) · L (שבוע+ / מרובה קבצים).
- **לא להרחיב סקופ:** תקן את מה שבתיק שלך. אם אתה מגלה משהו בתחום אחר — רשום אותו, אל תתקן אותו (כדי לא להתנגש).

---

## אינדקס התיקים

| # | קובץ | תחום | מי הבעלים | Criticals |
|---|------|------|-----------|:---------:|
| 01 | `01-design-visual.md` | עיצוב ומערכת עיצוב (impeccable) | Design Agent | 1 |
| 02 | `02-motion-ux.md` | תנועה, מיקרו-אינטראקציות, מחוות | Motion Agent | 0 |
| 03 | `03-security.md` | אבטחה, RLS, Edge Functions, supply-chain | Security Agent | 1 |
| 04 | `04-performance.md` | ביצועים — runtime + bundle | Performance Agent | 1 |
| 05 | `05-accessibility.md` | נגישות (a11y), RTL, מקלדת | A11y Agent | 1 |
| 06 | `06-architecture-code-quality.md` | ארכיטקטורה, חוב טכני, הכנה ל-RN | Architecture Agent | 0 |
| 07 | `07-testing-reliability.md` | בדיקות, אמינות, CI/CD, ניטור | QA Agent | 1 |
| 08 | `08-data-sync-backend.md` | שכבת נתונים, sync אופליין, נכונות backend | Data Agent | 2 |

---

## סדר ביצוע מומלץ (כמנהל צוות)

**גל 1 — חוסמים (במקביל, אין חפיפה ביניהם):**
- **08-Data**: F1+F2 (multi-device sync שבור) — הקריטי ביותר במוצר.
- **03-Security**: הסרת `ecc-universal` (supply-chain פעיל).
- **07-Testing**: בדיקות ל-`workoutReducer` + העלאת ספי coverage (רשת ביטחון לפני שאר השינויים).

**גל 2 — High impact (תאם קבצים משותפים):**
- **04-Performance**: fan-out ב-sync, `select('*')`, virtualization.
- **05-A11y**: `<MotionConfig reducedMotion="user">` + focus-trap למודאלים.
- **01-Design**: contrast (קריטי a11y), dark-mode primary button, הסרת ה"גנריות".

**גל 3 — איכות ושדרוג:**
- **06-Architecture**: פירוק קבצי ענק, איחוד מקורות אמת, הכנה ל-React Native.
- **02-Motion**: ליטוש easing, RTL במחוות, stagger.

---

## מטריצת חפיפות (קבצים שנוגעים ביותר מתחום אחד — תאם!)

| קובץ / נכס | תחומים שנוגעים | הערה |
|---|---|---|
| `src/styles/tokens.css` (`--fs-muted`, `--stone-light`) | 01-Design, 05-A11y | **שינוי אחד** מתקן את שניהם. שייך ל-**01**; 05 רק מאמת. |
| `src/App.tsx` (`<MotionConfig>`) | 05-A11y, 02-Motion | `reducedMotion="user"` שייך ל-**05**; 02 מסתמך עליו. |
| `src/services/supabaseSync.ts` (fan-out, `select('*')`, `fetchWorkoutSessions`) | 04-Perf, 08-Data | **08** הבעלים (נכונות); 04 מצרף batching מעל אותו תיקון. בצעו ברצף, 08 קודם. |
| `src/services/webVitals.ts` | 04-Perf, 07-Testing | שייך ל-**04** (לשלוח ל-Sentry); 07 רק מאמת. |
| תאריכי UTC (`Nutrition.tsx`, `Progress.tsx`, `nutritionService.ts`, `insightsAggregator.ts`) | 08-Data, 07-Testing | התיקון שייך ל-**08**; 07 מוסיף בדיקות. |
| `package.json` (deps: `ecc-universal`, `impeccable`, `dompurify`) | 03-Security, 06-Arch | **03** הבעלים. |
| `SwipeComplete.tsx` | 02-Motion, 06-Arch | **06 קבע שזה dead code** (15KB, לא מיובא). ⚠️ אם 06 ימחק אותו — אל תתקן בו RTL (02). תאם: או שמוחקים, או שמתקנים. בררו לפני. |
| z-index (`constants/zIndex.ts`, `tailwind.config.js`) | 06-Arch | שייך ל-**06** בלבד. |
| `tailwind.config.js` (צבעים hardcoded) | 01-Design, 06-Arch | שייך ל-**01**. |

---

## הגדרת סיום כוללת (Definition of Done לכל התיק)

- כל הממצאים בדרגת Critical ו-High טופלו או תועדו במפורש כ"נדחה ולמה".
- `npm run verify && npm run test:run` ירוקים.
- שינויי DB עברו על branch + `get_advisors` נקי.
- אין רגרסיה בתחומים אחרים (בדוק את מטריצת החפיפות).
