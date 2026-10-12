// ============================================================================
// CardioSetInputs — time + distance for a cardio exercise inside a workout.
// ============================================================================
// Replaces the weight × reps cards when the exercise is cardio (a treadmill
// warm-up, rowing intervals). Every keystroke writes straight into the set, so
// the bottom bar's ✓ completes it with whatever was typed — same flow as a lift.

import { memo, useId, useState } from 'react';
import type { CardioActivity, WorkoutSet } from '../../../types';
import {
  UNIT_KM,
  UNIT_M,
  cardioActivityConfig,
  cardioDistance,
  cardioPace,
  formatClock,
  parseDecimal,
} from '../../../utils/cardio';
import type { SetEditUpdates } from '../core/workoutTypes';

interface CardioSetInputsProps {
  activity: CardioActivity;
  set: WorkoutSet;
  /** The same set last session, for the "last time" line. */
  previousSet?: WorkoutSet | null;
  /** The plan's target (from a template / the coach's program). */
  target?: { durationSec?: number; distanceKm?: number };
  onChange: (updates: SetEditUpdates) => void;
}

const cardStyle = {
  display: 'grid',
  gap: 6,
  padding: '12px 14px',
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: 16,
} as const;

const labelStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fs-muted)',
} as const;

const bigInput = {
  width: '100%',
  minHeight: 48,
  padding: '6px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  background: 'var(--color-surface-input)',
  color: 'var(--fs-ink)',
  fontFamily: 'var(--font-display)',
  fontSize: 26,
  fontWeight: 700,
  textAlign: 'center',
} as const;

const unitStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--fs-muted)',
  textAlign: 'center',
} as const;

const digits = (raw: string, max: number) => raw.replace(/\D/g, '').slice(0, max);

/** Keyed by set id by the parent, so local text resets for each new set. */
export const CardioSetInputs = memo(function CardioSetInputs({
  activity,
  set,
  previousSet,
  target,
  onChange,
}: CardioSetInputsProps) {
  const uid = useId();
  const config = cardioActivityConfig(activity);
  const metres = config.distanceUnit === 'm';

  const initialSec = set.duration ?? 0;
  const [min, setMin] = useState(initialSec > 0 ? String(Math.floor(initialSec / 60)) : '');
  const [sec, setSec] = useState(initialSec > 0 ? String(initialSec % 60).padStart(2, '0') : '');
  const [dist, setDist] = useState(() => {
    const km = set.distanceKm ?? 0;
    if (km <= 0) return '';
    return metres ? String(Math.round(km * 1000)) : String(Number(km.toFixed(2)));
  });
  const [incline, setIncline] = useState(set.inclinePct ? String(set.inclinePct) : '');

  const writeTime = (m: string, s: string) => {
    const total = Number(m || 0) * 60 + Math.min(59, Number(s || 0));
    onChange({ duration: total > 0 ? total : undefined });
  };

  const writeDistance = (text: string) => {
    const n = parseDecimal(text);
    onChange({ distanceKm: n === null ? undefined : metres ? n / 1000 : n });
  };

  const pace = cardioPace(activity, set.distanceKm, set.duration);
  const prevDist = cardioDistance(activity, previousSet?.distanceKm);
  const prevTime = previousSet?.duration ? formatClock(previousSet.duration) : null;

  const targetDist = cardioDistance(activity, target?.distanceKm);
  const targetMin = target?.durationSec ? Math.round(target.durationSec / 60) : null;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {(targetMin || targetDist) && (
        <p
          style={{
            margin: 0,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 22%, transparent)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-accent-2)',
          }}
        >
          היעד:{' '}
          {targetMin && (
            <>
              <span className="kinetic-number">{targetMin}</span> דקות
            </>
          )}
          {targetMin && targetDist && ' · '}
          {targetDist && (
            <>
              <span className="kinetic-number">{targetDist.value}</span> {targetDist.unit}
            </>
          )}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div role="group" aria-labelledby={`${uid}-time`} style={cardStyle}>
          <span id={`${uid}-time`} style={labelStyle}>
            זמן
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, direction: 'ltr' }}>
            <label style={{ flex: 1, display: 'grid', gap: 2 }}>
              <input
                style={bigInput}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                autoComplete="off"
                value={min}
                onChange={(e) => {
                  const v = digits(e.target.value, 3);
                  setMin(v);
                  writeTime(v, sec);
                }}
              />
              <span style={unitStyle}>דקות</span>
            </label>
            <span aria-hidden="true" style={{ ...labelStyle, fontSize: 22, paddingBottom: 18 }}>
              :
            </span>
            <label style={{ flex: 1, display: 'grid', gap: 2 }}>
              <input
                style={bigInput}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="00"
                autoComplete="off"
                value={sec}
                onChange={(e) => {
                  const v = digits(e.target.value, 2);
                  setSec(v);
                  writeTime(min, v);
                }}
              />
              <span style={unitStyle}>שניות</span>
            </label>
          </div>
        </div>

        <div style={cardStyle}>
          <label htmlFor={`${uid}-dist`} style={labelStyle}>
            מרחק{config.distanceMatters ? '' : ' (לא חובה)'}
          </label>
          <input
            id={`${uid}-dist`}
            style={bigInput}
            dir="ltr"
            inputMode="decimal"
            placeholder={metres ? '500' : '0.0'}
            autoComplete="off"
            value={dist}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, '');
              setDist(v);
              writeDistance(v);
            }}
          />
          <span style={unitStyle}>{metres ? UNIT_M : UNIT_KM}</span>
        </div>
      </div>

      {config.incline && (
        <div style={{ ...cardStyle, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
          <label htmlFor={`${uid}-inc`} style={labelStyle}>
            שיפוע (לא חובה)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
            <input
              id={`${uid}-inc`}
              style={{ ...bigInput, width: 84, fontSize: 20, minHeight: 44 }}
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              value={incline}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.,]/g, '');
                setIncline(v);
                const n = parseDecimal(v);
                onChange({ inclinePct: n === null ? undefined : Math.min(40, n) });
              }}
            />
            <span style={unitStyle}>%</span>
          </div>
        </div>
      )}

      {(pace || prevDist || prevTime) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '4px 14px',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 20%, transparent)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-ink)',
          }}
        >
          {pace && (
            <span>
              {config.paceStyle === 'speed' ? 'מהירות' : 'קצב'}{' '}
              <span className="kinetic-number" style={{ fontWeight: 700 }}>
                {pace.value}
              </span>{' '}
              {pace.unit}
            </span>
          )}
          {(prevDist || prevTime) && (
            <span style={{ color: 'var(--fs-link)' }}>
              פעם קודמת:{' '}
              {prevDist && (
                <>
                  <span className="kinetic-number">{prevDist.value}</span> {prevDist.unit}
                </>
              )}
              {prevDist && prevTime && ' · '}
              {prevTime && <span className="kinetic-number">{prevTime}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default CardioSetInputs;
