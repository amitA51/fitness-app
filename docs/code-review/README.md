# סקירת קוד מקיפה — SparkOS Fitness App

תאריך: 29 במאי 2026
היקף: סקירה לקריאה בלבד (read-only) של כל קבצי `src` בפרויקט, מול `CODING_STANDARDS.md` והסקילים של הפרויקט.
מטרה: איתור באגים, בעיות ביצועים וזמני טעינה, חווית משתמש, עיצוב, נגישות ואיכות קוד.

> כל הממצאים הם הצעות לשיפור. לא בוצע שום שינוי בקוד במהלך הסקירה.

## מבנה הדוחות

| קובץ | תחום |
|------|------|
| [01-services-storage.md](./01-services-storage.md) | שכבת אחסון IndexedDB ושירותי נתונים מקומיים |
| [02-services-sync-cloud.md](./02-services-sync-cloud.md) | סנכרון, ענן (Supabase), auth ושירותים נלווים |
| [03-services-domain-ai.md](./03-services-domain-ai.md) | שירותי דומיין (התקדמות, שיאים, עומס) ו-AI |
| [04-hooks-utils-contexts-config.md](./04-hooks-utils-contexts-config.md) | הוקים, utils, contexts, constants, types, errors, data, config |
| [05-pages.md](./05-pages.md) | כל הדפים כולל login ו-progress |
| [06-workout-core.md](./06-workout-core.md) | ליבת האימון: state machine, hooks, overlays, states |
| [07-ui-components.md](./07-ui-components.md) | קומפוננטות UI משותפות, dashboard, charts, animations, icons |
| [08-workout-components.md](./08-workout-components.md) | קומפוננטות workout, fitness, nutrition |

## דירוג חומרה

- **[Critical]** — איבוד נתונים, קריסה, או פגיעה משמעותית בפונקציונליות.
- **[High]** — באג ממשי שמשפיע על משתמשים או על שלמות הנתונים.
- **[Medium]** — באג/בעיה עם השפעה מוגבלת או edge-case.
- **[Low]** — איכות קוד, ניקיון, שיפורים קוסמטיים.

---

## תקציר מנהלים

הפרויקט בנוי היטב: TypeScript מחמיר, ארכיטקטורה שכבתית נקייה, error boundaries, charts מצוינים ועבודה טובה בחלק מההוקים. הבעיות מתרכזות במספר **דפוסים חוזרים** שכדאי לתקן רוחבית:

1. **טיפול לא עקבי בתאריכים (UTC מול מקומי)** — מספר מקומות משתמשים ב-`toISOString()` (UTC) בעוד הפרויקט עצמו תיקן זאת ל-מקומי ב-`dateUtils.todayStr()`. גורם ל"יום שגוי" בישראל ליד חצות.
2. **מקורות אמת כפולים** — שתי סקאלות z-index, שני סטים של מגבלות משקל/חזרות, שתי טקסונומיות שרירים, שני `handleError`, שתי מערכות תור-אופליין, ו-SlideToComplete מול SwipeComplete.
3. **עמידות IndexedDB וסנכרון ענן** — `clear()+put` לא אטומי (איבוד נתונים), הבטחות resolve לפני commit, last-write-wins שמעדיף ענן, ותור אופליין שלא ניתן לשחזור.
4. **פערי נגישות** — מודלים ללא `role="dialog"`/focus-trap/Escape, toggles ללא `role="switch"`, התנגשויות SVG id, ו-touch targets מתחת ל-44px.

### באגים קריטיים/גבוהים לתיקון ראשון

1. **סימון סט שהושלם לא עקבי** — ה-reducer מסמן רק `completedAt`, אבל `analyticsService`/`ForecastChart`/`WorkoutComparison` מסננים לפי `isCompleted` → אנליטיקות מציגות 0 לאימונים אמיתיים.
2. **איבוד נתונים מקומי** — `clear()+Promise.all(put)` לא אטומי ב-5 מקומות.
3. **`removeDuplicateExercises`** עושה `await` על `IDBRequest` במקום Promise → מחיקות לא מתבצעות/מאומתות.
4. **משך אימון מנופח אחרי שחזור** — זמן סגירה נספר כזמן פעיל.
5. **תור אופליין לא ניתן לשחזור** (`syncEngine`) + **last-write-wins מעדיף ענן** → איבוד עריכות.
6. **הפרות Rules of Hooks** — `useFocusTrap` (קריאות מותנות), `PRHighlights` (`return null` לפני `useMemo`, יקרוס).
7. **`NumpadOverlay`** — presets/stepper מוסיפים במקום להחליף ("5" + preset 100 → "5100").
8. **`AudioContext` חדש בכל ביפ** ב-`utils/audio.ts` ולא נסגר → דליפת משאבים.
9. **`ExerciseReorder`** מוחק את התרגיל הלא נכון אחרי סידור מחדש.
