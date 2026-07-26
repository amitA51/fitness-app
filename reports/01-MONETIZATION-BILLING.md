<div dir="rtl">

# דוח מוכנות למסחור, מנויים וגבייה — SparkOS Fitness

**תאריך הבדיקה:** 26.07.2026  
**היקף:** קוד מקור פעיל בלבד (`src/**`, `supabase/**`, בדיקות פעילות), ללא הסתמכות על מסמכי תכנון ישנים. בדיקות סביבת פרודקשן, סודות, חשבון ספק סליקה, סטטוס פריסת המיגרציות ועמידת העסק ברגולציה הן **לא מאומתות**.  
**כלל ראיות:** כל ממצא קוד מפנה ל־`file:line` שנקרא. מקורות שוק חיצוניים מסומנים ככאלה ואינם ייעוץ משפטי או מס.

## תקציר מנהלים

- אין כיום מסלול מכירה: `PaywallScreen` קורא רק ל־`joinWaitlist`, מציג שהפרימיום “יושק בקרוב”, ואין בו בחירת מחיר, `checkout`, הצלחה או ביטול רכישה. קיימת טבלת אירועי webhook מתוכננת, אך לא נמצא מימוש webhook/checkout בעץ פונקציות המקור שנבדק. ראו `src/pages/billing/PaywallScreen.tsx:16, 252–265, 475, 485`; `supabase/migrations/20260610000100_entitlements.sql:4, 27–48`.
- תשתית זכאות צרכנית קיימת ואבטחתית, אך היא אינה נאכפת בפיצ'רים: ששת `PREMIUM_FEATURES` מוגדרים, `PlanGate` ו־`PremiumLock` קיימים, אך בחיפוש רוחב המקור לא נמצאו צרכני פיצ'ר שמעטפים אותם; במפורש, endpoint ה־AI בודק משתמש וקצב בלבד, לא זכאות. ראו `src/services/billing/types.ts:31–44`; `src/contexts/EntitlementContext.tsx:7–8, 92–101`; `src/components/billing/PremiumLock.tsx:206–214`; `src/services/ai/core.ts:193`; `supabase/functions/ai-chat/index.ts:307–314`.
- הבטחת ה־free tier “עד 3” תבניות אינה מיושמת: יצירה, שכפול ושמירה מקומית כותבים ישירות ללא ספירה או בדיקת entitlement. ראו `src/pages/billing/PaywallScreen.tsx:53`; `src/services/templateDb.ts:47–68`; `src/pages/templates/hooks/useTemplates.ts:71, 116–129`.
- למאמנים יש מודל טכני של תוכניות ומושבים, כולל אכיפה במסד והזמנות מאובטחות, אך אין catalogue, מחיר, upgrade, חיוב, חשבונית או customer portal. מסך המושבים רק אומר “יש לשדרג”. ראו `supabase/migrations/20260529000000_coach_platform.sql:154–157, 209–238`; `src/services/coach/relationshipService.ts:64–101`; `src/pages/coach/CoachInvites.tsx:161`.
- מסמכי תנאים/פרטיות קיימים ומוצגים ציבורית, אך שלושתם מסומנים `isDraft: true`; סעיף התשלום כללי בלבד ותנאי המאמנים אינם מחוברים למסלול ציבורי. אי אפשר להשיק תשלום בישראל לפני אישור משפטי/מס והשלמת מדיניות ביטול, החזר, מסמכים ופרטי הסוחר. ראו `src/content/legal/legalDocs.ts:57, 109–111, 152, 228–235`; `src/pages/legal/LegalDocPage.tsx:133`; `src/AppRouter.tsx:87–88, 270–271, 573–584`.

## חסמים חוסמי־פרודקשן (P0)

