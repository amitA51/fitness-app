// ============================================================================
// LEGAL DOCUMENT CONTENT — SSOT for terms / privacy / coach_terms (he)
//
// This is the single source of truth for the *text* of each legal document.
// The matching DB rows in `legal_documents` (see migration 20260609000000)
// store only a version + content_hash; the body lives here in the repo so it
// can be code-reviewed and rendered offline.
//
// WARNING: DRAFT — REQUIRES HUMAN LEGAL REVIEW BEFORE PRODUCTION.
// The wording below is a structured starting point for a Hebrew fitness PWA
// (health disclaimer, Israeli governing law, GDPR/CCPA-style data rights). It
// is NOT legal advice and MUST be reviewed/approved by a lawyer before it is
// published or relied upon. Bump `version` whenever the text materially
// changes so the versioned-consent gate re-prompts users.
//
// Design system: Fresh Steel / Obsidian.
// ============================================================================

export type LegalDocType = 'terms' | 'privacy' | 'coach_terms';

export interface LegalSection {
  /** Section heading (Hebrew). */
  heading: string;
  /** Body paragraphs (Hebrew). */
  body?: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
}

export interface LegalDoc {
  docType: LegalDocType;
  /** Small eyebrow label above the title. */
  subtitle: string;
  /** Page H1. */
  title: string;
  /** Semantic version — keep in sync with the `legal_documents` seed row. */
  version: string;
  locale: 'he';
  /** ISO date (yyyy-mm-dd) the version takes effect. */
  effectiveDate: string;
  /** When true the page shows a visible "draft — pending legal review" banner. */
  isDraft: boolean;
  sections: LegalSection[];
}

// Shared version stamp for the first published set. Keep these aligned with the
// seed migration once it is applied.
const V1 = '2026-06-09';

