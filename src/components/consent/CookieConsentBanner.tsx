// ============================================================================
// COOKIE CONSENT BANNER — first-party tracking-preference prompt.
//
// Shows until the user makes a choice (accept all / necessary only / manage).
// Analytics SDKs (Sentry + web-vitals) start only after opt-in — see main.tsx.
// Honors Global Privacy Control. Rendered app-wide (any auth state).
//
// Design system: Fresh Steel / Obsidian (var(--fs-*) tokens only).
// ============================================================================

import { useState } from 'react';
import {
  acceptAllTracking,
  getTrackingConsent,
  isGpcEnabled,
  isTrackingDecided,
  rejectNonEssentialTracking,
  setTrackingConsent,
} from '../../services/tracking/trackingConsent';

const BTN_BASE: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 'var(--radius-asymmetric)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  border: 'none',
};

export function CookieConsentBanner() {
  const [decided, setDecided] = useState(() => isTrackingDecided());
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(() => getTrackingConsent().analytics);

  if (decided) return null;

  const acceptAll = () => {
    acceptAllTracking();
    setDecided(true);
  };
  const onlyNecessary = () => {
    rejectNonEssentialTracking();
    setDecided(true);
  };
  const savePrefs = () => {
    setTrackingConsent({ analytics, marketing: false });
    setDecided(true);
  };

  return (
    <div
      role="region"
      aria-label="הסכמה לעוגיות ולמעקב"
      dir="rtl"
      lang="he"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 60,
        background: 'var(--fs-surface)',
        borderTop: '2px solid var(--fs-accent)',
        padding: '16px 20px max(16px, env(safe-area-inset-bottom, 16px))',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ maxWidth: 720, marginInline: 'auto' }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--fs-ink)',
            margin: '0 0 12px',
          }}
        >
          אנו משתמשים בעוגיות הכרחיות לתפקוד האפליקציה, ובכלי ניטור (אנליטיקה) רק לאחר הסכמתך, כדי
          לשפר את היציבות והחוויה.{' '}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--fs-link)', textDecoration: 'underline', fontWeight: 600 }}
          >
            מדיניות הפרטיות
          </a>
          {isGpcEnabled() && ' · זוהה אות Global Privacy Control — מעקב יישאר כבוי כברירת מחדל.'}
        </p>

        {showPrefs && (
          <div
            style={{
              background: 'var(--fs-surface-2)',
              borderRadius: 'var(--radius-asymmetric)',
              padding: '12px 14px',
              margin: '0 0 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <input
                id="cc-necessary"
                type="checkbox"
                checked
                disabled
                style={{ width: 20, height: 20 }}
              />
              <label
                htmlFor="cc-necessary"
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fs-muted)' }}
              >
                הכרחי (תמיד פעיל) — נדרש לתפקוד האפליקציה
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <input
                id="cc-analytics"
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--fs-accent)' }}
              />
              <label
                htmlFor="cc-analytics"
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fs-ink)' }}
              >
                אנליטיקה ויציבות (Sentry, Web Vitals)
              </label>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={acceptAll}
            className="active:scale-[0.98]"
            style={{
              ...BTN_BASE,
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
            }}
          >
            אישור הכל
          </button>
          {showPrefs ? (
            <button
              type="button"
              onClick={savePrefs}
              className="active:scale-[0.98]"
              style={{
                ...BTN_BASE,
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-ink)',
                border: '1px solid var(--fs-accent)',
              }}
            >
              שמירת העדפות
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPrefs(true)}
              className="active:scale-[0.98]"
              style={{ ...BTN_BASE, background: 'var(--fs-surface-2)', color: 'var(--fs-ink)' }}
            >
              ניהול העדפות
            </button>
          )}
          <button
            type="button"
            onClick={onlyNecessary}
            className="active:scale-[0.98]"
            style={{ ...BTN_BASE, background: 'transparent', color: 'var(--fs-muted)' }}
          >
            רק הכרחי
          </button>
        </div>
      </div>
    </div>
  );
}
