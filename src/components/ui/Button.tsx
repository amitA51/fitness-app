import { m } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type React from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Core variants — CANONICAL. Use these for all new code.
 * `primary` and `secondary` cover the vast majority of actions; `ghost` for
 * low-emphasis, `danger` for destructive, `glass`/`pill` for chrome. The
 * `editorial-*` and `fs-*` families below are DEPRECATED legacy aliases kept
 * only so existing call sites keep working — a later cleanup migrates them.
 * Do NOT reach for a legacy variant in new code.
 */
type CoreVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass' | 'pill';

/** @deprecated Legacy aliases — mapped internally to core + shape */
type LegacyVariant =
  | 'card-action'
  | 'start'
  | 'editorial'
  | 'editorial-secondary'
  | 'editorial-ghost'
  | 'fs-primary'
  | 'fs-secondary'
  | 'fs-ghost'
  | 'fs-danger'
  | 'fs-glass';

type ButtonVariant = CoreVariant | LegacyVariant;
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
type ButtonShape = 'sharp' | 'rounded' | 'asymmetric';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shape override: sharp (0 radius), rounded (12px), asymmetric (22/16/22/16) */
  shape?: ButtonShape;
  icon?: React.ReactNode;
  arrowIcon?: boolean;
  isLoading?: boolean;
  /**
   * Additive loading flag (default false). Behaves like `isLoading` but is the
   * preferred name for new call sites: shows a Loader2 spinner, disables the
   * button, and locks min-height so the layout can't collapse. Reduced-motion
   * renders the spinner static. Backward-compatible: when omitted the button
   * is unchanged.
   */
  loading?: boolean;
  /** Optional label shown next to the spinner while loading (e.g. "שומר…"). */
  loadingLabel?: React.ReactNode;
  fullWidth?: boolean;
}