| מה חסר | היכן (file:line) | השפעה | מה נדרש |
|---|---|---|---|
| **מסלול רכישה אמיתי ו־webhook מאומת.** ה־CTA היחיד הוא waitlist; מסך הפרימיום משנה מצב ל־`joined`, ולא יוצר `checkout` או subscription. המיגרציה כבר מניחה שכתיבה ל־entitlements תגיע מ־webhook/service role, אך זו תשתית ללא receiver. | `src/pages/billing/PaywallScreen.tsx:16, 252–265, 475, 485`; `src/services/billing/waitlistService.ts:23–42`; `supabase/migrations/20260610000100_entitlements.sql:4, 15–48`; פונקציות המקור הקיימות מתחילות ב־`supabase/functions/coach-invite-accept/index.ts:47`, `reminders-dispatch/index.ts:89`, `ai-chat/index.ts:296`, `coach-push-send/index.ts:51`. | אין אפשרות לקבל כסף, לא ניתן לאמת תשלום, לטפל בחידוש/כשל/ביטול/החזר או להעניק זכאות אמינה. היעדר פונקציה לא מנוהלת מחוץ ל־repo הוא **לא מאומת**. | לבחור ספק ו־merchant model; להוסיף `billing-create-checkout`, `billing-webhook`, portal/cancel/reconcile; לאמת חתימת webhook על raw body; לעדכן entitlement רק בשרת ובאופן idempotent. |
| **אכיפת כל ששת הפיצ'רים בתשלום, ובפרט AI יקר.** הרשימה כוללת `advanced_progress`, `ai_coach`, `unlimited_templates`, `progress_photos`, `cloud_sync`, `data_export`; `PlanGate` מוגדר כ־UX-only, והעטיפה `PremiumLock` אינה מוכיחה שימוש בפיצ'ר כלשהו. הלקוח מזמן `ai-chat`, והשרת עוצר רק על auth/rate-limit לפני ספק ה־AI. | `src/services/billing/types.ts:31–44`; `src/contexts/EntitlementContext.tsx:7–8, 92–101`; `src/components/billing/PremiumLock.tsx:206–214`; `src/services/ai/core.ts:193`; `supabase/functions/ai-chat/index.ts:121–135, 307–314`. | משתמש חינמי יכול לקבל יכולות שעליהן נגבה כסף; במקרה AI זו גם דליפת עלות ספק. אין להסתמך על UI או על local state לאכיפת זכות מסחרית. | למפות כל פיצ'ר לנקודת אכיפה: `has_feature_access()` בשרת ל־AI/Storage/Sync, RPC או RLS לנתוני ענן, ו־`PlanGate`/מצבי UX כנגזרת בלבד. להחזיר `premium_required` עקבי (לא grant מקומי). |
| **אכיפת מגבלת 3 תבניות חינמיות.** דף המכירה מבטיח “עד 3”, אך `createWorkoutTemplate` בונה אובייקט וכותב ל־IndexedDB, ונתיבי create/duplicate קוראים אליו בלי ספירה. קיימים גם נתיבי שמירת־תבנית מתוך סיכום אימון. | `src/pages/billing/PaywallScreen.tsx:53`; `src/services/templateDb.ts:47–68`; `src/pages/templates/hooks/useTemplates.ts:71, 116–129`; `src/components/workout/active/WorkoutSummaryView.tsx:72, 90`; `src/components/workout/components/WorkoutActions.tsx:156, 162`. | הבטחת מוצר שגויה, עקיפת paywall קלה, ותסכול כשניסיון לסגור את הפרצה נעשה רק ב־UI. | חסימה דו־שכבתית: pre-check מקומי לכל נקודות היצירה + trigger/RPC שרתי אטומי בזמן sync שמחריג `isProgramHidden`, מאפשר עדכון של קיימת ומחזיר קוד `free_template_limit_reached`. להגדיר UX להתנגשויות offline. |
| **מודל מכירה למאמנים.** `coach_subscriptions` יודע plan ו־`seat_limit`; אכיפת מושבים קיימת, אך שירות הלקוח רק קורא את השורה וה־UI מציג הודעת upgrade ללא יעד. העלאת תוכנית/mושבים חסומה בצד לקוח בכוונה ותלויה ב־service role/webhook. | `supabase/migrations/20260529000000_coach_platform.sql:154–157, 209–238`; `supabase/migrations/20260629000000_security_audit_fixes.sql:75–117`; `src/services/coach/relationshipService.ts:64–101`; `src/pages/coach/CoachInvites.tsx:50, 69–86, 161`; `src/types/coach.ts:126–133`. | לא ניתן למכור seat אחד או bundle, להעלות תקרת לקוחות, לחייב חידוש או לתת למאמן self-service. הודעת “שדרוג” היא מבוי סתום. | להגדיר מוצרי Coach/מחירים/כמות seats; ליצור checkout scope=`coach`; לעדכן `coach_subscriptions` רק מ־webhook transactionally; להוסיף מסך upgrade, portal, status (`past_due`, `canceled`) ומסמכים. |
| **מוכנות משפטית/פיננסית להשקה בישראל.** תוכן התנאים, הפרטיות ותנאי המאמנים מסומן draft; פסקת המנוי אומרת רק שפרטים יוצגו בעתיד; router ציבורי מכיל Terms/Privacy ולא route ל־`coach_terms`. | `src/content/legal/legalDocs.ts:57, 109–111, 152, 184, 228–235`; `src/pages/legal/LegalDocPage.tsx:119–136`; `src/AppRouter.tsx:87–88, 270–271, 573–584`. | מכירה בלי תנאי עסקה, חידוש, מדיניות ביטול/החזר, פרטי סוחר, מסמכי מס וערוצי שירות יוצרת חשיפה רגולטורית ומחלוקות חיוב. | אישור עו"ד ורו"ח ישראליים לפני go-live; לפרסם מדיניות מנוי/ביטול/החזר/פרטיות/תנאי מאמנים מאושרת, route ציבורי לכולן, טקסט checkout מלא, מנגנון בקשת ביטול ותיעוד receipt/invoice. |

