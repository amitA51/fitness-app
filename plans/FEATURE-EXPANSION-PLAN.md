# תוכנית הרחבת פיצרים ותאימות רגולטורית — sparkos-fitness-app

> נוצר: 2026-06-08 • הופק עי צוות סוכנים (design→assemble) • סטטוס: תוכנית לאישור, טרם מומש • 15 work-streams

## החלטות מוצר שהתקבלו
1. **הפצה:** עטיפת ה-PWA הקיים ב-**Capacitor** ל-iOS + Android (קוד בסיס יחיד, web + native יחד). יכולות נייטיב (haptics אמיתי, ווידגטים אמיתיים, IAP נייטיב, push משופר) בתוך ה-scope.
2. **תשלומים:** מתכננים **את שתי הדרכים** — web (Stripe מול Paddle/Lemon Squeezy) וגם חיוב חנויות נייטיב (RevenueCat לאיחוד). החלטה סופית בהמשך.
3. **קבוצות:** בונים **גם** שכבת קהילה חדשה למתאמנים (feed + פורומים) **וגם** מעשירים את קבוצות המאמן הקיימות.

> סדר קריאה: סעיף **תשתית נייטיב (Capacitor)** הוא התשתית — קראו אותו ראשון. הוא ה-prerequisite ל-IAP-נייטיב, ווידגטים, haptics ו-push.

## תוכן עניינים
1. תשתית נייטיב — עטיפת Capacitor ל-iOS + Android
2. אזורי זמן ותאריכים מותאמים אישית
3. ווידגטים למסך הבית ולמסך הנעילה
4. חיבור ליומנים חכמים — Google Calendar
5. פידבק מגע ורטט (Haptic Feedback)
6. פרופיל משתמש אישי מתקדם
7. מרכז עזרה ושאלות נפוצות (FAQ) מובנה
8. עמידה בתקני פרטיות (GDPR / CCPA) + בקשות נושא מידע (DSAR)
9. אישור תנאי שימוש ומדיניות פרטיות מבוסס-גרסאות
10. אימות גיל (Age Verification)
11. רכישות בתוך האפליקציה + מנויים (חודשי/שנתי)
12. תמיכה דו-כיוונית מלאה (RTL / LTR) + תשתית i18n
13. קבוצות/פורומים פנימיים — קהילת מתאמנים + קבוצות מאמן עשירות
14. ניהול העדפות עוגיות ומעקב (Cookies & Tracking Consent)
15. עמוד הצהרת נגישות מסודר (IS 5568 + WCAG 2.x AA)

## ניתוח חוצה-פיצרים (Cross-cutting)

15 ה-work-streams אינם רשימה שטוחה — חלקם **תשתית-יסוד** שכל השאר נשענים עליה, חלקם **blockers משפטיים/חנותיים** שחייבים להיסגר לפני כל הגשה, וחלקם **פיצ'רים** שתלויים בשניהם. הסעיף ממפה את התלות בפועל (`blockedBy`), את השכבות שצריך לבנות פעם אחת, את גלי הביצוע, הערכת מאמץ כוללת, ואת הסיכונים הרוחביים. מטרת-העל: לא לבנות פעמיים, לא להגיש לחנות לפני שה-blockers ירוקים, ולסדר את הגלים כך שכל גל פותח את הבא.

### גרף תלויות

הסדר הטופולוגי של ה-15 לפי `blockedBy` בפועל. שלושה אשכולות מבניים:

**(1) שורש התשתית — `capacitor-foundation` (work-stream 1, suggestedPhase 1).** עטיפת ה-Capacitor היא ה-prerequisite היחיד שחוסם הכי הרבה: `iap-native`, `widgets` (work-stream 3, `blockedBy` כולל "Capacitor native wrapper setup"), `haptics` (work-stream 5, `blockedBy: "Capacitor bootstrap"`), והנתיב ה-native של `google-calendar` (work-stream 4, `blockedBy` כולל "Capacitor wrapper must exist for the native OAuth/device-calendar paths") **כולם** תלויים בה. בלי wrapper אין StoreKit/Play Billing, אין lock-screen widget, אין `@capacitor/haptics` עם Taptic Engine אמיתי, ואין `@capacitor/browser` ל-OAuth נייטיב. לכן `capacitor-foundation` היא המשימה הראשונה בכל מסלול native — היא לא מוסיפה ערך-מוצר בפני עצמה אבל פותחת ארבעה streams. הערה: ה-web-half של iap (Paddle MoR) **לא** תלוי ב-Capacitor ולכן יכול לרוץ במקביל, כל עוד מודל ה-entitlement נבנה אגנוסטית-לפלטפורמה (ראו "תשתית משותפת").

```
capacitor-foundation  ─┬─→ iap-native (StoreKit / Play Billing via RevenueCat)
                       ├─→ widgets (home/lock-screen + Live Activities)
                       ├─→ haptics (real @capacitor/haptics → Taptic Engine)
                       └─→ google-calendar (native OAuth via @capacitor/browser + device-calendar)

iap-web (Paddle MoR)  ──→  [no Capacitor dependency — parallel track]
        └─ both web+native feed → entitlements SSOT (single source)
```

**(2) אשכול ה-LEGAL GATE (חייב להיסגר לפני כל הגשה ציבורית/חנות).** ארבעה work-streams יוצרים יחד את שער-העמידה: `consent-versioning` (work-stream 9, suggestedPhase 1 — ה-SSOT לגרסת מדיניות + טריגר re-prompt), `cookie-tracking-consent` (work-stream 14, suggestedPhase 1 — הבאנר חייב את גרסת המדיניות כדי לעבוד; `blockedBy` כולל consent-versioning), `age-verification` (work-stream 10, suggestedPhase 1, `blockedBy: ["consent-versioning","advanced-profile"]`), ו-`accessibility-statement` (work-stream 15, suggestedPhase 1). הסדר הפנימי: `consent-versioning` → `cookie-tracking-consent` ו-`age-verification`. `legal-gdpr-ccpa-dsar` (work-stream 8, suggestedPhase 1) יושב מעל כולם — ה-`blockedBy` שלו מונה במפורש `cookie-consent + consent-versioning + age-verification`, והוא מספק את מחיקת-החשבון בשרת + ROPA שחנויות דורשות. `accessibility-statement` ו-`age-verification` נשענים גם על **קלט-בעלים לא-טכני** (שם רכז נגישות אמיתי; סף-גיל מינימלי מאושר משפטית) — dependencies חיצוניים שצריך להתחיל לאסוף מוקדם כי הם חוסמי-פרסום.

```
consent-versioning ─┬─→ cookie-tracking-consent ─┐
                    ├─→ age-verification ─────────┤
accessibility-statement ──────────────────────────┼─→ LEGAL GATE
                                                   │   (must precede public/store launch)
legal-gdpr-ccpa-dsar (DSAR/erasure/ROPA) ──────────┘
(privacy-policy / terms public routes feed all five)
```

**(3) אשכול ה-COMMUNITY (ה-leaf העמוק ביותר).** `community-groups-forums` (work-stream 13, XL, suggestedPhase 2) יורש את **כל** ה-LEGAL GATE ועוד דורש את שכבת הפרופיל: `advanced-profile` (work-stream 6) מצהיר במפורש `blockedBy: ["community-work-stream (public profile, report/block, UGC moderation)", "profiles.role server SSOT", "localStorage->profiles migration"]` — כלומר הפרופיל הציבורי וה-moderation שזורים יחד עם הקהילה, וה-feed לא יכול לעלות בלעדיהם. בנוסף הקהילה היא משטח UGC ולכן חוסמת-הגשה תחת Apple Guideline 1.2 (report/block/mute + תור + EULA + published contact). לכן `community` לא יכול להיות Wave 1 בשום תרחיש.

```
advanced-profile ──┐
moderation (report/block) ─┼─→ community (public feed + forums)
LEGAL GATE ────────┘            └─ (coach-groups enrichment = low-risk subset, can ship earlier)
```

**סיכום הסדר הקריטי:** `capacitor-foundation` ו-`consent-versioning` הם שני השורשים. ה-LEGAL GATE (5 streams: consent-versioning, cookie-tracking-consent, age-verification, accessibility-statement, legal-gdpr-ccpa-dsar) חייב להיסגר לפני submission. `community` הוא ה-leaf האחרון כי הוא יורש legal + advanced-profile + moderation.

### תשתית משותפת

חמש שכבות שצריך לבנות **פעם אחת** ולמחזר לרוחב כל ה-15 — אחרת drift, כפילות, ובאגי-תאימות:

1. **Supabase edge-function pattern אחד ומתועד.** התבנית כבר קיימת ובוגרת ב-`coach-invite-accept/index.ts` ו-`coach-push-send/index.ts`: CORS fail-closed דרך `ALLOWED_ORIGIN`, זיהוי caller מ-JWT עם anon client ואז פעולה ב-service-role, rate-limit ledger (`rate_limit_events`), ו-idempotency דרך טבלת events עם `UNIQUE`. כל ה-edge functions החדשים — `gcal-oauth`/`gcal-sync` (google-calendar), `dsar-export`/`dsar-erase` (legal), `age-recheck` (age) — **חייבים** למחזר אותה תבנית במקום להמציא pattern לכל webhook. ה-fan-out (push לרבים) עובר מ-לולאת-client ל-edge עם batching `Promise.all`.

2. **שכבת entitlement / feature-gating אחת.** `EntitlementContext` + `useEntitlement(feature)` + `<PlanGate>` נבנים ב-iap (work-stream 11), אבל הם ה-SSOT שכל פיצ'ר-פרימיום עתידי ייגזר ממנו. הכלל: ה-gate הוא UX בלבד; אכיפה אמיתית ב-RLS/edge על פעולות יקרות. טבלת `entitlements` (שטוחה) נקראת ע"י ה-client; web ו-native מזינים אותה דרך אותו webhook — מונע את ה-drift "קנה ב-web וגם ב-native = שני מנויים".

3. **שכבת i18n + date/tz utility אחת.** `react-i18next` + `LocaleProvider` (SSOT יחיד ל-`documentElement.lang`/`dir`) נבנים ב-rtl-ltr (work-stream 12), ושכבת ה-datetime ב-`src/utils/datetime.ts` (work-stream 2 — מקור-אמת לגבולות-יום בטוחי-DST לפי `profiles.timezone`). **כל** מחרוזת/תאריך/מספר חדשים (paywall, consent banner, community, FAQ, calendar events) חייבים לעבור דרך השכבות האלה מהיום הראשון, אחרת נצבור hardcoded strings וחישובי-תאריך אד-הוק שיכפו ריפקטור כפול. עברית/אזור-זמן ישראל נשארים default → אפס רגרסיה.

4. **Consent/legal gate ב-app shell.** `ConsentProvider` + `ConsentGate` (re-acceptance מבוסס-גרסה) + `CookieBanner`, כולם יושבים גבוה ב-`src/App.tsx`. אותו shell-level gate משרת cookie-consent, age-verification (gate בכניסה), terms-acceptance (versioned), ו-DSAR. ה-refactor של `main.tsx` (הוצאת Sentry/Web-Vitals מאחורי `analytics_opt_in`) הוא load-bearing ומשותף — חייב לקרות פעם אחת ולכסות גם `errorReporter.ts` ו-ErrorBoundaries.

5. **Settings "legal & privacy" hub + routes ציבוריים.** סקציה אחת ב-Settings ("פרטיות ונתונים") שמרכזת: consent preferences, privacy policy, cookie policy, terms, accessibility statement, age, DSAR/export. במקביל — קבוצת routes ציבוריים (`/privacy`, `/cookies`, `/terms`, `/legal/terms`, `/legal/privacy`, `/accessibility`) **מחוץ** לקיר ההתחברות (כולם חייבים להיות נגישים בלי login וגם מ-store listing). ב-Capacitor הם נפתחים דרך `@capacitor/browser` (in-app). ה-`AppFooter` הגלובלי (לא קיים היום) הוא נקודת הכניסה המשותפת.

### שלבים מומלצים (Waves)

קיבוץ כל 15 לפי `suggestedPhase`, עם רציונל ומה כל גל פותח. **ה-App-Store / legal BLOCKERS מסומנים מפורשות בגל שחייב לקדום הגשה לחנות.**

