// UltraCard — DEPRECATED thin wrapper around the canonical <Card>.
// Kept so existing `import { UltraCard, UltraCardHeader, ... }` sites keep
// compiling. New code should import `Card` from './Card' directly.

import type React from 'react';
import { Card, type CardVariant } from './Card';

interface UltraCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: CardVariant;
  hoverEffect?: boolean;
  pressEffect?: boolean;
  /** @deprecated cursor spotlight removed in the consolidated Card. */
  cursorGlow?: boolean;
  noPadding?: boolean;
  className?: string;
  /** @deprecated colored glows removed; ignored. */
  glowColor?: 'cyan' | 'violet' | 'magenta' | 'gold' | 'neutral' | 'theme';
}

/** @deprecated Use `<Card>` from `components/ui/Card`. */
export const UltraCard: React.FC<UltraCardProps> = ({
  children,
  variant = 'elevated',
  hoverEffect = true,
  pressEffect = true,
  cursorGlow: _cursorGlow,
  noPadding = false,
  className = '',
  glowColor: _glowColor,
  ...props
}) => (
  <Card
    variant={variant}
    interactive={hoverEffect || pressEffect}
    noPadding={noPadding}
    className={className}
    {...props}
  >
    {children}
  </Card>
);

interface UltraCardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const UltraCardHeader: React.FC<UltraCardHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className = '',
}) => (
  <div className={`flex items-start justify-between mb-4 ${className}`}>
    <div className="flex items-center gap-3">
      {icon && (
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            background: 'rgba(var(--fs-accent-rgb), 0.15)',
            color: 'var(--fs-accent)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-bold tracking-tight" style={{ color: 'var(--fs-ink)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--fs-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

interface UltraCardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const UltraCardBody: React.FC<UltraCardBodyProps> = ({ children, className = '' }) => (
  <div className={className}>{children}</div>
);

interface UltraCardFooterProps {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}

export const UltraCardFooter: React.FC<UltraCardFooterProps> = ({
  children,
  className = '',
  bordered = true,
}) => (
  <div
    className={`mt-4 pt-4 ${className}`}
    style={bordered ? { borderTop: '1px solid var(--fs-surface-2)' } : undefined}
  >
    {children}
  </div>
);

export default UltraCard;
