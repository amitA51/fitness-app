/** Inline number input — --fs-surface bg, LTR digits hugging the inline-end. */
interface NumberInputProps {
  value: number | '';
  onChange: (val: number | '') => void;
  min?: number;
  max?: number;
  placeholder?: string;
  unit?: string;
}

export function NumberInput({ value, onChange, min, max, placeholder, unit }: NumberInputProps) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        dir="ltr"
        enterKeyHint="done"
        aria-label={placeholder || unit || 'ערך מספרי'}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={placeholder}
        style={{
          width: '80px',
          minHeight: '44px',
          paddingBlock: '6px',
          paddingInline: '10px',
          textAlign: 'end',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          backgroundColor: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 0,
          color: 'var(--fs-ink)',
        }}
      />
      {unit && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

export default NumberInput;
