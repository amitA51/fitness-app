# דוח 02 — אבטחה והקשחת Backend

**תאריך הבדיקה:** 2026-07-26  
**תחום:** Supabase / Edge Functions / Auth / פרטיות / גבולות אמון בדפדפן  
**שיטת עבודה:** נקראו `supabase/schema.sql`, כל 39 הקבצים תחת `supabase/migrations/`, ארבע ה־Edge Functions וקוד הלקוח הפעיל. מסמכי `plans/`, `improvements/`, `docs/` וקובצי Markdown ישנים לא שימשו כראיה. ערכי סודות לא נקראו ולא מוצגים כאן.

> **מגבלת ראיה חשובה:** זהו audit סטטי של הקוד וה־SQL שב־repository. הוא מתאר את מצב הסכמה *שאמור* להתקבל לאחר החלת כל המיגרציות; הוא אינו מחליף אימות מול `pg_catalog`, `pg_policies` והגדרות ה־Functions באתר production. שאילתות אימות מוצעות בסוף הדוח.

## תקציר מנהלים

**פסק דין: לא מוכן עדיין ל־production בתשלום.** נמצאו שני P0: (1) נתוני בריאות מקומיים עלולים להישאר במכשיר בעת החלפת session/פג תוקף ולהתמזג לחשבון הבא; (2) הפעולה המוצגת כ״מחק את כל הנתונים״ אינה מוחקת חשבון ואינה מכסה חלק ניכר ממידע הענן. יש גם מסלולי P1 של עקיפת rate limit, paywall שהוא UX בלבד, gates של גיל/הסכמה שנכשלים פתוח, ופערי סמכות בנתוני מאמן/קהילה.

נקודת החוזק המרכזית היא שכבת ה־RLS: כל טבלאות האפליקציה שנוצרו ב־SQL מקבלות `ENABLE ROW LEVEL SECURITY`; טבלאות בעלות מידע אישי מקבלות predicate של בעלים או קשר מאמן פעיל, והטבלאות השרתיות `rate_limit_events`, `billing_events` ו־`reminder_deliveries` הן deny-by-default. גם סבב ההקשחה של `20260629000000_security_audit_fixes.sql` תיקן וקטורי הרשאה משמעותיים. עם זאת, RLS תקין אינו מפצה על מסלולי auth מקומיים, מחיקה חלקית, או Edge Function שמחייבת entitlement רק בצד לקוח.

**חסמי שחרור לפני קבלת לקוחות משלמים:** לסגור P0-01 ו־P0-02; להפוך rate limiting לאטומי ו־fail-closed בפועל; לאכוף entitlement, הסכמה וגיל בשרת; ולסגור את פערי `assignments`/`reminders` והקהילה. לאחר מכן לבצע בדיקת live DB ותרחישי A→B במכשיר משותף.

## טבלת RLS לכל טבלה

הטבלה מתארת את המצב הסופי המשתקף מהמיגרציות. ״תקין״ פירושו שה־RLS והסקופ תואמים את המודל הנראה בקוד; הוא אינו מחליף בדיקת production. הפניות `is_coach_of()` ו־`is_group_member()` נשענות על `auth.uid()` בתוך helper מאובטח (`supabase/migrations/20260529000000_coach_platform.sql:20-56`, הגדרת membership מחמירה ב־`supabase/migrations/20260629000000_security_audit_fixes.sql:143-165`).