## עדיפויות P1

| מה חסר | היכן (file:line) | השפעה | מה נדרש |
|---|---|---|---|
| **תוקף תקופת החיוב אינו נאכף מקומית.** השירות מעביר `current_period_end`, אבל `isPremium` בודק רק plan ו־status. | `src/services/billing/entitlementService.ts:53–66, 75–78`; `src/services/billing/__tests__/entitlementService.test.ts:159–170, 174–202`. | webhook מאחר או event אבוד עלול להשאיר `active` אחרי תום התקופה; להפך, שגיאת RPC מחזירה free ומנתקת משלם זמנית. | להחיל בשרת מקור אמת: `active/trialing AND current_period_end > now()` (עם מדיניות grace מוגדרת), ליישב events מחוץ לסדר, ולהציג מצב “מאמתים מנוי” במקום downgrade מיידי כאשר יש entitlement cached תקף. |
| **מודל הנתונים אינו שומר קשרי billing מספקים.** קיימים entitlement מרודד ו־event log idempotent, אך המיגרציה מתעדת רק `provider`, `external_id`, `event_type`, `payload`; לא נראה בה customer/subscription/checkout/invoice lifecycle מפורש. | `supabase/migrations/20260610000100_entitlements.sql:16–36`; `supabase/migrations/20260610000100_entitlements.sql:40–63`. | תמיכה, reconciliation, קישור לקוח, portal, מסמך חיוב, refunds וחקירת chargeback יהיו תלויי payload גולמי/ספק. קיום טבלאות נוספות מחוץ למקור שנבדק הוא **לא מאומת**. | להוסיף טבלאות normalized ל־customer, subscription, checkout session, document ו־cancellation; לשמור מזהי ספק ייחודיים, מחיר/מטבע/כמות/מע"מ, event timestamps ו־processing result. |
| **בדיקות מסלול גבייה אינן רצות.** שלושת תרחישי paywall מסומנים `test.fixme`; הבדיקה גם מתייחסת ל־`subscriptions`, בעוד היישום הפעיל קורא `current_entitlement`/`entitlements`. | `e2e/journeys/paywall-entitlement.spec.ts:5–25, 31–81`; `src/services/billing/entitlementService.ts:53`; `supabase/migrations/20260610000100_entitlements.sql:16, 51–63`. | regression ב־checkout/webhook/restore/deny לא יתגלה לפני לקוחות משלמים; שם טבלה מיושן יגרום לבדיקה לא נכונה. | למחוק את ה־`fixme` רק לאחר sandbox adapter, seed אוטומטי ו־webhook replay; לבדוק success, cancel, duplicate event, refund, `past_due`, restore ו־grant/deny בפועל. |
| **דגל demo למאמנים פתוח כברירת מחדל.** כל משתמש authenticated יכול לעבור ל־coach view ולהפעיל `enableCoachMode` כאשר `VITE_DEMO_VIEW_SWITCH` אינו בדיוק `'false'`; `become_coach` יוצר שכבת free עם מושב אחד. | `src/contexts/CoachContext.tsx:24–43, 204–226`; `supabase/migrations/20260608000000_profiles_role.sql:55–77`. | סביבת production עלולה להמשיך לייצר מאמנים חינמיים ללא funnel מסחרי או onboarding עסקי. סטטוס משתנה הסביבה בפריסה הוא **לא מאומת**. | להפוך ברירת מחדל ל־false, להפעיל רק לפי feature flag server-side/allowlist, ולהפנות “הפוך למאמן” ל־offer/checkout או onboarding עסקי מפורש. |
| **תנאי מאמנים אינם נגישים בעמוד ציבורי למרות שקיים object.** `COACH_TERMS_DOC` מוגדר, אך רשימת routes הציבוריים שנקראה טוענת רק Terms ו־Privacy. | `src/content/legal/legalDocs.ts:228–263`; `src/AppRouter.tsx:87–88, 270–271, 573–584`; `src/pages/legal/LegalDocPage.tsx:61–171`. | מאמן לקראת רכישה אינו מקבל תנאי מוצר/B2B ברורים; קשה להוכיח גילוי/הסכמה. | להוסיף `/legal/coach-terms`, route/link ב־coach upgrade וב־onboarding, versioned consent נפרד, ותוכן מאושר הכולל מחיר/seat, ביטול, אחריות מקצועית ועיבוד נתוני מתאמנים. |