export const TERMS_DOC: LegalDoc = {
  docType: 'terms',
  subtitle: 'SparkOS Fitness',
  title: 'תנאי שימוש',
  version: V1,
  locale: 'he',
  effectiveDate: V1,
  isDraft: true,
  sections: [
    {
      heading: 'קבלת התנאים',
      body: [
        'השימוש באפליקציית SparkOS Fitness ("האפליקציה") כפוף לתנאי שימוש אלה. עצם השימוש באפליקציה מהווה הסכמה מלאה לתנאים. אם אינך מסכים לתנאי כלשהו — אנא הימנע משימוש באפליקציה.',
        'אנו רשאים לעדכן תנאים אלה מעת לעת. בעת עדכון מהותי תתבקש לאשר מחדש את הגרסה המעודכנת לפני המשך השימוש.',
      ],
    },
    {
      heading: 'כשירות וגיל מינימלי',
      body: [
        'השימוש באפליקציה מותר ממלאו 16 שנים, או בגיל המינימלי הנדרש במדינת מגוריך לצורך מתן הסכמה דיגיטלית, לפי הגבוה. משתמשים מתחת לגיל זה נדרשים לאישור והסכמה של אפוטרופוס.',
        'בהרשמה אתה מצהיר כי הפרטים שמסרת נכונים וכי אתה כשיר משפטית להתקשר בהסכם זה.',
      ],
    },
    {
      heading: 'הצהרת בריאות ואחריות רפואית',
      body: [
        'האפליקציה מספקת מידע, תוכניות אימון ומעקב תזונתי למטרות מידע וכושר כלליות בלבד, ואינה מהווה ייעוץ רפואי, אבחון או טיפול.',
        'התייעץ עם רופא לפני תחילת כל תוכנית אימון או תזונה, במיוחד אם יש לך מצב רפואי קיים, פציעה, או שאת בהיריון. הפסק כל פעילות ופנה לעזרה רפואית במקרה של כאב, סחרחורת או מצוקה. השימוש באפליקציה הוא על אחריותך בלבד.',
      ],
    },
    {
      heading: 'חשבון המשתמש',
      body: [
        'אתה אחראי לשמירת סודיות פרטי ההתחברות שלך ולכל פעילות המתבצעת בחשבונך. יש להודיע לנו מיד על כל שימוש לא מורשה.',
      ],
    },
    {
      heading: 'שימוש מקובל',
      body: ['בעת השימוש באפליקציה אתה מתחייב שלא:'],
      bullets: [
        'להעלות תוכן בלתי חוקי, פוגעני, מטריד, מפר זכויות יוצרים או פרטיות של אחרים',
        'להתחזות לאדם או גוף אחר או למסור מידע כוזב',
        'לנסות לפרוץ, לשבש או להעמיס על המערכת או על משתמשים אחרים',
        'לעשות שימוש מסחרי לא מורשה בתוכן או בנתוני משתמשים אחרים',
      ],
    },
    {
      heading: 'קהילה ותוכן משתמשים',
      body: [
        'תכונות הקהילה והקבוצות מאפשרות פרסום תוכן על ידי משתמשים. האחריות לתוכן שתפרסם היא שלך בלבד. אנו רשאים להסיר תוכן, להשעות או לחסום משתמשים המפרים תנאים אלה, ומפעילים מנגנוני דיווח וחסימה.',
      ],
    },
    {
      heading: 'מאמנים ומתאמנים',
      body: [
        'האפליקציה מאפשרת קשר בין מאמנים למתאמנים. SparkOS Fitness היא פלטפורמה טכנולוגית בלבד ואינה צד להתקשרות המקצועית בין מאמן למתאמן, ואינה אחראית לתוכן, לאיכות או לתוצאות של שירותי האימון.',
      ],
    },
    {
      heading: 'מנויים ותשלומים',
      body: [
        'חלק מהתכונות עשויות להיות בתשלום במסגרת מנוי חודשי או שנתי. תנאי המנוי, התמחור, החידוש האוטומטי והביטול יוצגו במפורש בעת הרכישה. רכישות דרך חנויות האפליקציות כפופות גם לתנאי החנות הרלוונטית.',
      ],
    },
    {
      heading: 'קניין רוחני',
      body: [
        'כל הזכויות באפליקציה, בעיצוב, בקוד ובתכנים (למעט תוכן שהעלית) שמורות ל-SparkOS Fitness. אין להעתיק, להפיץ או ליצור יצירות נגזרות ללא אישור בכתב.',
      ],
    },
    {
      heading: 'הגבלת אחריות',
      body: [
        'האפליקציה ניתנת כפי שהיא ("as is"). במידה המרבית המותרת בדין, איננו אחראים לכל נזק ישיר או עקיף הנובע מהשימוש או מאי-היכולת להשתמש באפליקציה.',
      ],
    },
    {
      heading: 'סיום',
      body: [
        'אנו רשאים להשעות או לסיים את גישתך לאפליקציה בכל עת בגין הפרת תנאים אלה. באפשרותך למחוק את חשבונך בכל עת דרך מסך ההגדרות.',
      ],
    },
    {
      heading: 'דין וסמכות שיפוט',
      body: [
        'על תנאים אלה יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים במחוז המתאים בישראל.',
      ],
    },
    {
      heading: 'יצירת קשר',
      body: ['לשאלות בנוגע לתנאי שימוש אלה ניתן לפנות בדוא״ל: pgishonim@gmail.com'],
    },
  ],
};

