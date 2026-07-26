# דוח מוכנות מוצר למכירה — SparkOS Fitness

**היקף:** אפליקציית PWA בעברית/RTL עבור מתאמנים ומאמנים אישיים. הבדיקה מבוססת על קוד המקור הפעיל, migrations ופונקציות Edge בלבד; קבצי Markdown ישנים לא שימשו כהוכחה. לא נערכו שינויים בקוד. ציטוטים הם `קובץ:שורה`.

**פסק דין:** המוצר מציג ליבת אימון ומערכת אימון-מאמן משמעותיות, אך אינו מוכן עדיין למכירה: אין מסלול תשלום/מנוי, קישור הזמנה למאמן נשבר למשתמש לא מחובר, ושחזור סיסמה מפנה למסלול שאינו קיים. אלה חוסמים רכישה, המרה ושימור לקוחות.

## תקציר מנהלים

| חומרה | כמות | המשמעות העסקית |
|---|---:|---|
| P0 | 3 | חסמי מכירה, הצטרפות או שחזור חשבון |
| P1 | 6 | אמון, פרטיות, הרשאות או תכונת פרימיום שאינה מוכנה להפעלה |
| P2 | 5 | חוויית לקוח חלקית או חוב שחרור מוחשי |
| P3 | 2 | חוב תחזוקתי/תיעודי שאינו חוסם מסלול כיום |

**מה עובד בפועל בקוד:** לולאת האימון שומרת session עם retry/summary, תבנית תוכנית מאמן ניתנת למימוש אצל כל מתאמן, קיימים invite acceptance עם בדיקות שרת, הודעות, push subscription, סנכרון template, loading/error/empty states בהרבה מסכי מאמן, ותוכנית 12 שבועות שמייצרת תבנית runnable. אין בסיס לומר ש־`WorkoutPlaceholder` הוא מסך דמה: הוא טוען את `ActiveWorkoutNew`, וה־save הפנימי מבצע `saveWorkoutSession`, מציג שגיאה ו־retry (`src/AppRouter.tsx:852–884`, `src/components/workout/hooks/useWorkoutSave.ts:89–205`).

**מה אי אפשר לאמת מה־repository:** deployment של Supabase Edge Functions, כתובות CORS, secrets, ספק AI, VAPID, `pg_cron`/`pg_net`, ספק תשלומים ו־webhooks. הדוח מסמן אותם כשערי שחרור, לא ככשל runtime מוכח.

## טבלת כל המסלולים

**מקור עץ המסלולים:** auth-gate ציבורי ב־`src/AppRouter.tsx:262–284`; עץ האפליקציה ב־`src/AppRouter.tsx:347–645`; מטא־label/accent ב־`src/appPathMeta.ts:7–55`. “בשל” פירושו שהיישום וקבוצת מצבי UI קיימים במקור — לא שה־backend כבר פרוס בפרודקשן.