## עדיפויות P2

| מה חסר | היכן (file:line) | השפעה | מה נדרש |
|---|---|---|---|
| **מסר pre-launch חייב להתחלף atomically ביום ההשקה.** המסך כנה כרגע (“יושק בקרוב”) ומציע waitlist, אך כולל כבר catalogue של פרו. | `src/pages/billing/PaywallScreen.tsx:18–75, 475–485`; `src/services/billing/waitlistService.ts:23–72`. | אם מפעילים תשלום בלי להחליף feature flags, מחיר, תנאים ו־CTA באותו deploy, נוצרת חוויית רכישה סותרת. | לשחרר מאחורי `VITE_BILLING_LIVE`/remote config או route נפרד; לאפשר rollback לעמוד waitlist בלי לשנות entitlement של לקוחות קיימים. |
| **שמות test/data ישנים סביב billing.** ה־E2E מתאר “`subscriptions` table” ו־INSERT אליו, בעוד מקור האמת בקוד הוא `current_entitlement()` ו־`entitlements`. | `e2e/journeys/paywall-entitlement.spec.ts:12, 24, 77–81`; `src/services/billing/entitlementService.ts:53`; `supabase/migrations/20260610000100_entitlements.sql:16–24, 51–63`. | תחזוקה עתידית תיצור stubs שגויים ותפגע באמון בתוצאות בדיקה. | לעדכן terminology, fixtures ו־seed helpers לשמות המודל האמיתי לפני הוספת ספק. |
| **הגנת entitlement בצד לקוח נועדה להיות non-blocking בזמן loading.** `PlanGate` מציג children בזמן טעינה; זה UX סביר אך אינו יכול להיות שכבת אבטחה. | `src/contexts/EntitlementContext.tsx:92–101`; `src/components/billing/PremiumLock.tsx:38–66, 206–214`. | הבהוב קצר של תוכן פרימיום אפשרי, וחסימה בלבד בלקוח ניתנת לעקיפה. | להשאיר את ההתנהגות לשיפור UX בלבד; להבטיח שהנתון/פעולה היקרים עצמם מסורבים server-side. |

## מה כבר עובד — לא לבנות מחדש

