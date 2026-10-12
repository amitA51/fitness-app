// ============================================================================
// CardioEntryForm — the fields of one cardio effort, shared by the log page
// and the live tracker's "finish" step.
// ============================================================================
// Time is the only required field. Distance is asked for up front where it is
// the headline (a run) and tucked away where it means little (elliptical).
// Everything a watch shows — heart rate, calories, climb — lives behind
// "פרטים מהשעון" so the common case stays two fields and a save.

import { ChevronDown, ChevronUp } from 'lucide-react';
import { type FormEvent, memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CardioActivity, RunType } from '../../../types';
import {
  CARDIO_ACTIVITIES,
  RUN_TYPES,
  RUN_TYPE_LABELS,
  UNIT_KM,
  UNIT_M,
  cardioActivityConfig,
  cardioPace,
  estimateCardioCalories,
  parseDecimal,
} from '../../../utils/cardio';
import { toLocalDateStr } from '../../../utils/dateUtils';
import {
  DurationField,
  type DurationParts,
  EMPTY_DURATION,
  durationPartsToSec,
} from './DurationField';

/** Perceived effort, five plain steps mapped onto the 1–10 RPE scale. */
const EFFORT_LEVELS: readonly { value: number; label: string }[] = [
  { value: 2, label: 'קל מאוד' },
  { value: 4, label: 'קל' },
  { value: 6, label: 'בינוני' },
  { value: 8, label: 'קשה' },
  { value: 10, label: 'מקסימלי' },
];

export interface CardioFormValues {
  /** End of the effort (date + time) — only collected with `showWhen`. */
  endTime: Date | null;
  durationSec: number;
  distanceKm: number | null;
  effort: number | null;
  runType: RunType | null;
  avgHr: number | null;
  maxHr: number | null;
  inclinePct: number | null;
  elevationGainM: number | null;
  calories: number | null;
  notes: string;
}

export interface CardioFormInitial {
  durationParts?: DurationParts;
  /** Distance already measured (GPS), in km. */
  distanceKm?: number | null;
  elevationGainM?: number | null;
}

interface CardioEntryFormProps {
  activity: CardioActivity;
  /** When given, the activity can be changed from the form. */
  onActivityChange?: (activity: CardioActivity) => void;
  /** Ask when the effort happened (date + finish time). */
  showWhen: boolean;
  initial?: CardioFormInitial;
  weightKg: number | null;
  submitLabel: string;
  saving: boolean;
  saveError: string | null;
  onSubmit: (values: CardioFormValues) => void;
  /** Optional secondary action under the save button (e.g. discard). */
  secondary?: { label: string; onClick: () => void };
}

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Typed distance in the activity's unit → km. */
function distanceToKm(text: string, unit: 'km' | 'm'): number | null {
  const n = parseDecimal(text);
  if (n === null) return null;
  return unit === 'm' ? n / 1000 : n;
}

/** Initial distance text in the activity's unit. */
function distanceText(km: number | null | undefined, unit: 'km' | 'm'): string {
  if (!km || km <= 0) return '';
  return unit === 'm' ? String(Math.round(km * 1000)) : String(Number(km.toFixed(2)));
}

function optionalInt(text: string): number | null {
  const n = parseDecimal(text);
  return n === null ? null : Math.round(n);
}

interface Errors {
  duration?: string;
  distance?: string;
  when?: string;
  avgHr?: string;
  maxHr?: string;
  incline?: string;
}