| Route | קובץ/רכיב | מצב | חסר או הסתייגות |
|---|---|---|---|
| `*` במצב unauthenticated | `Login.tsx` | חלקי | כל deep-link שאינו legal/accessibility נבלע ב־`Login`; זה שובר במיוחד `/join?code=…` (P0). |
| `/legal/terms` | `pages/legal/TermsPage.tsx` | בשל | ציבורי גם לפני auth; תוכן משפטי לא נבדק כייעוץ משפטי. |
| `/legal/privacy` | `pages/legal/PrivacyPage.tsx` | בשל | ציבורי גם לפני auth. |
| `/accessibility` | `AccessibilityStatement.tsx` | חלקי | הצהרה קיימת, אך כוללת שני TODO-ים פרה־השקה (P2). |
| `/` | `RoleHome → Dashboard` | בשל/מותנה | home מותאם view-role; תלוי במצב auth/coach תקין. |
| `/me` | `Dashboard.tsx` | בשל | מאפשר למאמן לראות את הצד האישי שלו בלי role redirect. |
| `/workout` | `WorkoutPlaceholder → ActiveWorkoutNew` | בשל | לא placeholder מוצרי; autosave, finish/error/retry קיימים. |
| `/workout/:templateId` | `WorkoutPlaceholder → ActiveWorkoutNew` | בשל/מותנה | טוען template לפי מזהה; template ענן חייב להיות מסונכרן מקומית. |
| `/nutrition` | `Nutrition.tsx` | בשל | כולל מסלולי טעינה/שגיאה/empty בבדיקה; שירותי מקור נתונים חיצוניים עדיין תלויים ברשת. |
| `/progress` | `Progress.tsx` | בשל | מדדים, היסטוריה ומצבי שגיאה קיימים. |
| `/templates` | `Templates.tsx` | בשל | יצירה/עריכה/empty states קיימים. |
| `/program` | `Program.tsx` | חלקי | תוכנית runnable, אך progress מקומי בלבד; start failure נבלע בשקט (P1/P2). |
| `/detail/:id` | `WorkoutDetail.tsx` | בשל | מסך detail עם fallback חזרה לבית. |
| `/settings` | `Settings.tsx` | חלקי | הגדרות וסנכרון קיימים, אבל lifecycle של חשבון/מחיקה/export חסר (P1). |
| `/coach` | `CoachHome.tsx` | מותנה | מסך command center קיים; תלוי role/backend, ו־demo switch מסוכן אם env חסר (P1). |
| `/coach/clients` | `CoachClients.tsx` | מותנה | roster/loading/error/seat states קיימים; דורש Supabase/RLS פעילים. |
| `/coach/clients/:id` | `ClientDetail.tsx` | מותנה | client detail, assignment, check-in ומעקב קיימים. |
| `/coach/clients/:id/report` | `ClientReport.tsx` | מותנה | דוח ומדדים קיימים; נתוני backend נדרשים. |
| `/coach/programs` | `CoachPrograms.tsx` | חלקי | ספריית תוכניות קיימת; כשל query עלול להיראות כרשימה ריקה דרך `listProgramTemplates` (P1). |
| `/coach/invites` | `CoachInvites.tsx` | חלקי | יצירה/QR/seat checks קיימים, אך קבלת deep-link לאורח לא מחובר נשברת (P0). |
| `/coach/groups` | `CoachGroups.tsx` | מותנה | קבוצות וניהול חברים קיימים; תלוי cloud/RLS. |
| `/coach/groups/:groupId/chat` | `GroupThread.tsx` | מותנה | chat קבוצתי קיים; הודעות push הן best-effort. |
| `/coach/messages` | `CoachMessages.tsx` | מותנה | thread list/read state/realtime קיימים. |
| `/coach/messages/:otherId` | `MessageThread.tsx` | מותנה | שליחה, rollback ו־paging קיימים. |
| `/my-coach` | `MyCoach.tsx` | חלקי | inbox, חיבור ידני, check-ins והתחלת תוכנית קיימים; שלוש קריאות יכולות להסוות כשל כ־empty (P1). |
| `/my-coach/messages/:otherId` | `MessageThread.tsx` | מותנה | תלוי relationship פעיל. |
| `/my-coach/groups/:groupId/chat` | `GroupThread.tsx` | מותנה | תלוי membership פעיל. |
| `/join` | `JoinPage.tsx` | חסום ל־unauthenticated | רכיב יודע לשמור קוד זמנית, אבל אינו נטען לפני login עקב outer auth gate (P0). |
| `/community` | `CommunityFeed.tsx` | מותנה | feed, composer, loading/error/empty קיימים; תלוי cloud moderation/data. |
| `/u/:userId` | `PublicProfilePage.tsx` | מותנה | public profile וחסימות קיימים; תלוי נתוני profile. |
| `/paywall` | `billing/PaywallScreen.tsx` | חסום מסחרית | זהו waitlist, לא checkout או ניהול subscription (P0). |
| `*` באפליקציה | `NotFound` | בשל | הודעת deep-link פגום גלויה, במקום bounce שקט. |

## טבלת TODO / stub / placeholder ממופה

סריקה בוצעה עבור `TODO`, `FIXME`, `HACK`, `XXX`, `not implemented`, `coming soon`, `בקרוב`, `placeholder`, `mock`, `stub`, `temporar`, `for now`, `503` בקוד production. להלן המיון, כדי לא לייצר false positives.

