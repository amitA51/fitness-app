# פיצ'רים עתידיים (Parked)

> פיצ'רים שהוחלט במודע לדחות. לא בשלים עכשיו — אבל הקרקע כבר מוכנה.

## 1. סנכרון שעונים חכמים / Wearables (נחקר + הותקן 2026-06-03)

**מה זה:** "חבר את השעון שלך" — אימונים, שינה, HR, recovery נכנסים אוטומטית מ-Garmin / Whoop / Strava / Polar / Oura / Apple Health במקום הקלדה ידנית.

**מה כבר קיים ומוכן:**
- **Open Wearables** (self-hosted, MIT) מותקן ב-`C:\Users\amit0\desktop\open-wearables` — סטאק Docker מלא (API מאוחד + OAuth לכל הספקים + webhooks דרך Svix) שנבדק מקצה לקצה.
- נתוני דמו: 2 משתמשים, 160 אימונים, 40 רשומות שינה — לפיתוח מול דאטה בפורמט אמיתי.
- שרת MCP מקומי לשליפת הדאטה בשפה חופשית (הוסר מהקונפיג בינתיים).
- פרטי גישה, פורטים ותיקוני Windows מתועדים בזיכרון הסשן (`open-wearables-install.md`).

**ארכיטקטורת היעד (בגדול):**
```
ספק (Garmin/Whoop/...) → Open Wearables (VPS) → webhook → Supabase Edge Function → workouts/sleep tables
```

**ערך מוצרי:**
- מתאמן: אפס הקלדה ידנית של אימונים.
- מאמן (`ClientDetail`): רואה מה *באמת* קרה — שינה, HRV, עומס — לא רק דיווח עצמי.
- AI/CoachBrief: נתוני recovery אמיתיים → המלצות ברמה אחרת.

**מה יידרש כשנחזור לזה:**
1. הרשמת מפתח אצל הספקים (Garmin/Whoop — חינם, לוקח ימים).
2. אירוח Open Wearables על VPS קטן.
3. Edge Function ב-Supabase לקליטת webhooks + mappers לסכמה שלנו.
4. UI: מסך "חיבורים" + תצוגת נתוני שעון ב-ClientDetail.

**הפעלה מחדש מקומית:**
```powershell
docker compose --project-directory C:\Users\amit0\desktop\open-wearables up -d
claude mcp add open-wearables -- uv run --frozen --directory C:\Users\amit0\desktop\open-wearables\mcp start
```
