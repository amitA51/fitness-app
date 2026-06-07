# שיפוץ ממשק המאמן — תוכנית מלאה

> **סטטוס:** בביצוע (התחלה 2026-06-07).

---

## ⚠️ סקילים — חובה לסשן הביצוע

הסוכן המבצע (וכל סוכני המשנה שלו) **חייב** להפעיל את הסקילים האלה דרך ה-Skill tool לפני העבודה הרלוונטית — לא לעבוד "מהזיכרון":

| סקיל | מתי להפעיל | הכללים הקריטיים שחולצו ממנו (תקציר מחייב) |
|------|------------|---------------------------------------------|
| `hebrew-content-writer` | לפני כתיבת/עריכת **כל** מחרוזת עברית חדשה (כפתורים, שגיאות, empty states, aria-labels, טוסטים) | register של UX = ציווי קצר וישיר (dugri); כתיב מלא עקבי; התאמת מין מספר–שם-עצם (1–10 הפוכים!); בלי calques ("זה עושה סנס"→"זה הגיוני", "בכדי"→"כדי"); ניסוח ניטרלי-מגדרית כשאפשר ("יש ללחוץ"/"ניתן לבחור") **אבל** — לשמור עקביות עם ה-register הקיים באפליקציה (ציווי: "הזמן מתאמן", "התחל אימון") |
| `hebrew-rtl-best-practices` | לפני כל עבודת layout/bidi חדשה | רק logical properties (`ms-/me-/ps-/pe-`, `marginInlineStart`); flip אייקוני כיוון עם `:dir(rtl)`/`rtl:-scale-x-100` — אבל **לא** ✓/✕/Play; מספרים+קודים+תאריכים שעלולים להתהפך → `<span dir="ltr">`; **תוכן שמשתמש יצר (שמות מתאמנים, גוף הודעות, שמות קבוצות) → `<bdi>` או `dir="auto"`** — מתאמן עם שם באנגלית או הודעה מעורבת עברית/אנגלית לא יישברו; box-shadow/gradient לא מתהפכים לבד |
| `israeli-accessibility-compliance` | לפני כל עבודת a11y (שלבים 1e, 2, 5) | aria-labels בעברית; שגיאות טופס inline עם `role="alert"` + `aria-describedby` (לא רק טוסט); עדכונים דינמיים → `aria-live="polite"`; `aria-pressed` **רק** לטוגל בינארי — לבורר רב-מצבים (מצב רוח/אנרגיה 1–5) השם הנגיש נושא את הערך; שדות מספריים `dir="ltr"` + `inputmode="numeric"`; פונט עברי נראה דק יותר — לא להתקמצן בניגודיות |
| `impeccable` | שלב 5 — הסיור החי | critique ויזואלי + a11y על כל מסך שנגענו בו |

בנוסף: לפני סיום כל שלב — ה-checklist של `.claude/rules/common/ui-preflight.md` (קריאה חוזרת של כל מחרוזת, dvh, מצבי UI, קונטרסט).

---

## הקשר (Context)

פלטפורמת המאמן בנויה ברובה — DB מלא (check-ins, audit, reminders, rate-limits),
שירותים ב-`src/services/coach/*`, דפים ב-`src/pages/coach/*` + `src/pages/MyCoach.tsx`.
סריקת 3 סוכני חקירה (2026-06-06) מצאה:

1. **אין כניסה מ-Settings** — משתמש קיים לא יכול לגלות/להפעיל מצב מאמן (רק ב-onboarding).
2. **יכולות שרת בלי ממשק:** תזכורות (`reminderService` — 0 שימושים), יומן פעולות (`listAudit` — 0 שימושים), ספירת לא-נקראו (`getUnreadCount` — רק ב-BottomNav).
3. **Push לא מחווט:** `subscribeToPush()` קיים ואף אחד לא קורא לו; אין טוגל; אין מפתחות VAPID ב-env. מתאמנים לא מקבלים התראות כשהאפליקציה סגורה.
4. **תוכנית רב-יומית נקטעת:** `ProgramBuilder` שומר `payload.days[]` אבל `MyCoach` מציג רק "התחל אימון" אחד (יום 1).
5. **פערי UX/a11y:** אין מצבי שגיאה ברשימות, אין אישור לפני ביטול שיוך, ProgramBuilder בלי ולידציה, חוסרים ב-aria/dir.