- **בסיס entitlement צרכני נכון:** `entitlements` הוא SSOT של שורה למשתמש, event log כולל unique `(provider, external_id)`, RLS מאפשרת רק קריאת בעלים, ול־client אין policy לכתיבה; `current_entitlement()` מוחזר רק ל־authenticated. זה בסיס טוב ל־webhook אמיתי. ראו `supabase/migrations/20260610000100_entitlements.sql:15–48, 51–63`.
- **לקוח entitlement מרוכז ומנורמל:** `EntitlementProvider` מותקן סביב router, הלקוח קורא RPC אחד, מנרמל values לא מוכרים ומחזיר `FREE_ENTITLEMENT` במצבי אורח/שגיאה; מטריצת plan/status מכוסה ב־unit test. ראו `src/App.tsx:17–23`; `src/services/billing/entitlementService.ts:44–78`; `src/services/billing/__tests__/entitlementService.test.ts:38–202`.
- **pre-launch waitlist פונקציונלי:** השירות מבצע RPC ומטפל בכשל במקום לזייף הצלחה; ה־paywall שומר מצבי checking/submitting/joined/error. ראו `src/services/billing/waitlistService.ts:23–72`; `src/pages/billing/PaywallScreen.tsx:146–267`.
- **מודל seats למאמנים כבר נאכף בשרת:** `coach_subscriptions` מגדיר plan/limit, trigger מונע activation מעל limit, trigger נוסף מונע mint של invite חדש כשהמאמן מלא, והקשחת 29.06 מונעת שינוי client-side של plan/limit/status. ראו `supabase/migrations/20260529000000_coach_platform.sql:154–157, 209–238`; `supabase/migrations/20260614000100_invite_seat_enforcement.sql:9–46`; `supabase/migrations/20260629000000_security_audit_fixes.sql:75–133`.
- **מסלול invite מאמן→מתאמן שלם ברמת source:** ה־UI מייצר/משתף קוד, הלקוח מזמן `coach-invite-accept`, והפונקציה מאמתת JWT, rate limit, role, code, expiry, seats, consent ו־upsert; `JoinPage` שומר קוד לפני login ומבצע accept אחרי authentication. פריסה אמיתית, secrets ו־migration status הם **לא מאומתים**. ראו `src/pages/coach/CoachInvites.tsx:50–86, 179–305`; `src/services/coach/inviteService.ts:31–131`; `supabase/functions/coach-invite-accept/index.ts:47–179`; `src/pages/JoinPage.tsx:22–75`.
- **שלד משפטי נגיש:** terms/privacy הם routes ציבוריים, renderer תומך RTL ומציג version/date/draft; יש נקודת התחלה טובה לאישור משפטי במקום להתחיל מאפס. ראו `src/AppRouter.tsx:270–271, 573–584`; `src/pages/legal/LegalDocPage.tsx:61–171`; `src/content/legal/legalDocs.ts:39–57, 146–152`.

## מציאות תשלומים בישראל — החלטות לפני כתיבת קוד

1. **Stripe אינו ברירת מחדל ישירה לישות ישראלית.** דף ה־Global Availability הרשמי של Stripe שנבדק ב־26.07.2026 מפרט את המדינות הנתמכות ואינו כולל Israel; הוא אף מציין שלעסק מחוץ למדינה/אזור נתמך “Payments not supported yet”. לכן אין לתכנן על חשבון Stripe של ישות ישראלית בלי entity במדינה נתמכת ואימות מסחרי/משפטי. מקור: <https://stripe.com/global>.
2. **Paddle הוא אופציית MoR לבחינה, לא אישור אוטומטי.** התיעוד שלו אומר שהוא מוכר ביותר מ־200 מדינות ומחשב/גובה/מעביר מס כ־merchant of record; זה עוסק במדינת הקונה. אישור onboarding של seller ישראלי, התאמת מסמכים מקומיים, מטבע/תמחור וגבולות אחריות מול רו"ח הם **לא מאומתים** וצריכים בדיקת חוזה מול Paddle. מקור: <https://developer.paddle.com/concepts/sell/supported-countries-locales>.
3. **חלופת ישראל:** לבחור gateway/acquirer מקומי רק לאחר POC שמוכיח recurring tokenization, hosted checkout, signed webhooks, 3DS/PCI scope, חיוב ILS, refund/chargeback API, מסמכי מס ו־customer support. שמות ספקים או תאימותם בפרויקט הנוכחי הם **לא מאומתים** ולכן לא נבחר ספק בדוח זה.
4. **מע"מ ומסמכים:** מדריך השוק של Stripe מציין VAT של 18% לרוב מוצרים/שירותים ומציין שהעסק אחראי לגבייה ולהעברה, אך זה מקור מידע כללי ולא אישור מס. יש לסגור עם רו"ח ישראלי האם המחיר כולל מע"מ, סוג העסק, חשבונית־מס/קבלה, credit note/refund, retention ו־integration לחשבוניות. מקור: <https://stripe.com/resources/more/payments-in-israel>.
5. **ביטול צרכני:** מדריך רשות הגנת הצרכן וסחר הוגן מציג זכויות ביטול בעסקת מכר מרחוק, דרכי ביטול ודמי ביטול; החלת פרטים על מנוי דיגיטלי/עסקה מתמשכת תלויה בעובדות ובדין העדכני. לכן יש לקבל חוות דעת משפטית, לתת ערוץ ביטול נגיש, לשמור timestamp/אישור, ולעבד refund/credit document לפי החלטה מתועדת. מקור: <https://www.gov.il/BlobFolder/generalpage/information-olim-consumerism/he/smart-consumerism-en.pdf>.

