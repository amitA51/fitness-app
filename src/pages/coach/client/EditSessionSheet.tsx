// ============================================================================
// COACH — edit/create a trainee workout session (Fresh Steel / Obsidian)
// ============================================================================
// A LEAN session editor (not a full workout logger): title, date, duration in
// minutes, plus a per-exercise list of editable set rows (reps × weight) with
// add/remove. The session model has a single `notes` column, so the editor shows
// one "כותרת" field that writes to it (no separate notes field that would
// silently collapse into the same column). On save it recomputes totalVolume
// (Σ reps×weight) and writes via the audited coach writers. Labels ABOVE inputs,
// numbers dir="ltr".
//
// Cardio (a run, a treadmill block) is READ-ONLY here: the row shows its
// time/distance and saves back exactly as the trainee logged it. Edited lifts
// keep every stored field the editor does not show (exercise id, RPE, warm-up,
// completion time), and an untouched date/duration keeps its exact stored value.

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CardioEffortLine } from '../../../components/cardio/CardioEffortLine';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import { Sheet } from '../../../components/ui/Sheet';
import { createClientSession, updateClientSession } from '../../../services/coach';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../../types';
import { type CardioEffort, cardioEffortOf, isCardioExercise } from '../../../utils/cardio';
import { todayStr } from '../../../utils/dateUtils';
import { generateId } from '../../../utils/id';
import { cardioExerciseName } from './sessionCardio';

interface EditSessionSheetProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pass an existing session to edit; omit to create a new one. */
  initial?: WorkoutSession;
}

const SECONDS_PER_MINUTE = 60;

/** A trimmed-down set the editor manipulates; mapped back to a full WorkoutSet on save. */
interface EditableSet {
  id: string;
  reps: string;
  weight: string;
  /** The stored set this row edits; undefined for a set the coach added. */
  source?: WorkoutSet;
}

interface EditableExercise {
  id: string;
  name: string;
  sets: EditableSet[];
  /** The stored exercise this row edits; undefined for an exercise the coach added. */
  source?: WorkoutExercise;
  /** Set for a cardio exercise — shown read-only and saved back unchanged. */
  cardio?: { effort: CardioEffort | null };
}

const blankSet = (): EditableSet => ({ id: generateId('set'), reps: '', weight: '' });

const minutesText = (seconds: number | undefined): string =>
  seconds ? String(Math.round(seconds / SECONDS_PER_MINUTE)) : '';

/**
 * Local-noon ISO timestamp for a picked YYYY-MM-DD date. UTC midnight
 * (`${date}T00:00:00.000Z`) is a FUTURE instant for an Israel coach logging
 * "today" before 02:00, rendering nonsense like "לפני -1 ימים"; local noon
 * stays inside the picked calendar day in any reasonable timezone.
 */
const localNoonIso = (dateStr: string): string => new Date(`${dateStr}T12:00:00`).toISOString();

export const toEditableExercises = (session?: WorkoutSession): EditableExercise[] =>
  (session?.exercises ?? []).map((ex) => {
    const id = ex.id || generateId('ex');
    if (isCardioExercise(ex)) {
      return {
        id,
        name: cardioExerciseName(ex),
        sets: [],
        source: ex,
        cardio: { effort: cardioEffortOf(ex) },
      };
    }
    return {
      id,
      name: ex.exerciseName || ex.name || '',
      source: ex,
      sets:
        ex.sets.length > 0
          ? ex.sets.map((s) => ({
              id: s.id || generateId('set'),
              reps: s.reps ? String(s.reps) : '',
              weight: s.weight ? String(s.weight) : '',
              source: s,
            }))
          : [blankSet()],
    };
  });

/** Defaults for a set / exercise the coach adds (nothing stored to keep). */
const NEW_SET: Omit<WorkoutSet, 'id' | 'setNumber' | 'reps' | 'weight' | 'isCompleted'> = {
  rpe: null,
  isWarmup: false,
  notes: '',
  completedAt: null,
};

/**
 * Build the canonical exercises array (full WorkoutSet shape) from the editor
 * state. `completedAt` stamps sets the coach ADDS — a logged set without one is
 * invisible to every completed-set reader (volume, PRs, "is this a lifting
 * session"), so a lift added to a run would not count as lifting.
 */
