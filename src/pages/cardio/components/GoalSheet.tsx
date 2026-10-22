// GoalSheet — set, change or remove the running goal: a distance, an optional
// date and an optional finish time, with the target pace shown as you type.

import { useEffect, useId, useRef, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import {
  GOAL_DISTANCES,
  type GoalDistanceId,
  type RunningGoal,
  goalLabelFor,
  writeRunningGoal,
} from '../../../services/running';
import { UNIT_KM, UNIT_PACE_KM, formatClock, formatPace } from '../../../utils/cardio';
import { todayIso } from '../coach/coachFormat';
import { GOAL_KM_MAX, GOAL_KM_MIN, customKmFrom, goalTimeError, goalTimeFrom } from './goalForm';
import '../cardio.css';
import '../coach/coach.css';

interface GoalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The goal to edit; null starts a new one. */
  goal: RunningGoal | null;
  now?: Date;
}

function initialDistance(goal: RunningGoal | null): GoalDistanceId {
  if (!goal) return '5k';
  return GOAL_DISTANCES.find((d) => Math.abs(d.km - goal.distanceKm) < 0.05)?.id ?? 'custom';
}

export function GoalSheet({ isOpen, onClose, goal, now = new Date() }: GoalSheetProps) {
  const uid = useId();
  const today = todayIso(now);
  const [distanceId, setDistanceId] = useState<GoalDistanceId>(() => initialDistance(goal));
  const [customText, setCustomText] = useState(() =>
    goal && initialDistance(goal) === 'custom' ? String(goal.distanceKm) : ''
  );
  const [date, setDate] = useState(goal?.raceDate ?? '');
  const [timeText, setTimeText] = useState(goal?.targetSec ? formatClock(goal.targetSec) : '');
  const [touched, setTouched] = useState({ km: false, date: false, time: false });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);
  const pickedCustom = useRef(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const askedRemove = useRef(false);

  useEffect(() => {
    if (distanceId === 'custom' && pickedCustom.current) customRef.current?.focus();
  }, [distanceId]);

  // The pressed button disappears when the confirm row swaps in (and back), so
  // focus moves to the safe choice, then back to where it was.
  useEffect(() => {
    if (confirmRemove) {
      askedRemove.current = true;
      keepRef.current?.focus();
    } else if (askedRemove.current) {
      removeRef.current?.focus();
    }
  }, [confirmRemove]);

  const named = GOAL_DISTANCES.find((d) => d.id === distanceId);
  const km = named ? named.km : customKmFrom(customText);
  const kmError =
    !named && km === null ? `כתבו מרחק בין ${GOAL_KM_MIN} ל-${GOAL_KM_MAX} ק״מ.` : null;
  const dateError = date && date < today ? 'בחרו תאריך מהיום והלאה.' : null;
  const timeError = goalTimeError(timeText, km);
  const targetSec = timeText.trim() && !timeError ? goalTimeFrom(timeText, km) : null;
  const pace = km && targetSec ? formatPace(targetSec / km) : null;

  const save = () => {
    setTouched({ km: true, date: true, time: true });
    if (km === null || kmError || dateError || timeError) return;
    writeRunningGoal({
      distanceKm: km,
      label: named ? named.label : goalLabelFor(km),
      raceDate: date || null,
      targetSec,
      createdAt: goal?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  };

  const remove = () => {
    writeRunningGoal(null);
    onClose();
  };

  const err = (id: string, text: string | null, show: boolean) =>
    text && show ? (
      <p id={id} className="cardio-error" role="alert">
        {text}
      </p>
    ) : null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={goal ? 'עריכת המטרה' : 'מטרה חדשה'}
      initialFocusSelector='[data-goal-initial="true"]'
      footer={
        <div style={{ display: 'grid', gap: 4 }}>
          <button type="button" className="start-workout-btn focus-ring" onClick={save}>
            שמירת המטרה
          </button>
          <button type="button" className="cta-ghost focus-ring" onClick={onClose}>
            ביטול
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="cardio-field">
          <span id={`${uid}-dist`} className="cardio-label">
            לאיזה מרחק?
          </span>
          <div className="cardio-chips" role="group" aria-labelledby={`${uid}-dist`}>
            {[...GOAL_DISTANCES, { id: 'custom' as const, label: 'אחר' }].map((d) => (
              <button
                key={d.id}
                type="button"
                className="cardio-chip focus-ring"
                aria-pressed={distanceId === d.id}
                data-goal-initial={distanceId === d.id ? 'true' : undefined}
                onClick={() => {
                  pickedCustom.current = d.id === 'custom';
                  setDistanceId(d.id);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          {distanceId === 'custom' && (
            <div className="cardio-field" style={{ marginTop: 6 }}>
              <label htmlFor={`${uid}-km`} className="cardio-label">
                כמה קילומטרים?
              </label>
              <div className="cardio-unit-input" dir="ltr">
                <input
                  ref={customRef}
                  id={`${uid}-km`}
                  className={`input${kmError && touched.km ? ' input-error' : ''}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value.replace(/[^\d.,]/g, ''))}
                  onBlur={() => setTouched((t) => ({ ...t, km: true }))}
                  aria-invalid={kmError && touched.km ? true : undefined}
                  aria-describedby={kmError && touched.km ? `${uid}-km-err` : undefined}
                />
                <span className="cardio-unit">{UNIT_KM}</span>
              </div>
              {err(`${uid}-km-err`, kmError, touched.km)}
            </div>
          )}
        </div>

        <div className="cardio-field">
          <label htmlFor={`${uid}-date`} className="cardio-label">
            תאריך המרוץ (לא חובה)
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            className={`input${dateError && touched.date ? ' input-error' : ''}`}
            dir="ltr"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, date: true }))}
            aria-invalid={dateError && touched.date ? true : undefined}
            aria-describedby={dateError && touched.date ? `${uid}-date-err` : `${uid}-date-hint`}
          />
          {err(`${uid}-date-err`, dateError, touched.date) ?? (
            <span id={`${uid}-date-hint`} className="cardio-hint">
              בלי תאריך מתאמנים בקצב שלכם, בלי לחץ של מועד.
            </span>
          )}
        </div>

        <div className="cardio-field">
          <label htmlFor={`${uid}-time`} className="cardio-label">
            זמן יעד (לא חובה)
          </label>
          <input
            id={`${uid}-time`}
            className={`input${timeError && touched.time ? ' input-error' : ''}`}
            dir="ltr"
            autoComplete="off"
            placeholder="50:00"
            value={timeText}
            onChange={(e) => setTimeText(e.target.value.replace(/[^\d:.,]/g, ''))}
            onBlur={() => setTouched((t) => ({ ...t, time: true }))}
            aria-invalid={timeError && touched.time ? true : undefined}
            aria-describedby={timeError && touched.time ? `${uid}-time-err` : `${uid}-time-hint`}
          />
          {err(`${uid}-time-err`, timeError, touched.time) ?? (
            <span id={`${uid}-time-hint`} className="cardio-hint">
              למשל 25:00 ל-5 ק״מ, או 1:55:00 לחצי מרתון. בלי זמן — המטרה היא לסיים.
            </span>
          )}
        </div>

        {pace && targetSec && (
          <p className="cardio-preview" aria-live="polite" style={{ margin: 0 }}>
            <span>
              זמן{' '}
              <strong className="kinetic-number" dir="ltr">
                {formatClock(targetSec)}
              </strong>
            </span>
            <span>
              קצב יעד{' '}
              <strong className="kinetic-number" dir="ltr">
                {pace}
              </strong>{' '}
              {UNIT_PACE_KM}
            </span>
          </p>
        )}

        {goal &&
          (confirmRemove ? (
            <div className="rc-confirm" role="group" aria-labelledby={`${uid}-rm`}>
              <p id={`${uid}-rm`} className="rc-body" style={{ fontWeight: 600 }}>
                להסיר את המטרה? ההמלצות יחזרו להיות כלליות.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="cta-secondary focus-ring rc-danger"
                  style={{ flex: 1 }}
                  onClick={remove}
                >
                  כן, להסיר
                </button>
                <button
                  ref={keepRef}
                  type="button"
                  className="cta-secondary focus-ring"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmRemove(false)}
                >
                  להשאיר
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={removeRef}
              type="button"
              className="cta-ghost focus-ring rc-danger"
              style={{ justifySelf: 'start', paddingInline: 0 }}
              onClick={() => setConfirmRemove(true)}
            >
              הסרת המטרה
            </button>
          ))}
      </div>
    </Sheet>
  );
}
