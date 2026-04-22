import type React from 'react';
import { useCallback, useRef, useState } from 'react';

type CardVariant = 'elevated' | 'sunken' | 'floating' | 'glass';

interface UltraCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: CardVariant;
  hoverEffect?: boolean;
  pressEffect?: boolean;
  cursorGlow?: boolean;
  noPadding?: boolean;
  className?: string;
  // Legacy prop - kept for compatibility but no longer affects colored glows
  glowColor?: 'cyan' | 'violet' | 'magenta' | 'gold' | 'neutral' | 'theme';
}

// Theme-aware card variants using CSS variables
const variantStyles: Record<CardVariant, React.CSSProperties> = {
  elevated: {
    background: 'var(--bg-card, var(--color-surface))',
    boxShadow: 'var(--shadow-sm)',
  },
  sunken: {
    background: 'var(--bg-primary, #F2F2F7)',
    boxShadow: 'var(--shadow-inner)',
  },
  floating: {
    background: 'var(--bg-card, var(--color-surface))',
    boxShadow: 'var(--shadow-lg)',
  },
  glass: {
    background: 'var(--surface-glass)',
    backdropFilter: 'blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 180%))',
    WebkitBackdropFilter:
      'blur(var(--glass-blur, 24px)) saturate(var(--glass-saturate, 180%))' as string,
    boxShadow: 'var(--shadow-sm)',
  },
};

// Hover shadow handled via CSS variables in theme

export const UltraCard: React.FC<UltraCardProps> = ({
  children,
  variant = 'elevated',
  hoverEffect = true,
  pressEffect = true,
  cursorGlow = false, // Disabled by default for performance; enable per-card if needed
  noPadding = false,
  className = '',
  glowColor, // Legacy - intentionally unused
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current || !cursorGlow) return;
      const rect = cardRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [cursorGlow]
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative overflow-hidden rounded-2xl
        ${hoverEffect ? 'hover:-translate-y-[2px] hover:scale-[1.003]' : ''}
        ${pressEffect ? 'active:scale-[0.985]' : ''}
        transition-all duration-200 ease-out
        animate-in fade-in slide-in-from-bottom-4
        ${className}
      `}
      style={{
        ...variantStyles[variant],
        ...props.style,
      }}
      {...(({ style: _style, ...rest }) => rest)(props)}
    >
      {/* Subtle cursor spotlight -- theme-aware */}
      {cursorGlow && isHovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(350px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.04), transparent 60%)`,
          }}
        />
      )}

      {/* Content */}
      <div className={`relative z-10 ${noPadding ? '' : 'p-6'}`}>{children}</div>
    </div>
  );
};

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
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(6, 182, 212, 0.15)',
            color: 'var(--dynamic-accent-start, #007AFF)',
          }}
        >
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
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
    style={bordered ? { borderTop: '1px solid var(--color-border)' } : undefined}
  >
    {children}
  </div>
);

export default UltraCard;
