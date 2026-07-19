import { m } from 'framer-motion';
import type React from 'react';
import { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  success?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  /** Trailing unit suffix rendered inside the field (e.g. "ק"ג", "גרם", "ס"מ"). */
  unit?: string;
}

/**
 * Global text/number input — mono eyebrow label, sharp editorial border that
 * recolors by state (error/success), optional leading/trailing icon and a unit
 * suffix. RTL-correct: padding via logical `ps-*`/`pe-*` classes, the icon
 * anchored with `start-*`/`end-*`, and `text-align: start`. 48px min height.
 * Use with `type="number"` for numeric coach fields.
 *
 * @example
 * <Input label="משקל" type="number" unit='ק"ג' value={w} onChange={e => set(e.target.value)} />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      success,
      icon,
      iconPosition = 'left',
      unit,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const reactId = useId();
    const inputId = id || props.name || reactId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Determine border color by state
    const stateBorder = error
      ? '2px solid var(--fs-warn)'
      : success
        ? '2px solid var(--fs-accent)'
        : '1px solid var(--fs-surface-2)';

    const describedBy =
      [error ? errorId : undefined, helper && !error ? helperId : undefined]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Label — mono eyebrow style */}
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              fontWeight: 600,
              color: 'var(--fs-muted)',
            }}
          >
            {label}
          </label>
        )}

        {/* Input Wrapper */}
        <div className="relative group">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`
              input
              ${icon && iconPosition === 'left' ? 'ps-11' : ''}
              ${icon && iconPosition === 'right' ? 'pe-11' : ''}
              ${unit ? 'pe-14' : ''}
            `}
            style={{
              border: stateBorder,
              borderRadius: 12,
              fontFamily: 'var(--font-body)',
              minHeight: 48,
              fontSize: 16,
              textAlign: 'start',
            }}
            {...props}
          />

          {/* Icon */}
          {icon && (
            <div
              className={`
                absolute top-1/2 -translate-y-1/2
                transition-colors duration-200
                ${iconPosition === 'left' ? 'start-4' : 'end-4'}
              `}
              style={{ color: 'var(--fs-muted)' }}
            >
              {icon}
            </div>
          )}

          {/* Unit suffix — trailing (logical end), non-interactive */}
          {unit && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 end-4 pointer-events-none"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <m.span
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: 'var(--fs-warn)',
              fontWeight: 600,
            }}
          >
            {error}
          </m.span>
        )}

        {/* Helper Text */}
        {helper && !error && (
          <span
            id={helperId}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            {helper}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
