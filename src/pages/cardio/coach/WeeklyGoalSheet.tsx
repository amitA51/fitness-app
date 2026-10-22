// The weekly-kilometre goal: a stepper with a typed value, a hint from the
// runner's own month, and a way to clear it. Saves into cardio prefs, where
// Progress › אירובי reads the same goal.

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import { readCardioPrefs, writeCardioPrefs } from '../../../services/running';
import { UNIT_KM, formatKm, parseDecimal } from '../../../utils/cardio';

const MIN_KM = 1;
const MAX_KM = 500;
const STEP_KM = 1;

interface WeeklyGoalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentKm: number | null;
  /** Average of the four weeks before this one, for the hint. */
  recentAvgKm: number | null;
  goalRange: { lowKm: number; highKm: number } | null;
}

/** A sensible starting value: the current goal, else the runner's month, else 10. */
const startValue = (current: number | null, avg: number | null) =>
  current ?? (avg && avg >= MIN_KM ? Math.round(avg) : 10);

export function WeeklyGoalSheet({
  isOpen,
  onClose,
  currentKm,
  recentAvgKm,
  goalRange,
}: WeeklyGoalSheetProps) {
  const uid = useId();
  const [text, setText] = useState(() => String(startValue(currentKm, recentAvgKm)));
  const [error, setError] = useState<string | null>(null);
  const value = parseDecimal(text);

  const step = (delta: number) => {
    const base = value ?? 0;
    const next = Math.min(MAX_KM, Math.max(MIN_KM, Math.round(base + delta)));
    setText(String(next));
    setError(null);
  };

  const save = (km: number | null) => {
    if (km !== null && (km < MIN_KM || km > MAX_KM)) {
      setError(`כתבו מספר בין ${MIN_KM} ל-${MAX_KM}.`);
      return;
    }
    writeCardioPrefs({
      ...readCardioPrefs(),
      weeklyGoalKm: km === null ? null : Math.round(km * 10) / 10,
    });
    onClose();
  };

  const submit = () => {
    if (value === null) {
      setError('כתבו כמה קילומטרים בשבוע, למשל 15.');
      return;
    }
    save(value);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="יעד ריצה שבועי"
      footer={
        <div style={{ display: 'grid', gap: 4 }}>
          <button type="button" className="start-workout-btn focus-ring" onClick={submit}>
            שמירה
          </button>
          {currentKm !== null && (
            <button type="button" className="cta-ghost focus-ring" onClick={() => save(null)}>
              בלי יעד שבועי
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <label htmlFor={`${uid}-km`} className="cardio-label">
          כמה קילומטרים בשבוע?
        </label>
        <div className="rc-stepper">
          <button
            type="button"
            className="rc-step-btn focus-ring"
            onClick={() => step(-STEP_KM)}
            disabled={value !== null && value <= MIN_KM}
            aria-label="פחות קילומטר"
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <input
            id={`${uid}-km`}
            className={`input${error ? ' input-error' : ''}`}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              setText(e.target.value.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${uid}-err` : `${uid}-hint`}
          />
          <button
            type="button"
            className="rc-step-btn focus-ring"
            onClick={() => step(STEP_KM)}
            disabled={value !== null && value >= MAX_KM}
            aria-label="עוד קילומטר"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        {error ? (
          <p id={`${uid}-err`} className="cardio-error" role="alert">
            {error}
          </p>
        ) : (
          <p id={`${uid}-hint`} className="cardio-hint" style={{ margin: 0 }}>
            השבוע נספר מיום ראשון עד שבת.
          </p>
        )}
        <div style={{ display: 'grid', gap: 6 }}>
          {recentAvgKm !== null && (
            <p className="rc-muted">
              בחודש האחרון רצתם בממוצע{' '}
              <span className="kinetic-number">{formatKm(recentAvgKm)}</span> {UNIT_KM} בשבוע. יעד
              קרוב לזה, ומשם מוסיפים בהדרגה.
            </p>
          )}
          {goalRange && (
            <p className="rc-muted">
              לקראת המטרה שלכם מקובל{' '}
              <span className="kinetic-number" dir="ltr">
                {goalRange.lowKm}–{goalRange.highKm}
              </span>{' '}
              {UNIT_KM} בשבוע.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
