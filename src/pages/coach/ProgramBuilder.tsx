// ============================================================================
// PROGRAM BUILDER — coach assembles a multi-day program.
// Two modes: client mode (clientId set → "שייך תוכנית" assigns to that client)
// and library mode (no clientId → build + save to the coach's program library
// only; assignment happens from the client/group surfaces).
// ============================================================================
// Rendered as a foundation <Sheet> (focus trap, scroll lock, Esc, RTL chrome)
// instead of the former hardcoded z-index:9999 full-screen overlay.

import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import {
  assignProgramToGroup,
  createAssignment,
  scheduleProgramWeek,
  upsertClientTemplate,
} from '../../services/coach';
import {
  listProgramTemplates,
  saveProgramTemplate,
} from '../../services/coach/programTemplateService';
import { getPersonalExercises } from '../../services/exerciseDb';
import type { PersonalExercise, WorkoutTemplate, WorkoutTemplateExercise } from '../../types';
import type { CoachProgramTemplate, ProgramTemplateDay } from '../../types/coach';

interface ProgramExercise {
  exerciseName: string;
  /** Canonical library id when the name matches a known exercise, else ''. */
  exerciseId: string;
  targetMuscle: string;
  /** Raw string while editing — empties are allowed mid-edit; coerced in buildTemplate/validation. */
  sets: string;
  reps: string;
}

interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

const DEFAULT_SETS = '3';
const DEFAULT_REPS = '10';
/** Floor applied when a raw sets/reps field is blank or non-positive at build time. */
const MIN_COUNT = 1;
/** Scheduling step bounds — how many consecutive weeks a program may be placed for. */
const MIN_SCHEDULE_WEEKS = 1;
const MAX_SCHEDULE_WEEKS = 12;
const DEFAULT_SCHEDULE_WEEKS = '4';
const DAYS_PER_WEEK = 7;

const freshDays = (): ProgramDay[] => [{ name: 'יום A', exercises: [] }];

/** Build a local YYYY-MM-DD string without UTC conversion (avoids timezone bug). */
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Add `days` whole days to a YYYY-MM-DD string (local calendar math). */
const addDaysStr = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + days);
  return toLocalDateStr(base);
};

/** The next Sunday strictly after today — the default week-start for scheduling. */
const nextSundayStr = (now: Date = new Date()): string => {
  const d = new Date(now);
  d.setDate(d.getDate() + ((DAYS_PER_WEEK - d.getDay()) % DAYS_PER_WEEK || DAYS_PER_WEEK));
  return toLocalDateStr(d);
};

/** Coerce a raw sets/reps string to a positive integer, falling back to a floor. */
const toCount = (raw: string): number => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : MIN_COUNT;
};

/** Immutably swap two items in an array; returns the same array reference when out of range. */
const swap = <T,>(items: T[], a: number, b: number): T[] => {
  if (a < 0 || b < 0 || a >= items.length || b >= items.length) return items;
  const next = [...items];
  const tmp = next[a];
  next[a] = next[b] as T;
  next[b] = tmp as T;
  return next;
};

