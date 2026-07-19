import type React from 'react';
import { forwardRef } from 'react';

// ============================================================================
// Card — the ONE canonical surface primitive for SparkOS.
//
// Consolidates the former fragmented set (UltraCard, Premium3DCard, SettingsCard
// and the raw `.card*` CSS classes) into a single token-driven component. The
// three legacy cards now re-export thin wrappers around this one, so existing
// imports keep working; new code should import `Card` directly.
//
// Built entirely on existing design tokens:
//   elevated → --shadow-card (elevation-1)   floating → --shadow-elevated (2)
//   sunken   → --shadow-inner on --fs-bg      glass    → .glass-surface class
// ============================================================================

/** Elevation/surface treatment. */
export type CardVariant = 'elevated' | 'sunken' | 'floating' | 'glass';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Surface treatment. Defaults to `elevated`. */
  variant?: CardVariant;
  /** Adds hover-lift, press-scale, pointer cursor, and the magnetic-card feel. */
  interactive?: boolean;
  /** Use the brand continuous card radius (token name kept for call-site compatibility). */
  asymmetric?: boolean;
  /** Remove the default internal padding (24px). */
  noPadding?: boolean;
  className?: string;
}

const variantStyle: Record<CardVariant, React.CSSProperties> = {
  elevated: {
    background: 'var(--fs-surface)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  },
  sunken: {
    background: 'var(--fs-bg)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-inner)',
  },
  floating: {
    background: 'var(--fs-surface)',
    border: '1px solid transparent',
    boxShadow: 'var(--shadow-elevated)',
  },
  // `glass` pulls its background/border/shadow from the .glass-surface class.
  glass: {},
};

/**
 * Canonical card surface.
 *
 * @example
 * <Card variant="elevated">…</Card>
 * <Card variant="floating" interactive asymmetric onClick={open}>…</Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'elevated',
      interactive = false,
      asymmetric = false,
      noPadding = false,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const radius = asymmetric ? 'var(--radius-asymmetric)' : 'var(--radius-2xl)';

    return (
      <div
        ref={ref}
        className={[
          'relative overflow-hidden',
          variant === 'glass' ? 'glass-surface' : '',
          interactive ? 'magnetic-card cursor-pointer active:scale-[0.985]' : '',
          'transition-all duration-200 ease-out',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          borderRadius: radius,
          ...variantStyle[variant],
          padding: noPadding ? undefined : 'var(--space-6)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
