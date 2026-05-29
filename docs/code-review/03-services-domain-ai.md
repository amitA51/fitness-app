# 03 — שירותי דומיין ו-AI

קבצים שנסקרו: `achievementService.ts`, `analyticsService.ts`, `progressionService.ts`, `prService.ts`, `trainingLoadService.ts`, `aiWorkoutInsightService.ts`, `ai.ts`, וכל `services/ai/*` (`bootstrap`, `chat`, `config`, `constants`, `contextBuilder`, `core`, `features`)

---

## `src/services/progressionService.ts`

### [High] Bug — חלוקה ב-`setsCompleted` שיכול להיות 0
- **תיאור:** `buildAIProgressionContext` מחלק reps ב-`setsCompleted` (יכול להיות 0 → NaN/Infinity).
- **תיקון:** לשמור על מכנה > 0 לפני החלוקה, או להחזיר 0 כש-`setsCompleted === 0`.

### [High] Bug — `getExerciseHistory` שובר אחרי limit ומניח sessions ממוינים מראש
- **תיאור:** ה-break אחרי ה-limit מניח שה-sessions ממוינים, אז "הסשן האחרון"/`currentWeight` יכולים להיות שגויים.
- **תיקון:** למיין במפורש לפני החיתוך, או לא להניח סדר.

### [Medium] Bug — deloads מעגלים משקל למעלה/לאפס כך ש-`weightChange` סותר את ההמלצה
- **תיקון:** לחשב `weightChange` מהמשקל המעוגל בפועל ולוודא עקביות עם כיוון ההמלצה.

---

## `src/services/achievementService.ts`

### [High] Bug — `currentStreak` נספר רק אם האימון האחרון היה היום
- **תיאור:** streaks פעילים (התאמן אתמול) קוראים 0.
- **תיקון:** לאפשר ל-streak להיחשב גם אם האימון האחרון היה אתמול.

### [Medium] Bug — מחרוזות date-only מפורסרות כ-UTC מול `today` מקומי
- **תיאור:** שובר את השוואת ה-streak ליד חצות.
- **תיקון:** לפרסר/להשוות בתאריך מקומי עקבי.

### [Low] Bug — `longestStreak` מוערך בחסר על פני פערים
- **תיקון:** לחשב את ה-streak הארוך ביותר על כל הרצפים, לא רק הנוכחי.

---

## `src/services/core.ts` (services/ai/core.ts)

### [Medium] Bug — timeout AbortController לא באמת מבטל את הבקשה
- **תיאור:** ה-`AbortController` לא מבטל את `functions.invoke` של supabase (רק עוטף `Promise.race` שנדחה), משאיר בקשות in-flight.
- **תיקון:** להעביר את ה-signal ל-fetch/invoke בפועל.

### [Low] Code Quality — `AI_TOP_P` לא בשימוש במסלול המרוחק; `DirectDeepSeekProvider` קוד מת
- **תיקון:** להסיר קוד מת ולחבר/להסיר את `AI_TOP_P`.

---

## `src/services/trainingLoadService.ts`

### [Medium] Bug — `getSessionVolume` סומך על `session.totalVolume` שעלול לכלול warmups
- **תיאור:** נותן בסיס volume לא עקבי בין sessions ומשחית את יחס acute:chronic.
- **תיקון:** לחשב volume עקבי (אותם פילטרים) במקום לסמוך על השדה הנשמר.

### [Medium] Bug — bucketing תאריך ב-UTC מול מקומי
- **תיקון:** להשתמש בתאריך מקומי עקבי.

### [Low] Bug — fallback של `acuteChronicRatio` מקובע ל-1.5 מסמן משתמשים חדשים כ-spiking
- **תיקון:** להחזיר ערך ניטרלי/לא-מוגדר עבור היסטוריה לא מספקת.

---

## `src/services/analyticsService.ts`

### [Medium] Bug — פיצולי trend של muscle-balance ו-exercise-progress מניחים סדר כרונולוגי
- **תיקון:** למיין במפורש לפני פיצול.

### [Medium] Code Quality — ספי trend של תחזית הם magic numbers מוחלטים
- **תיקון:** לחלץ קבועים בעלי שם ולשקול ספים יחסיים.

### [Medium] Performance — fetch-1000-then-filter
- **תיקון:** לסנן ב-DB/אינדקס במקום למשוך 1000 ולסנן.

### [Low] Bug — warmups כלולים לא עקבי בחלק מחישובי ה-volume
- **תיקון:** להחיל מדיניות warmup אחידה דרך `workoutMath`.

---

## `src/services/prService.ts`

### [Medium] Bug — שני מנועי PR מתפצלים + שני מסלולים בתוך הקובץ
- **תיאור:** reps/1RM PRs אובדים בבנייה מחדש.
- **תיקון:** לאחד למנוע PR יחיד.

### [Low] Code Quality — שורות PR append-only גדלות ללא גבול
- **תיקון:** לדכא/לקצר היסטוריית PR או לשמור רק את הטוב ביותר לכל מטריקה.

---

## משטחי AI (`aiWorkoutInsightService`, `ai.ts`, `contextBuilder`, `features`, `chat`)

### [Medium] Security — שמות תרגיל/שריר מאת המשתמש מוטמעים ב-prompts ללא sanitization
- **תיאור:** משטח prompt-injection בכל נקודת כניסה של AI.
- **תיקון:** לעטוף/לברוח קלט משתמש ב-prompts, או להעביר אותו כ-data מובנה ולא כטקסט חופשי.

### [Medium] Performance — `askExerciseQuestion` מעביר היסטוריית chat ללא גבול
- **תיאור:** עלות tokens בעוד `chat.ts` מגביל את ההיסטוריה.
- **תיקון:** להחיל את אותו cap על ההיסטוריה בכל המסלולים.

### [Low] Code Quality — מספר פונקציות `async` לא עושות עבודה async; catches בולעים שגיאות ללא לוג
- **תיקון:** להסיר `async` מיותר וללוגג שגיאות שנתפסות.

---

## נושאים חוצי-קבצים
- טיפול UTC-מול-מקומי לא עקבי בתאריכים.
- הנחות סדר-sessions לא אכופות.
- פילטור warmup/completed נסחף.
- לוגיקת PR משוכפלת.
- קלט משתמש לא-sanitized ל-prompts.
- context/עלות AI ללא גבול.
