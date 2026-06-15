// ============================================================================
// AGE GATE — neutral DOB collection + under-age block.
//
// Collects a date of birth (not a self-disclosing "are you over X?" toggle) and
// lets the server compute/verify age. If the user is under the minimum age, a
// sensitive (non-accusatory) block screen explains guardian consent is required.
// Allowlists /legal/* and /accessibility so blocked users can still read policy.
//
// Design system: Fresh Steel / Obsidian (var(--fs-*) tokens only).
// ============================================================================

import { m } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAgeGate } from '../../contexts/AgeGateContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { computeAge } from '../../services/ageGate';
import { Button } from '../ui/Button';

const PUBLIC_ALLOWLIST = /^\/(legal\/|accessibility)/;

const PANEL_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  padding: 24,
};

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fs-muted)',
  margin: 0,
};

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 24,
  lineHeight: 1.2,
  color: 'var(--fs-ink)',
  margin: '4px 0 12px',
  outline: 'none',
};

const BODY_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.6,
  color: 'var(--fs-ink)',
  margin: '0 0 8px',
};

export function AgeGate({ children }: { children: ReactNode }) {
  const { loading, needsBirthDate, blockedUnderAge, submit } = useAgeGate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const active =
    !loading && (needsBirthDate || blockedUnderAge) && !PUBLIC_ALLOWLIST.test(location.pathname);

  useEffect(() => {
    if (active) headingRef.current?.focus();
  }, [active]);

  if (!active) return <>{children}</>;

  // ── Under-age block ───────────────────────────────────────────────────────
  if (blockedUnderAge) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-block-title"
        dir="rtl"
        lang="he"
        className="min-h-screen min-h-[100dvh] flex items-center justify-center px-5"
        style={{ background: 'var(--fs-bg)' }}
      >
        <div style={PANEL_STYLE}>
          <p style={EYEBROW_STYLE}>SparkOS Fitness</p>
          <h1 id="age-block-title" ref={headingRef} tabIndex={-1} style={TITLE_STYLE}>
            נדרש אישור הורה
          </h1>
          <p style={BODY_STYLE}>
            האפליקציה מיועדת למשתמשים שמלאו להם הגיל המינימלי הנדרש. כדי להמשיך, נדרשים אישור והסכמה
            של הורה או אפוטרופוס.
          </p>
          <p style={{ ...BODY_STYLE, fontSize: 14, color: 'var(--fs-muted)' }}>
            לפרטים ולסיוע ניתן לפנות אלינו:{' '}
            <a
              href="mailto:pgishonim@gmail.com"
              dir="ltr"
              style={{ color: 'var(--fs-accent)', textDecoration: 'underline' }}
            >
              pgishonim@gmail.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // ── DOB collection ────────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().slice(0, 10);
  const previewAge = dob ? computeAge(dob) : null;
  const canSubmit = dob !== '' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit(dob);
    } catch {
      setError('שמירת התאריך נכשלה. בדקו את החיבור ונסו שוב.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      dir="rtl"
      lang="he"
      className="min-h-screen min-h-[100dvh] flex items-center justify-center px-5"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div style={PANEL_STYLE}>
        <p style={EYEBROW_STYLE}>SparkOS Fitness</p>
        <h1 id="age-gate-title" ref={headingRef} tabIndex={-1} style={TITLE_STYLE}>
          מה תאריך הלידה שלך?
        </h1>
        <p style={BODY_STYLE}>
          אנו זקוקים לתאריך הלידה כדי לוודא שאתה עומד בדרישות הגיל לשימוש באפליקציה.
        </p>

        <label
          htmlFor="age-gate-dob"
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-ink)',
            margin: '12px 0 6px',
          }}
        >
          תאריך לידה
        </label>
        <input
          id="age-gate-dob"
          type="date"
          dir="ltr"
          value={dob}
          max={todayISO}
          placeholder="DD/MM/YYYY"
          aria-describedby="age-gate-dob-hint"
          onChange={(e) => setDob(e.target.value)}
          className="focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fs-accent)]"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 'var(--radius-asymmetric)',
            border: '1px solid var(--fs-muted)',
            background: 'var(--fs-bg)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            textAlign: 'left',
          }}
        />
        <p
          id="age-gate-dob-hint"
          style={{ ...BODY_STYLE, fontSize: 12, color: 'var(--fs-muted)', margin: '6px 0 0' }}
        >
          בפורמט{' '}
          <span dir="ltr" className="kinetic-number">
            יום/חודש/שנה
          </span>
        </p>

        {previewAge !== null && previewAge >= 0 && (
          <m.p
            key={previewAge}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: [0.9, 1.08, 1], transition: { duration: 0.4 } }
            }
            style={{ ...BODY_STYLE, fontSize: 13, color: 'var(--fs-muted)', marginTop: 8 }}
          >
            גיל:{' '}
            <span
              dir="ltr"
              className="kinetic-number"
              style={{ color: 'var(--fs-ink)', fontWeight: 600 }}
            >
              {previewAge}
            </span>
          </m.p>
        )}

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-error-fg)',
              margin: '8px 0 0',
            }}
          >
            {error}
          </p>
        )}

        <Button
          variant="editorial"
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          loadingLabel="שומר…"
          fullWidth
          className="focus-visible:outline-[var(--fs-accent)]"
          style={{
            marginTop: 20,
            // Keep the established mint-fill CTA look; editorial's navy fill is
            // overridden here so the age gate matches the rest of the flow.
            background: canSubmit || submitting ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            color: canSubmit || submitting ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
          }}
        >
          המשך
        </Button>
      </div>
    </div>
  );
}
