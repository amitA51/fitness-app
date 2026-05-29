/**
 * TRAINING LOG DESIGN — INPUT COMPONENT
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
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
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
          className={cn(
            'w-full h-14 transition-all duration-200',
            'text-base',
            'placeholder:opacity-60',
            'focus:outline-none',
            icon ? 'pl-12 pr-4' : 'px-4',
            suffix ? 'pr-12' : '',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          )}
          style={{
            background: 'var(--fs-surface)',
            border: error ? '1px solid var(--fs-warn)' : '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            fontFamily: 'var(--font-body)',
            color: 'var(--fs-ink)',
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--fs-accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67, 199, 165, 0.2)';
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--fs-surface-2)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        />
        {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {error && (
        <p
          className="mt-1.5 flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--fs-warn)',
            letterSpacing: '0.05em',
          }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
});
