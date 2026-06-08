// ============================================================================
// CONSENT CHECKBOXES — reusable terms + privacy acceptance controls.
// Controlled component; used by the ConsentGate (and reusable in onboarding).
// Links open the public /legal/* pages in a new tab so the user can read the
// full document before accepting. RTL, AA contrast, accessible labels.
// ============================================================================

interface ConsentCheckboxesProps {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  onChange: (next: { acceptedTerms: boolean; acceptedPrivacy: boolean }) => void;
  /** Shows the minor / guardian acknowledgement note when true. */
  isMinor?: boolean;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '14px 0',
};

const CHECKBOX_STYLE: React.CSSProperties = {
  width: 22,
  height: 22,
  flexShrink: 0,
  marginTop: 2,
  accentColor: 'var(--fs-accent)',
  cursor: 'pointer',
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--fs-ink)',
  cursor: 'pointer',
};

const LINK_STYLE: React.CSSProperties = {
  color: 'var(--fs-accent)',
  textDecoration: 'underline',
  fontWeight: 600,
};

export default function ConsentCheckboxes({
  acceptedTerms,
  acceptedPrivacy,
  onChange,
  isMinor = false,
}: ConsentCheckboxesProps) {
  return (
    <div dir="rtl">
      <div style={ROW_STYLE}>
        <input
          id="consent-terms"
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => onChange({ acceptedTerms: e.target.checked, acceptedPrivacy })}
          style={CHECKBOX_STYLE}
        />
        <label htmlFor="consent-terms" style={LABEL_STYLE}>
          קראתי ואני מאשר/ת את{' '}
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
            תנאי השימוש
          </a>
        </label>
      </div>

      <div style={ROW_STYLE}>
        <input
          id="consent-privacy"
          type="checkbox"
          checked={acceptedPrivacy}
          onChange={(e) => onChange({ acceptedTerms, acceptedPrivacy: e.target.checked })}
          style={CHECKBOX_STYLE}
        />
        <label htmlFor="consent-privacy" style={LABEL_STYLE}>
          קראתי ואני מאשר/ת את{' '}
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" style={LINK_STYLE}>
            מדיניות הפרטיות
          </a>
        </label>
      </div>

      {isMinor && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--fs-muted)',
            margin: '8px 0 0',
          }}
        >
          למשתמשים מתחת לגיל המינימלי — נדרש אישור והסכמה של הורה או אפוטרופוס.
        </p>
      )}
    </div>
  );
}