**מטרה:** לסגור את הפערים בסדר של ערך מורגש, בלי לשבור את חוויית המתאמן.

## עובדות מאומתות (נבדקו בקוד)

- `checkInService` כבר תומך ב-`energy` מקצה לקצה — חסר רק שדה בטופס.
- `ProgramBuilder` כבר שומר `payload.days: [{templateId, name}]` — חסר רק רינדור ב-MyCoach.
- `createAssignment` payload חופשי — מאקרוז לא דורשים שינוי שירות.
- `reminderService` + `auditService` ממומשים ומיוצאים — צריך רק UI.
- `profileService` חסר `updateMyCoachProfile` (businessName/bio) — פונקציה חדשה אחת + טסט.
- `MyCoach.tsx` מגדיר `SectionError` מקומי כפול (~שורה 305) — זהירות בעריכה.
- `ConfirmDialog` קיים (props: isOpen/onConfirm/onCancel/title/description/confirmLabel/cancelLabel/variant) — בשימוש ב-CoachGroups.
- אין `VITE_VAPID_PUBLIC_KEY` ב-`.env`/`.env.local` — ראו נקודת החלטה 1.

## שערי אימות (אחרי כל שלב)

`npm run typecheck` · `npm run lint:check` (בלי ממצאי a11y חדשים) · `npm run test:run` · `npm run build`

## כללים רוחביים

עברית תקינה לפי `hebrew-content-writer`; מספרים `dir="ltr"`; תוכן user-generated ב-`<bdi>`/`dir="auto"`;
כפתורי-אייקון עם `aria-label` עברי; רק טוקנים `var(--fs-*)` (בהיר+כהה); Lucide בלבד;
נתוני מתאמן אצל המאמן רק דרך `coachApi` (לא IndexedDB של המאמן);
קבצים < 800 שורות; פונקציות שירות חדשות מקבלות טסטים.

---

## שלב 1 — ניצחונות מהירים + a11y (6 קבוצות קבצים, מקביל מלא)

| # | קובץ | שינוי |
|---|------|-------|
| 1a | `CoachHome.tsx` | באדג' לא-נקראו על QuickLink "הודעות" (`useUnreadMessages` הקיים; המספר `dir="ltr"`, מוסתר ב-0, `aria-label` למשל "3 הודעות שלא נקראו"); `aria-pressed` על צ'יפי תגיות (בינארי — מותר); מספרי סטטיסטיקה `dir="ltr"`; **שמות מתאמנים ב-`<bdi>`** |
| 1b | `CoachHome.tsx`, `CoachGroups.tsx` | `SectionError` (קיים ב-`_shared.tsx`) עם retry כשטעינת רשימה נכשלת |
| 1c | `ClientDetail.tsx` | `ConfirmDialog variant="warning"` לפני ביטול שיוך ("ביטול שיוך" / "השיוך יוסר מהמתאמן.") |
| 1d | `ProgramBuilder.tsx` | ולידציה לפני שליחה (≥1 תרגיל, שם לכל יום) — שגיאה **inline עם `role="alert"`** ליד האזור הבעייתי (לא רק טוסט); חיווי כשטעינת ספריית התרגילים נכשלת; הרחבת שדות סטים/חזרות 60→72px (גובה מגע 44px); לוודא `inputmode="numeric"` + `dir="ltr"` |
| 1e | `ClientDetail.tsx`, `CoachGroups.tsx`, `MessageThread.tsx` | `role="img"`+`aria-label` עברי לגרף נפח; `aria-expanded` + הדגשת בחירה על שורת קבוצה; `disabled` אמיתי על כפתור שליחה; **גוף הודעות בצ'אט ב-`dir="auto"`**; **הודעה נכנסת חדשה מוכרזת ב-`aria-live="polite"`** (region מחוץ למיכל שמתחלף) |
| 1f | `CoachMessages.tsx` | בסיס: `SectionError` + אינדיקטור לא-נקרא לכל שורה (חיפוש+preview → שלב 4) |

