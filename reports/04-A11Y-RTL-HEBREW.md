# דוח נגישות, RTL וקופי עברי

## תקציר מנהלים

**הכרעה:** אין ממצא P0 מאומת בבדיקת קוד זו, אך המוצר **אינו מוכן לפרסום עם הצהרת הנגישות הנוכחית**. נמצאו שלושה ממצאי P1: ניגודיות כושלת ברכיבים פעילים, סמנטיקת מקשי חצים הפוכה בטאבים ב־RTL, וטענות התאמה בהצהרת הנגישות שאינן נתמכות בראיות הקוד. נמצאו גם פערי P2 ביעדי מגע, BiDi, היררכיית כותרות, סמנטיקת טבלה וכיסוי אוטומטי.

הבדיקה בוצעה על קוד פעיל בלבד תחת `src/**`, `e2e/**`, `index.html`, `package.json` וקובצי סגנון חיים. מסמכי `plans/**`, `improvements/**`, `docs/**` וקובצי Markdown בשורש לא שימשו ראיה. רכיבים ללא ייחוס פעיל, למשל `AnimatedProgressRing` ו־`ProfileAvatar`, לא סווגו כממצאים למרות חולשות מקומיות בהם.

לצורך המיפוי: האפליקציה עצמה מצהירה על IS 5568 המעוגן ב־WCAG 2.0 AA (`src/pages/AccessibilityStatement.tsx:99-102`). WCAG 2.2, ובפרט יעד המגע של 44px, מצוינים כאן כיעד מוצר/שיפור משלים ולא כהצהרה משפטית על חובת תקן ישראלי. זו הערכת קוד ותוכן, לא חוות דעת משפטית או בדיקת קורא מסך ידנית.

הבסיס ההנדסי טוב: `lang="he" dir="rtl"` ברמת המסמך (`index.html:2`), skip link ו־`main` ממוקד (`src/AppRouter.tsx:724-811`), focus trap משותף לדיאלוגים (`src/hooks/useFocusTrap.ts:55-139`), שדות טופס עם שגיאות נגישות (`src/components/ui/Input.tsx:55-144`, `src/components/ui/Textarea.tsx:37-86`), והפחתת תנועה גלובלית (`src/App.tsx:15-26`, `src/styles/global.css:914-922`).

## טבלת ניגודיות עם מספרים

ערכי הטוקנים נלקחו מ־`src/styles/tokens.css:16-28,89-92,371-382,455-457` והיחסים חושבו מקומית לפי sRGB/WCAG. דרישת AA לטקסט רגיל היא `4.5:1`; לרכיבי ממשק ולגרפיקה משמעותית נדרשים לפחות `3:1`.

| ערכת נושא | צמד טוקנים | יחס | פסק דין |
|---|---|---:|---|
| בהירה | `--fs-ink` על `bg / surface / surface-2` | `14.43 / 16.19 / 12.67:1` | עובר AA |
| בהירה | `--fs-muted` על `bg / surface / surface-2` | `6.25 / 7.01 / 5.49:1` | עובר AA |
| בהירה | `--fs-accent` על `bg / surface / surface-2` | `1.88 / 2.11 / 1.65:1` | נכשל לטקסט ולרכיב UI; אין להשתמש בו לטקסט על משטחים בהירים |
| בהירה | `--fs-link` על `surface` | `6.62:1` | עובר AA; זהו הטוקן הייעודי לקישורים |
| בהירה | `--color-ink-on-accent` על `--fs-accent` | `8.90:1` | עובר AA |
| בהירה | `--fs-warn` על `surface` | `3.21:1` | נכשל לטקסט רגיל; מתאים לכל היותר לטקסט גדול |
| בהירה | `--fs-error` על `surface` | `4.64:1` | עובר AA לטקסט רגיל |
| כהה | `--fs-ink` על `bg / surface / surface-2` | `18.43 / 16.57 / 15.27:1` | עובר AA |
| כהה | `--fs-muted` על `bg / surface / surface-2` | `6.25 / 5.62 / 5.18:1` | עובר AA |
| כהה | `--fs-accent` על `bg / surface / surface-2` | `12.27 / 11.03 / 10.17:1` | עובר AA |
| כהה | `--fs-error` על `surface` | `6.53:1` | עובר AA |
| שימוש פעיל: Paywall | `--fs-accent` על `--fs-surface-2` במצב joined | `1.65:1` בהיר | נכשל טקסט ורכיב UI; `src/pages/billing/PaywallScreen.tsx:161-185` |
| שימוש פעיל: PlanSetRow | `--fs-heading` על `--fs-accent` בכפתור `+` | `1.50:1` כהה | נכשל גרפיקה משמעותית; `src/components/workout/components/PlanSetRow.tsx:108-110` |

