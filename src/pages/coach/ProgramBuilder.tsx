// ============================================================================
// PROGRAM BUILDER — coach assembles a multi-day program for one client
// ============================================================================
// Rendered as a foundation <Sheet> (focus trap, scroll lock, Esc, RTL chrome)
// instead of the former hardcoded z-index:9999 full-screen overlay.

import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { createAssignment, upsertClientTemplate } from '../../services/coach';
import { getPersonalExercises } from '../../services/exerciseDb';
import type { PersonalExercise, WorkoutTemplate, WorkoutTemplateExercise } from '../../types';

interface ProgramExercise {
  exerciseName: string;
  /** Canonical library id when the name matches a known exercise, else ''. */
  exerciseId: string;
  targetMuscle: string;
  sets: number;
  reps: number;
}

interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

const freshDays = (): ProgramDay[] => [{ name: 'יום A', exercises: [] }];

export default function ProgramBuilder({
  clientId,
  isOpen,
  onClose,
}: { clientId: string; isOpen: boolean; onClose: () => void }) {
  const [programName, setProgramName] = useState('');
  const [days, setDays] = useState<ProgramDay[]>(freshDays);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<PersonalExercise[]>([]);

  // Fresh form each time the sheet opens — matches the previous unmount-on-close
  // behaviour now that the component stays mounted for enter/exit animations.
  useEffect(() => {
    if (isOpen) {
      setProgramName('');
      setDays(freshDays());
    }
  }, [isOpen]);

  // Pull the canonical exercise library (built-ins are seeded on first read) so
  // the coach picks real exercises instead of typing free-text with empty ids.
  useEffect(() => {
    if (!isOpen || library.length > 0) return;
    let cancelled = false;
    getPersonalExercises()
      .then((list) => {
        if (!cancelled) setLibrary(list);
      })
      .catch(() => {
        /* library is an optional aid; free-text still works if it fails */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, library.length]);

  const libraryByName = useMemo(() => {
    const map = new Map<string, PersonalExercise>();
    for (const ex of library) if (ex.name) map.set(ex.name.toLowerCase(), ex);
    return map;
  }, [library]);

  const addDay = () =>
    setDays((d) => [...d, { name: `יום ${String.fromCharCode(65 + d.length)}`, exercises: [] }]);

  const removeDay = (i: number) => setDays((d) => d.filter((_, idx) => idx !== i));

  const updateDayName = (i: number, name: string) =>
    setDays((d) => d.map((day, idx) => (idx === i ? { ...day, name } : day)));

  const addExercise = (dayIdx: number) =>
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                { exerciseName: '', exerciseId: '', targetMuscle: '', sets: 3, reps: 10 },
              ],
            }
          : day
      )
    );

  const removeExercise = (dayIdx: number, exIdx: number) =>
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx ? { ...day, exercises: day.exercises.filter((_, ei) => ei !== exIdx) } : day
      )
    );

  const updateExercise = (dayIdx: number, exIdx: number, patch: Partial<ProgramExercise>) =>
    setDays((d) =>
      d.map((day, di) =>
        di === dayIdx
          ? {
              ...day,
              exercises: day.exercises.map((ex, ei) => (ei === exIdx ? { ...ex, ...patch } : ex)),
            }
          : day
      )
    );

  // Resolve a typed/picked name against the library: fills the canonical id and
  // target muscle when it matches a known exercise, clearing them otherwise.
  const setExerciseName = (dayIdx: number, exIdx: number, name: string) => {
    const match = libraryByName.get(name.trim().toLowerCase());
    updateExercise(dayIdx, exIdx, {
      exerciseName: name,
      exerciseId: match?.id ?? '',
      targetMuscle: match?.muscleGroup ?? match?.targetMuscle ?? '',
    });
  };

  const buildTemplate = (day: ProgramDay): WorkoutTemplate => {
    const exercises: WorkoutTemplateExercise[] = (day.exercises ?? []).map((ex, i) => ({
      id: crypto.randomUUID(),
      exerciseId: ex.exerciseId ?? '',
      exerciseName: ex.exerciseName ?? '',
      targetMuscle: ex.targetMuscle ?? '',
      targetSets: ex.sets ?? 3,
      targetReps: ex.reps ?? 10,
      targetWeight: null,
      restSeconds: 60,
      order: i,
      notes: '',
      sets: Array.from({ length: ex.sets ?? 3 }, () => ({ reps: ex.reps ?? 10, weight: 0 })),
    }));
    return {
      id: crypto.randomUUID(),
      name: day.name,
      description: programName || '',
      exercises,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    };
  };

  const handleAssign = async () => {
    if (days.length === 0) return;
    setBusy(true);
    try {
      // Persist one runnable template per day…
      const dayRefs: { templateId: string; name: string }[] = [];
      for (const day of days) {
        const tpl = buildTemplate(day);
        await upsertClientTemplate(clientId, tpl);
        dayRefs.push({ templateId: tpl.id, name: tpl.name });
      }
      // …but surface the whole week as ONE program assignment so the trainee
      // sees a structured plan, not N independent "התחל אימון" rows. templateId
      // points at the first day for backward-compatible single-start fallback.
      await createAssignment({
        kind: 'program',
        title: programName || 'תוכנית אימון',
        templateId: dayRefs[0]?.templateId ?? null,
        clientId,
        payload: { programName: programName || 'תוכנית אימון', days: dayRefs },
      });
      showToast('התוכנית שויכה', 'success');
      onClose();
    } catch {
      showToast('שיוך התוכנית נכשל', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="בניית תוכנית"
      footer={
        <Button variant="primary" fullWidth isLoading={busy} onClick={handleAssign}>
          שייך תוכנית
        </Button>
      }
    >
      <datalist id="coach-exercise-library">
        {library.map((ex) => (
          <option key={ex.id} value={ex.name ?? ''}>
            {ex.name ?? ''}
          </option>
        ))}
      </datalist>

      <div className="mb-4">
        <Input
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="שם התוכנית (אופציונלי)"
          aria-label="שם התוכנית"
        />
      </div>

      {days.map((day, dayIdx) => (
        <section
          // biome-ignore lint/suspicious/noArrayIndexKey: days are append/remove without stable IDs
          key={dayIdx}
          className="mb-5 p-4"
          style={{ background: 'var(--fs-bg)', border: '1px solid var(--fs-surface-2)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <Input
                value={day.name}
                onChange={(e) => updateDayName(dayIdx, e.target.value)}
                aria-label="שם היום"
              />
            </div>
            {days.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeDay(dayIdx)}
                aria-label="הסר יום"
                className="shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>

          {day.exercises.map((ex, exIdx) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: exercises are append/remove without stable IDs
              key={exIdx}
              className="flex items-center gap-2 mb-2"
            >
              <div className="flex-1 min-w-0">
                <Input
                  list="coach-exercise-library"
                  value={ex.exerciseName}
                  onChange={(e) => setExerciseName(dayIdx, exIdx, e.target.value)}
                  placeholder="שם תרגיל"
                  aria-label="שם תרגיל"
                />
              </div>
              <div style={{ width: 60 }} className="shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={ex.sets}
                  onChange={(e) =>
                    updateExercise(dayIdx, exIdx, { sets: Number(e.target.value) || 1 })
                  }
                  aria-label="סטים"
                />
              </div>
              <span style={{ color: 'var(--fs-muted)', fontSize: 12 }} aria-hidden="true">
                ×
              </span>
              <div style={{ width: 60 }} className="shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={ex.reps}
                  onChange={(e) =>
                    updateExercise(dayIdx, exIdx, { reps: Number(e.target.value) || 1 })
                  }
                  aria-label="חזרות"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeExercise(dayIdx, exIdx)}
                aria-label="הסר תרגיל"
                className="shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => addExercise(dayIdx)}
            className="mt-2"
          >
            הוסף תרגיל
          </Button>
        </section>
      ))}

      <Button
        variant="secondary"
        fullWidth
        icon={<Plus size={16} />}
        onClick={addDay}
        className="mb-2"
      >
        הוסף יום
      </Button>
    </Sheet>
  );
}
