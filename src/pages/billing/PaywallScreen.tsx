// ============================================================================
// PaywallScreen — /paywall (authed)
//
// Plan-comparison screen with a live waitlist CTA.
// On mount: checks hasJoinedWaitlist() and shows confirmed state if already in.
// CTA: calls joinWaitlist('paywall') and switches to a confirmed state.
//
// Design: Fresh Steel / Obsidian. All colors via var(--fs-*) tokens.
// Numbers render dir="ltr". Both light and dark tested.
// ============================================================================

import { ArrowRight, Check, Crown, Lock, Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlement } from '../../contexts/EntitlementContext';
import { trackFunnel } from '../../services/analytics/funnel';
import type { PremiumFeature } from '../../services/billing/types';
import { hasJoinedWaitlist, joinWaitlist } from '../../services/billing/waitlistService';
import { PurchasePanel } from './components/PurchasePanel';

// --------------------------------------------------------------------------
// Feature catalogue
// --------------------------------------------------------------------------

interface FeatureRow {
  key: PremiumFeature;
  label: string;
  description: string;
  freeValue: string | null;
  proValue: string;
}

// Every row here must be a free/pro difference the product can actually deliver
// today. Two rows were removed for being false, not for being unpolished:
//
//   • ai_coach ("מאמן AI · בקרוב") — the coach surface it advertised was deleted
//     from the app. Of the eight coach surfaces that once existed exactly one was
//     ever a real model call; the hardcoded ones were removed deliberately. So
//     "בקרוב" promised a feature with nothing behind it, not a delayed one.
//
//   • unlimited_templates ("עד 3" on free) — the free cap of 3 templates stopped
//     being enforced on 2026-08-24, when the DB trigger enforcing it was dropped.
//     Free is unlimited today, so the row had no difference left to show: keeping
//     it meant advertising a limit we do not impose, and rewording it to
//     "ללא הגבלה / ללא הגבלה" would be a comparison row that compares nothing.
//
// Do not backfill this list to keep it looking long. A short true table beats a
// padded one, and a row that overstates the product costs more than a short list.
const FEATURE_ROWS: FeatureRow[] = [
  {
    key: 'advanced_progress',
    label: 'מעקב התקדמות מתקדם',
    description: 'גרפים, מגמות וניתוח ביצועים לאורך זמן',
    freeValue: 'בסיסי',
    proValue: 'מלא',
  },
  {
    key: 'cloud_sync',
    label: 'סנכרון ענן',
    description: 'גיבוי אוטומטי ורב-מכשיר',
    freeValue: null,
    proValue: 'כל המכשירים',
  },
  {
    key: 'data_export',
    label: 'ייצוא נתונים',
    description: 'ייצוא האימונים שלך ל-CSV ו-JSON',
    freeValue: null,
    proValue: 'CSV ו-JSON',
  },
  {
    key: 'progress_photos',
    label: 'תמונות התקדמות',
    description: 'תיעוד חזותי של השינוי הגופני',
    freeValue: null,
    proValue: 'ללא הגבלה',
  },
];

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function PlanBadge({ variant }: { variant: 'free' | 'pro' }) {
  const isPro = variant === 'pro';
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 mb-3"
      style={{
        borderRadius: 'var(--radius-asymmetric)',
        background: isPro ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
        color: isPro ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}
    >
      {isPro ? <Crown size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
      {isPro ? 'פרו' : 'חינם'}
    </div>
  );
}

interface FeatureCheckProps {
  value: string | null;
  isPro: boolean;
}

function FeatureCheck({ value, isPro }: FeatureCheckProps) {
  if (value === null) {
    return (
      // An aria-label on a generic div is not a reliable accessible name inside
      // a data cell. A visually-hidden text node is, and the dash stays purely
      // decorative.
      <div
        className="w-5 h-5 flex items-center justify-center"
        style={{ color: 'var(--color-separator)' }}
      >
        <span className="sr-only">לא זמין</span>
        <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
          —
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Check
        size={15}
        strokeWidth={2.5}
        style={{ color: isPro ? 'var(--fs-accent)' : 'var(--fs-muted)', flexShrink: 0 }}
        aria-hidden="true"
      />
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: isPro ? 'var(--fs-ink)' : 'var(--fs-muted)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Waitlist CTA states
// --------------------------------------------------------------------------

type WaitlistState = 'idle' | 'checking' | 'submitting' | 'joined' | 'error';

interface WaitlistCtaProps {
  state: WaitlistState;
  errorMessage: string | null;
  onJoin: () => void;
}

function WaitlistCta({ state, errorMessage, onJoin }: WaitlistCtaProps) {
  const isJoined = state === 'joined';
  const isLoading = state === 'checking' || state === 'submitting';

  if (isJoined) {
    return (
      <div
        className="w-full flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
        aria-label="נרשמת לרשימת ההמתנה"
      >
        <div
          className="w-full flex items-center justify-center gap-2"
          style={{
            height: 52,
            borderRadius: 'var(--radius-asymmetric)',
            // Accent-on-surface text measured 1.65:1 (WCAG AA needs 4.5:1).
            // Inverting to an accent FILL with on-accent ink clears AA in both
            // themes and reads as a completed state rather than a hint.
            background: 'var(--fs-accent)',
            border: '1px solid var(--fs-accent)',
          }}
        >
          <Check
            size={20}
            style={{ color: 'var(--color-ink-on-accent)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
              color: 'var(--color-ink-on-accent)',
            }}
          >
            נרשמתם. נעדכן אותכם ברגע שהפרימיום ייצא לדרך
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onJoin}
        disabled={isLoading}
        aria-disabled={isLoading}
        aria-label="הצטרפות לרשימת ההמתנה לפרימיום"
        className="w-full flex items-center justify-center gap-2 active:scale-[0.98]"
        style={{
          height: 52,
          borderRadius: 'var(--radius-asymmetric)',
          background: isLoading ? 'var(--fs-surface-2)' : 'var(--fs-accent)',
          color: isLoading ? 'var(--fs-muted)' : 'var(--color-ink-on-accent)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '16px',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          transition: 'background-color 150ms ease, opacity 150ms ease',
        }}
      >
        <Crown size={18} aria-hidden="true" />
        {state === 'submitting' ? 'רושם...' : 'הצטרפו לרשימת ההמתנה'}
      </button>

      {state === 'error' && errorMessage && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-error)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Main screen
// --------------------------------------------------------------------------

export default function PaywallScreen() {
  const navigate = useNavigate();
  const [waitlistState, setWaitlistState] = useState<WaitlistState>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Null until PurchasePanel reports back, so we never flash the wrong CTA.
  const [canPurchase, setCanPurchase] = useState<boolean | null>(null);
  const { refresh: refreshEntitlement } = useEntitlement();
  const handleAvailability = useCallback((available: boolean) => {
    setCanPurchase(available);
  }, []);

  // On mount: record the funnel step and check if already joined.
  useEffect(() => {
    let cancelled = false;
    // Top of the conversion funnel: without this the operator cannot compute a
    // paywall → checkout → subscribe rate at all.
    trackFunnel('paywall_viewed');
    hasJoinedWaitlist().then((joined) => {
      if (cancelled) return;
      setWaitlistState(joined ? 'joined' : 'idle');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The provider redirects back to /paywall?checkout=success. The webhook is the
  // source of truth for the entitlement, but it may land a moment later, so we
  // re-read it here to avoid showing a just-paying customer a locked app.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const outcome = new URLSearchParams(window.location.search).get('checkout');
    if (outcome !== 'success') return;

    trackFunnel('checkout_completed');
    void refreshEntitlement();
    // Drop the query param so a refresh does not re-record the conversion.
    window.history.replaceState({}, '', '/paywall');
  }, [refreshEntitlement]);

  const handleJoin = async () => {
    setWaitlistState('submitting');
    setErrorMessage(null);
    const { error } = await joinWaitlist('paywall');
    if (error) {
      setErrorMessage(error);
      setWaitlistState('error');
    } else {
      setWaitlistState('joined');
    }
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col"
      dir="rtl"
      style={{ background: 'var(--fs-bg)', color: 'var(--fs-ink)' }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-5 pt-safe-top"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + var(--space-4))',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--color-separator)',
          background: 'var(--fs-surface)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-11 h-11 active:scale-[0.98]"
          style={{ borderRadius: 'var(--radius-asymmetric)', background: 'var(--fs-surface-2)' }}
          aria-label="חזרה"
        >
          {/* RTL: ArrowRight points right = forward in Hebrew reading direction = back in nav. */}
          <ArrowRight size={20} style={{ color: 'var(--fs-ink)' }} aria-hidden="true" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--fs-ink)',
            margin: 0,
          }}
        >
          שדרוג לפרו
        </h1>
      </header>

      {/* ── Hero ── */}
      <section className="px-5 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="flex items-center justify-center w-16 h-16 mb-1"
          style={{
            borderRadius: 'var(--radius-asymmetric)',
            background: 'var(--fs-accent)',
          }}
          aria-hidden="true"
        >
          <Sparkles size={32} style={{ color: 'var(--color-ink-on-accent)' }} strokeWidth={2} />
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 26,
            color: 'var(--fs-ink)',
            margin: 0,
          }}
        >
          התקדמו באימון לרמה הבאה
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            color: 'var(--fs-muted)',
            maxWidth: 320,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          כל הכלים שצריך כדי להתאמן חכם יותר, לעקוב אחרי ההתקדמות ולהגיע ליעדים מהר יותר.
        </p>
      </section>

      {/* ── Plan comparison table ── */}
      <section className="px-4 pb-6">
        <table
          dir="rtl"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderRadius: 'var(--radius-asymmetric)',
            border: '1px solid var(--color-separator)',
            background: 'var(--fs-surface)',
            overflow: 'hidden',
          }}
        >
          <caption className="sr-only">השוואת תכונות בין המסלול החינמי למסלול פרו</caption>
          {/* Column headers */}
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-separator)' }}>
              <th
                scope="col"
                style={{
                  padding: 'var(--space-4)',
                  paddingBottom: 'var(--space-3)',
                  textAlign: 'start',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                }}
              >
                תכונה
              </th>
              <th
                scope="col"
                style={{
                  padding: 'var(--space-4) 0 var(--space-3)',
                  width: '1%',
                  minWidth: 72,
                }}
              >
                <div className="flex flex-col items-center">
                  <PlanBadge variant="free" />
                </div>
              </th>
              <th
                scope="col"
                style={{
                  padding: 'var(--space-4) 0 var(--space-3)',
                  width: '1%',
                  minWidth: 72,
                }}
              >
                <div className="flex flex-col items-center">
                  <PlanBadge variant="pro" />
                </div>
              </th>
            </tr>
          </thead>

          {/* Feature rows */}
          <tbody>
            {FEATURE_ROWS.map((row, idx) => (
              <tr
                key={row.key}
                style={{
                  borderBottom:
                    idx < FEATURE_ROWS.length - 1 ? '1px solid var(--color-separator)' : 'none',
                }}
              >
                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div className="flex flex-col gap-0.5">
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--fs-ink)',
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '12px',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      {row.description}
                    </span>
                  </div>
                </td>
                <td style={{ padding: 'var(--space-3) 0', width: '1%', minWidth: 72 }}>
                  <div className="flex items-center justify-center">
                    <FeatureCheck value={row.freeValue} isPro={false} />
                  </div>
                </td>
                <td style={{ padding: 'var(--space-3) 0', width: '1%', minWidth: 72 }}>
                  <div className="flex items-center justify-center">
                    <FeatureCheck value={row.proValue} isPro={true} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Purchase path ── */}
      {/* Renders only when billing is live (release flag + an active server
          price). Until then it returns null and the waitlist below is the CTA,
          which keeps the screen honest instead of showing a dead buy button. */}
      <PurchasePanel onAvailabilityChange={handleAvailability} />

      {/* ── Pricing note ── */}
      {canPurchase === false && (
        <section className="px-5 pb-4 flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-2 px-4 py-3 w-full"
            style={{
              borderRadius: 'var(--radius-asymmetric)',
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--color-separator)',
            }}
          >
            <Zap
              size={16}
              style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
                lineHeight: 1.5,
              }}
            >
              מנוי הפרימיום יושק בקרוב. הצטרפו לרשימת ההמתנה וקבלו גישה מוקדמת.
            </span>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {canPurchase === false && (
        <section
          className="px-5 pb-safe-bottom flex flex-col items-center gap-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--space-6))' }}
        >
          <WaitlistCta state={waitlistState} errorMessage={errorMessage} onJoin={handleJoin} />
          {waitlistState !== 'joined' && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--fs-muted)',
                margin: 0,
                textAlign: 'center',
              }}
            >
              ביטול בכל עת. ללא התחייבות.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