| מקור | סיווג | הערכה | פעולה |
|---|---|---|---|
| `src/pages/billing/PaywallScreen.tsx:5–6,16,252–269,475` | פער אמיתי | CTA לרשימת המתנה בלבד; “פרימיום יושק בקרוב” | P0 — להחליף בתשלום מלא לפני מכירה. |
| `src/pages/billing/PaywallScreen.tsx:26–27` | תיעוד מיושן | comment טוען שה־AI endpoint “returns 503”; המקור מחזיר 503 רק כשה־limiter אינו זמין | P3 — לתקן comment/marketing אחרי אימות deploy. |
| `src/pages/AccessibilityStatement.tsx:204,223,230` | פער אמיתי | known limitations ופרטי רכז נגישות מסומנים TODO, עם כתובת contact אחת | P2 — למלא לפני פרסום. |
| `src/components/workout/themes.ts:3–11` | stub לא פעיל | `getThemeVariables` מחזיר `{}`, אך סריקה לא מצאה importer | P3 — להסיר או להחזיר API אמיתי; אינו flow break כרגע. |
| `src/AppRouter.tsx:852–884` (`WorkoutPlaceholder`) | false positive | wrapper ל־lazy workout, לא מסך דמה; ה־save בפועל בתוך hook | לא לתעד כפער. |
| input `placeholder`, skeletons, temporary optimistic ids, test mocks, “Hack Squat”, הערות no-image | false positives/התנהגות מכוונת | אינם סימן לפיצ’ר חצי־גמור | ללא פעולה מוצרית. |

## שרשרת המאמן — היכן היא עובדת והיכן נשברת

### הזרימה התקינה בקוד

1. **בחירת מאמן / קידום role:** onboarding שומר intent, ולאחר session `CoachContext` מפעיל `enableCoachMode` ומרענן role/subscription (`src/AppRouter.tsx:210–240`, `src/contexts/CoachContext.tsx:159–194`).
2. **יצירת מתאמן והזמנה:** UI מציג seat usage וחוסם יצירת invite כשהמכסה מלאה; ה־Edge Function בודקת auth, consent, seat limit ומגינה מפני חריגה (`src/pages/coach/CoachInvites.tsx:50–78,137–178`, `supabase/functions/coach-invite-accept/index.ts:6–9,134–175`).
3. **תוכנית למתאמן יחיד/לקבוצה:** assignment לקבוצה מייצר template עצמאי לכל active member, אוסף כשלי partial ואינו יוצר assignment תלוי אם כולם נכשלו (`src/services/coach/assignmentService.ts:66–183`; בדיקות `src/services/coach/__tests__/programAssignment.test.ts:165–217`).
4. **מתאמן מתחיל תוכנית:** `MyCoach` מסנכרן template מהענן לפני ניווט ל־`/workout/:id`, ומציג toast אם השלב נכשל (`src/pages/MyCoach.tsx:157–172`).
5. **תוצאות/מסרים:** active workout שומר session; dashboard/report/services של המאמן קוראים נתונים; messaging כולל optimistic behavior/read state/push best-effort.

### נקודת השבר P0 — deep-link להזמנת מאמן

**מה קורה:** `JoinPage` מכיל logic שמחפש קוד, שומר אותו ב־`pending_invite_code` כשאין auth, ואחר כך auto-accepts כשיש auth (`src/pages/JoinPage.tsx:11–42,47–72`). אולם לפני authentication, `AppRouter` מציג רק legal/accessibility ואת `<Login />` עבור כל `*`, כולל `/join?code=…` (`src/AppRouter.tsx:262–273`). לכן `JoinPage` כלל אינו mount כדי לשמור את הקוד. לאחר sign-in `Login` עושה `navigate('/', { replace: true })` (`src/pages/Login.tsx:37–42`) והקוד נעלם.

**השפעה:** Coach שולח QR/link; מתאמן קיים שאינו מחובר מגיע למסך login, נכנס, ואז נוחת בבית בלי חיבור למאמן. זהו funnel acquisition שבור.