## תוכנית מימוש מפורטת לתשלומים אמיתיים

### 1. החלטות מוצר, מס ומשפט — לפני migration

1. לאשר בכתב את מבנה הסוחר: ישות ישראלית עם gateway מקומי, או entity נתמכת/merchant of record. להחליט על ספק **אחד** להשקה הראשונה ולתעד fallback; לא להטמיע Stripe רק משום ש־`BillingSource` מכיל `web_stripe` (`src/services/billing/types.ts:8`).
2. להגדיר catalogue שרתי, לא client-side: `consumer_pro_monthly`, `consumer_pro_yearly`, ו־`coach_solo`/`coach_starter`/`coach_pro`/`coach_elite` עם `seat_limit`, currency, billing interval, tax display policy ו־provider price ID. מחיר אמיתי, מע"מ כלול/לא כלול, trial, refund ו־grace period הם החלטות בעלים/רו"ח/עו"ד ולא יומצאו בקוד.
3. לאשר נוסח תנאים נפרד ל־consumer ול־coach: זהות הסוחר ויצירת קשר, המחיר והמטבע, renewal consent, חיוב תקופתי, ביטול, זכאות להחזר, גישה עד סוף תקופה, פרטיות/sub-processors, dispute/chargeback, חשבוניות ומדיניות מושבים. לשנות `isDraft` ל־`false` רק אחרי אישור, לפרסם route ל־`coach_terms` ולקשור את version ל־consent.

### 2. migration SQL חדשה — מקור אמת מסחרי

להוסיף, למשל, `supabase/migrations/20260726000000_billing_core.sql`; **לא** לשנות entitlement על ידי client. להשאיר את `public.entitlements` כ־read model מהיר כדי לא לשבור את `current_entitlement()` הקיים, ולהוסיף את היסטוריית הספק:

```sql
-- enum/constraints אפשריים; להתאים לספק שנבחר
create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('paddle', 'local_gateway')),
  provider_customer_id text not null,
  email_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('consumer', 'coach')),
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text not null,
  price_key text not null,
  status text not null,
  quantity integer not null default 1 check (quantity > 0),
  seat_limit integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  latest_event_at timestamptz not null,
  provider_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('consumer', 'coach')),
  price_key text not null,
  requested_quantity integer not null default 1 check (requested_quantity > 0),
  provider text not null,
  provider_checkout_id text unique,
  state text not null check (state in ('created', 'redirected', 'completed', 'expired', 'canceled')),
  idempotency_key uuid not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  provider text not null,
  provider_document_id text not null,
  document_type text not null check (document_type in ('invoice', 'receipt', 'credit_note')),
  amount_minor integer not null,
  currency text not null,
  vat_minor integer,
  hosted_url text,
  issued_at timestamptz,
  unique (provider, provider_document_id)
);

create table public.billing_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.billing_subscriptions(id),
  channel text not null check (channel in ('portal', 'in_app', 'support')),
  reason text,
  requested_at timestamptz not null default now(),
  effective_at timestamptz,
  status text not null check (status in ('requested', 'processed', 'rejected', 'refunded'))
);
```

