import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutTemplate } from '../../types';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function FSButton({
  children,
  onClick,
  variant = 'primary',
  className,
  ariaLabel,
  disabled = false,
  style,
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
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
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'filter 150ms ease, transform 150ms ease, box-shadow 150ms ease',
    userSelect: 'none',
    ...style,
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
      color: '#071412',
      borderRadius: '22px 16px 22px 16px',
      boxShadow: 'var(--shadow-button)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--fs-ink)',
      border: '1px solid var(--fs-primary)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--fs-ink)',
    },
    danger: {
      background: 'var(--color-error)',
      color: '#ffffff',
    },
    glass: {
      background: 'rgba(255,255,255,0.06)',
      color: 'var(--fs-ink)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      style={{ ...baseStyle, ...variantStyles[variant] }}
    >
      {children}
    </button>
  );
}

interface TemplateQuickStartProps {
  onQuickStart: () => void;
}

export const TemplateQuickStart = memo(function TemplateQuickStart({
  onQuickStart,
}: TemplateQuickStartProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}
    >
      <FSButton onClick={onQuickStart} variant="primary" ariaLabel="התחל אימון">
        התחל אימון
      </FSButton>
      <FSButton onClick={() => navigate('/templates')} variant="secondary" ariaLabel="תבניות">
        תבניות
      </FSButton>
    </div>
  );
});

interface TemplateItemProps {
  template: WorkoutTemplate;
  onClick: () => void;
}

export const TemplateItem = memo(function TemplateItem({ template, onClick }: TemplateItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        minWidth: 130,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-card)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--fs-accent)',
          letterSpacing: '0.2em',
          marginLeft: 4,
        }}
      >
        §
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {template.name}
      </span>
    </button>
  );
});

interface TemplateStripProps {
  templates: WorkoutTemplate[];
  onNavigate: (path: string) => void;
}

export const TemplateStrip = memo(function TemplateStrip({
  templates,
  onNavigate,
}: TemplateStripProps) {
  if (templates.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        padding: '4px 0',
        scrollbarWidth: 'none',
      }}
      className="no-scrollbar"
    >
      {templates.slice(0, 5).map((t) => (
        <TemplateItem key={t.id} template={t} onClick={() => onNavigate(`/workout/${t.id}`)} />
      ))}
      {templates.length > 5 && (
        <button
          type="button"
          onClick={() => onNavigate('/templates')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 14px',
            flexShrink: 0,
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            fontWeight: 600,
          }}
        >
          +{templates.length - 5}
        </button>
      )}
    </div>
  );
});
