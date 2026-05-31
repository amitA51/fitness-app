# 03 — אבטחה · תיק עבודה לסוכן Security

> **תפקידך:** סוכן אבטחה. המוקד: supply-chain, Supabase RLS (במיוחד פלטפורמת המאמן עם גישה חוצת-משתמשים), Edge Functions, auth, ו-XSS. כל הממצאים מאומתים מול הקוד/הסכמה החיים.

---

## ⚠️ עבודה במקביל (קרא תחילה)
אמת כל ממצא מול הקוד/הסכמה החיים לפני עריכה; מספרי שורות = קירוב. **התעלם מ-`docs/`/`plans/`.**
**שינויי DB/RLS — רק על Supabase branch, עם גיבוי, אף פעם לא ישירות בפרודקשן.** הרץ `get_advisors` (security) אחרי כל שינוי. בכל commit: `npm run verify && npm run test:run`.

---

## טבלת עדיפויות

| מזהה | ממצא | חומרה | מאמץ |
|------|------|:-----:|:----:|
| S-1 | `ecc-universal` — תלות supply-chain עם install script, לא בשימוש | **Critical** | S |
| S-2 | `coach_clients` INSERT — לקוח יכול ליצור קשר `active` עם כל מאמן (עוקף invite) | High | S |
| S-3 | `messages` INSERT — שליחה ללא קשר פעיל (מאמן מנותק עדיין שולח) | High | S |
| S-4 | `coach_clients` UPDATE — כל צד משנה כל עמודה (`scopes`,`consent_at`) | Medium | M |
| S-5 | ai-chat Edge — אימות JWT מבני בלבד; אין `config.toml` עם `verify_jwt` | Medium | S |
| S-6 | `dompurify` מותקן ולא בשימוש (כיום בטוח; סיכון עתידי) | Medium | S |
| S-7 | `messages` SELECT/UPDATE — אין אימות קשר פעיל | Medium | S |
| S-8 | invite code — modulo bias קל באלפבית 30 תווים | Low | S |
| S-9 | rate-limit ב-`coach-invite-accept` נכשל פתוח (fail-open) | Low | S |
| S-10 | `getUnreadCount` סופר על פני כל ה-threads (כולל קשרים שהסתיימו) | Low | S |
| S-11 | `impeccable` — תלות runtime לא בשימוש | Low | S |
| S-12 | CSP `style-src 'unsafe-inline'` (מקובל לארכיטקטורה הנוכחית) | Low | L |

---

## ממצאים מפורטים

### S-1 · `ecc-universal` — supply-chain — **Critical**
- **מיקום:** `package.json` (`ecc-universal@1.10.0` ב-dependencies), `package-lock.json` (`"hasInstallScript": true`). **לא מיובא ב-`src/`** (אמת: `grep -r "ecc-universal" src`). מריץ קוד ב-`npm install`, bins `ecc`/`ecc-install`, תלוי ב-`sql.js` — דפוס typosquat קלאסי.
- **תיקון:** `npm uninstall ecc-universal`; נקה lockfile; `npm install` נקי. שקול `npm ci --ignore-scripts` ב-CI. בדוק מכונות dev/CI שהריצו install מאז שנוסף.
- **DoD:** הוסר מ-package.json+lock; `npm run build`+`test:run` עוברים; `npm audit` נקי מהחבילה.
- **תיאום:** משותף עם 06-Arch. אתה הבעלים.

### S-2 · `coach_clients` INSERT עוקף invite — High
- **מיקום:** `supabase/migrations/20260529000000_coach_platform.sql` — policy `coach_clients_insert_client` בודק רק `client_id = auth.uid()`. לקוח זדוני יכול INSERT עם `status='active'` ו-`coach_id` שרירותי → קורא נתוני המאמן דרך `is_client_of()`.
- **תיקון:** הגבל INSERT ל-`status='pending'` בלבד; **עדיף** — הסר INSERT צד-לקוח לגמרי ונתב הכול דרך `coach-invite-accept` (service role, כבר נכון).
- **DoD:** לקוח אינו יכול ליצור קשר active ישירות; קשר נוצר רק דרך invite.

### S-3 · `messages` INSERT ללא קשר פעיל — High
- **מיקום:** אותו migration — `messages_insert_party` בודק רק sender + (coach_id|client_id)=uid, **בלי** בדיקה שקיים `coach_clients` עם `status='active'`. מאמן מנותק עדיין שולח הודעות.
- **תיקון:** הוסף `AND EXISTS (SELECT 1 FROM coach_clients cc WHERE cc.coach_id=messages.coach_id AND cc.client_id=messages.client_id AND cc.status='active')`.
- **DoD:** שליחה אפשרית רק בקשר פעיל.

### S-4 · `coach_clients` UPDATE — שינוי כל עמודה — Medium
- **מיקום:** policy `coach_clients_update_*` — כל צד יכול לשנות `scopes`, `tags`, `consent_at`. לקוח יכול להעלות `scopes` ל-write, או לזייף `consent_at`.
- **תיקון:** trigger שמונע שינוי `coach_id`/`client_id` ו-`consent_at` אחרי קביעה ראשונית (ראה דוגמה בממצא המקורי), או הרשאות ברמת-עמודה.
- **DoD:** עמודות קריטיות immutable; אי אפשר להעלות הרשאות עצמית.