ההערה ליד הטוקן עצמו כבר אוסרת שימוש ב־`--fs-heading` על מילויי accent/primary (`src/styles/tokens.css:88-92`); לכן מדובר גם בפער ביישום חוזה העיצוב, לא רק בבחירת צבע נקודתית.

## ממצאי P0

| בעיה | file:line | תקן/סעיף | תיקון מדויק |
|---|---|---|---|
| לא אותר ממצא חוסם־פרסום P0 שניתן להוכיח מקריאת קוד פעיל. אין להסיק מכך כיסוי מלא של מסלולי קורא מסך, מכשירים או שירותי צד שלישי. | — | — | להריץ את בדיקות ה־P1/P2 ואת בדיקת ה־AT הידנית המתוארת בבק־לוג לפני אישור פרסום. |

## ממצאי P1

| בעיה | file:line | תקן/סעיף | תיקון מדויק |
|---|---|---|---|
| ניגודיות נכשלת ברכיבים פעילים: הודעת waitlist צובעת טקסט, אייקון וגבול ב־`--fs-accent` על `--fs-surface-2`; כפתור הוספה לסט משתמש ב־`--fs-heading` על accent במצב כהה. היחסים הם `1.65:1` ו־`1.50:1` בהתאמה. | `src/pages/billing/PaywallScreen.tsx:161-185`; `src/components/workout/components/PlanSetRow.tsx:108-110`; `src/styles/tokens.css:16-28,88-92,371-382,455-457` | WCAG 2.0 SC 1.4.3 (ניגודיות טקסט) ו־SC 1.4.11 (ניגודיות רכיבים); בסיס IS 5568 כפי שהאפליקציה מצהירה. | ב־Paywall להחליף את צבע ה־status ל־`var(--fs-link)` או לשנות למילוי accent עם `var(--color-ink-on-accent)`; בכפתור הסט להשתמש ב־`var(--color-ink-on-accent)`. להוסיף בדיקת theme/contrast לרכיבי accent כדי למנוע `--fs-heading` על accent. |
| בטאבים פעילים ב־RTL, `ArrowRight` מקדם במערך ו־`ArrowLeft` מחזיר; עבור סדר קריאה עברי הכיוון צריך להיות הפוך. התקלה קיימת ברכיב משותף וגם בשתי tablists ראשיות. | `src/pages/progress/components/SegmentedControl.tsx:29-40`; `src/pages/Progress.tsx:193-210`; `src/pages/Nutrition.tsx:194-211`; שימושים פעילים: `src/pages/progress/tabs/WorkoutsTab.tsx:142,158`, `src/pages/progress/tabs/BodyTab.tsx:398,429` | WCAG 2.0 SC 2.1.1 ו־SC 2.4.3; תבנית ARIA Tabs ב־RTL. | לחלץ helper יחיד: `const forwardKey = isRTL ? 'ArrowLeft' : 'ArrowRight'`; `forwardKey` עובר לטאב הבא והמקשי השני לקודם. להשתמש בו בשלושת האתרים ולבדוק RTL וגם LTR. |
| הצהרת הנגישות מפרסמת "ניווט מלא" ויחס `4.5:1` לכל טקסט, אף שהקוד מכיל את שני הכשלים לעיל. היא גם מסמנת TODO עבור זהות רכז/ת הנגישות, אך מפרסמת את שם המותג בלבד. | טענות: `src/pages/AccessibilityStatement.tsx:155-176`; איש קשר/TODO: `src/pages/AccessibilityStatement.tsx:224-242`; ראיות סותרות: `src/pages/billing/PaywallScreen.tsx:161-185`, `src/pages/progress/components/SegmentedControl.tsx:29-40` | חובת הצהרה מדויקת ושקופה לפי מסגרת הנגישות הישראלית; IS 5568/WCAG 2.0 AA כבסיס מוצהר. | לעצור את טענות ההתאמה הגורפות עד לתיקון ולאימות; לפרסם מגבלות ידועות קונקרטיות; להשלים שם, תפקיד וערוצי קשר מאומתים של רכז/ת, ולתת אישור משפטי/תפעולי לניסוח "60 ימי עסקים". יש דוא״ל ותאריך עדכון קיימים (`src/pages/AccessibilityStatement.tsx:228-256`), אך הם אינם מחליפים את ההשלמות. |

