# קוד-רּיוויו — ברנץ' UX Overhaul Loop (2026-06-21)

> **מטרת הקובץ:** לאפשר לסשן חדש לעבור על *כל* העבודה שנעשתה בברנץ' הזה, לוודא שהכול תקין,
> ולא "לתקן" בטעות דברים שנדחו בכוונה. קרא קודם את החלק **⚠️ אל תתקנו** לפני שמתחילים.

- **ברנץ':** `ux/overhaul-loop-2026-06-21`
- **בסיס (base):** `d895c59` ("new", שכבר כלל את הלולאה הקודמת)
- **HEAD נוכחי:** `ec9c47d`
- **היקף:** 27 קומיטים · 50 קבצים · נטו ‎−110 שורות (1219+ / 1329‑) — מחקנו יותר ממה שהוספנו (זיקוק/ניקוי).
- **אסטרטגיית git:** קומיט לכל באטץ' קוהרנטי · **לא לדחוף (no push)** — המשתמש סוקר מקומית.
- **לוג מלא לפי איטרציה:** `~/.claude/.../memory/loop-ux-overhaul-2026-06-21.md` (פירוט מלא לכל החלטה).

---

## 1. איך מריצים את הרּיוויו (שערי איכות)

```bash
npm run typecheck       # מצב נוכחי: 0 שגיאות ✅
npx vitest run          # מצב נוכחי: 1043 טסטים / 110 קבצים — ירוקים ✅
npm run lint            # biome check ./src  (חוב lint ישן יתכן — לא מהשינויים האלה)
git --no-pager diff --stat d895c59..HEAD     # היקף הקבצים
git --no-pager diff d895c59..HEAD -- <file>  # דיף מלא לקובץ ספציפי
```

**הערה על "modified" ב-`git status`:** ‏~19 קבצים מופיעים כ-modified אבל הם **רעש סופי-שורה
(LF→CRLF) בלבד** — אפס שינוי תוכן. אמת עם `git diff --numstat` (יחזיר 0 לקבצים האלה).

---

## 2. הקומיטים לסקירה (מקובצים לפי נושא)

**ניווט / IA**
- `5f38b8d` חזרה (back) מחזירה לרשימת-המקור ולא לבית (WorkoutDetail + MyCoach)
- `76e4a1f` קיבוץ גיליון "עוד" + כתוביות הבחנה (תוכנית מובנית מול תבניות)
- `35c4f02` MyCoach — היררכיה תלוית-מצב (קוד-חיבור יורד למטה כשכבר מחובר)

**זיקוק / הפחתת עומס (distill)**
- `9f59c65` Dashboard — hero-first, הסרת כרטיסים כפולים (ForecastNudge, CommunityCard)
- `e7982e6` Nutrition — ציר-תאריך למעלה, הסרת תאריך/אחוז כפולים
- `17e0a8a` Workout — ניקוי מסך הסט-החי, 5 כלים מאחורי גיליון "כלים" אחד (`WorkoutToolsSheet.tsx`)
- `e7750b6` Dashboard — תמצית-מאמן איכותית (לא חוזרת על המספר מעל)

**SSOT / קוהרנטיות ויזואלית**
- `2fea623` טוהר צבע-סמנטי ב-3 משטחים (on-accent ink)
- `890d12d` כותרות סקשנים ב-Settings על דרגה אחת (+תיקון typo מונו-עברית)
- `696303c` **PageHeader חדש** (`src/components/ui/PageHeader.tsx`) — איחוד אשכול הכותרות הקלות
- `827b11b` OverviewTab מאמץ `SectionCard` משותף + הסרת חלון-משקל כפול
- `690aead` Settings IA — PageHeader, jump-nav מלא, dedup פרופיל, הפרדת danger-zone
- `9529821` / `5bfd2b7` / `bd2c406` / `2e4b23f` / `323c703` — **אימוץ Card/EmptyState SSOT** (איטרציה 8, 17 המרות)
- `de7f3f3` OverviewTab מאמץ `ChapterBreak` SSOT (איטרציה 9)

**צבע/קוהרנטיות פעולות**
- `bd6e6f9` טיפול-פריימרי אחד לאורך זרימת ההתחלה (מנטה = קידום אימון)
- `ec9c47d` הסרת המנטה מכפתור "תבנית חדשה" (CRUD, לא התחלת-אימון) — איטרציה 9