export const buildExercises = (
  exercises: EditableExercise[],
  completedAt: string = new Date().toISOString()
): WorkoutExercise[] =>
  exercises
    .filter((ex) => ex.cardio || ex.name.trim())
    .map((ex, order) => {
      // Cardio is not editable here — save it back exactly as logged.
      if (ex.cardio && ex.source) return { ...ex.source, order };
      const sets: WorkoutSet[] = ex.sets.map((s, i) => ({
        ...(s.source ?? NEW_SET),
        id: s.id,
        setNumber: i + 1,
        reps: Number(s.reps) || 0,
        weight: Number(s.weight) || 0,
        isCompleted: true,
        completedAt: s.source?.completedAt ?? completedAt,
      }));
      const name = ex.name.trim();
      // A renamed exercise is a DIFFERENT movement: keeping the old id / muscle /
      // program data would file squat sets under bench press in every chart.
      const sourceName = (ex.source?.exerciseName || ex.source?.name || '').trim();
      const renamed = !!ex.source && name !== sourceName;
      const base: Omit<WorkoutExercise, 'sets' | 'order'> =
        ex.source && !renamed
          ? ex.source
          : {
              id: ex.id,
              exerciseId: ex.id,
              exerciseName: name,
              targetMuscle: '',
              notes: ex.source?.notes ?? '',
              restSeconds: ex.source?.restSeconds ?? 0,
              isCompleted: true,
              ...(ex.source?.name !== undefined && { name }),
            };
      return {
        ...base,
        id: ex.id,
        exerciseName: name,
        ...(base.name !== undefined && { name }),
        sets,
        isCompleted: true,
        order,
      };
    });

