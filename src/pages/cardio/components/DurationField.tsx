import { memo, useId } from 'react';

export interface DurationParts {
  h: string;
  m: string;
  s: string;
}

export const EMPTY_DURATION: DurationParts = { h: '', m: '', s: '' };

/** Seconds from the three parts; null when nothing usable was typed. */
export function durationPartsToSec(parts: DurationParts): number | null {
  const h = Number(parts.h || 0);
  const m = Number(parts.m || 0);
  const s = Number(parts.s || 0);
  if (![h, m, s].every((n) => Number.isFinite(n) && n >= 0)) return null;
  const total = Math.round(h * 3600 + m * 60 + s);
  return total > 0 ? total : null;
}

export function secToDurationParts(totalSec: number): DurationParts {
  const sec = Math.max(0, Math.round(totalSec));
  return {
    h: sec >= 3600 ? String(Math.floor(sec / 3600)) : '',
    m: String(Math.floor((sec % 3600) / 60)),
    s: String(sec % 60).padStart(2, '0'),
  };
}

interface DurationFieldProps {
  label: string;
  value: DurationParts;
  onChange: (next: DurationParts) => void;
  error?: string | null;
}

const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, '').slice(0, max);

/**
 * Hours : minutes : seconds as three numeric boxes. A clock always reads
 * left-to-right, so the row is LTR even inside the RTL form.
 */
export const DurationField = memo(function DurationField({
  label,
  value,
  onChange,
  error,
}: DurationFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const parts: { key: keyof DurationParts; name: string; max: number }[] = [
    { key: 'h', name: 'שעות', max: 2 },
    { key: 'm', name: 'דקות', max: 3 },
    { key: 's', name: 'שניות', max: 2 },
  ];

  return (
    <fieldset className="cardio-field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="cardio-label" style={{ padding: 0, marginBottom: 6 }}>
        {label}
      </legend>
      <div className="cardio-duration">
        {parts.map((p, i) => (
          <div key={p.key} style={{ display: 'contents' }}>
            {i > 0 && (
              <span className="cardio-duration-sep" aria-hidden="true">
                :
              </span>
            )}
            <label className="cardio-duration-part">
              <input
                className={`input${error ? ' input-error' : ''}`}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={p.key === 'h' ? '0' : '00'}
                value={value[p.key]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => onChange({ ...value, [p.key]: digitsOnly(e.target.value, p.max) })}
              />
              <span>{p.name}</span>
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} className="cardio-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
});