**דרישת תיקון:** לאפשר `/join` במצב unauthenticated, לשמור את code לפני login, ולהחזיר ל־`/join?code=…` אחרי sign-in/sign-up/verification. לכסות ב־E2E: existing user, new user requiring email confirmation, guest, expired code, and coach opening link.

### נקודות P1 נוספות בשרשרת המאמן

- **Demo coach פתוח כברירת מחדל:** `VITE_DEMO_VIEW_SWITCH !== 'false'` משאיר את הדלת פתוחה אם משתנה production נשכח; מעבר ל־coach view מנסה `enableCoachMode()` עבור כל authenticated non-coach (`src/contexts/CoachContext.tsx:30–38,203–225,239–245`). הדבר עלול להעניק מסלול מאמן/seat חינמי או לבלבל role entitlement. לנעול ב־production by default, ולאפשר demo רק ב־development/allowlist.
- **כשלי DB נראים כמו “אין מידע”:** `listMyCoaches`, `listMyAssignments` ו־`listProgramTemplates` לוגים error ומחזירים `[]` (`src/services/coach/relationshipService.ts:169–170`, `src/services/coach/assignmentService.ts:251–252`, `src/services/coach/programTemplateService.ts:36–37`). מסכי empty state עלולים להצהיר שאין מאמן/תוכנית במקום להציג retry. להעביר `Result` או throw ל־UI בכל reader קריטי.
- **Acknowledgement של assignment מקומי בלבד:** `MyCoach` שומר “טופל” ב־`localStorage` ומצהיר במפורש שאין server status (`src/pages/MyCoach.tsx:60–91`). המאמן לא יכול לדעת שהמתאמן ביצע פעולה, והסטטוס אינו רב־מכשירי. זה P2 אם הפעולה מוצגת כמעקב, או יש להשאיר אותה כ־“סמן לעצמי”.

## שרשרת המתאמן — היכן היא עובדת והיכן נשברת

### הזרימה התקינה

1. onboarding שומר נתונים/העדפות מקומיות ומסמן completion (`src/appOnboarding.ts:65–96`; `src/AppRouter.tsx:168–205`).
2. `Program` בוחר יום, `startProgramDay` מייצר hidden template ב־IndexedDB ושומר pending position (`src/pages/Program.tsx:86–104`, `src/services/programService.ts:352–381`).
3. workout טוען template פעם אחת, שומר completed session, מגן double tap, מציג error/retry, ולאחר success מתאם תוכנית/לו״ז (`src/components/workout/active/useWorkoutEffects.ts:86–157`, `src/components/workout/hooks/useWorkoutSave.ts:89–205`).
4. `reconcileProgramOnSessionSave` מתקדם רק אם ה־template וה־session תואמים, עם guard נגד כפילויות (`src/services/programService.ts:395–456`).
5. Progress ונוטרישון מציגים את נתוני המכשיר/הענן לפי השירותים הקיימים.

### פערים

- **P1 — progress של BBT אינו cloud-synced:** `PROGRESS_KEY = 'bbt_program_progress_v1'` נכתב ל־`localStorage` (`src/services/programService.ts:23,90–128`). ה־JSON backup כולל אותו במפורש כי הוא local-only (`src/services/settingsService.ts:156–166`), אבל sync סטנדרטי אינו שומר אותו בענן. לקוח משלם שמחליף מכשיר מאבד את התקדמות המסלול או צריך backup ידני.
- **P2 — כישלון בהתחלת יום שקט:** `Program.handleStart` פשוט עושה `setStarting(false)` ב־`catch` ללא toast/inline error (`src/pages/Program.tsx:86–104`). כשל IndexedDB/quota נראה כאילו הכפתור “לא עשה כלום”.
- **P2 — תמונות תרגיל חסרות אך אינן flow break:** בסריקה סטטית נמצאו 90 תרגילים, ל־90 יש `tutorialText`, 79 ממופים לתמונות ו־11 ללא תמונה. מקור התמונות מגדיר במפורש fallback ללא image ו־progressive enhancement (`src/data/exerciseImages.ts:10–14,117–120`); active workout משתמש ב־`tutorialText`/`instructions` (`src/components/workout/ActiveWorkoutNew.tsx:841`). חסרים: Jumping Jacks, Treadmill Run, High Cable Crossover, Landmine Press, Seated Cable Row Wide Grip, Reverse Cable Fly, Bulgarian Split Squat, Lunges, Hip Thrust, Hanging Knee Raise, Ab Wheel Rollout. להשלים או להציג illustration עקבית.

