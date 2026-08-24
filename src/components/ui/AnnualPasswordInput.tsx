/**
 * Fresh Steel / Obsidian — password input primitive.
 */

import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { memo, useId, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { cn } from '../../utils/styles';
import { zoneColor } from '../../utils/zoneColor';

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
  /**
   * Show a live 3-segment strength meter + Hebrew hint below the field. Opt-in
   * (sign-up only) — it's encouragement, never a blocking gate. Graded with the
   * app's zoneColor vocabulary (warn → muted → accent; never --fs-signal).
   */
  showStrength?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;
// Stable keys for the fixed-length 3-segment strength bar (avoids index-as-key).
const STRENGTH_SEGMENT_KEYS = ['seg-weak', 'seg-mid', 'seg-strong'] as const;

/**
 * Map a password to a 0–3 strength score: length ≥ 8, has a letter, has a
 * digit. Pure heuristic for encouragement — Supabase enforces the real policy.
 */
function scorePassword(value: string): number {
  if (value.length === 0) return 0;
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (/[a-zA-Z֐-׿]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  return score;
}

const STRENGTH_HINTS: Record<number, string> = {
  0: `לפחות ${MIN_PASSWORD_LENGTH} תווים`,
  1: 'הוסיפו אותיות וספרות לחיזוק',
  2: 'כמעט שם — הוסיפו ספרה',
  3: 'סיסמה חזקה',
};

/** Score → zoneColor key. 1 = attention (warn), 2 = neutral (muted), 3 = good (accent). */
function scoreToZoneColor(score: number): string {
  if (score >= 3) return zoneColor('good');
  if (score === 2) return zoneColor('neutral');
  return zoneColor('attention');
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
  showStrength = false,
}: AnnualPasswordInputProps) {
  const [show, setShow] = useState(false);
  const inputId = useId();
  const reducedMotion = useReducedMotion();
  const strengthScore = scorePassword(value);
  // Only surface the meter once the user has typed and opted in. Hidden while a
  // submit error is showing — the error already explains what's wrong.
  const showMeter = showStrength && value.length > 0 && !error;

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
            'w-full h-14 transition-ui duration-200 pe-12',
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
      {showMeter && (
        <div className="mt-2">
          <div className="flex gap-1.5" aria-hidden="true">
            {STRENGTH_SEGMENT_KEYS.map((segKey, i) => {
              const filled = i < strengthScore;
              return (
                <div
                  key={segKey}
                  className="flex-1 rounded-full"
                  style={{
                    height: '4px',
                    background: filled ? scoreToZoneColor(strengthScore) : 'var(--fs-surface-2)',
                    transition: reducedMotion ? 'none' : 'background-color 200ms ease',
                  }}
                />
              );
            })}
          </div>
          <p
            className="mt-1.5"
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
              letterSpacing: '-0.01em',
            }}
          >
            {STRENGTH_HINTS[strengthScore]}
          </p>
        </div>
      )}
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