**RLS ו־transactions:** לכל טבלת client-facing להוסיף `SELECT` רק ל־owner; ללא `INSERT/UPDATE/DELETE` מהלקוח. להשאיר `billing_events` private, אך להרחיב אותו ל־`received_at`, `processed_at`, `processing_error`, `payload_sha256` ו־unique provider event ID. לכתוב פונקציית service-role יחידה, למשל `apply_billing_event(_provider, _event_id, _payload)`, שמבצעת באותה transaction: dedupe → upsert customer/subscription → update `entitlements` לצרכן **או** `coach_subscriptions` למאמן → document/cancel state. היא חייבת לדחות event ישן לפי `latest_event_at` ולאפשר replay בטוח.

**אכיפת מוצר:**

- להוסיף `public.has_feature_access(_user_id uuid, _feature text)` שאינו callable מה־anon ומחשב entitlement פעיל לפי status **וגם** `current_period_end`.
- לאכוף תבניות ב־trigger או RPC על `workout_templates`: בעת insert של template לא־hidden, לספור templates חיים של user; אם אין `unlimited_templates` והספירה כבר 3, להחזיר `free_template_limit_reached`. עדכון/template קיים לא יספור מחדש.
- ל־AI: `ai-chat` חייב לשאול את ה־DB עם service role אחרי אימות JWT ולפני `checkRateLimit`/upstream; free יקבל `403` או `402` עם `{ code: 'premium_required', feature: 'ai_coach' }`.
- ל־cloud sync ול־photos: לא להסתפק ב־`PlanGate`. להחליט אם זו באמת זכות בתשלום; אם כן, להחיל policy/RPC/signed-upload שמבוססים על `has_feature_access`. ל־data export יש לבחון עם יועץ פרטיות אם export של מידע אישי חייב להישאר חינמי; אם כן, לא לשווק אותו כנעול, אלא למכור export/report מועשר.

### 3. Edge Functions וגבול ספק

1. `billing-create-checkout/index.ts` — דורש JWT; מקבל רק `{ scope, priceKey, quantity? }`; בודק catalogue server-side, identity ו־max seats; יוצר `billing_checkout_sessions` עם idempotency key; יוצר checkout אצל adapter; מחזיר רק `{ checkoutUrl, sessionId }`. success/cancel URL קבועים allowlisted — לא מהלקוח.
2. `billing-webhook/index.ts` — **ללא** אימות JWT של browser, אבל POST raw body + header signature של הספק; reject על secret חסר, signature שגויה, timestamp ישן או event duplicate; קורא `apply_billing_event`; לא מחזיר זכאות לפני commit. CORS אינו נחוץ ל־provider webhook.
3. `billing-create-portal/index.ts` — JWT + lookup owner בלבד; מחזיר URL קצר־חיים ל־portal של הספק. אם אין portal, מפנה למסך ביטול פנימי שיוצר `billing_cancellation_requests` ומפעיל process מאושר.
4. `billing-reconcile/index.ts` — machine/service-role בלבד, secret ייעודי; מחפש sessions/events stuck, משווה API ספק ומתקן read models תוך audit. אין לקרוא לו מהדפדפן.
5. לאחד provider-specific code מאחורי `supabase/functions/_shared/billingProvider.ts` עם API כגון `createCheckout`, `verifyWebhook`, `toCanonicalEvent`, `createPortalSession`, `cancelSubscription`. כך ספק ישראלי ו־MoR יכולים להתחלף בלי לשנות UI/entitlement logic.

### 4. API לקוח ו־UI states

ליצור `src/services/billing/billingService.ts`:

