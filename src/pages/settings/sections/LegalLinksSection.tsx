// ============================================================================
// SETTINGS · LEGAL & PRIVACY HUB
//
// Terms / Privacy / Accessibility links + a re-manageable tracking-consent
// toggle (GDPR: consent must be as easy to withdraw as to give). The links use
// the public /legal/* routes so they double as the App Store / Play listing URLs.
// ============================================================================

import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getTrackingConsent, setTrackingConsent } from '../../../services/tracking/trackingConsent';

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  overflow: 'hidden',
  marginBottom: 20,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--fs-ink)',
  textDecoration: 'none',
};

const DIVIDER: React.CSSProperties = { height: 1, background: 'var(--fs-surface-2)' };

const LINKS: Array<{ to: string; label: string }> = [
  { to: '/legal/terms', label: 'תנאי שימוש' },
  { to: '/legal/privacy', label: 'מדיניות פרטיות' },
  { to: '/accessibility', label: 'הצהרת נגישות' },
];

export function LegalLinksSection() {
  const [analytics, setAnalytics] = useState(() => getTrackingConsent().analytics);

  const toggleAnalytics = () => {
    const next = !analytics;
    setAnalytics(next);
    setTrackingConsent({ analytics: next, marketing: getTrackingConsent().marketing });
  };

  return (
    <div style={CARD_STYLE}>
      {LINKS.map((link, i) => (
        <div key={link.to}>
          {i > 0 && <div style={DIVIDER} />}
          <Link to={link.to} style={ROW_STYLE}>
            <span>{link.label}</span>
            <ChevronLeft size={18} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
          </Link>
        </div>
      ))}

      <div style={DIVIDER} />

      <div style={ROW_STYLE}>
        <span id="track-pref-label">מעקב אנליטיקה ויציבות</span>
        <button
          type="button"
          role="switch"
          aria-checked={analytics}
          aria-labelledby="track-pref-label"
          onClick={toggleAnalytics}
          className="active:scale-[0.98]"
          style={{
            width: 52,
            height: 30,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            background: analytics ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            transition: 'background 0.15s ease',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 3,
              insetInlineStart: analytics ? 25 : 3,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: analytics ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
              transition: 'inset-inline-start 0.15s ease',
            }}
          />
        </button>
      </div>
    </div>
  );
}