**קבלה:** באדג'ים מוצגים; retry עובד ב-3 רשימות; ביטול שיוך דורש אישור; תוכנית ריקה נדחית עם שגיאה inline; שערים ירוקים.

---

## שלב 2 — אינטגרציית Settings + הפעלת Push

**שירות חדש (+טסט):** `updateMyCoachProfile(updates: Partial<Pick<CoachProfile,'businessName'|'bio'>>)`
ב-`profileService.ts` — upsert ל-`coach_profiles`, guards של offline/unauth כמו `updateMyProfile`.
טסט חדש `src/services/coach/__tests__/profileService.test.ts` בסגנון `coach.test.ts`.

**סקשן חדש:** `src/pages/settings/sections/CoachSection.tsx` —
- לא-מאמן: כפתור "הפעלת מצב מאמן" + שורת הסבר קצרה (קופי ישיר, בלי ריפוד).
- מאמן: עריכת שם עסק + ביו עם autosave (`SavedIndicator`) + שורת קישור ל-`/coach`. שם עסק עשוי להיות באנגלית → השדה `dir="auto"`.
- תבנית: `SectionLabel` + `SettingsCard` + `SettingsRow` (כמו `GuidanceSection`).
- מיקום ב-`Settings.tsx`: אחרי WorkoutPrefs, לפני Notifications.

**טוגל Push (תיקון ה-NOT-WIRED):** ב-`NotificationsSection.tsx` שורה "התראות בזמן אמת" +
`SettingsToggle`; ב-`useSettingsState.ts`: `pushEnabled` + `togglePush()` — הפעלה קוראת `subscribeToPush()`
וממפה שגיאות (`unsupported`/`denied`/`no_vapid_key`/`offline`) להודעות עברית ברורות;
כיבוי קורא `unsubscribeFromPush()`. דחיית הרשאה בדפדפן ≠ שגיאת מערכת — קופי בהתאם.

**קבלה:** הפעלת מצב מאמן ועריכת פרופיל מ-Settings עובדות; הטוגל באמת קורא ל-`subscribeToPush`; שערים ירוקים.

---

## שלב 3 — שדרוג צד המתאמן (קובץ יחיד: `MyCoach.tsx`)

- **3a רב-יומי:** שיוך `program` עם `payload.days` מציג כפתור "התחל" לכל יום (שם היום ב-`<bdi>` + Play — **לא להפוך את ה-Play ב-RTL**; מטרות מגע 44px); fallback לכפתור יחיד כשאין `days`. כל כפתור: `syncTemplatesFromCloud()` → `/workout/{templateId}`.
- **3b אנרגיה:** בורר אנרגיה 1–5 ב-`CheckInForm` במראה בורר מצב הרוח הקיים; כל כפתור נושא `aria-label` עם הערך; מועבר ל-`submitCheckIn` (השירות כבר תומך).
- **3c מאקרוז בתצוגה:** שורות `nutrition_target` מציגות חלבון/פחמימה/שומן מה-payload (guards של typeof-number), מספרים `dir="ltr"`.
- זהירות: `SectionError` מקומי כפול בקובץ.

**קבלה:** N כפתורי-יום פותחים את התבניות הנכונות; אנרגיה נשמרת ונראית אצל המאמן ב-ClientDetail; מאקרוז מוצגים; שערים ירוקים.

---

## שלב 4 — השלמת פיצ'רים בצד המאמן

**4a חילוץ קודם (שמירת גודל):** `ClientDetail.tsx` הוא 486 שורות — לפני הוספות, לחלץ
`AssignBox` / `AssignmentsBox` / `NotesBox` אל `src/pages/coach/client/*` (רפקטור טהור, ירוק לפני המשך).

