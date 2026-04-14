# SparkOS Fitness - מפת דרכים לשדרוג ופיתוח

**תאריך עדכון:** 2026-04-13
**מצב:** ניקוי קוד מת הושלם, האפליקציה בתקנה ועובדת

---

## PRIORITY 1 - תשתית ואיכות קוד (בסיס להכל)

### 1.1 TypeScript Strict Mode
- [ ] הפעלת `strict: true` ב-tsconfig.json
- [ ] תיקון 30+ שגיאות סוג קיימות (ראה `npx tsc --noEmit`)
- [ ] הפעלת `noUnusedLocals: true` ו-`noUnusedParameters: true`
- **השפעה:** מונע באגים, משפר את חוויית הפיתוח

### 1.2 ניקוי console.log
- [ ] הסרת 89+ console.log/error/warn מקוד פרודקשן
- [ ] יצירת logger utility עם levels (debug/info/warn/error)
- [ ] הפעלת logger רק ב-dev mode
- **השפעה:** קוד נקי, ביצועים טובים יותר

### 1.3 פיצול קבצים גדולים
- [ ] `ActiveWorkoutNew.tsx` (967 שורות) → פצל ל-3-4 קומפוננטות
- [ ] `WorkoutSummary.tsx` (972 שורות) → פצל ל-StatsGrid, ExerciseList, PRHighlights
- [ ] `workoutDb.ts` (637 שורות) → פצל ל-templateDb, sessionDb, exerciseDb
- [ ] `Progress.tsx` (596 שורות) → פצל ל-WeightTab, MeasurementsTab, RecoveryTab
- **השפעה:** קוד קריא, תחזוקה קלה, bundle size קטן יותר

### 1.4 הסרת Zustand הלא בשימוש
- [ ] הסרת `zustand` מ-package.json
- [ ] הרצת `npm prune`
- **השפעה:** bundle size קטן יותר

---

## PRIORITY 2 - חיבור מערכות קיימות (מהיר + ערך גבוה)

### 2.1 חיבור useFitnessInsights ל-Dashboard
- **מה:** ה-hook `useFitnessInsights` כבר קיים ומכיל חישובי streak, PRs, muscle neglect, AI insights
- **איך:** להחליף את החישובים הידניים ב-Dashboard.tsx בשימוש ב-hook
- **תועלת:** Dashboard חכם יותר עם המלצות AI, זיהוי שרירים מוזנחים, מגמות

### 2.2 חיבור useWorkoutHistoryHub ל-History
- **מה:** ה-hook `useWorkoutHistoryHub` מספק היסטוריה מרכזית עם event-driven refresh
- **איך:** להחליף את ה-loading logic ב-History.tsx בשימוש ב-hook
- **תועלת:** רענון אוטומטי, קוד נקי, getSessionsInRange לסינון

### 2.3 חיבור supabaseSync ל-Settings
- **מה:** שירות sync מלא קיים אבל לא מחובר
- **איך:** להוסיף כפתור "סנכרון ענן" ב-Settings + auto-sync בסיום אימון
- **תועלת:** גיבוי ענן, סנכרון בין מכשירים, real-time updates

### 2.4 איחוד recoveryService עם bodyStatsService
- **מה:** ל-recoveryService יש אלגוריתם scoring מתקדם יותר (weighted: sleep 30%, soreness 25%, energy 25%, stress 20%)
- **איך:** להעביר את calculateRecoveryScore מ-recoveryService לתוך bodyStatsService
- **תועלת:** ציון recovery מדויק יותר, קוד מאוחד

### 2.5 חיבור useWaterReminder (תיקון + חיבור)
- **מה:** ה-hook תלוי ב-SettingsContext שלא קיים
- **איך:** ליצור SettingsContext פשוט או לקרוא ישירות מ-localStorage
- **תועלת:** תזכורת שתייה באימון (כל 15 דקות + notification + haptic)

---

## PRIORITY 3 - Analytics Engine (ערך ליבה)

### 3.1 הפיכת analyticsService מ-stub לאמיתי
- [ ] `calculateVolumeHistory` - נפח לפי שבוע/תרגיל/שריר
- [ ] `calculateMuscleGroupDistribution` - איזון שרירים + זיהוי חולשות
- [ ] `forecastProgress` - חיזוי לינארי ל-4 שבועות קדימה
- [ ] `calculateFrequency` - תדירות אימונים (יום/שבוע)
- [ ] `getProgressData` - התקדמות לפי תרגיל (משקל/חזרות/נפח)
- **תועלת:** זה הלב של האפליקציה - Effective Volume tracking

### 3.2 AnalyticsDashboard חכם
- [ ] גרף נפח שבועי עם trend line
- [ ] תרשים איזון שרירים (radar chart)
- [ ] חיזוי התקדמות לפי תרגיל
- [ ] heatmap של ימי אימון

---

## PRIORITY 4 - AI Coach חכם

### 4.1 הרחבת AI Context
- [ ] Context builder שמכיל: היסטוריה (2 שבועות), מגמות נפח, recovery scores, nutrition compliance, PRs
- [ ] Provider-agnostic: תמיכה ב-OpenAI, Anthropic, או local fallback
- [ ] System prompt מותאם לעברית + fitness expertise

