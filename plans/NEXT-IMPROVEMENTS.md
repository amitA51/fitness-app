# דו"ח סריקה עמוקה — מה עוד כדאי לשפר (2026-06-07)

> נסרק אחרי קומיט `ea7e2b7` (שיפוץ פלטפורמת המאמן המלא). ביצוע מומלץ בסשן חדש.
> כלים: Supabase advisors (חי), Biome, ניתוח bundle, ספירות קוד, בדיקות mechanical של ui-preflight.

## 🔴 עדיפות 1 — אבטחה (ממצאי advisors חיים)

| # | ממצא | תיקון | מאמץ |
|---|------|-------|------|
| 1 | `enforce_seat_limit()` ו-`handle_new_user()` — פונקציות **טריגר** `SECURITY DEFINER` שניתנות לקריאה ישירה דרך `/rest/v1/rpc/` ע"י anon+authenticated | מיגרציה: `REVOKE EXECUTE ... FROM anon, authenticated, public` (טריגרים רצים כ-owner — לא צריכים EXECUTE ציבורי) | נמוך |
| 2 | `is_coach_of/is_client_of/is_group_member` ניתנות לקריאה ע"י anon | `REVOKE FROM anon` בלבד (**להשאיר** authenticated — ה-RLS policies תלויות בהן!) | נמוך |
| 3 | הגנת סיסמאות דלופות (HaveIBeenPwned) **כבויה** ב-Auth | הפעלה בלוח Supabase → Auth → Passwords | דקה |
| 4 | `rate_limit_events` — RLS פעיל בלי policies (INFO; כנראה מכוון — service-role בלבד) | לתעד או להוסיף policy deny-all מפורש | נמוך |
| 5 | **pgTAP חסר לטבלאות החדשות**: `group_messages` (לא-חבר לא קורא; שולח≠אני נדחה; חבר לא מעדכן cursor של אחר) + `coach_program_templates` (coach-only) | להרחיב את `supabase/tests/coach_rls_test.sql` | בינוני |

## 🟠 עדיפות 2 — השלמות מאמן (הפער האחרון לחוויה מלאה)

| # | פריט | הערות | מאמץ |
|---|------|-------|------|
| 6 | **מפתחות VAPID + secrets** | `npx web-push generate-vapid-keys` → `VITE_VAPID_PUBLIC_KEY` (לוקאל+Netlify) + `VAPID_*` ב-edge function. בלעדיו טוגל ה-Push מציג "לא מוגדר בסביבה זו" | נמוך |
| 7 | **E2E happy-path** (Playwright): מאמן מזמין → מתאמן מצטרף → שיוך תוכנית → צ'אט קבוצתי → ניתוק | גם יאמת חי את כל המסכים החדשים שלא נצפו בדפדפן | גבוה |
| 8 | react-doctor דיווח "staged regressions" בקומיט — לא נחקר | `npx react-doctor` + תיקון ממצאים | נמוך-בינוני |
| 9 | צ'אט: read-receipts, תמונות (Storage bucket+RLS), מחיקת הודעה למאמן | פיצ'ר המשך | גבוה |
| 10 | תזכורות מתוזמנות בשרת (cron edge function → push) — היום ממומשות רק כשהאפליקציה פתוחה | דורש pg_cron או scheduled function | בינוני |

## 🟡 עדיפות 3 — איכות קוד (ממצאי הסריקה)

| # | ממצא | פירוט | מאמץ |
|---|------|-------|------|
| 11 | **2 שגיאות a11y אמיתיות**: `src/components/charts/AnimatedBar.tsx:71`, `src/pages/onboarding/components/ProgressDots.tsx:11` — `useFocusableInteractive` (אלמנט עם role אינטראקטיבי בלי tabIndex) | תיקון נקודתי | נמוך |
| 12 | **~30 קבצים בחוב פורמט ישן** (הרשימה ב-biome check; כולל charts/, workout/components/, nutrition/) | `npx biome check --write` ממוקד על הרשימה + קומיט "chore: format debt" | נמוך |
| 13 | **קבצים מעל 800 שורות** (הפרת כלל-בית): `WarmupCooldownFlow.tsx` (927), `workoutReducer.ts` (921), `WorkoutHistory.tsx` (853), `WorkoutSummary.tsx` (831) | פיצול בסגנון ClientDetail→client/* | בינוני-גבוה |
| 14 | `MyCoach.tsx` עדיין מחזיק `SectionError` מקומי כפול של `_shared` | איחוד לייבוא מ-_shared | נמוך |
| 15 | נקי להפליא: console.log=1 (webVitals מכוון), TODO=2, אפס hex קשיח (פרט ל-fallback לגיטימי ב-RootErrorBoundary) | — | — |

## 🟢 עדיפות 4 — ביצועים (נתוני bundle אמיתיים)

| # | ממצא | פירוט | פוטנציאל |
|---|------|-------|----------|
| 16 | **שתי ספריות אנימציה במקביל**: framer-motion (115KB) + gsap (71KB) | מיזוג לאחת (כנראה framer; gsap רק ב-BottomNav badge?) | ~70-115KB |
| 17 | `ActiveWorkoutNew` chunk = **152KB** — מסך אחד | פיצול פנימי (WarmupCooldownFlow/Summary/Numpad כ-lazy) | מהירות כניסה לאימון |
| 18 | index ראשי 218KB + supabase 190KB נטענים תמיד | supabase ב-dynamic import לנתיבים שצריכים (מורכב — local-first); לבדוק מה נגרר ל-index | בינוני |
| 19 | פיצול routes טוב ✓ (19 lazy routes, כולל coach) | — | — |

## 🔵 עדיפות 5 — Backlog מוצרי קיים (מהתוכניות והזיכרון)

- שיפורי אימון batch 2+ (רשימת 5 הפריטים — batch 1 בוצע)
- P2 UX backlog מ-impeccable critique (.impeccable/critique/)
- plans/REMAINING-WORK.md + FIX-PLAN.md — רפקטורים פתוחים
- Stripe billing (Phase E)
- Open Wearables (PARKED — plans/FUTURE-FEATURES.md)

## ✅ מה שנבדק ונמצא תקין
- כל `min-h-screen` מלווה ב-`100dvh` ✓
- אפס סודות קשיחים בקוד שנסרק ✓
- push-sw.js מעביר deep-links גנרית — עובד גם ל-URLs החדשים של הצ'אט הקבוצתי ✓
- route splitting מלא ✓

## סדר ביצוע מומלץ
1→6 (אבטחה+VAPID, שעה אחת, ערך עצום) → 8+11+12+14 (ניקיון מהיר) → 5 (pgTAP) → 7 (E2E) → 16-17 (ביצועים) → השאר.
