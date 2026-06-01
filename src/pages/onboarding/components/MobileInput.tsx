import { memo, useEffect, useState } from 'react';
import { Input } from '../../../components/ui/Input';

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
  /** Optional inline validation error (Hebrew), rendered by the foundation Input. */
  error?: string;
}

/**
 * Thin onboarding wrapper around the foundation {@link Input}. It exists only to
 * preserve the number-field UX (type freely as a raw string, commit a parsed
 * number on blur) that the onboarding steps rely on. All rendering — label,
 * RTL-correct `unit` suffix, error state, 48px min height — is delegated to
 * `Input`, so there is no bespoke markup to drift out of sync with the design
 * system. The previous LTR-biased `left: '1rem'` unit positioning is gone.
 */
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
  error,
}: MobileInputProps) {
  // Raw draft for number fields so partial input (empty, "1.", trailing dot) is
  // never clobbered by eager parsing mid-typing. Committed on blur.
  const [rawValue, setRawValue] = useState(value === '' ? '' : String(value));

  // Sync external value changes (e.g. parent reset / restored draft).
  useEffect(() => {
    setRawValue(value === '' ? '' : String(value));
  }, [value]);

  if (type === 'number') {
    const resolvedMode = inputMode ?? 'numeric';
    return (
      <Input
        type="number"
        inputMode={resolvedMode}
        pattern={resolvedMode === 'numeric' ? '[0-9]*' : undefined}
        step={step}
        value={rawValue}
        onChange={(e) => setRawValue(e.target.value)}
        onBlur={() => {
          const parsed = rawValue === '' ? '' : Number(rawValue);
          onChange(parsed === '' || Number.isNaN(parsed as number) ? '' : parsed);
        }}
        placeholder={placeholder}
        min={min}
        max={max}
        label={label}
        unit={unit}
        error={error}
      />
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      label={label}
      unit={unit}
      error={error}
    />
  );
});
