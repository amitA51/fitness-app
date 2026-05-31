import { memo, useEffect, useId, useState } from 'react';

export interface MobileInputProps {
  type: 'text' | 'number';
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  inputMode?: 'numeric' | 'decimal' | 'text';
  step?: number | string;
}

export const MobileInput = memo(function MobileInput({
  type,
  value,
  onChange,
  placeholder,
  label,
  unit,
  min,
  max,
  inputMode,
  step,
}: MobileInputProps) {
  const [rawValue, setRawValue] = useState(value === '' ? '' : String(value));
  const inputId = useId();

  // Sync external value changes (e.g. parent reset)
  useEffect(() => {
    setRawValue(value === '' ? '' : String(value));
  }, [value]);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block mb-2 px-1"
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
      )}
      <div className="relative">
        <input
          id={inputId}
          type={type}
          inputMode={inputMode ?? (type === 'number' ? 'numeric' : 'text')}
          pattern={
            type === 'number' && (inputMode ?? 'numeric') === 'numeric' ? '[0-9]*' : undefined
          }
          step={step}
          value={type === 'number' ? rawValue : value}
          onChange={(e) => {
            if (type === 'number') {
              setRawValue(e.target.value);
            } else {
              onChange(e.target.value);
            }
          }}
          onBlur={() => {
            if (type === 'number') {
              const parsed = rawValue === '' ? '' : Number(rawValue);
              onChange(parsed === '' || Number.isNaN(parsed as number) ? '' : parsed);
            }
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full h-14 px-4 text-base placeholder:opacity-60 focus:outline-none transition-all appearance-none"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            fontFamily: 'var(--font-body)',
            color: 'var(--fs-ink)',
            paddingLeft: unit ? '3rem' : undefined,
            paddingRight: unit ? '3rem' : undefined,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--fs-accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(67, 199, 165, 0.2)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--fs-surface-2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {unit && (
          <span
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              color: 'var(--fs-muted)',
              left: '1rem',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
});