**Onboarding / תוכן עברי**
- `91cd7bc` מעבר קוהרנטיות — selected-token, פס-התקדמות יחיד, קופי ניטרלי-רבים

**מתמטיקה/ניקוי קוד**
- `919dd01` מילה אחת להתאוששות (`התאוששות` בכל מקום, לא `ריקאברי`)
- `b62a757` הסרת `calPct` שלא בשימוש מ-`useNutritionData`

**פורמט (biome, ללא משמעות לוגית)**
- `da4433a` · `8c257b3` · `dbea31a` · `d9daddf`

---

## 3. ✅ צ'קליסט סקירה ממוקד (מה לוודא)

- [ ] **PageHeader (`696303c`, `690aead`)** — Nutrition / Templates / Community / PublicProfile / Settings מאמצים את `<PageHeader>`. ב-Settings לוודא ש-`SETTINGS_HEADER_OFFSET=92` ו-`SECTION_SCROLL_MARGIN=136` עדיין תקפים (גובה הכותרת חוזה-פריסה ל-JumpNav).
- [ ] **Card/SectionCard SSOT (איטרציה 8)** — לוודא ש-role/aria הועברו דרך `...props` היכן שצריך (Card הוא `<div>`), ושאף משטח-זכוכית (glass) לא הומר בטעות.
- [ ] **ChapterBreak (`de7f3f3`)** — OverviewTab משתמש ב-`<ChapterBreak title="סקירה" />` בשני המקומות (empty + populated); הפלט זהה לשאר הטאבים.
- [ ] **WorkoutToolsSheet (`17e0a8a`)** — 5 הכלים (plates/edit-sets/drop/alternatives/superset) מאחורי שבב "כלים" אחד; RPE + הוסף-סט נשארו inline; השורה מצטמצמת במצב "הושלם".
- [ ] **a11y / RTL / דו-מצב (חובה לכל שינוי UI):**
  - [ ] קונטרסט AA בשני המצבים (Fresh Steel בהיר / Obsidian כהה) — במיוחד טקסט-על-מנטה (`--color-ink-on-accent`).
  - [ ] מספרים `dir="ltr"`; כפתורי אייקון-בלבד עם `aria-label` עברי.
  - [ ] אין `min-h-screen` ללא `min-h-[100dvh]`.
  - [ ] אין hex מותג קשיח — הכול דרך `var(--fs-*)`.

---

## 4. ⚠️ שינויים ויזואליים **מכוונים** (לא רגרסיות — אל תחזירו אחורה)

git הוא רשת-הביטחון, אז נעשו שינויים נראים-לעין בכוונה. אלה **לא** באגים:

| קומיט | השינוי המכוון | למה |
|---|---|---|
| `323c703` | רכבות (rails) ב-WorkoutDetail עברו מ‑physical `left:0` ל‑logical start (ימין ב-RTL) | תיקון קוהרנטיות RTL — כל הרכבות באותו קצה |
| `323c703` | מצב-שגיאה: עיגול-משקולת → `EmptyState illustration="error"` + כפתור navy חד | אימוץ SSOT |
| `ec9c47d` | כפתור "תבנית חדשה": גרדיאנט מנטה → navy רגיל | מנטה שמורה ל"קידום אימון" בלבד; CRUD = navy |
| `bd6e6f9` | CTA במסך התוכנית הפך ל-solid mint / ink-on-accent | "מנטה = קדם את האימון" עקבי pre→plan→finish |
| `91cd7bc` | onboarding: הוסר פס-ההתקדמות העליון (נשארו רק הנקודות); הוסר uppercase מכותרות עברית; קופי → רבים ניטרלי | התקדמות כפולה / typography עברית / מגדר |
| `e7982e6` | Nutrition: DateNavigator עלה למעלה; הוסר סרט "% מהיעד"; הוסרה כותרת "ארוחות" עגולה | זיקוק עומס |
| `9f59c65` | Dashboard: הוסרו ForecastNudge + CommunityCard; סדר hero-first | זיקוק עומס |
| `690aead` | Settings: הוסר באנר-אווטאר דקורטיבי בבלוק הפרטים הפרטי; שם הבלוק → "פרטים אישיים" | dedup ויזואלי (נתיבי-נתונים לא נגעו) |
| `35c4f02` | MyCoach: קוד-החיבור יורד לתחתית כשכבר מחובר | היררכיה תלוית-מצב |
| `919dd01` | "ריקאברי" → "התאוששות" בכל ה-UI של Progress | מילה אחת עקבית |

