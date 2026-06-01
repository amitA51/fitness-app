import { motion } from 'framer-motion';
import type React from 'react';
import { forwardRef, useId } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
  success?: boolean;
}

/**
 * Multi-line text input matching the editorial <Input> styling: mono eyebrow
 * label, sharp border that recolors by state, mono error/helper lines.
 * RTL-correct (`text-align: start`), 44px+ min height. Pairs with <Input>.
 *
 * @example
 * <Textarea label="הערות" rows={4} value={notes} onChange={e => set(e.target.value)} />
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helper, success, className = '', id, rows = 3, ...props }, ref) => {
    const reactId = useId();
    const inputId = id || props.name || reactId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

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

        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="input"
          style={{
            border: stateBorder,
            borderRadius: 0,
            fontFamily: 'var(--font-body)',
            minHeight: 88,
            fontSize: 16,
            textAlign: 'start',
            resize: 'vertical',
            lineHeight: 'var(--leading-normal)',
          }}
          {...props}
        />

        {error && (
          <motion.span
            id={errorId}
            role="alert"
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

        {helper && !error && (
          <span
            id={helperId}
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

Textarea.displayName = 'Textarea';

export default Textarea;
