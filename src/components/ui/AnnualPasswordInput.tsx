/**
 * Fresh Steel / Obsidian — password input primitive.
 */

import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { memo, useId, useState } from 'react';
import { cn } from '../../utils/styles';

interface AnnualPasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
}

export const AnnualPasswordInput = memo(function AnnualPasswordInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  autoFocus,
  autoComplete = 'current-password',
  enterKeyHint,
}: AnnualPasswordInputProps) {
  const [show, setShow] = useState(false);
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
        <input
          id={inputId}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          autoFocus={autoFocus}
          className={cn(
            'w-full h-14 transition-all duration-200 pe-12',
            'text-base',
            'placeholder:opacity-60',
            'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--fs-focus-ring)]',
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          )}
          style={{
            background: 'var(--fs-surface)',
            border: error ? '1px solid var(--color-error)' : '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            fontFamily: 'var(--font-body)',
            color: 'var(--fs-ink)',
            paddingInlineStart: '16px',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute end-1 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[44px] min-h-[44px] transition-colors"
          style={{ color: 'var(--fs-muted)' }}
          aria-label={show ? 'הסתר סיסמה' : 'הצג סיסמה'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p
          className="mt-1.5 flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-error)',
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
