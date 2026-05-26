import { motion } from 'framer-motion';
import type React from 'react';

// ============================================================================
// Types
// ============================================================================

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'glass'
  | 'danger'
  | 'pill'
  | 'card-action'
  | 'start';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  arrowIcon?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
}

// ============================================================================
// Sport Annual Variant Styles — sharp corners, editorial palette
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  // Primary — navy fill, mustard label
  primary: `
    bg-[var(--fs-primary)] text-[var(--fs-accent)]
    hover:bg-[var(--color-primary-hover)]
    active:bg-[var(--color-primary-hover)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Secondary — surface fill, border, adaptive text
  secondary: `
    bg-[var(--fs-surface)] text-[var(--fs-heading)]
    border-2 border-[var(--color-border-strong)]
    hover:bg-[var(--fs-surface-2)]
    active:bg-[var(--fs-surface-2)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Ghost — transparent with adaptive text
  ghost: `
    bg-transparent text-[var(--fs-heading)]
    hover:bg-[var(--fs-surface-2)]
    active:bg-[var(--fs-surface-2)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Glass — surface translucent, adaptive text
  glass: `
    bg-[var(--fs-surface)]/80 backdrop-blur-md text-[var(--fs-heading)]
    border border-[var(--fs-surface-2)]
    hover:bg-[var(--fs-surface-2)]
    active:bg-[var(--fs-surface-2)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Danger — warn fill, dark text on bright bg
  danger: `
    bg-[var(--fs-warn)] text-black
    hover:brightness-90
    active:brightness-90
    disabled:opacity-50 disabled:cursor-not-allowed
  `,

  // Pill — compact tag-style, adaptive text
  pill: `
    bg-[var(--fs-surface)] text-[var(--fs-heading)]
    border-2 border-[var(--color-border-strong)]
    hover:bg-[var(--fs-accent)] hover:text-[var(--color-ink-on-accent)]
    active:bg-[var(--fs-accent)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Card-action — white pill on hero card (preview's hero-card CTA)
  'card-action': `
    hover:brightness-95
    active:brightness-90
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Start — accent gradient start workout button
  start: `
    hover:brightness-105
    active:brightness-95
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
};

// ============================================================================
// Size Styles — sharp corners, 44px+ touch target
// ============================================================================

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 min-h-[44px] text-[12px] gap-1.5',
  md: 'px-6 py-3 min-h-[48px] text-[14px] gap-2',
  lg: 'px-8 py-4 min-h-[52px] text-[16px] gap-2.5',
  icon: 'p-2.5 min-w-[44px] min-h-[44px] justify-center',
};

// ============================================================================
// Component
// ============================================================================

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  arrowIcon = false,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <motion.button
      disabled={disabled || isLoading}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        relative inline-flex items-center justify-center cursor-pointer
        font-[var(--font-display)] font-extrabold uppercase tracking-[0.08em]
        transition-colors duration-150
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]
        focus-visible:ring-offset-0
        disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={
        variant === 'card-action'
          ? {
              fontFamily: 'var(--font-body)',
              fontWeight: 900,
              borderRadius: 16,
              minHeight: 50,
              background: 'var(--fs-surface)',
              color: 'var(--fs-heading)',
            }
          : variant === 'start'
            ? {
                fontFamily: 'var(--font-body)',
                fontWeight: 900,
                borderRadius: 16,
                minHeight: 58,
                background:
                  'linear-gradient(135deg, var(--fs-accent), color-mix(in srgb, var(--fs-accent-2) 42%, var(--fs-accent)))',
                color: 'var(--color-ink-on-accent)',
              }
            : size === 'icon'
              ? {
                  fontFamily: 'var(--font-display)',
                  borderRadius: 15,
                  width: 44,
                  height: 44,
                  background: 'var(--fs-surface)',
                  color: 'var(--fs-ink)',
                  border: '1px solid var(--fs-surface-2)',
                }
              : { fontFamily: 'var(--font-display)', borderRadius: 0 }
      }
      // biome-ignore lint/suspicious/noExplicitAny: framer-motion button prop type conflicts with native button events
      {...(props as any)}
    >
      {isLoading ? (
        // Navy/mustard spinner — sharp edges via border-current
        <span className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className={children ? 'me-1.5' : ''}>{icon}</span>}

          {!isLoading && children}

          {/* Button-in-Button Arrow Pattern */}
          {arrowIcon && (
            <span
              className="
              ms-1.5 w-7 h-7
              bg-[var(--fs-accent)] text-[var(--fs-primary)]
              flex items-center justify-center
              transition-transform duration-150
              group-hover:translate-x-0.5
            "
              style={{ borderRadius: 0 }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="rotate-180"
                aria-hidden="true"
              >
                <path
                  d="M2 6H10M10 6L6 2M10 6L6 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
        </>
      )}
    </motion.button>
  );
};

export default Button;