## מחזור חיי חשבון של לקוח משלם

| צורך | מצב מקור | ראיה | פער/שער שחרור |
|---|---|---|---|
| הרשמה | קיים | `signUp` משתמש ב־Supabase; UI מאמת שדות ומציג מסך confirmation (`src/services/supabaseAuth.ts:183–209`, `src/pages/login/steps/SignUpStep.tsx:66–103`) | נדרש אימות deploy של Supabase email/template/redirect. |
| אימות email + resend | קיים במקור | confirmation UX ו־`auth.resend({ type: 'signup' })` (`src/pages/login/steps/SignUpStep.tsx:133–252`, `src/services/supabaseAuth.ts:211–226`) | delivery אמיתי לא ניתן לאימות מהריפו. |
| כניסה / Google | קיים | password sign-in ו־OAuth Google (`src/services/supabaseAuth.ts:228–270`) | callback URLs ב־Supabase אינם ניתנים לאימות כאן. |
| שכחתי סיסמה | **P0 שבור** | `resetPasswordForEmail` מפנה ל־`/reset-password` (`src/services/supabaseAuth.ts:361–376`) | אין route/component כזה בעץ `AppRouter`; פותח login wildcard במקום מסך עדכון סיסמה. |
| עדכון סיסמה | service בלבד | `updatePassword` קיים (`src/services/supabaseAuth.ts:378–404`) | אין surface ב־`AccountSection`, המציג email ו־sign-out בלבד (`src/pages/settings/sections/AccountSection.tsx:13–65`). |
| שינוי email | לא נמצא מימוש production | `AccountSection` אינו מציע פעולה; auth service מעדכן password או metadata בלבד (`src/services/supabaseAuth.ts:378–421`) | P1 — חסר flow/payable account lifecycle. |
| מחיקת חשבון auth | לא נמצא מימוש | “מחק את כל הנתונים” מבטיח למחוק workouts/preferences/settings (`src/pages/settings/sections/DangerZoneSection.tsx:33–64`) | P1 — אין delete של `auth.users`; פעולה אינה “מחיקת חשבון”. |
| מחיקת כל data | חלקית | רשימת הטבלאות כוללת רק sync tables ומוחקת עם `eq('user_id')` (`src/services/settingsService.ts:53–93`) | P1 — אינה כוללת coach profiles/relationships/invites/groups/assignments/messages/reminders/push subscriptions, וחלקן אינן keyed רק ב־`user_id`. |
| ייצוא/שחזור | קיים חלקית | JSON כולל IndexedDB + local settings (`src/services/settingsService.ts:140–204`; UI `ExportSection.tsx:126–180`) | P1 — אינו מייצא רשומות cloud-only של coaching/account/subscription/push. |
| ניהול מנוי, ביטול, portal | לא קיים | paywall קורא רק `hasJoinedWaitlist`/`joinWaitlist` (`src/pages/billing/PaywallScreen.tsx:16,252–269`) | P0 — אין checkout, renewal, cancel, portal או entitlement provisioning. |
| חשבוניות/קבלות | לא נמצא | קיימים types של sources עתידיים בלבד (`src/services/billing/types.ts:1–29`) | P0 כחלק ממסלול תשלום החסר. |
| תמיכה | חלקי מאוד | `mailto:pgishonim@gmail.com` מופיע בהצהרת נגישות/age gate (`src/pages/AccessibilityStatement.tsx:211–230`, `src/components/consent/AgeGate.tsx:98`) | P1 — לא נמצא מרכז תמיכה/טופס/מסלול SLA עבור לקוחות משלמים. |

## P0 — חסמי שחרור ומכירה

### P0-1: אין commerce path או entitlement enforcement מוכן למכירה