## ממצאי P2

| בעיה | file:line | תקן/סעיף | תיקון מדויק |
|---|---|---|---|
| יעדי מגע אינטראקטיביים קטנים מחוזה המוצר `44×44`: טאב משני 32px, סגירת Sheet 36px, פעולות MyCoach 36px ו־28px, וכפתור חזרה ב־Paywall 40px. החיפוש מצא דפוס נוסף של 28/36px ברכיבים פעילים. | `src/pages/progress/components/SegmentedControl.tsx:73`; `src/components/ui/Sheet.tsx:117-118`; `src/pages/MyCoach.tsx:563-564,935-936`; `src/pages/billing/PaywallScreen.tsx:292` | חוזה המוצר; WCAG 2.2 SC 2.5.8 כיעד משלים, לא קביעה אוטומטית של הפרת IS 5568. | להגדיר `--target-min: 44px`; לשמור אייקון חזותי קטן אם רצוי, אך להגדיל את תיבת הלחיצה ל־44px בכל ציר. להוסיף בדיקת style/DOM לרכיבים משותפים. |
| RTL לוגי אינו עקבי: `PageHeader` ממפה `paddingInlineStart` ל־safe area שמאלי, כלומר לקצה הפיזי הלא נכון ב־RTL; פסי הדגשה ו־padding ב־CSS מקובעים פיזית. | `src/components/ui/PageHeader.tsx:74-75`; `src/styles/global.css:704-705,733,758`; `src/styles/components.css:524,528` | חוזה RTL/BiDi; WCAG 2.0 SC 1.3.2 רלוונטי כאשר סדר/משמעות משתנים. | להגדיר CSS variables ל־`--safe-inline-start/end` לפי `[dir]`, ואז להשתמש בהן ב־PageHeader; להחליף פסי `inset: … 0` ב־`inset-block` + `inset-inline-end` ולהחליף padding זוגי ב־`padding-inline`. |
| ריצות LTR אינן מבודדות בכל מקום, וסמל חזרה בדפי התחברות פונה שמאלה אף שהוא פעולה "חזרה" ב־RTL. כתובות דוא״ל מוצגות ללא `<bdi dir="ltr">`; `CSV ו-JSON` מופיע ללא isolation. | `src/pages/login/steps/ForgotPasswordStep.tsx:100-102`; `src/pages/login/steps/SignUpStep.tsx:185-188`; `src/pages/login/steps/SignInStep.tsx:96-97`; `src/pages/login/steps/SignUpStep.tsx:266-267`; `src/pages/login/steps/ForgotPasswordStep.tsx:122-123`; `src/pages/billing/PaywallScreen.tsx:59-61` | חוזה RTL/BiDi; WCAG 2.0 SC 3.1.1 בהיבט שפת הממשק. | לעטוף אימיילים, מזהים ומחרוזות Latin ב־`<bdi dir="ltr">`; להשתמש ב־`ArrowRight` עבור חזרה ב־RTL (כפי שנעשה ב־Paywall: `src/pages/billing/PaywallScreen.tsx:292-297`) ולהסתיר את האייקון מקורא מסך. |
| טבלת ההשוואה אינה נושאת `<caption>`, ותא "לא זמין" מסתמך על `aria-label` על `div` גנרי; שם כזה אינו תחליף טקסט אמין בתא נתונים. | `src/pages/billing/PaywallScreen.tsx:105-117,351-390` | WCAG 2.0 SC 1.3.1. | להוסיף `<caption className="sr-only">השוואת תכונות בין מסלול חינמי לפרימיום</caption>`; להחליף את ה־`div` ב־`<span className="sr-only">לא זמין</span>` לצד המקף הדקורטיבי, או ב־`role="img" aria-label="לא זמין"`. |
| בזרימת onboarding, לאחר מסך הפתיחה האפליקציה מרנדרת את הזרימה לבדה, אך שלבים כגון Role מתחילים ב־`h2`; ה־`h1` קיים רק ב־Welcome/Complete. כך ההצהרה על היררכיה רציפה אינה נכונה לכל שלב. | `src/AppRouter.tsx:279-286`; `src/pages/onboarding/components/ProgressDots.tsx:70-84`; `src/pages/onboarding/steps/RoleStep.tsx:46`; השוואה: `src/pages/onboarding/steps/WelcomeStep.tsx:32`, `src/pages/onboarding/steps/CompleteStep.tsx:123` | WCAG 2.0 SC 1.3.1 ו־SC 2.4.6. | להפוך את כותרת השלב הפעיל ל־`h1` (או להוסיף `h1` ייחודי לכל שלב) ולשמור כותרות משנה ברמת `h2` בלבד. |
| אין gate של axe ב־CI/E2E: axe נטען רק ב־DEV; smoke בודק mount/title/RTL ולא הפרות, ובדיקת Sheet בודקת שם דיאלוג נקודתית בלבד. | `src/main.tsx:81-88`; `e2e/smoke.spec.ts:20-92`; `src/components/ui/Sheet.test.tsx:8-17`; `vitest.config.ts:13-18` | בקרת איכות; אין SC יחיד, אך זו ראיית אי־כיסוי לדרישות WCAG. | להוסיף `@axe-core/playwright` או harness מקביל ל־Playwright לכל route ציבורי וקריטי, ולאכוף `violations.length === 0` או allowlist מתועד וקצר. להוסיף בדיקות Tab/Shift+Tab/Escape, קיצורי חצים RTL וניגודיות theme. |
| קופי פעיל כולל דליפות אנגלית, נטייה לזכר יחיד ו־slash notation; חלקן גם חושפות פרטי קונפיגורציה למשתמש קצה. | `src/components/ui/PremiumSelect.tsx:24`; `src/pages/nutrition/components/MealLog.tsx:101,215`; `src/pages/MyCoach.tsx:244`; `src/pages/login/steps/SignInStep.tsx:227-246`; `src/errors/RootErrorBoundary.tsx:102,123` | איכות Hebrew-first, WCAG 2.0 SC 3.1.1 ו־SC 3.3.1 בהיבטי שפה והנחיית שגיאה. | ליישם את טבלת הקופי שלהלן, לבודד Latin, ולהוסיף בדיקות snapshot/role למחרוזות fallback כדי למנוע חזרת אנגלית לממשק עברי. |

