// ============================================================================
// Running know-how — short, evidence-based tips in plain Hebrew.
// ============================================================================
// One source for the tips the coach screens show and for the guidance the AI
// coach is given. Each tip carries the strength of its evidence so nothing
// weak is presented as settled. Sources (2026-10 research pass):
//   intensity  Seiler 2010; Esteve-Lanao 2007; Persinger 2004 (talk test)
//   heart rate Tanaka 2001; Nes 2013; Coyle & González-Alonso 2001 (drift)
//   paces      Daniels–Gilbert VDOT; Vickers & Vertosick 2016 (Riegel limits)
//   load       Frandsen 2025 BJSM (single-run spikes); Buist 2008; Nielsen 2014
//   technique  Heiderscheit 2011 (+5–10% step rate); Anderson 2020 (foot strike)
//   beginners  Relph 2023 (couch-to-5K); Videbæk 2015 (novice injury rate)
//   taper      Bosquet 2007; heat: Racinais 2015, Ely 2007; fluids: Hew-Butler 2015
//   fuel       Jeukendrup 2014; strength: Lauersen 2014, Blagrove 2018
//   shoes      Nigg 2015 (comfort filter); Malisoux 2020

export type TipTopic =
  | 'easy'
  | 'workouts'
  | 'load'
  | 'technique'
  | 'beginner'
  | 'race'
  | 'heat'
  | 'fuel'
  | 'recovery'
  | 'injury';

export type Evidence = 'strong' | 'moderate' | 'practice';

export interface RunningTip {
  id: string;
  topic: TipTopic;
  title: string;
  body: string;
  evidence: Evidence;
}

export const TIP_TOPIC_LABELS: Readonly<Record<TipTopic, string>> = {
  easy: 'ריצה קלה',
  workouts: 'אימוני איכות',
  load: 'עומס והתקדמות',
  technique: 'טכניקה',
  beginner: 'למתחילים',
  race: 'לקראת מרוץ',
  heat: 'חום ושתייה',
  fuel: 'אנרגיה בריצה ארוכה',
  recovery: 'התאוששות וכוח',
  injury: 'סימני אזהרה',
};

export const EVIDENCE_LABELS: Readonly<Record<Evidence, string>> = {
  strong: 'מחקר חזק',
  moderate: 'מחקר בינוני',
  practice: 'ניסיון מאמנים',
};