| table | RLS | policies קיימות והסקופ | verdict |
|---|---|---|---|
| `workout_templates` | מופעל (`supabase/schema.sql:200`) | CRUD של הבעלים עם `user_id = auth.uid()`; גם CRUD למאמן פעיל דרך policy דינמית (`20260524120000_optimize_rls_auth_uid.sql:20-36`, `20260529000000_coach_platform.sql:446-452`) | תקין, בכפוף למדיניות scopes המוזכרת ב־P1-06 |
| `workout_sessions` | מופעל (`schema.sql:201`) | owner CRUD + מאמן פעיל; `WITH CHECK` נוסף לעדכון (`20260524120000_optimize_rls_auth_uid.sql:42-58`, `20260526000000_add_with_check_to_update_policies.sql:21-26`) | תקין; `user_id` נהיה immutable גם לכתיבת מאמן (`20260629000000_security_audit_fixes.sql:173-206`) |
| `personal_exercises` | מופעל (`schema.sql:202`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:64-80`, `20260529000000_coach_platform.sql:446-452`) | תקין, בכפוף ל־P1-06 |
| `body_weight` | מופעל (`schema.sql:203`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:86-102`, `20260529000000_coach_platform.sql:446-452`) | תקין, עם trigger אי־שינוי `user_id` |
| `body_measurements` | מופעל (`schema.sql:204`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:108-124`, `20260529000000_coach_platform.sql:446-452`) | תקין, עם trigger אי־שינוי `user_id` |
| `personal_records` | מופעל (`schema.sql:205`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:130-146`, `20260529000000_coach_platform.sql:446-452`) | תקין, עם trigger אי־שינוי `user_id` |
| `recovery_logs` | מופעל (`schema.sql:206`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:152-168`, `20260529000000_coach_platform.sql:446-452`) | תקין, עם trigger אי־שינוי `user_id` |
| `nutrition_logs` | מופעל (`schema.sql:207`) | owner CRUD + מאמן פעיל (`20260524120000_optimize_rls_auth_uid.sql:174-190`, `20260529000000_coach_platform.sql:446-452`) | תקין, עם trigger אי־שינוי `user_id` |
| `user_settings` | מופעל (`schema.sql:208`) | CRUD של owner בלבד (`20260524120000_optimize_rls_auth_uid.sql:196-212`) | תקין; מאמנים מוחרגים במפורש |
| `ai_conversations` | מופעל (`schema.sql:209`) | CRUD של owner בלבד (`20260524120000_optimize_rls_auth_uid.sql:218-234`) | תקין; מאמנים מוחרגים במפורש |
| `water_logs` | מופעל (`20260524115000_create_water_logs.sql:11`) | owner CRUD; מדיניות coach הדינמית כוללת אותה כשהטבלה קיימת (`20260524115000_create_water_logs.sql:16-28`, `20260529000000_coach_platform.sql:432-454`) | תקין, בכפוף ל־P1-06 |
| `profiles` | מופעל (`20260529000000_coach_platform.sql:76`) | owner INSERT/UPDATE; SELECT לבעלים/קשר מאמן פעיל, ועוד profile ציבורי עם opt-in (`:79-87`, `20260610000000_advanced_profile.sql:27-29`) | תקין |
| `coach_profiles` | מופעל (`20260529000000_coach_platform.sql:140`) | owner CRUD; לקוח קשור קורא (`:142-148`) | תקין |
| `coach_subscriptions` | מופעל (`20260529000000_coach_platform.sql:163`) | owner SELECT/INSERT/UPDATE (`:165-170`); trigger מאוחר חוסם שינוי `plan`, `seat_limit`, `status` בידי לקוח (`20260629000000_security_audit_fixes.sql:80-131`) | תקין לאחר ההקשחה |
| `coach_clients` | מופעל (`20260529000000_coach_platform.sql:192`) | SELECT/UPDATE/DELETE לשני הצדדים; INSERT של client בלבד וב־`pending` (`20260531130000_security_rls_hardening.sql:13-18`); triggers מגנים על activation, seats ושדות immutable | תקין ברובו; scope JSONB אינו נאכף — P1-06 |
| `coach_invites` | מופעל (`20260529000000_coach_platform.sql:257`) | `FOR ALL` לבעלים `coach_id = auth.uid()` (`:261-262`), seat trigger בעת יצירה (`20260614000100_invite_seat_enforcement.sql:9-46`) | תקין פונקציונלית; role/demo פתוח דורש החלטת מוצר — P1-07 |
| `client_groups` | מופעל (`20260529000000_coach_platform.sql:274`) | מאמן owner מנהל; member פעיל קורא (`:276-278`, `20260629000000_security_audit_fixes.sql:143-163`) | תקין |
| `client_group_members` | מופעל (`20260529000000_coach_platform.sql:288`) | coach-owner מנהל, client קורא/מעדכן את שורתו (`:291-302`, `20260607000000_group_chat.sql:93-100`) | תקין ליעד הקריאה; RPC אטומי מאמת לקוח פעיל (`20260614000000_set_group_members.sql:11-56`) |
| `assignments` | מופעל (`20260529000000_coach_platform.sql:324`) | מאמן owner מנהל; target קורא לפי `client_id`/group בלבד (`:326-334`) | **P1-06:** אין בדיקת קשר active בעת כתיבה/קריאה ליעד |
| `messages` | מופעל (`20260529000000_coach_platform.sql:350`) | SELECT לשני הצדדים; INSERT/UPDATE דורשים קשר active לאחר ההקשחה (`20260531130000_security_rls_hardening.sql:21-49`) | תקין להרשאה פעילה; היסטוריה נשארת נגישה לאחר ניתוק — P2-04 |
| `reminders` | מופעל (`20260529000000_coach_platform.sql:381`) | מאמן owner מנהל; target קורא לפי `client_id`/group בלבד (`:383-390`) | **P1-06:** אין בדיקת קשר active בעת יעד ישיר |
| `push_subscriptions` | מופעל (`20260529000000_coach_platform.sql:404`) | `FOR ALL` לבעלים בלבד (`:406-407`) | תקין; שליחה נבדקת שוב ב־Edge Function |
| `rate_limit_events` | מופעל (`20260529100000_coach_rate_limits.sql:19`) | אין policy — רק service role | תקין כ־deny-by-default; צריכת ה־ledger פגומה ב־P1-01 |
| `check_ins` | מופעל (`20260529110000_coach_check_ins.sql:25`) | owner `FOR ALL`; מאמן active SELECT בלבד (`:31-35`) | תקין |
| `coach_notes` | מופעל (`20260529110000_coach_check_ins.sql:49`) | coach-author `FOR ALL` בלבד (`:54-55`) | סקופ owner תקין; אין אימות קשר active בעת יצירה — מינימיזציית מידע מומלצת |
| `audit_log` | מופעל (`20260529120000_coach_audit_log.sql:22`) | actor INSERT, parties SELECT; policy INSERT הוחמרה לקשר אמיתי (`20260629000000_security_audit_fixes.sql:211-222`) | תקין לאחר ההקשחה |
| `group_messages` | מופעל (`20260607000000_group_chat.sql:34`) | SELECT/INSERT למאמן הקבוצה או member פעיל (`:46-72`) | תקין |
| `coach_program_templates` | מופעל (`20260607000100_program_templates.sql:32`) | coach owner `FOR ALL` (`:41-44`) | תקין |
| `workout_schedule` | מופעל (`20260608000100_workout_schedule.sql:30`) | trainee owner או מאמן active `FOR ALL` (`:33-40`) | תקין להרשאה; `coach_id`/`updated_by` אינם קשורים ל־caller — תקינות ייחוס P2 |
| `legal_documents` | מופעל (`20260609000000_legal_consent.sql:39`) | published documents לקריאה של `anon`/`authenticated` (`:41-43`) | תקין — קטלוג ציבורי |
| `user_consents` | מופעל (`20260609000000_legal_consent.sql:45`) | owner SELECT בלבד; כתיבה דרך RPC (`:47-49`, `:71-92`) | RLS תקין; אמינות consent/app gate פגומה — P1-04 |
| `age_thresholds` | מופעל (`20260609000200_age_verification.sql:17`) | `SELECT ... USING (true)` ל־anon/authenticated (`:19-20`) | **מסומן:** public metadata מכוון; אין מידע אישי |
| `user_age_verification` | מופעל (`20260609000200_age_verification.sql:36`) | owner SELECT בלבד; כתיבה דרך RPC (`:38-44`, `:72-73`) | RLS ו־DOB computation תקינים; app fail-open — P1-04 |
| `achievements` | מופעל (`20260610000000_advanced_profile.sql:42`) | `SELECT ... USING (true)` לקטלוג הציבורי (`:44-46`) | **מסומן:** intended catalog; כתיבת achievement דרך RPC אינה מאמתת הישג — P2-05 |
| `user_achievements` | מופעל (`20260610000000_advanced_profile.sql:57`) | owner, או owner עם profile ציבורי, לקריאה בלבד (`:61-71`) | סקופ קריאה תקין; integrity P2-05 |
| `entitlements` | מופעל (`20260610000100_entitlements.sql:40`) | owner SELECT בלבד; אין כתיבת לקוח (`:42-46`) | תקין כמקור אמת; אינו נאכף בנתיבי premium — P1-03 |
| `billing_events` | מופעל (`20260610000100_entitlements.sql:47`) | אין policy — service role בלבד | תקין כ־deny-by-default |
| `posts` | מופעל (`20260611000000_community.sql:117`) | authenticated read עם block filtering; direct owner INSERT/DELETE (`:119-132`) | **P1-08:** direct INSERT עוקף את ה־RPC הנטען כ־rate-limited |
| `post_comments` | מופעל (`20260611000000_community.sql:134`) | authenticated read עם block filtering; direct owner INSERT/DELETE (`:136-149`) | **P1-08:** אותו פער rate limit |
| `post_reactions` | מופעל (`20260611000000_community.sql:151`) | `SELECT ... USING (true)` ל־authenticated; owner INSERT/DELETE (`:153-160`) | **מסומן:** intended social visibility, אך לייקים גלויים לכל משתמש מחובר |
| `post_reports` | מופעל (`20260611000000_community.sql:162`) | reporter INSERT/read בלבד (`:165-169`) | סקופ תקין; אין rate limit נגד spam — P1-08 |
| `user_blocks` | מופעל (`20260611000000_community.sql:173`) | owner SELECT/INSERT/DELETE (`:175-181`) | תקין |
| `follows` | מופעל (`20260611000000_community.sql:184`) | `SELECT ... USING (true)` ל־authenticated; owner INSERT/DELETE (`:186-192`) | **מסומן:** public social graph, לוודא התאמה למדיניות פרטיות |
| `reminder_deliveries` | מופעל (`20260613000000_reminder_dispatch.sql:28`) | אין policy — service role בלבד | תקין כ־deny-by-default |
| `storage.objects` — `progress-photos` | RLS מנוהל על ידי Supabase Storage; policy slice נוסף בקוד | owner upload/delete, owner או מאמן active read (`20260608000300_progress_photos_storage.sql:20-42`) | תקין, בכפוף לאימות live של RLS המובנה ב־Storage |
| `storage.objects` — `avatars` | כנ״ל | public read ל־bucket `avatars`; owner write/update/delete (`20260610000000_advanced_profile.sql:125-149`) | תקין אם public avatars הוא החלטת מוצר מפורשת |

### מדיניות `USING (true)` שנמצאה

לא נמצאה טבלת אפליקציה עם `DISABLE ROW LEVEL SECURITY` או ללא `ENABLE ROW LEVEL SECURITY` בקוד שנסקר. נמצאו ארבע מדיניות literal `true`, וכולן מסומנות לעיל: `age_thresholds_read` (`20260609000200_age_verification.sql:19-20`), `achievements_read_all` (`20260610000000_advanced_profile.sql:43-46`), `reactions_read` (`20260611000000_community.sql:152-154`) ו־`follows_read` (`:185-187`). שתי הראשונות הן metadata ציבורי; שתי האחרונות חושפות פעילות/גרף חברתי לכל משתמש authenticated ולכן דורשות אישור פרטיות מוצרי מפורש.

### `SECURITY DEFINER` ו־`search_path`

לא נמצא ב־source הנוכחי `SECURITY DEFINER` ללא `SET search_path`. נבדקו helpers וטריגרים של coach (`20260529000000_coach_platform.sql:20-25`, `:91-95`, `:209-213`), role/promotion (`20260608000000_profiles_role.sql:25-29`, `:55-59`), consent/age/entitlement (`20260609000000_legal_consent.sql:52-74`, `20260609000200_age_verification.sql:43-44`, `20260610000100_entitlements.sql:51-53`), community (`20260611000000_community.sql:197-233`), group membership והקשחות מאוחרות (`20260614000000_set_group_members.sql:11-15`, `20260629000000_security_audit_fixes.sql:39-84`, `:143-176`). גם grants הוקשחו מ־`PUBLIC` ל־`authenticated`/`service_role` היכן שנדרש (`20260615000100_harden_secdef_function_grants.sql:9-23`).

## P0 — חסמי שחרור

| ID | ממצא והשפעה | ראיה בקוד | תיקון נדרש |
|---|---|---|---|
| **P0-01** | **דליפת נתונים בין חשבונות במכשיר משותף בעת שינוי session שאינו `signOut` ידני.** `signOut()` המפורש אכן מנקה IDB ו־localStorage, אך `handleExpiredSession()` קורא ישירות ל־`supabase.auth.signOut()` ולא ל־cleanup. בנוסף, listener של auth מטפל ב־`SIGNED_IN` באמצעות `pullAllData()` בלבד; pull ממזג ענן לתוך IndexedDB ואינו מנקה קודם את נתוני המשתמש הקודם. לכן token שפג, logout מטאב אחר או כניסה לחשבון B בלי לחיצה על התנתקות של A עלולים להשאיר אימונים, משקל, תזונה ושיחות AI של A על המכשיר. | ניקוי נמצא רק ב־`src/services/supabaseAuth.ts:274-311` ונקרא ב־`signOut()` ב־`:335-359`; expiry מבצע sign-out ישיר ב־`:124-134`; auth listener מושך data ב־`src/contexts/AuthContext.tsx:96-123`; pull מבצע merge ב־`src/services/supabaseSyncOrchestrator.ts:469-590`. | להפריד guest namespace מ־user namespace, ולנקות atomically בכל מעבר `previousUserId !== nextUserId` וגם ב־`SIGNED_OUT`/expiry. להוסיף בדיקת E2E A→expiry/A→B ו־A→sign-in(B) ללא logout. |
| **P0-02** | **אין “delete my account” אמיתי, ו״מחק את כל הנתונים״ אינו מוחק את כל המידע.** הפונקציה מוחקת רק 11 טבלאות sync לפי `user_id`; היא אינה מוחקת את `auth.users`, מידע coaching/community/legal/age/billing, אובייקטי Storage, או כל מפתח localStorage. ה־UI מבטיח שהכול יימחק לצמיתות. זהו סיכון פרטיות/ציות ויוצר הבטחת UX שגויה. | רשימת 11 הטבלאות ב־`src/services/settingsService.ts:53-65`; מחיקה היא רק `.from(table).delete().eq('user_id', userId)` ב־`:78-93`; ניקוי localStorage מכיל ארבעה מפתחות בלבד ב־`:43-48`, בעוד `bbt_program_progress_v1` נשמר בנפרד ב־`:160-165`. ההבטחה למשתמש נמצאת ב־`src/pages/settings/sections/DangerZoneSection.tsx:35-54`. | Edge Function מחיקה מאומתת מחדש שמוחקת Storage פרטי, רשומות שאינן `user_id`, ולאחר policy retention מתועדת מוחקת את `auth.users`; או לשנות את UX ל״מחק נתוני אימון מקומיים ומסונכרנים״ עד שהמסלול הושלם. |

## P1 — לתקן לפני פתיחת שירות בתשלום

| ID | ממצא והשפעה | ראיה בקוד | תיקון נדרש |
|---|---|---|---|
| **P1-01** | **Rate limit של `ai-chat` ושל `coach-invite-accept` אינו fail-closed בפועל.** Supabase מחזיר שגיאות PostgREST ב־`{ error }`, אך הקוד קורא רק `count` ולא בודק `error`; גם תוצאת `insert()` ל־ledger נזרקת. לכן שגיאת DB/RLS/מיגרציה יכולה להיראות כ־count אפס, וה־`catch` לא ירוץ. מעבר לכך, read-then-insert אינו אטומי ומאפשר burst מקביל לעבור את המכסה. התוצאה: עלות AI בלתי מוגבלת או brute force של codes. | AI: `supabase/functions/ai-chat/index.ts:192-226`; invite: `supabase/functions/coach-invite-accept/index.ts:71-96`. ה־ledger עצמו מוגן נכון ב־RLS ללא policies (`supabase/migrations/20260529100000_coach_rate_limits.sql:8-19`). | להעביר את consume+count ל־RPC אטומי/transaction עם advisory lock או counter window; לבדוק כל `error` ולהחזיר 503 לפני כל קריאת ספק. להוסיף test שמדמה `{ error }` ולא throw, ו־parallel 50 requests. |
| **P1-02** | **`ai-chat` אינו קשיח נגד prompt injection או ניצול מכסה.** השרת מקבל role `system` מהלקוח ומעביר את כל `parsed.messages` upstream; ה־persona נמצא רק בקוד לקוח ואפשר לעקוף אותו בקריאת Function ישירה. `temperature` ו־`maxTokens` נבדקים רק כ־number, ללא range/cap. כמו כן, cap המבוסס `content-length` אינו מחייב מגבלת גוף כשהכותרת חסרה. | השרת מקבל role ומספרים מהלקוח ב־`supabase/functions/ai-chat/index.ts:266-288` ומעביר אותם ב־`:368-371`; ה־cap הוא רק header ב־`:330-349`. ה־persona הוא client-side ומשרשר system messages שסופקו בידי caller ב־`src/services/ai/config.ts:82-91`; הקריאה עצמה שולחת אותו דרך הדפדפן ב־`src/services/ai/core.ts:159-170`. | לקבל מהלקוח רק `user`/`assistant`, לבנות system prompt וסכמת safety בשרת, להגביל מספר הודעות/bytes לאחר streaming read, ו־clamp ל־`temperature` ול־`maxTokens`. לאכוף entitlement גם כאן (P1-04). |
| **P1-03** | **כל gates של premium הם UX בלבד; פעולות server-side אינן בודקות entitlement.** ה־Context עצמו מצהיר שה־gate הוא UX-only. `ai-chat` מאמת JWT ומבצע rate limit, אך אינו קורא `entitlements`; RLS של cloud sync, photos ותבניות גם אינה תלויה ב־plan. משתמש יכול לעקוף רכיב React או לקרוא API/Function ישירות. | `src/contexts/EntitlementContext.tsx:1-10`, `:88-101`; רשימת premium features ב־`src/services/billing/types.ts:31-44`; `entitlements` מאפשרת owner-read בלבד ב־`supabase/migrations/20260610000100_entitlements.sql:40-63`; אין check entitlement ב־`supabase/functions/ai-chat/index.ts:138-371`. | ליצור `assert_paid_entitlement()`/בדיקת entitlement בצד שרת ולהשתמש בה בכל Edge Function ו־RPC premium; RLS/trigger ל־quotas כגון templates/photos; להשאיר `PlanGate` כ־UX בלבד, לא כגבול אבטחה. |
| **P1-04** | **גיל והסכמה משפטית נכשלים פתוח, ואישור ההסכמה אינו אמין.** `getLegalConsentStatus()` מחזיר מערך ריק בעת תקלה; `recordConsent()` בולע שגיאה; לכן `ConsentContext` יכול להסיר gate בלי שנרשמה הסכמה. RPC `record_consent` מקבל מהלקוח `_is_minor` ו־`_guardian_ack` בלי לקשור אותם לטבלת גיל. `ageGate` מחזיר verified כאשר Supabase לא מוגדר או migration חסרה. | `src/services/consent/consentService.ts:1-9`, `:31-69`; `src/contexts/ConsentContext.tsx:5-67`; RPC הסכמה ב־`supabase/migrations/20260609000000_legal_consent.sql:71-89`; fail-open גיל ב־`src/services/ageGate.ts:30-61`. | ב־production: fail closed לכל error/migration חסרה; `recordConsent` יחזיר success רק לאחר RPC מצליח; derive minor/guardian state מהשרת ולא מפרמטרי הדפדפן; לאכוף age/consent ב־Edge Functions ובפעולות מוגנות. |
| **P1-05** | **מחיקת/ייצוא פרטיות אינם שלמים.** יש CSV תקין לאימונים ו־JSON backup מקומי, אך אין export data-subject מלא מן הענן (consents, age, coaching, community, profile, push, storage). בנוסף אין account-deletion workflow כפי שמתואר ב־P0-02. | CSV פועל על sessions שנמסרו לו בלבד ב־`src/services/exportService.ts:8-39`; full backup קורא IndexedDB/localStorage בלבד ב־`src/services/settingsService.ts:134-205`. | להוסיף `export-my-data` שרתי שמייצר archive חתום, כולל כל קטגוריה וה־Storage המותר; לנהל retention חריגים במפורש ובשקיפות. |
| **P1-06** | **גבול consent של מאמן אינו נאכף עקבית.** `assignments` ו־`reminders` מאפשרים למאמן owner ליצור יעד `client_id` שרירותי; policy היעד בודקת רק שהקורא הוא היעד, לא שהקשר active. בנוסף השדה `coach_clients.scopes` קיים, אך policy של גישת נתוני בריאות בודקת רק `is_coach_of(user_id)`, ולכן read/write scopes אינם נאכפים בשרת. | schema: `scopes JSONB` ב־`supabase/migrations/20260529000000_coach_platform.sql:175-205`; target policies ב־`:324-334`, `:381-390`; גישת הנתונים המאומנת משתמשת רק `is_coach_of` ב־`:432-452`. | להוסיף `WITH CHECK (EXISTS coach_clients active ...)` עבור assignment/reminder direct target; לדרוש `can_coach(user_id, 'read'/'write')` בכל policy/RPC; למחוק או להסתיר assignments/reminders לאחר `ended` בהתאם למדיניות retention. |
| **P1-07** | **Demo coach switch פתוח כברירת מחדל ב־production build אם variable חסר.** `VITE_DEMO_VIEW_SWITCH !== 'false'` פותח לכל authenticated את coach view ומפעיל `become_coach`. ה־RPC עצמה granted לכל `authenticated`; לכן אם coach mode אמור להיות feature מורשה/בתשלום, אין אכיפה אמיתית. | `src/contexts/CoachContext.tsx:34-43`, `:204-245`; `become_coach` ו־grant ב־`supabase/migrations/20260608000000_profiles_role.sql:55-82`. | להגדיר `VITE_DEMO_VIEW_SWITCH=false` ב־production ולשנות default ל־false; אם role אינו self-service, לדרוש claim/admin approval/entitlement בתוך `become_coach` ובטריגרים של invites. אם self-service מכוון, לתעד זאת ולהפריד capabilities בתשלום בצד שרת. |
| **P1-08** | **קהילה: הגנת rate-limit מוצהרת אינה קיימת ב־SQL הפעיל וניתנת לעקיפה.** הלקוח מצפה ל־`create_post`/`create_comment` rate-limited RPCs, אך לא נמצאה הגדרתן בכל migrations. במקביל נשארו policies של direct INSERT ל־authenticated, כך שגם אם RPC קיימת ידנית, אפשר לעקוף אותה דרך REST. `post_reports` גם פתוחה ל־INSERT בלי rate limit. | client: `src/services/community/communityService.ts:203-230`, `:284-313`; migrations: policies direct ב־`supabase/migrations/20260611000000_community.sql:127-149`, reports ב־`:162-169`; סריקת כל migrations לא מצאה `create_post` או `create_comment`. | ליצור RPCs versioned עם validation/rate limiting, revoke/drop direct INSERT policies, ולהחיל מכסת report/post/comment אטומית. להוסיף migration test שמוודא שה־RPC קיימת. |
| **P1-09** | **`coach-push-send` מאפשר phishing/spam בידי מאמן מורשה/חשבון שנפרץ.** ה־Function מאפשר כל `https://` URL ולא רק origin של האפליקציה; ה־service worker מנווט/פותח אותו בלחיצה. אין rate limit לשליחה, אף ש־coach יכול לשלוח ללקוחות פעילים. | URL policy: `supabase/functions/coach-push-send/index.ts:70-110`; ניווט עיוור ב־`public/push-sw.js:27-38`. | לאשר רק relative internal paths או allowlist קשיח של origin; להוסיף limit per coach/target/day ו־audit log; להגביל title/body/URL באורך ובתווים. |
| **P1-10** | **Guest→cloud אינו migration אוטומטי.** אחרי `SIGNED_IN` הקוד מושך מהענן בלבד; העלאת כל נתוני guest קיימת רק בלחיצת משתמש ב־Settings. משתמש שנרשם ואז מתנתק לפני manual sync עלול לאבד נתונים מקומיים (בפרט לאחר תיקון P0-01). | `src/contexts/AuthContext.tsx:105-123` מפעיל רק `pullAllData`; upload נחשף רק ב־`src/pages/settings/hooks/useCloudSync.ts:59-83`, ו־`syncAllData` הוא הפעולה שמעלה IDB ב־`src/services/supabaseSyncOrchestrator.ts:102-443`. | לאחר sign-up להציג בחירה מפורשת ״העבר נתוני אורח לחשבון״; לבצע upload אטומי/מנוטר לפני pull, או לשמור local data תחת namespace `guest` עד אישור המשתמש. |

## P2 — הקשחות חשובות

| ID | ממצא והשפעה | ראיה בקוד | תיקון מומלץ |
|---|---|---|---|
| **P2-01** | **CORS אינו wildcard, אך denial מחזיר `Access-Control-Allow-Origin: null`.** origin אטום (`Origin: null`) יכול להתאים מילולית לערך זה. CORS אינו auth, אך אין סיבה להעניק read access ל־opaque origins. | `ai-chat` ב־`supabase/functions/ai-chat/index.ts:50-76`; invite/push ב־`coach-invite-accept/index.ts:23-38`, `coach-push-send/index.ts:27-42`. | כש־origin לא מורשה: לא להחזיר header בכלל, או להחזיר 403 ל־non-OPTIONS; לא להשתמש במחרוזת `null` כ־allow origin. |
| **P2-02** | **הגדרת `reminders-dispatch` אינה codified בקובץ config.** שלוש Functions אינטראקטיביות מוגדרות `verify_jwt = true`, אך ל־dispatcher אין `config.toml`; ההפעלה תלויה בפקודת deploy מתועדת עם `--no-verify-jwt`. ה־shared secret מגן טוב, אבל קיימת סטיית configuration בין environments. | configs קיימים: `ai-chat/config.toml:2`, `coach-invite-accept/config.toml:2`, `coach-push-send/config.toml:2`; dispatcher מתעד deploy process ב־`supabase/functions/reminders-dispatch/index.ts:8-25` ומאמת `CRON_SECRET` ב־`:89-104`. | לנהל את `verify_jwt = false` בקובץ `supabase/config.toml`/CI versioned, ובבדיקת deploy לוודא ש־`CRON_SECRET` מוגדר. להשאיר את secret guard גם לאחר מכן. |
| **P2-03** | **Sentry מחטא חלקית בלבד.** טוב: `sendDefaultPii:false`, מחיקת request, breadcrumbs, `extra.data` וצמצום user. חסר: `reportError` מעביר `ctx.extra` כפי שהוא, ו־exception message / React component stack אינם עוברים scrub כללי. שגיאת backend עשויה לשאת email, URL עם token או תוכן משתמש. | scrub ב־`src/main.tsx:38-58`; passthrough ב־`src/services/errorReporter.ts:12-30`; ErrorBoundary שולח `error` ו־component stack ב־`src/errors/RootErrorBoundary.tsx:21-34`. | beforeSend recursive allowlist (tags בלבד, IDs hash), redact email/JWT/query string/phone; אל תשלחו raw `extra` או error text שנובע מתגובה חיצונית. |
| **P2-04** | **הודעות 1:1 נשארות קריאות לאחר ניתוק מאמן.** זו החלטה מפורשת בקוד, אך היא חייבת להיות policy/retention שקוף: סיום consent אינו מבטל גישה להיסטוריה רפואית/אישית שנכתבה בשיחה. | `supabase/migrations/20260531130000_security_rls_hardening.sql:36-49`, וההחלטה מתועדת ב־`:81-83`. | להחליט ולתעד retention; אם נדרש revoke מלא, להוסיף active-link ל־SELECT או ארכוב/מחיקה מוצפנת בתום התקופה. |
| **P2-05** | **כל authenticated יכול להעניק לעצמו כל achievement קיים.** `award_achievement` מאמת רק `auth.uid()` ו־FK, לא את תנאי ההישג. זהו integrity/gamification risk, לא חשיפת נתונים. | `supabase/migrations/20260610000000_advanced_profile.sql:78-98`. | לחשב הישגים בשרת מטריגרים/cron או להכניס rules מאומתים; לחלופין לסמן achievements כ־client-only ולא כאמינים. |
| **P2-06** | **גם logout ידני אינו מנקה כל local/session state.** רשימת cleanup אינה כוללת למשל `bbt_program_progress_v1`, `appSettings`, `onboarding_completed`, `pending_invite_code`, `ai_current_conversation`, `sparkos_last_workout_date` וטיוטות session. חלקם מידע אישי/מצב workflow של A שיכול להופיע ל־B. בנוסף `persistSession: true` משאיר את session של Supabase ב־default browser storage; זו בחירה מקובלת אך מחייבת XSS/CSP חזקים. | רשימת cleanup ב־`src/services/supabaseAuth.ts:15-56`, `:274-311`; מפתחות אחרים ב־`src/services/settingsService.ts:160-165`, `src/contexts/SettingsContext.tsx:118-138`, `src/pages/JoinPage.tsx:11-37`, `src/main.tsx:114`, `src/pages/onboarding/useOnboardingWizard.ts:12-43`; session persistence ב־`src/lib/supabase.ts:8-20`. | לנהל registry יחיד של כל user-scoped keys; לנקות sessionStorage ומפתחות דינמיים; עדיף per-user DB/key prefix. להפעיל CSP קשיח ולהימנע מ־XSS כדי להגן על refresh token. |
| **P2-07** | **שגיאות upstream של AI מוחזרות ללקוח raw/כמעט raw.** network error כולל `e.message`, ו־non-OK מחזיר עד 500 תווים מגוף ספק. זה עלול לחשוף פרטי ספק, trace או metadata פנימי לכל משתמש authenticated. | `supabase/functions/ai-chat/index.ts:384-400`. | ללוג server-side עם correlation ID; ללקוח להחזיר קוד כללי בלבד (`provider_unavailable`), בלי `e.message` או upstream body. |

## Edge Functions — מצב מפורט

| Function | JWT / CORS | rate limit וולידציה | service role / error handling | verdict |
|---|---|---|---|---|
| `ai-chat` | `verify_jwt = true` (`supabase/functions/ai-chat/config.toml:2`); header Bearer ו־claims נבדקים (`index.ts:121-155`); allowlist origins ללא wildcard, אך `null` בעייתי | model allowlist, הודעה עד 4,000 תווים ו־64KB header cap; אין cap אמיתי ל־tokens/temperature/messages; ledger פגום (P1-01) | `SUPABASE_SERVICE_ROLE_KEY` נשאר ב־Deno לצורך ledger (`:173-187`), לא בדפדפן; upstream errors דולפים (P2-07) | **P1** |
| `coach-invite-accept` | `verify_jwt = true` (`config.toml:2`); `auth.getUser()` עם token caller (`index.ts:52-63`); CORS allowlist עם `null` | code trim/upper/64 chars (`:106-116`); user+IP limiter אך error handling פגום (P1-01); seat trigger הוא defense-in-depth | service role מחפש invite ומבצע upsert; מחזיר errors מצומצמים | **P1** עד תיקון limiter |
| `coach-push-send` | `verify_jwt = true` (`config.toml:2`); `auth.getUser()`; מאמת active coach→client server-side (`index.ts:64-96`); CORS caveat | title/body נחתכים, אך URL מאפשר כל HTTPS; אין rate limit | service role קורא subscriptions, מפתח VAPID נשאר server-side; לא מחזיר exception raw | **P1** ל־phishing/spam |
| `reminders-dispatch` | מיועד machine call ללא JWT; `CRON_SECRET` fail-closed (`index.ts:89-104`); אין CORS כי אינו endpoint דפדפן | dedup אטומי ב־`reminder_deliveries`; אין צורך user rate limit | service role, VAPID keys ב־Deno בלבד; DB `error.message` מוחזר למי שמחזיק cron secret (`:105-118`) | **P2** configuration/error exposure |

## Secrets, env, דפדפן ודפוסים מסוכנים

### משתני סביבה החשופים ל־bundle

Vite חושף רק `VITE_*`. לפי `.env.example` ושימושי `import.meta.env`, אלו המשתנים הנראים ללקוח:

| env var | שימוש | רגיש? |
|---|---|---|
| `VITE_SUPABASE_URL` | יצירת client (`src/lib/supabase.ts:8-17`) | לא; URL ציבורי |
| `VITE_SUPABASE_ANON_KEY` | יצירת client (`src/lib/supabase.ts:8-17`) | אינו secret, אך RLS/JWT/quotas חייבים להגן עליו |
| `VITE_SENTRY_DSN` | bootstrap Sentry (`src/main.tsx:32-42`) | DSN public ingest identifier, לא service credential |
| `VITE_VAPID_PUBLIC_KEY` | push subscribe (`src/services/coach/pushService.ts:6-12`) | public by design |
| `VITE_ENABLE_BUNDLE_ANALYZER` | build-only toggle (`vite.config.ts:95-101`) | לא רגיש |
| `VITE_DEMO_VIEW_SWITCH` | coach demo gate (`src/contexts/CoachContext.tsx:40-43`) | לא secret, אך מסוכן כ־production authorization toggle (P1-07) |

`ALLOWED_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY`, `POLOAI_API_KEY`, `VAPID_PRIVATE_KEY` ו־`CRON_SECRET` חייבים להישאר סודות סביבת Edge/CI ולא להיות בעלי prefix `VITE_`. סריקה סטטית redacted של `src/` לא העלתה ערך credential hard-coded מאומת; התוצאות היו שדות password של טפסים ומקרי test, ולא ערך סוד. אין בקוד הלקוח שימוש מאומת ב־service-role או במפתח ספק AI.

### דפוסים מסוכנים שנסקרו

* לא נמצא שימוש runtime ב־`dangerouslySetInnerHTML`, `eval(...)` או assignment ל־`.innerHTML` תחת `src/`.
* כל `target="_blank"` שנמצא בקוד הפעיל מלווה ב־`rel="noopener noreferrer"`, למשל `src/components/consent/CookieConsentBanner.tsx:80-84` ו־`src/components/consent/ConsentCheckboxes.tsx:64,80`.
* אין שמירה ידנית של JWT בשם אפליקטיבי; למרות זאת `persistSession: true` משתמש ב־storage ברירת המחדל של Supabase (P2-06).
* CSV export מנטרל formula injection באמצעות prefix ו־escaping (`src/services/exportService.ts:132-153`) — נקודת חוזק.

## מה כבר תקין

1. **Owner RLS מוצק בנתוני הליבה.** כל עשר טבלאות הבסיס מקבלות RLS, owner CRUD ו־`WITH CHECK`; מיגרציית אופטימיזציית `auth.uid()` שומרת על הסקופ (`supabase/schema.sql:200-209`, `supabase/migrations/20260524120000_optimize_rls_auth_uid.sql:19-255`).
2. **הקשחות coach שכבר בוצעו הן משמעותיות.** activation של client נחסם, subscription fields מוגנים, membership דורש קשר active, ו־`user_id` של שמונה טבלאות health אינו ניתן להעברה (`supabase/migrations/20260629000000_security_audit_fixes.sql:39-206`).
3. **נתוני שרת רגישים הם deny-by-default.** `rate_limit_events`, `billing_events` ו־`reminder_deliveries` כולן RLS-on ללא policy client (`20260529100000_coach_rate_limits.sql:19`, `20260610000100_entitlements.sql:47-49`, `20260613000000_reminder_dispatch.sql:24-31`).
4. **`SECURITY DEFINER` הוקשח.** נמצאו `SET search_path` ו־revoke/grant מתאימים, ולא נמצא definer לא pinned; grants ל־helpers/trigger functions מוקשחים ב־`20260615000100_harden_secdef_function_grants.sql:9-23`.
5. **מפתחות שרת נשמרים ב־Edge Runtime.** AI, VAPID ו־service role נשלפים דרך `Deno.env`, והלקוח פונה רק ל־Function או ל־anon client (`supabase/functions/ai-chat/index.ts:173-187`, `supabase/functions/coach-push-send/index.ts:52-66`).
6. **Edge Functions אינטראקטיביות דורשות JWT תקין.** שלוש `config.toml` מגדירות `verify_jwt = true`, וב־invite/push יש גם `auth.getUser()` server-side (`supabase/functions/coach-invite-accept/config.toml:2`, `supabase/functions/coach-push-send/config.toml:2`).
7. **Sentry מתחיל רק לאחר consent** ומנקה request/breadcrumbs/user בסיסי (`src/main.tsx:23-58`). יש להשלים את P2-03, אך בסיס privacy-by-consent קיים.
8. **logout ידני כן מנקה את רוב ה־IDB וה־offline queue.** זה בסיס טוב לתיקון P0-01 (`src/services/supabaseAuth.ts:15-56`, `:274-359`).

## תוכנית תיקון מסודרת

### 0. מיידי — isolation, account deletion, release freeze

**א. להפוך ניקוי local state לחלק מכל מעבר זהות, לא רק מכפתור logout.** יש להחזיק owner ID של ה־namespace, למחוק לפני pull של משתמש אחר, ולהימנע ממחיקת נתוני guest ללא מסך migration מפורש.

```ts
// src/services/localAccountIsolation.ts — כיוון מוצע
export async function clearPreviousAccountData(): Promise<void> {
  await clearMutationQueue();
  await Promise.all(Object.values(STORES).map((store) => dbClear(store)));
  for (const key of USER_SCOPED_KEYS) localStorage.removeItem(key);
  sessionStorage.clear();
}

// AuthContext: לפני pullAllData(), ורק כשזו זהות קודמת אמיתית
if (previousUserId.current && previousUserId.current !== nextSession?.user.id) {
  await clearPreviousAccountData();
}
previousUserId.current = nextSession?.user.id ?? null;
```

בפתרון ארוך טווח עדיף `IndexedDB` per-user (`sparkos-fitness-db:<userId>`) או key prefix, ולא רשימת cleanup ידנית שעלולה להיסחף.

**ב. לבנות `delete-my-account` server-side עם re-authentication.** אין לאפשר service-role בדפדפן. המסלול צריך להסיר Storage פרטי, למחוק נתונים שאינם נתלים ב־FK ל־`auth.users`, ולמחוק auth user רק לאחר שבוצעה מדיניות retention מפורשת ל־invoice/audit data.

```ts
// supabase/functions/delete-my-account/index.ts — שלד עקרוני
const { data: { user }, error } = await caller.auth.getUser();
if (error || !user) return json({ error: 'unauthenticated' }, 401);
// Require a recent re-auth / MFA assertion here.
await deletePrivateStorageForUser(admin, user.id);
await deleteNonCascadingRows(admin, user.id); // community, pushes, coach rows, etc.
const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true);
if (deleteError) return json({ error: 'delete_failed' }, 500);
return json({ ok: true }, 200);
```

**ג. לספק export מלא בצד שרת.** `export-my-data` צריך לאסוף את כל הטבלאות שה־user רשאי לראות כבעלים, storage references עם URLs זמניים, ותיאור מכונה-קריא של נתונים מוחרגים/מוחזקים חוקית.

### 1. בתוך 48 שעות — אכיפת backend וריסון עלויות

**א. להחליף rate-limit read-then-write ב־RPC אטומי.** הדוגמה הבאה גם בודקת error במפורש וגם מאפשרת edge fail-closed:

```sql
create or replace function public.consume_rate_limit(
  p_bucket text, p_subject text, p_window interval, p_limit integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare used_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_subject, 0));
  select count(*) into used_count
  from public.rate_limit_events
  where bucket = p_bucket and subject = p_subject
    and created_at >= now() - p_window;
  if used_count >= p_limit then return false; end if;
  insert into public.rate_limit_events(bucket, subject) values (p_bucket, p_subject);
  return true;
end;
$$;
revoke all on function public.consume_rate_limit(text, text, interval, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, text, interval, integer) to service_role;
```

```ts
const { data: allowed, error } = await admin.rpc('consume_rate_limit', {
  p_bucket: 'ai_chat_min', p_subject: userId, p_window: '1 minute', p_limit: 10,
});
if (error || allowed !== true) return limiterUnavailableOr429(req, error);
```

**ב. לנרמל AI input בשרת.** אל תסמכו על `withPersona()` מהלקוח:

```ts
const userMessages = body.messages
  .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
    m?.role === 'user' || m?.role === 'assistant')
  .slice(-20)
  .map((m) => ({ ...m, content: m.content.slice(0, 4_000) }));

const payload = {
  model: DEFAULT_MODEL,
  messages: [{ role: 'system', content: SERVER_SAFETY_PROMPT }, ...userMessages],
  temperature: Math.min(1, Math.max(0, requestedTemperature ?? 0.7)),
  max_tokens: Math.min(1_024, Math.max(1, requestedMaxTokens ?? 1_024)),
};
```

החזירו ללקוח רק `{ error: { code: 'provider_unavailable', message: '...' } }`; את `upstream.text()` ו־`e.message` שמרו ב־server logs עם correlation ID.

**ג. להוסיף server-side entitlement guard.** לדוגמה, Edge Function תקרא `entitlements` עם service role או RPC scoped לפני קריאת ספק AI:

```ts
const { data: entitlement, error } = await admin
  .from('entitlements')
  .select('plan,status,current_period_end')
  .eq('user_id', userId)
  .maybeSingle();
const entitled = entitlement?.plan !== 'free' && ['active', 'trialing'].includes(entitlement?.status ?? '');
if (error || !entitled) return errorResponse(req, 'payment_required', 'Premium access required', 402);
```

אותו עיקרון צריך לכסות quota של cloud sync, photos ותבניות, לפי מוצר.

### 2. בתוך שבוע — consent, coach boundaries, community, push

**א. להפוך consent/age ל־fail-closed בפרודקשן.** `recordConsent()` יחזיר `false`/throw כשה־RPC נכשל; gate יישאר פתוח רק בסביבת development מפורשת. ב־SQL אל תקבלו minor/guardian values מהלקוח כאמת:

```sql
-- בתוך record_consent(): derive the state instead of accepting client booleans
select age_verified, parental_consent_status
into v_verified, v_parental
from public.user_age_verification
where user_id = auth.uid();
if v_verified is distinct from true and v_parental <> 'granted' then
  raise exception 'age_or_guardian_requirement_not_met';
end if;
```

**ב. לאכוף active relationship ו־scopes ב־RLS.**

```sql
create or replace function public.can_coach(p_client uuid, p_scope text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_clients cc
    where cc.coach_id = auth.uid() and cc.client_id = p_client and cc.status = 'active'
      and coalesce((cc.scopes ->> p_scope)::boolean, false)
  );
$$;

-- דוגמה: policy assignment direct target
with check (coach_id = auth.uid() and public.can_coach(client_id, 'write'));
```

יש לעדכן גם את `reminders`, `coach_notes` ואת policies הדינמיים של health data. עבור קבוצות, הגישה צריכה להיגזר מהקשר active הנוכחי בלבד.

**ג. ליישר את community עם ה־RPC contract.**

```sql
-- לאחר יצירת create_post/create_comment מאומתים ומוגבלי קצב:
drop policy if exists posts_insert_own on public.posts;
drop policy if exists comments_insert_own on public.post_comments;
-- ה־RPCs צריכים validate body/topic, rate-limit atomically, ולחזור עם row.
```

**ד. לקבע push ל־origin של המוצר.**

```ts
const appOrigin = new URL(env('APP_ORIGIN'));
const candidate = new URL(String(payload.url ?? '/'), appOrigin);
const url = candidate.origin === appOrigin.origin ? `${candidate.pathname}${candidate.search}` : '/';
```

הוסיפו rate limit במודל coach/target/day, audit log, ו־URL/title/body validation.

### 3. הקשחות configuration ו־observability

1. הגדירו `VITE_DEMO_VIEW_SWITCH=false` ב־production **וגם** שנו את ברירת המחדל בקוד ל־false. אם coach access אינו ציבורי, בדקו entitlement/approval בתוך `become_coach`.
2. קבעו `reminders-dispatch` ב־config versioned ולא רק בהוראת deploy; השאירו `CRON_SECRET` כבדיקת server-side נוספת.
3. CORS: בהיעדר origin מורשה אל תשלחו `Access-Control-Allow-Origin`; לעולם לא `'null'`.
4. Sentry: allowlist ל־tags/extra, hash ל־IDs, regex redaction ל־email/JWT/query tokens, ובדיקת unit ל־`beforeSend` עם payload רגיש.
5. הוסיפו CSP production קשיח (`script-src` ללא unsafe inline ככל האפשר), כדי לצמצם סיכון ל־session שנשמר ב־browser storage.

### 4. בדיקות release שחובה להריץ מול staging/production

```sql
-- RLS live verification
select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public') and c.relkind = 'r'
order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- SECURITY DEFINER / search_path live verification
select n.nspname, p.proname, p.prosecdef, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;
```

בדיקות אפליקטיביות נדרשות: (1) A logout, expiry, tab logout ו־sign-in(B) ללא שאריות; (2) direct REST מ־B לכל `user_id` של A; (3) free user שקורא ל־`ai-chat`/photo/template API ישירות; (4) parallel 50 AI/invite requests בזמן DB error; (5) PWA push עם external URL; (6) export/delete מול כל קטגוריות המידע; (7) coach ended link מול messages, assignments, reminders, group chat ו־photos.