## טבלת שיפורי קופי עברי

| מיקום | מקור → מוצע | נימוק |
|---|---|---|
| `src/components/consent/AgeGate.tsx:140,143` | "מה תאריך הלידה שלך?" / "...לוודא שאתה עומד..." → "מה תאריך הלידה?" / "נשתמש בתאריך כדי לוודא עמידה בדרישת הגיל לשימוש באפליקציה." | מסיר זכר יחיד ושומר על הסבר ענייני. |
| `src/components/consent/ConsentGate.tsx:96,152` | "עדכנו את התנאים שלנו" / "אני מאשר/ת וממשיך/ה" → "התנאים ומדיניות הפרטיות עודכנו." / "אישור והמשך" | מבהיר מה עודכן ומחליף slash notation בפעולה ניטרלית. |
| `src/components/ui/PremiumSelect.tsx:24` | `Select an option` → "בחרו אפשרות" | מסיר fallback באנגלית בממשק עברי. |
| `src/pages/nutrition/components/MealLog.tsx:101,215` וגם `src/pages/nutrition/components/NutritionTrendChart.tsx:58,113` | `KCAL`, `P/C/F` → "קק״ל" ו־"חלבון / פחמימות / שומן" (או קיצור עברי אחיד ומתועד) | מסיר אנגלית לא הכרחית ומונע שפת מדדים לא עקבית. |
| `src/pages/MyCoach.tsx:244` | `My Coach` → "המאמן שלי" או הסרת ה־subtitle אם הוא כפול | מסיר דליפת אנגלית ומיישר לקופי העברי. |
| `src/pages/billing/PaywallScreen.tsx:333,475` | "הרם את האימון שלך..." / "הירשמ/י ... וקבל/י..." → "התקדמו באימון לרמה הבאה" / "מנוי הפרימיום יושק בקרוב. הצטרפו לרשימת ההמתנה וקבלו גישה מוקדמת." | רישום רבים עקבי, טבעי וניטרלי מגדרית. |
| `src/pages/Dashboard.tsx:952` | "יש לך קוד הזמנה ממאמן? התחבר כדי לקבל..." → "יש לכם קוד הזמנה ממאמן? התחברו כדי לקבל..." | מיישר לרישום רבים המשמש במסכים אחרים. |
| `src/pages/login/steps/SignInStep.tsx:246-247` | `Supabase not configured — login disabled. Add ...` → "ההתחברות אינה זמינה כרגע. נסו שוב מאוחר יותר או פנו לתמיכה." | לא חושף משתני סביבה/פרטי תשתית ולא מציג אנגלית ללקוח. את הפרטים יש להשאיר בלוג פנימי. |
| `src/errors/RootErrorBoundary.tsx:102,123` וגם `src/errors/PageErrorBoundary.tsx:74,79` | "הנתונים שלך בטוחים. אנא נסה..." / "נסה שוב" → "אירעה בעיה. ייתכן שהפעולה לא הושלמה. נסו לרענן את הדף." / "נסו שוב" | מסיר הבטחת בטיחות לא מאומתת, מבהיר פעולה אפשרית ומשתמש ברישום ניטרלי. |