**Wave 1 — Foundation & Legal Gate (groundwork + compliance):**
- `capacitor-foundation` (#1, L) — שורש כל ה-native; חייב ראשון כדי לפתוח iap-native/widgets/haptics/calendar-native. *פותח:* את כל מסלול הנייטיב.
- `rtl-ltr` + i18n (#12, L) — תשתית רוחבית; ככל שנמתין נצבור hardcoded strings. עברית default = אפס סיכון. *פותח:* כל UI עתידי.
- `consent-versioning` (#9, M) — **legal BLOCKER**; ה-SSOT לגרסת מדיניות + re-prompt. *פותח:* את כל ה-LEGAL GATE.
- `cookie-tracking-consent` (#14, L) — **legal BLOCKER**; הפער הנוכחי (Sentry לפני opt-in) הוא חשיפה משפטית פעילה כבר היום. **ATT** ב-iOS רק אם נוסף cross-app tracking.
- `age-verification` (#10, M) — **legal/App-Store BLOCKER**; age-gate ניטרלי (DOB) + אכיפת-שרת, תנאי-סף לקהילת ה-UGC ולהגשה.
- `accessibility-statement` (#15, S) — **legal BLOCKER** (עד 50,000 ₪ חשיפה); route ציבורי + הסרת placeholders = תנאי-סף לפרסום/review.
- `legal-gdpr-ccpa-dsar` (#8, L) — **App-Store BLOCKER** (Guideline 5.1.1(v) מחיקת-חשבון in-app) + ROPA/sub-processors שתואמים את ה-privacy labels.
- (תשתית משותפת 1–5 לעיל נבנית כאן.)
*מה Wave 1 פותח:* את היכולת **להגיש לחנות בכלל** — ה-LEGAL GATE סגור, ה-Capacitor wrapper מוכן, ה-i18n/datetime SSOT קיימים.

**Wave 2 — Native capabilities, Monetization & Community (הליבה התלויה ב-Wave 1):**
- `iap-subscriptions` (#11, L) — **App-Store BLOCKER** (Guideline 3.1.1: StoreKit חובה ל-digital goods; מחירי-web בתוך ה-app = דחייה). ה-web-half (Paddle) יכול היה להתחיל ב-Wave 1; ה-native-half תלוי ב-capacitor-foundation. *זהו ה-blocker שחייב לקדום submission עם מכירת מנוי בנייטיב.*
- `timezones-dates` (#2, M) — בסיס-נכונות ל-streaks/סיכומים/תזכורות לפני שמרחיבים קהל לאזורי-זמן מרובים.
- `google-calendar` (#4, L) — דחיפת אימונים מתוזמנים ליומן; תלוי ב-Capacitor לנתיב ה-native. **להתחיל את Google OAuth verification כבר ב-Wave 1** (חיצוני, שבועות).
- `haptics` (#5, M) — Taptic Engine אמיתי ב-iOS; שכבת ה-web כבר production-ready, נוחת מיד אחרי Capacitor.
- `advanced-profile` (#6, L) — אווטאר/ביו/הישגים/פרטיות; תנאי-מקדים ל-community feed.
- `community-groups-forums` (#13, XL) — **App-Store BLOCKER** (Guideline 1.2 UGC: report/block/mute + תור + EULA + published contact). חייב את ה-LEGAL GATE מ-Wave 1 + advanced-profile. בתוך Wave 2: קודם **העשרת קבוצות מאמן** (סגורות, סיכון-חנות נמוך), ואז **קהילת מתאמנים** עם moderation מלא **לפני כל הגשה**.
*מה Wave 2 פותח:* מונטיזציה מלאה (web+native), חוויית native אמיתית, ושכבה חברתית — כולם מאחורי ה-blockers שנסגרו.

**Wave 3 — Integrations & Polish (ערך מוסף, ללא חסימת-הגשה):**
- `widgets` (#3, XL) — ווידג'טים נייטיביים + Live Activities; ערך-retention גבוה אך לא קריטי ל-MVP, ותלוי בכל מסלול ה-build הנייטיב.
- `help-faq` (#7, M) — מרכז עזרה + changelog; מפחית פניות תמיכה לפני גידול-משתמשים.
- proration/dunning/grace מתקדמים של iap, two-way calendar sync, hot-ranking של feed, sync cross-device של locale/consent/tz.
*מה Wave 3 פותח:* ליטוש, אינטגרציות עמוקות, ו-retention — אחרי שהמוצר כבר ניתן-להגשה ומונטיזציה פעילה.

> **כלל ההגשה:** אסור submission לחנות לפני ש-**כל** ה-BLOCKERS הבאים ירוקים: UGC moderation 1.2 (Wave 2), StoreKit IAP נייטיב 3.1.1 לכל מכירת digital-goods (Wave 2), age gate (Wave 1), legal consent + versioning (Wave 1), מחיקת-חשבון in-app 5.1.1(v) (Wave 1), ATT — רק אם נוסף cross-app tracking (אחרת לא נדרש).

### הערכת מאמץ כוללת

טבלת כל 15 ה-work-streams (`estimateDays` מתוך נתוני ה-design של כל stream):

| # | feature | effort | est. days | phase | migrations? | top App-Store / legal risk |
|---|---|---|---|---|---|---|
| 1 | capacitor-foundation | L | 8 | 1 | no | Guideline 4.2 (PWA-shell) + 3.1.1 (Apple IAP חובה); iOS build דורש mac-runner |
| 2 | timezones-dates | M | 7 | 2 | yes | נמוך; נכס נכונות-נתונים (DST / גבול-יום streaks) |
| 3 | widgets | XL | 17 | 3 | yes | בינוני-גבוה; 4.2 PWA-shell, iOS lock-screen WidgetKit ללא JS; Android ללא lock-widget אמיתי |
| 4 | google-calendar | L | 11 | 2 | yes | בינוני-גבוה; OAuth חייב @capacitor/browser, Google verification ל-calendar.events, calendar permissions + privacy disclosure |
| 5 | haptics | M | 2.5 | 2 | no | נמוך; @capacitor/haptics סטנדרטי, תלוי ב-Capacitor bootstrap |
| 6 | advanced-profile | L | 10.5 | 2 | yes | בינוני-גבוה; פרופיל ציבורי = UGC (1.2 report/block), PII דרך public_profiles, DOB age-policy |
| 7 | help-faq | M | 4 | 2 | no | בינוני-נמוך; קישורים חיצוניים דרך @capacitor/browser, אסור לקשר למסלולי תשלום חיצוניים (עקיפת IAP) |
| 8 | legal-gdpr-ccpa-dsar | L | 9 | 1 | yes | **5.1.1(v) מחיקת-חשבון in-app** + privacy labels תואמי-ROPA; GDPR 30d / CCPA 45d SLA |
| 9 | consent-versioning | M | 5 | 1 | yes | **App-Store/legal** — terms+privacy חייבים נגישים מחוץ לשער ובעמוד החנות; UGC דורש EULA מאושר |
| 10 | age-verification | M | 5 | 1 | yes | **App-Store/legal BLOCKER** — קהילת UGC מעלה age rating, מחייב age-gate + מודרציה; GDPR-16/COPPA |
| 11 | iap-subscriptions | L | 19 | 2 | yes | **Guideline 3.1.1** — StoreKit חובה בנייטיב; מחירי-web בתוך app = דחייה |
| 12 | rtl-ltr + i18n | L | 9 | 1 | no | נמוך מאוד; נכס נגישות (IS 5568 `lang`/`dir`) |
| 13 | community-groups-forums | XL | 34 | 2 | yes | **Guideline 1.2 (UGC)** — report/block/mute + תור + EULA + contact; BLOCKER |
| 14 | cookie-tracking-consent | L | 9 | 1 | yes | בינוני; **ATT** ב-iOS ל-cross-app tracking; GPC honoring + Sentry-before-opt-in = חשיפה היום |
| 15 | accessibility-statement | S | 3 | 1 | no | **עד 50,000 ₪** על הצהרה כוזבת; route חייב להיות ציבורי |

**טווח ימים כולל:** סכום ה-`estimateDays` של כל 15 = 8 + 7 + 17 + 11 + 2.5 + 10.5 + 4 + 9 + 5 + 5 + 19 + 9 + 34 + 9 + 3 = **153 ימי-עבודה** (נטו פיתוח). ה-buffer הריאלי (QA דו-כיווני, store agreements/tax/banking setup, Google OAuth verification, moderation SLA, audit a11y אמיתי עם NVDA/VoiceOver, סקירה משפטית חיצונית של terms/privacy/DPAs) מוסיף כ-20–30% → **טווח כולל מקצה-לקצה ~185–200 ימי-עבודה**.

### סיכונים מובילים

שבעה סיכונים רוחביים שחוזרים על פני כמה work-streams ולכן מסוכנים יותר מכל סיכון-בודד:

1. **App Store review — שלושה blockers בלתי-תלויים שנופלים יחד.** Guideline 4.2 (PWA-shell "דקה מדי"), Guideline 3.1.1 (StoreKit חובה ל-digital goods), ו-Guideline 1.2 (UGC moderation) הם שלושה שערים נפרדים; build שמגיע עם מעטפת Capacitor + מנוי נייטיב + feed ציבורי חייב לעבור את **שלושתם**. כשל באחד = דחיית כל ה-build. מיטיגציה: יכולות native אמיתיות (widgets/haptics/Live Activities) שמצדיקות את המעטפת, paywall נייטיב נפרד (RevenueCat), וערכת moderation מלאה לפני הגשה ראשונה כלשהי.

2. **מחיקת-חשבון in-app + privacy-labels תואמי-ROPA (Guideline 5.1.1(v)).** Apple/Google דורשים מסלול מחיקת-חשבון נגיש מתוך האפליקציה, ו-privacy nutrition labels / Data Safety form שתואמים את העיבוד בפועל. `legal-gdpr-ccpa-dsar` מספק erasure אמיתי בשרת (`auth.admin.deleteUser` + cascade על כל הטבלאות + Storage + tombstones) ו-ROPA כ-SSOT — אבל אם נוספת טבלה חדשה ולא עודכן `_shared/dsarTables.ts`, ה-cascade חלקי = הפרה. מיטיגציה: SSOT אחד לרשימת הטבלאות + בדיקת CI שמשווה לסכמה בפועל.

3. **Telemetry-before-consent — חשיפה משפטית פעילה היום.** Sentry + Web-Vitals מאותחלים ב-`main.tsx` לפני כל opt-in — הפרה פעילה של GDPR + חוק הגנת הפרטיות (תיקון 13) כבר עכשיו. ה-refactor מאחורי consent-gate הוא load-bearing וחייב לכסות גם `errorReporter.ts` ו-ErrorBoundaries; פספוס נקודה אחת = דליפה נמשכת. כפיפות ל-GPC (`navigator.globalPrivacyControl`) חייבת טסט מפורש — טעות = הפרה בכמה מדינות בארה"ב.

4. **חישובי-תאריך/אזור-זמן ועקביות client↔server.** `timezones-dates` נושא סיכון DST/גבול-יום עדין: חישוב גבול-יום שגוי מזיז רישומים יומיים (water/nutrition/body-weight) ביום, ושובר streaks. אם ה-client עובר ל-tz-aware בעוד edge functions נשארות UTC — הסיכומים והרצפים לא יתאימו. מיטיגציה: `src/utils/datetime.ts` כ-SSOT, `AT TIME ZONE` בשרת בו-זמנית, בדיקות-DST ייעודיות, ו-interpret-as-stored לרישומים היסטוריים (לא לכתוב מחדש).

5. **דליפת PII דרך משטחים ציבוריים חדשים.** `advanced-profile` (פרופיל ציבורי) ו-`community` חושפים `display_name`/avatar, אך `dob`/משקל/גובה/role/`birth_date` לעולם לא יחשפו — חובה לאכוף ב-`public_profiles` VIEW + RLS, לא בלקוח. במקביל, זיוף הישגים בצד-לקוח נמנע רק אם הזכייה עוברת RPC/Edge `SECURITY DEFINER` (אין INSERT policy ל-client). חיבור הכרחי ל-export/erase של ה-DSAR.

6. **OAuth/token security מול ספקים חיצוניים.** `google-calendar` ו-`signInWithGoogle` הנייטיב חייבים `@capacitor/browser`/Custom Tab (WebView OAuth נחסם ע"י Google ונכשל ב-review), `flowType: 'pkce'` + deep-link `appUrlOpen`, ו-refresh_token ב-service-role-only + מוצפן, שלעולם לא חוזר ל-client, עם revoke ב-disconnect. דליפת refresh_token = גישה מלאה ליומן. בנוסף `scheduled_date` הוא DATE-only ולכן sync לא-idempotent עלול ליצור events כפולים בלי `calendar_event_map` UNIQUE.

7. **Hebrew UGC moderation + scope-creep רוחבי.** ספריות profanity חלשות בעברית (false-negative), כך שסינון אוטומטי לבדו לא מספיק — חייב דיווח אנושי + תור עם SLA, אחרת חבות משפטית/תדמיתית. במקביל, scope-creep חוזר בכל work-stream גדול (community XL/34 ימים, widgets XL/17, i18n 149 קבצים): הפיתוי ל-big-bang. מיטיגציה רוחבית: waves + עברית-default-fallback + החצנה קובץ-קובץ, וחוזה-snapshot/SSOT יחיד שמתוחזק בכל הפלטפורמות (JS+Swift+Kotlin בווידג'טים), לא הכל-בבת-אחת.

---

## תשתית נייטיב — עטיפת Capacitor ל-iOS + Android

### מצב נוכחי

- האפליקציה היא **PWA טהורה** ללא עטיפה נייטיב. `Glob "capacitor.config.*"` החזיר **אפס קבצים** — אין כיום Capacitor, אין תיקיות `ios/` או `android/`.
- Build: `vite.config.ts` (קיים) עם `VitePWA` ב-`registerType: 'prompt'` (SW במצב המתנה + טוסט עדכון `PWAUpdatePrompt`). הפלט הסטנדרטי של Vite הוא `dist/` (אין `build.outDir` מותאם, כלומר ברירת המחדל `dist`). זה ה-`webDir` הטבעי של Capacitor.
- `package.json` (קיים): `"build": "vite build"`, `vite ^5`, `vite-plugin-pwa ^0.17`, `@supabase/supabase-js ^2.103`, `@sentry/react`, `idb`, `framer-motion`, `gsap`, `lucide-react`. אין שום חבילת `@capacitor/*`. `engines.node >= 20`.
- `index.html` (קיים): כבר `viewport-fit=cover`, `apple-mobile-web-app-capable`, `theme-color` לכל מצב, `apple-touch-icon` → `/pwa-192x192.png`. ה-manifest מוזרק ב-build מ-`vite.config.ts` (מקור-אמת יחיד) — אין `<link rel=manifest>` סטטי.
- `public/` (קיים): `pwa-192x192.png`, `pwa-512x512.png`, `favicon-32/64.png`, `logo.svg`, `push-sw.js` (handler ל-Web Push), `robots.txt`, `sitemap.xml`. **אין** נכסי native (אין `Assets.xcassets`, אין splash native).
- Auth/OAuth: `src/services/supabaseAuth.ts` → `signInWithGoogle` משתמש ב-`redirectTo: window.location.origin`; `resetPassword` ב-`${window.location.origin}/reset-password`. ב-Capacitor `window.location.origin` הוא `capacitor://localhost` (iOS) / `http://localhost` (Android) — לא URL נגיש, ישבור OAuth ו-reset.
- `src/lib/supabase.ts` (קיים): `createClient` עם `persistSession:true, autoRefreshToken:true`, **בלי `flowType` מפורש** ובלי storage adapter — ברירת מחדל היא `localStorage` של ה-WebView. ב-native זה עובד אך מומלץ `flowType: 'pkce'` לזרימת OAuth ב-deep-link.
- `src/main.tsx` (קיים): מאתחל Sentry, web-vitals, offline sync, ומרנדר `<PWAUpdatePrompt />` (רישום SW production-only). אין כיום שום הסתעפות web↔native.

### מצב יעד

- Monorepo יחיד: אותו קוד React מריץ web PWA + iOS + Android. `npx cap sync` מזין את `dist/` לתוך מעטפת native.
- שכבת `src/platform/` מרכזית: `isNativePlatform()`, `getPlatform()` ('web'|'ios'|'android'), ו-feature-flags שמאפשרים לפיצ'רים במורד הזרם (haptics/push/IAP/widgets) להסתעף web↔native בלי `if` מפוזרים.
- ה-web PWA נשאר **פעיל ושלם** (Workbox SW, Web Push, offline) — Capacitor לא מחליף אותו, רק מוסיף מסלול native מקביל.
- Dev live-reload נייטיב מול Vite dev server (`server.url`), בלי rebuild לכל שינוי.
- חשבונות Apple Developer + Google Play Console פתוחים, חתימה/provisioning מוגדרים, ו-CI שבונה IPA/AAB.

### גישה טכנית

**מבנה פרויקט.** `capacitor.config.ts` בשורש: `appId: 'com.sparkos.fitness'`, `appName: 'SparkOS Fitness'`, `webDir: 'dist'`. הרצה: `npm run build` → `npx cap sync` → `npx cap open ios|android`. תיקיות `ios/` ו-`android/` נוצרות ע"י `cap add` ונכנסות ל-git (פרויקט native ערוך, לא מתחדש כל פעם).

**webDir feeding.** Capacitor מעתיק את `dist/` (פלט Vite) אל `ios/App/App/public` ו-`android/app/src/main/assets/public` בכל `cap sync`. אין שינוי ב-`vite build`. ה-Workbox SW נארז בתוך הנכסים ועדיין רץ בתוך ה-WebView ב-native — צריך אימות שלא מתנגש עם המעטפת (ראו סיכונים).

**זיהוי פלטפורמה (WEB vs NATIVE).** `Capacitor.isNativePlatform()` → false ב-web, true ב-native; `Capacitor.getPlatform()` → 'web'|'ios'|'android'. הסתעפות לדוגמה: haptics → ב-native `@capacitor/haptics`, ב-web `navigator.vibrate`; אחסון session → ב-native `@capacitor/preferences` adapter ל-supabase, ב-web `localStorage`; push → ב-native `@capacitor/push-notifications` (APNs/FCM), ב-web ה-`push-sw.js` הקיים.

**Dev live-reload.** `capacitor.config.ts` עם `server: { url: 'http://<LAN-IP>:3000', cleartext: true }` (מקביל ל-`server.port: 3000` ב-vite.config.ts). רק בפיתוח — חייב להישלף לפני build production (אחרת המעטפת תטען URL מקומי). פתרון: config מותנה `process.env.CAP_LIVE_RELOAD`.

**OAuth/deep-links (קריטי).** ב-native `signInWithGoogle` חייב `redirectTo: 'com.sparkos.fitness://auth-callback'` (custom scheme) במקום `window.location.origin`. רישום ה-scheme: iOS `CFBundleURLTypes`, Android intent-filter. `@capacitor/app` `appUrlOpen` תופס את ה-redirect ומעביר ל-`supabase.auth.exchangeCodeForSession`. דורש `flowType: 'pkce'` ב-`createClient`. ה-URI מתווסף ל-Supabase Auth → Redirect URLs.

**Safe-area + status bar.** `@capacitor/status-bar` לצבע/סגנון לפי theme; `env(safe-area-inset-*)` כבר אפשרי בזכות `viewport-fit=cover`. `@capacitor/splash-screen` למסך פתיחה native (להחליף את ה-splash של ה-PWA).

### מודל נתונים

עבודת תשתית זו היא **בעיקרה client-side ו-build-config — אין סכמה חדשה ב-Postgres**. השינוי היחיד בצד Supabase הוא **קונפיגורציה** (לא migration): הוספת redirect URIs ל-Auth. החל ממסלול ה-push במורד הזרם יידרשו טבלאות — מצוין כאן כ-hook עתידי בלבד, **לא חלק מ-stream זה**:

```sql
-- FUTURE (belongs to push stream, not capacitor-foundation):
-- device push tokens (APNs/FCM) keyed to user, RLS owner-only.
-- create table public.device_push_tokens (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   platform text not null check (platform in ('ios','android','web')),
--   token text not null,
--   created_at timestamptz not null default now(),
--   unique (user_id, token)
-- );
-- alter table public.device_push_tokens enable row level security;
-- policy: user_id = auth.uid() for select/insert/update/delete.
```

הגדרת Supabase Dashboard (ידני, ללא SQL): Authentication → URL Configuration → Redirect URLs יוסיף `com.sparkos.fitness://auth-callback` ליד ה-web origin הקיים.

### קבצים

- **create:** `capacitor.config.ts` (שורש) — appId/appName/webDir/server.
- **create:** `src/platform/native.ts` — wrapper סביב `isNativePlatform()`/`getPlatform()` + feature flags.
- **create:** `src/platform/deepLinks.ts` — `@capacitor/app` `appUrlOpen` → `exchangeCodeForSession`.
- **create:** `src/platform/statusBar.ts` — סנכרון status-bar/safe-area עם theme (Fresh Steel/Obsidian).
- **create:** `ios/` ו-`android/` — פרויקטים native (נוצרים ע"י `cap add`, נכנסים ל-git).
- **create:** `.github/workflows/native-build.yml` — CI ל-IPA/AAB.
- **create:** `fastlane/Fastfile` (אופציונלי) או EAS-like script.
- **modify:** `package.json` — תלויות `@capacitor/*` + scripts (`cap:sync`, `cap:ios`, `cap:android`).
- **modify:** `src/lib/supabase.ts` — `flowType: 'pkce'` + storage adapter מותנה-פלטפורמה (`@capacitor/preferences`).
- **modify:** `src/services/supabaseAuth.ts` — `redirectTo` מותנה-פלטפורמה ב-`signInWithGoogle`/`resetPassword`.
- **modify:** `src/main.tsx` — bootstrap native (status-bar, splash-screen hide, deep-link listener) מאחורי `isNativePlatform()`.
- **modify:** `index.html` — ודא ש-`viewport-fit=cover` + safe-area נשמרים (כבר קיים).
- **modify:** `.gitignore` — `ios/App/Pods`, `ios/DerivedData`, `android/.gradle`, `android/app/build`.

### תלויות וחבילות

- **npm (core):** `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`, `@capacitor/android`.
- **npm (plugins לפיצ'רים במורד הזרם):** `@capacitor/haptics`, `@capacitor/push-notifications`, `@capacitor/local-notifications`, `@capacitor/preferences`, `@capacitor/browser`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@revenuecat/purchases-capacitor`.
- **native toolchain:** Xcode 15+ + CocoaPods (macOS חובה ל-iOS build); Android Studio + JDK 17 + Android SDK; Ruby+Fastlane (אופציונלי ל-CI).
- **external services / accounts:** Apple Developer Program ($99/שנה), Google Play Console ($25 חד-פעמי); APNs key (.p8) + Firebase project (FCM) ל-push; RevenueCat account ל-IAP.
- **env/secrets:** `CAP_LIVE_RELOAD` (dev), `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (קיימים), ב-CI: `APP_STORE_CONNECT_API_KEY`, `MATCH_PASSWORD`/signing certs, `ANDROID_KEYSTORE` + `KEYSTORE_PASSWORD`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `REVENUECAT_*` keys (במורד הזרם).
- **חוסם תשתיתי:** ל-iOS build חייבים **macrunner** (GitHub-hosted `macos-latest` או Mac מקומי). אין דרך לבנות IPA על Windows — סביבת הפיתוח הנוכחית היא Windows 11.

### סיכונים

- **App Store / legal (CRITICAL):** Apple Guideline 3.1.1 — אם נמכרים פיצ'רים דיגיטליים, **חובה** IAP של Apple; קישור לתשלום web אסור. Guideline 4.2 — PWA עטופה "דקה מדי" עלולה להידחות כ"web-shell"; חייבים יכולות native אמיתיות (haptics/push/widgets) כדי לעבור review. נדרשים Privacy Nutrition Labels + מדיניות מחיקת חשבון (כבר קיים `DangerZoneSection`).
- **Workbox SW מול מעטפת native (HIGH):** SW רץ בתוך WebView ב-native; `navigateFallback: '/index.html'` ו-precaching עלולים להתנגש עם טעינת הנכסים המקומית של Capacitor. צריך אימות שאין double-caching/stale; אולי לכבות SW כש-`isNativePlatform()`.
- **OAuth redirect (HIGH):** `window.location.origin` שובר OAuth ו-reset-password ב-native (ראו מצב נוכחי). דורש custom scheme + PKCE + `appUrlOpen` — נקודת כשל נפוצה.
- **Deep links / Universal Links (MEDIUM):** Universal Links (iOS) דורשים `apple-app-site-association` מאוחסן בדומיין; App Links (Android) דורשים `assetlinks.json`. custom scheme פשוט יותר אך פחות מאובטח.
- **CSP (MEDIUM):** מקור ה-WebView הוא `capacitor://localhost`/`http://localhost`. כל CSP/CORS המניח origin של https יצטרך התאמה; preconnect ל-Google Fonts עדיין עובד.
- **Safe-area (MEDIUM):** notch/home-indicator — חייבים `env(safe-area-inset-*)` בכל מסך מלא; כבר יש `viewport-fit=cover` אך צריך audit ל-RTL.
- **iOS build על Windows (HIGH/blocker):** מצריך Mac או mac-runner ב-CI.
- **Bundle size:** הוספת @capacitor/* native — שולית ל-web (tree-shaken מאחורי `isNativePlatform()`), אך ודא שלא נכנס ל-`react-vendor` chunk.

### מאמץ והערכה

**L — כ-8 ימי עבודה.**
- התקנה + `capacitor.config.ts` + `cap add ios/android` + sync ראשון: 1 יום.
- שכבת `src/platform/` (detection + flags + status-bar/splash bootstrap): 1.5 יום.
- תיקון OAuth/PKCE + deep-links + storage adapter + בדיקת sign-in מקצה-לקצה ב-native: 2 ימים.
- אימות Workbox SW מול native + safe-area RTL audit: 1 יום.
- חשבונות/חתימה/provisioning (Apple + Google) + build ידני ראשון IPA/AAB: 1.5 יום.
- CI (Fastlane/GitHub Actions mac-runner): 1 יום.
*לא כולל* iap-native, widgets, push, haptics — אלה streams נפרדים שתשתית זו פותחת.

### שלב מומלץ

**שלב 1.** זו תשתית-יסוד (prerequisite) שחוסמת את iap-native, widgets, haptics ו-push. בלעדיה שום פיצ'ר native לא יכול להתחיל. עדיפות גבוהה, אך לאחר שה-web PWA מאומת יציב (הוא נשאר מסלול ההפצה היחיד עד שה-build הראשון של App Store עובר review).

### סקיל לשימוש

- **hebrew-rtl-best-practices** — audit safe-area + status-bar + icon-mirroring בתוך מעטפת native (RTL ב-WebView).
- **israeli-accessibility-compliance** — ודא ש-WebView ב-native שומר על תאימות IS 5568 וקוראי מסך (VoiceOver/TalkBack) — לא רק NVDA/JAWS ב-web.
- **impeccable / design-taste-frontend** — splash-screen ו-status-bar בצבעי Fresh Steel/Obsidian (`var(--fs-*)`), מעבר חלק web↔native בלי "AI-shell" גנרי.
- **hebrew-content-writer** — מחרוזות store listing + שם אפליקציה + תיאור App Store/Play בעברית תקנית.

---

## אזורי זמן ותאריכים מותאמים אישית

### מצב נוכחי
- כל לוגיקת התאריך מרוכזת חלקית ב-`src/utils/dateUtils.ts`, אך כולה מבוססת על אזור הזמן של המכשיר (`Date#getDay`, `getFullYear`, `getMonth`, `getDate`, `getHours`) — אין כל מודעות ל-IANA timezone.
- `todayStr()` ו-`toLocalDateStr(date)` (שורות 76-87) הם המפתח: הם מייצרים `YYYY-MM-DD` מרכיבי תאריך מקומיים, עם הערה מפורשת שמסבירה למה לא משתמשים ב-`toISOString().split('T')[0]` (UTC מזיז רישומי בוקר מוקדם ב-ישראל ליום הקודם). זהו המפתח שכל רישום יומי (water, nutrition, body weight) נצמד אליו.
- `isToday(d)` (שורות 42-50) משווה רכיבי שנה/חודש/יום של המכשיר — נשבר כשהמשתמש נוסע או כשהשרת/edge מחשב "היום" אחרת.
- `fmtDate` (26-40) מנרמל ל"חצות מקומי" ידנית; `getWeekStart` (1-6) מקבע תחילת שבוע ליום שני (`day - day + (day===0?-6:1)`) — קשיח, ללא העדפת first-day-of-week.
- פורמט תצוגה: `toLocaleDateString('he-IL', …)` מפוזר — ב-`DateNavigator.tsx` (שורה 39, `new Date(selectedDate).toLocaleDateString`), ב-`Nutrition.tsx` (`todayLabel`, שורות 73-78), וב-`dateUtils.ts` עצמו (`todayHe`, `formatHebrewDate`, `formatHebrewTime`, `formatDateISO`). אין העדפת 12h/24h או פורמט תאריך — `formatHebrewTime` קשיח על `hour:'2-digit'`.
- `new Date(selectedDate)` ב-`DateNavigator` מנתח `YYYY-MM-DD` כ-**UTC midnight** ואז מציג ב-local — באג קצה-יום פוטנציאלי לפי אזור הזמן.
- אין עמודת `timezone` ב-`profiles` (קיימת `profiles.role` ממיגרציה 20260608000000). אין מספרים ב-`dir="ltr"`/`.kinetic-number` בתאריכים האלה.

### מצב יעד
- מקור-אמת יחיד `src/utils/datetime.ts` שמחשב גבולות-יום בטוחי-DST לפי אזור הזמן של המשתמש (IANA), עם ברירת-מחדל זיהוי אוטומטי דרך `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- אזור הזמן נשמר ב-`profiles.timezone` (text) ומסונכרן בין client ל-Supabase/edge, כך ש"היום" אחיד בכל המכשירים והשרת.
- העדפות משתמש: `timezone`, `date_format` (`dmy`/`mdy`/`ymd`), `time_format` (`24h`/`12h`), `first_day_of_week` (`0`=ראשון/`1`=שני). מוצגות במסך ההגדרות תחת סקשן חדש או הרחבה של `ProfileSection`.
- כל התאריכים/השעות מוצגים `dir="ltr"` עם `.kinetic-number` למספרים, נשענים על הפורמטים המרכזיים בלבד.
- פירוש ו-backfill של רישומים קיימים (date-keyed local): הם נשארים כפי שהם (מפתח local-date), עם אסטרטגיית "interpret-as-stored": לא נכתבים מחדש, אלא מתפרשים לפי אזור הזמן הנוכחי של המשתמש. רק אם המשתמש משנה אזור-זמן ידנית — מוצגת הבהרה שרישומים ישנים ממופים ליום שבו תועדו.

### גישה טכנית
- **בחירת ספרייה:** `date-fns-tz` (על גבי `date-fns` שכבר עשוי להיות בפרויקט — לאמת ב-`package.json`). יתרון: tree-shakeable, קל (~עשרות KB), מתאים ל-PWA. Luxon כבד יותר (~70KB) ומחזיק אובייקט DateTime עצמאי; Temporal polyfill עדיין כבד וטרם יציב ל-prod. ההמלצה: `date-fns-tz` עם wrapper דק ב-`datetime.ts` כדי שנוכל להחליף ל-Temporal native בעתיד בלי לגעת בקריאות.
- **WEB (PWA):** `Intl.DateTimeFormat().resolvedOptions().timeZone` זמין בכל הדפדפנים המודרניים → זיהוי tz אוטומטי בעת onboarding/login. הפורמטים נשענים על `Intl` הילידי + `date-fns-tz` רק לחישוב גבולות-יום.
- **NATIVE/Capacitor:** אזור הזמן של המכשיר זמין דרך אותו `Intl` ב-WebView; אין צורך בפלאגין ייעודי. אופציונלי: `@capacitor/device` (`Device.getLanguageTag`/info) לאימות locale, אך לא חובה. שינוי אזור-זמן במכשיר → אפליקציה צריכה לזהות ב-`resume`/`visibilitychange` ולרענן את "היום".
- **Server (Supabase/edge):** כל edge function שמחשבת "היום" (למשל סיכומים יומיים/streaks) חייבת לקבל את `profiles.timezone` ולחשב גבול-יום ב-tz הזה ב-Postgres (`AT TIME ZONE`) ולא ב-UTC גולמי. ב-SQL: `(now() AT TIME ZONE profile.timezone)::date`.
- **עקביות client↔server:** מפתח התאריך המאוחסן (`YYYY-MM-DD`) נשאר local-date כפי שמחושב ב-`datetime.ts`; השרת מחשב את אותו גבול עם `AT TIME ZONE`. כך אין סטייה.
- מיגרציה הדרגתית: שלב 1 — `datetime.ts` עוטף את ההתנהגות הקיימת (local device) כך שאין רגרסיה; שלב 2 — מזריקים `timezone` מההקשר; שלב 3 — מחליפים קריאות אד-הוק (`new Date(...).toLocaleDateString`, `getDay`) בקריאות מרכזיות.

### מודל נתונים
```sql
-- migration: 20260609000000_profile_datetime_prefs.sql
alter table public.profiles
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  add column if not exists date_format text not null default 'dmy'
    check (date_format in ('dmy','mdy','ymd')),
  add column if not exists time_format text not null default '24h'
    check (time_format in ('24h','12h')),
  add column if not exists first_day_of_week smallint not null default 0
    check (first_day_of_week between 0 and 6);

comment on column public.profiles.timezone is 'IANA tz id, e.g. Asia/Jerusalem';
```
- RLS: מסתמך על מדיניות `profiles` הקיימת (owner can select/update own row). אין טבלה חדשה ⇒ אין policies חדשות; לוודא שעמודות אלו כלולות ב-`update` policy הקיים (אם הוא column-scoped — לרוב לא, אז תקין).
- אין שינוי במפתח של טבלאות הרישום (water/nutrition/body_weight) — נשארות keyed by local `date` text. אין צורך ב-backfill נתונים, רק בפירוש.
- edge functions שמחשבות אגרגציות יומיות: לקרוא `timezone` מ-`profiles` ולחשב `AT TIME ZONE` — שינוי קוד, לא סכמה.

### קבצים
- create: `src/utils/datetime.ts` — מקור-אמת: `getToday(tz)`, `toDateKey(date, tz)`, `isToday(dateKey, tz)`, `startOfDayInTz`, `getWeekStart(date, firstDay, tz)`, `formatDate(dateKey, {format, locale})`, `formatTime(iso, {time_format})`, `getDeviceTimezone()`.
- create: `src/contexts/DateTimeContext.tsx` — מספק `timezone` + העדפות מ-`profiles`, מאזין ל-`visibilitychange`/`resume` לרענון "היום".
- create: `supabase/migrations/20260609000000_profile_datetime_prefs.sql`.
- create: `src/pages/settings/sections/DateTimeSection.tsx` — בורר tz, date_format, time_format, first_day_of_week (Hebrew copy, RTL).
- create: `src/utils/__tests__/datetime.test.ts` — בדיקות DST, גבול-יום בישראל 00:00–03:00, first-day-of-week.
- modify: `src/utils/dateUtils.ts` — להפוך פונקציות תצוגה ל-thin wrappers מעל `datetime.ts` או לסמן כ-deprecated; להעביר `todayStr`/`toLocalDateStr`/`isToday`/`getWeekStart`.
- modify: `src/pages/nutrition/components/DateNavigator.tsx` — להחליף `new Date(selectedDate).toLocaleDateString` ב-`formatDate(selectedDate, prefs)` + `dir="ltr"`/`.kinetic-number`.
- modify: `src/pages/Nutrition.tsx` — `todayLabel` דרך `datetime.ts`.
- modify: `src/pages/Settings.tsx` — לרשום את `DateTimeSection`.
- modify: edge functions של סיכומים יומיים (ב-`supabase/functions/*`) — `AT TIME ZONE`.

### תלויות וחבילות
- npm: `date-fns-tz` (ולוודא `date-fns` קיים; אם לא — להוסיף). אין תלות native חדשה.
- אופציונלי native: `@capacitor/device` (כבר עשוי להיות בתכנון Capacitor) — לא חובה ל-feature זה.
- env/secrets: אין חדשים. edge functions כבר עם `SUPABASE_*`.
- external services: אין. נשען על `Intl` הילידי לרשימת אזורי הזמן (`Intl.supportedValuesOf('timeZone')`).

### סיכונים
- **DST ובלבול גבול-יום:** באג עדין — חישוב גבול-יום שגוי מזיז רישומים. נדרשות בדיקות DST ייעודיות; זה הסיכון העיקרי.
- **רגרסיה ברישומים קיימים:** אם נשנה את כלל מפתח התאריך, רישומים היסטוריים "יזוזו" יום. מיטיגציה: לא לכתוב מחדש, רק לפרש (interpret-as-stored).
- **סטיית client↔edge:** אם edge ממשיך UTC בעוד client עבר ל-tz — streaks/סיכומים לא יתאימו. לסנכרן שינוי בשני הצדדים בו-זמנית.
- **גודל באנדל PWA:** Luxon היה מנפח; `date-fns-tz` ממתן. לאמת bundle size אחרי הוספה.
- **App Store / legal:** סיכון נמוך — אין הרשאות native רגישות, אין מיקום (אזור-זמן ≠ geolocation, לא דורש permission). אין השלכות מס/חוק. שינוי tz ידני לא מצריך הסכמה מיוחדת. נקודת a11y/IS 5568: בוררים חייבים label-above + תמיכת קורא-מסך עברי.
- **שינוי tz בזמן ריצה במכשיר:** אם לא מאזינים ל-resume, "היום" יתקע — מטופל ב-`DateTimeContext`.

### מאמץ והערכה
- **M** — כ-7 ימי עבודה.
- פירוק: `datetime.ts` + בדיקות DST/גבול-יום (2.0); מיגרציה + עמודות `profiles` (0.5); `DateTimeContext` + זיהוי אוטומטי + resume listener (1.0); `DateTimeSection` UI עברי RTL + a11y (1.0); החלפת קריאות אד-הוק ב-`DateNavigator`/`Nutrition`/`dateUtils` + שאר השימושים (1.5); edge `AT TIME ZONE` + עקביות (1.0).

### שלב מומלץ
- **שלב 2.** לא חוסם השקה (ברירת-המחדל הנוכחית — אזור זמן מכשיר — עובדת סביר ל-95% מהמשתמשים בישראל), אך הוא בסיס נכון לפני פיצ'רים תלויי-זמן (streaks, סיכומים יומיים, תזכורות, push) ולפני הרחבת קהל לאזורי זמן מרובים/נסיעות. עשייתו מוקדם מדי (שלב 1) מסיטה משאבים מהליבה; דחייתו לשלב 3 תכפה ריפקטור כפול אחרי שייכתב עוד קוד תאריך אד-הוק.

### סקיל לשימוש
- `hebrew-content-writer` — כל הקופי של `DateTimeSection` (תוויות בורר, מצבי ריקות, הסבר על מיפוי רישומים ישנים).
- `hebrew-rtl-best-practices` — תצוגת תאריכים/שעות `dir="ltr"` בתוך layout RTL, מעורבות מספר/עברית, מראת אייקונים.
- `israeli-accessibility-compliance` — בוררי ההעדפות (label-above, ARIA, קורא-מסך עברי) לפי IS 5568.
- `impeccable` / `design-taste-frontend` — מעבר ויזואלי/a11y על הסקשן החדש ועל `DateNavigator` המעודכן.

---

## ווידג'טים למסך הבית ולמסך הנעילה

### מצב נוכחי
המוצר כיום הוא PWA טהור ללא עטיפה נטיבית, ולכן **אין כיום שום יכולת ווידג'ט** — לא iOS ולא Android. כל ה"כרטיסים הזריזים" קיימים רק בתוך ה-DOM של האפליקציה:
- `src/pages/Dashboard.tsx` — מרכז את שלושת מקורות הנתונים שווידג'ט יציג: "האימון של היום" (`TodaysWorkoutCard`), רצף (`WorkoutStreak sessions={workoutSessions}`), וסיכום שבועי (`weekData` עם `workoutsThisWeek`, `volume`, `totalMinutes`).
- `src/components/dashboard/TodaysWorkoutCard.tsx` — קורא ל-`getTodaysScheduledWorkouts()` ומאזין realtime ל-`workout_schedule`. זהו בדיוק ה-payload ל"ווידג'ט האימון הבא".
- `src/services/coach/scheduleService.ts` — `getTodaysScheduledWorkouts()` / `getMySchedule(from,to)` מחזירים `ScheduledWorkout[]` (`title`, `templateId`, `status`, `scheduledDate`). מקור-אמת לאימון המתוכנן.
- `supabase/migrations/20260608000100_workout_schedule.sql` — טבלת `public.workout_schedule` (RLS: `ws_owner_all`, `ws_coach_all`; כבר ב-`supabase_realtime`). זה הבק-אנד שמזין את כרטיס היום.
- `src/hooks/useWorkoutStreak.ts` — `{ current, best, activeToday }` ממוחזר מ-sessions. מקור-אמת לסלקטור הרצף.
- `src/services/nutritionService.ts` — `sumEntryMacros()`, `calcMacroTotals()`, `DEFAULT_MACRO_GOALS`, `NUTRITION_GOALS_KEY`, `todayStr()`. מכאן נגזרים קלוריות/מאקרו של היום לווידג'ט תזונה.
אין `capacitor.config.ts`, אין ספריות Capacitor ב-`package.json`, אין תיקיות `ios/` או `android/`.

### מצב יעד
ווידג'טים נטיביים אמיתיים שמוזנים מ"widget snapshot" יחיד שה-JS כותב:
- **iOS (WidgetKit, SwiftUI):** ווידג'ט מסך-בית (small/medium) "האימון הבא + רצף"; ווידג'ט מסך-נעילה (iOS 16+, `accessoryCircular`/`accessoryRectangular`) לרצף/קלוריות; **Live Activity (ActivityKit)** לאימון פעיל + טיימר מנוחה על מסך הנעילה ו-Dynamic Island.
- **Android (App Widget + Glance):** ווידג'ט מסך-בית "האימון הבא + רצף + קלוריות". **חשוב להיות כנים:** ל-Android אין ווידג'טים אמיתיים על מסך הנעילה למשתמש מאז Android 5 — תחליף לאימון פעיל הוא **ongoing notification** בסגנון media עם טיימר.
- כל לחיצה על ווידג'ט פותחת deep link אל המסך הרלוונטי (`/workout/:templateId`, `/dashboard`, `/nutrition`).
- **fallback ל-PWA/web:** אין. ווידג'טים מחייבים קוד נטיבי; ב-PWA לבדה אי אפשר.

### גישה טכנית
**WEB (משותף, JS):** הוספת Capacitor כעטיפה (`@capacitor/core` + `@capacitor/ios` + `@capacitor/android`), `capacitor.config.ts` עם `appId`/`scheme` ל-deep links. שכבת JS אחת — `src/services/widgets/widgetSnapshot.ts` — שמרכיבה אובייקט `WidgetSnapshot` משלושת הסלקטורים הקיימים (schedule, streak, macros) וכותבת אותו דרך פלאגין Capacitor מותאם בכל מעבר רקע / שמירת אימון / שמירת ארוחה. ה-snapshot מינימלי (מספרים + 1-2 מחרוזות), כי ווידג'טים מצליבים מ-storage משותף בלבד — **לא מריצים JS ולא WebView**.

**NATIVE/Capacitor (חובה, אין דרך אחרת):**
- פלאגין Capacitor מותאם `WidgetBridge` (לא קיים בשוק לרצף/macros הספציפי): `WidgetBridge.setSnapshot(data)` ו-`WidgetBridge.startLiveActivity()/updateLiveActivity()/endLiveActivity()`.
  - **iOS:** הפלאגין כותב ל-**App Group** משותף (`group.com.sparkos.fitness`) דרך `UserDefaults(suiteName:)` או קובץ JSON ב-container; קורא `WidgetCenter.shared.reloadAllTimelines()`. ה-Widget Extension (Target נפרד, SwiftUI `TimelineProvider`) קורא את אותו App Group. Live Activity = `ActivityKit` + `ActivityAttributes` (טיימר מנוחה עם `Text(timerInterval:)` שמתעדכן ללא JS).
  - **Android:** הפלאגין כותב ל-`SharedPreferences`/DataStore ושולח broadcast `AppWidgetManager.updateAppWidget(...)`. ה-Widget = `GlanceAppWidget` (Compose Glance) שקורא DataStore. "אימון פעיל" = `NotificationCompat` ongoing + chronometer.
- refresh cadence: iOS WidgetKit מאחד timelines (אין רענון לפי דרישה מיידי תמיד) — לכן כותבים snapshot גם בכל `App did enter background` וגם דרך `reloadAllTimelines`. Live Activity מתעדכן מיידית בזמן אימון פעיל. Android Glance מתעדכן ב-broadcast מיידי + `PeriodicWorkRequest` (מינימום ~15 דק').
- deep links: `@capacitor/app` `appUrlOpen` → React Router navigate.

### מודל נתונים
אין צורך בטבלאות חדשות מהותיות — הנתונים נגזרים מטבלאות קיימות. אופציונלי, להעדפות ווידג'ט (איזה ווידג'ט מציג מה) בענן לצורך מולטי-מכשיר:
```sql
-- OPTIONAL migration: supabase/migrations/20260612000000_widget_prefs.sql
CREATE TABLE IF NOT EXISTS public.widget_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_next_workout BOOLEAN NOT NULL DEFAULT true,
  show_streak       BOOLEAN NOT NULL DEFAULT true,
  show_macros       BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.widget_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_owner_all" ON public.widget_prefs
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```
ה-snapshot עצמו (חוזה JS→native) נשמר במכשיר ב-App Group / SharedPreferences בלבד, לא ב-Postgres:
```ts
// WidgetSnapshot — written to App Group (iOS) / SharedPreferences (Android)
interface WidgetSnapshot {
  schemaVersion: 1;
  nextWorkout: { title: string; templateId: string | null; status: 'planned'|'done'|'skipped' } | null;
  streak: { current: number; best: number; activeToday: boolean };
  macros: { calories: number; goalCalories: number; protein: number } | null;
  updatedAt: string; // ISO
}
```
הערת RLS: שום נתון רגיש לא נחשף בווידג'ט מעבר למה שכבר מוצג ב-Dashboard; ה-snapshot נכתב רק עבור המשתמש המחובר במכשיר.

### קבצים
- create: `capacitor.config.ts` (appId, scheme, deep links)
- create: `src/services/widgets/widgetSnapshot.ts` (מרכיב `WidgetSnapshot` מ-`getTodaysScheduledWorkouts`, `useWorkoutStreak`/`computeStreak`, `sumEntryMacros`+`DEFAULT_MACRO_GOALS`)
- create: `src/services/widgets/liveActivity.ts` (start/update/end לאימון פעיל + טיימר מנוחה)
- create: `src/plugins/widget-bridge/` (Capacitor plugin: `definitions.ts`, `web.ts` no-op, `index.ts`)
- create: `ios/App/WidgetExtension/` (SwiftUI: `Provider.swift`, `WidgetView.swift`, `LiveActivity.swift`, `Attributes.swift`)
- create: `android/app/src/main/java/.../widget/` (`StreakGlanceWidget.kt`, `GlanceReceiver.kt`, `WorkoutNotification.kt`)
- modify: `src/services/workoutDb.ts` או נקודת שמירת אימון — קריאה ל-`writeWidgetSnapshot()` אחרי שמירה (ליד `reconcileScheduleOnSessionSave`)
- modify: `src/services/nutritionService.ts` callers — לרענן snapshot אחרי `addMealEntry`/`updateMealEntry`
- modify: `src/components/dashboard/TodaysWorkoutCard.tsx` — ב-`load()` להזרים snapshot מעודכן (כבר מאזין realtime ל-`workout_schedule`)
- modify: `src/App.tsx` (או root) — `appUrlOpen` listener → navigate
- modify: `src/pages/settings/sections/NotificationsSection.tsx` (או חדש `WidgetsSection.tsx`) — toggles + הסבר הרשאות
- create: `supabase/migrations/20260612000000_widget_prefs.sql` (אופציונלי)

### תלויות וחבילות
- npm: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/app` (deep links), `@capacitor/preferences` (ל-snapshot פשוט בצד Android). Live Activities — אין פלאגין רשמי בוגר, כותבים native בעצמנו (אפשר לבדוק `capacitor-live-activities` כקהילה אך לא לסמוך עליו).
- native iOS: Xcode, Swift, WidgetKit + ActivityKit, App Group capability, Apple Developer account ($99/שנה).
- native Android: Android Studio, Kotlin, Jetpack **Glance** (`androidx.glance:glance-appwidget`), DataStore.
- env/secrets: `appId` (`com.sparkos.fitness`), App Group id (`group.com.sparkos.fitness`), URL scheme + Universal/App Links domain (לקישורי deep link אמינים). אין סוד API חדש.
- external: Apple App Store + Google Play (חשבונות מפתח, חתימת build).

### סיכונים
- **App Store / Play review:** עטיפת PWA ב-Capacitor צריכה תוכן נטיבי מספק (ווידג'טים + Live Activities עוזרים לעבור את Guideline 4.2 "minimum functionality"); דחייה אפשרית אם נתפס כ"אתר עטוף". כנות: זה הסיכון העיקרי.
- **iOS WidgetKit אינו real-time:** רענון timelines מתוזמן/מקובץ ע"י המערכת — "האימון הבא" עלול להיות מאחר בדקות. Live Activity הוא הנתיב היחיד לעדכון מיידי (וגם הוא תלוי במגבלות מערכת).
- **Android אין lock-screen widget אמיתי** — חובה לתקשר זאת למשתמש (UI copy) כדי לא להבטיח יתר.
- **תחזוקה כפולה:** שתי שכבות נטיביות (Swift+Kotlin) + build נפרד לכל פלטפורמה; כל שינוי חוזה snapshot מחייב נגיעה ב-3 שפות.
- **App Group / SharedPreferences נתונים על המכשיר:** לא לחשוף PII; מספרים + שם אימון בלבד.
- **legal/a11y:** ווידג'ט הוא משטח UI — צריך contrast ו-`accessibilityLabel` נטיבי (מקביל ל-aria) בעברית RTL; ServerKit מצייר RTL לבד אם הטקסט עברי, אך לוודא.

### מאמץ והערכה
**XL** — הערכה כוללת ~**14–20 ימי עבודה**:
- תשתית Capacitor + config + deep links + build ראשון לשתי פלטפורמות: 3–4 ימים.
- פלאגין `WidgetBridge` (JS defs + iOS native + Android native): 3–4 ימים.
- iOS WidgetKit (home + lock-screen) + App Group: 3 ימים.
- iOS Live Activity (אימון פעיל + טיימר מנוחה): 3–4 ימים (הכי מסוכן).
- Android Glance widget + ongoing notification: 3 ימים.
- snapshot JS layer + חיווט ל-save hooks + הגדרות + בדיקות: 2 ימים.

### שלב מומלץ
**שלב 3.** תלוי קודם באימוץ Capacitor כעטיפה נטיבית (אותה תשתית שמשמשת haptics/IAP/push) — לכן חייב לבוא אחרי החלטת ה-distribution והקמת ה-build הנטיבי. אינו חוסם פיצ'רים אחרים אך נשען על השלב הנטיבי. ערך מוצר גבוה לשימור (retention) אך לא קריטי ל-MVP.

### סקיל לשימוש
- `israeli-accessibility-compliance` — תוויות נגישות נטיביות (VoiceOver) ו-contrast לווידג'טים.
- `hebrew-content-writer` — נוסח עברי קצר וקולע לטקסט הווידג'ט/Live Activity (מגבלת תווים חמורה).
- `hebrew-rtl-best-practices` — וידוא RTL בעברית בתוך SwiftUI/Glance (כיוון, מספרים `dir=ltr` מקבילה נטיבית).
- `impeccable` / `design-taste-frontend` — שמירה על שפת Fresh Steel/Obsidian (טוקני `--fs-*` → ערכי צבע נטיביים) בעיצוב הווידג'ט.

---

## חיבור ליומנים חכמים — Google Calendar

### מצב נוכחי
- קיים מקור-אמת לאימונים מתוזמנים: `supabase/migrations/20260608000100_workout_schedule.sql` — טבלה `public.workout_schedule` עם `user_id`, `coach_id`, `template_id`, `assignment_id`, `scheduled_date DATE`, `title`, `status ('planned'|'done'|'skipped')`, `session_id`, ו-RLS (`ws_owner_all`, `ws_coach_all` דרך `is_coach_of`). זהו ה-feed הטבעי ל-push ליומן. שים לב: `scheduled_date` הוא `DATE` בלבד — אין שעה; שעת ברירת-מחדל תידרש (ראה מודל נתונים).
- תזכורות מאמן קיימות: `src/pages/coach/client/RemindersBox.tsx` עם `schedule` JSONB (`time`, `date`, `days[]`) דרך `src/services/coach/reminderService.ts`. דפוס תזמון מוכן לשימוש חוזר, אך זה לא יעד ה-push הראשון.
- הגדרות התראות: `src/pages/settings/sections/NotificationsSection.tsx` — toggles בלבד (`workoutReminderEnabled`, push בזמן אמת). אין כאן חיבור OAuth — צריך section/כרטיס חדש.
- דפוס edge function בשל ומאובטח: `supabase/functions/coach-invite-accept/index.ts` ו-`coach-push-send/index.ts` — CORS fail-closed (`ALLOWED_ORIGIN`), זיהוי caller מ-JWT עם anon client ואז פעולה ב-service role, rate-limit ledger (`rate_limit_events`), secrets דרך `Deno.env.get`. אין כיום שום edge function ל-OAuth של ספק חיצוני (Glob: רק `ai-chat`, `coach-invite-accept`, `coach-push-send`).
- אין כיום Capacitor wrapper, אין plugin ליומן-מכשיר, אין ספריית .ics. (החלטת מוצר: לעטוף ב-Capacitor — הנתיב ה-native נכלל כאן.)

### מצב יעד
- משתמש מחבר חשבון Google מ-`Settings` (connect/disconnect) דרך OAuth 2.0 עם scope `https://www.googleapis.com/auth/calendar.events` בלבד.
- כל שורת `workout_schedule` עם `status='planned'` נדחפת כ-event ליומן Google של המשתמש (one-way push). שינוי/מחיקה של אימון מעדכן/מוחק את ה-event המתאים.
- ה-client secret של Google אף פעם לא נחשף לדפדפן — code-exchange ו-refresh קורים אך ורק ב-edge function.
- נפילות-חן: כפתור "ייצוא .ics" (לכל המכשירים, ללא חיבור), ועל native — כתיבה ליומן-המכשיר דרך Capacitor plugin כחלופה ל-OAuth ענן.
- שלב 2 אופציונלי: two-way sync (sync tokens / watch channels) — מסומן בלבד, לא בסקופ הראשון.

### גישה טכנית
**OAuth flow (WEB):** redirect-based authorization-code + PKCE. הדפדפן פותח `accounts.google.com/o/oauth2/v2/auth` עם `client_id`, `redirect_uri` (route ייעודי כמו `/settings/calendar/callback`), `scope=calendar.events`, `access_type=offline`, `prompt=consent` (לקבלת refresh_token), `state` (CSRF, נשמר ב-sessionStorage). ה-callback שולח את ה-`code`+`code_verifier` ל-edge function `gcal-oauth` שמבצע token-exchange מול `oauth2.googleapis.com/token` עם ה-client secret (server-side) ושומר `access_token`/`refresh_token`/`expiry` ב-`external_calendar_links` (service role).

**OAuth flow (NATIVE/Capacitor):** אותו edge function, אך ה-authorize נפתח דרך `@capacitor/browser` (in-app browser/Custom Tab) ו-redirect חוזר דרך deep-link/App Link (custom URL scheme, למשל `app.sparkos://calendar-callback`) שה-app תופס ומעביר את ה-`code` לאותו edge function. אין הבדל בצד השרת.

**Push (שני הנתיבים):** edge function `gcal-sync` (קריא מה-client או מ-DB trigger/cron). לכל `workout_schedule` רלוונטי: אם `access_token` פג — מרענן דרך refresh_token (server-side); ואז `POST/PATCH/DELETE` ל-`www.googleapis.com/calendar/v3/calendars/primary/events`. ה-mapping בין שורת-לוח ל-event id נשמר ב-`calendar_event_map`. trigger אפשרי: realtime על `workout_schedule` (כבר ב-publication) מפעיל reconcile, או `pg_cron` יומי.

**NATIVE device-calendar (חלופה):** plugin Capacitor (למשל `@ebarooni/capacitor-calendar` או `capacitor-calendar`) כותב ישירות ליומן המקומי ללא ענן/OAuth — מתאים למי שלא רוצה לחבר Google. זה לא דורש edge function אך גם לא מסתנכרן בין מכשירים.

**.ics fallback (WEB+NATIVE):** ייצור קובץ `.ics` (VEVENT לכל אימון מתוזמן) בצד-לקוח עם `ics` npm package והורדה/שיתוף — עובד בכל פלטפורמה ללא הרשאות.

### מודל נתונים
```sql
-- 20260609000000_external_calendar.sql
CREATE TABLE public.external_calendar_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google'
        CHECK (provider IN ('google')),
    -- tokens written ONLY by edge function (service role); clients never read them
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    google_email TEXT,           -- display only, for "מחובר כ-..."
    calendar_id TEXT DEFAULT 'primary',
    default_event_time TIME DEFAULT '18:00', -- scheduled_date is DATE-only
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sync_token TEXT,             -- reserved for phase-2 two-way sync
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);
ALTER TABLE public.external_calendar_links ENABLE ROW LEVEL SECURITY;
-- Owner may SELECT only non-secret columns via a VIEW; deny direct token reads.
-- Simplest safe policy: NO client SELECT of token columns.
CREATE POLICY ecl_owner_read ON public.external_calendar_links
    FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY ecl_owner_delete ON public.external_calendar_links
    FOR DELETE USING (user_id = (SELECT auth.uid())); -- disconnect
-- INSERT/UPDATE of tokens done by service role only (no client policy).

CREATE TABLE public.calendar_event_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.workout_schedule(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google',
    external_event_id TEXT NOT NULL,   -- Google event id
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced'
        CHECK (sync_status IN ('synced','pending','error')),
    UNIQUE (schedule_id, provider)
);
ALTER TABLE public.calendar_event_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY cem_owner_read ON public.calendar_event_map
    FOR SELECT USING (user_id = (SELECT auth.uid()));
-- writes by service role (edge function) only.
```
- הצפנת tokens: לכל הפחות tokens ב-service-role-only columns; עדיף הצפנה ב-`pgcrypto`/Vault ב-edge function עם `CALENDAR_TOKEN_KEY` secret. אל תאפשר ל-client לקרוא `access_token`/`refresh_token`.
- `default_event_time` פותר את חוסר-השעה ב-`scheduled_date DATE`.

### קבצים
- create: `supabase/migrations/20260609000000_external_calendar.sql` (שתי הטבלאות + RLS לעיל).
- create: `supabase/functions/gcal-oauth/index.ts` (+ `config.toml`) — token-exchange + refresh + disconnect; דפוס fail-closed CORS + JWT-identify + service-role + rate-limit מ-`coach-invite-accept`.
- create: `supabase/functions/gcal-sync/index.ts` (+ `config.toml`) — reconcile של `workout_schedule` ↔ Google events דרך `calendar_event_map`.
- create: `src/services/calendar/googleCalendarService.ts` — client: התחלת OAuth (PKCE+state), קריאה ל-edge functions, status.
- create: `src/services/calendar/icsExport.ts` — ייצור `.ics` מ-`workout_schedule`.
- create: `src/services/calendar/nativeCalendar.ts` — עטיפת Capacitor plugin (guard ל-`Capacitor.isNativePlatform()`).
- create: `src/pages/settings/sections/CalendarSection.tsx` — connect/disconnect, "מחובר כ-{google_email}", toggle push, כפתור ייצוא .ics.
- create: `src/pages/settings/CalendarCallback.tsx` (route) — קולט `code`+`state`, שולח ל-`gcal-oauth`.
- modify: `src/pages/Settings.tsx` — רישום ה-section החדש.
- modify: `src/pages/settings/sections/NotificationsSection.tsx` — קישור קצר ל"סנכרון יומן" (לא לכפול את ה-OAuth כאן).
- modify: router (היכן שמוגדרות routes של settings) — להוסיף `/settings/calendar/callback`.
- modify: `capacitor.config.ts` (ייווצר עם ה-Capacitor wrapper) — deep-link scheme ל-callback.

### תלויות וחבילות
- npm: `ics` (ייצוא .ics). Native: `@capacitor/browser` (in-app OAuth), `@capacitor/app` (deep-link), plugin יומן-מכשיר (`@ebarooni/capacitor-calendar` או דומה — לבדוק תחזוקה/הרשאות).
- edge (Deno, esm.sh): `@supabase/supabase-js@2` (כבר בשימוש); קריאות ל-Google REST דרך `fetch` ילידי — אין צורך ב-googleapis SDK.
- secrets (`supabase secrets set`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT`, `CALENDAR_TOKEN_KEY` (להצפנה), והקיימים `ALLOWED_ORIGIN`, `SUPABASE_URL/SERVICE_ROLE_KEY/ANON_KEY`. env ל-client: `VITE_GOOGLE_CLIENT_ID` (public — אין secret בצד לקוח).
- external: Google Cloud project — OAuth consent screen, scopes (`calendar.events`), authorized redirect URIs (web + native scheme). שלב-2 watch channels דורש HTTPS webhook endpoint.

### סיכונים
- **Google verification:** scope `calendar.events` הוא sensitive/restricted — Google דורש OAuth verification (לוגו, מדיניות פרטיות, ואולי security assessment) לפני שמשתמשים מחוץ ל-test users יכולים לחבר. עיכוב משמעותי; להתחיל את התהליך מוקדם.
- **App Store / Play:** OAuth ב-WebView טהור נחסם ע"י Google — חובה `@capacitor/browser`/Custom Tab. כתיבה ליומן-מכשיר דורשת הצהרת הרשאה (`NSCalendarsUsageDescription` ב-iOS, `READ/WRITE_CALENDAR` ב-Android) ו-rationale; חוסר → דחיית review. שיתוף נתוני-אימון עם צד ג' (Google) חייב להופיע ב-App Privacy / Data Safety.
- **אבטחת tokens:** דליפת refresh_token = גישה ליומן. חובה service-role-only + הצפנה; אסור להחזיר tokens ל-client; disconnect חייב לבצע גם token revoke מול Google.
- **משפטי/פרטיות:** מסך consent מפורש לפני חיבור, עדכון מדיניות פרטיות (העברת נתונים ל-Google), ותמיכה במחיקה (disconnect מנקה links + מוחק events דרך mapping). שילוב עם `DangerZoneSection`/מחיקת חשבון.
- **rate limits / כפילויות:** Google Calendar API quotas; reconcile חייב להיות idempotent דרך `calendar_event_map` (UNIQUE על schedule) כדי לא ליצור events כפולים.
- **`scheduled_date` DATE-only:** event ללא שעה אמיתית; `default_event_time` הוא פשרה — לתקשר זאת ב-UI.

### מאמץ והערכה
**L — ~9–13 ימי עבודה.**
- מיגרציה + RLS: ~1.
- `gcal-oauth` (exchange/refresh/revoke + הצפנה): ~2.
- `gcal-sync` (reconcile idempotent): ~2.5.
- UI: `CalendarSection` + callback route + consent: ~2.
- ‎.ics export: ~0.5–1.
- Native: `@capacitor/browser` flow + deep-link + plugin יומן-מכשיר + הרשאות: ~2 (תלוי שה-Capacitor wrapper כבר קיים).
- בדיקות (unit ל-mapping/ics, integration mock ל-edge, E2E flow): ~1.5.
- לא כולל זמן verification של Google (חיצוני, שבועות) ו-two-way sync (שלב נפרד).

### שלב מומלץ
**שלב 2.** תלוי ב-Capacitor wrapper (החלטת מוצר 1) לנתיב ה-native ובתשתית edge-functions שכבר קיימת. ה-OAuth verification של Google ארוך — להתחיל את הבקשה כבר בשלב 1 במקביל. one-way push הוא הליבה; two-way (sync tokens/watch channels) דחוי לשלב 3.

### סקיל לשימוש
- `hebrew-content-writer` — כל הקופי הנראה: כרטיס החיבור, מסך ה-consent, מצבי שגיאה/הצלחה, aria-labels.
- `israeli-accessibility-compliance` — נגישות מסך ה-consent/החיבור (IS 5568, RTL ARIA, focus, status announcements).
- `hebrew-rtl-best-practices` — פריסת ה-section, מספרים/תאריכים `dir="ltr"`, מירור אייקונים.
- `impeccable` / `design-taste-frontend` — מעבר עיצוב/anti-slop ל-`CalendarSection` בטוקנים `var(--fs-*)`.

---

## פידבק מגע ורטט (Haptic Feedback)

### מצב נוכחי

בניגוד להנחת ה-brief, שכבת ה-haptics **כבר קיימת ובוגרת** בקוד — היא web-only ומבוססת `navigator.vibrate`. נמצא בפועל בקבצים שנקראו:

- `src/utils/haptics.ts` — ה-SSOT היחיד. מכיל: gate יחיד `vibrate()`, דגל מודולרי `_hapticsEnabled` עם `setHapticsEnabled()`, `isIOSDevice()`, אוצר מילים קנוני `EFFECT_PATTERNS` (`tap/success/error/warning/selection/impact/notification/swipe/longPress`), `INTENSITY_MULTIPLIERS` (`light/medium/heavy`), `triggerHapticEffect()`, `triggerHapticIntensity()`, אובייקט `haptics` (`tick/soft/medium/escalation/thump/prStamp`) + API legacy שלם (`triggerHaptic`, `hapticSetComplete`, `hapticRestEnd`, `hapticPR`, `HAPTIC_PATTERNS`). כל ערוצי הרטט מנותבים דרך `vibrate()` היחיד.
- `src/hooks/useHaptics.ts` — wrapper דק שקורא את הדגל החי `settings.workoutSettings?.hapticsEnabled` ומחזיר `triggerEffect/hapticSuccess/hapticError/...` + `capabilities {supportsVibration, isIOS}`.
- `src/hooks/useHapticFeedback.ts` — facade מצומצם (`tap/selection/success/warning/error/impact`) לרכיבי UI.
- `src/contexts/SettingsContext.tsx:202-205` — `useEffect` שמסנכרן `settings.workoutSettings.hapticsEnabled` אל `setHapticsEnabled()` ב-utils. ברירת מחדל `hapticsEnabled: true` (שורה 28).
- הטוגל ב-UI **כבר קיים** ב-`src/pages/settings/sections/WorkoutPrefsSection.tsx:93-106` (אייקון `Zap`, תווית "רטט (Haptic Feedback)"), מגובה בשדה `WorkoutPrefs.hapticsEnabled` ב-`src/pages/settings/types.ts:34` ו-`DEFAULT_WORKOUT_PREFS` (שורה 83).
- נקודות trigger קיימות: `src/components/workout/components/InlineRestTimer.tsx:49,54` קוראות `triggerHaptic('light')`; וכ-49 קבצים נוספים מייבאים haptics (חיפוש מהיר). `src/pages/workout-detail/ExerciseCard.tsx` עצמו הוא רכיב סיכום read-only ואינו צרכן haptics.

החוסר היחיד והאמיתי: **iOS Safari אינו תומך ב-Vibration API**, ולכן `triggerHapticEffect` עושה `return` מוקדם על iOS (`utils/haptics.ts:94`) — אין שום פידבק מגע ב-iOS היום. גם Android Chrome מקבל רק רטט גס ולא Taptic מדורג. אין `@capacitor/*` בפרויקט (PWA טהור).

### מצב יעד

- פידבק מגע אמיתי ב-**iOS** דרך Taptic Engine (impact light/medium/heavy, notification success/warning/error, selection) כשהאפליקציה רצה כ-Capacitor native.
- ב-**Android native** — haptics מובנה של המערכת (איכותי יותר מ-`navigator.vibrate`).
- ב-**web PWA** — שימור ההתנהגות הקיימת (Android Chrome מרטט, iOS Safari no-op), ללא רגרסיה.
- מסלול אחד: כל call site ממשיך לקרוא לאותו `utils/haptics` — ה-platform branching מוסתר בפנים בלבד.
- כיבוד `prefers-reduced-motion` בנוסף לטוגל ההגדרות, ומיפוי מתועד של נקודות trigger.

### גישה טכנית

**עיקרון מנחה:** לא בונים `haptics.ts` מחדש (קיים). מרחיבים את ה-gate היחיד `vibrate()` כך שיבחר backend בזמן ריצה. כל ה-call sites נשארים ללא שינוי.

- **NATIVE (Capacitor):** כשמזוהה `Capacitor.isNativePlatform()`, ממפים את האוצר הקנוני אל `@capacitor/haptics`:
  - `triggerHapticIntensity('light'|'medium'|'heavy')` → `Haptics.impact({ style: ImpactStyle.Light|Medium|Heavy })`.
  - `success/warning/error` → `Haptics.notification({ type: NotificationType.Success|Warning|Error })`.
  - `selection/tap` → `Haptics.selectionStart()`/`selectionChanged()`/`selectionEnd()` או `impact(Light)`.
  - patterns מרובי-פעימה (`escalation`, `prStamp`, `notification`) → רצף `impact` עם `setTimeout` קצר, או mapping ל-`notification` כשמתאים סמנטית (Capacitor אינו מקבל מערך ms חופשי).
  - הקריאות הן async; עוטפים ב-fire-and-forget עם `.catch()` שמתועד דרך `logger` (לא לזרוק לעולם, כמו ה-gate הקיים).
- **WEB:** אם לא native אך `'vibrate' in navigator` → המסלול הקיים `navigator.vibrate(pattern)` ללא שינוי.
- **NO-OP:** iOS Safari web (אין Vibration API ואין Capacitor) → return שקט, בדיוק כהיום.
- **בחירת backend:** מודול `src/utils/hapticsBackend.ts` שמייצא `getBackend(): 'native' | 'web' | 'noop'` ופונקציות `nativeImpact/nativeNotification/nativeSelection`. הייבוא של `@capacitor/haptics` חייב להיות **dynamic import עצל** כדי שב-web build (ללא Capacitor) ה-bundle לא ישבר — או לחלופין הסתמכות על `@capacitor/core` שמותקן תמיד ומחזיר `isNativePlatform() === false` בווב.
- **prefers-reduced-motion:** מוסיפים בדיקה ב-`canVibrate()` ב-`utils/haptics.ts` — `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → אם כן, מדכאים effects (פרט אולי ל-error/warning שהם פונקציונליים; להחליט ב-impeccable). זה משלים את הטוגל הקיים, לא מחליף אותו.
- **סנכרון הדגל:** `SettingsContext.tsx:204` כבר מסנכרן `setHapticsEnabled` — אין שינוי נדרש; הדגל גם gate-ים את המסלול ה-native כי כל הקריאות עוברות דרך `canVibrate()`/`triggerHapticEffect`.

### מודל נתונים

אין צורך בשינויי DB. ה-haptics הוא העדפת מכשיר מקומית בלבד.

- אין טבלאות חדשות, אין עמודות, אין RLS, **אין migration**.
- ההעדפה `hapticsEnabled` כבר נשמרת ב-`localStorage` דרך `WorkoutPrefs` (`saveToStorage` ב-`settings/types.ts`) וב-`AppSettings.workoutSettings`.
- אופציונלי (לא חובה, מחוץ ל-scope): אם בעתיד רוצים סנכרון העדפה בין מכשירים — עמודה `profiles.haptics_enabled boolean default true`. לא נדרש לפיצ'ר זה; מומלץ להשאיר מקומי (haptics תלוי-מכשיר).

```sql
-- NOT required for this work-stream; documented only as a future option:
-- ALTER TABLE profiles ADD COLUMN haptics_enabled boolean NOT NULL DEFAULT true;
-- RLS already covers profiles (owner-only); no new policy needed.
```

### קבצים

- **create:** `src/utils/hapticsBackend.ts` — בחירת backend (`native`/`web`/`noop`) + עטיפות `nativeImpact/nativeNotification/nativeSelection` סביב `@capacitor/haptics` (dynamic import עצל), כולל `.catch()` ל-logger.
- **modify:** `src/utils/haptics.ts` — להזריק את `getBackend()` בתוך `vibrate()`/`triggerHapticEffect()`/`triggerHapticIntensity()`; להוסיף בדיקת `prefers-reduced-motion` ל-`canVibrate()`; למפות patterns מרובי-פעימה למסלול native. שמירה על כל החתימות הקיימות (אפס שבירת call sites).
- **modify:** `src/pages/settings/sections/WorkoutPrefsSection.tsx` — שיפור קטן: עדכון helper-text/aria כך שיבהיר שב-iOS דרך הדפדפן אין רטט (כיום הטוגל אילם שם). אופציונלי: הצגת "לא נתמך במכשיר זה" כשאין capability.
- **modify:** `vite.config.ts` / `package.json` — אם נבחר dynamic import, לוודא שאין eager bundling של `@capacitor/haptics` ב-web build.
- **create:** `capacitor.config.ts` — קונפיג Capacitor בסיסי (משותף עם work-stream ה-Capacitor; לא לשכפל). פיצ'ר ה-haptics **חוסם תלוי** באתחול Capacitor.
- **create (tests):** `src/utils/__tests__/haptics.test.ts` — בדיקות: gate מכבד `_hapticsEnabled`, no-op ב-iOS-web, ניתוב ל-native כש-`isNativePlatform()`, דיכוי ב-reduced-motion.
- **modify (optional, trigger map):** וידוא קריאות בנקודות שעדיין חסרות — set complete, rest-timer end, PR — ע"פ המיפוי למטה. `InlineRestTimer.tsx` כבר משתמש; לבדוק את `useWorkoutHandlers.ts`/`useCelebration.ts` ל-PR.

מיפוי נקודות trigger (יעד):
- set complete → `haptics.tick()` / `impact(light)`
- rest-timer 3-2-1 → `haptics.escalation(sec)` (קיים ב-`InlineRestTimer`)
- rest-timer end / zero → `haptics.thump()` / `notification(success)`
- PR achieved → `haptics.prStamp()` / `notification(success)` (ceremonial)
- error/חסימה → `hapticError()` / `notification(error)`
- pull-to-refresh threshold → `selection`/`impact(light)`

### תלויות וחבילות

- **npm (native):** `@capacitor/haptics` (+ `@capacitor/core` שכבר נדרש ע"י work-stream ה-Capacitor). אין תלות חדשה ל-web בלבד.
- **native:** iOS — pod sync (`npx cap sync ios`), דורש Xcode + Apple Developer account לבנייה אמיתית. Android — Gradle sync (`npx cap sync android`); ה-plugin משתמש ב-`Vibrator`/`VibratorManager` ודורש הרשאת `android.permission.VIBRATE` (נוספת אוטומטית ע"י ה-plugin).
- **env/secrets:** אין. אין שירות חיצוני, אין מפתחות.
- **external services:** אין.

### סיכונים

- **חוסם תלוי ב-Capacitor:** הפיצ'ר לא יכול לספק את ה-iOS native value לפני ש-work-stream ה-Capacitor חי. ב-web בלבד אין רווח חדש (השכבה כבר עובדת).
- **iOS web נשאר אילם:** מי שמשתמש ב-PWA דרך Safari (לא דרך האפליקציה הארוזה) לא יקבל רטט — מגבלת פלטפורמה אמיתית, לא באג. צריך copy שמסביר זאת בהגדרות.
- **App Store review:** haptics הוא שימוש לגיטימי וסטנדרטי ב-`@capacitor/haptics`; **סיכון נמוך**. לדאוג שלא להפעיל רטט אגרסיבי/מתמשך (חוויית משתמש + סוללה). אין סוגיית privacy/permissions מהותית ב-iOS.
- **Android battery/permission:** רטט ממושך מנקז סוללה; ה-patterns כבר "Quiet Luxury" וקצרים — לשמר. הרשאת VIBRATE אוטומטית.
- **רגרסיה ב-web build:** ייבוא eager של `@capacitor/haptics` עלול לשבור את ה-PWA build. חובה dynamic import עצל או gating דרך `@capacitor/core`.
- **כפילות API:** קיים גם `utils/haptics` וגם שני hooks וגם API legacy — סיכון drift. לרכז את ה-branching ב-gate היחיד בלבד ולא לפזר `Capacitor` checks ב-call sites.
- **a11y/legal:** אין סיכון משפטי ישראלי; כיבוד `prefers-reduced-motion` תומך ב-IS 5568.

### מאמץ והערכה

**M** — כ-2.5 ימים (בהנחה ש-Capacitor כבר מאותחל; אחרת מתווסף זמן ה-bootstrap לאותו work-stream).

- `hapticsBackend.ts` + dynamic import + עטיפות native: ~0.75 יום.
- שילוב ב-`utils/haptics.ts` (3 entry points) + `prefers-reduced-motion` ללא שבירת חתימות: ~0.5 יום.
- מיפוי/וידוא נקודות trigger (set/rest/PR/error) + copy בהגדרות: ~0.5 יום.
- בדיקות (`haptics.test.ts`, מוקים ל-`@capacitor/haptics` ול-`matchMedia`) + 80% coverage: ~0.5 יום.
- QA על מכשיר iOS אמיתי + Android: ~0.25 יום.

### שלב מומלץ

**שלב 2.** ה-abstraction ל-web כבר production-ready, אז אין דחיפות בשלב 1; אך ה-iOS native הוא חלק מהבטחת ה-"native capabilities" של ה-Capacitor wrap, ולכן צריך לנחות מיד אחרי שאתחול Capacitor (שלב 1-2) מוכן. תלוי-חוסם ב-Capacitor, ועצמאי מ-payments/groups.

### סקיל לשימוש

- **israeli-accessibility-compliance** — לכיוון מדיניות `prefers-reduced-motion`/IS 5568 וההחלטה אילו effects לדכא.
- **hebrew-content-writer** — לניסוח ה-helper-text/aria בהגדרות (הסבר שב-iOS-web אין רטט; "לא נתמך במכשיר זה").
- **impeccable / design-taste-frontend** — כיול עוצמת/קצב ה-patterns כך שירגישו "Quiet Luxury" ולא רועשים, ובדיקת ה-toggle UX.

---

## פרופיל משתמש אישי מתקדם

### מצב נוכחי
- **הפרופיל היום הוא localStorage בלבד.** `src/pages/settings/types.ts` מגדיר `UserProfile` (`name, age, height, weight, gender, weightGoal, activityLevel`) ואת `DEFAULT_PROFILE`, ונטען דרך `loadFromStorage`/`saveToStorage` (אותו קובץ). אין אף עמודה בטבלת `profiles` שמחזיקה שם/ביו/אווטאר — כל זה לוקאלי למכשיר ולא מסונכרן.
- **האווטאר הוא ראשי-תיבות בלבד.** `src/components/ui/ProfileAvatar.tsx` מחשב initials מהשם ומציג ריבוע accent — אין כל מנגנון העלאת תמונה.
- **טופס הפרופיל** מרונדר ב-`src/pages/settings/sections/ProfileSection.tsx` (autosave debounced/immediate) וב-`src/pages/onboarding/steps/ProfileStep.tsx` (gender pills, age/height/weight). אין שדה bio, אין locale/units, אין DOB.
- **role כבר SSOT בשרת.** `supabase/migrations/20260608000000_profiles_role.sql` הוסיף `profiles.role` (`coach|trainee`) + טריגר `guard_profile_role` + RPC `become_coach`. נרחיב את אותה טבלה — לא נכפיל.
- **תשתית תמונות פרטית קיימת ומוכחת.** `supabase/migrations/20260608000300_progress_photos_storage.sql` מגדיר bucket פרטי `progress-photos` עם policies לפי `(storage.foldername(name))[1] = auth.uid()`. `src/services/coach/checkInService.ts` מממש `compressImageToWebP` → upload → `createSignedUrls` בבאצ' (`getPhotoUrls`, TTL שעה) ו-`PhotoRef{path,width,height}`. `src/pages/coach/client/PhotoTimeline.tsx` צורך את זה (lightbox + compare). דפוס זה ימוחזר 1:1 לאווטאר.
- **אין מנוע הישגים, אין פרופיל ציבורי, אין בקרת פרטיות** בקוד או ב-schema.

### מצב יעד
- אווטאר אמיתי שניתן להעלאה (bucket חדש `avatars`), עם fallback ל-`ProfileAvatar` הקיים.
- `displayName` + `bio` + `dob` (במקום/לצד `age` הנגזר) + `units` (metric/imperial) + `locale` — מסונכרנים לשרת ב-`profiles`.
- כרטיס סטטיסטיקות-כותרת: streak, סך אימונים, נפח כולל, PRs, ספירת badges — נגזר מנתונים קיימים.
- מנוע הישגים: טבלאות `achievements` (קטלוג) + `user_achievements` (זכייה), עם כללי-זכייה מוערכים בלקוח ו/או ב-Edge Function.
- מתג **פרופיל ציבורי/פרטי** + בקרות פרטיות גרנולריות (מה גלוי: שם, אווטאר, סטטיסטיקות, badges) — מתחבר ל-work-stream הקהילה.
- מסך פרופיל ציבורי לצפייה (`/u/:handle`) הנשען על RLS, לא חושף DOB/מדדי גוף.

### גישה טכנית
- **WEB (PWA):** העלאת אווטאר ב-`<input type="file" accept="image/*">` → `compressImageToWebP` (כבר קיים) → upload ל-bucket `avatars` בנתיב `{uid}/avatar.webp` (upsert) → שמירת `avatar_path` ב-`profiles` → `createSignedUrl` לתצוגה (או bucket ציבורי-לקריאה אם הפרופיל ציבורי). מומלץ bucket פרטי + signed URLs לעקביות עם `progress-photos`; ל-public-profile נשתמש ב-signed URL מחודש בכל טעינה.
- **NATIVE/Capacitor:** בשלב ה-Capacitor אפשר להחליף את בורר הקבצים ב-`@capacitor/camera` (`Camera.getPhoto`) לצילום/בחירה נייטיבית; הצינור (compress→upload) זהה. אין חסם App Store — זו רק שדרוג UX. לא נדרש בשלב ראשון.
- **מנוע הישגים:** התחלה בלקוח (evaluate rules על נתוני אימון/check-in קיימים בעת שמירה) שכותב `user_achievements` ב-upsert idempotent. שדרוג עתידי: Edge Function `award-achievements` שמופעל ב-trigger/cron כדי למנוע זיוף בצד-לקוח (ה-RLS כבר מונע insert ישיר — ראו למטה).
- **חזרה לשימוש:** `ProfileAvatar` (fallback initials), `getPhotoUrls`/signed-URL batching, `compressImageToWebP`, `SettingsCard`/`SettingsRow`/`SettingsSelect`.

### מודל נתונים
```sql
-- migration: 20260609000000_profile_advanced.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS handle       TEXT UNIQUE,           -- public slug, citext-lower
  ADD COLUMN IF NOT EXISTS bio          TEXT CHECK (char_length(bio) <= 280),
  ADD COLUMN IF NOT EXISTS avatar_path  TEXT,                  -- {uid}/avatar.webp
  ADD COLUMN IF NOT EXISTS dob          DATE,                  -- age derived; never public
  ADD COLUMN IF NOT EXISTS units        TEXT NOT NULL DEFAULT 'metric'  CHECK (units IN ('metric','imperial')),
  ADD COLUMN IF NOT EXISTS locale       TEXT NOT NULL DEFAULT 'he'      CHECK (locale IN ('he','en')),
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy      JSONB NOT NULL DEFAULT
      '{"stats":true,"badges":true,"avatar":true}'::jsonb;     -- per-field visibility

-- Public read of safe columns only (community). RLS-enforced.
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (is_public = true);   -- column-level masking done in a VIEW

-- View that NEVER exposes dob / body metrics / role internals.
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, handle, display_name, bio, avatar_path, privacy
  FROM public.profiles WHERE is_public = true;

-- Achievements catalog (admin-seeded, read-all).
CREATE TABLE IF NOT EXISTS public.achievements (
  code        TEXT PRIMARY KEY,            -- 'streak_7', 'first_pr', 'volume_100t'
  title_he    TEXT NOT NULL,
  desc_he     TEXT NOT NULL,
  icon        TEXT NOT NULL,               -- lucide name
  tier        TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold')),
  rule        JSONB NOT NULL,              -- machine-readable award rule
  sort_order  INT  NOT NULL DEFAULT 0
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_read_all" ON public.achievements FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL REFERENCES public.achievements(code),
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress    JSONB,                       -- optional partial-progress snapshot
  PRIMARY KEY (user_id, code)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
-- Owner reads own; public profile's badges visible to all (masking via view).
CREATE POLICY "ua_read_own" ON public.user_achievements
  FOR SELECT USING (user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.id = user_id AND p.is_public = true));
-- Insert/update is SERVER-only (award RPC SECURITY DEFINER); block client writes.
-- (no INSERT policy => clients cannot self-award)
```
- **Storage migration** `..._avatars_storage.sql`: bucket `avatars` (private, 2MB, `image/webp,image/jpeg,image/png`), policies בדיוק כמו `progress-photos` (insert/select/delete לפי `foldername[1]=auth.uid()`), אך עם select ציבורי כאשר הבעלים `is_public` (או פשוט signed URLs בלבד — מומלץ לפשטות).
- **Award path:** RPC `award_achievement(_code text)` `SECURITY DEFINER` המאמת את הכלל בשרת ועושה `INSERT ... ON CONFLICT DO NOTHING`, או Edge Function. הלקוח לעולם לא כותב ישירות ל-`user_achievements`.

### קבצים
- create: `supabase/migrations/20260609000000_profile_advanced.sql` (עמודות profiles + view + טבלאות achievements)
- create: `supabase/migrations/20260609000100_avatars_storage.sql` (bucket + policies, על-פי 20260608000300)
- create: `supabase/migrations/20260609000200_achievements_seed.sql` (קטלוג התחלתי + RPC award_achievement)
- create: `src/services/profile/profileService.ts` (read/update profiles row, sync localStorage↔server)
- create: `src/services/profile/avatarService.ts` (compress→upload→signed URL; ממחזר compressImageToWebP/getPhotoUrls)
- create: `src/services/profile/achievementsService.ts` (listCatalog, listEarned, evaluateAndAward)
- create: `src/features/achievements/rules.ts` (טבלת כללי-זכייה — streak/PR/volume/badges)
- create: `src/components/profile/AvatarUpload.tsx` (העלאה + crop בסיסי + fallback ל-ProfileAvatar)
- create: `src/components/profile/HeadlineStats.tsx` (.kinetic-number, dir=ltr)
- create: `src/components/profile/BadgeGrid.tsx` (Lucide icons בלבד)
- create: `src/pages/profile/PublicProfile.tsx` (מסך `/u/:handle`, נשען על public_profiles view)
- create: `src/pages/settings/sections/PrivacySection.tsx` (is_public + privacy toggles)
- modify: `src/pages/settings/types.ts` (הרחבת UserProfile: displayName, bio, dob, units, locale, isPublic, handle, avatarPath)
- modify: `src/pages/settings/sections/ProfileSection.tsx` (שדה bio, AvatarUpload, locale/units; DOB במקום age גולמי)
- modify: `src/pages/onboarding/steps/ProfileStep.tsx` (displayName/DOB; שמירה לשרת בסיום onboarding)
- modify: `src/components/ui/ProfileAvatar.tsx` (קבלת avatarUrl אופציונלי; initials כ-fallback)
- modify: `src/App` router (route ל-`/u/:handle`)

### תלויות וחבילות
- npm: אין תלות חדשה חובה — `compressImageToWebP` ו-Supabase client כבר קיימים. אופציונלי: `react-easy-crop` (~15KB) ל-crop אווטאר ריבועי.
- native (Capacitor, שלב מאוחר): `@capacitor/camera` לבחירת/צילום אווטאר נייטיבי.
- env/secrets: אין חדשים (Supabase URL/anon key קיימים). ה-RPC/Edge Function משתמשים ב-service role הקיים של הפרויקט.
- external services: Supabase Storage (bucket חדש `avatars`), Postgres, RLS — הכל קיים.

### סיכונים
- **דליפת PII דרך פרופיל ציבורי (CRITICAL).** `dob`, משקל, גובה, role לעולם לא יחשפו בפרופיל ציבורי — חובה לאכוף ב-`public_profiles` VIEW + RLS, לא בלקוח. בדיקת `get_advisors` לאחר המיגרציה.
- **זיוף הישגים בצד-לקוח.** אם evaluate בלקוח כותב ישירות — ניתן לזיוף. לכן אין INSERT policy; הזכייה רק דרך RPC/Edge `SECURITY DEFINER` שמאמת את הכלל.
- **handle/slug ייחודי + פוגעני.** `handle` UNIQUE + ולידציה (lowercase, אורך, blocklist) למניעת התחזות/impersonation בקהילה.
- **App Store / legal:** פרופיל ציבורי = UGC. ביקורת Apple (Guideline 1.2) דורשת מנגנון דיווח/חסימה ו-EULA נגד תוכן פוגעני — חייב להיות לפני שליחה לחנות; מתואם עם work-stream הקהילה. DOB/גיל → אם נאסף, יש מדיניות גיל מינימלי (COPPA/הגנת הפרטיות הישראלית). אווטארים שהועלו = אחריות תוכן.
- **תאימות לאחור:** משתמשים קיימים עם פרופיל ב-localStorage בלבד — נדרשת הגירה חד-פעמית (push ל-profiles בכניסה ראשונה לאחר העדכון).
- **זמינות אופליין:** האווטאר תלוי signed URL (TTL שעה); cache ב-IndexedDB/SW כדי שלא ייעלם אופליין.

### מאמץ והערכה
- **L — ~9-12 ימים.** פירוק: מיגרציות+RLS+seed (1.5), profileService+sync+הגירת localStorage (1.5), AvatarUpload+avatarService (1.5), HeadlineStats+נגזרות מנתוני אימון (1.5), מנוע הישגים (rules+RPC+service) (2), PublicProfile+routing+RLS masking (1.5), PrivacySection+onboarding wiring (1), QA נגישות/RTL/בדיקות (1.5). העלאת native camera ו-Edge-function award דוחפים ל-XL אם נכללים עכשיו.

### שלב מומלץ
- **שלב 2.** שלב 1 הוא תשתית-ליבה (Capacitor, תשלומים, יסודות role). הפרופיל המתקדם תלוי בקהילה (פרופיל ציבורי, דיווח/חסימה) ובמודל role השרתי שכבר נחת — לכן אחרי היסודות אך לפני ליטוש קהילה מלא. סטטיסטיקות-כותרת והישגים נשענים על נתוני אימון/check-in קיימים, כך שאפשר להתחיל בחלק ה-private (אווטאר/ביו/units/badges) מוקדם ולשחרר את ה-public-profile יחד עם הקהילה.

### סקיל לשימוש
- **hebrew-content-writer** — לכל טקסט גלוי: שמות/תיאורי badges, מצבי-ריק לפרופיל ציבורי, תוויות פרטיות, הודעות שגיאה.
- **hebrew-rtl-best-practices** — פריסת כרטיס סטטיסטיקות, BadgeGrid, מספרים `dir="ltr"` בתוך RTL, מירור אייקונים.
- **israeli-accessibility-compliance** — אווטאר עם `aria-label`, ניווט מקלדת בפרופיל ציבורי, IS 5568 לבקרות הפרטיות.
- **impeccable / design-taste-frontend** — פס סטטיסטיקות וה-BadgeGrid כך שלא ייראו גנריים; שמירה על Fresh Steel/Obsidian (var(--fs-*), `.kinetic-number`, ללא teal לא-מתויג).
- **hebrew-document-generator** — אופציונלי בלבד, אם נרצה ייצוא "כרטיס פרופיל"/הישגים כ-PDF.

---

## מרכז עזרה ושאלות נפוצות (FAQ) מובנה

### מצב נוכחי
- אין כיום מרכז עזרה או FAQ באפליקציה. נקודת ה"עזרה" היחידה היא `src/pages/settings/sections/GuidanceSection.tsx` — כרטיס "הדרכה" עם כפתור שמפעיל מחדש את ההדרכה הראשונית (`useGuidance().relaunchGuidance` מ-`src/contexts/GuidanceContext`). זו הדרכת onboarding חוזרת, לא בסיס ידע.
- ההדרכה הראשונית מוצגת דרך `WelcomeGuideSheet` (`src/components/guidance/WelcomeGuideSheet.tsx`), שממונת ב-`AppShell` בתוך `GuidanceProvider` (`src/App.tsx`). זה דפוס "first-use sheet" שאפשר לחקות לעזרה הקשרית.
- `src/pages/Settings.tsx` הוא אורקסטרטור דק שמרכיב Section-ים (`AccountSection`, `ProfileSection`, `ThemeSection`, `GuidanceSection`, ...) דרך רכיבי UI משותפים: `SettingsCard`, `SettingsRow`, `SectionLabel` (`src/components/ui/SettingsSectionLabel`), `Button`. בתחתית כבר יש קישור ל-`/accessibility` (`<Link to="/accessibility">הצהרת נגישות</Link>`).
- ניתוב: `src/App.tsx` מגדיר את כל המסכים ב-`AppRoutes`, כל מסך עטוף ב-`PageErrorBoundary pageLabel="..."`, נטען ב-`lazy(() => import(...))`. `src/pages/AccessibilityStatement.tsx` הוא התקדים לעמוד מידע סטטי עצמאי (route `/accessibility`, fallback `*` → `/`).
- מטא-נתונים לכל route מנוהלים בשתי מפות קבועות: `PATH_ACCENT_MAP` (צבע מבטא) ו-`PATH_LABEL_MAP` (כותרת `document.title` + הכרזת ניווט ל-screen reader). כל route חדש חייב רישום בשתיהן.
- אין ספריית i18n (האפליקציה עברית-first, מחרוזות מוטמעות). אין changelog בתוך האפליקציה. עדכוני PWA מטופלים ע"י service worker במצב prompt + toast עדכון (לפי הזיכרון, `pwa-update-architecture`).

### מצב יעד
- מרכז עזרה ייעודי תחת `/help`: חיפוש חופשי, רשימת קטגוריות, ומאמר בודד תחת `/help/:slug`.
- מודל תוכן: כותרת, slug, קטגוריה, גוף Markdown, מילות מפתח לחיפוש, סדר, תפקיד יעד (coach/trainee/all). חיפוש לפי כותרת + מילות מפתח + גוף.
- נקודות כניסה הקשריות: אייקון `HelpCircle` בכותרות מסכים מרכזיים (אימון, תזונה, מאמן) שמוביל ל-`/help?topic=<slug>` או פותח גיליון עזרה הקשרי.
- מסלול יצירת קשר/תמיכה: כרטיס "צריכים עזרה?" עם פעולת `mailto:` ל-support וטופס משוב קצר (נושא + תיאור) ששולח ל-Supabase או ל-mailto fallback.
- "מה חדש" / changelog: עמוד `/help/changelog` או טאב בתוך מרכז העזרה, נטען מ-MD/JSON בבאנדל, מסונכרן עם גרסת ה-PWA.
- מוכנות ללוקליזציה: הפרדת תוכן מקוד (MD/JSON עם שדה `locale`), כך שתרגום עתידי לא ידרוש שינוי רכיבים.
- נגישות מלאה (IS 5568): כותרת `h1` לכל עמוד, רשימות סמנטיות, `aria-label` עברי לכל כפתור-אייקון, מספרים `dir="ltr"`, מצבי loading/empty/error/success לחיפוש.

### גישה טכנית
- **שלב 1 — תוכן סטטי בבאנדל (מומלץ להתחלה):** קבצי Markdown/JSON תחת `src/content/help/` נטענים עם `import.meta.glob` של Vite. ללא קריאות רשת, עובד offline (תואם ל-PWA), אפס עלות תשתית, וקל לעריכה ב-PR. עיבוד Markdown עם `react-markdown` + `remark-gfm` (sanitize מובנה; אסור `dangerouslySetInnerHTML`). חיפוש לקוח עם `fuse.js` (fuzzy, קל, ~5KB) על אינדקס שנבנה מה-frontmatter.
- **שלב 2 — שדרוג ל-Supabase (אופציונלי):** טבלאות `faq_categories` + `faq_articles` עם RLS לקריאה ציבורית, כך שאפשר לעדכן תוכן ללא deploy ולנהל אנליטיקות "מאמר עזר/לא עזר". שכבת `helpRepository` עם אותו ממשק (`findAll`, `findBySlug`, `search`) מאפשרת החלפת מקור הנתונים מ-static ל-Supabase ללא שינוי ב-UI (Repository Pattern לפי `.claude/rules`). מטמון IndexedDB (`idb`, כבר מותקן) לקריאה offline.
- **המלצה:** להתחיל סטטי (שלב 1) ולהשאיר את `helpRepository` כנקודת החלפה. תוכן עזרה משתנה לאט ועובד מצוין offline; Supabase מוצדק רק כשרוצים עריכה ללא deploy או אנליטיקת usefulness.
- **NATIVE/Capacitor:** מרכז עזרה הוא WebView טהור — אין יכולת נייטיב נדרשת. הערות: (1) `mailto:` ייפתח באפליקציית מייל נייטיב — לוודא fallback אם אין client; (2) קישורים חיצוניים (מדיניות/תנאים) חייבים להיפתח ב-in-app browser (`@capacitor/browser`) ולא לנווט מחוץ ל-WebView; (3) שדה changelog יכול לקרוא את גרסת האפליקציה הנייטיב דרך `@capacitor/app` (`App.getInfo()`) במקום גרסת PWA.

### מודל נתונים
שלב 1 (סטטי) — אין סכימת DB. Frontmatter לכל מאמר (`src/content/help/*.md`):
```
---
slug: "how-to-log-workout"
title: "איך לתעד אימון"
category: "workouts"
role: "all"            # all | coach | trainee
order: 10
keywords: ["אימון", "תיעוד", "סטים"]
updatedAt: "2026-06-08"
---
<גוף Markdown בעברית>
```
שלב 2 (Supabase, migration עתידי `supabase/migrations/2026XXXX_help_center.sql`):
```sql
create table faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  icon text,                       -- שם אייקון Lucide
  sort int not null default 0,
  created_at timestamptz default now()
);

create table faq_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category_id uuid references faq_categories(id) on delete set null,
  title text not null,
  body_md text not null,
  keywords text[] default '{}',
  role text not null default 'all' check (role in ('all','coach','trainee')),
  locale text not null default 'he',
  sort int not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz default now()
);
create index faq_articles_category_idx on faq_articles(category_id);
create index faq_articles_search_idx on faq_articles
  using gin (to_tsvector('simple', title || ' ' || body_md));

-- קריאה ציבורית (תוכן עזרה אינו רגיש); כתיבה רק לצוות/שירות.
alter table faq_categories enable row level security;
alter table faq_articles  enable row level security;
create policy faq_categories_read on faq_categories for select using (true);
create policy faq_articles_read   on faq_articles  for select using (is_published);

-- אופציונלי: משוב usefulness
create table faq_feedback (
  id uuid primary key default gen_random_uuid(),
  article_slug text not null,
  user_id uuid references auth.users(id) on delete set null,
  helpful boolean not null,
  comment text,
  created_at timestamptz default now()
);
alter table faq_feedback enable row level security;
create policy faq_feedback_insert on faq_feedback for insert with check (true);
```

### קבצים
- create: `src/pages/HelpCenter.tsx` — עמוד `/help`: חיפוש + קטגוריות + רשימה (4 מצבי UI).
- create: `src/pages/HelpArticle.tsx` — עמוד `/help/:slug` עם render של Markdown + ניווט קטגוריה + משוב usefulness.
- create: `src/pages/HelpChangelog.tsx` — "מה חדש" תחת `/help/changelog`.
- create: `src/content/help/` — קבצי `.md` למאמרים + `changelog.md`.
- create: `src/services/help/helpRepository.ts` — ממשק Repository (`findAll`/`findBySlug`/`searchArticles`/`listCategories`); מימוש static דרך `import.meta.glob`.
- create: `src/services/help/helpSearch.ts` — אינדקס + `fuse.js`.
- create: `src/components/help/HelpSearchBar.tsx`, `src/components/help/HelpArticleCard.tsx`, `src/components/help/HelpCategoryList.tsx`, `src/components/help/ContactSupportCard.tsx`, `src/components/help/HelpEntryButton.tsx` (כפתור-אייקון הקשרי).
- create: `src/pages/settings/sections/HelpSection.tsx` — Section חדש לפי דפוס `GuidanceSection.tsx` (SectionLabel "עזרה ותמיכה" + SettingsRow אייקון `HelpCircle` + `Link to="/help"`).
- modify: `src/pages/Settings.tsx` — ייבוא ורינדור של `HelpSection` (ליד `GuidanceSection`, או בתוך "פרטיות ונתונים"/כסקציה משלו).
- modify: `src/App.tsx` — הוספת `lazy` imports ל-`HelpCenter`/`HelpArticle`/`HelpChangelog`; routes חדשים עטופים ב-`PageErrorBoundary`; רישום ב-`PATH_LABEL_MAP` (`/^\/help/` → "מרכז עזרה") וב-`PATH_ACCENT_MAP` (accent מתאים, למשל `'settings'`).
- modify (הקשרי, אופציונלי): כותרות מסכים מרכזיים (Nutrition/WorkoutDetail/MyCoach) — שתילת `<HelpEntryButton topic="..." />`.
- modify (onboarding, קל): `CompleteStep`/`src/pages/OnboardingFlow.tsx` — קישור "מרכז עזרה" במסך הסיום.

### תלויות וחבילות
- npm: `react-markdown` + `remark-gfm` (עיבוד Markdown בטוח), `fuse.js` (חיפוש fuzzy לקוח). שקילת `gray-matter`/`front-matter` לפענוח frontmatter (או parsing ידני קל כדי להימנע מ-polyfill ל-Buffer ב-browser — `front-matter` עדיף ל-bundle).
- קיים ולא דורש התקנה: `react-router-dom`, `lucide-react`, `idb`, Supabase client, Sentry, framer-motion.
- native (שלב Capacitor): `@capacitor/browser` (קישורים חיצוניים in-app), `@capacitor/app` (גרסה ל-changelog). לא חובה לשלב 1.
- env/secrets: אין חדשים לשלב 1. שלב 2 משתמש ב-Supabase keys הקיימים. כתובת support להגדיר כקבוע (`SUPPORT_EMAIL`), עדיף `VITE_SUPPORT_EMAIL`.
- שירותים חיצוניים: אין. (אם רוצים טופס תמיכה מלא בלי Supabase — שקילת שירות טפסים, אך mailto מספיק לשלב 1.)

### סיכונים
- App Store / legal: יש להפנות (לא להטמיע inline ב-IAP) למדיניות פרטיות ותנאי שימוש ממרכז העזרה — Apple דורש קישורים נגישים. קישורים חיצוניים ב-Capacitor חייבים `@capacitor/browser` (in-app), אחרת ניווט מחוץ ל-WebView עלול להיתפס בבדיקה. אסור שמרכז העזרה יקשר למסלולי תשלום חיצוניים לעקיפת IAP (דחייה ודאית ב-App Store).
- בטיחות: render של Markdown אסור דרך `dangerouslySetInnerHTML` — `react-markdown` מסנן כברירת מחדל; לוודא שלא מפעילים `rehype-raw` על תוכן לא מהימן (שלב Supabase). תוכן ב-`faq_articles` חייב מקור מהימן (RLS כתיבה לצוות בלבד) כדי למנוע XSS מאוחסן.
- איכות עברית: כל מחרוזת גלויה חייבת לעבור ביקורת hebrew-content-writer (הסכמה מגדרית, ניסוח dugri-פונקציונלי). תוכן ה-FAQ הוא הרבה טקסט עברי — סיכון עיקרי לתרגום-נשמע-AI.
- changelog drift: גרסת ה-changelog צריכה מקור-אמת אחד (גרסת build) כדי לא להציג "חדש" לא מסונכרן.
- offline (PWA): תוכן static נכלל ב-precache אוטומטית; מעבר ל-Supabase דורש אסטרטגיית cache (idb) אחרת העזרה לא תיטען offline — רגרסיית UX.

### מאמץ והערכה
- כולל: **M** (~4 ימים).
- breakdown: scaffolding (routes ב-`App.tsx`, `HelpSection` ב-Settings, repository static) ~0.5י׳; דפי `HelpCenter`/`HelpArticle` + חיפוש (`fuse.js`) + 4 מצבי UI ~1.5י׳; כתיבת תוכן FAQ ראשוני (8–12 מאמרים) + changelog בעברית (hebrew-content-writer) ~1י׳; נקודות כניסה הקשריות + `ContactSupportCard` (mailto/feedback) ~0.5י׳; a11y + RTL pre-flight + בדיקות ~0.5י׳. שדרוג Supabase (שלב 2) הוא +**M** נוסף (~2י׳).

### שלב מומלץ
- **שלב 2.** מרכז עזרה אינו חוסם השקה אך מגדיל משמעותית אמון-משתמש והפחתת פניות תמיכה לפני גידול משתמשים, ותלוי בכך שמסכי הליבה (אימון/תזונה/מאמן) כבר יציבים כדי שתוכן ה-FAQ ישקף UI אמיתי. מסלול נקי כי התשתית (routes, Section pattern, ErrorBoundary, AccessibilityStatement כתקדים) כבר קיימת.

### סקיל לשימוש
- **hebrew-content-writer** — כל תוכן ה-FAQ, מאמרי העזרה, changelog ומחרוזות UX (עברית פונקציונלית, הסכמה מגדרית).
- **hebrew-rtl-best-practices** — פריסת RTL של חיפוש/רשימות/מאמר, מספרים `dir="ltr"`, mirroring אייקונים.
- **israeli-accessibility-compliance** — תאימות IS 5568: כותרות, רשימות סמנטיות, ARIA לחיפוש, screen readers עבריים.
- **impeccable / design-taste-frontend** — pass עיצובי+a11y, שמירה על Fresh Steel/Obsidian ו-`var(--fs-*)`, הימנעות מ-AI-slop.
- **hebrew-document-generator** — רק אם בעתיד רוצים לייצא מאמרי עזרה כ-PDF.

---

## עמידה בתקני פרטיות (GDPR / CCPA) + בקשות נושא מידע (DSAR)

### מצב נוכחי
- ייצוא קיים אך **חלקי ולא תקני-DSAR**: `src/pages/settings/sections/ExportSection.tsx` קורא ל-`exportWorkoutHistory()` ו-`exportFullBackup()` מ-`src/services/settingsService.ts` ול-`generateWeeklyReport()`/`shareReport()` מ-`src/services/exportService.ts`. הייצוא מבוסס-לקוח בלבד — מבוסס על מה שיש ב-idb/state, לא על שאיבה מאומתת מכל טבלאות השרת. אין מניפסט "אלו קטגוריות נתונים", אין lawful basis, אין חותמת זמן/חתימה.
- מחיקה קיימת אך **לא מבצעת cascade בשרת**: `src/pages/settings/sections/DangerZoneSection.tsx` חושף רק prop `onDeleteAll` שמופעל מ-`Settings.tsx`; זו מחיקה מקומית/לקוח. אין edge function שמוחקת חוצת-טבלאות + Storage + מחיקת חשבון `auth.users`.
- `src/pages/settings/sections/DataAboutSection.tsx` הצטמצם ל-footer בלבד (`SPARKOS FITNESS · v1.0.0`) — אין כאן מדיניות פרטיות, רשימת sub-processors או נקודת כניסה ל-DSAR.
- מודל מחיקה רך קיים חלקית: `supabase/migrations/20260531140000_tombstones.sql` הוסיף `deleted_at TIMESTAMPTZ` ל-8 טבלאות בלבד: `personal_exercises, personal_records, workout_sessions, workout_templates, body_weight, body_measurements, recovery_logs, nutrition_logs`. טבלאות נוספות מהמיגרציות (`profiles`, `water_logs`, `coach_platform`, `group_chat`, `program_templates`, `workout_schedule`, `coach_check_ins`, `coach_audit_log`, `progress_photos` storage) **לא נכללות ב-tombstones ולא ב-cascade**.
- אין consent/cookie-banner, אין consent-versioning, אין דגל "Do Not Sell/Share", ואין טבלת ROPA/DSAR-requests. אין מדיניות retention. Sentry (`@sentry/react`) פעיל ושולח PII פוטנציאלי — לא ממופה כ-sub-processor.

### מצב יעד
- **Data inventory + ROPA**: מסמך מתוחזק (טבלה ב-DB + עמוד) הממפה כל קטגוריית מידע → טבלאות/עמודות → מטרת עיבוד → lawful basis → retention → sub-processor.
- **DSAR מלא** דרך ה-UI ו/או אימייל: Access/Export (JSON קריא-מכונה, מאומת-שרת, כל הטבלאות+Storage URLs), Rectification (קיים חלקית ב-Profile), **Erasure מלא** עם cascade על כל הטבלאות + Storage + `auth.users` + יצירת tombstones + ניקוי idb מקומי, וכן data portability.
- **Retention**: מדיניות אוטומטית (cron) שמוחקת קשיח tombstones ישנים ולוגים מעבר לחלון השמירה.
- **CCPA**: דגל "Do Not Sell/Share" + כיבוד Global Privacy Control (header `Sec-GPC`), עמוד "Your Privacy Choices".
- **Sub-processor list + DPAs**: עמוד פומבי (Supabase, Sentry, ספק תשלומים עתידי, Google) + ניהול DPA.
- **Privacy-by-design**: כל זרימת DSAR עוברת אימות זהות, נרשמת ב-audit, ומקושרת ל-consent-versioning + age-verification (קטין → נדרש אישור אפוטרופוס לפני עיבוד).

### גישה טכנית
- **WEB (PWA)**: לב המערכת ב-Supabase Edge Functions (Deno) הקוראות עם `service_role` כדי לאחד נתונים חוצי-טבלאות שאליהם RLS של המשתמש לבדו לא מגיע (למשל הודעות קבוצה, audit). שלוש פונקציות: `dsar-export`, `dsar-erase`, `dsar-rectify` (rectify יכול להישאר client-side ל-profile, edge רק למקרי cascade). ה-UI מרחיב את `ExportSection` (כפתור "ייצוא DSAR מלא") ואת `DangerZoneSection` (מחיקה אמיתית בשרת במקום `onDeleteAll` מקומי). דגל GPC נקרא ב-`vite`/edge מ-header `Sec-GPC:1` → קובע `do_not_sell=true` אוטומטית.
- **NATIVE/Capacitor**: כשתתווסף עטיפת Capacitor — Apple/Google **דורשים** "Account Deletion" נגיש מתוך האפליקציה (App Store Guideline 5.1.1(v)); המחיקה האמיתית כאן מספקת זאת. הייצוא נשמר דרך `@capacitor/filesystem` + `@capacitor/share` במקום Web Share. App Tracking Transparency (`@capacitor-community/app-tracking-transparency`) חייב prompt לפני כל מזהה מעקב; Sentry יוגדר ל-opt-in בנייטיב. רשימת sub-processors ומדיניות פרטיות חייבות להופיע ב-App Store/Play privacy nutrition labels — מקור אמת אחד = טבלת ה-ROPA.
- **אימות זהות ל-DSAR**: המשתמש מחובר (`supabaseAuth`) → ה-edge מאמת JWT; למחיקה מוסיפים re-auth (אישור סיסמה/OTP) דרך `supabase.auth.reauthenticate()` כדי למנוע מחיקה ב-session גנוב.

### מודל נתונים
מיגרציה חדשה `supabase/migrations/20260609000000_privacy_dsar.sql`:
```sql
-- consent + privacy choices, אחד-לאחד עם המשתמש
create table privacy_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,          -- consent-versioning
  consented_at timestamptz not null default now(),
  marketing_opt_in boolean not null default false,
  analytics_opt_in boolean not null default false, -- שולט ב-Sentry/analytics
  do_not_sell boolean not null default false,      -- CCPA + GPC
  gpc_detected boolean not null default false,
  age_verified boolean not null default false,
  guardian_consent boolean not null default false  -- קטינים
);
-- בקשות DSAR ל-audit ול-SLA (30 יום GDPR / 45 CCPA)
create table dsar_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('access','export','rectify','erase','portability')),
  status text not null default 'received'
    check (status in ('received','verifying','processing','completed','rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  export_path text,                      -- מצביע ל-Storage (חתום, TTL קצר)
  notes text
);
-- ROPA: מקור אמת לקטגוריות, מטרות, בסיס חוקי, retention
create table ropa_entries (
  id uuid primary key default gen_random_uuid(),
  data_category text not null,           -- 'workout','body_metrics','nutrition','coach_msgs'...
  source_tables text[] not null,
  purpose text not null,
  lawful_basis text not null,            -- 'consent','contract','legitimate_interest'
  retention_days int,                    -- null = עד מחיקת חשבון
  sub_processors text[] not null default '{}'
);
alter table privacy_consents enable row level security;
alter table dsar_requests   enable row level security;
create policy "own_consents" on privacy_consents
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_dsar" on dsar_requests
  for select using ((select auth.uid()) = user_id);  -- כתיבה רק דרך edge service_role
-- ROPA נקרא ע"י כולם, נכתב ע"י admin בלבד
alter table ropa_entries enable row level security;
create policy "ropa_read" on ropa_entries for select using (true);
```
מיגרציה שנייה `20260609000100_extend_tombstones.sql`: הוספת `deleted_at` לטבלאות שחסרות אותן ב-`20260531140000` (`water_logs`, `coach_check_ins`, וכל טבלה עם `user_id` שאינה כבר ב-tombstones) כדי שה-cascade ימחק/יסמן את כולן עקבית. ה-erase יבצע hard-delete על שורות המשתמש + מחיקת אובייקטים מ-Storage (`progress-photos`) + `auth.admin.deleteUser` + כתיבת שורה ל-`dsar_requests`.

### קבצים
- create: `supabase/migrations/20260609000000_privacy_dsar.sql` — טבלאות consent/dsar/ropa + RLS
- create: `supabase/migrations/20260609000100_extend_tombstones.sql` — השלמת `deleted_at` לכל טבלאות ה-user
- create: `supabase/functions/dsar-export/index.ts` — איחוד כל הטבלאות+Storage → JSON חתום ל-Storage
- create: `supabase/functions/dsar-erase/index.ts` — cascade delete + Storage + auth.admin.deleteUser + tombstones
- create: `supabase/functions/_shared/dsarTables.ts` — רשימת SSOT של טבלאות+bucket-ים (משותף ל-export/erase)
- create: `src/services/privacyService.ts` — קליינט ל-3 ה-edge functions + ניקוי idb מקומי אחרי erase
- create: `src/pages/settings/sections/PrivacyChoicesSection.tsx` — Do Not Sell/Share, analytics opt-in, מדיניות
- create: `src/pages/PrivacyPolicy.tsx` + `src/pages/SubProcessors.tsx` — מדיניות פרטיות + רשימת sub-processors (נשען על `ropa_entries`)
- create: `src/components/consent/CookieConsent.tsx` + `src/contexts/ConsentContext.tsx` — banner + consent-versioning + GPC detection (`navigator.globalPrivacyControl`)
- modify: `src/pages/settings/sections/ExportSection.tsx` — הוספת "ייצוא DSAR מלא (JSON)" הקורא ל-`privacyService.requestExport()`
- modify: `src/pages/settings/sections/DangerZoneSection.tsx` — `onDeleteAll` יקרא ל-`privacyService.requestErase()` (re-auth) במקום מחיקה מקומית בלבד
- modify: `src/pages/settings/sections/DataAboutSection.tsx` — קישורים למדיניות פרטיות + sub-processors
- modify: `src/services/settingsService.ts` — ניקוי idb מלא לקריאה מ-erase
- modify: `src/main.tsx`/Sentry init — `analytics_opt_in` שולט ב-`Sentry.init` (privacy-by-design)
- modify: `supabase/migrations/*` נקרא בלבד לאימות שמות טבלאות לפני כתיבת `_shared/dsarTables.ts`

### תלויות וחבילות
- npm (web): `zod` (ולידציית payload ב-edge ובקליינט; ככל הנראה קיים). אין צורך בספרייה כבדה חדשה.
- native (עתידי, Capacitor): `@capacitor/filesystem`, `@capacitor/share`, `@capacitor-community/app-tracking-transparency`.
- env/secrets (Edge): `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` (כבר קיימים בסביבת Functions). הגדרת bucket `dsar-exports` פרטי עם TTL קצר ל-signed URLs.
- שירותים חיצוניים / sub-processors לתיעוד ול-DPA: **Supabase** (DB/Auth/Storage/Functions), **Sentry** (errors — דורש DPA + opt-in), **ספק תשלומים** עתידי (Stripe/Paddle/RevenueCat), **Google/Apple** (push, store billing, Firebase אם ייכנס).
- אין שינוי schema ל-`auth` — שימוש ב-Admin API הקיים.

### סיכונים
- **App Store / legal**: ללא "מחיקת חשבון" בתוך האפליקציה — דחייה ודאית ב-Capacitor (Guideline 5.1.1(v)). מדיניות פרטיות חובה לפרסם לפני submission; privacy nutrition labels חייבים להתאים ל-ROPA בפועל אחרת זו עבירת מצג.
- **משפטי**: SLA — GDPR 30 יום, CCPA 45 יום; אי-עמידה = קנסות. lawful basis שגוי לכל קטגוריה חושף לסיכון. **דרושה סקירה משפטית** של נוסח המדיניות/DPAs — אני לא יועץ משפטי; זה אינו תחליף.
- **טכני — מחיקה הרסנית**: `auth.admin.deleteUser` + hard-delete בלתי-הפיכים; חובה re-auth + confirm-dialog כפול. סכנת cascade חלקי אם נוספת טבלה חדשה ולא עודכן `_shared/dsarTables.ts` → SSOT אחד + בדיקת CI שמשווה לרשימת הטבלאות בפועל.
- **דליפת מידע**: signed export URL חייב TTL קצר ובאקט פרטי; export מאחד נתוני מאמן/מתאמן — לוודא שלא מדליפים PII של צד ג' (הודעות קבוצה של אחרים) — לייצא רק את תרומת המשתמש.
- **Sentry/PII**: כל עוד Sentry שולח לפני opt-in — הפרת analytics consent. לתקן ב-init.

### מאמץ והערכה
**L — כ-9 ימים.** פירוק: מיגרציות + RLS (1), `dsar-export` edge + SSOT טבלאות (1.5), `dsar-erase` edge עם cascade+Storage+auth+re-auth (2), `privacyService` + ניקוי idb (1), ConsentContext + CookieConsent + GPC (1.5), PrivacyChoices/PrivacyPolicy/SubProcessors UI + הרחבת Export/DangerZone (1.5), בדיקות (unit ל-SSOT/erase, E2E ל-export+delete) ו-ROPA seed (0.5). לא כולל זמן סקירה משפטית חיצונית.

### שלב מומלץ
**שלב 1.** מחיקת חשבון אמיתית + ייצוא DSAR + מדיניות פרטיות הם **חוסמי-שחרור** גם ל-App Store/Play (Capacitor) וגם משפטית לקהל EU/CA; חייבים להיות מוכנים לפני כל תשלום או הפצה ציבורית. תלות הדדית עם cookie-consent, consent-versioning ו-age-verification — לתכנן יחד.

### סקיל לשימוש
- **hebrew-content-writer** — לכל נוסח משפטי/UX בעברית: מדיניות פרטיות, banner הסכמה, מסכי "מחיקת חשבון" ו-"Your Privacy Choices", הודעות שגיאה.
- **israeli-accessibility-compliance** — banner ההסכמה ומסכי ה-DSAR חייבים להיות נגישים (IS 5568, focus-trap, ARIA ב-RTL).
- **hebrew-rtl-best-practices** — פריסת ה-banner והעמודים המשפטיים החדשים ב-RTL נכון.
- **hebrew-document-generator** — אם נדרש לייצא את ה-DSAR גם כ-PDF קריא-אדם (בנוסף ל-JSON).
- **impeccable / design-taste-frontend** — מעבר עיצובי/a11y על ה-banner והעמודים החדשים בהתאם ל-Fresh Steel/Obsidian.

---

## אישור תנאי שימוש ומדיניות פרטיות מבוסס-גרסאות

### מצב נוכחי
- אין שום מנגנון consent באפליקציה. ה-onboarding נשמר ב-localStorage בלבד: `App.tsx::AppRouter` קורא `localStorage.getItem('onboarding_completed') === 'true'` ושומר `onboarding_data` / `user_profile` ב-`saveOnboardingData()` / `savePartialOnboardingData()`. אין רשומת הסכמה, אין חתימה, אין audit trail.
- `OnboardingData` (`src/pages/onboarding/types.ts`) מכיל `age`, `role?`, אך **אין** שדות `acceptedTermsVersion` / `acceptedPrivacyVersion`. אין צעד consent ב-`STEPS` (welcome → role → profile → goals → experience → preferences → complete).
- אין שער חוסם ב-shell. ב-`App.tsx` הזרימה היא: `status === 'loading' → unauthenticated (Login) → !onboardingDone (OnboardingFlow) → AppShell`. שום נקודה לא בודקת גרסת מסמך משפטי.
- ה-DB משתמש בתבנית מוכרת: `profiles.role` (migration `20260608000000_profiles_role.sql`) עם `CHECK`, trigger guard, ו-RPC `SECURITY DEFINER ... SET search_path=public` עם `REVOKE ... GRANT EXECUTE TO authenticated`. נאמץ בדיוק את הקונבנציה הזו.
- `profiles.role` הוא ה-SSOT ל-coach/trainee; `age` קיים ב-onboarding אך לא נשמר server-side כשדה ייעודי לאימות גיל (קושר ל-work-stream של age-verification).
- אין מסכי תוכן משפטי. קיים רק `src/pages/AccessibilityStatement.tsx` (route `/accessibility`) — תבנית טובה לעמודי תוכן סטטיים.

### מצב יעד
- שתי טבלאות חדשות: `legal_documents` (קטלוג גרסאות לכל סוג מסמך) ו-`user_consents` (audit trail בלתי-משתנה של כל אישור).
- RPC `current_legal_versions()` שמחזיר את הגרסה האפקטיבית הנוכחית לכל סוג מסמך + מה המשתמש כבר אישר; ו-RPC `record_consent(doc_type, version, locale)` שכותב רשומת הסכמה אטומית.
- שער חוסם (`ConsentGate`) שרץ פעם אחת בכל פתיחת אפליקציה אחרי auth: אם `accepted_version < current_effective_version` עבור terms או privacy → מסך חוסם שלא ניתן לדלג עליו עד אישור מחדש.
- שילוב ב-onboarding: צעד `consent` חדש לפני `complete`, חובה (ללא skip), עם תיבות סימון נפרדות ל-terms ו-privacy + קישורים לעמודים מלאים.
- משתמשים קיימים: בפתיחה ראשונה אחרי הדפלוי הם אין-להם-consent → השער מכריח אישור פעם אחת (לא חוסם onboarding שכבר הושלם).
- קטינים: אם `age < 18` (או חסר) — נוסח consent מותאם + דרישת אישור אפוטרופוס (ties ל-age-verification work-stream); רשומת ה-consent מסמנת `is_minor` ו-`guardian_acknowledged`.
- מאמן מול מתאמן: שני המסמכים חלים על שני התפקידים; למאמן מתווסף doc_type שלישי `coach_terms` (DPA/אחריות מקצועית) שנדרש רק כש-`profiles.role='coach'`.

### גישה טכנית
- **משותף (WEB + NATIVE)**: כל הלוגיקה מבוססת Supabase RPC + RLS, כך שזהה ב-PWA וב-Capacitor. אין צורך ב-SDK נייטיב לפיצ'ר הזה.
- **בדיקת גרסה**: ב-mount של ה-shell קוראים `current_legal_versions()` (RPC יחיד, network-light). התוצאה נשמרת ב-cache קצר (sessionStorage) כדי לא לחסום כל ניווט — רק פתיחת אפליקציה. fallback offline: אם ה-RPC נכשל וקיים consent מקומי תקף — לא חוסמים (fail-open ל-UX), אך מסמנים stale ובודקים שוב כשחוזר חיבור. החלטה חוסמת אמיתית מתבצעת רק כש-RPC הצליח.
- **אכיפה אמיתית**: RLS על טבלאות רגישות (למשל כתיבת workouts/nutrition) יכולה לדרוש consent תקף דרך helper `public.has_current_consent(uid)` — אך זה אופציונלי לשלב 2; בשלב 1 השער הוא client-side gate (UX) + audit trail server-side. חשוב לתעד שזה gate ולא authorization boundary (בדיוק כמו `CoachGuard`).
- **NATIVE/Capacitor**: ב-App Store/Play חובה שקישורי ה-terms/privacy יהיו נגישים גם מחוץ ל-paywall ומתוך עמוד החנות. נחשוף route ציבורי `/legal/terms` ו-`/legal/privacy` (כמו `/accessibility`) כדי שניתן להפנות אליהם מ-App Store Connect / Play Console. ב-Capacitor קישורים חיצוניים נפתחים דרך `@capacitor/browser` (in-app browser) ולא `window.open`.
- **תוכן**: גרסה ראשונה — תוכן markdown מקומי שנטען ל-`content_or_url`, עם `hash` (sha256) לחתימת התוכן שאושר. גרסאות עתידיות יכולות להצביע ל-URL חיצוני (CDN) עם אותו hash.

### מודל נתונים
```sql
-- migration: 20260609000000_legal_consent.sql
CREATE TABLE public.legal_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type      text NOT NULL CHECK (doc_type IN ('terms','privacy','coach_terms')),
  version       text NOT NULL,                 -- semantic, e.g. '2026-06-09' or '1.2'
  locale        text NOT NULL DEFAULT 'he',
  effective_date timestamptz NOT NULL,
  content_url   text,                          -- nullable: inline content lives in repo
  content_hash  text NOT NULL,                 -- sha256 of the exact accepted text
  is_published  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version, locale)
);

CREATE TABLE public.user_consents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('terms','privacy','coach_terms')),
  version       text NOT NULL,
  locale        text NOT NULL DEFAULT 'he',
  content_hash  text NOT NULL,                 -- snapshot of what was shown
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  is_minor      boolean NOT NULL DEFAULT false,
  guardian_acknowledged boolean NOT NULL DEFAULT false,
  user_agent    text,                          -- audit context
  -- append-only audit trail: never UPDATE/DELETE a consent row
  UNIQUE (user_id, doc_type, version)
);
CREATE INDEX ON public.user_consents (user_id, doc_type, accepted_at DESC);

-- RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_read ON public.legal_documents
  FOR SELECT TO authenticated, anon USING (is_published = true);
-- no INSERT/UPDATE for clients; managed via migrations / service role only

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_owner_read ON public.user_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- writes ONLY through record_consent() RPC (no direct INSERT policy)

-- RPC: current versions + what the caller already accepted
CREATE OR REPLACE FUNCTION public.current_legal_versions(_locale text DEFAULT 'he')
RETURNS TABLE (doc_type text, current_version text, content_hash text,
               effective_date timestamptz, accepted_version text, needs_consent boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH current AS (
    SELECT DISTINCT ON (d.doc_type) d.doc_type, d.version, d.content_hash, d.effective_date
    FROM public.legal_documents d
    WHERE d.is_published AND d.locale = _locale AND d.effective_date <= now()
    ORDER BY d.doc_type, d.effective_date DESC
  )
  SELECT c.doc_type, c.version, c.content_hash, c.effective_date,
         uc.version AS accepted_version,
         (uc.version IS NULL OR uc.version <> c.version) AS needs_consent
  FROM current c
  LEFT JOIN public.user_consents uc
    ON uc.user_id = auth.uid() AND uc.doc_type = c.doc_type AND uc.version = c.version;
$$;

-- RPC: append-only consent write (idempotent on (user,doc,version))
CREATE OR REPLACE FUNCTION public.record_consent(
  _doc_type text, _version text, _locale text DEFAULT 'he',
  _is_minor boolean DEFAULT false, _guardian_ack boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); h text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='insufficient_privilege'; END IF;
  SELECT content_hash INTO h FROM public.legal_documents
    WHERE doc_type=_doc_type AND version=_version AND locale=_locale AND is_published;
  IF h IS NULL THEN RAISE EXCEPTION 'unknown_legal_version' USING ERRCODE='check_violation'; END IF;
  INSERT INTO public.user_consents(user_id,doc_type,version,locale,content_hash,is_minor,guardian_acknowledged)
  VALUES (uid,_doc_type,_version,_locale,h,_is_minor,_guardian_ack)
  ON CONFLICT (user_id,doc_type,version) DO NOTHING;  -- audit immutable
END; $$;
REVOKE ALL ON FUNCTION public.record_consent(text,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_consent(text,text,text,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_legal_versions(text) TO authenticated, anon;
```
- שיקול: guests (local-only, ללא `auth.uid()`) — `current_legal_versions` יחזיר `accepted_version=NULL`; ה-consent שלהם נשמר ב-localStorage ומסונכרן ל-DB אחרי sign-in (כמו `pending_coach_intent` ב-`App.tsx`).

### קבצים
- create: `supabase/migrations/20260609000000_legal_consent.sql` — שתי הטבלאות, RLS, שני ה-RPCs.
- create: `supabase/migrations/20260609000100_seed_legal_v1.sql` — seed גרסה ראשונה של terms/privacy/coach_terms (`is_published=true`, `effective_date=now()`, `content_hash`).
- create: `src/services/consent/consentService.ts` — wrappers ל-`current_legal_versions` / `record_consent`, cache ב-sessionStorage, מיזוג guest-consent מ-localStorage אחרי sign-in.
- create: `src/services/consent/types.ts` — `LegalDocType`, `ConsentStatus`, `CurrentVersionsResult`.
- create: `src/contexts/ConsentContext.tsx` — טוען סטטוס ב-mount, חושף `needsConsent`, `accept(docTypes)`, `loading`.
- create: `src/components/consent/ConsentGate.tsx` — שער חוסם (re-acceptance) למשתמשים קיימים; משתמש בטוקנים `var(--fs-*)`, מסך מלא `min-h-screen min-h-[100dvh]`.
- create: `src/components/consent/ConsentCheckboxes.tsx` — תיבות סימון terms/privacy + נוסח קטינים, לשימוש חוזר ב-onboarding וב-gate.
- create: `src/pages/onboarding/steps/ConsentStep.tsx` — צעד onboarding חדש (חובה, ללא skip).
- create: `src/pages/legal/TermsPage.tsx`, `src/pages/legal/PrivacyPage.tsx` — עמודי תוכן ציבוריים (תבנית `AccessibilityStatement.tsx`).
- create: `src/content/legal/{terms,privacy,coach_terms}.he.md` — תוכן המסמכים (SSOT לתוכן + מקור ל-hash).
- modify: `src/pages/onboarding/types.ts` — להוסיף `consentTerms?: boolean`, `consentPrivacy?: boolean` ל-`OnboardingData`/`DEFAULT_ONBOARDING`, ולהוסיף `{ id:'consent', ... }` ל-`STEPS` (לפני `complete`); `stepsForRole` להשאיר consent לשני התפקידים.
- modify: `src/pages/OnboardingFlow.tsx` ו-`useOnboardingWizard.ts` — לרנדר `ConsentStep`, לחסום `next` עד שתי התיבות מסומנות, לקרוא `record_consent` ב-complete.
- modify: `src/App.tsx` — לעטוף `AppShell` ב-`ConsentProvider` ולהוסיף `ConsentGate` חוסם בין auth ל-route tree (לפני `<AppShell />`); להוסיף routes ציבוריים `/legal/terms`, `/legal/privacy`, ולהוסיפם ל-`PATH_LABEL_MAP`.
- modify: `src/pages/settings/sections/DataAboutSection.tsx` (או `AccountSection`) — קישורים ל-terms/privacy + הצגת הגרסה שאושרה (audit visibility למשתמש).

### תלויות וחבילות
- npm: אין חדש חובה. `marked` או `react-markdown` לרינדור ה-markdown המשפטי (אם לא מותקן) — או רינדור סטטי כמו `AccessibilityStatement.tsx` ללא תלות.
- native: `@capacitor/browser` (לפתיחת קישורים משפטיים ב-in-app browser בבילד הנייטיב) — קושר ל-Capacitor work-stream, לא חוסם ל-WEB.
- env/secrets: אין חדש. שימוש ב-Supabase client הקיים.
- external services: Supabase (Postgres + RLS + RPC) בלבד. ה-`content_hash` מחושב בזמן build/seed (sha256) — אפשר ב-Node script או ידנית בעת כתיבת ה-seed migration.

### סיכונים
- **App Store / Play (CRITICAL)**: חנויות דורשות קישורי terms+privacy זמינים גם מחוץ ל-login, וגם בעמוד החנות. אם השער חוסם הכל לפני שניתן לקרוא את המסמך — דחייה. חובה route ציבורי לקריאת המסמך מתוך השער עצמו.
- **משפטי (HIGH)**: התוכן עצמו (terms/privacy) חייב אישור משפטי אנושי — לא לנסח אוטומטית. הפיצ'ר מספק את התשתית; הנוסח אחריות הבעלים. consent לקטינים בישראל מצריך אישור אפוטרופוס — ייעוץ משפטי לגבי הניסוח והאכיפה.
- **fail-open vs fail-closed (HIGH)**: אם בודקים גרסה ב-RPC וחוסמים אגרסיבי — משתמש offline ייתקע מחוץ לאפליקציה. נבחר fail-open עם re-check, אך זה אומר שמשתמש יכול לעבוד דקות ספורות עם consent ישן עד re-check. לתעד זאת.
- **משתמשים קיימים (MEDIUM)**: גל ראשון של re-acceptance עלול להרגיש פולשני. נוסח רך + הסבר "עדכנו את התנאים" (hebrew-content-writer).
- **audit integrity (MEDIUM)**: `user_consents` חייב append-only — אסור UPDATE/DELETE. ה-RLS לא נותן INSERT ישיר וה-RPC `ON CONFLICT DO NOTHING` שומר על immutability; לוודא שאין policy שמאפשר מחיקה (מלבד `ON DELETE CASCADE` כשהמשתמש נמחק — תקין ל-GDPR/right-to-erasure).
- **guest race (LOW)**: מיזוג consent מ-localStorage אחרי sign-in חייב להיות idempotent (כמו `pending_coach_intent`).

### מאמץ והערכה
- **M** — סה"כ ~4–6 ימי עבודה.
  - migrations + RPC + RLS + seed: ~1 יום.
  - consentService + ConsentContext + tests: ~1 יום.
  - ConsentGate + ConsentCheckboxes + נוסח קטינים: ~1 יום.
  - שילוב onboarding (ConsentStep + wizard gating): ~0.5 יום.
  - עמודי legal ציבוריים + routes + Settings links: ~0.5 יום.
  - בדיקות E2E (re-acceptance, guest→signin merge, minor path) + a11y/RTL pass: ~1 יום.

### שלב מומלץ
- **שלב 1**. זהו prerequisite ל-publish בחנויות (Capacitor work-stream) ו-prerequisite חוקי לפני payments/groups. גם תשתית ה-age-verification נשענת על שדה `is_minor` כאן. בלי consent versioning אסור לפרסם — לכן קודם.

### סקיל לשימוש
- **hebrew-content-writer** — לכל נוסח consent, כותרות השער, הסבר "עדכנו את התנאים", נוסח אישור אפוטרופוס לקטינים.
- **israeli-accessibility-compliance** — השער החוסם הוא focus-trap קריטי; תיבות סימון נדרשות + הודעות שגיאה inline נגישות ב-RTL (IS 5568).
- **hebrew-rtl-best-practices** — פריסת תיבות הסימון, קישורים מעורבים עברית/אנגלית, וכיווניות מספרי גרסה (`dir="ltr"`).
- **impeccable / design-taste-frontend** — מעבר ויזואלי על השער ועמודי ה-legal (טוקני Fresh Steel/Obsidian, ארבעת מצבי ה-UI).
- **hebrew-document-generator** — אופציונלי, אם הבעלים ירצה גם PDF חתום של המסמך שאושר (גרסה + hash) למטרות audit.

---

## אימות גיל (Age Verification)

### מצב נוכחי
- הגיל נאסף היום **רק כמטריקת אימון**, לא כשער משפטי. ב-`src/pages/onboarding/steps/ProfileStep.tsx` (שורות 83–104) יש `MobileInput type="number"` עם `label="גיל"`, `min={10}` `max={100}` שכותב ל-`data.age`. זהו קלט גיל **שמדווח על עצמו** (self-disclosing number) — בדיוק מה ש-GDPR/Apple ממליצים להימנע ממנו לטובת איסוף DOB ניטרלי.
- הטיפוס `OnboardingData.age: number | ''` מוגדר ב-`src/pages/onboarding/types.ts` (שורה 11) עם ברירת מחדל `''` ב-`DEFAULT_ONBOARDING`. **אין שום שדה `birthDate`/`dob`/`dateOfBirth` בקוד** — grep על `birth|dob|dateOfBirth|date_of_birth|תאריך לידה|אימות גיל` תחת `src/` החזיר אפס תוצאות.
- `GoalsStep.tsx` הוא שלב נטו-trainee (ב-`stepsForRole`, `types.ts` שורה 81, `goals/experience/preferences` מדולגים למאמן) — לא נוגע לגיל; מובא כאן רק כי הוא שלב סמוך בזרימה שאליו צריך להוסיף את שער-הגיל לפניו.
- ה-DB: `supabase/migrations/20260608000000_profiles_role.sql` מוסיף `profiles.role` (coach/trainee) עם trigger `guard_profile_role` ו-RPC `become_coach()` (SECURITY DEFINER) — זה הדפוס שנאמץ ל-RPC אכיפת-גיל. **אין כיום עמודות גיל/DOB/אימות ב-`profiles`**, וה-`age` הנאסף ב-onboarding נשמר רק ב-`onboarding_data`/פרופיל אימון, לא ככלי משפטי.
- אין consent-versioning מותקן עדיין (תלות חיצונית — ראה "תלויות").

### מצב יעד
- **שער-גיל ניטרלי**: לאסוף **תאריך לידה (DOB)** במקום/בנוסף ל"גיל" כמספר — date picker, לא שאלת כן/לא "האם אתה מעל גיל X" (self-disclosing הוא anti-pattern רגולטורי).
- **אכיפת מינימום ברמת השרת**: גיל מחושב מ-DOB; מתחת לסף → או חסימה מלאה או זרימת **הסכמת-הורה מאומתת (VPC)**. הסף: GDPR digital-consent age הוא 16 עם וריאציה ל-13 כרצפה לפי מדינה; דין ישראלי לקטינים; Apple age-rating + Screen Time/parental controls.
- **שמירת DOB + סטטוס אימות ב-`profiles`** (SSOT), עם re-check כשהדין/הסף משתנה (legal-change re-verification).
- **Privacy-minimal**: לשמור DOB גולמי פעם אחת + דגל `age_verified`/`min_age_met`; לא לשמור צילומי ת"ז. שימוש חוזר ב-DOB עבור advanced-profile (לא לבקש פעמיים).
- **התאמה ל-App Store / Play**: age rating מעודכן בגלל **קהילת ה-UGC החדשה** (תוכן משתמשים מעלה דירוג), הצהרת גיל מינימום בחנות.

### גישה טכנית
- **WEB (PWA)**: שלב חדש `AgeStep` ב-onboarding wizard לפני `GoalsStep`, עם date picker (input מקורי `type="date"` עם תוויות בעברית + `dir="ltr"` לתאריך, או רכיב bespoke לעקביות RTL). חישוב גיל ב-client רק ל-UX (הצגת חסימה מיידית); **האכיפה הקובעת היא RPC בשרת** `set_birth_date(_dob date)` שמחשב גיל ב-Postgres, קובע `age_verified`/`min_age_met`, ודוחה DOB עתידי/לא-סביר. כך לקוח עוין לא יכול לעקוף.
- **חישוב גיל**: ב-Postgres עדיף — `date_part('year', age(_dob))` — מקור-אמת יחיד, חסין שעון-לקוח.
- **NATIVE/Capacitor**: אין IAP/native age-API נדרש כאן, אבל **App Store Connect age rating** ו-**Play Data safety + content rating (IARC)** מוגדרים בקונסולת החנות, לא בקוד. לשקול `@capacitor/preferences` לשמירת דגל "passed gate" מקומית למניעת re-prompt offline. אם בעתיד יתווסף Apple "Declared Age Range API" (iOS 18.4+) — ניתן לקרוא טווח-גיל מהמכשיר דרך plugin מקורי במקום date picker; כרגע מחוץ ל-scope, אך יש לבודד את ה-gate מאחורי שירות `ageGate` כדי לאפשר החלפת מקור.
- **סף לפי מדינה**: טבלת `age_thresholds` (country → min_age) הנקראת ב-RPC, כך ששינוי דין = UPDATE שורה + re-check, בלי deploy קוד.
- **Re-check בשינוי דין**: עמודת `min_age_at_verification` שמורה; cron/edge function מסמן פרופילים שהאימות שלהם בוצע לפי סף ישן ומחייב re-consent.
- **שימוש בסקיל**: `israeli-accessibility-compliance` ל-date picker נגיש (RTL ARIA, NVDA/VoiceOver), `hebrew-content-writer` לכל הקופי (כולל הודעת חסימה רגישה), `impeccable` ל-empty/error states של ה-gate.

### מודל נתונים
```sql
-- migration: 20260609000000_age_verification.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_age_at_verification smallint, -- הסף שלפיו אומת
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS parental_consent_status text
    CHECK (parental_consent_status IN ('not_required','pending','granted','denied'))
    DEFAULT 'not_required';

-- שמירת שפיות: DOB לא בעתיד, לא לפני 1900
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_birth_date_sane
  CHECK (birth_date IS NULL OR (birth_date <= current_date AND birth_date >= '1900-01-01'));

-- סף גיל לפי מדינה (default-row 'XX' = ברירת מחדל גלובלית)
CREATE TABLE IF NOT EXISTS public.age_thresholds (
  country_code text PRIMARY KEY,      -- 'IL', 'XX' (default)
  min_age smallint NOT NULL CHECK (min_age BETWEEN 13 AND 18),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.age_thresholds(country_code,min_age) VALUES ('XX',16),('IL',16)
  ON CONFLICT DO NOTHING;

-- RPC יחיד ואטומי, בדפוס become_coach() — חישוב גיל בשרת
CREATE OR REPLACE FUNCTION public.set_birth_date(_dob date, _country text DEFAULT 'XX')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); yrs int; threshold smallint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='insufficient_privilege'; END IF;
  IF _dob > current_date OR _dob < '1900-01-01' THEN
    RAISE EXCEPTION 'invalid_birth_date' USING ERRCODE='check_violation'; END IF;
  SELECT min_age INTO threshold FROM age_thresholds
    WHERE country_code IN (_country,'XX') ORDER BY (country_code=_country) DESC LIMIT 1;
  yrs := date_part('year', age(_dob))::int;
  UPDATE profiles SET
    birth_date = _dob,
    age_verified = (yrs >= threshold),
    min_age_at_verification = threshold,
    age_verified_at = now(),
    parental_consent_status = CASE WHEN yrs >= threshold THEN 'not_required' ELSE 'pending' END
  WHERE id = uid;
  RETURN jsonb_build_object('age', yrs, 'min_age', threshold, 'verified', yrs >= threshold);
END; $$;
REVOKE ALL ON FUNCTION public.set_birth_date(date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_birth_date(date,text) TO authenticated;
```
- **RLS**: `birth_date` הוא PII — לוודא שמדיניות ה-SELECT הקיימת על `profiles` לא חושפת `birth_date` למאמן/לאחרים; אם הקהילה/coach קוראים `profiles`, ליצור view ציבורי בלי `birth_date` ולהשאיר את העמודה נגישה רק ל-`auth.uid() = id`. `age_thresholds` קריא לכולם (`authenticated`), כתיב רק ל-service_role.

### קבצים
- create: `src/pages/onboarding/steps/AgeStep.tsx` — שער DOB ניטרלי (date picker RTL נגיש, חסימה/empty/error).
- create: `src/services/ageGate.ts` — `setBirthDate(dob, country)` עוטף RPC, `computeAge`, `isMinAgeMet`; מבודד את מקור-הגיל (לעתיד: Declared Age Range API).
- create: `src/pages/onboarding/steps/UnderAgeStep.tsx` — מסך חסימה/הסכמת-הורה (כשהגיל מתחת לסף).
- create: `supabase/migrations/20260609000000_age_verification.sql` — עמודות, constraint, `age_thresholds`, `set_birth_date()`.
- create: `supabase/functions/age-recheck/index.ts` — edge function (cron) לסימון פרופילים שאומתו לפי סף ישן.
- modify: `src/pages/onboarding/types.ts` — להוסיף `birthDate?: string` ל-`OnboardingData`/`DEFAULT_ONBOARDING`, להוסיף `{ id:'age', ... }` ל-`STEPS` (לפני `goals`), ולהשאיר את `age` כמטריקת אימון נגזרת (לא לשבור readers קיימים).
- modify: `src/pages/OnboardingFlow.tsx` — לרנדר `AgeStep`, לחסום `next` עד DOB תקין, לקרוא `setBirthDate` ולנתב ל-`UnderAgeStep` כש-`!verified`.
- modify: `src/pages/onboarding/steps/ProfileStep.tsx` — להחליף את שדה "גיל" החופשי בגיל **מחושב מ-DOB (קריאה-בלבד)** או להסירו לטובת השלב החדש (להימנע מ-self-disclosing כפול).
- modify: `src/pages/settings/sections/ProfileSection.tsx` — להציג סטטוס אימות ולאפשר תיקון DOB (re-runs RPC).

### תלויות וחבילות
- npm: **אין צורך בחבילה חדשה** ל-MVP — `type="date"` מקורי + Zod (כבר בשימוש בפרויקט) לוולידציה. אופציונלי: `react-day-picker` אם נדרש date picker RTL מותאם (להעדיף native כדי לא לנפח bundle — YAGNI).
- native (Capacitor): `@capacitor/preferences` (דגל gate offline). אין IAP/native plugin חובה כאן.
- env/secrets: אין סוד חדש. ל-edge function ה-recheck: `SUPABASE_SERVICE_ROLE_KEY` (קיים).
- שירותים חיצוניים: **VPC (verifiable parental consent)** מלא דורש ספק צד-ג' (למשל Kids Web Services / k-ID) — מחוץ ל-MVP; ה-MVP הוא **block-under-age**, וה-VPC מסומן כ-hook עתידי דרך `parental_consent_status`. App Store Connect / Play Console age-rating — קונפיגורציה ידנית, לא קוד.
- תלות פנימית: יש לבצע אחרי/יחד עם **consent-versioning** (לקשור גרסת-הסכמה לאירוע-האימות) ולקשור ל-**advanced-profile** (שימוש חוזר ב-`birth_date`, לא לבקש DOB פעמיים).

### סיכונים
- **App Store/Play (גבוה)**: קהילת ה-UGC החדשה מעלה את age rating ומחייבת age gate + מנגנון דיווח/חסימה — Apple Guideline 1.2 (UGC) ו-Play UGC policy עלולים **לדחות הגשה** בלי שער גיל ומודרציה. שער הגיל הוא תנאי-סף להגשה, לא nice-to-have.
- **משפטי (גבוה)**: סף שגוי = חשיפת GDPR/COPPA-equivalent. הסף משתנה לפי מדינה (16 ברירת מחדל, 13 רצפה); יש לאמת מול יועץ משפטי לפני production. דין ישראלי לקטינים + חוק הגנת הפרטיות.
- **Privacy (בינוני)**: `birth_date` הוא PII רגיש — סיכון דליפה דרך RLS/coach view; חובה לבדוק שאף policy לא מחזיר אותו לצד שלישי. לכלול ב-export/delete הקיימים (ExportSection/DangerZone).
- **עקיפת לקוח (בינוני)**: חישוב גיל ב-client בלבד ניתן לזיוף — לכן ה-SSOT הוא ה-RPC בשרת.
- **UX/נגישות (בינוני)**: date picker ב-RTL נוטה לבאגים (סדר יום/חודש/שנה); הודעת חסימה לקטין חייבת להיות רגישה ולא מאשימה — `hebrew-content-writer` + `israeli-accessibility-compliance`.
- **משתמשים קיימים (בינוני)**: מי שכבר עבר onboarding בלי DOB — צריך backfill prompt חד-פעמי (`age_verified=false` כברירת מחדל מאלץ זאת).

### מאמץ והערכה
**M** — ~5 ימי עבודה.
- מיגרציה + RPC + RLS + `age_thresholds`: ~1 יום.
- `AgeStep` + date picker נגיש RTL + `UnderAgeStep`: ~1.5 ימים.
- `ageGate.ts` + שילוב ב-`OnboardingFlow` + עדכון `ProfileStep`/`ProfileSection` + types: ~1 יום.
- edge function recheck + backfill למשתמשים קיימים: ~0.5 יום.
- בדיקות (unit ל-`computeAge`/RPC, E2E לזרימת חסימה) + a11y/קופי pass: ~1 יום.
- *לא כולל* VPC צד-ג' מלא (פיצ'ר נפרד) וקונפיג חנות (ידני, חופף לעבודת ההגשה).

### שלב מומלץ
**שלב 1.** זהו **blocker לחנות ולקהילת ה-UGC** — אסור להשיק קהילה/UGC או להגיש לחנויות בלי שער גיל. כתלות-יסוד (PII + RLS + onboarding) עדיף לבצע מוקדם, יחד עם consent-versioning, כדי שכל הזרימות הבאות (community, advanced-profile) ייבנו מעליו.

### סקיל לשימוש
- `israeli-accessibility-compliance` — date picker נגיש, RTL ARIA, NVDA/JAWS/VoiceOver, IS 5568.
- `hebrew-content-writer` — קופי לשער הגיל, הודעת חסימה לקטין (רגיש, נכון דקדוקית), טקסט הסכמת-הורה.
- `hebrew-rtl-best-practices` — רינדור DOB/תאריך `dir="ltr"` בתוך פריסת RTL, סדר שדות.
- `impeccable` — מצבי loading/empty/error/success של ה-gate והמסך החוסם.

---

## רכישות בתוך האפליקציה + מנויים (חודשי/שנתי)

### מצב נוכחי

נקודת ההתחלה היא **skeleton בלבד** — אין שום חיבור לפרוצסור תשלום:

- `supabase/migrations/20260529000000_coach_platform.sql` (שורות 154–170) מגדיר את `public.coach_subscriptions` עם `plan TEXT CHECK (free/solo/starter/pro/elite)`, `seat_limit`, ו-`status CHECK (active/past_due/canceled)`. ה-comment במיגרציה עצמה קורא לזה `design-only entitlements / seats`. **אין** `stripe_subscription_id`, `current_period_end`, `trial_end`, `receipt_id` או שדות webhook.
- ה-`seat_limit` נאכף בפועל ב-trigger `enforce_seat_limit()` (שורות 209–238 באותה מיגרציה) על `coach_clients` — זה כל ה-runtime enforcement שקיים. ברירת מחדל = 1 כשאין שורת subscription.
- Types: `src/types/coach.ts` (שורות 11–12, 117–124) — `CoachPlan`, `SubscriptionStatus`, `interface CoachSubscription` ממופים 1:1 לטבלה, ללא שדות provider.
- Runtime: `src/contexts/CoachContext.tsx` (שורות 19, 21, 74, 86, 99) טוען `subscription: CoachSubscription | null` דרך `getMySubscription()`; `src/services/coach/mappers.ts` ממפה שורת DB; `src/services/coach/inviteService.ts` קורא `seat_limit` ל-pre-check בצד client. **שום מקום בקוד לא בודק `plan` ל-feature-gating.**
- אין SDK תשלום ב-`package.json` (לא Stripe/Paddle/Lemon/RevenueCat/Capacitor). אין `paywall`/`useEntitlement`/`is_premium`/`PlanGate` בכל ה-`.ts/.tsx`.
- `interface Profile` ב-`src/types/coach.ts` (שורות 17–24) ו-`20260608000000_profiles_role.sql` — אין שדות billing על trainees כלל; ל-trainees אין טבלת subscription בכלל.
- Edge functions קיימים כתבנית מצוינת ל-webhook: `supabase/functions/coach-invite-accept/index.ts` ו-`ai-chat/index.ts` כבר מיישמים CORS fail-closed (`ALLOWED_ORIGIN`), service-role client, ו-JSON envelope — נמחזר את אותו pattern.

### מצב יעד

- מנוי **trainee** (B2C, premium אישי) ו-מנוי **coach** (B2B, seats) — שניהם חודשי/שנתי (annual בהנחה), עם trial חינמי, grace period, proration, dunning.
- **שני מסלולי תשלום**: (a) WEB checkout דרך MoR; (b) NATIVE IAP (Apple StoreKit / Google Play Billing) דרך RevenueCat ב-Capacitor.
- **SSOT אחד ל-entitlements** ב-Supabase: provider (web/apple/google) כותב דרך webhook → edge function → טבלאות `subscriptions` + `entitlements`; ה-client קורא רק entitlements (לא בודק קבלות בעצמו).
- שכבת gating: `useEntitlement()` + `<PlanGate>` + paywall ב-Fresh Steel; מיפוי ברור אילו פיצ'רים קיימים הופכים premium.

### גישה טכנית

**WEB — השוואה והמלצה (חברה ישראלית שמחייבת עולמית):**

| | Stripe Billing | Paddle | Lemon Squeezy |
|---|---|---|---|
| מודל | merchant = אתה | **Merchant of Record** | Merchant of Record (בבעלות Stripe) |
| VAT/Sales-tax | אתה אחראי (צריך Stripe Tax + רישום) | **Paddle גובה ומדווח** | LS גובה ומדווח |
| חשבונית ללקוח | אתה מנפיק | Paddle מנפיק בשמך | LS מנפיק |
| עמלה | ~2.9%+30¢ (+Tax/Billing addons) | ~5%+50¢ (כולל מסים) | ~5%+50¢ |
| תמיכה IL | טוב, אבל נטל מס עליך | מצוין ל-IL solo/SMB | טוב |

**המלצה: Paddle** — בתור MoR הוא מסיר את כל נטל ה-VAT הבינלאומי וה-EU OSS/MOSS וה-US sales-tax מהחברה הישראלית, מנפיק חשבוניות ל-end-users, ומפשט דיווח לרשויות (אתה מקבל payout אחד + חשבונית מ-Paddle). Stripe זול יותר באחוזים אבל מטיל עליך רישום מס וגביית VAT ב-עשרות שיפוטים — לא שווה לצוות קטן. (החשבונית הישראלית שלך מ-Paddle כ-supplier מטופלת בנפרד; ראו הערת מס למטה.)

זרימת WEB: client → `paddle.js` overlay checkout (monthly/annual price IDs) → Paddle webhook → `supabase/functions/billing-webhook` (verify signature) → upsert `subscriptions` + recompute `entitlements`. Customer portal = Paddle hosted portal (cancel/update card) דרך לינק מ-`BillingSection`.

**NATIVE — Capacitor + RevenueCat:**

חובת Apple: מכירת digital goods בתוך האפליקציה **חייבת** StoreKit IAP (אי-אפשר לקשר ל-checkout חיצוני בתוך ה-flow, למעט reader-app exception ו-external-link entitlement מוגבל לפי שיפוט). לכן ב-native אנו עוברים דרך IAP. `@revenuecat/purchases-capacitor` מאחד Apple+Google ל-Offerings/Products אחד, מבצע server-side receipt validation, ומספק `restorePurchases()`. RevenueCat webhook → אותה `billing-webhook` (provider=apple/google) → אותו `entitlements` SSOT. כך feature-gating אחיד בלי קשר מאיפה נקנה. זיהוי פלטפורמה: `Capacitor.isNativePlatform()` → ב-web מציגים Paddle, ב-native מציגים RevenueCat offerings.

**שכבת entitlement (משותפת):** `EntitlementContext` טוען את שורת ה-`entitlements` של המשתמש (realtime subscribe), חושף `useEntitlement(feature)` ו-`<PlanGate feature="..." fallback={<Paywall/>}>`. ה-gate הוא UX בלבד — אכיפה אמיתית ב-RLS/edge על פעולות יקרות (למשל AI calls ב-`ai-chat`).

### מודל נתונים

מיגרציה חדשה `supabase/migrations/20260609000000_billing.sql`:

```sql
-- מנוי גנרי לכל משתמש (trainee או coach), ללא תלות בספק
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paddle','apple','google')),
  provider_subscription_id TEXT NOT NULL,
  product_id TEXT NOT NULL,                 -- e.g. trainee_pro_monthly
  plan TEXT NOT NULL,                       -- trainee_pro | coach_pro ...
  interval TEXT NOT NULL CHECK (interval IN ('month','year')),
  status TEXT NOT NULL CHECK (status IN
    ('trialing','active','past_due','canceled','expired','in_grace')),
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  seat_limit INTEGER,                        -- coach plans only
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id)
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id, status);

-- SSOT שטוח לקריאה מהירה ב-client (denormalized מתוך subscriptions)
CREATE TABLE public.entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',        -- free|trainee_pro|coach_solo|coach_pro|coach_elite
  features JSONB NOT NULL DEFAULT '{}'::jsonb, -- {ai_chat:true, photos:true, ...}
  seat_limit INTEGER NOT NULL DEFAULT 1,
  active_until TIMESTAMPTZ,
  source TEXT,                               -- paddle|apple|google|admin
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אירועי webhook ל-idempotency + audit
CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, event_id)               -- מונע double-processing
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- המשתמש קורא בלבד את שלו; כתיבה רק ל-service role (webhook)
CREATE POLICY ent_select_own ON public.entitlements
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY sub_select_own ON public.subscriptions
  FOR SELECT USING (user_id = (SELECT auth.uid()));
-- ללא INSERT/UPDATE policies → רק service-role webhook כותב (RLS חוסם clients).
-- billing_events: אין policy בכלל → service-role only.
```

המשכיות: שומרים את `coach_subscriptions` הקיים כ-legacy אך מסנכרנים את `seat_limit` שלו מתוך `entitlements` (כדי שה-trigger `enforce_seat_limit` ימשיך לעבוד), או מעדיפים: לעדכן את `enforce_seat_limit()` לקרוא מ-`entitlements.seat_limit`. עדיף האחרון — מיגרציה משנה את ה-trigger ומבטלת את `coach_subscriptions` בהדרגה.

### קבצים

- create: `supabase/migrations/20260609000000_billing.sql` — הטבלאות+RLS לעיל + עדכון `enforce_seat_limit` לקרוא מ-`entitlements`.
- create: `supabase/functions/billing-webhook/index.ts` — verify signature (Paddle + RevenueCat), idempotency דרך `billing_events`, upsert `subscriptions`, recompute `entitlements`. מבוסס על תבנית `coach-invite-accept/index.ts` (CORS fail-closed + service role).
- create: `src/services/billing/types.ts` — `Entitlement`, `Subscription`, `BillingProvider`, `tier→features` map.
- create: `src/services/billing/entitlementService.ts` — `getMyEntitlement()` + realtime subscribe (תבנית `services/coach/realtime.ts`).
- create: `src/services/billing/webCheckout.ts` — עטיפת `@paddle/paddle-js` (open checkout, portal link).
- create: `src/services/billing/nativePurchases.ts` — עטיפת `@revenuecat/purchases-capacitor` (configure, getOfferings, purchase, restore).
- create: `src/services/billing/platform.ts` — `isNative()` בורר web vs native.
- create: `src/contexts/EntitlementContext.tsx` — provider + `useEntitlement()`.
- create: `src/components/billing/PlanGate.tsx` — `<PlanGate feature>` עם fallback ל-paywall.
- create: `src/components/billing/Paywall.tsx` + `src/components/billing/PricingTable.tsx` — Fresh Steel, monthly/annual toggle, `.kinetic-number` למחירים (`dir="ltr"`).
- create: `src/pages/settings/sections/BillingSection.tsx` — סטטוס מנוי, ניהול, restore (native), portal link (web).
- modify: `src/pages/Settings.tsx` — רישום `BillingSection`.
- modify: `src/types/coach.ts` — סימון `CoachSubscription`/`CoachPlan` כ-legacy או מיזוג למודל החדש.
- modify: `src/contexts/CoachContext.tsx` — קריאת seats מ-entitlements במקום `coach_subscriptions`.
- modify: `src/services/coach/inviteService.ts` — pre-check seats מ-entitlements.
- modify: `supabase/functions/ai-chat/index.ts` — אכיפת entitlement `ai_chat` (gating אמיתי, לא רק UI).
- modify: `App` root — עטיפה ב-`<EntitlementProvider>`.

מיפוי premium (מהקיים): trainee tier → `ai_chat` (`src/services/ai/*`), progress photos (`20260608000300_progress_photos_storage.sql`), advanced insights (`src/hooks/fitness/insightsAggregator.ts`, `PRHighlights.tsx`), CloudSync (`CloudSyncSection.tsx`), Export (`ExportSection.tsx`). coach tier → `seat_limit>1`, group chat (`CoachGroups.tsx`), program templates (`Templates.tsx`), realtime edit, advanced analytics (`coachAnalytics.ts`).

### תלויות וחבילות

- npm (web): `@paddle/paddle-js`. (אם נבחר Stripe במקום: `@stripe/stripe-js` + `stripe` ב-edge.)
- npm (native): `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@revenuecat/purchases-capacitor`.
- Edge (Deno): Paddle signature verify (HMAC/`ED25519` לפי webhook version) + RevenueCat `Authorization` shared-secret.
- Secrets (Supabase function env): `PADDLE_WEBHOOK_SECRET`, `PADDLE_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_API_KEY` (ל-validation אם צריך), `ALLOWED_ORIGIN` (קיים). Client env: `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENV`, `VITE_REVENUECAT_PUBLIC_SDK_KEY`.
- שירותים חיצוניים: חשבון Paddle (sandbox+prod, אישור vendor), App Store Connect (StoreKit products + agreements/tax/banking), Google Play Console (subscriptions), חשבון RevenueCat (קישור Apple/Google + webhook ל-Supabase).

### סיכונים

- **App Store (CRITICAL):** מכירת digital goods חייבת IAP. הצגת מחירים/לינק לתשלום web בתוך ה-native app = דחייה (Guideline 3.1.1). external-link entitlement ו-reader exception מוגבלים ולא חלים על אפליקציית fitness רגילה — אל תסמכו עליהם. חובה paywall נפרד ב-native (RevenueCat offerings).
- **עמלת stores 15–30%:** מחיר native effective נמוך יותר; שקול תמחור שונה או ספיגת העמלה.
- **משפטי/מס (HIGH):** גם עם Paddle כ-MoR, החברה הישראלית עדיין צריכה להנפיק חשבונית/קבלה כדין לתשלומים שמתקבלים מ-Paddle כ-supplier ולדווח מע"מ/מס הכנסה — לוודא עם רו"ח. אסור להתחייב לפרטים מבלי ייעוץ.
- **idempotency/double-charge:** webhooks מגיעים פעמיים — `billing_events UNIQUE` חובה; כל recompute חייב להיות deterministic.
- **trial abuse / restore fraud:** server-side validation בלבד; לעולם לא לסמוך על client לקביעת entitlement.
- **drift בין שלושה ספקים:** משתמש שקנה ב-web ואז ב-native = שני מנויים; צריך מדיניות merge/refund.

### מאמץ והערכה

**L–XL** (~16–22 ימי עבודה):

- מודל נתונים + RLS + מיגרציה: 1.5
- billing-webhook (Paddle + RevenueCat, idempotency, recompute): 3
- EntitlementContext + useEntitlement + PlanGate: 2
- WEB checkout + portal (Paddle): 2.5
- NATIVE: Capacitor bootstrap (iOS+Android) + RevenueCat offerings/purchase/restore: 4 (כולל store setup/agreements)
- Paywall + PricingTable + BillingSection (Fresh Steel, RTL, a11y): 3
- אכיפת gating ב-ai-chat + מיפוי פיצ'רים premium: 1.5
- בדיקות (unit entitlement logic, webhook idempotency, E2E checkout sandbox): 2.5

### שלב מומלץ

**WEB = שלב 1** (תלוי רק ב-Supabase, מספק הכנסה מיידית, ללא תלות ב-Capacitor). **NATIVE/RevenueCat = שלב 2** — חוסם על work-stream ה-Capacitor (חייב wrapper לפני IAP) ועל הקמת App Store/Play accounts. מודל ה-entitlement המשותף נבנה כבר בשלב 1 כך ש-native רק מוסיף provider שני לאותו SSOT. dunning/grace/proration המתקדמים → שלב 2–3.

### סקיל לשימוש

- **impeccable** / **design-taste-frontend** — paywall + pricing table ב-Fresh Steel (anti-slop, monthly/annual toggle, מחירים `.kinetic-number` ב-`dir="ltr"`).
- **hebrew-content-writer** — כל הקופי: שמות tiers, יתרונות, כפתורי CTA, error/grace-period messages, restore.
- **hebrew-rtl-best-practices** — pricing layout RTL, מחירים/אחוזי הנחה bidi.
- **israeli-accessibility-compliance** — נגישות ל-paywall ול-checkout (IS 5568), focus management.
- **hebrew-document-generator** — הנפקת חשבונית מס/קבלה ישראלית (Heshbonit Mas) ללקוחות שמשלמים, כתיעוד נלווה ל-payout מ-Paddle.

---

## תמיכה דו-כיוונית מלאה (RTL / LTR) + תשתית i18n

### מצב נוכחי

- **`dir`/`lang` סטטיים בלבד.** `index.html` (שורה 2) מגדיר `<html lang="he" dir="rtl">` והכל מסתמך על זה. `src/App.tsx` (אומת) **אינו** מנהל `dir`/`lang` כ-state — אין `documentElement.dir = ...` בשום מקום. RTL "עובד" רק כי ה-HTML הוא RTL סטטי; אין מנגנון החלפה.
- **הגדרות `dir` כפולות בעמודים.** `src/pages/Login.tsx`, `src/pages/AccessibilityStatement.tsx`, `src/pages/coach/_shared.tsx`, `src/pages/OnboardingFlow.tsx`, `src/pages/Settings.tsx`, `Dashboard.tsx`, `Progress.tsx`, `Nutrition.tsx`, `Templates.tsx` ו-`src/errors/{RootErrorBoundary,PageErrorBoundary}.tsx` כולן מגדירות `dir="rtl"` עצמאית — redundant, וכולן יצטרכו לעבור ל-inherit מה-root במקום hardcode.
- **אין שום ספריית i18n.** חיפוש על `i18next`/`react-intl`/`lingui`/`next-intl` — אפס. אין תיקיית `src/i18n` (אומת ב-Glob), אין קבצי `*.po`/locale.
- **כל הטקסט hardcoded עברית.** ~513 מופעים של תווי עברית ב-149 קבצי TSX. אפילו `src/App.tsx` עצמו מכיל מפות תוויות עבריות קשיחות (`PATH_LABEL_MAP` שורות 148-164, כותרות `pageLabel` בכל route, `document.title` שורה 624).
- **Tailwind ללא RTL plugin.** `tailwind.config.js` (שורה 254): `plugins: []` ריק. שימוש **מעורב**: physical (`ml-/mr-/pl-/pr-/left-/right-/border-l/rounded-l`) ב-~52 מופעים ב-29 קבצים, לצד logical (`ms-/me-/ps-/pe-/text-start/text-end`) ב-~52 מופעים ב-28 קבצים. `Button.tsx`/`Input.tsx` כבר logical; קוד ישן עדיין physical.
- **`chapterReveal` keyframe** (`tailwind.config.js` שורה 199-202): `clipPath: 'inset(0 100% 0 0)'` physical — יתהפך ב-LTR.
- **בידוד bidi לא-עקבי.** דפוס נרחב של `<span dir="ltr" className="kinetic-number">` למספרים (`Dashboard.tsx:583`, `OfflineIndicator.tsx`, `StatsGrid.tsx`). `<bdi>` מופיע פעם **אחת** בלבד (`ScheduleCalendar.tsx:447`).
- **גופנים.** `tailwind.config.js`: `sans=['Assistant',...]` (תמיכה טובה בעברית), `display=['Bricolage Grotesque','Assistant',...]` — Bricolage לטיני בלבד, נשען על fallback ל-Assistant בעברית, לא מפורש.
- **תשתית persistence קיימת ומתאימה.** `src/contexts/SettingsContext.tsx` כבר טוען/שומר ל-`localStorage('appSettings')` (שורות 118-142) ומחיל classes על `document.documentElement` דרך effect (שורות 184-200, `toggle('dark', ...)`). **זהו בדיוק הדפוס שנרחיב** עבור `dir`/`lang` — לא צריך מנגנון חדש.
- Settings מכיל 11 sections (אומת ב-Glob); **אין** `LanguageSection`.

### מצב יעד

1. **תשתית i18n חיה** עם ספרייה אחת (react-i18next) ו-namespace אחד לפחות מאוכלס, אבל **עברית נשארת ברירת המחדל** (אין רגרסיה — אם המשתמש לא בחר שפה, הכל זהה להיום).
2. **`LocaleProvider` יחיד** ששולט ב-`document.documentElement.lang` ו-`dir` לפי השפה הנבחרת, מסיר את כל ה-`dir="rtl"` הכפולים מהעמודים (inherit מה-root).
3. **מתג שפה ב-Settings** (`LanguageSection` חדש) עם persistence ל-`appSettings.locale` (דרך ה-SettingsContext הקיים).
4. **LTR נטען ומוצג נכון** — מסכים מרכזיים (Settings, Onboarding, Login, AccessibilityStatement, BottomNav) עוברים ל-logical CSS כך שכשעוברים ל-`en`/LTR הפריסה לא נשברת.
5. **ביקורת logical-CSS** מסודרת: כל ה-physical classes ב-29 הקבצים ממופים ל-logical, `chapterReveal` הופך ל-direction-agnostic.
6. **בידוד bidi עקבי**: רכיב `<Num>`/`<Ltr>` משותף שעוטף מספרים/טקסט לועזי ב-`<bdi dir="ltr">` במקום `<span dir="ltr">` מפוזר.
7. **mirroring אייקונים** (lucide) לאלמנטים כיווניים (חצים, chevron) לפי `dir`.

### גישה טכנית

**בחירת ספרייה — המלצה: `react-i18next` (i18next).**

| קריטריון | react-i18next | LinguiJS | FormatJS (react-intl) |
|---|---|---|---|
| RTL/CLDR plural לעברית | טוב (מצריך התאמה ל-`he` plural rules — i18next מובנה) | טוב | מצוין (Intl-native) |
| externalization workflow | מפתח JSON ידני / `i18next-parser` להחצנה אוטומטית | macro + `extract` CLI (מעולה) | `formatjs extract` |
| bundle | קל-בינוני, lazy namespaces מובנה | קל (compile-time) | כבד יחסית |
| תאימות Vite + React 18 + lazy | מצוינת, `i18next-http-backend`/`resources` static | טובה (Babel macro מצריך setup) | טובה |
| עקומת אימוץ הדרגתי | הטובה ביותר — `t('key', 'fallback inline')` עם default value מאפשר החצנה קובץ-קובץ בלי לשבור כלום | macro מצריך migration גורף יותר | טובה |

react-i18next נבחר כי הוא מאפשר **החצנה הדרגתית עם default-value inline** (`t('settings.title', 'הגדרות')`) — קריטי כשיש 149 קבצים, מתממשק נקי עם Vite/lazy, ויש לו `i18next-parser` לחילוץ מפתחות אוטומטי. (FormatJS חזק יותר ב-Intl אבל כבד וה-`<FormattedMessage>` JSX פולשני; Lingui מצוין אבל ה-Babel macro מצריך migration רחב מראש.)

**מבנה (web + Capacitor זהה — i18n הוא pure JS, אגנוסטי לפלטפורמה):**
- `src/i18n/index.ts` — אתחול i18next עם `initReactI18next`, `fallbackLng: 'he'`, `supportedLngs: ['he','en']`, `LanguageDetector` (קורא מ-`appSettings.locale` ב-localStorage, לא מ-navigator כדי לא לשבור עברית כברירת מחדל).
- `src/i18n/locales/he/common.json` + `src/i18n/locales/en/common.json` — namespaces. מתחילים מ-namespace אחד (`common`) + per-feature (`settings`, `onboarding`, `coach`).
- `src/contexts/LocaleProvider.tsx` — עוטף את האפליקציה, מאזין ל-`i18n.on('languageChanged')`, ומגדיר `documentElement.lang`/`dir` (`he/ar → rtl`, אחרת `ltr`). זהו ה-**SSOT היחיד** ל-dir. מסירים את כל ה-`dir="rtl"` הכפולים מהעמודים.

**Capacitor הערה:** ה-WebView מכבד `<html dir>` כרגיל; אין בעיה native. אם בעתיד מוסיפים native UI (StatusBar/Push), צריך לסנכרן locale גם דרך `@capacitor/device` getLanguageCode — מחוץ ל-scope הנוכחי.

**אסטרטגיית externalization (הדרגתית, לא big-bang):**
1. Wave 0: תשתית + 2 namespaces (`common`, `settings`) + `LanguageSection`.
2. Wave 1: מסכים בעלי-ערך-גבוה ל-LTR קודם — Settings, Login, OnboardingFlow, AccessibilityStatement, BottomNav, `App.tsx` (`PATH_LABEL_MAP` + `pageLabel`).
3. Wave 2: שאר העמודים, namespace-by-namespace. שימוש ב-`i18next-parser` לחילוץ מפתחות אוטומטי + `t()` עם default-value עברי כך שכל קובץ עובר בנפרד בלי לשבור build.

**dir switching:** מחוברת ל-locale ב-`LocaleProvider` בלבד. `useViewTransition.ts` (שורות 108-112) שכבר מגיב ל-`[dir="rtl"]` — נשאר, וכעת הסלקטור יתחלף דינמית.

**logical-CSS audit:** ממירים physical→logical ב-29 הקבצים (`ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`, `text-left→text-start`, `border-l→border-s`, `rounded-l→rounded-s`). מתקנים `chapterReveal` clipPath להיות direction-agnostic (או שני keyframes עם `[dir]` override).

**bidi:** רכיב `src/components/ui/Num.tsx` (`<bdi dir="ltr" className="kinetic-number">`) מחליף את הדפוס המפוזר. כל מספר/token לועזי עובר דרכו.

**icon mirroring:** util `src/utils/rtl.ts` עם `isRtl()` + class `rtl:-scale-x-100` (מצריך הוספת variant) או החלפת `ChevronRight↔ChevronLeft` לפי dir בקומפוננטות ניווט.

### מודל נתונים

אין צורך בטבלאות/RLS חדשים — locale הוא העדפת-לקוח. נשמר ב-`localStorage` הקיים. **אופציונלי** לסנכרון cross-device (Phase מאוחר):

```sql
-- OPTIONAL, deferrable: add to existing profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'he'
    CHECK (locale IN ('he','en'));
-- RLS: profiles already has owner self-update policy; no new policy needed
-- (column inherits the existing "users update own profile" policy).
```

מיגרציה: `supabase/migrations/20260610000000_profiles_locale.sql` — **רק אם** מחליטים על sync. ברירת מחדל: localStorage בלבד, אין migration ב-Phase 1.

### קבצים

create:
- `src/i18n/index.ts` — i18next init (fallbackLng he, supportedLngs he/en)
- `src/i18n/locales/he/common.json`, `src/i18n/locales/he/settings.json`
- `src/i18n/locales/en/common.json`, `src/i18n/locales/en/settings.json`
- `src/contexts/LocaleProvider.tsx` — SSOT ל-`documentElement.lang`/`dir`
- `src/pages/settings/sections/LanguageSection.tsx` — מתג שפה (he/en)
- `src/components/ui/Num.tsx` — `<bdi dir="ltr">` wrapper למספרים/לועזית
- `src/utils/rtl.ts` — `isRtl()`, icon-mirror helpers
- `i18next-parser.config.js` — config לחילוץ מפתחות
- `src/i18n/__tests__/locale.test.tsx` — בדיקות dir-switch + completeness

modify:
- `src/App.tsx` — לעטוף ב-`LocaleProvider` (תחת `SettingsProvider`); להחצין `PATH_LABEL_MAP` + `pageLabel` + `document.title`
- `src/main.tsx` — `import './i18n'` לפני render
- `index.html` — להשאיר `lang="he" dir="rtl"` כ-default (ה-Provider ידרוס דינמית)
- `src/contexts/SettingsContext.tsx` — להוסיף `locale` ל-`AppSettings` + default `'he'`; effect שמסנכרן ל-i18next (במקביל ל-`toggle('dark')` הקיים)
- `src/types/*` — הוספת `locale: 'he' | 'en'` ל-`AppSettings`
- `src/pages/Settings.tsx` — להוסיף `LanguageSection`; להסיר `dir="rtl"` כפול (שורה 74)
- `src/pages/{Login,OnboardingFlow,Dashboard,Progress,Nutrition,Templates}.tsx`, `src/pages/AccessibilityStatement.tsx`, `src/pages/coach/_shared.tsx`, `src/errors/{Root,Page}ErrorBoundary.tsx` — הסרת `dir="rtl"` כפול
- `tailwind.config.js` — תיקון `chapterReveal`; (אופציונלי) הוספת `rtl:`/`ltr:` variants או plugin
- ~29 קבצים עם physical classes — המרה ל-logical (wave 1 קודם: `BottomNav.tsx`, `ProgressBar.tsx`, `CompleteStep.tsx`, `ScheduleCalendar.tsx`, `ProgressionRecommendation.tsx`)

### תלויות וחבילות

npm:
- `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- dev: `i18next-parser` (חילוץ מפתחות)
- (לא נדרש) `@formatjs/intl` — Intl מובנה בדפדפן ל-`Intl.NumberFormat`/`DateTimeFormat`

native (Capacitor): אין חדש ל-Phase זה. עתידי-אופציונלי: `@capacitor/device` (זיהוי שפת מכשיר).

env/secrets: אין.
external services: אין (תרגום ידני; אופציונלי שירות תרגום ל-en בעתיד).

### סיכונים

- **רגרסיית RTL בזמן ההמרה ל-logical** — אם ממירים physical→logical בלי בדיקה ויזואלית, פריסות עבריות עלולות לזוז. מיטיגציה: המרה wave-by-wave + screenshot diff ב-both directions, skill `impeccable`.
- **תרגום עברי שבור / register לא-עקבי** — מפתחות שמחולצים אוטומטית עלולים לאבד הקשר מגדרי/smichut. מיטיגציה: `hebrew-content-writer` על קובצי ה-locale, לא חילוץ עיוור.
- **scope-creep** — 149 קבצים זה פיתוי ל-big-bang. הסיכון האמיתי הוא לנסות להחצין הכל בבת אחת. מיטיגציה: groundwork + waves; en יכול להישאר חלקי בהתחלה (fallback ל-he).
- **bundle growth** — i18next + namespaces. מיטיגציה: lazy namespaces, en נטען רק על בחירה.
- **App Store / legal:** נמוך מאוד. אין IAP/payment פה. הערה חיובית: תמיכה דו-לשונית ו-`lang` תקין משפרים נגישות (IS 5568 דורש `lang` נכון לקורא-מסך) — נכס לא סיכון. אין השלכות מס/MoR.
- **`prefers-reduced-motion` + view-transition** — שינוי dir באמצע session עלול להריץ view-transition לא רצוי. מיטיגציה: לדלג על transition בעת `languageChanged`.

### מאמץ והערכה

**Effort: L (~9 ימים)**
- תשתית (i18n init + LocaleProvider + SettingsContext wiring + LanguageSection): 2 ימים
- ביקורת + המרה logical-CSS (29 קבצים, wave 1+2) + `chapterReveal`: 2.5 ימים
- externalization wave 1 (Settings/Login/Onboarding/AccessibilityStatement/BottomNav/App labels) + `Num`/bidi/icon-mirror: 2.5 ימים
- en locale ראשוני + QA דו-כיווני (screenshots both dirs) + tests: 2 ימים

### שלב מומלץ

**Phase 1 (groundwork).** הסיבה: זו תשתית רוחבית שכל feature עתידי (community, payments UI, coach) יבנה מעליה. ככל שנמתין, נצטבר עוד hardcoded strings ב-149→N קבצים והעלות תגדל ליניארית. עברית נשארת default → אפס סיכון מוצר. החצנה מלאה של כל המסכים ל-en יכולה להידחק ל-Phase 2/3 — אבל ה-foundation + dir-switching + logical-CSS audit חייבים להיכנס מוקדם.

### סקיל לשימוש

- **hebrew-rtl-best-practices** — לב העבודה: logical properties, `:dir()`, Tailwind RTL, icon mirroring, bidi, בחירת גופן.
- **hebrew-content-writer** — כתיבה/עריכה של קובצי `locale/he/*.json` (register, מגדר, smichut) — לא חילוץ עיוור.
- **israeli-accessibility-compliance** — לוודא `lang`/`dir` תקינים לקורא-מסך (NVDA/VoiceOver עברית) לפי IS 5568.
- **impeccable** — QA ויזואלי דו-כיווני (he-RTL מול en-LTR) אחרי כל wave.

---

## קבוצות/פורומים פנימיים — קהילת מתאמנים + קבוצות מאמן עשירות

### מצב נוכחי

קיימת תשתית **קבוצות מאמן בלבד** — סגורה, coach-owned, opt-in. אין שום שכבת קהילה רוחבית בין מתאמנים.

- **DB:** `public.client_groups` (`id`, `coach_id`, `name`, `created_at`, `coach_last_read_at`) ו-`public.client_group_members` (`group_id`, `client_id`, `created_at`, `last_read_at`; PK מורכב) — ב-`supabase/migrations/20260529000000_coach_platform.sql`. שכבת chat ב-`supabase/migrations/20260607000000_group_chat.sql`: `public.group_messages` (`id`, `group_id`, `sender_id`, `body` עם `CHECK char_length<=5000`, `created_at`), index `idx_group_messages_thread (group_id, created_at)`, RLS SELECT+INSERT למשתתפים, **ללא UPDATE/DELETE (immutable בכוונה)**, ו-Realtime publication.
- **Helpers:** `public.is_group_member(_group)`, `public.is_coach_of(_client)`, `public.is_client_of(_coach)` — כולם `SECURITY DEFINER`. ה-SSOT לתפקיד הוא `profiles.role` (`coach`/`trainee`) עם `become_coach()` RPC — `supabase/migrations/20260608000000_profiles_role.sql`.
- **Service:** `src/services/coach/groupService.ts` (CRUD קבוצות, `setGroupMembers` עושה DELETE+INSERT מלא — מאפס `last_read_at`), `src/services/coach/groupMessageService.ts` (`getGroupThread` bounded 500, `sendGroupMessage` עם push בלולאה client-side, `listGroupThreads`, `getGroupUnreadCount`), `src/services/coach/realtime.ts` (`subscribeToGroupThread` — **חסר `channelSeq` suffix**, בניגוד ל-`subscribeToUserTable`), `src/services/coach/mappers.ts`.
- **UI:** `src/pages/coach/CoachGroups.tsx`, `src/pages/coach/GroupThread.tsx` (משותף coach+member דרך prop `viewer`), `src/pages/coach/CoachMessages.tsx`, `src/pages/MyCoach.tsx`. Routes ב-`src/App.tsx`: `/coach/groups`, `/coach/groups/:groupId/chat`, `/my-coach/groups/:groupId/chat`.
- **Types:** `ClientGroup`, `GroupMessage`, `GroupThreadSummary` ב-`src/types/coach.ts`.
- **תשתיות שניתן למחזר:** Storage bucket פרטי עם RLS לפי foldername (`supabase/migrations/20260608000300_progress_photos_storage.sql`), edge function ל-push (`supabase/functions/coach-push-send/index.ts`, מאמת active link, fan-out ל-`push_subscriptions` ב-`Promise.all`), ו-rate-limit ledger `public.rate_limit_events` (`supabase/migrations/20260529100000_coach_rate_limits.sql`, service-role בלבד, מגן כרגע רק על `coach-invite-accept`).

**פערים:** אין feed ציבורי, אין topics/hashtags, אין follows, אין reactions, אין comments, אין report/block/mute, אין topic structure בתוך קבוצה (thread שטוח אחד), ל-`client_groups` אין `description`/`avatar`/`visibility`, ואין rate-limit על `group_messages`.

### מצב יעד

שתי שכבות נפרדות תחת ניווט חדש:

**(A) קהילת מתאמנים — `/community`:** feed ראשי + פורומים לפי topic. מתאמן יכול: לפרסם post (טקסט + עד 4 תמונות), להגיב, לתת reaction (like + 4 emoji), לעקוב אחרי משתמשים ו-topics, לסנן feed לפי "עוקבים"/"חם"/"חדש". כל post משויך ל-topic אחד (`#כושר`, `#תזונה`, `#ריצה`...) עם hashtags חופשיים. Realtime ל-comments/reactions בפוסט פתוח. notifications ל-reply/reaction/follow. **Moderation מלא** (חובה ל-App Store): report על post/comment/user, block ו-mute של משתמש, profanity filter אוטומטי, ותור טיפול ל-admin/coach.

**(B) קבוצות מאמן עשירות:** על גבי הקיים — challenges (אתגר עם metric ו-deadline), leaderboards (דירוג חברים לפי metric), announcements נעוצות (pinned), ושיוך group programs/assignments משופר. פרטיות: קבוצת מאמן נשארת `coach-only` (סגורה); הקהילה היא `public`. הרחבת rate-limit ל-`group_messages` ול-posts/comments.

### גישה טכנית

- **ארכיטקטורה:** שכבת community נפרדת מ-coach (`src/services/community/*`, `src/pages/community/*`) — לא לערבב עם `coach/*`. מודל הרשאות שונה: community הוא public-read אך rate-limited, coach groups הם consent-gated. מיחזור patterns קיימים: mapper convention, bounded queries, `requireClient()`, logger.
- **Feed pagination:** keyset/cursor pagination על `(created_at, id)` — לא limit-500 קשיח כמו בצ'אט. `listFeed({ cursor, scope })` עם `scope: 'following' | 'hot' | 'new'`. "hot" = ranking פשוט בצד DB (reactions + comments ב-48ש האחרונות) דרך view או RPC; להתחיל מ-`new` ולהוסיף `hot` ב-iteration שני (YAGNI).
- **Reactions/comments counts:** denormalized counters (`like_count`, `comment_count`) על `posts`, מתוחזקים ע"י triggers — נמנע N+1 ו-aggregate יקר בכל טעינת feed.
- **Realtime:** מיחזור `subscribeToGroupThread` pattern — **אבל לתקן את ה-bug**: להוסיף `++channelSeq` suffix לשם ה-channel (כמו `subscribeToUserTable`) כדי לא ליפול ב-StrictMode remount. subscribe לפוסט פתוח (`post_comments` filter `post_id=eq.X`) ולפיד (insert על `posts`).
- **Notification fan-out (CRITICAL):** ה-push הנוכחי ב-`sendGroupMessage` רץ בלולאה client-side — לא scalable לפיד. ליצור edge function חדש `community-notify` (על בסיס `coach-push-send`): מקבל event, קורא את הנמענים (followers / post author / group members) בצד server עם service role, fan-out ב-`Promise.all` עם batching, ומכבד block/mute. ה-client רק מזמין את ה-function (best-effort, never throws).
- **Moderation:** (1) `bad-words`/`leo-profanity` בצד client ל-pre-submit warning (UX בלבד, לא אכיפה); (2) profanity check אמיתי ב-edge function `community-post` לפני INSERT (Hebrew word-list מותאם — הספריות חלשות בעברית, נדרש מילון ידני); (3) `reports` table + תור admin/coach ב-`/coach/moderation` עם actions: hide/remove/warn/ban; (4) block/mute מסננים ב-RLS וב-fan-out.
- **WEB vs NATIVE/Capacitor:**
  - **Web (PWA):** הכל עובד — feed, realtime, Web Push (קיים, `coach-push-send`). תמונות דרך Supabase Storage עם resize ל-webp בצד client (כמו progress-photos).
  - **Native (Capacitor):** share של post דרך `@capacitor/share` (sheet נייטיב); haptics על like/post דרך `@capacitor/haptics`; push נייטיב טוב יותר (אם עוברים ל-RevenueCat/FCM בעתיד — מחוץ ל-scope הזה). העלאת תמונה דרך `@capacitor/camera` במקום `<input type=file>` כש-`Capacitor.isNativePlatform()`. חשוב: אם תהיה שכבת community בתשלום — Apple דורש IAP (Guideline 3.1.1); קהילה חינמית נמנעת מזה.

### מודל נתונים

migrations חדשים תחת `supabase/migrations/`. כל הטבלאות `ENABLE ROW LEVEL SECURITY`, helpers ב-`SECURITY DEFINER` כמו הקיימים.

```sql
-- 20260610000000_community_core.sql
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,         -- 'fitness', 'nutrition'
  name_he TEXT NOT NULL,
  description TEXT,
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- topics readable by all authenticated; insert/update admin-only (service role).

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 5000),
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{path,w,h}] in 'community-media' bucket
  like_count INT NOT NULL DEFAULT 0,               -- denormalized, trigger-maintained
  comment_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_posts_feed ON public.posts(created_at DESC, id) WHERE status='visible';
CREATE INDEX idx_posts_topic ON public.posts(topic_id, created_at DESC) WHERE status='visible';
CREATE INDEX idx_posts_author ON public.posts(author_id, created_at DESC);

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_post ON public.post_comments(post_id, created_at);

CREATE TABLE public.post_reactions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'like' CHECK (kind IN ('like','fire','muscle','clap','heart')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)   -- one reaction per user per post
);

CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

-- 20260610000100_community_moderation.sql  (App-Store BLOCKER)
CREATE TABLE public.user_blocks (         -- I block them: hide their content + DM
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE public.user_mutes (LIKE public.user_blocks INCLUDING ALL); -- mute = hide, no notify

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam','abuse','nudity','hate','self_harm','other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_queue ON public.reports(status, created_at);
```

**RLS (עקרונות):**
- `posts`/`post_comments` SELECT: `status='visible'` ו-author לא ב-`user_blocks`/`user_mutes` של הצופה (subquery `NOT EXISTS`). author רואה גם hidden שלו.
- INSERT: `author_id = auth.uid()` בלבד.
- `post_reactions`/`follows`/`user_blocks`/`user_mutes`: INSERT/DELETE רק על השורה של `auth.uid()`.
- `reports`: INSERT לכל authenticated; SELECT/UPDATE רק ל-admin (service role / coach עם role-check) — דרך edge function או policy על role.
- **counters:** triggers `AFTER INSERT/DELETE` על `post_reactions`/`post_comments` שמעדכנים `like_count`/`comment_count` (אטומי, immutable-friendly).

**(B) קבוצות מאמן — `20260610000200_group_enrich.sql`:**
```sql
ALTER TABLE public.client_groups
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'coach_only'
    CHECK (visibility IN ('coach_only'));   -- future-proof enum, stays closed
CREATE TABLE public.group_pinned (          -- pinned announcements
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.client_groups(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE public.group_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.client_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL, metric TEXT NOT NULL,  -- 'workouts','volume_kg','streak_days'
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE public.challenge_progress (    -- leaderboard rows
  challenge_id UUID NOT NULL REFERENCES public.group_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);
```
RLS: pinned/challenges/progress — coach (owner) מלא, members SELECT דרך `is_group_member(group_id)`; progress INSERT/UPDATE רק על שורת `auth.uid()`.

**rate-limit:** הרחבת `rate_limit_events` (buckets חדשים: `community_post`, `community_comment`, `group_message`) — נאכף ב-edge functions בלבד (service-role write כמו היום).

**Storage:** bucket חדש `community-media` (public-read, 5MB, `image/webp|jpeg|png`) על תבנית `progress-photos`: path `{author_id}/{post_id}/{uuid}.webp`, INSERT/DELETE רק לבעלים, SELECT לכולם (feed ציבורי).

### קבצים

**create (DB / edge):**
- `supabase/migrations/20260610000000_community_core.sql`
- `supabase/migrations/20260610000100_community_moderation.sql`
- `supabase/migrations/20260610000200_group_enrich.sql`
- `supabase/migrations/20260610000300_community_media_storage.sql`
- `supabase/migrations/20260610000400_community_counters_triggers.sql`
- `supabase/migrations/20260610000500_community_rate_limit.sql`
- `supabase/functions/community-notify/index.ts` (fan-out push, block/mute-aware)
- `supabase/functions/community-post/index.ts` (server-side profanity + rate-limit gate before INSERT)

**create (service):**
- `src/services/community/feedService.ts` (listFeed cursor, createPost, deletePost)
- `src/services/community/commentService.ts`
- `src/services/community/reactionService.ts`
- `src/services/community/followService.ts`
- `src/services/community/moderationService.ts` (report/block/mute + admin queue)
- `src/services/community/topicService.ts`
- `src/services/community/realtime.ts` (feed + post subscribe, **with channelSeq**)
- `src/services/community/mappers.ts`
- `src/services/community/mediaService.ts` (resize→webp, upload to community-media)
- `src/services/coach/challengeService.ts` + `src/services/coach/pinnedService.ts`

**create (UI):**
- `src/pages/community/CommunityFeed.tsx`, `PostComposer.tsx`, `PostDetail.tsx`, `TopicFeed.tsx`, `TopicsIndex.tsx`, `UserProfileCard.tsx`, `FollowingList.tsx`
- `src/pages/community/components/{PostCard,CommentList,ReactionBar,ReportSheet,BlockMuteMenu}.tsx`
- `src/pages/coach/CoachModeration.tsx` (admin/coach queue)
- `src/pages/coach/GroupChallenges.tsx`, `src/pages/coach/GroupLeaderboard.tsx`
- `src/pages/legal/CommunityGuidelines.tsx` (EULA/Terms — App-Store BLOCKER)
- `src/types/community.ts`

**modify:**
- `src/App.tsx` — routes `/community`, `/community/topics`, `/community/t/:slug`, `/community/p/:postId`, `/coach/moderation`, `/coach/groups/:groupId` (עמוד קבוצה ייעודי, פער קיים)
- `src/services/coach/realtime.ts` — **fix:** הוספת `++channelSeq` ל-`subscribeToGroupThread`
- `src/services/coach/groupService.ts` — `setGroupMembers` ל-diff (insert חדשים בלבד, לא DELETE+INSERT — מונע איפוס `last_read_at`)
- `src/services/coach/groupMessageService.ts` — fan-out דרך `community-notify` במקום לולאה client-side
- `src/types/coach.ts` — שדות `description`/`avatar`/`visibility` ל-`ClientGroup`; טיפוסי challenge/pinned
- ניווט ראשי (bottom nav / nav component) — טאב "קהילה"

### תלויות וחבילות

- **npm:** `bad-words` או `leo-profanity` (סינון ראשוני; נדרש מילון עברית ידני בנוסף), `linkifyjs` (זיהוי URL בטוח ללא HTML גולמי). `@capacitor/share`, `@capacitor/haptics`, `@capacitor/camera` (תלויים ב-work-stream של Capacitor).
- **native:** אין SDK ייעודי לקהילה; share/haptics/camera הם Capacitor plugins.
- **env/secrets:** מיחזור `VAPID_*`, `ALLOWED_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY` הקיימים ל-edge functions. אין secret חדש.
- **external services:** ללא. אופציונלי לעתיד — שירות moderation מנוהל (לא נדרש ל-MVP; דיווח אנושי + word-list מספיק להגשה ראשונית).

### סיכונים

- **App Store — Guideline 1.2 (UGC) [BLOCKER, CRITICAL]:** feed ציבורי מחייב report (post+user), block, mute, סינון פוגעני, תור הסרה תוך 24ש, EULA שמאושר ע"י המשתמש, ו-published contact (אימייל תלונות גלוי). בלי כולם — דחיית build. קבוצות מאמן הסגורות בסיכון נמוך.
- **עומס תפעולי של moderation:** תור דיווחים דורש מישהו שמטפל; בלי SLA זו חבות. להתחיל עם תור ל-coach/admin + auto-hide אחרי N דיווחים.
- **fan-out לא scalable:** push בלולאה client-side (קיים ב-`sendGroupMessage`) לא מתאים לפיד; חובה edge function עם batching, אחרת תקרת קצב/עלות.
- **עברית בסינון אוטומטי:** ספריות profanity חלשות בעברית — סיכון false-negative; להישען על דיווח אנושי כקו הגנה ראשי.
- **פרטיות/דליפת מידע:** feed ציבורי חושף `display_name`/`avatar`; לוודא שאין דליפת נתוני אימון/בריאות פרטיים. RLS חייב לבדל בין profile ציבורי לנתונים פרטיים.
- **spam/abuse:** rate-limit חובה לפני launch; בלעדיו הפיד מוצף.

### מאמץ והערכה

**XL — ~34 ימי עבודה.** פירוק:
- DB + migrations (6) + triggers + RLS: ~5 ימים
- edge functions (community-notify, community-post + profanity): ~3 ימים
- שכבת service (community/*): ~5 ימים
- UI קהילה (feed, composer, post detail, topics, reactions, comments): ~9 ימים
- moderation (report/block/mute + admin queue + EULA page): ~5 ימים (App-Store critical)
- העשרת קבוצות מאמן (challenges, leaderboard, pinned, group page): ~4 ימים
- תיקוני תשתית קיימת (channelSeq, setGroupMembers diff, fan-out): ~1 יום
- בדיקות (unit+integration ל-RLS+moderation, E2E feed): ~2 ימים

### שלב מומלץ

**Phase 2.** Phase 1 שייך לתשתית הליבה (Capacitor wrapping, payments, role split — חלקם כבר נעשו). הקהילה נשענת על `profiles.role` (קיים) ועל החלטות Capacitor/IAP, ומוסיפה משטח App-Store-critical שדורש policy + EULA. בתוך Phase 2: קודם **העשרת קבוצות מאמן** (סיכון App-Store נמוך, מנוף על תשתית קיימת, ערך מהיר), ואז **קהילת מתאמנים** עם moderation מלא לפני כל הגשה לחנות.

### סקיל לשימוש

- **hebrew-content-writer** — כל copy גלוי: כפתורים, empty states של feed/topics, הודעות report/block, EULA, microcopy של reactions.
- **hebrew-rtl-best-practices** — layout של post cards, comment threads, hashtags מעורבים עברית/אנגלית, mirroring של אייקוני like/share/reply, `dir="auto"` per bubble (כמו ב-`GroupThread`).
- **israeli-accessibility-compliance** — IS 5568 לפיד: aria על reactions, focus management ב-PostComposer ו-ReportSheet, ניווט מקלדת בתור moderation, screen-reader ל-feed דינמי.
- **impeccable / design-taste-frontend** — מעבר UI סופי: היררכיה ויזואלית של feed, מצבי loading/empty/error/success לכל משטח, מניעת "container soup", שמירה על Fresh Steel/Obsidian tokens ו-`.kinetic-number` לספירות.
- **hebrew-document-generator** — אם יידרש ייצוא דו"ח moderation/תלונות כ-PDF (לא ל-MVP).

---

## ניהול העדפות עוגיות ומעקב (Cookies & Tracking Consent)

### מצב נוכחי

המוצר היום הוא PWA טהור ואין בו שום שכבת הסכמה למעקב. הממצאים המאומתים:

- **Sentry מאותחל ללא הסכמה** ב-`src/main.tsx` (שורות 24-41). השומר היחיד הוא `if (sentryDsn)` — כלומר אם `VITE_SENTRY_DSN` מוגדר, `Sentry.init()` רץ ב-cold boot לפני שהמשתמש רואה UI כלשהו. יש `sendDefaultPii: false` ו-`beforeSend` שמנקה `event.extra.data`, אבל זה לא מחליף opt-in.
- **Web Vitals נשלחים ל-Sentry ללא הסכמה**. `initWebVitals()` נקרא ב-`src/main.tsx` שורה 56, והפונקציה ב-`src/services/webVitals.ts` (שורות 21-26) קוראת `Sentry.addBreadcrumb()` בכל אחד מ-CLS/LCP/FCP/TTFB/INP ב-production.
- **שימוש נוסף ב-Sentry**: `src/services/errorReporter.ts` (`Sentry.captureException`), `src/errors/RootErrorBoundary.tsx` ו-`src/errors/PageErrorBoundary.tsx`. כל אלה תלויים ב-Sentry שכבר אותחל — ה-refactor חייב לכסות אותם.
- **eventTracker מקומי, ללא gate**. `src/services/eventTracker.ts` כותב ל-`localStorage` במפתח `sparkos_analytics` ללא בדיקת הסכמה וללא expiry. הוא 100% מקומי (לא נשלח החוצה), ולכן מסווג `analytics` אבל בעדיפות נמוכה יותר מ-Sentry.
- **אין CMP ואין UI הסכמה**: אין `CookieBanner`, אין `ConsentContext`, אין דגל consent ב-Settings, ואין migration רלוונטי ב-`supabase/migrations/`. סקציות ה-Settings הקיימות (`src/pages/settings/sections/{Profile,Notifications,Theme,WorkoutPrefs,Coach,CloudSync,Account,Export,DangerZone,DataAbout,Guidance}Section.tsx`) לא כוללות סקציית פרטיות/מעקב.
- **אין דף מדיניות פרטיות/עוגיות** מלבד `src/pages/AccessibilityStatement.tsx` הקיים.
- **אין שימוש ב-`sessionStorage`** באף מקום בקוד.
- **אדפטר platform מוכן ל-Capacitor**: `src/platform/web.ts` כבר מפשט get/set/removeItem עם `try/catch`, והערת הראש מציינת שתהיה implementation אלטרנטיבית native — נקודת ההרחבה הטבעית ל-`@capacitor/preferences`.
- מוסכמת שמות ה-migrations: `YYYYMMDDHHMMSS_name.sql` (האחרון `20260608000500_coach_edit_columns.sql`).

### מצב יעד

- **Banner ראשון**: באנר הסכמה תחתון (RTL) בעלייה ראשונה, עם שלוש פעולות ברורות — "אשר הכל", "דחה הכל" (שווה-משקל ויזואלי לאישור — חובה תחת GDPR), ו"התאמה אישית". קישור ל-`/privacy` ול-`/cookies`.
- **מרכז העדפות** (`PrivacyConsentSection` ב-Settings) עם שלוש קטגוריות: `strictly-necessary` (תמיד דלוק, נעול), `analytics` (Sentry breadcrumbs + Web Vitals + `eventTracker`), `marketing` (כבוי כברירת מחדל; כרגע ריק — מוכן לעתיד).
- **Consent-Mode gating**: Sentry, Web Vitals ו-`eventTracker` מאותחלים **רק** אחרי opt-in ל-`analytics`. ברירת המחדל לפני בחירה = הכל כבוי חוץ מ-strictly-necessary (opt-in, לא opt-out).
- **GPC**: אם `navigator.globalPrivacyControl === true` — `analytics` ו-`marketing` נכבים אוטומטית ולא נשאלים, עם הודעה במרכז ההעדפות שזוהה אות GPC.
- **רשומת consent מתוגרסת** לכל משתמש/מכשיר: `{ categories, version, ts, locale }`. שינוי `CONSENT_POLICY_VERSION` מפעיל re-prompt אוטומטי (תלות ב-consent-versioning).
- **Offline-first**: ההסכמה נשמרת מיידית מקומית (web: `localStorage`; native: Capacitor Preferences) וממוזגת ל-`consent_records` ב-Supabase כשיש session.
- **Native (Capacitor)**: בשלב 1 ללא cross-app tracking ולכן **ללא ATT** — toסקירת App Store פשוטה יותר. אם בעתיד תתווסף אנליטיקה חוצת-אפליקציות, יתווסף prompt של ATT לפני אתחול אותה אנליטיקה (פירוט בסיכונים).

### גישה טכנית

**המלצה: build first-party, לא Cookiebot/Osano.** הנימוקים: (1) האפליקציה כמעט לא מעמיסה third-party — אין GA/Mixpanel/PostHog (אומת), כך שאין מה ש-CMP חיצוני "יסרוק"; (2) Cookiebot/Osano מזריקים סקריפט צד-שלישי משלהם — אירוניה לבנות consent דרך tracker נוסף, וזה שובר את ה-CSP/offline-first של PWA; (3) RTL עברית — ה-CMPs המסחריים נותנים תרגום בינוני ולא שולטים על ה-design tokens (Fresh Steel/Obsidian); (4) עלות חודשית מתמשכת מיותרת לאפליקציה עם stack telemetry קטן. עלות first-party: ~רכיב Context + באנר + סקציית Settings + טבלה אחת.

**ארכיטקטורת ה-gating (הליבה):**

1. `src/services/consent/consentState.ts` — SSOT ל-state: טיפוס `ConsentState = { necessary: true; analytics: boolean; marketing: boolean; version: string; ts: number; locale: string; gpc: boolean }`. קריאה/כתיבה דרך `webPlatform`/Capacitor Preferences. מפתח: `sparkos_consent_v1`.
2. `src/contexts/ConsentContext.tsx` — Provider שחושף `consent`, `updateConsent(partial)`, `acceptAll()`, `rejectAll()`, `hasDecided`, `needsReprompt`. עוטף את האפליקציה ב-`src/App.tsx`.
3. **Refactor של `src/main.tsx`**: מסירים את `Sentry.init` ואת `initWebVitals()` מה-top-level ומעבירים ל-`src/services/consent/applyConsent.ts` עם `initAnalyticsStack()` ש-(א) נקראת רק אם `analytics === true`, (ב) idempotent (לא לאתחל פעמיים), (ג) קוראת `Sentry.init` ואז `initWebVitals`. ב-cold boot קוראים ל-`applyConsentFromStorage()` — אם כבר יש הסכמת analytics שמורה, מאתחלים מיד; אחרת ממתינים לבאנר. `errorReporter.ts` חייב לבדוק שה-client מאותחל (Sentry no-op אם לא) — נוסיף guard `isAnalyticsEnabled()` לפני `captureException`.
4. `eventTracker.trackEvent/trackPageView` יקבלו guard מוקדם: `if (!isCategoryEnabled('analytics')) return;`.
5. **GPC**: ב-`consentState.ts` בקריאה ראשונה — אם `navigator.globalPrivacyControl` true, מאלצים `analytics=false, marketing=false`, מסמנים `gpc=true`, ולא מציגים את הבאנר אלא הודעת "כובד אות GPC".
6. **versioning + re-prompt**: `CONSENT_POLICY_VERSION` כקבוע SSOT (מגיע מ-consent-versioning). אם `stored.version !== CONSENT_POLICY_VERSION` → `needsReprompt=true` → באנר עולה שוב; ההסכמה הישנה נשמרת לאודיט עד החלפה.

**WEB path**: persistence ב-`localStorage` דרך `webPlatform`. סנכרון ל-Supabase ב-`upsertConsentRecord()` כשיש auth session (merge: server-side רשומה אחת אחרונה per (user_id, version), אך שומרים היסטוריה append-only — ראו מודל נתונים).

**NATIVE/Capacitor path**: persistence דרך `@capacitor/preferences` (שורד reinstall של WebView יותר טוב מ-localStorage). אדפטר חדש `src/platform/native.ts` שמממש את `PlatformAdapter`. **ATT**: בשלב 1 אין cross-app tracking → אין prompt. נוסיף stub `requestTrackingPermission()` ב-`src/services/consent/att.ts` שב-web הוא no-op, ובנייטיב (אם בעתיד) קורא ל-`@capacitor-community/app-tracking-transparency` **לפני** הפעלת analytics — ורק אם המשתמש גם נתן opt-in ב-banner וגם ATT=authorized.

### מודל נתונים

טבלה append-only לאודיט הסכמות (רשומה לכל החלטה, לא mutate):

```sql
-- supabase/migrations/20260609000000_consent_records.sql
create table public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  device_id    text not null,              -- anon UUID for pre-auth / per-device
  categories   jsonb not null,            -- {"necessary":true,"analytics":bool,"marketing":bool}
  policy_version text not null,            -- mirrors CONSENT_POLICY_VERSION SSOT
  source       text not null default 'banner', -- 'banner' | 'preferences' | 'gpc'
  gpc          boolean not null default false,
  locale       text not null default 'he',
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index consent_records_user_idx   on public.consent_records(user_id, created_at desc);
create index consent_records_device_idx on public.consent_records(device_id, created_at desc);

alter table public.consent_records enable row level security;

-- user reads/inserts only their own rows; rows are immutable (no update/delete policy)
create policy consent_select_own on public.consent_records
  for select using (auth.uid() = user_id);
create policy consent_insert_own on public.consent_records
  for insert with check (auth.uid() = user_id);
-- NOTE: deliberately no UPDATE/DELETE policy → append-only audit trail.
-- account deletion cascades via on delete cascade.
```

הערות: שומרים append-only (כל החלטה = שורה) כדי שתהיה ראיה מתוגרסת לרגולטור. ה"מצב הנוכחי" נקרא תמיד מהמכשיר (localStorage/Preferences); השרת הוא אודיט + סנכרון בין מכשירים. עמודת `device_id` מאפשרת רשומה גם לפני auth (anon UUID נשמר מקומית). יש ליישר עם `security_rls_hardening` ו-`harden_function_search_path` הקיימים. את ה-purge יש לחבר ל-`deleteAllUserData` (ראו קבצים).

### קבצים

**create:**
- `src/contexts/ConsentContext.tsx` — Provider + hook `useConsent()`.
- `src/services/consent/consentState.ts` — קריאה/כתיבה מקומית + GPC + version check.
- `src/services/consent/applyConsent.ts` — `initAnalyticsStack()` / `applyConsentFromStorage()` (idempotent).
- `src/services/consent/consentSync.ts` — `upsertConsentRecord()` ל-Supabase.
- `src/services/consent/att.ts` — stub ATT (web no-op; native hook).
- `src/services/consent/policyVersion.ts` — `CONSENT_POLICY_VERSION` SSOT (משותף עם consent-versioning).
- `src/components/consent/CookieBanner.tsx` — הבאנר (RTL, tokens, 3 כפתורים, focus-trap).
- `src/components/consent/ConsentToggleRow.tsx` — שורת קטגוריה (toggle + תיאור).
- `src/pages/settings/sections/PrivacyConsentSection.tsx` — מרכז ההעדפות ב-Settings.
- `src/pages/Privacy.tsx` + `src/pages/CookiePolicy.tsx` — דפי מדיניות (routes `/privacy`, `/cookies`).
- `src/platform/native.ts` — אדפטר Capacitor Preferences.
- `supabase/migrations/20260609000000_consent_records.sql` — הטבלה לעיל.
- בדיקות: `src/services/consent/__tests__/consentState.test.ts`, `applyConsent.test.ts` (gating), `consentSync.test.ts`.

**modify:**
- `src/main.tsx` — להסיר `Sentry.init` (24-41) ו-`initWebVitals()` (56) מה-top-level; לקרוא `applyConsentFromStorage()` במקום.
- `src/services/webVitals.ts` — לוודא שלא ירוץ אלא דרך `initAnalyticsStack`.
- `src/services/errorReporter.ts` — guard `isAnalyticsEnabled()` לפני `captureException`.
- `src/services/eventTracker.ts` — early-return guard בקטגוריית analytics.
- `src/App.tsx` — לעטוף ב-`ConsentProvider`, להוסיף routes `/privacy` + `/cookies`, ולרנדר `<CookieBanner/>`.
- `src/pages/Settings.tsx` — לייבא ולרנדר `PrivacyConsentSection` תחת "06 פרטיות ונתונים".
- `src/services/settingsService.ts` (`deleteAllUserData`) + `DangerZoneSection` flow — לכלול ניקוי `sparkos_analytics` ומפתח ה-consent המקומי.
- `src/pages/settings/sections/ExportSection.tsx` — לכלול את רשומות ה-consent בייצוא הנתונים (DSAR).
- `.env.example` — תיעוד שה-`VITE_SENTRY_DSN` עכשיו מאחורי consent.

### תלויות וחבילות

- **npm**: אין צורך בספרייה חדשה ל-web (first-party). הקיימים מספיקים (`@sentry/react`, `web-vitals`).
- **native (Capacitor)**: `@capacitor/preferences` (persistence עמיד), ובעתיד-בלבד `@capacitor-community/app-tracking-transparency` (ATT — להתקין רק כשתתווסף אנליטיקה חוצת-אפליקציות).
- **env/secrets**: `VITE_SENTRY_DSN` (קיים) — ללא חדש. אין סוד חדש.
- **external services**: ללא Cookiebot/Osano (החלטה מודעת). Supabase קיים (טבלה + RLS).
- **iOS Info.plist (עתידי, native+ATT בלבד)**: `NSUserTrackingUsageDescription` בעברית.
- **Google Play**: לעדכן Data Safety form בעת הגשה לחנות (גם ללא ATT).

### סיכונים

- **משפטי (CRITICAL)**: כל עוד Sentry/Web-Vitals מאתחלים לפני opt-in — חשיפה תחת GDPR ותחת חוק הגנת הפרטיות הישראלי (תיקון 13). ה-refactor של `main.tsx` הוא load-bearing: אם מפספסים את `errorReporter.ts` או את ה-ErrorBoundaries, telemetry ידלוף בכל זאת. חובה בדיקת gating אוטומטית.
- **GPC (HIGH)**: כיבוד שגוי של `navigator.globalPrivacyControl` = הפרה בכמה מדינות בארה"ב. צריך טסט מפורש.
- **App Store / ATT (MEDIUM)**: בשלב 1 ללא cross-app tracking → אין ATT וזה תקין. ברגע שתתווסף אנליטיקה חוצת-אפליקציות תחת iOS — Apple מחייבת ATT prompt + `NSUserTrackingUsageDescription`, ואי-עמידה = דחייה לפי Guideline 5.1.2(i). הבאנר עצמו אינו עילה לדחייה. Google Play דורש Data Safety מעודכן בכל מקרה.
- **סנכרון offline (MEDIUM)**: merge בין מכשירים חייב לכבד את ההחלטה האחרונה ולא לדרוס opt-out מאוחר ב-opt-in ישן. פתרון: append-only + "האחרון לפי created_at קובע" per device, וברירת מחדל מחמירה (כבוי) בקונפליקט.
- **PWA persistence (LOW)**: localStorage עלול להימחק ב-iOS Safari (ITP, 7 ימים ללא שימוש) → המשתמש יישאל שוב. ב-native זה נפתר עם Capacitor Preferences.

### מאמץ והערכה

**L — כ-9 ימי עבודה.** פירוט:
- Context + consentState + GPC + versioning wiring: ~2 ימים.
- Refactor `main.tsx`/Sentry/webVitals/errorReporter מאחורי gating + טסטים: ~2 ימים (החלק הרגיש ביותר).
- `CookieBanner` + `PrivacyConsentSection` (RTL, tokens, a11y, 4 מצבי UI): ~1.5 ימים.
- דפי `Privacy`/`CookiePolicy` + קופי עברי: ~1 יום.
- migration `consent_records` + RLS + `consentSync` + חיבור export/purge: ~1.5 ימים.
- אדפטר native + stub ATT (ללא prompt חי): ~1 יום.

### שלב מומלץ

**שלב 1.** זו תשתית compliance חוסמת: כל פיצ'ר מעקב/אנליטיקה/פרסום עתידי (וגם אינטגרציית התשלומים שתוסיף telemetry של חיוב) חייב לשבת מאחורי שכבת ההסכמה הזו. בנוסף, הפער הנוכחי (Sentry לפני opt-in) הוא חשיפה משפטית פעילה כבר היום, ולכן לא נכון לדחות. תלוי ב-consent-versioning (SSOT לגרסה + re-prompt) ובקיום דפי `/privacy` + `/cookies` — שניהם קלים ויכולים להיכלל באותו שלב.

### סקיל לשימוש

- **hebrew-content-writer** — לכל הקופי הנראה: טקסט הבאנר, שמות/תיאורי הקטגוריות, כפתורים, מצבי empty/error, ותוכן דפי `/privacy` + `/cookies` (עברית תקנית, נכונה דקדוקית).
- **hebrew-rtl-best-practices** — פריסת הבאנר והטוגלים ב-RTL (logical properties, מיקום כפתורים, מספרים/אנגלית מעורבים).
- **israeli-accessibility-compliance** — הבאנר חייב להיות נגיש (focus-trap, מקלדת, NVDA/VoiceOver, ARIA ל-toggles) לפי IS 5568; באנר הסכמה הוא נקודת a11y רגישה.
- **impeccable / design-taste-frontend** — ליטוש ויזואלי של הבאנר ומרכז ההעדפות בהתאם ל-Fresh Steel/Obsidian (tokens, container nesting ≤ 2, ללא slop), ובדיקת light+dark.
- **hebrew-document-generator** — אופציונלי, אם רוצים לייצא רשומת consent/DSAR כ-PDF עברי למשתמש.

---

## עמוד הצהרת נגישות מסודר (IS 5568 + WCAG 2.x AA)

### מצב נוכחי

קיים עמוד הצהרת נגישות יחיד ב-`src/pages/AccessibilityStatement.tsx` (~239 שורות). הוא בנוי כ-`<article>` עם ארבעה `<section>`: "מחויבות לנגישות", "אמצעי נגישות מיושמים", "מגבלות נגישות ידועות", "פנייה בנושא נגישות", ושורת "תאריך עדכון אחרון". העמוד תקין מבחינת `dir="rtl"`, `lang="he"`, ושימוש בטוקנים (`var(--fs-*)`).

הבעיות שזוהו (מבוססות EXPLORE FINDINGS, לא מומצאות):
- **קיר התחברות (חמור משפטית):** ה-route מוגדר ב-`src/App.tsx` שורות 565–571 בתוך `AppRoutes`, שמרונדר רק אחרי auth+onboarding (`src/App.tsx` שורות 296–320). משמע — **משתמש לא מחובר אינו יכול להגיע להצהרה**. IS 5568 / תקנות 2013 דורשות שההצהרה תהיה נגישה לציבור הרחב.
- **נקודת כניסה יחידה:** הקישור היחיד נמצא בתחתית `src/pages/Settings.tsx` שורות 181–201 (`<Link to="/accessibility">`). אין footer בפרויקט (grep ל-`footer`/`Footer` החזיר רק Sheet/modal/form), אין קישור מ-BottomNav, מ-onboarding או מ-Login.
- **placeholders שלא נסגרו:** `// TODO` בשורה 182 (מגבלות ידועות — bullet גנרי אחד על גרפים), `// TODO` בשורה 201 (שם רכז נגישות = "SparkOS Fitness", לא אדם אמיתי כנדרש בחוק).
- **תאריך עדכון hardcoded:** שורה 234 `"5 ביוני 2026"` כמחרוזת קבועה, ללא מנגנון versioning.
- **אין הצהרת רמת תאימות** (full / partial / not evaluated) בפורמט WCAG-EM.
- **אין React import:** `React.CSSProperties` בשורות 15–58 בלי `import React`. תקין עם JSX transform חדש אבל שביר; כדאי לתקן בעת הריפקטור.
- **חוסר ב-`PATH_ACCENT_MAP`:** `/accessibility` רשום ב-`PATH_LABEL_MAP` (`src/App.tsx` שורה 163) אך לא ב-`PATH_ACCENT_MAP` (שורה 137), ולכן יורש accent ברירת-מחדל.
- **אין כפתור חזרה / `<nav>` landmark** בתוך העמוד.

נתוני סביבה רלוונטיים שכן קיימים (לטובת רשימת התיקונים שמגבה את ההצהרה): skip-link כבר קיים ב-`src/App.tsx` שורות 689–690 וב-`src/pages/Login.tsx` שורות 72–73; `id="main-content"` קיים (`src/App.tsx` שורה 708); `role="main"` קיים בכמה מסכי workout.

### מצב יעד

הצהרת נגישות מקצועית, **מתוארכת וגרסאית**, נגישה גם ללא התחברות, ומגובה בתיקונים אמיתיים. מבנה היעד (סדר סעיפים לפי IS 5568 + WCAG-EM):

1. **כותרת + מטא:** שם הגוף, גרסת ההצהרה (`v1.0`), תאריך פרסום, תאריך ביקורת אחרונה.
2. **היקף ההצהרה (scope):** האפליקציה כולה (PWA) + אם נעטף ב-Capacitor — האפליקציות הנייטיב ב-App Store / Google Play. ציון מפורש של פלטפורמות ודפדפנים שנבדקו.
3. **רמת תאימות (conformance):** "תואם חלקית" (partially conformant) ל-IS 5568 המעוגן ב-WCAG 2.0 AA, עם שאיפה ל-2.1 AA. ניסוח כן — לא "תואם מלא".
4. **אמצעי נגישות מיושמים** (מורחב מהקיים, מגובה בקוד אמיתי).
5. **מגבלות נגישות ידועות** (אמיתיות, לא placeholder — ראו רשימת תיקונים למטה).
6. **נתיב גישה חלופי (alternative-access):** איך לקבל את השירות/המידע בערוץ אחר אם משהו לא נגיש (דוא"ל/טלפון לרכז, מענה אנושי).
7. **רכז/ת נגישות:** שם מלא אמיתי + תפקיד + דוא"ל + טלפון + ערוץ משוב; זמן מענה לפי תקנות (עד 60 ימי עסקים).
8. **תאריך ביקורת/עדכון אחרון** ממקור נתונים אחד (לא hardcoded פעמיים).

נגישות העמוד עצמו: route ציבורי (לפני קיר ההתחברות), קישור קבוע מ-footer גלובלי + Settings + Login + שלב onboarding, כפתור/`<nav>` חזרה, רישום ב-`PATH_ACCENT_MAP`.

### גישה טכנית

**1. הוצאת ה-route מחוץ לקיר ההתחברות.** ב-`src/App.tsx`, להפוך את `/accessibility` (ואת `/accessibility` בלבד, יחד עם `/privacy`/`/terms` אם ייווצרו) ל-route ציבורי שמרונדר בכל אחד משלושת הענפים (`unauthenticated` → `<Login>`, `!onboardingDone` → `<OnboardingFlow>`, וה-`AppShell`). הדרך הנקייה: לעטוף את שלושת הענפים ב-`<BrowserRouter>` משותף ולהוסיף route ציבורי `/accessibility` שמרונדר תמיד, לפני ה-`Navigate`/short-circuit. אם הריפקטור של `BrowserRouter` רחב מדי לשלב זה — חלופה מינימלית: לרנדר `<AccessibilityStatement>` ישירות בענף ה-`unauthenticated` כאשר `pathname === '/accessibility'` (קריאת `window.location.pathname`).

**2. תוכן מבוסס-נתונים (versioned).** ליצור `src/content/accessibility.ts` — מקור נתונים יחיד (SSOT) עם: `version`, `publishedAt`, `lastReviewedAt`, `conformanceLevel`, `coordinator` (שם/תפקיד/דוא"ל/טלפון), `scope`, `accommodations[]`, `knownLimitations[]`. העמוד צורך את הקובץ — מסיר את שתי ה-placeholders ואת התאריך ה-hardcoded. כך תאריך הביקורת מתעדכן במקום אחד.

**3. ניסוח Hebrew מקצועי.** כל הקופי (סעיפי חובה, רמת תאימות, נתיב חלופי, זמני מענה) ייכתב/יעבור הגהה דרך **hebrew-content-writer** — דקדוק, smichut, register משפטי-נגיש. כל מספר/דוא"ל/טלפון ב-`dir="ltr"`, מונחים לועזיים (WCAG, NVDA) ב-`<span dir="ltr" lang="en">`.

**4. נקודות כניסה.** ליצור רכיב footer גלובלי `src/components/layout/AppFooter.tsx` (לא קיים היום) עם `role="contentinfo"` וקישור "הצהרת נגישות" — לרנדר אותו ב-`AppShell` ובמסכים ציבוריים (Login). להוסיף קישור גם בתחתית `OnboardingFlow`/`WelcomeStep`. להשאיר את הקישור הקיים ב-Settings.

**5. נגישות העמוד עצמו.** להוסיף `<nav aria-label="ניווט בעמוד">` עם כפתור חזרה (`onClick={() => navigate(-1)}` עם fallback ל-`/`), `aria-label` עברי; להוסיף `PATH_ACCENT_MAP` entry ל-`/accessibility`; לוודא `<main role="main" id="main-content">` והיררכיית כותרות `h1→h2`.

**6. WEB vs NATIVE/Capacitor.** ב-PWA הנוכחי זו עבודת React טהורה. **כאשר ייעטף ב-Capacitor:** (א) ההיקף בהצהרה חייב לכלול את אפליקציות הנייטיב; (ב) קוראי מסך נייטיב (VoiceOver iOS / TalkBack Android) צריכים בדיקה נפרדת — ה-WebView לא תמיד מעביר ARIA כמו דפדפן; (ג) "נתיב גישה חלופי" חייב לעבוד גם offline (כתובת דוא"ל/טלפון קבועים, לא תלויי רשת); (ד) קישור "הצהרת נגישות" ב-App Store/Play listing (metadata) בנוסף לתוך האפליקציה.

**רשימת תיקוני a11y שההצהרה חייבת להיות מגובה בהם (כדי שתהיה אמיתית):**
- **Skip-link בכל מסך מאומת:** קיים ב-Login וב-AppShell; לוודא שכל page-shell מאומת מצביע ל-`#main-content` קיים (יש מסכי workout עם `role="main"` אך לא תמיד `id="main-content"`).
- **חלופות טקסטואליות לגרפים/תרשימים:** היום זו המגבלה היחידה שמוצהרת. לפני שמסירים אותה מ"מגבלות" — להוסיף `aria-label`/טבלת נתונים נגישה לכל chart (progress charts, stats). אם לא מתוקן — להשאיר כמגבלה אמיתית ומפורטת.
- **צבעי ניגודיות 4.5:1** מאומתים בפועל (יש היסטוריית תיקוני contrast ב-MEMORY) — לתעד תוצאת lighthouse/axe אמיתית לפני הצהרת "עומד".
- **תוויות עבריות לכל הכפתורים icon-only** — audit מהיר עם **israeli-accessibility-compliance**.
- **prefers-reduced-motion** מכובד (framer-motion + gsap) — לאמת שאין אנימציה שמתעלמת.
- **ניהול focus במודלים/Sheets** (focus-trap, initialFocus) — קיים תיקון היסטורי; לאמת שעדיין תקין.
- **הודעות שגיאה עבריות עם `role="alert"`** בכל הטפסים (onboarding, nutrition).
- **בדיקת קורא מסך אמיתית** (NVDA + VoiceOver iOS) לפני הצהרת רמת תאימות — אחרת ההצהרה כוזבת.

### מודל נתונים

אין צורך בטבלאות/RLS/migrations — התוכן הוא קוד סטטי, לא נתוני משתמש. מקור הנתונים הוא קובץ TypeScript:

```ts
// src/content/accessibility.ts
export interface AccessibilityCoordinator {
  fullName: string;       // שם אמיתי — חובה חוקית (סוגר את TODO שורה 201)
  title: string;          // למשל "רכז נגישות"
  email: string;
  phone?: string;         // dir="ltr"
}
export interface AccessibilityStatementContent {
  version: string;            // "1.0"
  publishedAt: string;        // ISO date
  lastReviewedAt: string;     // ISO date — מקור יחיד לתאריך
  conformanceLevel: 'full' | 'partial' | 'none';
  conformanceTarget: 'IS 5568 / WCAG 2.0 AA';
  scope: string;              // PWA + (עתידי) native apps
  accommodations: string[];   // אמצעים מיושמים
  knownLimitations: string[]; // אמיתי — סוגר TODO שורה 182
  alternativeAccess: string;  // נתיב גישה חלופי
}
```

(אם בעתיד רוצים versioning היסטורי מוצג למשתמש — מערך `versions[]` באותו קובץ; עדיין ללא DB.)

### קבצים

- **create:** `src/content/accessibility.ts` — SSOT לתוכן ההצהרה (גרסה, תאריכים, רכז, מגבלות, נתיב חלופי).
- **create:** `src/components/layout/AppFooter.tsx` — footer גלובלי `role="contentinfo"` עם קישור הצהרת נגישות (אין footer בפרויקט היום).
- **modify:** `src/pages/AccessibilityStatement.tsx` — צריכת ה-SSOT; הוספת סעיפי scope/conformance/alternative-access; כפתור חזרה + `<nav aria-label>`; הסרת שתי ה-placeholders והתאריך ה-hardcoded; הוספת `import React` (או החלפת הסגנונות ב-CSS module).
- **modify:** `src/App.tsx` — route ציבורי ל-`/accessibility` לפני קיר ההתחברות; הוספת entry ל-`PATH_ACCENT_MAP` (שורה ~137); רינדור `<AppFooter>` ב-AppShell.
- **modify:** `src/pages/Login.tsx` — קישור "הצהרת נגישות" (footer / מתחת לטופס).
- **modify:** `src/pages/OnboardingFlow.tsx` (או `src/pages/onboarding/steps/WelcomeStep.tsx`) — קישור להצהרה בתחתית השלב.
- **modify:** `src/pages/Settings.tsx` — להשאיר את הקישור הקיים (שורות 181–201); ליישר ניסוח עם ה-SSOT.

### תלויות וחבילות

- **npm:** אין תלות חדשה חובה. אופציונלי ל-CI: `@axe-core/playwright` (אם מריצים בדיקת a11y אוטומטית ב-e2e). הסקריפט שב-skill (`audit_a11y.py`) משתמש ב-selenium+axe-core — לא חובה לשלב בקוד.
- **native (Capacitor, עתידי):** אין plugin ייעודי לנגישות; הבדיקה ידנית עם VoiceOver/TalkBack על ה-WebView.
- **env/secrets:** אין.
- **שירותים חיצוניים:** אין. נדרש קלט מהבעלים (לא טכני): שם מלא + תפקיד + טלפון של רכז הנגישות (חובה חוקית), ותוצאות ביקורת a11y אמיתית (axe/lighthouse + בדיקת קורא מסך) שעליה תישען הצהרת רמת התאימות.

### סיכונים

- **משפטי (גבוה):** הצהרה כוזבת גרועה מאי-הצהרה. אם מצהירים "תואם" בלי ביקורת אמיתית — חשיפה לתביעה אזרחית עד 50,000 ₪ ללא הוכחת נזק + עיצום מנהלי. **מיטיגציה:** ניסוח "תואם חלקית" + תקופת ריפוי 60 יום נשענת על רכז זמין; לבסס כל אמצעי על קוד אמיתי לפני שמוחקים אותו מ"מגבלות".
- **שם רכז placeholder (גבוה):** התקנות דורשות אדם נקוב ונגיש. אסור לפרסם עם "SparkOS Fitness". **חוסם פרסום** עד קבלת שם אמיתי מהבעלים.
- **קיר ההתחברות:** הוצאת route מחוץ ל-auth — לוודא שלא נפתחת דליפת נתונים/route אחר בטעות (העמוד סטטי, אין סיכון נתונים).
- **Capacitor / App Store:** Apple ו-Google מצפים לקישור נגישות/פרטיות ב-listing; היעדרו עלול לעכב review. ה-WebView עלול לא להעביר ARIA כמו דפדפן — הצהרת "תומך בקורא מסך" חייבת בדיקה נייטיב נפרדת לפני wrap.
- **חוב placeholder:** ה-`// TODO`-ים קיימים בקוד שכבר מוצג — סיכון שיודלף לפרודקשן כפי שהוא.

### מאמץ והערכה

**מאמץ: M** — ~3 ימי עבודה.
- יום 1: SSOT (`accessibility.ts`) + ריפקטור `AccessibilityStatement.tsx` (סעיפי חובה, כפתור חזרה, הסרת placeholders/תאריך).
- יום 2: route ציבורי ב-`App.tsx` + `AppFooter.tsx` + קישורים מ-Login/Onboarding/Settings + `PATH_ACCENT_MAP`.
- יום 3: audit a11y אמיתי (axe/lighthouse + סבב NVDA/VoiceOver), ניסוח Hebrew סופי, סגירת מגבלות אמיתיות, בדיקת light/dark + RTL.
- *לא כלול בהערכה:* תיקוני ה-a11y העמוקים שמגבים את ההצהרה (חלופות לגרפים, audit מלא) — אם נדרשים מאפס, +2–4 ימים. *תלוי קלט בעלים:* שם רכז.

### שלב מומלץ

**שלב 1.** זו חובה חוקית בסיסית עם חשיפה כספית (עד 50,000 ₪ + עיצום), ה-route הציבורי והסרת ה-placeholders הם תנאי סף לפרסום/ל-App Store review. עלות נמוכה-בינונית, ערך/סיכון גבוה. תיקוני ה-a11y העמוקים יכולים להתפרס על שלב 2, אך ההצהרה עצמה (מנוסחת בכנות כ"תואם חלקית") ונקודות הכניסה — שלב 1.

### סקיל לשימוש

- **israeli-accessibility-compliance** — סעיפי החובה של ההצהרה (scope/conformance/coordinator/alternative-access), בדיקת IS 5568, ורשימת תיקוני ה-a11y שמגבים אותה; הרצת `scripts/audit_a11y.py` ל-audit.
- **hebrew-content-writer** — ניסוח/הגהה של כל הקופי המשפטי-נגיש בעברית תקנית.
- **hebrew-rtl-best-practices** — וידוא bidi נכון (מספרים/דוא"ל/מונחים לועזיים ב-`dir="ltr"`, logical properties).
- **impeccable / design-taste-frontend** — ליטוש ה-footer והעמוד (היררכיה, light/dark, focus visible) בלי לשבור את Fresh Steel / Obsidian.
