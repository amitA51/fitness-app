// Badge - Premium Badge using CSS Variables
// Minimal variants - all use primary color

import { memo } from 'react';
import { cn } from '../../../../utils/styles';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'accent' | 'success' | 'secondary';
  icon?: React.ReactNode;
}

export const Badge = memo<BadgeProps>(({ children, variant = 'accent', icon }) => {
  const getStyle = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'rgba(48, 209, 88, 0.15)',
          color: 'var(--color-success)',
          shadow: '0 0 12px rgba(48, 209, 88, 0.2)',
        };
      case 'accent':
        return {
          bg: 'var(--color-primary-subtle)',
          color: 'var(--fs-accent)',
          shadow: '0 0 12px var(--color-primary-glow)',
        };
      case 'secondary':
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.08)',
          color: 'rgba(255, 255, 255, 0.6)',
          shadow: 'none',
        };
    }
  };

  const style = getStyle();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
        'backdrop-blur-sm'
      )}
      style={{
        background: style.bg,
        color: style.color,
        boxShadow: style.shadow,
      }}
    >
      {icon}
      {children}
    </div>
  );
});

Badge.displayName = 'Badge';
