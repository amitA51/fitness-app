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
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PremiumFeature } from '../../services/billing/types';
import { hasJoinedWaitlist, joinWaitlist } from '../../services/billing/waitlistService';

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

// Order leads with genuinely-shipping differentiators (advanced progress, cloud
// sync, unlimited templates, data export, progress photos). The AI coach is not
// yet wired (the chat endpoint returns 503), so its row is honestly future-tense
// ("בקרוב") and sits last instead of headlining a feature that does not exist.
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
    key: 'unlimited_templates',
    label: 'תבניות אימון',
    description: 'שמירת תוכניות אימון מותאמות אישית',
    freeValue: 'עד 3',
    proValue: 'ללא הגבלה',
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
  {
    key: 'ai_coach',
    label: 'מאמן AI',
    description: 'תוכנית אימון מותאמת אישית מבוססת AI',
    freeValue: null,
    proValue: 'בקרוב',
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
      <div
        className="w-5 h-5 flex items-center justify-center"
        style={{ color: 'var(--color-separator)' }}
        aria-label="לא זמין"
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>—</span>
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
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--fs-accent)',
          }}
        >
          <Check
            size={20}
            style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
              color: 'var(--fs-accent)',
            }}
          >
            נרשמת! נעדכן אותך כשהפרימיום יוצא
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

  // On mount: check if already joined
  useEffect(() => {
    let cancelled = false;
    hasJoinedWaitlist().then((joined) => {
      if (cancelled) return;
      setWaitlistState(joined ? 'joined' : 'idle');
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          className="flex items-center justify-center w-10 h-10 active:scale-[0.98]"
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
          הרם את האימון שלך לרמה הבאה
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
                  letterSpacing: '0.1em',
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

      {/* ── Pricing note ── */}
      <section className="px-5 pb-4 flex flex-col items-center gap-2">
        <div
          className="flex items-center gap-2 px-4 py-3 w-full"
          style={{
            borderRadius: 'var(--radius-asymmetric)',
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--color-separator)',
          }}
        >
          <Zap size={16} style={{ color: 'var(--fs-accent)', flexShrink: 0 }} aria-hidden="true" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--fs-muted)',
              lineHeight: 1.5,
            }}
          >
            מנוי פרימיום יושק בקרוב. הירשמ/י לרשימת ההמתנה וקבל/י גישה מוקדמת.
          </span>
        </div>
      </section>

      {/* ── CTA ── */}
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
    </div>
  );
}