// ============================================================================
// Fresh Steel / Obsidian variant styles — sharp corners, tokenized palette
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  // Primary — uses dedicated button tokens for dark/light visibility
  primary: `
    bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
    hover:bg-[var(--btn-primary-bg-hover)]
    active:bg-[var(--btn-primary-bg-hover)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Secondary — surface fill, hairline border, adaptive text
  secondary: `
    bg-[var(--fs-surface)] text-[var(--fs-heading)]
    border border-[var(--color-border-strong)]
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
    border border-[var(--color-border)]
    hover:bg-[var(--fs-surface-2)]
    active:bg-[var(--fs-surface-2)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Danger — error fill (destructive ≠ warn) with per-mode AA ink
  danger: `
    bg-[var(--color-error)] text-[var(--color-ink-on-error)]
    hover:brightness-90
    active:brightness-90
    disabled:opacity-50 disabled:cursor-not-allowed
  `,

  // Pill — compact tag-style, adaptive text
  pill: `
    bg-[var(--fs-surface-2)] text-[var(--fs-heading)]
    border border-transparent
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
  'h-[52px] px-6 text-[17px] font-semibold tracking-[-0.01em] transition-ui duration-150 ' +
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'inline-flex items-center justify-center gap-3 cursor-pointer';

const EDITORIAL_SHARED_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  textTransform: 'none',
};

const editorialStyles: Record<EditorialVariant, React.CSSProperties> = {
  editorial: {
    ...EDITORIAL_SHARED_STYLE,
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    borderRadius: 'var(--radius-full)',
  },
  'editorial-secondary': {
    ...EDITORIAL_SHARED_STYLE,
    background: 'var(--fs-surface)',
    color: 'var(--fs-heading)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-full)',
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
  borderRadius: 9999,
  padding: '12px 22px',
  minHeight: 48,
  fontFamily: 'var(--font-body)',
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  border: 'none',
  transition: 'filter 150ms ease, transform 150ms ease, box-shadow 150ms ease',
  userSelect: 'none',
};

const fsStyles: Record<FsVariant, React.CSSProperties> = {
  'fs-primary': {
    background: 'var(--fs-accent)',
    color: 'var(--color-ink-on-accent)',
    borderRadius: 'var(--radius-full)',
    boxShadow: '0 8px 24px color-mix(in srgb, var(--fs-accent) 28%, transparent)',
  },
  'fs-secondary': {
    background: 'transparent',
    color: 'var(--fs-ink)',
    border: '1px solid var(--color-border-strong)',
  },
  'fs-ghost': {
    background: 'transparent',
    color: 'var(--fs-ink)',
  },
  'fs-danger': {
    background: 'var(--color-error)',
    color: 'var(--color-ink-on-error)',
  },
  'fs-glass': {
    background: 'var(--fs-overlay-hover)',
    color: 'var(--fs-ink)',
    border: '1px solid var(--color-border)',
    // A control needs only a light frost. Keeping it below the nav material
    // budget avoids an expensive second backdrop sample inside sheets.
    backdropFilter: 'blur(8px)',
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
  shape,
  icon,
  arrowIcon = false,
  isLoading = false,
  loading = false,
  loadingLabel,
  fullWidth = false,
  className = '',
  disabled,
  style,
  ...props
}) => {
  // `loading` is the new, preferred prop; `isLoading` is kept for the existing
  // call sites. Either being true puts the button in its busy state.
  const busy = loading || isLoading;

  // --- Editorial family (former AnnualButton) ---------------------------------
  if (isEditorialVariant(variant)) {
    const decorClass = variant === 'editorial' ? 'start-workout-btn accent-glow' : '';
    return (
      <button
        type="button"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={`${EDITORIAL_BASE} active:scale-[0.96] motion-reduce:active:scale-100 ${decorClass} ${fullWidth ? 'w-full' : ''} ${className}`}
        // Lock the rendered height so swapping in the spinner can't collapse the
        // button; EDITORIAL_BASE is h-[52px] so we mirror that as the floor.
        style={{ minHeight: 52, ...editorialStyles[variant], ...style }}
        {...props}
      >
        {busy ? (
          <Loader2
            size={18}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {busy ? (loadingLabel ?? children) : children}
      </button>
    );
  }

  // --- FS family (former FSButton) -------------------------------------------
  if (isFsVariant(variant)) {
    return (
      <button
        type="button"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:active:scale-100${className ? ` ${className}` : ''}`}
        style={{
          ...FS_BASE_STYLE,
          cursor: disabled || busy ? 'not-allowed' : 'pointer',
          ...fsStyles[variant],
          ...style,
        }}
        {...props}
      >
        {busy ? (
          <Loader2
            size={18}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {busy ? (loadingLabel ?? children) : children}
      </button>
    );
  }

  return (
    <m.button
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      whileHover={{ scale: disabled || busy ? 1 : 1.01 }}
      whileTap={{ scale: disabled || busy ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        relative inline-flex items-center justify-center cursor-pointer
        font-[var(--font-body)] font-semibold tracking-[-0.01em]
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
              fontWeight: 600,
              borderRadius: 9999,
              minHeight: 50,
              background: 'var(--fs-surface)',
              color: 'var(--fs-heading)',
            }
          : variant === 'start'
            ? {
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                borderRadius: 9999,
                minHeight: 56,
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--fs-accent) 28%, transparent)',
              }
            : size === 'icon'
              ? {
                  fontFamily: 'var(--font-body)',
                  borderRadius: 9999,
                  width: 44,
                  height: 44,
                  background: 'var(--fs-surface-2)',
                  color: 'var(--fs-ink)',
                  border: 'none',
                }
              : { fontFamily: 'var(--font-body)', borderRadius: 9999 }),
        ...style,
      }}
      {...(props as Omit<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        keyof import('framer-motion').MotionProps
      >)}
    >
      {busy ? (
        <>
          {/* Spinner inherits currentColor; sharp edges via border-current */}
          <span
            className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {loadingLabel ? <span className="ms-1.5">{loadingLabel}</span> : null}
        </>
      ) : (
        <>
          {icon && <span className={children ? 'me-1.5' : ''}>{icon}</span>}

          {children}

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
              style={{ borderRadius: 9999 }}
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
    </m.button>
  );
};

export default Button;