| # | מה | קבצים | הערות |
|---|----|-------|-------|
| 4b | הודעות עם preview + חיפוש | שירות חדש `listClientThreads()` (+טסט) + `CoachMessages.tsx` | שאילתה אחת מצומצמת ב-JS — בלי N+1, בלי מיגרציה; preview של גוף הודעה ב-`dir="auto"` |
| 4c | תזכורות למתאמן | חדש `client/RemindersBox.tsx` | `reminderService` הקיים; שעה + ימי שבוע; מחיקה עם `ConfirmDialog`; שעות `dir="ltr"` |
| 4d | יומן פעולות | חדש `client/AuditBox.tsx` | `listAudit()` קיים; Section מכווץ כברירת מחדל; תוויות עברית עם fallback לערך גולמי |
| 4e | מאקרוז בשיוך תזונה | `client/AssignBox.tsx` (המחולץ) | שדות אופציונליים חלבון/פחמימה/שומן ב-payload — בלי שינוי שירות; `inputmode="numeric"` `dir="ltr"` |
| 4f | שיפורי קבוצות | `CoachGroups.tsx` (+אופציונלי `getGroupMemberCounts` בשירות) | ספירת חברים, בחר-הכל/נקה-הכל; שמות קבוצות ב-`<bdi>` |

**קבלה:** רפקטור ירוק לפני פיצ'רים; כל פיצ'ר עובד; אף קובץ > 800 שורות; טסטים עוברים.

---

## שלב 5 — אימות חי סופי

1. להפעיל את הסקיל `impeccable` (critique mode) על מסכי המאמן + MyCoach + Settings.
2. `npm run dev` + סיור דפדפן (chrome-devtools MCP) על כל מסך שנגענו בו — בהיר **וגם** כהה, צילומי מסך.
3. בדיקות מהסקילים: מתאמן עם שם אנגלי ברשימה לא שובר את השורה; הודעה מעורבת עברית/אנגלית מיושרת נכון; ניווט מקלדת מלא (Tab) בכל מסך חדש; קונסול נקי.
4. קריאה חוזרת של **כל** מחרוזת עברית חדשה (checklist של ui-preflight + `hebrew-content-writer`).
5. הרצה חוזרת של כל 4 השערים.

---

## נקודות החלטה פתוחות

1. **תשתית Push** — מומלץ: גם להקים (מפתחות VAPID, secrets ב-Supabase דרך MCP, `VITE_VAPID_PUBLIC_KEY` ב-env). חלופה: רק ממשק + טיפול בשגיאות.
2. **היקף שלב 4** — מומלץ: הכל (4a–4f).
3. שם עסק ריק מותר בהפעלת מצב מאמן (תואם onboarding) — ברירת מחדל: כן.
4. בורר ימים רב-יומי: כפתורים נערמים inline (מוצע), לא אקורדיון.

## מפת מקבול (לסוכני משנה)

- שלב 1: 6 קבוצות קבצים נפרדות — מקביל מלא. **כל סוכן מקבל בהנחיות שלו את תקציר כללי הסקילים מהטבלה למעלה.**
- שלב 2: שירות+טסט ∥ CoachSection ∥ (Notifications+useSettingsState+Settings כיחידה אחת).
- שלב 3: סוכן יחיד (קובץ אחד).
- שלב 4: 4a קודם → אז 4b ∥ 4f ∥ {4c,4d,4e}.
- שלב 5: סדרתי.

## קבצים קריטיים

- `src/pages/coach/ClientDetail.tsx` — אישור ביטול, a11y, חילוץ, תזכורות+יומן (הכבד ביותר)
- `src/pages/MyCoach.tsx` — כל ערך צד-המתאמן (זהירות מ-SectionError כפול)
- `src/pages/settings/hooks/useSettingsState.ts` + `sections/NotificationsSection.tsx` — חיווט Push
- `src/services/coach/profileService.ts` — `updateMyCoachProfile` חדש + טסט
- `src/pages/coach/ProgramBuilder.tsx` — ולידציה; במעלה הזרם של הרב-יומי