export function EditSessionSheet({
  clientId,
  isOpen,
  onClose,
  onSaved,
  initial,
}: EditSessionSheetProps) {
  const [title, setTitle] = useState(initial?.notes ?? '');
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [durationMin, setDurationMin] = useState(minutesText(initial?.duration));
  const [exercises, setExercises] = useState<EditableExercise[]>(() =>
    toEditableExercises(initial)
  );
  const [error, setError] = useState<string | null>(null);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initial?.notes ?? '');
    setDate(initial?.date ?? todayStr());
    setDurationMin(minutesText(initial?.duration));
    setExercises(toEditableExercises(initial));
    setError(null);
    setExercisesError(null);
  }, [isOpen, initial]);

  const addExercise = () =>
    setExercises((prev) => [...prev, { id: generateId('ex'), name: '', sets: [blankSet()] }]);

  const removeExercise = (exId: string) =>
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));

  const setExerciseName = (exId: string, name: string) =>
    setExercises((prev) => prev.map((ex) => (ex.id === exId ? { ...ex, name } : ex)));

  const addSet = (exId: string) =>
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exId ? { ...ex, sets: [...ex.sets, blankSet()] } : ex))
    );

  const removeSet = (exId: string, setId: string) =>
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex
      )
    );

  const setSetField = (exId: string, setId: string, field: 'reps' | 'weight', value: string) =>
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );

  const save = async () => {
    if (!date) {
      setError('יש לבחור תאריך');
      return;
    }
    setError(null);
    const builtExercises = buildExercises(
      exercises,
      initial?.endTime ?? initial?.startTime ?? new Date().toISOString()
    );
    if (builtExercises.length === 0) {
      setExercisesError('יש להוסיף לפחות תרגיל אחד');
      return;
    }
    setExercisesError(null);
    setBusy(true);
    try {
      // An untouched duration keeps its exact seconds (a 28:40 run must not
      // become 29:00 because the coach fixed its title).
      const durationUnchanged = !!initial && durationMin === minutesText(initial.duration);
      const durationSeconds = durationUnchanged
        ? initial.duration
        : durationMin
          ? Number(durationMin) * SECONDS_PER_MINUTE
          : 0;
      // The chosen date drives the canonical start_time too — getClientSessions
      // orders/displays by start_time, so the edit must move it (matching create).
      // An unchanged date keeps the logged start/end times (a 06:30 run stays 06:30).
      // `notes` is the single session column; the coach writer mirrors it into the
      // title column, so the "כותרת" field maps straight to notes.
      const keepTimes = !!initial?.startTime && date === initial.date;
      const patch: Partial<WorkoutSession> = {
        notes: title.trim(),
        date,
        startTime: keepTimes ? initial.startTime : localNoonIso(date),
        endTime: keepTimes ? (initial.endTime ?? initial.startTime) : localNoonIso(date),
        duration: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        exercises: builtExercises,
      };
      const res = initial?.id
        ? await updateClientSession(clientId, initial.id, patch)
        : await createClientSession(clientId, patch);
      if (res.error) {
        showToast('השמירה נכשלה', 'error');
        return;
      }
      showToast('האימון נשמר', 'success');
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={initial?.id ? 'עריכת אימון' : 'הוספת אימון'}
      footer={
        <Button variant="primary" fullWidth isLoading={busy} onClick={save}>
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="כותרת"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לדוגמה: אימון רגליים"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="תאריך"
            type="date"
            dir="ltr"
            value={date}
            max={todayStr()}
            error={error ?? undefined}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="משך"
            type="number"
            inputMode="numeric"
            dir="ltr"
            unit="דק׳"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
          />
        </div>

        {/* Per-exercise editable set rows */}
        <div className="flex flex-col gap-3">
          {exercises.map((ex) =>
            ex.cardio ? (
              <CardioExerciseRow
                key={ex.id}
                name={ex.name}
                effort={ex.cardio.effort}
                onRemove={() => removeExercise(ex.id)}
              />
            ) : (
              <div
                key={ex.id}
                className="flex flex-col gap-2 p-3"
                style={{ border: '1px solid var(--fs-surface-2)', background: 'var(--fs-surface)' }}
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      label="תרגיל"
                      value={ex.name}
                      onChange={(e) => setExerciseName(ex.id, e.target.value)}
                      placeholder="שם התרגיל"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExercise(ex.id)}
                    aria-label="מחיקת תרגיל"
                    className="shrink-0"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                </div>

                {ex.sets.map((s, i) => (
                  <div key={s.id} className="flex items-end gap-2">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--fs-muted)',
                        minWidth: 24,
                        paddingBottom: 14,
                      }}
                      dir="ltr"
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <Input
                        label="חזרות"
                        type="number"
                        inputMode="numeric"
                        dir="ltr"
                        value={s.reps}
                        onChange={(e) => setSetField(ex.id, s.id, 'reps', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        label="משקל"
                        type="number"
                        inputMode="decimal"
                        dir="ltr"
                        unit='ק"ג'
                        value={s.weight}
                        onChange={(e) => setSetField(ex.id, s.id, 'weight', e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSet(ex.id, s.id)}
                      aria-label="מחיקת סט"
                      className="shrink-0"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                ))}

                <Button variant="secondary" size="sm" onClick={() => addSet(ex.id)}>
                  <Plus size={14} aria-hidden="true" /> הוספת סט
                </Button>
              </div>
            )
          )}
        </div>

        <Button variant="secondary" fullWidth onClick={addExercise}>
          <Plus size={16} aria-hidden="true" /> הוספת תרגיל
        </Button>

        {exercisesError && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--color-error)',
              margin: 0,
            }}
          >
            {exercisesError}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** A run / treadmill block: its time and distance, read-only, removable. */
function CardioExerciseRow({
  name,
  effort,
  onRemove,
}: {
  name: string;
  effort: CardioEffort | null;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 p-3"
      style={{ border: '1px solid var(--fs-surface-2)', background: 'var(--fs-surface)' }}
    >
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-ink)',
            margin: 0,
          }}
        >
          <bdi>{name}</bdi>
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            margin: '2px 0 0',
          }}
        >
          {effort ? <CardioEffortLine effort={effort} /> : 'לא תועדו זמן או מרחק'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`מחיקת ${name}`}
        className="shrink-0"
      >
        <Trash2 size={18} aria-hidden="true" />
      </Button>
    </div>
  );
}

export default EditSessionSheet;