export default function ProgramBuilder({
  clientId,
  groupId,
  isOpen,
  onClose,
}: {
  clientId?: string | null;
  groupId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [programName, setProgramName] = useState('');
  const [days, setDays] = useState<ProgramDay[]>(freshDays);
  const [busy, setBusy] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [library, setLibrary] = useState<PersonalExercise[]>([]);
  const [libraryError, setLibraryError] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [templates, setTemplates] = useState<CoachProgramTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState(false);
  // Index of the day to mark/scroll when validation fails (spatial cue), else null.
  const [invalidDayIdx, setInvalidDayIdx] = useState<number | null>(null);
  const dayRefs = useRef<(HTMLElement | null)[]>([]);
  // Unsaved-edit tracking: true after any user edit since the last open /
  // template load / library save — gates Esc/backdrop close behind a confirm.
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Library template the current content was loaded from (or last saved as) —
  // re-saving updates it in place instead of minting a duplicate row.
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  // Stable per-open template ids keyed by day index: a retried assign upserts
  // the SAME workout_templates rows instead of duplicating orphans per attempt.
  const dayTemplateIdsRef = useRef<string[]>([]);
  // Post-assign scheduling step (client mode): once the assignment row exists,
  // offer to place the program's days on the trainee's calendar.
  const [scheduleStep, setScheduleStep] = useState<{
    assignmentId: string;
    dayRefs: { templateId: string; name: string }[];
  } | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [weeksCount, setWeeksCount] = useState(DEFAULT_SCHEDULE_WEEKS);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Fresh form each time the sheet opens — matches the previous unmount-on-close
  // behaviour now that the component stays mounted for enter/exit animations.
  useEffect(() => {
    if (isOpen) {
      setProgramName('');
      setDays(freshDays());
      setSubmitError('');
      setLibraryError(false);
      setTemplatesError(false);
      setInvalidDayIdx(null);
      setDirty(false);
      setConfirmClose(false);
      setLoadedTemplateId(null);
      dayTemplateIdsRef.current = [];
      setScheduleStep(null);
      setWeekStart(nextSundayStr());
      setWeeksCount(DEFAULT_SCHEDULE_WEEKS);
      setScheduleError('');
    }
  }, [isOpen]);

  // Pull the canonical exercise library (built-ins are seeded on first read) so
  // the coach picks real exercises instead of typing free-text with empty ids.
  useEffect(() => {
    if (!isOpen || library.length > 0) return;
    let cancelled = false;
    setLibraryLoading(true);
    getPersonalExercises()
      .then((list) => {
        if (!cancelled) setLibrary(list);
      })
      .catch(() => {
        if (!cancelled) setLibraryError(true);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
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
        // Surface a non-blocking note instead of swallowing — picker may be empty.
        if (!cancelled) setTemplatesError(true);
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

  // Assignment validation: every day must have a non-empty name AND at least one
  // NAMED exercise — empty/unnamed rows are unstartable for the trainee.
  const canAssign = useMemo(() => {
    if (days.length === 0) return false;
    const allNamed = days.every((d) => d.name.trim().length > 0);
    const everyDayHasNamedExercise = days.every((d) =>
      d.exercises.some((ex) => ex.exerciseName.trim().length > 0)
    );
    return allNamed && everyDayHasNamedExercise;
  }, [days]);

  // Lighter rule for saving a work-in-progress template to the library: at least
  // one named exercise anywhere — no per-day completeness required.
  const canSaveLibrary = useMemo(
    () => days.some((d) => d.exercises.some((ex) => ex.exerciseName.trim().length > 0)),
    [days]
  );

  // First day that fails the assignment rule (no name, or no named exercise).
  const findFirstInvalidDay = (): number | null => {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (!d) continue;
      const named = d.exercises.some((ex) => ex.exerciseName.trim().length > 0);
      if (d.name.trim().length === 0 || !named) return i;
    }
    return null;
  };

  const addDay = () => {
    setSubmitError('');
    setDirty(true);
    setDays((d) => [...d, { name: `יום ${String.fromCharCode(65 + d.length)}`, exercises: [] }]);
  };

  const removeDay = (i: number) => {
    setSubmitError('');
    setDirty(true);
    setDays((d) => d.filter((_, idx) => idx !== i));
  };

  const moveDay = (i: number, dir: -1 | 1) => {
    setSubmitError('');
    setDirty(true);
    setDays((d) => swap(d, i, i + dir));
  };

  const moveExercise = (dayIdx: number, exIdx: number, dir: -1 | 1) => {
    setSubmitError('');
    setDirty(true);
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx ? { ...day, exercises: swap(day.exercises, exIdx, exIdx + dir) } : day
      )
    );
  };

  const updateDayName = (i: number, name: string) => {
    setSubmitError('');
    setInvalidDayIdx(null);
    setDirty(true);
    setDays((d) => d.map((day, idx) => (idx === i ? { ...day, name } : day)));
  };

  const addExercise = (dayIdx: number) => {
    setSubmitError('');
    setInvalidDayIdx(null);
    setDirty(true);
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx
          ? {
              ...day,
              exercises: [
                ...day.exercises,
                {
                  exerciseName: '',
                  exerciseId: '',
                  targetMuscle: '',
                  sets: DEFAULT_SETS,
                  reps: DEFAULT_REPS,
                },
              ],
            }
          : day
      )
    );
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    setSubmitError('');
    setDirty(true);
    setDays((d) =>
      d.map((day, idx) =>
        idx === dayIdx ? { ...day, exercises: day.exercises.filter((_, ei) => ei !== exIdx) } : day
      )
    );
  };

  const updateExercise = (dayIdx: number, exIdx: number, patch: Partial<ProgramExercise>) => {
    setSubmitError('');
    setInvalidDayIdx(null);
    setDirty(true);
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

  // Stable template id for a day, minted once per sheet-open. Retrying a failed
  // assign reuses the same ids so the per-day upserts overwrite the earlier
  // partial rows instead of accumulating orphaned duplicates on the trainee.
  const templateIdForDay = (dayIdx: number): string => {
    const existing = dayTemplateIdsRef.current[dayIdx];
    if (existing) return existing;
    const id = crypto.randomUUID();
    dayTemplateIdsRef.current[dayIdx] = id;
    return id;
  };

  const buildTemplate = (day: ProgramDay, stableId?: string): WorkoutTemplate => {
    // Drop blank-name rows so empty, unstartable exercises never reach the trainee.
    const named = (day.exercises ?? []).filter((ex) => ex.exerciseName.trim().length > 0);
    const exercises: WorkoutTemplateExercise[] = named.map((ex, i) => {
      const setCount = toCount(ex.sets);
      const repCount = toCount(ex.reps);
      return {
        id: crypto.randomUUID(),
        exerciseId: ex.exerciseId ?? '',
        exerciseName: ex.exerciseName.trim(),
        targetMuscle: ex.targetMuscle ?? '',
        targetSets: setCount,
        targetReps: repCount,
        targetWeight: null,
        restSeconds: 60,
        order: i,
        notes: '',
        sets: Array.from({ length: setCount }, () => ({ reps: repCount, weight: 0 })),
      };
    });
    return {
      id: stableId ?? crypto.randomUUID(),
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

  // Mark + scroll the first invalid day into view so the coach gets a spatial cue.
  const flagInvalidDay = () => {
    const idx = findFirstInvalidDay();
    setInvalidDayIdx(idx);
    if (idx !== null) {
      dayRefs.current[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const handleAssign = async () => {
    if (!clientId) return; // library mode — assignment happens elsewhere
    if (!canAssign) {
      setSubmitError('כל יום חייב שם ולפחות תרגיל אחד עם שם');
      flagInvalidDay();
      return;
    }
    setInvalidDayIdx(null);
    setBusy(true);
    try {
      // Persist one runnable template per day… (stable per-open ids — see
      // templateIdForDay — so a retry after a mid-loop failure upserts the
      // same rows instead of leaving days 1..k orphaned and minting new ids)
      const programDayRefs: { templateId: string; name: string }[] = [];
      for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
        const day = days[dayIdx];
        if (!day) continue;
        const tpl = buildTemplate(day, templateIdForDay(dayIdx));
        // upsertClientTemplate returns {error} and never throws — a swallowed
        // failure would show a false success while the trainee's program points
        // at templates that were never persisted.
        const { error } = await upsertClientTemplate(clientId, tpl);
        if (error) throw new Error(error);
        programDayRefs.push({ templateId: tpl.id, name: tpl.name });
      }
      // …but surface the whole week as ONE program assignment so the trainee
      // sees a structured plan, not N independent "התחל אימון" rows. templateId
      // points at the first day for backward-compatible single-start fallback.
      const assignment = await createAssignment({
        kind: 'program',
        title: programName || 'תוכנית אימון',
        templateId: programDayRefs[0]?.templateId ?? null,
        clientId,
        payload: { programName: programName || 'תוכנית אימון', days: programDayRefs },
      });
      showToast('התוכנית שויכה', 'success');
      // Don't close yet — offer the optional calendar-scheduling step.
      setScheduleStep({ assignmentId: assignment.id, dayRefs: programDayRefs });
    } catch {
      showToast('שיוך התוכנית נכשל', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAssignGroup = async () => {
    if (!groupId) return; // not in group mode
    if (!canAssign) {
      setSubmitError('כל יום חייב שם ולפחות תרגיל אחד עם שם');
      flagInvalidDay();
      return;
    }
    setInvalidDayIdx(null);
    setBusy(true);
    try {
      const result = await assignProgramToGroup({
        groupId,
        programName: programName || 'תוכנית אימון',
        days: days.map((day) => ({ name: day.name, template: buildTemplate(day) })),
      });
      if (result.memberCount === 0) {
        showToast('אין מתאמנים פעילים בקבוצה', 'error');
        return;
      }
      const succeeded = result.memberCount - result.failures.length;
      // Every member failed (no assignment row created) — this is a real failure,
      // not a partial success, so don't show a green "שויכה ל-0".
      if (succeeded === 0 || result.assignmentId === null) {
        showToast('שיוך התוכנית לקבוצה נכשל', 'error');
        return;
      }
      if (result.failures.length > 0) {
        // Numbers render LTR inside the RTL string via embedded markers.
        showToast(`התוכנית שויכה ל-⁨${succeeded}⁩ מתוך ⁨${result.memberCount}⁩`, 'success');
      } else {
        showToast('התוכנית שויכה לקבוצה', 'success');
      }
      onClose();
    } catch {
      showToast('שיוך התוכנית לקבוצה נכשל', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Coerce the in-edit (string sets/reps) days to the persisted ProgramTemplateDay
  // shape (numeric sets/reps), dropping blank-name rows.
  const toTemplateDays = (): ProgramTemplateDay[] =>
    days.map((day) => ({
      name: day.name,
      exercises: day.exercises
        .filter((ex) => ex.exerciseName.trim().length > 0)
        .map((ex) => ({
          exerciseName: ex.exerciseName.trim(),
          exerciseId: ex.exerciseId,
          targetMuscle: ex.targetMuscle,
          sets: toCount(ex.sets),
          reps: toCount(ex.reps),
        })),
    }));

  const handleSaveToLibrary = async () => {
    setSavingTemplate(true);
    try {
      // Re-saving a loaded (or previously saved) template updates it in place
      // instead of silently creating a duplicate row with the same name.
      const saved = await saveProgramTemplate({
        ...(loadedTemplateId ? { id: loadedTemplateId } : {}),
        name: programName.trim() || 'תוכנית ללא שם',
        days: toTemplateDays(),
      });
      setLoadedTemplateId(saved.id);
      setDirty(false);
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
    // Deep-map into the in-edit shape (string sets/reps). days come from JSON, so a
    // plain map is JSON-safe and avoids structuredClone's unhandled-throw risk.
    setDays(
      tpl.days.map((day) => ({
        name: day.name,
        exercises: day.exercises.map((ex) => ({
          exerciseName: ex.exerciseName,
          exerciseId: ex.exerciseId,
          targetMuscle: ex.targetMuscle,
          sets: String(ex.sets),
          reps: String(ex.reps),
        })),
      }))
    );
    setProgramName(tpl.name);
    setSubmitError('');
    setInvalidDayIdx(null);
    // Loaded content mirrors a saved row — re-save updates it; not dirty yet.
    setLoadedTemplateId(tpl.id);
    setDirty(false);
    // Reset select back to placeholder.
    e.target.value = '';
  };

  // ── Post-assign scheduling step (client mode) ─────────────────────────────
  // Places day i of the program on weekday i (week starts at the picked date,
  // default next Sunday), repeated for the chosen number of weeks. Each week is
  // scheduled separately so a partial failure is reported, and the underlying
  // upsert conflict key keeps retries idempotent.
  const handleSchedule = async () => {
    if (!clientId || !scheduleStep) return;
    const weeks = Math.floor(Number(weeksCount));
    if (!Number.isFinite(weeks) || weeks < MIN_SCHEDULE_WEEKS || weeks > MAX_SCHEDULE_WEEKS) {
      setScheduleError('מספר השבועות חייב להיות בין 1 ל-12');
      return;
    }
    if (!weekStart) {
      setScheduleError('יש לבחור תאריך התחלה');
      return;
    }
    setScheduleError('');
    setScheduling(true);
    try {
      const dayMap = scheduleStep.dayRefs.map((d, i) => ({
        templateId: d.templateId,
        name: d.name,
        weekday: i,
      }));
      let failedWeeks = 0;
      for (let w = 0; w < weeks; w++) {
        const { error } = await scheduleProgramWeek(clientId, {
          assignmentId: scheduleStep.assignmentId,
          weekStart: addDaysStr(weekStart, w * DAYS_PER_WEEK),
          dayMap,
          weeks: 1,
        });
        if (error) failedWeeks++;
      }
      if (failedWeeks === 0) {
        showToast('התוכנית שובצה ביומן המתאמן', 'success');
        onClose();
      } else if (failedWeeks < weeks) {
        // Numbers render LTR inside the RTL string via embedded markers.
        showToast(`שובצו ⁨${weeks - failedWeeks}⁩ מתוך ⁨${weeks}⁩ שבועות`, 'success');
        onClose();
      } else {
        setScheduleError('השיבוץ ליומן נכשל. אפשר לנסות שוב או לדלג.');
      }
    } finally {
      setScheduling(false);
    }
  };

  // Close gating: a built-but-unsaved program must not vanish on Esc/backdrop.
  // After the assign succeeded (scheduleStep) everything is persisted — closing
  // just skips the optional scheduling step.
  const hasBuiltContent = programName.trim().length > 0 || days.some((d) => d.exercises.length > 0);
  const requestClose = () => {
    if (scheduleStep) {
      onClose();
      return;
    }
    if (dirty && hasBuiltContent) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  const builderFooter = (
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
          variant={clientId || groupId ? 'secondary' : 'primary'}
          fullWidth
          isLoading={savingTemplate}
          onClick={handleSaveToLibrary}
          disabled={!canSaveLibrary || busy || savingTemplate}
        >
          שמור בספרייה
        </Button>
        {clientId && (
          <Button
            variant="primary"
            fullWidth
            isLoading={busy}
            onClick={handleAssign}
            disabled={!canAssign || busy || savingTemplate}
          >
            שייך תוכנית
          </Button>
        )}
        {groupId && (
          <Button
            variant="primary"
            fullWidth
            isLoading={busy}
            onClick={handleAssignGroup}
            disabled={!canAssign || busy || savingTemplate}
          >
            שייך לקבוצה
          </Button>
        )}
      </div>
    </>
  );

  const scheduleFooter = (
    <>
      {scheduleError && (
        <div
          role="alert"
          style={{
            color: 'var(--fs-warn)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {scheduleError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={scheduling}>
          דילוג
        </Button>
        <Button variant="primary" fullWidth isLoading={scheduling} onClick={handleSchedule}>
          שיבוץ ליומן
        </Button>
      </div>
    </>
  );

  // Compact post-assign step: optional placement of the assigned program on the
  // trainee's calendar via scheduleProgramWeek (which no other UI calls today).
  const scheduleBody = scheduleStep && (
    <section aria-label="שיבוץ ליומן המתאמן">
      <h3
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 10,
        }}
      >
        שיבוץ ליומן המתאמן
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fs-ink)',
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        התוכנית שויכה. אפשר לשבץ את ימי התוכנית ביומן המתאמן — כל יום בתורו, החל מתאריך ההתחלה, למשך
        מספר השבועות שנבחר.
      </p>
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <Input
            label="תאריך התחלה"
            type="date"
            dir="ltr"
            value={weekStart}
            onChange={(e) => {
              setWeekStart(e.target.value);
              setScheduleError('');
            }}
          />
        </div>
        <div style={{ width: 96 }} className="shrink-0">
          <Input
            label="שבועות"
            type="number"
            inputMode="numeric"
            dir="ltr"
            min={MIN_SCHEDULE_WEEKS}
            max={MAX_SCHEDULE_WEEKS}
            value={weeksCount}
            onChange={(e) => {
              setWeeksCount(e.target.value);
              setScheduleError('');
            }}
          />
        </div>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--fs-muted)',
          margin: 0,
        }}
      >
        אפשר לדלג — התוכנית כבר שויכה למתאמן.
      </p>
    </section>
  );

  const builderBody = (
    <>
      <datalist id="coach-exercise-library">
        {library.map((ex) => (
          <option key={ex.id} value={ex.name ?? ''}>
            {ex.name ?? ''}
          </option>
        ))}
      </datalist>

      {templatesError && (
        <p
          style={{
            color: 'var(--fs-muted)',
            fontSize: 12,
            marginBottom: 8,
            fontFamily: 'var(--font-body)',
          }}
        >
          לא ניתן לטעון תבניות שמורות
        </p>
      )}

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
              borderRadius: 0,
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
          onChange={(e) => {
            setProgramName(e.target.value);
            setDirty(true);
          }}
          placeholder="אופציונלי"
        />
      </div>

      {libraryLoading && (
        <p
          style={{
            color: 'var(--fs-muted)',
            fontSize: 12,
            marginBottom: 8,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
          }}
        >
          טוען ספריית תרגילים…
        </p>
      )}

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

      {days.map((day, dayIdx) => {
        const isInvalid = invalidDayIdx === dayIdx;
        return (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: days are append/remove without stable IDs
            key={dayIdx}
            ref={(el) => {
              dayRefs.current[dayIdx] = el;
            }}
            aria-invalid={isInvalid || undefined}
            className="mb-5 p-4"
            style={{
              background: 'var(--fs-surface-2)',
              border: `1px solid ${isInvalid ? 'var(--fs-warn)' : 'var(--fs-surface-2)'}`,
            }}
          >
            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <Input
                  label="שם היום"
                  value={day.name}
                  onChange={(e) => updateDayName(dayIdx, e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveDay(dayIdx, -1)}
                aria-label="העבר יום למעלה"
                disabled={dayIdx === 0}
                className="shrink-0"
              >
                <ChevronUp size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveDay(dayIdx, 1)}
                aria-label="העבר יום למטה"
                disabled={dayIdx === days.length - 1}
                className="shrink-0"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </Button>
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
                className="flex items-end gap-2 mb-2"
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
                <div style={{ width: 64, minHeight: 44 }} className="shrink-0">
                  <Input
                    label="סטים"
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    value={ex.sets}
                    onChange={(e) => updateExercise(dayIdx, exIdx, { sets: e.target.value })}
                  />
                </div>
                <span
                  style={{ color: 'var(--fs-muted)', fontSize: 12, paddingBottom: 14 }}
                  aria-hidden="true"
                >
                  ×
                </span>
                <div style={{ width: 64, minHeight: 44 }} className="shrink-0">
                  <Input
                    label="חזרות"
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    value={ex.reps}
                    onChange={(e) => updateExercise(dayIdx, exIdx, { reps: e.target.value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveExercise(dayIdx, exIdx, -1)}
                  aria-label="העבר תרגיל למעלה"
                  disabled={exIdx === 0}
                  className="shrink-0"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveExercise(dayIdx, exIdx, 1)}
                  aria-label="העבר תרגיל למטה"
                  disabled={exIdx === day.exercises.length - 1}
                  className="shrink-0"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
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
        );
      })}

      <Button
        variant="secondary"
        fullWidth
        icon={<Plus size={16} />}
        onClick={addDay}
        className="mb-2"
      >
        הוסף יום
      </Button>
    </>
  );

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={requestClose}
        title={scheduleStep ? 'שיבוץ ליומן' : 'בניית תוכנית'}
        footer={scheduleStep ? scheduleFooter : builderFooter}
      >
        {scheduleStep ? scheduleBody : builderBody}
      </Sheet>

      {/* Dirty-close guard — a built program must not be discarded by Esc/backdrop. */}
      <ConfirmDialog
        isOpen={confirmClose}
        variant="warning"
        title="סגירה ללא שמירה"
        description="לסגור בלי לשמור? התוכנית שנבנתה תימחק."
        confirmLabel="סגירה"
        cancelLabel="חזרה"
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