---

## 5. 🚫 אל תתקנו — נדחו בכוונה (false positives / YAGNI מאומתים)

הקוד מוקפד. הפריטים הבאים סומנו ע"י סוכנים אבל **אומתו מול הקוד כלא-תקלות**. "תיקון" שלהם = churn מזיק:

- **`.fs-accent-rail`** — הפס הצבעוני כבר הוסר אפליקציה-רחב; היום זה רק `position:relative;overflow:hidden` (containment). לא לגעת.
- **`WorkoutBottomBar` N/M** — חיזוק bidi מכוון על הפעולה הראשית, לא כפילות.
- **איחוד תוכנית/תבניות** — מסכים שונים באמת (תוכנית מובנית 12-שבועות מול ספריית-משתמש); ל-/templates 5+ deep-links מ-Dashboard. שינוי מסוכן, נדחה.
- **Nutrition "3 דלתות"** — FAB+empty = מודאל אחד (render בלעדי-הדדי); ספרייה/פריסטים = זרימות שונות מאחורי טאבים. עטיפת הגרפים = רמת-קינון 3 (אסור לפי anti-slop).
- **Button SSOT** — `Button.tsx` כבר ה-SSOT עם סמנטיקה מכוונת מנטה/navy. רק הדליפה ב-Templates הייתה אמיתית (תוקנה).
- **BodyTab lead VerdictLine** — טאב רב-מצבי, verdict ברמת-טאב = referent שגוי.
- **RecoveryTab "triple-print"** — היררכיה מכוונת (verdict→hero→detail).
- **Premium card ב-Settings** — מקשר ל-/paywall אמיתי ועובד; outlier ב-IA בלבד.
- **CompleteStep static coach cards** — לא-אינטראקטיביים בכוונה (אין btn/chevron/cursor).

---

## 6. 📋 פתוח / לעשות בהמשך (TODO)

- **AW-1 (M, הוקפא):** שני סימוני Check במנטה במסך הסט-החי (header finish מול slide-to-complete). הפיקס נוגע ב-slider החתימה ויש לו קובץ-טסט → **דורש QA על מכשיר אמיתי** לפני נגיעה. סיכון-לאומנות גבוה.
- **flat Card variant (הוקפא):** אין וריאנט חסר-צל ל-`Card` (elevated/sunken/floating כופים boxShadow). הוספת `flat:{bg,border,boxShadow:none}` נקייה ואדיטיבית, אבל רק ~3-5 כרטיסי onboarding יתכנסו נקי (השאר: border/landmark/overflow שונים) → תועלת נמוכה. לשקול רק אם יצטברו עוד משטחים שטוחים. **לא להוסיף וריאנט שלא בשימוש (YAGNI).**
- **CSS dedup (low pri):** `.btn-primary` מוגדר פעמיים — `global.css:148` (מראה מלא) + `components.css:149` (מוסיף box-shadow + hover/active), עם radius/padding סותרים. סמל-ריח אמיתי אבל blast-radius אפליקציה-רחב → צריך diff ויזואלי בשני המצבים. הוקפא.
- **latent (לא נראה למשתמש):** `src/pages/onboarding/types.ts` — שדות `title/subtitle` ב-STEPS הם metadata מת (רק `id` מרונדר). קופי-מגדר שם הושאר. לנקות רק אם STEPS title יחווט אי-פעם ל-UI.

---

## 7. המלצת זרימת רּיוויו לסשן הבא

1. הרץ את שלושת השערים (סעיף 1) — ודא שהבסיס ירוק לפני שמתחילים.
2. עבור על הקומיטים לפי נושא (סעיף 2), עם `git diff d895c59..HEAD -- <file>`.
3. לכל שינוי UI — בדוק את צ'קליסט a11y/RTL/דו-מצב (סעיף 3) ב-`npm run dev`.
4. כשאתה רואה "delta" נראה-לעין — בדוק קודם בסעיף 4 אם הוא מכוון לפני שתסמן רגרסיה.
5. אל תפתח מחדש את סעיף 5 (נדחו מאומתים).
6. אם הכול תקין — אפשר push / merge ל-master לפי החלטת המשתמש.
