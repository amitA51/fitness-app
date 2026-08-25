/**
 * Fresh Steel / Obsidian — text input primitive.
 */

import { AlertCircle } from 'lucide-react';
import { memo, useId } from 'react';
import { cn } from '../../utils/styles';

interface AnnualInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
}

export const AnnualInput = memo(function AnnualInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  suffix,
  error,
  disabled,
  autoComplete,
  autoFocus,
  inputMode,
  enterKeyHint,
}: AnnualInputProps) {
  const inputId = useId();
  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="block mb-2"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--fs-muted)',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div
            className="absolute start-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--fs-muted)' }}
          >
            {icon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          className={cn(
            'w-full h-14 transition-ui duration-200',
            'text-base',
            'placeholder:opacity-60',
            'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--fs-focus-ring)]',
            icon ? 'ps-12 pe-4' : 'px-4',
            suffix ? 'pe-12' : '',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          )}
          style={{
            background: 'var(--fs-surface)',
            border: error ? '1px solid var(--color-error)' : '1px solid var(--fs-surface-2)',
            borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-body)',
            color: 'var(--fs-ink)',
          }}
        />
        {suffix && <div className="absolute end-4 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {error && (
        <p
          className="mt-1.5 flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-error)',
            letterSpacing: '-0.01em',
          }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
});