`/paywall` מבצע waitlist בלבד. ה־CTA קורא ל־`joinWaitlist('paywall')` והמסך אומר שפרימיום “יושק בקרוב” (`src/pages/billing/PaywallScreen.tsx:5–6,16,252–269,475`). קיימים types/RPC read ו־`PlanGate`, אך סריקת שימושים מצאה את `PremiumLock`/`PlanGate` כהגדרה ללא אימוץ במוצר, ולא נמצאו checkout, webhook, customer portal, receipts או invoices. `getEntitlement` גם מחזיר `FREE_ENTITLEMENT` כאשר Supabase/RPC נכשל (`src/services/billing/entitlementService.ts:44–61`).

**השפעה:** אי אפשר לגבות כסף ממשתמשים או ממאמנים, להעניק/לבטל גישה בצורה אמינה, או לתת תמיכת חיוב. **תיקון:** לבחור provider; לממש price catalog, checkout, signed webhooks, immutable entitlement state, server-side feature enforcement, cancel/portal, receipts/invoices ו־reconciliation tests. אל תציגו paywall כ”שדרוג” לפני כן.

### P0-2: קישור הזמנת מאמן נשבר למשתמש לא מחובר

ראו שרשרת המאמן לעיל. **תיקון ראשון:** preserve return URL/code דרך Login וה־verification flow; render `/join` גם לפני authentication.

### P0-3: password reset מגיע למסלול לא קיים

ראו lifecycle לעיל. **תיקון ראשון:** להוסיף `/reset-password`, לטפל ב־recovery session, validate/new password, success/relogin, expired/reused link ו־safe error states; לכתוב E2E אמיתי של link עד login.

## P1 — בעיות אמון, הרשאות ותכונות מכירה

### P1-1: demo coach mode פתוח אם משתנה סביבה לא מוגדר

`DEMO_OPEN_VIEW_SWITCH` הוא true אלא אם ה־env שווה במדויק `'false'`; `setViewMode('coach')` מנסה promotion (`src/contexts/CoachContext.tsx:30–38,203–225`). לקבוע production default secure (`false`), ולהפריד demo tenant/feature flag מאומת.

### P1-2: מחיקת data/export/account lifecycle אינם עומדים בהבטחה ללקוח משלם

הטבלה לעיל מפרטת את הפער. יש להגדיר data inventory מלאה לפי actor/foreign keys, server-side account-deletion job עם re-authentication ומדיניות retention, ולייצא גם רשומות cloud-owned. אין להבטיח “מחיקת כל הנתונים” לפני שהמשמעות תואמת את היישום.

### P1-3: false-empty בנתוני coaching

קריאות קריטיות מחזירות `[]` במקום error. מתאמן יכול לחשוב שהמאמן ניתק אותו או שאין לו תוכנית דווקא כשיש outage/RLS/config error. להחזיר typed result או throw, ולחבר `SectionError` עם retry למסכים הרלוונטיים.

### P1-4: BBT program progress מקומי בלבד

לסנכרן state עם user id, merge/last-write policy, restore ו־device conflict rules; להוסיף E2E רב־מכשירי.

### P1-5: AI מיושם במקור אך לא מוכן להבטחת מכירה

הקוד **אינו** מחזיר 503 ללא תנאי. `initAI()` בוחר `RemoteProvider` כש־Supabase מוגדר או fallback מקומי אחרת (`src/services/ai/bootstrap.ts:18–27`). פונקציית `ai-chat` דורשת JWT, rate-limit ledger, `SUPABASE_URL`, service-role key, `POLOAI_API_KEY`, CORS origin וספק upstream (`supabase/functions/ai-chat/index.ts:30–31,121–132,157–226,316–374`). היא מחזירה 503 רק אם ה־rate limiter אינו זמין (`supabase/functions/ai-chat/index.ts:312–325`), 500 אם secret חסר, ו־502/סטטוס upstream במקרים אחרים (`supabase/functions/ai-chat/index.ts:350–400`).

**פער מוצרי:** paywall מבטיח “תוכנית אימון מותאמת אישית מבוססת AI” ובאותו זמן מסמן אותה “בקרוב” (`src/pages/billing/PaywallScreen.tsx:70–76`); ה־UI הקיים הוא מאמן AI בהקשר תרגיל (`src/components/workout/components/ExerciseDisplay.tsx:864–869`). לפני תמחור AI: deploy/secret/CORS/rate table, observability/cost cap, abuse policy, E2E עם משתמש אמיתי, והחלטה אם מוכרים Q&A תרגיל או generator של תוכנית אישית.