## ממצאים חיוביים והיקף הבדיקה

- המסמך הראשי מגדיר עברית ו־RTL (`index.html:2`), ו־`useIsRTL` הוא SSR-safe, מגיב לשינוי `dir` עם `MutationObserver` ונמצא בשימוש ממשי ב־SetInputCard, SettingsSelect, StartWorkoutSheet, WeeklyGrid ו־EmbeddedTemplatePicker (`src/hooks/useIsRTL.ts:20-43`; `src/components/workout/components/SetInputCard.tsx:63`; `src/pages/settings/components/SettingsSelect.tsx:42`).
- קיימים skip link, landmark של `main`, העברת focus לאחר ניווט והודעת live אזורית (`src/AppRouter.tsx:724-729,784-811`); גם Login העצמאי כולל skip/main (`src/pages/Login.tsx:72-108`).
- ל־ModalOverlay יש focus trap, `role="dialog"` ו־`aria-modal`; Sheet מעביר את ה־title לשם נגיש (`src/components/ui/ModalOverlay.tsx:227-237,344-348`; `src/components/ui/Sheet.tsx:52-57`). כל השימושים הישירים ב־ModalOverlay שנבדקו מספקים שם, למשל PhotoTimeline ו־ConfirmDialog (`src/pages/coach/client/PhotoTimeline.tsx:97-102,163-168`; `src/components/ui/ConfirmDialog.tsx:76-80`). AgeGate ו־ConsentGate הם gates מלאים שממקדים heading ומסומנים דיאלוגים (`src/components/consent/AgeGate.tsx:69,78-80`; `src/components/consent/ConsentGate.tsx:33,54-56`), ולכן לא סווגו אוטומטית כחוסר focus trap.
- שדות Input/Textarea מספקים label, `aria-invalid`, `aria-describedby` ו־`role="alert"` לשגיאות (`src/components/ui/Input.tsx:82-83,137`; `src/components/ui/Textarea.tsx:60-61,79`).
- קיימת סמנטיקת התקדמות/תרשים ברכיבים פעילים: AnimatedBar ו־SetProgress משתמשים ב־progressbar; ActivityRings/RingProgress משתמשים ב־`role="img"` עם label (`src/components/charts/AnimatedBar.tsx:76-80`; `src/components/workout/components/SetProgress.tsx:104-108`; `src/components/charts/ActivityRings.tsx:164`; `src/components/charts/RingProgress.tsx:104-105`). קריאות ה־GlowAreaChart הפעילות שנדגמו מעבירות labels בעברית (`src/components/workout/ForecastChart.tsx:133-138`; `src/pages/progress/components/ExerciseDetail.tsx:241-248`).
- קיימת תמיכה סבירה ב־motion reduction: wrapper זעיר ונכון ל־Framer (`src/hooks/useReducedMotion.ts:1-3`), `MotionConfig reducedMotion="user"` ברמת האפליקציה (`src/App.tsx:15-26`) ו־fallback CSS (`src/styles/global.css:914-922`, `src/styles/motion.css:347-374`). סריקת GSAP הסטטית השלימה את החריג היחיד `src/lib/gsapSparks.ts`, שהוא factory; כל call site פעיל שנבדק משתמש ב־`useReducedMotion`. לא נמצא ממצא P1 של reduced motion.
- קיימים מבחני ARIA נקודתיים, למשל שם הדיאלוג של Sheet (`src/components/ui/Sheet.test.tsx:8-17`), אך הם אינם תחליף ל־axe/מסלולי מקלדת מלאים ולכן ממצא הכיסוי נשאר P2.
- טרם בוצעו במסגרת דוח זה בדיקת NVDA/JAWS/VoiceOver/TalkBack ידנית, בדיקת מגע במכשיר אמיתי או מדידת ניגודיות של תוכן דינמי/תמונות. אלה שלבי release חובה לפי הבק־לוג.

