// ============================================================================
// LEGAL DOC PAGE — shared renderer for terms / privacy / coach_terms
//
// Public, content-only page (reachable WITHOUT auth) so it satisfies the
// App Store / Play requirement that Terms + Privacy links are accessible from
// outside the login wall and from the store listing. Mirrors the page chrome
// of AccessibilityStatement.tsx.
//
// Design system: Fresh Steel / Obsidian (var(--fs-*) tokens only).
// ============================================================================

import { ArrowRight } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LegalDoc } from '../../content/legal/legalDocs';

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
  fontWeight: 800,
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
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
};

const BODY_TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.7,
  color: 'var(--fs-ink)',
  margin: '0 0 8px',
};

interface LegalDocPageProps {
  doc: LegalDoc;
}

/**
 * Renders a single legal document. Self-contained: no DB/network dependency,
 * so it works for unauthenticated visitors and offline.
 */
export default function LegalDocPage({ doc }: LegalDocPageProps) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    // Deep links from a store listing have no in-app history — fall back home.
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate]);

  return (
    <div
      className="min-h-screen min-h-[100dvh] pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] ambient-mesh ambient-mesh-soft"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
      lang="he"
    >
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingInlineStart: 'max(20px, env(safe-area-inset-right, 20px))',
          paddingInlineEnd: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingBottom: 16,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="active:scale-[0.98]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            padding: '6px 0',
            marginBottom: 4,
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          aria-label="חזרה"
        >
          <ArrowRight size={18} aria-hidden="true" />
          חזרה
        </button>
        <p style={PAGE_SUBTITLE_STYLE}>{doc.subtitle}</p>
        <h1 style={PAGE_TITLE_STYLE}>{doc.title}</h1>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <article className="px-5 pt-6" aria-label={doc.title}>
        {/* Draft banner — visible until a lawyer-approved version replaces this. */}
        {doc.isDraft && (
          <div
            role="note"
            className="mb-5"
            style={{
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-warn)',
              borderRadius: 'var(--radius-asymmetric)',
              padding: '12px 16px',
            }}
          >
            <p style={{ ...BODY_TEXT_STYLE, margin: 0, fontSize: 13, color: 'var(--fs-muted)' }}>
              טיוטה — המסמך טרם עבר אישור משפטי סופי ואינו מהווה ייעוץ משפטי.
            </p>
          </div>
        )}

        {/* Version + effective date — numbers/dates render LTR inside RTL. */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            margin: '0 0 20px',
          }}
        >
          גרסה{' '}
          <span dir="ltr" className="kinetic-number">
            {doc.version}
          </span>{' '}
          · בתוקף מ-
          <span dir="ltr" className="kinetic-number">
            {doc.effectiveDate}
          </span>
        </p>

        {doc.sections.map((section, i) => (
          <section
            // Sections are static content; index keys are stable and acceptable.
            key={`${doc.docType}-${i}`}
            className="mb-6"
            style={{
              background: 'var(--fs-surface)',
              borderRadius: 'var(--radius-asymmetric)',
              padding: '20px',
            }}
          >
            <h2 style={SECTION_HEADING_STYLE}>{section.heading}</h2>
            {section.body?.map((para) => (
              <p key={para} style={BODY_TEXT_STYLE}>
                {para}
              </p>
            ))}
            {section.bullets && (
              <ul
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  lineHeight: 1.8,
                  color: 'var(--fs-ink)',
                  paddingInlineStart: '1.4em',
                  margin: section.body?.length ? '8px 0 0' : 0,
                }}
              >
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
