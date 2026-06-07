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
import {
  listProgramTemplates,
  saveProgramTemplate,
} from '../../services/coach/programTemplateService';
import { getPersonalExercises } from '../../services/exerciseDb';
import type { PersonalExercise, WorkoutTemplate, WorkoutTemplateExercise } from '../../types';
import type { CoachProgramTemplate } from '../../types/coach';

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
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [library, setLibrary] = useState<PersonalExercise[]>([]);
  const [libraryError, setLibraryError] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [templates, setTemplates] = useState<CoachProgramTemplate[]>([]);

  // Fresh form each time the sheet opens — matches the previous unmount-on-close
  // behaviour now that the component stays mounted for enter/exit animations.
  useEffect(() => {
    if (isOpen) {
      setProgramName('');
      setDays(freshDays());
      setSubmitError('');
      setLibraryError(false);
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
        if (!cancelled) setLibraryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, library.length]);

  // Lazy-load program templates when the sheet opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listProgramTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        // Silent failure — template picker simply won't render.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const libraryByName = useMemo(() => {
    const map = new Map<string, PersonalExercise>();
    for (const ex of library) if (ex.name) map.set(ex.name.toLowerCase(), ex);
    return map;
  }, [library]);

  // Validation: every day must have a non-empty name AND the whole program must
  // have at least one exercise with a non-empty name; no day may be completely empty.
  const canAssign = useMemo(() => {
    if (days.length === 0) return false;
    const allNamed = days.every((d) => d.name.trim().length > 0);
    const hasExercise = days.some((d) =>
      d.exercises.some((ex) => ex.exerciseName.trim().length > 0)
    );
    const noDayEmpty = days.every((d) => d.exercises.length > 0);
    return allNamed && hasExercise && noDayEmpty;
  }, [days]);

  const addDay = () => {
    setSubmitError('');
    setDays((d) => [...d, { name: `יום ${String.fromCharCode(65 + d.length)}`, exercises: [] }]);
  };

  const removeDay = (i: number) => {
    setSubmitError('');
    setDays((d) => d.filter((_, idx) => idx !== i));
  };

  const updateDayName = (i: number, name: string) => {
    setSubmitError('');
    setDays((d) => d.map((day, idx) => (idx === i ? { ...day, name } : day)));
  };

  const addExercise = (dayIdx: number) => {
    setSubmitError('');
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
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    setSubmitError('');
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx ? { ...day, exercises: day.exercises.filter((_, ei) => ei !== exIdx) } : day
      )
    );
  };

  const updateExercise = (dayIdx: number, exIdx: number, patch: Partial<ProgramExercise>) => {
    setSubmitError('');
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
  };

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
    if (!canAssign) {
      setSubmitError('יש להוסיף לפחות תרגיל אחד ושם לכל יום');
      return;
    }
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

  const handleSaveToLibrary = async () => {
    setSavingTemplate(true);
    try {
      await saveProgramTemplate({
        name: programName.trim() || 'תוכנית ללא שם',
        days,
      });
      showToast('התבנית נשמרה בספרייה', 'success');
      // Refresh local templates list so the picker stays in sync.
      const updated = await listProgramTemplates();
      setTemplates(updated);
    } catch {
      showToast('שמירת התבנית נכשלה', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    // Deep-copy so edits never mutate the cached template object.
    setDays(structuredClone(tpl.days));
    setProgramName(tpl.name);
    setSubmitError('');
    // Reset select back to placeholder.
    e.target.value = '';
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="בניית תוכנית"
      footer={
        <>
          {submitError && (
            <div
              role="alert"
              style={{
                color: 'var(--fs-warn)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              {submitError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              fullWidth
              isLoading={savingTemplate}
              onClick={handleSaveToLibrary}
              disabled={!canAssign || busy || savingTemplate}
            >
              שמור בספרייה
            </Button>
            <Button
              variant="primary"
              fullWidth
              isLoading={busy}
              onClick={handleAssign}
              disabled={!canAssign || busy || savingTemplate}
            >
              שייך תוכנית
            </Button>
          </div>
        </>
      }
    >
      <datalist id="coach-exercise-library">
        {library.map((ex) => (
          <option key={ex.id} value={ex.name ?? ''}>
            {ex.name ?? ''}
          </option>
        ))}
      </datalist>

      {templates.length > 0 && (
        <div className="mb-4">
          <label
            htmlFor="program-template-select"
            style={{
              display: 'block',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 6,
            }}
          >
            תבנית שמורה
          </label>
          <select
            id="program-template-select"
            dir="rtl"
            onChange={handleTemplateSelect}
            defaultValue=""
            style={{
              width: '100%',
              minHeight: 44,
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              padding: '0 12px',
              borderRadius: 4,
              appearance: 'auto',
            }}
          >
            <option value="">בחירת תבנית…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <Input
          label="שם התוכנית"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="אופציונלי"
        />
      </div>

      {libraryError && (
        <p
          style={{
            color: 'var(--fs-muted)',
            fontSize: 12,
            marginBottom: 8,
            fontFamily: 'var(--font-body)',
          }}
        >
          ספריית התרגילים לא נטענה — אפשר להקליד שם תרגיל ידנית
        </p>
      )}

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
              <div style={{ width: 72, minHeight: 44 }} className="shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
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
              <div style={{ width: 72, minHeight: 44 }} className="shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
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