export const CardioEntryForm = memo(function CardioEntryForm({
  activity,
  onActivityChange,
  showWhen,
  initial,
  weightKg,
  submitLabel,
  saving,
  saveError,
  onSubmit,
  secondary,
}: CardioEntryFormProps) {
  const uid = useId();
  const config = cardioActivityConfig(activity);
  const unit = config.distanceUnit;

  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [time, setTime] = useState(nowTime);
  const [duration, setDuration] = useState<DurationParts>(initial?.durationParts ?? EMPTY_DURATION);
  const [distance, setDistance] = useState(() => distanceText(initial?.distanceKm, unit));
  const [effort, setEffort] = useState<number | null>(null);
  const [runType, setRunType] = useState<RunType | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [avgHr, setAvgHr] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [incline, setIncline] = useState('');
  const [elevation, setElevation] = useState(() =>
    initial?.elevationGainM ? String(Math.round(initial.elevationGainM)) : ''
  );
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  // Switching between a km activity and a metre one (run → swim) converts the
  // typed distance instead of silently reading "5" km as 5 m.
  const prevUnit = useRef(unit);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the unit flip is the trigger; `distance` is read at that moment, not on every keystroke
  useEffect(() => {
    if (prevUnit.current === unit) return;
    const km = distanceToKm(distance, prevUnit.current);
    prevUnit.current = unit;
    setDistance(distanceText(km, unit));
  }, [unit]);

  const durationSec = durationPartsToSec(duration);
  const distanceKm = distanceToKm(distance, unit);
  const pace = cardioPace(activity, distanceKm, durationSec);
  const estimate = useMemo(
    () =>
      estimateCardioCalories({
        activity,
        durationSec,
        distanceKm,
        inclinePct: parseDecimal(incline),
        elevationGainM: parseDecimal(elevation),
        effort,
        weightKg,
      }),
    [activity, durationSec, distanceKm, incline, elevation, effort, weightKg]
  );

  const distanceField = (
    <div className="cardio-field">
      <label className="cardio-label" htmlFor={`${uid}-dist`}>
        מרחק{config.distanceMatters ? '' : ' (לא חובה)'}
      </label>
      <div className="cardio-unit-input" dir="ltr">
        <input
          id={`${uid}-dist`}
          className={`input${errors.distance ? ' input-error' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={unit === 'm' ? '1500' : '5.0'}
          value={distance}
          aria-invalid={errors.distance ? true : undefined}
          aria-describedby={errors.distance ? `${uid}-dist-err` : undefined}
          onChange={(e) => {
            setDistance(e.target.value.replace(/[^\d.,]/g, ''));
            if (errors.distance) setErrors((er) => ({ ...er, distance: undefined }));
          }}
        />
        <span className="cardio-unit">{unit === 'm' ? UNIT_M : UNIT_KM}</span>
      </div>
      {errors.distance && (
        <p id={`${uid}-dist-err`} className="cardio-error" role="alert">
          {errors.distance}
        </p>
      )}
    </div>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (durationSec === null) next.duration = 'כמה זמן נמשכה הפעילות?';
    else if (durationSec > 24 * 3600) next.duration = 'עד 24 שעות לפעילות אחת';
    if (distance.trim() !== '' && distanceKm === null) next.distance = 'המרחק לא תקין';
    const hr = optionalInt(avgHr);
    const hrMax = optionalInt(maxHr);
    if (avgHr.trim() !== '' && (hr === null || hr < 30 || hr > 230))
      next.avgHr = 'דופק בין 30 ל־230';
    if (maxHr.trim() !== '' && (hrMax === null || hrMax < 30 || hrMax > 230))
      next.maxHr = 'דופק בין 30 ל־230';
    // 0% is a valid answer (a flat treadmill) — it just stores nothing.
    const incText = incline.trim().replace(',', '.');
    const incOk = incText === '' || (/^\d+(\.\d+)?$/.test(incText) && Number(incText) <= 40);
    const inc = parseDecimal(incline);
    if (!incOk) next.incline = 'שיפוע בין 0 ל־40';

    let endTime: Date | null = null;
    if (showWhen) {
      endTime = new Date(`${date}T${time || '00:00'}`);
      if (Number.isNaN(endTime.getTime())) next.when = 'התאריך או השעה לא תקינים';
      else if (endTime.getTime() > Date.now() + 5 * 60 * 1000) next.when = 'השעה הזאת עוד לא הגיעה';
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || durationSec === null) {
      if (next.avgHr || next.maxHr || next.incline) setShowMore(true);
      return;
    }

    onSubmit({
      endTime,
      durationSec,
      distanceKm,
      effort,
      runType: config.runTypes ? runType : null,
      avgHr: hr,
      maxHr: hrMax,
      inclinePct: config.incline ? inc : null,
      elevationGainM: config.elevation ? parseDecimal(elevation) : null,
      calories: optionalInt(calories),
      notes,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="page-stack" style={{ gap: 20 }}>
      {onActivityChange && (
        <div className="cardio-field">
          <label className="cardio-label" htmlFor={`${uid}-act`}>
            פעילות
          </label>
          <select
            id={`${uid}-act`}
            className="input"
            value={activity}
            onChange={(e) => onActivityChange(e.target.value as CardioActivity)}
          >
            {CARDIO_ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showWhen && (
        <div className="cardio-field">
          <div className="cardio-row">
            <div className="cardio-field">
              <label className="cardio-label" htmlFor={`${uid}-date`}>
                תאריך
              </label>
              <input
                id={`${uid}-date`}
                type="date"
                className={`input${errors.when ? ' input-error' : ''}`}
                value={date}
                max={toLocalDateStr(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="cardio-field">
              <label className="cardio-label" htmlFor={`${uid}-time`}>
                שעת סיום
              </label>
              <input
                id={`${uid}-time`}
                type="time"
                className={`input${errors.when ? ' input-error' : ''}`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {errors.when && (
            <p className="cardio-error" role="alert">
              {errors.when}
            </p>
          )}
        </div>
      )}

      <DurationField
        label="זמן"
        value={duration}
        onChange={(next) => {
          setDuration(next);
          // A fixed field stops shouting as soon as it is fixed, not on the next save.
          if (errors.duration) setErrors((e) => ({ ...e, duration: undefined }));
        }}
        error={errors.duration}
      />

      {config.distanceMatters && distanceField}

      {(pace || estimate !== null) && (
        <div className="cardio-preview" aria-live="polite">
          {pace && (
            <span>
              {config.paceStyle === 'speed' ? 'מהירות' : 'קצב'}{' '}
              <strong className="kinetic-number">{pace.value}</strong> {pace.unit}
            </span>
          )}
          {estimate !== null && (
            <span>
              <strong className="kinetic-number">{estimate}</strong> קלוריות (הערכה)
            </span>
          )}
        </div>
      )}

      <div className="cardio-field" role="group" aria-labelledby={`${uid}-effort`}>
        <span id={`${uid}-effort`} className="cardio-label">
          כמה זה היה קשה?
        </span>
        <div className="cardio-chips">
          {EFFORT_LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              type="button"
              className="cardio-chip focus-ring"
              aria-pressed={effort === lvl.value}
              onClick={() => setEffort(effort === lvl.value ? null : lvl.value)}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {config.runTypes && (
        <div className="cardio-field" role="group" aria-labelledby={`${uid}-runtype`}>
          <span id={`${uid}-runtype`} className="cardio-label">
            סוג הריצה (לא חובה)
          </span>
          <div className="cardio-chips">
            {RUN_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                className="cardio-chip focus-ring"
                aria-pressed={runType === rt}
                onClick={() => setRunType(runType === rt ? null : rt)}
              >
                {RUN_TYPE_LABELS[rt]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cardio-field">
        <button
          type="button"
          className="cardio-more focus-ring"
          aria-expanded={showMore}
          aria-controls={`${uid}-more`}
          onClick={() => setShowMore((v) => !v)}
        >
          פרטים מהשעון (לא חובה)
          {showMore ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </button>
        {showMore && (
          <div id={`${uid}-more`} className="page-stack" style={{ gap: 16 }}>
            {!config.distanceMatters && distanceField}
            <div className="cardio-row">
              <NumberField
                id={`${uid}-hr`}
                label="דופק ממוצע"
                unit="bpm"
                value={avgHr}
                onChange={setAvgHr}
                error={errors.avgHr}
              />
              <NumberField
                id={`${uid}-hrmax`}
                label="דופק מרבי"
                unit="bpm"
                value={maxHr}
                onChange={setMaxHr}
                error={errors.maxHr}
              />
            </div>
            <div className="cardio-row">
              <NumberField
                id={`${uid}-kcal`}
                label="קלוריות מהשעון"
                unit="קק״ל"
                value={calories}
                onChange={setCalories}
              />
              {config.incline && (
                <NumberField
                  id={`${uid}-inc`}
                  label="שיפוע"
                  unit="%"
                  value={incline}
                  onChange={setIncline}
                  error={errors.incline}
                  decimal
                />
              )}
              {config.elevation && (
                <NumberField
                  id={`${uid}-elev`}
                  label="עלייה מצטברת"
                  unit={UNIT_M}
                  value={elevation}
                  onChange={setElevation}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="cardio-field">
        <label className="cardio-label" htmlFor={`${uid}-notes`}>
          הערות (לא חובה)
        </label>
        <textarea
          id={`${uid}-notes`}
          className="input"
          rows={2}
          maxLength={500}
          dir="auto"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="cardio-actions">
        {saveError && (
          <p className="cardio-error" role="alert">
            {saveError}
          </p>
        )}
        <button type="submit" className="start-workout-btn focus-ring" disabled={saving}>
          {saving ? 'שומרים…' : submitLabel}
        </button>
        {secondary && (
          <button type="button" className="cta-ghost focus-ring" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </div>
    </form>
  );
});

interface NumberFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  decimal?: boolean;
}

const NumberField = memo(function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  error,
  decimal = false,
}: NumberFieldProps) {
  return (
    <div className="cardio-field">
      <label className="cardio-label" htmlFor={id}>
        {label}
      </label>
      <div className="cardio-unit-input" dir="ltr">
        <input
          id={id}
          className={`input${error ? ' input-error' : ''}`}
          inputMode={decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, ''))}
        />
        <span className="cardio-unit">{unit}</span>
      </div>
      {error && (
        <p id={`${id}-err`} className="cardio-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