export const RUNNING_TIPS: readonly RunningTip[] = [
  // ── Easy running ──────────────────────────────────────────────────────────
  {
    id: 'talk-test',
    topic: 'easy',
    title: 'מבחן הדיבור',
    body: 'ריצה קלה היא קצב שבו אפשר לדבר במשפטים מלאים בנוחות. כשכבר קשה לדבר — עברתם את הסף, וזו כבר לא ריצה קלה.',
    evidence: 'moderate',
  },
  {
    id: 'mostly-easy',
    topic: 'easy',
    title: 'רוב הזמן — קל',
    body: 'רצים שמתקדמים עושים בערך 75 עד 80% מזמן הריצה בקצב קל, ורק אימון קשה אחד או שניים בשבוע. הטעות הנפוצה: ריצות קלות שמחליקות לקצב "בינוני" כל יום.',
    evidence: 'moderate',
  },
  {
    id: 'easy-hr',
    topic: 'easy',
    title: 'דופק בריצה קלה',
    body: 'ריצה קלה נשארת בערך מתחת ל-75 עד 80% מהדופק המקסימלי. נוסחאות לדופק מקסימלי טועות ב-10 פעימות ויותר לכל כיוון — דופק מקסימלי שמדדתם בעצמכם (סיום מרוץ, עליות קשות) מדויק יותר.',
    evidence: 'moderate',
  },

  // ── Quality workouts ──────────────────────────────────────────────────────
  {
    id: 'tempo',
    topic: 'workouts',
    title: 'טמפו',
    body: 'קצב "קשה ונוח" שאפשר להחזיק כשעה במרוץ: 20 דקות רצופות, או 3 עד 4 קטעים של 5 עד 8 דקות עם דקה קלה ביניהם. מתחילים ב-10 עד 15 דקות סה״כ.',
    evidence: 'practice',
  },
  {
    id: 'intervals',
    topic: 'workouts',
    title: 'אינטרוולים',
    body: 'חזרות של 3 עד 5 דקות בערך בקצב 5 ק״מ, עם ריצה קלה באורך דומה ביניהן (למשל 4 חזרות של 4 דקות). זה האימון שמעלה הכי טוב את הצריכה המקסימלית של חמצן.',
    evidence: 'moderate',
  },
  {
    id: 'strides',
    topic: 'workouts',
    title: 'האצות',
    body: 'בסוף ריצה קלה: 4 עד 8 האצות של 15 עד 20 שניות, מהירות אבל רפויות, עם דקה הליכה ביניהן. משפר צעד וקצב בלי עייפות.',
    evidence: 'practice',
  },
  {
    id: 'hard-easy',
    topic: 'workouts',
    title: 'יום קשה, יום קל',
    body: 'לא שני אימונים קשים ברצף, ולפחות 48 שעות ביניהם. מי שרץ 3 פעמים בשבוע — אימון איכות אחד מספיק.',
    evidence: 'practice',
  },

  // ── Load ──────────────────────────────────────────────────────────────────
  {
    id: 'long-run-spike',
    topic: 'load',
    title: 'הארוכה גדלה בהדרגה',
    body: 'מחקר על יותר מ-5,000 רצים מצא שריצה ארוכה ביותר מ-10% מהריצה הארוכה של החודש האחרון מעלה את הסיכון לפציעה פי 1.5 בערך. הגדילו את הארוכה בצעדים קטנים.',
    evidence: 'moderate',
  },
  {
    id: 'ten-percent',
    topic: 'load',
    title: '"כלל ה-10%"',
    body: 'הכלל המפורסם לא הוכח במחקרים. מה שכן חשוב: לא לקפוץ בבת אחת, ולתת שבוע קל יותר כל 3 עד 4 שבועות, עם כ-20 עד 30% פחות נפח.',
    evidence: 'moderate',
  },
  {
    id: 'long-run-size',
    topic: 'load',
    title: 'כמה ארוכה הארוכה',
    body: 'עד בערך רבע מהנפח השבועי ועד שעתיים וחצי. בקצב שיחה מההתחלה ועד הסוף — זו לא ריצת מבחן.',
    evidence: 'practice',
  },

  // ── Technique ─────────────────────────────────────────────────────────────
  {
    id: 'cadence',
    topic: 'technique',
    title: 'צעדים קצרים ומהירים',
    body: 'אין קצב צעדים "נכון" אחד (ה-180 המפורסם הוא מיתוס). אבל מי שפוסע רחוק מדי קדימה יכול להעלות את קצב הצעדים ב-5 עד 10% — זה מפחית עומס על הברך והירך.',
    evidence: 'moderate',
  },
  {
    id: 'landing',
    topic: 'technique',
    title: 'נחיתה מתחת לגוף',
    body: 'כף הרגל נוחתת קרוב מתחת לאגן, לא הרחק לפניו עם ברך נעולה. "צעדים קלים ושקטים" זה רמז טוב.',
    evidence: 'moderate',
  },
  {
    id: 'foot-strike',
    topic: 'technique',
    title: 'עקב או כרית?',
    body: 'אין צורך לשנות את סוג הנחיתה הטבעי שלכם. שינוי מעביר עומס מהברך לשוק ולאכילס, ולא משפר חיסכון באנרגיה.',
    evidence: 'moderate',
  },
  {
    id: 'posture',
    topic: 'technique',
    title: 'יציבה וידיים',
    body: 'גוף זקוף עם הטיה קלה מהקרסוליים, כתפיים רפויות, מרפקים בערך ב-90 מעלות שנעים קדימה-אחורה. נשימה טבעית דרך האף והפה.',
    evidence: 'practice',
  },

  // ── Beginners ─────────────────────────────────────────────────────────────
  {
    id: 'run-walk',
    topic: 'beginner',
    title: 'ריצה-הליכה',
    body: 'מתחילים בסבבים של ריצה קלה והליכה, 3 פעמים בשבוע עם יום מנוחה ביניהם. בערך 9 שבועות עד 30 דקות רצופות. מתקדמים שלב רק אם השבוע עבר בלי כאב שנשאר יותר מיום.',
    evidence: 'practice',
  },
  {
    id: 'one-thing',
    topic: 'beginner',
    title: 'משנים דבר אחד בכל פעם',
    body: 'קודם מאריכים את קטעי הריצה, אחר כך מוסיפים ריצה בשבוע, ורק בסוף מהירות. אימונים מהירים — רק אחרי שחצי שעה רצופה 3 פעמים בשבוע מרגישה טבעית.',
    evidence: 'practice',
  },

  // ── Race ──────────────────────────────────────────────────────────────────
  {
    id: 'taper',
    topic: 'race',
    title: 'הורדת עומס לפני מרוץ',
    body: 'בשבוע או שבועיים האחרונים (שבוע ל-5 עד 10 ק״מ, כשבועיים למרתון) מורידים 40 עד 60% מהנפח, ושומרים על אימון קצר בקצב המרוץ. לא מוסיפים כושר בשבוע האחרון — רק רעננות.',
    evidence: 'moderate',
  },
  {
    id: 'pacing',
    topic: 'race',
    title: 'חלוקת מאמץ במרוץ',
    body: 'קצב אחיד, או סיום מעט מהיר מההתחלה. 3 עד 5 הקילומטרים הראשונים לא מהירים מקצב המטרה. בחום או בעליות — רצים לפי מאמץ, לא לפי שעון.',
    evidence: 'moderate',
  },
  {
    id: 'prediction',
    topic: 'race',
    title: 'כמה מדויקת התחזית',
    body: 'התחזית לזמן מרוץ מבוססת על הריצה הכי טובה שלכם ומדויקת יחסית מ-5 ק״מ עד חצי מרתון. למרתון היא אופטימית מדי אצל חלק גדול מהרצים, במיוחד עם נפח שבועי נמוך.',
    evidence: 'moderate',
  },

  // ── Heat & fluids ─────────────────────────────────────────────────────────
  {
    id: 'israeli-summer',
    topic: 'heat',
    title: 'הקיץ הישראלי',
    body: 'רצים מוקדם בבוקר או אחרי השקיעה, ומודדים לפי תחושה ודופק — לא לפי הקצב של החורף. אימונים קשים עוברים לשעות הקרירות.',
    evidence: 'moderate',
  },
  {
    id: 'acclimatize',
    topic: 'heat',
    title: 'הסתגלות לחום',
    body: 'הגוף מסתגל לחום תוך 10 עד 14 ימים של אימונים בחום. בימים הראשונים מורידים נפח ועצימות.',
    evidence: 'strong',
  },
  {
    id: 'drink-to-thirst',
    topic: 'heat',
    title: 'שותים לפי צמא',
    body: 'לא צריך "להשקות את עצמכם" — שתייה מוגזמת מסוכנת. בריצה של יותר משעה קחו מים איתכם ושתו לפי צמא. מלחים חשובים בעיקר בריצות של שעתיים ויותר בחום.',
    evidence: 'strong',
  },
  {
    id: 'heat-danger',
    topic: 'heat',
    title: 'מכת חום',
    body: 'בלבול, הפסקת הזעה, בחילה או סחרחורת בחום — עוצרים מיד, נכנסים לצל ומתקררים. אם זה לא חולף — פונים לעזרה רפואית.',
    evidence: 'strong',
  },

  // ── Fuel ──────────────────────────────────────────────────────────────────
  {
    id: 'carbs-long',
    topic: 'fuel',
    title: 'פחמימות בריצה ארוכה',
    body: 'בריצה של עד שעה ורבע לא צריך לאכול בדרך. בריצות ארוכות יותר: 30 עד 60 גרם פחמימות לשעה, מתחילים אחרי 30 עד 45 דקות, ומתרגלים את זה באימונים לפני המרוץ.',
    evidence: 'strong',
  },

  // ── Recovery & strength ───────────────────────────────────────────────────
  {
    id: 'strength',
    topic: 'recovery',
    title: 'אימוני כוח מגינים',
    body: 'אימוני כוח מפחיתים פציעות ספורט לכשליש, ופעמיים בשבוע של 20 עד 30 דקות גם משפרות חיסכון בריצה. סקוואט, לאנג׳, הרמת עקבים וגשר ירכיים הם התחלה טובה.',
    evidence: 'moderate',
  },
  {
    id: 'sleep',
    topic: 'recovery',
    title: 'שינה',
    body: 'לפחות 7 שעות בלילה. אחרי שני לילות קצרים — הפכו את האימון הקשה לריצה קלה.',
    evidence: 'practice',
  },
  {
    id: 'shoes',
    topic: 'recovery',
    title: 'נעליים',
    body: 'הקריטריון הכי טוב שיש: הנעל הכי נוחה לכם. מחליפים לפי תחושה ובלאי (רבים עושים זאת אחרי 500 עד 800 ק״מ), ושני זוגות לסירוגין עשויים לעזור.',
    evidence: 'practice',
  },

  // ── Injury red flags ──────────────────────────────────────────────────────
  {
    id: 'bone-pain',
    topic: 'injury',
    title: 'כאב בעצם — עוצרים',
    body: 'כאב נקודתי שאפשר להצביע עליו באצבע אחת, כאב בקפיצה על רגל אחת, כאב במנוחה או בלילה, או כאב שגורם לצליעה — מפסיקים לרוץ ופונים לרופא או לפיזיותרפיסט. אלה סימנים של שבר מאמץ.',
    evidence: 'practice',
  },
  {
    id: 'pain-rule',
    topic: 'injury',
    title: 'מתי ממשיכים',
    body: 'כאב קל שלא עולה במהלך הריצה ונעלם תוך יום — לרוב בסדר. כאב שמתגבר בריצה, משנה את הצעד או נשאר יותר מיום — עוצרים ובודקים.',
    evidence: 'practice',
  },
  {
    id: 'emergency',
    topic: 'injury',
    title: 'סימנים דחופים',
    body: 'כאב בחזה, עילפון, דפיקות לב חריגות או קוצר נשימה חריג — עוצרים מיד ופונים לעזרה רפואית.',
    evidence: 'strong',
  },
];

/** Tips that fit the moment: summer → heat first, new runner → beginner first. */
export function tipsFor(
  context: { isSummer: boolean; isBeginner: boolean },
  limit = 4
): RunningTip[] {
  const priority: TipTopic[] = [
    ...(context.isSummer ? (['heat'] as const) : []),
    ...(context.isBeginner ? (['beginner'] as const) : (['workouts', 'load'] as const)),
    'easy',
    'technique',
    'recovery',
  ];
  const picked: RunningTip[] = [];
  for (const topic of priority) {
    const tip = RUNNING_TIPS.find((t) => t.topic === topic && !picked.includes(t));
    if (tip) picked.push(tip);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** The Israeli hot season, for heat advice. */
export const isHotSeason = (d: Date): boolean => [5, 6, 7, 8, 9].includes(d.getMonth() + 1);
