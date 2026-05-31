# עבודה שנותרה — תיק handoff

> נכתב על ידי Kiro לאחר ביצוע כל 8 תיקי ה-`improvements/` + Phase B (רפקטורים) + Phase C (DB/deploy).
> המסמך מפרט **רק את מה שנותר**. שום פריט לא הושמט — כולל כל "הזדמנויות השדרוג" מכל התיקים.
> מקרא מאמץ: **S** = שעות · **M** = יום-יומיים · **L** = שבוע+ / מרובה-קבצים.
> מקרא עדיפות: **P1** = ערך גבוה/מומלץ בקרוב · **P2** = שיפור משמעותי · **P3** = Nice-to-have / חזון.

---

## ✅ מה כבר בוצע (רקע — לא לעשות שוב)

- **כל הממצאים Critical / High / Medium** מ-8 התיקים טופלו (D-1..D-13, M-1..M-10 פרט ל-M-8, S-2..S-12, P-1..P-8/P-10/P-12/P-13, A-1..A-12, AR-1/AR-3/AR-5..AR-15, T-1..T-12, DA-1..DA-13).
- **Phase B:** פוצלו כל 6 הקבצים הענקיים (Settings/Nutrition/ActiveWorkoutNew/Onboarding/ExerciseReorder/Templates), פוצל טיפוס `Exercise`, חולצו `workoutSessionBuilder`/`settingsService`/`platform/web.ts`.
- **Phase C — DB (פרודקשן `fitness`):** הוחלו המיגרציות data_sync_correctness, security_rls_hardening, tombstones, harden_function_search_path, **create_water_logs** (תיקן באג sync של מים — הטבלה לא הייתה קיימת!), **add_workout_sessions_updated_at** (תיקן DA-1 לסשנים — העמודה חסרה בפרודקשן!), add_composite_indexes, message_body_length_check, optimize_rls_auth_uid (אפס policies לא-עטופים → ~40 אזהרות `auth_rls_initplan` נפתרו).
- **deps:** הוסרו ecc-universal/impeccable/dompurify; esbuild override ל-0.25 (פתר advisory); framer-motion שודרג ל-v11.
- **Deploy:** חי ב-Netlify production — https://fitness-app-amit.netlify.app
- **מצב קוד:** `verify` ✅, `build` ✅, `coverage` ✅, **327 בדיקות** ירוקות.

---

## P1 — ערך גבוה, מומלץ בקרוב

### אבטחה / Auth (דשבורד Supabase — לא דורש קוד)
- [ ] **הפעלת Leaked Password Protection** ב-Supabase Auth (Auth → Policies). אזהרת advisor פתוחה. **S**
- [ ] **אכיפת email confirmation** ב-Auth — מונע account enumeration. (03-Security opportunity) **S**

### תלויות / Audit
- [ ] **5 חולשות npm "moderate"** שנותרו — כולן `vite <=6.4.1` path-traversal ב-**שרת הפיתוח בלבד** (לא בפרודקשן). התיקון היחיד: שדרוג major ל-vite 6/7/8 (שובר — דורש התאמת config + vite-plugin-pwa + vitest). **M** *(ראה גם "Vite 6/Rolldown" ב-P3)*

### נתונים / sync — פערים שנשארו
- [ ] **DA-7 למים:** מחיקת water_logs היא hard-delete ולא מתפשטת בין מכשירים (אין tombstone ל-water_logs). להוסיף `deleted_at` ל-water_logs + soft-delete, או לקבל שמחיקת מים לא מסתנכרנת. **S**
- [ ] **לוודא ש-water_logs ב-`pullAllData`** (כרגע יש `fetchWaterLogs`/`mergeWaterLogsFromCloud` — לאמת שהם מחוברים ל-pull המלא ולא רק ל-push). **S**
- [ ] **DA-12:** איחוד `bodyStatsService` ו-`bodyWeightDb` (API כפול, סיכון double-sync). **S** *(נדחה ב-Phase B)*

