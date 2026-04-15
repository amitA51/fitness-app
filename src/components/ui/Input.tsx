import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helper,
  icon,
  iconPosition = 'left',
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || props.name || Math.random().toString(36).substring(2, 11);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold text-label-secondary uppercase tracking-wider me-1"
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
            w-full
            bg-surface-input
            border rounded-xl
            px-4 py-3.5
            text-[15px] text-white
            placeholder:text-label-tertiary
            transition-all duration-200
            focus:outline-none
            ${icon && iconPosition === 'left' ? 'ps-11' : ''}
            ${icon && iconPosition === 'right' ? 'pe-11' : ''}
            ${error
              ? 'border-error/50 focus:border-error focus:ring-2 focus:ring-error/20'
              : 'border-white/6 focus:border-primary/50 focus:ring-2 focus:ring-primary/15'
            }
          `}
          {...props}
        />

        {/* Icon */}
        {icon && (
          <div
            className={`
              absolute top-1/2 -translate-y-1/2
              text-label-tertiary
              transition-colors duration-200
              group-focus-within:text-label-secondary
              ${iconPosition === 'left' ? 'start-4' : 'end-4'}
            `}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-error font-medium me-1"
        >
          {error}
        </motion.span>
      )}

      {/* Helper Text */}
      {helper && !error && (
        <span className="text-xs text-label-secondary font-medium me-1">
          {helper}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