export const PRIVACY_DOC: LegalDoc = {
  docType: 'privacy',
  subtitle: 'SparkOS Fitness',
  title: 'מדיניות פרטיות',
  version: V1,
  locale: 'he',
  effectiveDate: V1,
  isDraft: true,
  sections: [
    {
      heading: 'כללי',
      body: [
        'מדיניות פרטיות זו מסבירה אילו נתונים אנו אוספים, כיצד אנו משתמשים בהם ומהן זכויותיך. אנו מחויבים להגנה על פרטיותך ופועלים בהתאם לחוק הגנת הפרטיות הישראלי, ובמקומות הרלוונטיים בהתאם ל-GDPR ול-CCPA.',
      ],
    },
    {
      heading: 'אילו נתונים אנו אוספים',
      bullets: [
        'פרטי חשבון: שם, כתובת דוא״ל ופרטי הזדהות',
        'נתוני פרופיל וכושר: גיל/תאריך לידה, מין, גובה, משקל, מטרות ורמת ניסיון',
        'נתוני שימוש: אימונים, תזונה, מדידות, תמונות התקדמות והודעות',
        'נתונים טכניים: סוג מכשיר ונתוני שגיאות (למטרות יציבות, בכפוף להסכמתך)',
      ],
    },
    {
      heading: 'כיצד אנו משתמשים בנתונים',
      bullets: [
        'הפעלת האפליקציה ומתן השירותים (בסיס חוקי: ביצוע חוזה)',
        'התאמה אישית של תוכניות ומעקב התקדמות',
        'שיפור יציבות ואבחון תקלות (בסיס חוקי: הסכמה / אינטרס לגיטימי)',
        'תקשורת תפעולית ועדכוני שירות',
      ],
    },
    {
      heading: 'ספקי משנה (Sub-processors)',
      body: ['אנו נעזרים בספקי שירות מהימנים לצורך הפעלת האפליקציה:'],
      bullets: [
        'Supabase — אחסון נתונים, הזדהות ושרתים',
        'Sentry — ניטור שגיאות ויציבות (נטען רק לאחר הסכמתך)',
        'ספקי תשלום וחנויות אפליקציות — לעיבוד מנויים (בעת הפעלת התכונה)',
      ],
    },
    {
      heading: 'אין מכירת מידע',
      body: [
        'איננו מוכרים את המידע האישי שלך ואיננו משתפים אותו עם צדדים שלישיים למטרות פרסום. בהתאם ל-CCPA, באפשרותך לממש את הזכות "Do Not Sell or Share".',
      ],
    },
    {
      heading: 'זכויותיך',
      body: ['בכפוף לדין החל, באפשרותך לממש את הזכויות הבאות:'],
      bullets: [
        'עיון וקבלת עותק של המידע שלך (ייצוא נתוני המכשיר דרך ההגדרות)',
        'תיקון מידע שגוי',
        'מחיקת חשבונך והמידע שלך ("הזכות להישכח") דרך ההגדרות',
        'משיכת הסכמה בכל עת',
      ],
    },
    {
      heading: 'שמירת מידע ואבטחה',
      body: [
        'אנו שומרים את המידע כל עוד חשבונך פעיל או כנדרש לצרכים חוקיים. אנו נוקטים אמצעי אבטחה סבירים, לרבות בקרת גישה ברמת השורה (RLS) והצפנה בתעבורה.',
      ],
    },
    {
      heading: 'קטינים',
      body: [
        'האפליקציה אינה מיועדת למשתמשים מתחת לגיל המינימלי החל ללא הסכמת אפוטרופוס. איננו אוספים ביודעין מידע מקטינים ללא הסכמה כנדרש.',
      ],
    },
    {
      heading: 'עוגיות ומעקב',
      body: [
        'אנו משתמשים באחסון מקומי הכרחי לתפקוד האפליקציה, ובכלים אנליטיים/ניטור רק לאחר קבלת הסכמתך. באפשרותך לנהל את העדפות המעקב במרכז ההעדפות.',
      ],
    },
    {
      heading: 'יצירת קשר',
      body: ['לשאלות או לבקשות בנושא פרטיות ניתן לפנות בדוא״ל: pgishonim@gmail.com'],
    },
  ],
};

export const COACH_TERMS_DOC: LegalDoc = {
  docType: 'coach_terms',
  subtitle: 'SparkOS Fitness — מאמנים',
  title: 'תנאים למאמנים',
  version: V1,
  locale: 'he',
  effectiveDate: V1,
  isDraft: true,
  sections: [
    {
      heading: 'תנאים נוספים למאמנים',
      body: ['תנאים אלה חלים בנוסף לתנאי השימוש הכלליים על משתמשים הפועלים כמאמנים בפלטפורמה.'],
    },
    {
      heading: 'אחריות מקצועית',
      body: [
        'כמאמן, אתה האחראי הבלעדי לתוכן, לבטיחות ולהתאמה של תוכניות האימון והתזונה שאתה מספק למתאמנים. עליך להחזיק בהכשרה ובהרשאות הנדרשות בדין.',
      ],
    },
    {
      heading: 'נתוני מתאמנים',
      body: [
        'בעת גישה לנתוני מתאמנים אתה מעבד מידע אישי ומתחייב לשמור על סודיותו, להשתמש בו אך ורק לצורך מתן שירותי האימון, ולפעול בהתאם למדיניות הפרטיות ולדין החל.',
      ],
    },
    {
      heading: 'יצירת קשר',
      body: ['לשאלות בנושא תנאים למאמנים ניתן לפנות בדוא״ל: pgishonim@gmail.com'],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocType, LegalDoc> = {
  terms: TERMS_DOC,
  privacy: PRIVACY_DOC,
  coach_terms: COACH_TERMS_DOC,
};