### ניקוי DB (advisor — קיים מראש, לא נוצר על ידי השינויים)
- [ ] **`multiple_permissive_policies`** (~80 אזהרות): לכל טבלת user-data יש גם policy של "Users can…" וגם של "coach_…" לאותו role/action. למזג לכדי policy אחד עם OR לכל action (משפר ביצועים, דורש בדיקת לוגיקת הרשאות coach). **M**
- [ ] **`unindexed_foreign_keys`** (INFO): להוסיף אינדקסים מכסים ל-FK בטבלאות coach (assignments.coach_id, messages.client_id/sender_id, coach_notes.client_id, reminders.coach_id/group_id, וכו'). additive ובטוח. **S**
- [ ] **`pg_cron` לניקוי `rate_limit_events`** — הטבלה גדלה ללא גבול. (03-Security) **S**
- [ ] **`rate_limit_events` RLS ללא policy** (INFO) — מכוון (service-role בלבד); לתעד או להוסיף policy מפורש. **S**

### תשתית מיגרציות
- [ ] **רענון `supabase/schema.sql`** — להריץ `supabase db dump` כדי שה-snapshot ישקף את כל המיגרציות החדשות (אל תערוך ידנית). **S**
- [ ] **drift בהיסטוריית מיגרציות** — שמות ה-migrations המרוחקים שונים מהמקומיים. כעת כל המקומיים הוחלו, אבל כדאי ליישר את ההיסטוריה (cosmetic). **S**

### QA ידני (לא ניתן לאוטומציה מלאה)
- [ ] **בדיקה ויזואלית Dark + Light** בכל המסכים — שכתוב צבעי ה-CSS vars עבר build אך לא נבדק חזותית. **M**
- [ ] **בדיקת נגישות עם טכנולוגיה מסייעת** (VoiceOver/TalkBack) — האוטומציה מכסה חלק בלבד (05-A11y). **M**

---

## P2 — שיפורים משמעותיים

### ארכיטקטורה / הכנה ל-React Native (06-Arch)
- [ ] **השלמת הגירת טיפוס `Exercise`** — AR-1 בוצע אדיטיבית; ~31 קבצים עדיין משתמשים ב-alias `Exercise` המיושן. להגר בהדרגה ל-`ExerciseCatalogEntry`/`ActiveExercise`/`TemplateExercise`. **L**
- [ ] **Platform abstraction מלא** `src/platform/{web,rn}.ts` — `web.ts` נוצר לאימון; להרחיב לכל ה-storage/haptics/wakeLock/audio/notifications כך ש-RN רק יחליף מימוש. **L**
- [ ] **`supabase gen types typescript`** — טיפוסי שורה מהסכמה החיה במקום `supabaseSyncMappers` הידני. **M**
- [ ] **barrel `src/services/index.ts`** — API surface מפורש + אימות tree-shaking. **S**
- [ ] **Zustand/Jotai** במקום 5 contexts + localStorage + window events + IDB. **L**

### בדיקות (07-Testing)
- [ ] **Playwright E2E** לנתיבים קריטיים: offline→online sync, השלמת אימון, auth (לא ניתן ל-unit). **L**
- [ ] **העלאת ספי coverage בהדרגה** — כרגע floor שמרני (stmts/lines 3%, branches 50, functions 20). לטפס למעלה ככל שנוספות בדיקות; היעד ארוך-טווח 80%. **M (מתמשך)**
- [ ] **Vitest browser mode** — בדיקות עם IDB/SW אמיתיים בלי מגבלות jsdom. **M**
- [ ] **Contract testing** מול הסכמה (types מ-`supabase gen types`) — תופס schema drift. **M**
- [ ] **Stryker mutation testing** — מכמת איכות בדיקות. **M**
- [ ] `"test:ui": "vitest --ui"` ל-package.json. **S**

### נגישות (05-A11y)
- [ ] **שער a11y ב-CI** — Playwright + `@axe-core/playwright` (כיום DEV console בלבד). **M**
- [ ] **`inert`** על `#main-content` כשמודאל פתוח — חזק יותר מ-focus trap לבד. **S**

### אבטחה (03-Security)
- [ ] **Audit triggers ברמת DB** במקום `writeAudit()` צד-לקוח (שניתן לדלג עליו). **M**
- [ ] **invite codes חד-פעמיים** שמתבטלים אחרי ניסיון ראשון. **S**
- [ ] **Supabase Vault** למפתחות VAPID במקום env secrets. **S**

### ביצועים (04-Perf)
- [ ] **P-9 — `LazyMotion` + `domAnimation`** (framer כבר v11): המרת `motion.*` ל-`m.*` עם LazyMotion חוסכת ~30% מה-chunk. רחב/מסוכן — בזהירות. **M**
- [ ] **P-11 — ביקורת אייקוני lucide** (69 import sites); `dynamicIconImports` לאייקונים ב-overlays עצלים. **S**

---

## P3 — חזון / שדרוגים גדולים (Nice-to-have)

### Sync / Data (08-Data)
- [ ] **Incremental/Delta sync** — `last_synced_at` פר-store, sync רק מאז (חיסכון 95%+). **L**
- [ ] **Supabase Realtime מחובר ל-merge** — עדכון multi-device מיידי (subscriptions קיימים, לא מחוברים). **L**
- [ ] **Conflict resolution UI** — לנתונים חשובים (sessions/templates) דיאלוג במקום LWW שקט. **L**
- [ ] **Background Sync API** — ניגון התור גם כשהאפליקציה סגורה. **M**
- [ ] **Unified Sync Engine** — WAL יחיד במקום dual-system, עם hybrid logical clocks + tombstones. **L**
- [ ] **CRDT (Yjs/Automerge)** למערך ה-exercises (JSONB) — עריכה מקבילית אמיתית בלי דריסה. **L**

### ביצועים (04-Perf)
- [ ] **React 19 + React Compiler** — auto-memoization, מבטל רוב ה-`useMemo`/`memo` הידני. **L**
- [ ] **Vite 6 + Rolldown** — build מהיר + chunking טוב יותר (פותר גם את 5 חולשות ה-npm). **L**
- [ ] **Shared Worker** ל-IDB+sync — משחרר את ה-main thread. **L**
- [ ] **`motion` (standalone)** — חצי מגודל framer-motion. **M**

### עיצוב (01-Design)
- [ ] **OKLCH** לכל הצבעים — פתרון שיטתי ל-contrast (הבטחת מרחק lightness). **M**
- [ ] **Variable fonts** — מ-~400KB ל-~150KB + אנימציית משקל. **M**
- [ ] **Container queries** (`@container`) לכרטיסים — חשוב לפלטפורמת המאמן. **M**
- [ ] **CSS `@layer` + `@property`** — שליטה ב-specificity + מעבר צבע חלק בין themes. **M**
- [ ] **`prefers-color-scheme`** כברירת מחדל לפני toggle ידני. **S**

### תנועה (02-Motion)
- [ ] **M-8 — View Transitions API** למעברי route (hook מוכן ב-`useViewTransition.ts`, לא מחובר; אפס JS bundle). **M**
- [ ] **Scroll-driven animations** (`animation-timeline: scroll()`) ל-headers/progress — אפס JS, רץ על ה-compositor. **M**
- [ ] **`layoutId`** ל-shared element בין רשימת תרגילים↔תרגיל פעיל (המשכיות מרחבית). **M**
- [ ] **סנכרון haptics לקיפול אנימציה** (`onUpdate`/`onAnimationComplete`) — tick בדיוק ב-100%. **S**
- [ ] **spring לפי velocity** — העברת `info.velocity.x` מ-`onDragEnd` ל-`velocity` של ה-spring. **S**

### עיצוב — שאריות קטנות
- [ ] **D-8 — accent פר-עמוד** (`PageThemeContext`): או לחבר ל-`var(--accent-current)` ברכיבי זהות-עמוד, או להסיר לטובת פשטות. (נדחה כ-Low) **M**

---

## הערות תיאום שחשוב לזכור
- **קבצים משותפים:** `tokens.css`/`tailwind.config.js` (Design), `App.tsx` MotionConfig (A11y), `supabaseSync.ts` (Data→Perf), `Toast`→`GlobalToast` (Arch+A11y). בכל שינוי לשמר aria/role/focus-trap/MotionConfig/memoization שכבר קיימים.
- **שינויי DB:** branching לא זמין בתוכנית Free. כרגע מחילים ישירות על פרודקשן `fitness` (qxhgmqxiomidmimpnjvs). לכל שינוי DB עתידי — לשקול תוכנית Pro ל-branch, ולהריץ `get_advisors` אחרי.
- **אחרי כל שינוי קוד:** `npm run verify && npm run test:run` (חובה ירוק); ל-build: `npm run build`.

---

## פריטי קוד פתוחים (grep)
- `src/App.tsx` — `Placeholder item for WorkoutProvider` (לבדוק אם עדיין נחוץ אחרי פיצול ActiveWorkout).
- אין סמני `TODO`/`FIXME`/`HACK` אחרים ב-`src/` — הקוד נקי מהערות עבודה דחויות.