### P1-6: closed-app reminders תלויים בהפעלה ידנית לא מתועדת כתצורה

Push client מלא: VAPID public key, permission, Service Worker subscription ו־`push_subscriptions` (`src/services/coach/pushService.ts:12–61`), service worker מציג notification ומנווט click (`public/push-sw.js:1–40`), ו־Edge dispatcher שולח לדפדפן סגור (`supabase/functions/reminders-dispatch/index.ts:1–25,88–175`). אבל migration מזכיר במפורש שהוא inert ודורש ידנית secrets, deploy עם `--no-verify-jwt`, `pg_cron`, `pg_net` ו־cron HTTP call (`supabase/migrations/20260613000000_reminder_dispatch.sql:1–7,34–58`). אין `supabase/config.toml` או function config מעוקב ל־dispatcher; לכן deployment/schedule אינם ניתנים לאימות.

**תיקון:** להפוך את checklist ל־release runbook + CI/CD verification, health endpoint/alert, ומבחן device אמיתי עם app closed. ה־client local materializer פועל רק כש־tab פתוח (`src/AppRouter.tsx:746–747`, `src/services/coach/reminderService.ts:117–153`).

## P2 — חוויית מוצר חלקית / שערי release

### P2-1: כשל שקט בהתחלת תוכנית

להציג `role="alert"`/toast ו־retry כאשר `startProgramDay` נכשל; לשמר את השבוע/יום הנבחר.

### P2-2: 11 תרגילים ללא תמונת הדגמה

לא לחסום launch, כי text guidance קיים במלואו וה־fallback מכוון. להשלים mapping/asset או visual fallback כדי שה־catalog יהיה עקבי.

### P2-3: הצהרת נגישות אינה מוכנה לפרסום

להחליף placeholder של known limitations ולאשר שם/תפקיד/פרטי רכז נגישות לפני launch (`src/pages/AccessibilityStatement.tsx:204,223–230`). אין כאן קביעה משפטית לגבי עמידה בתקן; זו בדיקת completeness של היישום והצהרתו.

### P2-4: סטטוס assignment מקומי ולא מדיד למאמן

ליישם `acknowledged_at` / `acknowledged_by` עם RLS מתאימה, או לשנות copy כדי להבהיר שהסימון פרטי למתאמן בלבד.

### P2-5: quality gate אדום

`npm run typecheck`, `npm run build` ו־full test suite עוברים; `npm run lint:check` נכשל עם 356 diagnostics. בהפרדת formatter נותרו 8 import-order checks ועוד analyzer error אחד: `@media (prefers-reduced-transparency: reduce)` הוא media feature לא מוכר ב־`src/styles/components.css:1331`. `npx biome lint ./src` מאשר את השגיאה היחידה הזו. לתקן את preference strategy ולהחזיר את CI לירוק לפני שחרור.

## P3 — חוב שאינו חוסם flow

1. **comment AI stale:** לתקן את טענת ה־503 הלא־מותנית ב־`PaywallScreen` כדי שהצוות לא יקבל החלטות על סמך מצב ישן (`src/pages/billing/PaywallScreen.tsx:26–27`).
2. **theme stub מת:** להסיר את `getThemeVariables` או להחזיר implementation מבוסס tokens; הוא כרגע לא imported (`src/components/workout/themes.ts:3–11`).

## התראות ו־push — verdict

**קיים בקוד:** opt-in במכשיר, storage של subscription, PWA worker, push למסרים/assignments כ־best-effort, server dispatch עם dedup ו־VAPID. `coach-push-send` ו־`reminders-dispatch` מטפלים ב־404/410 על ידי מחיקת subscription פגום (`supabase/functions/reminders-dispatch/index.ts:162–175`).

**לא מוכח בפרודקשן:** secrets, origin, function deploy, cron, VAPID validity והרשאת משתמש. לכן אין למכור “תזכורות כשהאפליקציה סגורה” עד runbook והוכחת device production.

