/**
 * TRAINING LOG DESIGN — PRIMARY BUTTON
 */

import { Loader2 } from 'lucide-react';
import { memo } from 'react';
import { cn } from '../../../utils/styles';

interface AnnualButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  fullWidth?: boolean;
}

export const AnnualButton = memo(function AnnualButton({
  children,
  onClick,
  type = 'button',
  disabled,
  loading,
  variant = 'primary',
  className,
  fullWidth = true,
}: AnnualButtonProps) {
  const baseClasses = cn(
    'h-[52px] px-6 text-base font-bold',
    'tracking-[0.04em] transition-all duration-150',
    'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
    'active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
    'flex items-center justify-center gap-3',
    fullWidth ? 'w-full' : '',
    className
  );

  if (variant === 'primary') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(baseClasses, 'start-workout-btn accent-glow')}
        style={{
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
        }}
      >
        {loading ? (
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

  if (variant === 'secondary') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={baseClasses}
        style={{
          background: 'var(--fs-surface)',
          color: 'var(--fs-heading)',
          border: '2px solid var(--fs-primary)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
        }}
      >
        {loading ? (
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
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={baseClasses}
      style={{
        background: 'transparent',
        color: 'var(--fs-heading)',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        textTransform: 'uppercase',
      }}
    >
      {loading ? (
        <Loader2
          size={18}
          className="animate-spin"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      ) : null}
      {children}
    </button>
  );
});
