import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/workout/components/ui/Toast';
import { createAssignment, upsertClientTemplate } from '../../services/coach';
import type { WorkoutTemplate, WorkoutTemplateExercise } from '../../types';

interface ProgramExercise {
  exerciseName: string;
  sets: number;
  reps: number;
}

interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

export default function ProgramBuilder({
  clientId,
  onClose,
}: { clientId: string; onClose: () => void }) {
  const [programName, setProgramName] = useState('');
  const [days, setDays] = useState<ProgramDay[]>([{ name: 'יום A', exercises: [] }]);
  const [busy, setBusy] = useState(false);

  const addDay = () =>
    setDays((d) => [...d, { name: `יום ${String.fromCharCode(65 + d.length)}`, exercises: [] }]);

  const removeDay = (i: number) => setDays((d) => d.filter((_, idx) => idx !== i));

  const updateDayName = (i: number, name: string) =>
    setDays((d) => d.map((day, idx) => (idx === i ? { ...day, name } : day)));

  const addExercise = (dayIdx: number) =>
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx
          ? { ...day, exercises: [...day.exercises, { exerciseName: '', sets: 3, reps: 10 }] }
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

  const handleAssign = async () => {
    if (days.length === 0) return;
    setBusy(true);
    try {
      for (const day of days) {
        const exercises: WorkoutTemplateExercise[] = (day.exercises ?? []).map((ex, i) => ({
          id: crypto.randomUUID(),
          exerciseId: '',
          exerciseName: ex?.exerciseName ?? '',
          targetMuscle: '',
          targetSets: ex?.sets ?? 3,
          targetReps: ex?.reps ?? 10,
          targetWeight: null,
          restSeconds: 60,
          order: i,
          notes: '',
          sets: Array.from({ length: ex?.sets ?? 3 }, () => ({
            reps: ex?.reps ?? 10,
            weight: 0,
          })),
        }));

        const tpl: WorkoutTemplate = {
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

        await upsertClientTemplate(clientId, tpl);
        await createAssignment({
          kind: 'program',
          title: tpl.name,
          templateId: tpl.id,
          clientId,
        });
      }
      showToast('התוכנית שויכה', 'success');
      onClose();
    } catch {
      showToast('שיוך התוכנית נכשל', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      lang="he"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--fs-bg)',
        overflowY: 'auto',
      }}
    >
      <header
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: 'var(--fs-surface-2)',
            color: 'var(--fs-heading)',
          }}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--fs-heading)',
            margin: 0,
          }}
        >
          בניית תוכנית
        </h1>
      </header>

      <main className="px-5 py-5" style={{ paddingBottom: 96 }}>
        <input
          type="text"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="שם התוכנית (אופציונלי)"
          className="w-full mb-4 px-3 py-2"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
          }}
        />

        {days.map((day, dayIdx) => (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: days are append/remove without stable IDs
            key={dayIdx}
            className="mb-5 p-4"
            style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={day.name}
                onChange={(e) => updateDayName(dayIdx, e.target.value)}
                className="flex-1 px-2 py-1"
                style={{
                  background: 'var(--fs-surface-2)',
                  border: 'none',
                  color: 'var(--fs-heading)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
              {days.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDay(dayIdx)}
                  aria-label="הסר יום"
                  style={{
                    color: 'var(--fs-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {day.exercises.map((ex, exIdx) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: exercises are append/remove without stable IDs
                key={exIdx}
                className="flex items-center gap-2 mb-2"
              >
                <input
                  type="text"
                  value={ex.exerciseName}
                  onChange={(e) => updateExercise(dayIdx, exIdx, { exerciseName: e.target.value })}
                  placeholder="שם תרגיל"
                  className="flex-1 px-2 py-1"
                  style={{
                    background: 'var(--fs-surface-2)',
                    border: 'none',
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                  }}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={ex.sets}
                  onChange={(e) =>
                    updateExercise(dayIdx, exIdx, { sets: Number(e.target.value) || 1 })
                  }
                  className="w-12 px-1 py-1 text-center"
                  style={{
                    background: 'var(--fs-surface-2)',
                    border: 'none',
                    color: 'var(--fs-ink)',
                    fontSize: 13,
                  }}
                  aria-label="סטים"
                />
                <span style={{ color: 'var(--fs-muted)', fontSize: 12 }}>×</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={ex.reps}
                  onChange={(e) =>
                    updateExercise(dayIdx, exIdx, { reps: Number(e.target.value) || 1 })
                  }
                  className="w-12 px-1 py-1 text-center"
                  style={{
                    background: 'var(--fs-surface-2)',
                    border: 'none',
                    color: 'var(--fs-ink)',
                    fontSize: 13,
                  }}
                  aria-label="חזרות"
                />
                <button
                  type="button"
                  onClick={() => removeExercise(dayIdx, exIdx)}
                  aria-label="הסר תרגיל"
                  style={{
                    color: 'var(--fs-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addExercise(dayIdx)}
              className="flex items-center gap-1 mt-2"
              style={{
                color: 'var(--fs-heading)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> הוסף תרגיל
            </button>
          </section>
        ))}

        <button
          type="button"
          onClick={addDay}
          className="w-full py-2 mb-5 flex items-center justify-center gap-1"
          style={{
            border: '1.5px dashed var(--fs-surface-2)',
            background: 'transparent',
            color: 'var(--fs-heading)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> הוסף יום
        </button>

        <Button variant="primary" fullWidth isLoading={busy} onClick={handleAssign}>
          שייך תוכנית
        </Button>
      </main>
    </div>
  );
}