```ts
type BillingScope = 'consumer' | 'coach';
type CheckoutRequest = {
  scope: BillingScope;
  priceKey: string;
  quantity?: number; // seats only; server revalidates
};

export async function createCheckout(input: CheckoutRequest): Promise<{ checkoutUrl: string }>;
export async function refreshBillingState(): Promise<void>;
export async function openCustomerPortal(scope: BillingScope): Promise<{ url: string }>;
export async function requestCancellation(input: { subscriptionId: string; reason?: string }): Promise<void>;
export async function listBillingDocuments(): Promise<BillingDocument[]>;
```

- להרחיב `EntitlementContext.refresh()` לשימוש אחרי redirect, poll קצר למצב `pending_activation`, ו־realtime/refetch אחרי webhook; **לא** להגדיר `isPremium=true` מתשובת checkout redirect.
- להחליף את `PaywallScreen` ל־state machine: `loading` → `choose_plan` → `creating_checkout` → redirect ספק → `return_pending` → `active` / `cancelled` / `failed` / `past_due`. להציג מחיר ב־ILS, האם כולל מע"מ, period, automatic renewal, links לתנאים/פרטיות/ביטול, ולוגיקת disabled בזמן request. להשאיר waitlist רק כש־billing feature flag כבוי.
- להוסיף `CoachBillingPage`: tier comparison, current plan, seats used/limit, quantity selector שלא יכול לרדת מתחת ל־active clients, `upgrade`, `manage subscription`, `cancel at period end`, `past_due` banner, וטבלת receipts/invoices. לשנות את `CoachInvites` כך שהטקסט ב־line 161 יהיה link/action אמיתי למסך זה.
- להוסיף לכל lock state CTA המתאים ל־scope: consumer ל־`/paywall`, coach ל־`/coach/billing`; להציג `past_due`, `canceled` ו־`grace` בשפה מפורשת, ולא רק אייקון מנעול.

### 5. סדר עבודה והפעלה מבוקרת

1. לבצע migration ו־RLS tests ב־branch Supabase, seed של free/pro/coach ומיגרציית backfill של כל `coach_subscriptions` קיימים.
2. להפעיל sandbox של הספק, להגדיר סודות רק ב־Supabase secrets, ולתת ל־QA webhook endpoint נפרד. לא לחשוף secret, price ID או signed webhook logic ב־Vite bundle.
3. ליישם server enforcement לפני הפעלת CTA; לעולם לא למכור `unlimited_templates`, AI, sync או seats לפני שמבחן deny של free עובר.
4. לבצע legal/accounting acceptance: נוסח checkout, cancellation evidence, tax document example, refund/credit flow, support SLA ו־chargeback runbook.
5. להפעיל pilot קטן עם dashboard reconciliation יומי; רק אחריו להחליף `VITE_BILLING_LIVE` ולהסיר את מסר “יושק בקרוב”.

### 6. תכנית בדיקות מחייבת

- **SQL/RLS:** anonymous/authenticated אינם יכולים לכתוב `entitlements`, `billing_events`, plan או `seat_limit`; service role כן. לבדוק `current_entitlement` בתום תקופה, free→paid, paid→past_due/canceled/refund, event duplicate/out-of-order ו־race על seat.
- **Webhook:** valid signature, invalid signature, malformed raw body, replay, event ID conflict, provider timeout, mapping לכל event lifecycle, ו־reconciliation אחרי failure באמצע transaction.
- **Feature enforcement:** free נחסם בתבנית רביעית גם דרך direct sync, AI מקבל `premium_required` לפני upstream, upload photo/sync/export מתנהגים לפי החלטת מוצר, ו־paid משוחרר רק אחרי event מעובד.
- **Consumer E2E:** checkout sandbox, return ללא webhook, success עם webhook, cancel, `past_due`, restore/portal, receipt link, cancel request, RTL/NIS/מע"מ/terms disclosure; לבטל את `test.fixme` הקיים רק לאחר מכן.
- **Coach E2E:** coach free נוצר עם seat 1, invite שני נחסם, upgrade מגדיל seats, downgrade מתחת ל־active clients נדחה, webhook משנה limit, invite accept נשאר אטומי, ו־portal/cancel שומרים audit.
- **Operational:** secret-missing failure is closed, rate-limit, observability ללא payload/PII רגיש, provider webhook replay runbook, ומדידת checkout conversion/failed payments בלי לשמור פרטי כרטיס.

</div>
