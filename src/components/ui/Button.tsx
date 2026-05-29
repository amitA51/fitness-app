import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
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
  | 'start'
  // Editorial — Login "Annual" buttons (asymmetric radius, display font)
  | 'editorial'
  | 'editorial-secondary'
  | 'editorial-ghost'
  // FS — Dashboard quick-start buttons (rounded, sans font)
  | 'fs-primary'
  | 'fs-secondary'
  | 'fs-ghost'
  | 'fs-danger'
  | 'fs-glass';
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

  // Editorial variants are rendered through renderEditorial (see below); the
  // entries here only exist to keep the Record exhaustive and are never read.
  editorial: '',
  'editorial-secondary': '',
  'editorial-ghost': '',

  // FS variants are rendered through renderFs (see below); same note as above.
  'fs-primary': '',
  'fs-secondary': '',
  'fs-ghost': '',
  'fs-danger': '',
  'fs-glass': '',
};

// ============================================================================
// Editorial Variants — Login "Annual" buttons
// Exact port of the former AnnualButton: asymmetric radius, display font,
// uppercase, weight 800, tracking 0.04em, h-52px, gap-3, active:scale-0.98.
// The primary sub-variant additionally carries the .start-workout-btn (decor
// dashes) and .accent-glow (glow shadow) classes; inline styles override the
// class's background/color/radius so the rendered result matches AnnualButton.
// ============================================================================

type EditorialVariant = 'editorial' | 'editorial-secondary' | 'editorial-ghost';

const EDITORIAL_BASE =
  'h-[52px] px-6 text-base font-bold tracking-[0.04em] transition-all duration-150 ' +
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'inline-flex items-center justify-center gap-3 cursor-pointer';

const EDITORIAL_SHARED_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  textTransform: 'uppercase',
};

const editorialStyles: Record<EditorialVariant, React.CSSProperties> = {
  editorial: {
    ...EDITORIAL_SHARED_STYLE,
    background: 'var(--fs-primary)',
    color: 'var(--fs-accent)',
    borderRadius: '22px 16px 22px 16px',
  },
  'editorial-secondary': {
    ...EDITORIAL_SHARED_STYLE,
    background: 'var(--fs-surface)',
    color: 'var(--fs-heading)',
    border: '2px solid var(--fs-primary)',
    borderRadius: '22px 16px 22px 16px',
  },
  'editorial-ghost': {
    ...EDITORIAL_SHARED_STYLE,
    background: 'transparent',
    color: 'var(--fs-heading)',
  },
};

// ============================================================================
// FS Variants — Dashboard quick-start buttons
// Exact port of the former FSButton: rounded 12px (primary overrides to the
// asymmetric radius), sans font, weight 600, 15px, letter-spacing 0.01em,
// padding 12px 24px, min-height 44px, filter/transform/box-shadow transition.
// ============================================================================

type FsVariant = 'fs-primary' | 'fs-secondary' | 'fs-ghost' | 'fs-danger' | 'fs-glass';

const FS_BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 12,
  padding: '12px 24px',
  minHeight: 44,
  fontFamily: 'var(--font-sans)',
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.01em',
  border: 'none',
  transition: 'filter 150ms ease, transform 150ms ease, box-shadow 150ms ease',
  userSelect: 'none',
};

const fsStyles: Record<FsVariant, React.CSSProperties> = {
  'fs-primary': {
    background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
    color: '#071412',
    borderRadius: '22px 16px 22px 16px',
    boxShadow: 'var(--shadow-button)',
  },
  'fs-secondary': {
    background: 'transparent',
    color: 'var(--fs-ink)',
    border: '1px solid var(--fs-primary)',
  },
  'fs-ghost': {
    background: 'transparent',
    color: 'var(--fs-ink)',
  },
  'fs-danger': {
    background: 'var(--color-error)',
    color: 'var(--color-ink-on-dark)',
  },
  'fs-glass': {
    background: 'var(--fs-overlay-hover)',
    color: 'var(--fs-ink)',
    border: '1px solid var(--color-border)',
    backdropFilter: 'blur(20px)',
  },
};

const isEditorialVariant = (v: ButtonVariant): v is EditorialVariant =>
  v === 'editorial' || v === 'editorial-secondary' || v === 'editorial-ghost';

const isFsVariant = (v: ButtonVariant): v is FsVariant =>
  v === 'fs-primary' ||
  v === 'fs-secondary' ||
  v === 'fs-ghost' ||
  v === 'fs-danger' ||
  v === 'fs-glass';

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
  style,
  ...props
}) => {
  // --- Editorial family (former AnnualButton) ---------------------------------
  if (isEditorialVariant(variant)) {
    const decorClass = variant === 'editorial' ? 'start-workout-btn accent-glow' : '';
    return (
      <button
        disabled={disabled || isLoading}
        className={`${EDITORIAL_BASE} ${decorClass} ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{ ...editorialStyles[variant], ...style }}
        {...props}
      >
        {isLoading ? (
          <Loader2
            size={18}
            className="animate-spin"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        ) : null}
        {children}
      </button>
    );
  }

  // --- FS family (former FSButton) -------------------------------------------
  if (isFsVariant(variant)) {
    return (
      <button
        disabled={disabled || isLoading}
        className={className}
        style={{
          ...FS_BASE_STYLE,
          cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
          ...fsStyles[variant],
          ...style,
        }}
        {...props}
      >
        {isLoading ? (
          <Loader2
            size={18}
            className="animate-spin"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        ) : null}
        {children}
      </button>
    );
  }

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
      style={{
        ...(variant === 'card-action'
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
              : { fontFamily: 'var(--font-display)', borderRadius: 0 }),
        ...style,
      }}
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
