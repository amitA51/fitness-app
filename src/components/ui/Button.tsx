import React from 'react';
import { motion } from 'framer-motion';

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
// Premium Variant Styles (Spring Physics, No Glow, Tactile Feedback)
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  // Primary — solid fill with diffused shadow, no neon glow
  primary: `
    bg-primary text-white font-semibold
    shadow-[0_4px_16px_rgba(59,130,246,0.25)]
    hover:shadow-[0_6px_24px_rgba(59,130,246,0.35)]
    hover:brightness-110
    active:scale-[0.97] active:translate-y-0
    active:shadow-[0_2px_8px_rgba(59,130,246,0.2)]
    disabled:opacity-50 disabled:cursor-not-allowed
  `,

  // Secondary — ghost with border
  secondary: `
    bg-transparent text-white font-medium
    border border-white/12
    hover:bg-white/6 hover:border-white/20
    active:scale-[0.97] active:bg-white/4
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Ghost — text only, no border
  ghost: `
    bg-transparent text-primary font-semibold
    hover:bg-primary/10
    active:bg-primary/15 active:scale-[0.97]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Glass — frosted surface
  glass: `
    bg-white/6 backdrop-blur-xl text-white font-medium
    border border-white/8
    hover:bg-white/10 hover:border-white/13
    active:scale-[0.97] active:bg-white/13
    shadow-[0_4px_16px_rgba(0,0,0,0.2)]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,

  // Danger — for destructive actions
  danger: `
    bg-error text-white font-semibold
    shadow-[0_4px_16px_rgba(239,68,68,0.25)]
    hover:brightness-110
    active:scale-[0.97] active:translate-y-0
    disabled:opacity-50 disabled:cursor-not-allowed
  `,

  // Pill — compact, rounded-full
  pill: `
    bg-white/8 text-white/80 font-medium
    border border-white/10
    hover:bg-primary/15 hover:text-primary hover:border-primary/30
    active:scale-[0.95]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
};

// ============================================================================
// Size Styles (44px Touch Target)
// ============================================================================

const sizeStyles: Record<ButtonSize, string> = {
  sm:   'px-4 py-2 min-h-[44px] text-[13px] rounded-lg gap-1.5',
  md:   'px-6 py-3 min-h-[44px] text-[15px] rounded-xl gap-2',
  lg:   'px-8 py-3.5 min-h-[52px] text-[16px] rounded-xl gap-2.5',
  icon: 'p-2.5 min-w-[44px] min-h-[44px] rounded-lg justify-center',
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
  const isPill = variant === 'pill';

  return (
    <motion.button
      disabled={disabled || isLoading}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        relative inline-flex items-center justify-center cursor-pointer
        transition-all duration-150
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-primary/60
        focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        disabled:pointer-events-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isPill ? 'rounded-full' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        // Premium loading spinner
        <span className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && (
            <span className={children ? 'me-1.5' : ''}>{icon}</span>
          )}

          {!isLoading && children}

          {/* Button-in-Button Arrow Pattern */}
          {arrowIcon && (
            <span className="
              ms-1.5 w-7 h-7 rounded-full
              bg-white/15 flex items-center justify-center
              transition-transform duration-150
              group-hover:translate-x-0.5 group-hover:-translate-y-0.5
            ">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-180">
                <path d="M2 6H10M10 6L6 2M10 6L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
        </>
      )}
    </motion.button>
  );
};

export default Button;
