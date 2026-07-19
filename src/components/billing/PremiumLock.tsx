// ============================================================================
// PremiumLock — reusable feature-gate wrapper
//
// Renders `children` when the user is entitled to `featureKey`, otherwise
// renders a locked overlay with a Lucide Lock icon + Hebrew copy + a link to
// /paywall.
//
// Built on <PlanGate> from EntitlementContext so gating semantics stay in one
// place (free features pass through, entitlement loading never flashes a wall).
//
// FAIL-SAFE-INERT: if EntitlementContext is unavailable (provider missing),
// the ErrorBoundary catches the thrown error from useEntitlement and renders
// children (fail-open, safe default — same approach as PlanGate itself).
// ============================================================================

import { Lock } from 'lucide-react';
import { Component, type ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanGate } from '../../contexts/EntitlementContext';

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

interface PremiumLockProps {
  /** A feature key from PREMIUM_FEATURES. Non-premium keys are never gated. */
  featureKey: string;
  /** The content to render when the user is entitled. */
  children: ReactNode;
  /**
   * Optional compact mode: renders a smaller inline chip instead of the full
   * card overlay. Useful inside list rows.
   */
  compact?: boolean;
}

// --------------------------------------------------------------------------
// ErrorBoundary — catches "must be used within EntitlementProvider" throws
// --------------------------------------------------------------------------

interface BoundaryState {
  hasError: boolean;
}

interface BoundaryProps {
  children: ReactNode;
  fallbackChildren: ReactNode;
}

class EntitlementErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      // EntitlementContext unavailable: fail-open — render children so no
      // feature is accidentally blocked due to a missing provider.
      return <>{this.props.fallbackChildren}</>;
    }
    return <>{this.props.children}</>;
  }
}

// --------------------------------------------------------------------------
// Locked overlay — renders when user is NOT entitled
// --------------------------------------------------------------------------

interface LockedOverlayProps {
  compact: boolean;
}

function LockedOverlay({ compact }: LockedOverlayProps) {
  const navigate = useNavigate();
  const handleUpgrade = useCallback(() => {
    navigate('/paywall');
  }, [navigate]);

  if (compact) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-2 py-1 active:scale-[0.98]"
        style={{
          borderRadius: 'var(--radius-asymmetric)',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--color-separator)',
          cursor: 'pointer',
        }}
        onClick={handleUpgrade}
        aria-label="תכונת פרימיום — מעבר לשדרוג"
      >
        <Lock size={12} style={{ color: 'var(--fs-accent)', flexShrink: 0 }} aria-hidden="true" />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--fs-accent)',
          }}
        >
          פרו
        </span>
      </button>
    );
  }

  return (
    <div
      role="note"
      className="flex flex-col items-center gap-3 px-5 py-8"
      style={{
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--color-separator)',
        background: 'var(--fs-surface)',
        textAlign: 'center',
      }}
    >
      {/* Lock icon */}
      <div
        className="flex items-center justify-center w-12 h-12"
        style={{
          borderRadius: 'var(--radius-asymmetric)',
          background: 'var(--fs-surface-2)',
        }}
        aria-hidden="true"
      >
        <Lock size={22} style={{ color: 'var(--fs-accent)' }} strokeWidth={2} />
      </div>

      {/* Copy */}
      <div className="flex flex-col gap-1">
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--fs-ink)',
            margin: 0,
          }}
        >
          תכונה פרימיום
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          שדרג/י לפרו כדי לקבל גישה לתכונה זו ועוד הרבה יותר.
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleUpgrade}
        className="flex items-center justify-center gap-2 active:scale-[0.98] px-6"
        style={{
          height: 44,
          borderRadius: 'var(--radius-asymmetric)',
          background: 'var(--fs-accent)',
          color: 'var(--color-ink-on-accent)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '14px',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="עבור לדף השדרוג"
      >
        <Lock size={15} aria-hidden="true" />
        גלה עוד
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Public export
// --------------------------------------------------------------------------

/**
 * Wraps `children` behind a premium gate. Renders children when the user is
 * entitled; renders a lock overlay (full card or compact chip) otherwise.
 *
 * @example Full locked card:
 * <PremiumLock featureKey="ai_coach">
 *   <CoachWidget />
 * </PremiumLock>
 *
 * @example Compact inline badge:
 * <PremiumLock featureKey="data_export" compact>
 *   <ExportButton />
 * </PremiumLock>
 */
export function PremiumLock({ featureKey, children, compact = false }: PremiumLockProps) {
  const overlay = <LockedOverlay compact={compact} />;

  return (
    <EntitlementErrorBoundary fallbackChildren={children}>
      <PlanGate feature={featureKey} fallback={overlay}>
        {children}
      </PlanGate>
    </EntitlementErrorBoundary>
  );
}

export default PremiumLock;
