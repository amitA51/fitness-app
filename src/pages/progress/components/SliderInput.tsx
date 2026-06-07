import { memo, useId } from 'react';

export const SliderInput = memo(function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  color,
  labels,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  labels?: string[];
}) {
  const inputId = useId();
  const valueText = `${value}${unit}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label
          htmlFor={inputId}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
        <span
          dir="ltr"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '16px', color }}
        >
          {valueText}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="w-full h-2 appearance-none cursor-pointer"
        style={{ accentColor: color, borderRadius: 0 }}
        aria-valuetext={valueText}
      />
      {labels && (
        <div
          className="flex justify-between"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            color: 'var(--fs-muted)',
            marginTop: '6px',
          }}
        >
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
});