### 4.2 יכולות AI מתקדמות
- [ ] המלצת משקל לסט הבא (מבוסס היסטוריה + RPE)
- [ ] זיהוי שרירים מוזנחים + המלצת תרגילים
- [ ] סיכום אימון אוטומטי (מה הלך טוב, מה לשפר)
- [ ] תכנון ארוחות מבוסס מאקרו יומי
- [ ] ניתוח טכני (form tips) לתרגילים

### 4.3 Chat AI משופר
- [ ] המשכת שיחה עם context של האימון הנוכחי
- [ ] Streaming responses
- [ ] שמירת היסטוריית צ'אט ב-IndexedDB

---

## PRIORITY 5 - מערכת הישגים (Gamification)

### 5.1 Achievements
- [ ] 20+ achievements: ספירת אימונים (1, 10, 50, 100, 500)
- [ ] Volume milestones (10K, 100K, 1M kg)
- [ ] Streak achievements (3, 7, 30, 100 ימים)
- [ ] PR milestones (first PR, 10 PRs, 5 תרגילים שונים)
- [ ] Nutrition consistency (7, 30 ימים רצופים)
- [ ] Progress bar להישגים חלקיים

### 5.2 Achievement Notifications
- [ ] Toast notification עם animation
- [ ] Achievement card: icon, title, description, date
- [ ] עמוד Achievements נפרד

---

## PRIORITY 6 - חוויית משתמש מתקדמת

### 6.1 Recovery משופר
- [ ] Quick recovery questions אחרי כל אימון (3 שאלות מהירות)
- [ ] Body map לבחירת אזורים תפוסים (tightness)
- [ ] Recovery score משפיע על המלצות AI (אימון קל/כבד)
- [ ] Weekly recovery trend chart

### 6.2 Nutrition חכם
- [ ] Weekly macro trends chart
- [ ] Dynamic TDEE calculation (משקל × רמת פעילות)
- [ ] "מה אוכלים היום?" - המלצות מבוססות מאקרו שנותר
- [ ] Barcode scanner לסריקת מוצרים
- [ ] מתכונים/meal prep templates

### 6.3 Social & Sharing
- [ ] שיתוף דוח שבועי (כבר קיים ב-exportService!)
- [ ] ייצוא PDF מעוצב עם גרפים
- [ ] Share PR card לרשתות חברתיות

### 6.4 Notifications
- [ ] תזכורת אימון (configurable time + frequency)
- [ ] התראה על אימון שפוספס (X ימים בלי אימון)
- [ ] תזכורת תזונה (אם לא רשמת ארוחה עד שעה מסוימת)
- [ ] Notification API + service worker

---

## PRIORITY 7 - ארכיטקטורה וביצועים

### 7.1 Code Splitting
- [ ] Lazy load לכל ה-pages (React.lazy + Suspense)
- [ ] Reduce main bundle (עכשיו 681KB, יעד: <300KB)
- [ ] Dynamic imports ל-AI coach ו-analytics

### 7.2 Offline-First
- [ ] Service Worker לעבודה offline מלאה
- [ ] Background sync לסנכרון כשחוזרים ל-network
- [ ] Conflict resolution לסנכרון multi-device

### 7.3 PWA
- [ ] Web App Manifest
- [ ] Add to Home Screen
- [ ] Push notifications
- [ ] Background fetch

### 7.4 IndexedDB Migration
- [ ] Schema version 3: personal_records, ai_conversations stores
- [ ] Migration path מ-v2 ל-v3 (non-breaking)
- [ ] Index optimization ל-range queries

---

## PRIORITY 8 - מובייל ו-Native Feel

### 8.1 Gestures
- [ ] Swipe לניווט בין תרגילים (כבר קיים חלקית)
- [ ] Pull-to-refresh בכל ה-lists (קיים חלקית)
- [ ] Long press ל-actions מהירים
- [ ] Haptic feedback משופר

### 8.2 Animations
- [ ] Page transitions (shared layout animations)
- [ ] Skeleton loading בכל ה-pages
- [ ] Number counter animations (כבר קיים AnimatedNumber)
- [ ] Confetti/celebration משופר ל-PR

### 8.3 Responsive
- [ ] Tablet layout (split view)
- [ ] Dark/Light mode toggle
- [ ] Font size scaling
- [ ] RTL optimization משופר

---

## קבצים שנשמרו לשימוש עתידי

| קובץ | שימוש מתוכנן |
|------|---------------|
| `hooks/fitness/useWorkoutTimer.ts` | Enhanced timer עם intervals, laps, countdown |
| `hooks/fitness/useWorkoutPersistence.ts` | Generic persistence עם debounce + expiration |

---

## שינויים שבוצעו (2026-04-13)

### תיקוני CRITICAL/HIGH:
- Supabase client: עכשיו null-safe (לא נוצר client עם credentials ריקים)
- supabaseAuth: כל הפונקציות בודקות `|| !supabase` לפני שימוש
- Duplicate `/progress` route הוסר מ-App.tsx

### מחיקת Dead Code:
- `src/contexts/WorkoutContext.tsx` (עותק ישן עם imports שבורים)
- `src/pages/Workout.tsx` (placeholder שהוחלף)
- `src/services/errors.ts` (כפילות של src/errors/index.ts)
- `src/config/firebase.ts` (stub ריק מהמעבר ל-Supabase)
- `src/components/workout/ActiveWorkoutOverlay.tsx` (קוד מת + hooks violation)

### חיבור שירותים:
- `exportService` חובר ל-Settings: כפתורי CSV export + דוח שבועי + share + copy
