// ============================================================================
// COACH — edit/create a trainee workout session (Fresh Steel / Obsidian)
// ============================================================================
// A LEAN session editor (not a full workout logger): title, date, duration in
// minutes, notes, plus a per-exercise list of editable set rows (reps × weight)
// with add/remove. On save it recomputes totalVolume (Σ reps×weight) and writes
// via the audited coach writers. Labels ABOVE inputs, numbers dir="ltr".

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Input } from '../../../components/ui/Input';
import { Sheet } from '../../../components/ui/Sheet';
import { Textarea } from '../../../components/ui/Textarea';
import { createClientSession, updateClientSession } from '../../../services/coach';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../../types';
import { todayStr } from '../../../utils/dateUtils';
import { generateId } from '../../../utils/id';

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
}

interface EditableExercise {
  id: string;
  name: string;
  sets: EditableSet[];
}

const blankSet = (): EditableSet => ({ id: generateId('set'), reps: '', weight: '' });

const toEditableExercises = (session?: WorkoutSession): EditableExercise[] =>
  (session?.exercises ?? []).map((ex) => ({
    id: ex.id || generateId('ex'),
    name: ex.exerciseName || ex.name || '',
    sets:
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            id: s.id || generateId('set'),
            reps: s.reps ? String(s.reps) : '',
            weight: s.weight ? String(s.weight) : '',
          }))
        : [blankSet()],
  }));

/** Build the canonical exercises array (full WorkoutSet shape) from the editor state. */
const buildExercises = (exercises: EditableExercise[]): WorkoutExercise[] =>
  exercises
    .filter((ex) => ex.name.trim())
    .map((ex, order) => {
      const sets: WorkoutSet[] = ex.sets.map((s, i) => ({
        id: s.id,
        setNumber: i + 1,
        reps: Number(s.reps) || 0,
        weight: Number(s.weight) || 0,
        rpe: null,
        isWarmup: false,
        isCompleted: true,
        notes: '',
        completedAt: null,
      }));
      return {
        id: ex.id,
        exerciseId: ex.id,
        exerciseName: ex.name.trim(),
        targetMuscle: '',
        sets,
        notes: '',
        restSeconds: 0,
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
  const [durationMin, setDurationMin] = useState(
    initial?.duration ? String(Math.round(initial.duration / SECONDS_PER_MINUTE)) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [exercises, setExercises] = useState<EditableExercise[]>(() =>
    toEditableExercises(initial)
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initial?.notes ?? '');
    setDate(initial?.date ?? todayStr());
    setDurationMin(
      initial?.duration ? String(Math.round(initial.duration / SECONDS_PER_MINUTE)) : ''
    );
    setNotes(initial?.notes ?? '');
    setExercises(toEditableExercises(initial));
    setError(null);
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
    setBusy(true);
    try {
      const builtExercises = buildExercises(exercises);
      const durationSeconds = durationMin ? Number(durationMin) * SECONDS_PER_MINUTE : 0;
      const patch: Partial<WorkoutSession> = {
        notes: title.trim() || notes.trim() || '',
        date,
        duration: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        exercises: builtExercises,
      };
      const res = initial?.id
        ? await updateClientSession(clientId, initial.id, patch)
        : await createClientSession(clientId, {
            ...patch,
            startTime: `${date}T00:00:00.000Z`,
            endTime: `${date}T00:00:00.000Z`,
          });
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
          {exercises.map((ex) => (
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
          ))}
        </div>

        <Button variant="secondary" fullWidth onClick={addExercise}>
          <Plus size={16} aria-hidden="true" /> הוספת תרגיל
        </Button>

        <Textarea
          label="הערות"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          aria-label="הערות לאימון"
          placeholder="לא חובה"
        />
      </div>
    </Sheet>
  );
}

export default EditSessionSheet;
