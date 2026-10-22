// The sheet that edits the weekly running goal, or the max / resting heart rate.

import { useId, useState } from 'react';
import { Sheet } from '../../../../components/ui/Sheet';
import { type CardioPrefs, writeCardioPrefs } from '../../../../services/running/cardioPrefs';
import { UNIT_KM, parseDecimal } from '../../../../utils/cardio';
import { mutedStyle } from './styles';

export type PrefsEditing = 'goal' | 'hr' | null;

export function PrefsSheet({
  editing,
  prefs,
  onClose,
}: {
  editing: PrefsEditing;
  prefs: CardioPrefs;
  onClose: () => void;
}) {
  const uid = useId();
  const [goal, setGoal] = useState(prefs.weeklyGoalKm ? String(prefs.weeklyGoalKm) : '');
  const [maxHr, setMaxHr] = useState(prefs.maxHr ? String(prefs.maxHr) : '');
  const [restHr, setRestHr] = useState(prefs.restingHr ? String(prefs.restingHr) : '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (editing === 'goal') {
      const g = parseDecimal(goal);
      if (goal.trim() !== '' && (g === null || g > 500)) {
        setError('יעד בין 1 ל־500 ק״מ');
        return;
      }
      writeCardioPrefs({ ...prefs, weeklyGoalKm: g });
    } else {
      const m = parseDecimal(maxHr);
      const r = parseDecimal(restHr);
      if (maxHr.trim() !== '' && (m === null || m < 100 || m > 230)) {
        setError('דופק מרבי בין 100 ל־230');
        return;
      }
      if (restHr.trim() !== '' && (r === null || r < 30 || r > 120)) {
        setError('דופק מנוחה בין 30 ל־120');
        return;
      }
      writeCardioPrefs({
        ...prefs,
        maxHr: m ? Math.round(m) : null,
        restingHr: r ? Math.round(r) : null,
      });
    }
    setError(null);
    onClose();
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    unit: string
  ) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--fs-ink)',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }} dir="ltr">
        <input
          id={id}
          className={`input${error ? ' input-error' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))}
          style={{ paddingInlineEnd: 64 }}
        />
        <span
          style={{
            position: 'absolute',
            insetInlineEnd: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <Sheet
      isOpen={editing !== null}
      onClose={onClose}
      title={editing === 'goal' ? 'יעד ריצה שבועי' : 'אזורי דופק'}
      footer={
        <button type="button" className="start-workout-btn focus-ring" onClick={save}>
          שמירה
        </button>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {editing === 'goal' ? (
          <>
            {field(`${uid}-goal`, 'כמה קילומטרים בשבוע?', goal, setGoal, UNIT_KM)}
            <p style={mutedStyle}>השאירו ריק כדי לבטל את היעד.</p>
          </>
        ) : (
          <>
            {field(`${uid}-max`, 'דופק מרבי (לא חובה)', maxHr, setMaxHr, 'bpm')}
            {field(`${uid}-rest`, 'דופק מנוחה (לא חובה)', restHr, setRestHr, 'bpm')}
            <p style={mutedStyle}>
              בלי דופק מרבי נחשב אותו לפי הגיל. עם דופק מנוחה האזורים מחושבים לפי עתודת הדופק
              (Karvonen), שמתאימה יותר למתאמנים.
            </p>
          </>
        )}
        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-error)',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