### S-5 · ai-chat — אין `config.toml` עם `verify_jwt` — Medium
- **מיקום:** `supabase/functions/ai-chat/index.ts` `authorize()` — רק מפענח payload (base64), לא מאמת חתימה. הערה אומרת שהפלטפורמה אוכפת כש-`verify_jwt=true`, אבל **אין `config.toml`** מפורש. deploy עם `--no-verify-jwt` → עקיפת rate-limit/quota עם JWT מזויף.
- **תיקון:** הוסף `supabase/functions/ai-chat/config.toml` עם `verify_jwt = true`; או `auth.getUser()` בצד שרת (כמו 2 ה-functions האחרים).
- **DoD:** `config.toml` קיים לכל 3 ה-functions; אימות JWT מובטח.

### S-6 · `dompurify` מותקן ולא בשימוש — Medium
- **מיקום:** `package.json` dep, **לא מיובא**. כיום בטוח — תוכן AI (`ExerciseTutorial`) ו-`MessageThread` מרונדרים כ-`{text}` (React escaping), אין `dangerouslySetInnerHTML`.
- **תיקון:** או הסר (`npm uninstall dompurify @types/dompurify`) להקטנת attack surface, או תעד כ"שמור ל-markdown עתידי — חובה לחבר לפני כל `dangerouslySetInnerHTML`".
- **DoD:** התלות הוסרה, או קיים כלל מתועד שאוכף sanitization לפני render של HTML.

### S-7 · `messages` SELECT/UPDATE ללא קשר פעיל — Medium
- **מיקום:** `messages_select_party`/`messages_update_party` — גישה לפי `coach_id|client_id=uid` בלבד. אחרי סיום קשר, שני הצדדים קוראים את כל ההיסטוריה ומסמנים נקרא.
- **תיקון:** SELECT ייתכן מכוון (היסטוריה) — תעד. UPDATE (mark-as-read) הגבל לקשר פעיל.
- **DoD:** החלטה מתועדת; UPDATE מוגבל לפעילים.

### S-8 · invite code modulo bias — Low
- **מיקום:** `src/services/coach/inviteService.ts` — `ALPHABET[bytes[i] % 30]` → 16 התווים הראשונים מעט סבירים יותר. לא נצול מעשית (rate limit + ~39 ביט).
- **תיקון:** rejection sampling (`while (b >= 240)` עבור 30×8).
- **DoD:** התפלגות אחידה.

### S-9 · rate-limit fail-open — Low
- **מיקום:** `coach-invite-accept/index.ts` — try/catch סביב בדיקת ה-rate-limit נכשל פתוח. אם הטבלה/חיבור נופלים — אין הגנת brute-force.
- **תיקון:** שקול fail-closed (503) כשתשתית ה-rate-limit לא זמינה, או לפחות log+alert.
- **DoD:** כשל בתשתית ה-limit לא מבטל שקט את ההגנה.

### S-10 · `getUnreadCount` חוצה threads — Low
- **מיקום:** `src/services/coach/messageService.ts` — מסנן `sender_id != me` + `read_at IS NULL` בלי coach/client. RLS מגן מדליפה חוצת-משתמשים, אבל סופר גם קשרים שהסתיימו (ספירה ישנה מטעה — UX).
- **תיקון:** סנן לקשרים פעילים.
- **DoD:** ספירת unread משקפת רק קשרים פעילים.

### S-11 · `impeccable` dep לא בשימוש — Low
- **מיקום:** `package.json` — לא מיובא (סקיל עיצוב, לא runtime). אין install script (לא סיכון מיידי כמו S-1).
- **תיקון:** `npm uninstall impeccable`.
- **DoD:** הוסר מ-dependencies.
- **תיאום:** משותף עם 06-Arch.

### S-12 · CSP `unsafe-inline` ל-styles — Low
- **מיקום:** `netlify.toml` — `style-src 'self' 'unsafe-inline'`. מקובל ל-React עם inline styles; סיכון מעשי נמוך (אין `dangerouslySetInnerHTML`).
- **תיקון:** מקובל כרגע. הסרה רק אם עוברים ל-CSS modules/Tailwind בלבד (L).
- **DoD:** מתועד כהחלטה מודעת.

---

## הזדמנויות שדרוג
- `config.toml` מפורש עם `verify_jwt=true` לכל 3 ה-Edge Functions.
- **Audit triggers ברמת DB** במקום `writeAudit()` צד-לקוח (שניתן לדלג עליו).
- אכיפת **email confirmation** ב-Supabase Auth (מונע account enumeration).
- invite codes **חד-פעמיים** שמתבטלים אחרי ניסיון ראשון.
- `pg_cron` לניקוי `rate_limit_events` (לא ממומש, גדל ללא גבול).
- **Supabase Vault** למפתחות VAPID במקום env secrets.

## תיאום ונקודות חיכוך
- `package.json` (S-1, S-11, S-6) — משותף עם 06-Arch. אתה הבעלים.
- migrations / RLS — שלך בלבד; **רק על branch**.
- 08-Data נוגע בטריגר `update_updated_at_column` (לוגיקת sync) — תיאום: שינוי הטריגר שלהם, שינויי RLS שלך. אל תתנגשו על אותו migration file — צור migration נפרד.

## הגדרת סיום (תיק)
S-1 הוסר; S-2/S-3 (RLS) תוקנו ואומתו על branch + `get_advisors` נקי; `config.toml` קיים; `npm run verify && npm run test:run` ירוקים.
