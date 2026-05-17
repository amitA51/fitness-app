import { motion } from 'framer-motion';
import type React from 'react';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  success?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helper, success, icon, iconPosition = 'left', className = '', id, ...props },
    ref
  ) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 11);

    // Determine border color by state
    const stateBorder = error
      ? '2px solid var(--fs-warn)'
      : success
        ? '2px solid var(--fs-accent)'
        : '1px solid var(--fs-surface-2)';

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Label — mono eyebrow style */}
        {label && (
          <label
            htmlFor={inputId}
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
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
            className={`
              input
              ${icon && iconPosition === 'left' ? 'ps-11' : ''}
              ${icon && iconPosition === 'right' ? 'pe-11' : ''}
            `}
            style={{
              border: stateBorder,
              borderRadius: 0,
              fontFamily: 'var(--font-body)',
              minHeight: 48,
              fontSize: 16,
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
        </div>

        {/* Error Message — mono */}
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.18em',
              color: 'var(--fs-warn)',
              fontWeight: 600,
            }}
          >
            {error}
          </motion.span>
        )}

        {/* Helper Text — mono, stone */}
        {helper && !error && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
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