## נקודות חוזק מוכחות

- שכבת invite acceptance כוללת consent, role/seat/rate-limit/CORS safeguards בצד שרת, במקום לסמוך רק על UI (`supabase/functions/coach-invite-accept/index.ts:6–9,68–175`).
- assignment לקבוצה מטפל partial failure ולא מייצר dangling row כשהכול נכשל (`src/services/coach/assignmentService.ts:109–183`).
- workout save מגן double-save, מאמת best-effort, מציג failure עם retry, שומר PR ומתקדם בתוכנית רק אחרי session תקין (`src/components/workout/hooks/useWorkoutSave.ts:89–205`).
- `WorkoutProvider` שומר draft, מנקה finalized workout ומונע restore של draft ישן (`src/components/workout/core/WorkoutProvider.tsx:33–100,125–184`).
- sign-out מנקה data מקומי user-scoped ומנסה flush queue לפני wipe (`src/services/supabaseAuth.ts:273–359`).
- PWA לא נדרשה להסתמך על assertions בלבד: build הצליח ויצר service worker; full suite מכסה 128 קבצים ו־1,149 בדיקות.

## אימות שבוצע

| בדיקה | תוצאה |
|---|---|
| `npm run typecheck` | עבר (`exit 0`) |
| `npm run build` | עבר (`vite build`, 3,024 modules, PWA assets נוצרו) |
| `npm run test:run` | עבר: 128 test files, 1,149 tests |
| `npm run test:run -- src/data/exerciseImages.test.ts` | עבר: 6 tests |
| exercise static audit | 90 built-ins, 90 `tutorialText`, 79 mapped, 11 unmapped |
| `npm run lint:check` | נכשל: 356 diagnostics; 347 formatter/line-ending drift ועוד 9 check diagnostics |
| `npx biome check --formatter-enabled=false --reporter=summary ./src` | נכשל: 8 organize-imports + 1 analyzer error |
| `npx biome lint ./src` | נכשל: error אחד ב־`src/styles/components.css:1331` |

## backlog ממוין לביצוע

1. **P0 — מסחר:** לבחור payment provider ולבנות checkout, webhook verification, entitlement state, gates server-side, portal/cancel, receipts/invoices, coach seats/plans ו־E2E billing.
2. **P0 — הזמנות:** לפתוח `/join` ב־unauthenticated router, preserve invite code/return URL על פני login/email confirmation, ולהוסיף E2E לכל ענפי invite.
3. **P0 — recovery:** להוסיף `/reset-password` מלא ולעבור E2E על recovery link.
4. **P1 — הרשאות:** להפוך demo coach switch ל־off by default ב־production ולכסות build-env regression test.
5. **P1 — lifecycle/פרטיות:** inventory מלא של ownership; שינוי email, re-authenticated account deletion, cloud-complete export, support channel ותיעוד retention.
6. **P1 — coaching reliability:** להחליף swallow-to-empty בתוצאות שגיאה מפורשות במתאמן/תוכניות, עם retry telemetry.
7. **P1 — reminders:** לפרוס/לאמת Edge functions + secrets + cron; להוסיף health checks ואימות app-closed אמיתי.
8. **P1 — AI:** לפרוס ולמדוד backend, ליישר scope/copy מול יכולת קיימת, ולהוסיף cost/rate/availability observability.
9. **P1 — BBT sync:** לשמור progress בענן ולפתור conflict/restore רב־מכשירי.
10. **P2 — polish/release:** surface program-start errors, להשלים imagery, לסיים statement נגישות, לסנכרן assignment acknowledgement, ולתקן Biome gate.
11. **P3 — תחזוקה:** להסיר theme stub ולעדכן comment AI.

## גבולות הממצאים

- לא נבדקו secrets, billing accounts, DNS, Supabase project, email delivery, Edge deployment או מכשיר פיזי — לא ניתן להסיק מהם מהריפו.
- לא ניתנה חוות דעת רפואית, משפטית או פיננסית.
- ה־working tree הכיל שינויים קיימים שאינם חלק מדוח זה; לא שיניתי קוד אפליקציה או config. המסמך הזה הוא deliverable הבדיקה המבוקש.
