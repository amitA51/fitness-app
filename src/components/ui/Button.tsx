import React from 'react';

// ============================================================================
// Types
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger' | 'pill';
type ButtonSize    = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

// ============================================================================
// Variant styles
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
  // Solid primary — uses the theme accent color
  primary: `
    bg-primary text-white font-semibold
    shadow-[0_1px_0_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]
    hover:brightness-110
    active:brightness-90 active:scale-[0.97]
    disabled:bg-primary/40
  `,

  // Ghost-bordered secondary
  secondary: `
    bg-transparent text-white/90 font-medium
    border border-white/[0.12]
    hover:bg-white/[0.06] hover:border-white/[0.18]
    active:bg-white/[0.1] active:scale-[0.97]
    disabled:text-white/30 disabled:border-white/[0.06]
  `,

  // Text-only ghost
  ghost: `
    bg-transparent text-primary font-medium
    hover:bg-primary/[0.08]
    active:bg-primary/[0.14] active:scale-[0.97]
    disabled:text-primary/30
  `,

  // Frosted glass
  glass: `
    bg-white/[0.06] backdrop-blur-xl text-white font-medium
    border border-white/[0.08]
    hover:bg-white/[0.10] hover:border-white/[0.13]
    active:bg-white/[0.13] active:scale-[0.97]
    shadow-[0_4px_16px_rgba(0,0,0,0.2)]
    disabled:text-white/30
  `,

  // Danger — used for destructive actions
  danger: `
    bg-red-500 text-white font-semibold
    shadow-[0_1px_0_rgba(0,0,0,0.25)]
    hover:bg-red-400
    active:bg-red-600 active:scale-[0.97]
    disabled:bg-red-500/30
  `,

  // Pill — fully rounded, compact; used for filters / tags
  pill: `
    bg-white/[0.08] text-white/80 font-medium
    border border-white/[0.1]
    hover:bg-primary/[0.15] hover:text-primary hover:border-primary/30
    active:scale-[0.95]
    disabled:text-white/30
  `,
};

// ============================================================================
// Size styles
// ============================================================================

const sizeStyles: Record<ButtonSize, string> = {
  // 44 px min-height for iOS touch target on all sizes
  sm:   'px-4   py-2   min-h-[44px] text-[13px] rounded-[12px] gap-1.5',
  md:   'px-6   py-3   min-h-[44px] text-[15px] rounded-[14px] gap-2',
  lg:   'px-8   py-3.5 min-h-[52px] text-base   rounded-[16px] gap-2.5',
  icon: 'p-2.5  min-w-[44px] min-h-[44px] rounded-[12px] justify-center',
};

// The pill variant always gets rounded-full regardless of size
const PILL_OVERRIDE = 'rounded-full';

// ============================================================================
// Component
// ============================================================================

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const isPill = variant === 'pill';

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        relative inline-flex items-center justify-center cursor-pointer
        transition-all duration-150 ease-out
        hover:scale-[1.02]
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-primary/60
        focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        disabled:pointer-events-none disabled:hover:scale-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isPill ? PILL_OVERRIDE : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        // Spinner
        <span className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        // Icon slot — margin only when there is adjacent text
        <span className={children ? 'mr-1.5' : ''}>{icon}</span>
      ) : null}

      {!isLoading && children}
    </button>
  );
};
