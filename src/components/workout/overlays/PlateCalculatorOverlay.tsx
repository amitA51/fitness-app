// PlateCalculatorOverlay - greedy plate-per-side breakdown for barbell loading.
// User enters target total weight + bar weight + unit. Output: list of plates per side.
// No persistence; pure presentational. Hebrew/RTL.

import { X as CloseIcon } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface PlateCalculatorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialTarget?: number;
  initialBar?: number;
  initialUnit?: 'kg' | 'lb';
}

interface PlateRow {
  weight: number;
  count: number;
}

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATES_LB = [45, 35, 25, 10, 5, 2.5];

function breakdownPlates(
  totalWeight: number,
  barWeight: number,
  available: readonly number[]
): { rows: PlateRow[]; residual: number; perSide: number } {
  const loadable = totalWeight - barWeight;
  if (loadable <= 0) {
    return { rows: [], residual: loadable < 0 ? loadable : 0, perSide: 0 };
  }
  const perSide = loadable / 2;
  let remaining = perSide;
  const rows: PlateRow[] = [];
  for (const plate of available) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      rows.push({ weight: plate, count });
      remaining = Number.parseFloat((remaining - count * plate).toFixed(3));
    }
  }
  return { rows, residual: remaining, perSide };
}

const PlateCalculatorOverlay = memo<PlateCalculatorOverlayProps>(
  ({ isOpen, onClose, initialTarget = 60, initialBar, initialUnit = 'kg' }) => {
    const [unit, setUnit] = useState<'kg' | 'lb'>(initialUnit);
    const defaultBar = unit === 'kg' ? 20 : 45;
    const [target, setTarget] = useState<number>(initialTarget);
    const [bar, setBar] = useState<number>(initialBar ?? defaultBar);

    const breakdown = useMemo(
      () => breakdownPlates(target, bar, unit === 'kg' ? PLATES_KG : PLATES_LB),
      [target, bar, unit]
    );

    const handleUnitChange = useCallback((next: 'kg' | 'lb') => {
      setUnit(next);
      setBar(next === 'kg' ? 20 : 45);
    }, []);

    const adjustTarget = useCallback((delta: number) => {
      setTarget((prev) => Math.max(0, prev + delta));
    }, []);

    if (!isOpen) return null;

    return (
      <ModalOverlay isOpen={isOpen} onClose={onClose} ariaLabel="מחשבון פלטות">
        {/* No role="dialog" here: ModalOverlay already renders the dialog
            (role + aria-modal + focus trap). A nested dialog confuses screen
            readers — the accessible name now rides on ModalOverlay's ariaLabel. */}
        <div
          dir="rtl"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-steel)',
            borderRadius: '20px 12px 20px 12px',
            padding: '20px 22px',
            width: 'min(420px, 92vw)',
            maxHeight: '88vh',
            overflowY: 'auto',
            color: 'var(--fs-ink)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: '-0.02em',
              }}
            >
              מחשבון פלטות
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--fs-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <CloseIcon />
            </button>
          </div>

          <div
            style={{ display: 'flex', gap: 6, marginBottom: 14 }}
            role="group"
            aria-label="יחידה"
          >
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                aria-pressed={unit === u}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: unit === u ? 'var(--fs-accent)' : 'var(--fs-bg)',
                  border: '1px solid var(--fs-steel)',
                  borderRadius: '12px 8px 12px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: unit === u ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                  cursor: 'pointer',
                }}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>

          <FieldRow label="משקל יעד">
            <NumericStepper
              value={target}
              onChange={setTarget}
              onIncrement={() => adjustTarget(2.5)}
              onDecrement={() => adjustTarget(-2.5)}
              unit={unit}
            />
          </FieldRow>

          <FieldRow label="משקל מוט">
            <NumericStepper
              value={bar}
              onChange={setBar}
              onIncrement={() => setBar((b) => Math.max(0, b + 2.5))}
              onDecrement={() => setBar((b) => Math.max(0, b - 2.5))}
              unit={unit}
            />
          </FieldRow>

          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              background: 'var(--fs-bg)',
              border: '1px solid var(--fs-steel)',
              borderRadius: '14px 10px 14px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
              }}
            >
              לכל צד
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 28,
                direction: 'ltr',
              }}
            >
              {breakdown.perSide.toFixed(2)} {unit}
            </span>
          </div>

          <div style={{ marginTop: 16 }}>
            {breakdown.rows.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--fs-muted)',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  padding: '10px 0',
                }}
              >
                {target < bar ? 'משקל יעד קטן מהמוט' : 'אין צורך בפלטות'}
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {breakdown.rows.map((row) => (
                  <li
                    key={row.weight}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--fs-bg)',
                      border: '1px solid var(--fs-steel)',
                      borderRadius: '10px 6px 10px 6px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 13,
                        direction: 'ltr',
                      }}
                    >
                      {row.count}× {row.weight} {unit}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--fs-muted)',
                      }}
                    >
                      לכל צד
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {breakdown.residual > 0.001 && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--fs-warn, #c97c00)',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'center',
                }}
              >
                שארית של {breakdown.residual.toFixed(2)} {unit} לא ניתנת לטעינה
              </p>
            )}
          </div>
        </div>
      </ModalOverlay>
    );
  }
);

PlateCalculatorOverlay.displayName = 'PlateCalculatorOverlay';

export default PlateCalculatorOverlay;

const FieldRow = memo<{ label: string; children: React.ReactNode }>(({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <span
      style={{
        display: 'block',
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        color: 'var(--fs-muted)',
        marginBottom: 6,
      }}
    >
      {label}
    </span>
    {children}
  </div>
));
FieldRow.displayName = 'FieldRow';

interface NumericStepperProps {
  value: number;
  onChange: (next: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  unit: string;
}

const stepperBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: '12px 8px 12px 8px',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 22,
  color: 'var(--fs-ink)',
  cursor: 'pointer',
};

const NumericStepper = memo<NumericStepperProps>(
  ({ value, onChange, onIncrement, onDecrement, unit }) => {
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        onChange(0);
        return;
      }
      const next = Number.parseFloat(raw);
      if (!Number.isNaN(next)) onChange(Math.max(0, next));
    };
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 6 }}>
        <button type="button" onClick={onDecrement} aria-label="הפחת" style={stepperBtn}>
          −
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            background: 'var(--fs-bg)',
            border: '1px solid var(--fs-steel)',
            borderRadius: '12px 8px 12px 8px',
          }}
        >
          <input
            type="number"
            value={value}
            onChange={handleInput}
            inputMode="decimal"
            step={0.5}
            min={0}
            aria-label="ערך"
            style={{
              width: '70%',
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 22,
              color: 'var(--fs-ink)',
              direction: 'ltr',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              marginInlineStart: 4,
            }}
          >
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={onIncrement}
          aria-label="הגדל"
          style={{
            ...stepperBtn,
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
          }}
        >
          +
        </button>
      </div>
    );
  }
);
NumericStepper.displayName = 'NumericStepper';
