// ============================================================================
// CONSENT GATE — blocking (re-)acceptance screen.
//
// When the signed-in user must accept updated terms/privacy, this replaces the
// app with a full-screen consent prompt. It allowlists the public /legal/* and
// /accessibility routes so the user can READ the documents before accepting.
// Fail-open: dormant until the legal_documents seed exists (no rows → no block).
//
// Design system: Fresh Steel / Obsidian (var(--fs-*) tokens only).
// ============================================================================

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useConsent } from '../../contexts/ConsentContext';
import ConsentCheckboxes from './ConsentCheckboxes';

// Routes that must stay reachable even while consent is pending (so the user
// can read what they are being asked to accept).
const PUBLIC_ALLOWLIST = /^\/(legal\/|accessibility)/;

export function ConsentGate({ children }: { children: ReactNode }) {
  const { loading, needsConsent, accept } = useConsent();
  const location = useLocation();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const blocking = !loading && needsConsent && !PUBLIC_ALLOWLIST.test(location.pathname);

  useEffect(() => {
    if (blocking) headingRef.current?.focus();
  }, [blocking]);

  if (!blocking) return <>{children}</>;

  const canSubmit = acceptedTerms && acceptedPrivacy && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await accept();
    } catch {
      setError('שמירת ההסכמה נכשלה. בדקו את החיבור ונסו שוב.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
      dir="rtl"
      lang="he"
      className="min-h-screen min-h-[100dvh] flex items-center justify-center px-5"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--fs-surface)',
          borderRadius: 'var(--radius-asymmetric)',
          padding: 24,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fs-muted)',
            margin: 0,
          }}
        >
          SparkOS Fitness
        </p>
        <h1
          id="consent-gate-title"
          ref={headingRef}
          tabIndex={-1}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 24,
            lineHeight: 1.2,
            color: 'var(--fs-ink)',
            margin: '4px 0 12px',
            outline: 'none',
          }}
        >
          עדכנו את התנאים שלנו
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--fs-ink)',
            margin: '0 0 8px',
          }}
        >
          כדי להמשיך להשתמש באפליקציה, יש לקרוא ולאשר את תנאי השימוש ומדיניות הפרטיות המעודכנים.
        </p>

        <ConsentCheckboxes
          acceptedTerms={acceptedTerms}
          acceptedPrivacy={acceptedPrivacy}
          onChange={(next) => {
            setAcceptedTerms(next.acceptedTerms);
            setAcceptedPrivacy(next.acceptedPrivacy);
          }}
        />

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-error-fg)',
              margin: '4px 0 0',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="active:scale-[0.98]"
          style={{
            width: '100%',
            marginTop: 20,
            padding: '14px 16px',
            borderRadius: 'var(--radius-asymmetric)',
            border: 'none',
            background: canSubmit ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            color: canSubmit ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'שומר…' : 'אני מאשר/ת וממשיך/ה'}
        </button>
      </div>
    </div>
  );
}
