// PlanSetRow — compact per-set editor for the pre-workout planning table.
//
// SetInputCard (the active-workout input) is ~160px tall and built for a single
// focused set, so it does not fit a dense planning table. This row is a slim
// (~52px) weight + reps editor: a tappable numeric field flanked by −/+ steppers,
// matching the editorial token system. Empty fields fall back to a faint ghost
// placeholder (previous-workout value) without committing it, so values are
// "pre-filled but not marked done" until the trainee types or steps them.

import { Minus, Plus, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface StepperFieldProps {
  value: number;
  ghost?: number;
  step: number;
  integer: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}

const StepperField = memo<StepperFieldProps>(
  ({ value, ghost, step, integer, ariaLabel, onChange }) => {
    // Local text mirror so mid-typing states like "12." aren't clobbered by the
    // numeric round-trip. Re-syncs whenever the committed value changes from the
    // outside (stepper taps, fill-from-previous, etc).
    const [text, setText] = useState(value ? String(value) : '');
    useEffect(() => {
      setText(value ? String(value) : '');
    }, [value]);

    const commitText = useCallback(
      (raw: string) => {
        const cleaned = raw.replace(integer ? /[^0-9]/g : /[^0-9.]/g, '');
        setText(cleaned);
        const parsed = cleaned === '' ? 0 : Number.parseFloat(cleaned);
        onChange(Number.isNaN(parsed) ? 0 : Math.max(0, round2(parsed)));
      },
      [integer, onChange]
    );

    const step10 = useCallback(
      (dir: 1 | -1) => {
        triggerHaptic('light');
        onChange(Math.max(0, round2(value + dir * step)));
      },
      [value, step, onChange]
    );

    const hasGhost = !value && ghost != null && ghost > 0;

    return (
      <div
        className="flex items-center"
        style={{
          gap: 4,
          background: 'var(--fs-surface-2)',
          borderRadius: 8,
          padding: '3px 4px',
        }}
      >
        <button
          type="button"
          onClick={() => step10(-1)}
          aria-label={`הפחת ${ariaLabel}`}
          className="flex items-center justify-center shrink-0 cursor-pointer focus-ring"
          style={{
            width: 32,
            height: 32,
            background: 'var(--fs-surface)',
            borderRadius: 6,
            color: 'var(--fs-muted)',
          }}
        >
          <Minus style={{ width: 15, height: 15 }} />
        </button>

        <input
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          dir="ltr"
          value={text}
          placeholder={hasGhost ? String(ghost) : '0'}
          onChange={(e) => commitText(e.target.value)}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 text-center bg-transparent focus:outline-none"
          style={{
            width: 44,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 18,
            color: value ? 'var(--fs-ink)' : 'color-mix(in srgb, var(--fs-muted) 55%, transparent)',
            border: 'none',
          }}
        />

        <button
          type="button"
          onClick={() => step10(1)}
          aria-label={`הוסף ${ariaLabel}`}
          className="flex items-center justify-center shrink-0 cursor-pointer focus-ring"
          style={{
            width: 32,
            height: 32,
            background: 'var(--fs-accent)',
            borderRadius: 6,
            color: 'var(--fs-heading)',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
        </button>
      </div>
    );
  }
);
StepperField.displayName = 'StepperField';

export interface PlanSetRowProps {
  /** Zero-based index in the exercise's set list. */
  index: number;
  weight: number;
  reps: number;
  weightIncrement: number;
  ghostWeight?: number;
  ghostReps?: number;
  canRemove: boolean;
  onChange: (field: 'weight' | 'reps', value: number) => void;
  onRemove: () => void;
}

const PlanSetRow = memo<PlanSetRowProps>(
  ({
    index,
    weight,
    reps,
    weightIncrement,
    ghostWeight,
    ghostReps,
    canRemove,
    onChange,
    onRemove,
  }) => {
    return (
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: '28px 1fr 1fr 32px',
          gap: 8,
          padding: '4px 0',
        }}
      >
        {/* Set number badge */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
          }}
          aria-hidden="true"
        >
          {index + 1}
        </div>

        <StepperField
          value={weight}
          ghost={ghostWeight}
          step={weightIncrement}
          integer={false}
          ariaLabel={`משקל לסט ${index + 1}`}
          onChange={(v) => onChange('weight', v)}
        />

        <StepperField
          value={reps}
          ghost={ghostReps}
          step={1}
          integer={true}
          ariaLabel={`חזרות לסט ${index + 1}`}
          onChange={(v) => onChange('reps', v)}
        />

        {/* Remove set */}
        <button
          type="button"
          onClick={() => {
            if (!canRemove) return;
            triggerHaptic('light');
            onRemove();
          }}
          disabled={!canRemove}
          aria-label={`הסר סט ${index + 1}`}
          className="flex items-center justify-center cursor-pointer focus-ring disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            width: 32,
            height: 32,
            color: 'var(--fs-muted)',
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>
    );
  }
);
PlanSetRow.displayName = 'PlanSetRow';

export default PlanSetRow;
