import { motion } from 'framer-motion';
import type React from 'react';

// ============================================================================
// Types
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger' | 'pill';
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
    bg-[var(--navy)] text-[var(--mustard)]
    hover:bg-[var(--navy-deep)]
    active:bg-[var(--navy-deep)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Secondary — bone fill, navy 2px border, navy label
  secondary: `
    bg-[var(--bone)] text-[var(--navy)]
    border-2 border-[var(--navy)]
    hover:bg-[var(--bone-deep)]
    active:bg-[var(--bone-deep)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Ghost — transparent with navy text
  ghost: `
    bg-transparent text-[var(--navy)]
    hover:bg-[var(--bone-deep)]
    active:bg-[var(--bone-deep)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Glass — bone translucent
  glass: `
    bg-[var(--bone)]/80 backdrop-blur-md text-[var(--navy)]
    border border-[var(--bone-deep)]
    hover:bg-[var(--bone-deep)]
    active:bg-[var(--bone-deep)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Danger — error-color fill, bone label
  danger: `
    bg-[var(--color-error)] text-[var(--bone)]
    hover:brightness-90
    active:brightness-90
    disabled:opacity-50 disabled:cursor-not-allowed
  `,

  // Pill — compact tag-style, kept sharp-cornered to match editorial aesthetic
  pill: `
    bg-[var(--bone)] text-[var(--navy)]
    border-2 border-[var(--navy)]
    hover:bg-[var(--mustard)] hover:text-[var(--color-on-mustard)]
    active:bg-[var(--mustard)]
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
        focus-visible:ring-2 focus-visible:ring-[var(--mustard)]
        focus-visible:ring-offset-0
        disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{ fontFamily: 'var(--font-display)', borderRadius: 0 }}
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
              bg-[var(--mustard)] text-[var(--color-on-mustard)]
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
