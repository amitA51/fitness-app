// ============================================================================
// ACCESSIBILITY STATEMENT PAGE — הצהרת נגישות
//
// Mandatory Israeli accessibility statement (Hatzaharat Negishot) per IS 5568
// (anchored to WCAG 2.0 AA) and the Equal Rights for Persons with Disabilities
// (Service Accessibility Accommodations) Regulations, 2013.
//
// Design system: Fresh Steel / Obsidian (see DESIGN.md + src/styles/tokens.css)
// ============================================================================

// ============================================================================
// SECTION HEADING STYLES (local — no external dependency needed)
// ============================================================================

const PAGE_SUBTITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fs-muted)',
  margin: 0,
  lineHeight: 1.4,
};

const PAGE_TITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 26,
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
  color: 'var(--fs-ink)',
  margin: '4px 0 0',
};

const SECTION_HEADING_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: '-0.01em',
  color: 'var(--fs-ink)',
  margin: '0 0 10px' as const,
};

const BODY_TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.7,
  color: 'var(--fs-ink)',
  margin: '0 0 8px',
};

const MUTED_TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--fs-muted)',
  margin: '0 0 6px',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccessibilityStatement() {
  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
      lang="he"
    >
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingInlineStart: 'max(20px, var(--safe-inline-start))',
          paddingInlineEnd: 'max(20px, var(--safe-inline-end))',
          paddingBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <p style={PAGE_SUBTITLE_STYLE}>SparkOS Fitness</p>
        <h1 style={PAGE_TITLE_STYLE}>הצהרת נגישות</h1>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <article className="px-5 pt-6" aria-label="הצהרת נגישות">
        {/* ── Commitment ─────────────────────────────────────────────────── */}
        <section
          className="mb-6"
          style={{
            background: 'var(--fs-surface)',
            borderRadius: 'var(--radius-asymmetric)',
            padding: '20px',
          }}
        >
          <h2 style={SECTION_HEADING_STYLE}>מחויבות לנגישות</h2>
          <p style={BODY_TEXT_STYLE}>
            אנו ב-SparkOS Fitness מחויבים להנגשת האפליקציה לאנשים עם מוגבלויות, בהתאם לחוק שוויון
            זכויות לאנשים עם מוגבלות, התשנ״ח-1998, ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות
            נגישות לשירות), התשע״ג-2013.
          </p>
          <p style={BODY_TEXT_STYLE}>
            אנו פועלים להתאמת האפליקציה לדרישות תקן ישראלי IS 5568, המעוגן ב-WCAG 2.0 ברמת AA. שיפור
            הנגישות הוא תהליך מתמשך, ואנו ממשיכים לפעול לשיפורו.
          </p>
        </section>

        {/* ── Scope & conformance level ─────────────────────────────────────── */}
        <section
          className="mb-6"
          style={{
            background: 'var(--fs-surface)',
            borderRadius: 'var(--radius-asymmetric)',
            padding: '20px',
          }}
        >
          <h2 style={SECTION_HEADING_STYLE}>תחולה ורמת התאמה</h2>
          <p style={BODY_TEXT_STYLE}>
            הצהרה זו חלה על אפליקציית SparkOS Fitness, לרבות גרסת ה-PWA והגרסאות לנייד.
          </p>
          <p style={BODY_TEXT_STYLE}>
            רמת ההתאמה הנדרשת: תקן ישראלי IS 5568, המעוגן ב-WCAG 2.0 ברמה AA. הבדיקה האחרונה כללה
            כלים אוטומטיים ובדיקה ידנית עם קוראי מסך.
          </p>
          <p style={MUTED_TEXT_STYLE}>
            אם רכיב כלשהו אינו נגיש עבורך, נשמח לסייע ולספק את המידע בדרך חלופית — ראו פרטי פנייה
            בהמשך.
          </p>
        </section>

        {/* ── Implemented accommodations ──────────────────────────────────── */}
        <section
          className="mb-6"
          style={{
            background: 'var(--fs-surface)',
            borderRadius: 'var(--radius-asymmetric)',
            padding: '20px',
          }}
        >
          <h2 style={SECTION_HEADING_STYLE}>אמצעי נגישות מיושמים</h2>
          <ul
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              lineHeight: 1.8,
              color: 'var(--fs-ink)',
              paddingInlineStart: '1.4em',
              margin: 0,
            }}
          >
            <li>ניווט באמצעות מקלדת בכל המסכים המרכזיים, כולל קישור דילוג לתוכן</li>
            <li>מבנה סמנטי ותוויות נגישות בעברית לכפתורים ולאלמנטים האינטראקטיביים</li>
            <li>
              יחס ניגודיות של 4.5:1 לפחות לטקסט הרגיל במסכים המרכזיים, בשתי ערכות הנושא. מרכיבים
              בודדים עדיין נבדקים ומטופלים — ראו "מגבלות נגישות ידועות".
            </li>
            <li>
              תמיכה בהעדפת הפחתת תנועה (
              <span dir="ltr" lang="en">
                prefers-reduced-motion
              </span>
              ), וכן מתג "הפחתת אנימציות" בהגדרות האפליקציה
            </li>
            <li>מתג "ניגודיות גבוהה" ומתג "טקסט גדול" בהגדרות האפליקציה</li>
            <li>
              מבנה כותרות היררכי (
              <span dir="ltr" lang="en">
                h1 → h2 → h3
              </span>
              ) בדפי התוכן והמסכים המרכזיים
            </li>
            <li>
              תמיכה בכיוון טקסט מימין לשמאל (
              <span dir="ltr" lang="en">
                dir="rtl"
              </span>
              ) בהתאם לתקן IS 5568
            </li>
          </ul>
        </section>

        {/* ── Known limitations ────────────────────────────────────────────── */}
        <section
          className="mb-6"
          style={{
            background: 'var(--fs-surface)',
            borderRadius: 'var(--radius-asymmetric)',
            padding: '20px',
          }}
        >
          <h2 style={SECTION_HEADING_STYLE}>מגבלות נגישות ידועות</h2>
          <p style={MUTED_TEXT_STYLE}>להלן מגבלות נגישות הידועות לנו ואנו עובדים לפתרונן:</p>
          <ul
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.8,
              color: 'var(--fs-muted)',
              paddingInlineStart: '1.4em',
              margin: 0,
            }}
          >
            <li>
              תרשימים וגרפים מסוימים מציגים תיאור מקוצר בלבד; אנו משלימים חלופה טקסטואלית מלאה
              לנתונים.
            </li>
            <li>
              טרם הושלמה בדיקה ידנית מקיפה עם קוראי מסך (NVDA, JAWS, VoiceOver, TalkBack) בכל
              המסכים. תמיכה סמנטית קיימת, אך אנו לא מצהירים על התאמה מלאה עד להשלמת הבדיקה.
            </li>
            <li>
              חלק מהמסכים המשניים כוללים אזורי לחיצה קטנים מ־44×44 פיקסלים. המסכים המרכזיים תוקנו,
              והשאר בטיפול.
            </li>
            <li>
              בדיקת נגישות אוטומטית (axe) מורצת בתהליך הבנייה על הדפים הציבוריים בלבד; המסכים
              שמאחורי ההתחברות עדיין נבדקים ידנית.
            </li>
          </ul>
        </section>

        {/* ── Contact / Accessibility coordinator ─────────────────────────── */}
        <section
          className="mb-6"
          style={{
            background: 'var(--fs-surface)',
            borderRadius: 'var(--radius-asymmetric)',
            padding: '20px',
          }}
        >
          <h2 style={SECTION_HEADING_STYLE}>פנייה בנושא נגישות</h2>
          <p style={BODY_TEXT_STYLE}>נתקלתם בבעיית נגישות או שיש לכם הצעה לשיפור? נשמח לשמוע.</p>

          {/* OWNER ACTION BEFORE PUBLISHING: Israeli accessibility regulations expect a
              NAMED coordinator with a role, not a brand name. Replace the value below with
              the real full name + title, and have a lawyer confirm the response-time
              wording. Until then this reads as an organisational contact, which is honest
              but not yet sufficient. */}
          <p style={MUTED_TEXT_STYLE}>
            <strong style={{ color: 'var(--fs-ink)' }}>אחראי/ת נגישות:</strong> צוות SparkOS Fitness
          </p>
          <p style={MUTED_TEXT_STYLE}>
            <strong style={{ color: 'var(--fs-ink)' }}>דוא״ל:</strong>{' '}
            <a
              href="mailto:pgishonim@gmail.com"
              dir="ltr"
              style={{
                color: 'var(--fs-link)',
                textDecoration: 'underline',
                fontFamily: 'var(--font-body)',
              }}
            >
              pgishonim@gmail.com
            </a>
          </p>
          <p style={{ ...MUTED_TEXT_STYLE, marginTop: 12, fontSize: 13 }}>
            בהתאם לתקנות, פניות יטופלו בתוך 60 ימי עסקים.
          </p>
        </section>

        {/* ── Last updated ─────────────────────────────────────────────────── */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            textAlign: 'center',
            paddingBottom: '8px',
          }}
        >
          גרסה 1.2 · תאריך עדכון אחרון: 26 ביולי 2026
        </p>
      </article>
    </div>
  );
}