## בק־לוג יישום מדורג

1. **P1 — ניגודיות:** לתקן את Paywall ו־PlanSetRow לפי הטוקנים המוצעים; לסרוק שימושי `--fs-heading` על accent ו־`--fs-accent` כטקסט על משטח בהיר בשתי ערכות הנושא.
2. **P1 — Tabs RTL:** לחלץ helper לכיוון מקשי חצים, לתקן SegmentedControl/Progress/Nutrition, ולהוסיף בדיקות מקלדת RTL ו־LTR לכל tablist.
3. **P1 — הצהרת נגישות:** לעדכן טענות לאחר אימות, לפרסם מגבלות אמיתיות, להשלים רכז/ת נגישות וערוץ טיפול, ולקבל אישור לניסוח הזמנים.
4. **P2 — יעד מגע:** להגדיר target משותף של 44px ולתקן קודם את Sheet, SegmentedControl, Paywall ו־MyCoach; לאחר מכן להחליף את שאר מופעי 28/36px לפי חיפוש ממוקד.
5. **P2 — RTL לוגי:** לתקן safe-area inline ב־PageHeader ולהמיר את פסי ההדגשה וה־padding הפיזיים ל־logical properties; להריץ צילום RTL/LTR עם notch מדומה.
6. **P2 — BiDi ואייקונים:** לעטוף אימיילים/CSV/JSON/AI ב־`bdi dir="ltr"`, להחליף חצי חזרה במסכי Login, ולהוסיף בדיקת snapshot למחרוזות מעורבות עברית־לטינית.
7. **P2 — סמנטיקה:** להוסיף caption לטבלת Paywall וטקסט זמין אמין עבור "לא זמין"; לשנות את כותרת כל שלב onboarding ל־`h1` יחיד.
8. **P2 — קופי:** ליישם את תשעת השכתובים בטבלה, להסיר חשיפת config באנגלית, ולהוסיף review של Hebrew-first לכל fallback חדש.
9. **P2 — אוטומציה:** להוסיף axe ל־Playwright ול־CI; להוסיף suites עבור Tab/Shift+Tab/Escape, focus return בדיאלוגים, חצי RTL, ניגודיות light/dark ויעדי מגע.
10. **Release gate:** לבצע smoke ידני עם NVDA או VoiceOver בעברית, Android TalkBack, מקלדת בלבד ומכשיר מגע; לעדכן את ההצהרה רק לאחר שממצאי P1 נסגרים וממצאי P2 מתועדים או מטופלים.
