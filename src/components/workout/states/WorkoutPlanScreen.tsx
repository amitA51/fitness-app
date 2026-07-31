/**
 * WorkoutPlanScreen — optional pre-workout planning table.
 *
 * Sits between exercise selection and the active workout. The trainee chooses
 * how many sets each exercise has and may pre-fill weight/reps per set for high
 * up-front precision — or skip straight to the workout and fill values live.
 *
 * Design: edits live in an isolated LOCAL draft, so nothing touches the reducer
 * until "התחל אימון" commits the whole plan via SET_EXERCISES. Pre-filled values
 * land with isCompleted:false (createWorkoutSet default) — visible but not marked
 * done, so the trainee still confirms each set during the workout.
 *
 * Fresh Steel / Obsidian styling mirrors PreWorkoutScreen / ExerciseSelector.
 */

import { AnimatePresence, type Variants, m } from 'framer-motion';
import {
  ChevronRight as BackIcon,
  Dumbbell as DumbbellIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  Wand2 as WandIcon,
} from 'lucide-react';
import React, { Suspense, useMemo, useState } from 'react';
import { translateMuscle } from '../../../constants';
import {
  type ActiveExercise,
  type Exercise,
  type WorkoutGoal,
  type WorkoutSet,
  createWorkoutSet,
} from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';
import PlanSetRow from '../components/PlanSetRow';
import { usePlanPreviousData } from '../hooks/usePlanPreviousData';

const ExerciseSelector = React.lazy(() => import('../ExerciseSelector'));
const QuickExerciseForm = React.lazy(() => import('../QuickExerciseForm'));

// Shared grid template so card column headers line up with PlanSetRow cells.
const SET_GRID = '28px 1fr 1fr 32px';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const buildEmptySets = (count: number, isTimed?: boolean): WorkoutSet[] =>
  Array.from({ length: Math.max(1, count) }, (_, i) =>
    createWorkoutSet({ reps: 0, weight: 0, setNumber: i + 1, ...(isTimed ? { duration: 0 } : {}) })
  );

/** Normalize a picked exercise into a plan row with `count` empty sets. */
const seedExercise = (ex: ActiveExercise, count: number): ActiveExercise => ({
  ...ex,
  sets: buildEmptySets(count, ex.isTimed),
});

export interface WorkoutPlanScreenProps {
  /** Exercises picked in the selector (their sets are re-seeded to defaultSets). */
  initialExercises: ActiveExercise[];
  defaultSets: number;
  weightIncrement: number;
  goal?: WorkoutGoal;
  oledMode: boolean;
  showGhostValues: boolean;
  /** Commit the finished plan and enter the active workout. */
  onStart: (exercises: ActiveExercise[]) => void;
  /** Abandon planning and return to exercise selection. */
  onCancel: () => void;
}

const WorkoutPlanScreen: React.FC<WorkoutPlanScreenProps> = ({
  initialExercises,
  defaultSets,
  weightIncrement,
  goal,
  oledMode,
  showGhostValues,
  onStart,
  onCancel,
}) => {
  const [draft, setDraft] = useState<ActiveExercise[]>(() =>
    initialExercises.map((ex) => seedExercise(ex, defaultSets))
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [quickFormOpen, setQuickFormOpen] = useState(false);

  const names = useMemo(() => draft.map((e) => e.name ?? '').filter(Boolean), [draft]);
  const { previousByName } = usePlanPreviousData(showGhostValues ? names : []);

  const totalSets = useMemo(
    () => draft.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0),
    [draft]
  );

  // ── Draft mutations (immutable) ─────────────────────────────────────────
  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: number) => {
    setDraft((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets ?? [];
        return { ...ex, sets: sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) };
      })
    );
  };

  const addSet = (exIdx: number) => {
    triggerHaptic('light');
    setDraft((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets ?? [];
        const last = sets[sets.length - 1];
        const newSet = createWorkoutSet({
          reps: last?.reps ?? 0,
          weight: last?.weight ?? 0,
          setNumber: sets.length + 1,
          ...(ex.isTimed ? { duration: last?.duration ?? 0 } : {}),
        });
        return { ...ex, sets: [...sets, newSet] };
      })
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setDraft((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets ?? [];
        if (sets.length <= 1) return ex; // always keep at least one set
        return {
          ...ex,
          sets: sets.filter((_, j) => j !== setIdx).map((s, k) => ({ ...s, setNumber: k + 1 })),
        };
      })
    );
  };

  const removeExercise = (exIdx: number) => {
    triggerHaptic('medium');
    setDraft((prev) => prev.filter((_, i) => i !== exIdx));
  };

  const fillFromPrevious = (exIdx: number) => {
    const ex = draft[exIdx];
    const prevSets = ex?.name ? previousByName.get(ex.name) : undefined;
    if (!prevSets?.length) return;
    triggerHaptic('success');
    setDraft((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e;
        const sets = e.sets ?? [];
        return {
          ...e,
          sets: sets.map((s, j) => {
            const p = prevSets[Math.min(j, prevSets.length - 1)];
            return p ? { ...s, weight: p.weight ?? s.weight, reps: p.reps ?? s.reps } : s;
          }),
        };
      })
    );
  };

  const addToDraft = (ex: Exercise) => {
    setDraft((prev) => [...prev, seedExercise(ex as ActiveExercise, defaultSets)]);
  };

  const handleStart = () => {
    if (draft.length === 0) return;
    triggerHaptic('success');
    onStart(draft);
  };

  const handleAddExercise = () => {
    triggerHaptic('light');
    setSelectorOpen(true);
  };

  return (
    <m.div
      className="fixed inset-0 z-overlay flex flex-col ambient-mesh ambient-mesh-soft"
      style={{ background: oledMode ? '#000000' : 'var(--fs-bg)' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="main"
      aria-label="תכנון אימון מראש"
    >
      {/* ── NAVY MASTHEAD ── */}
      <div className="flex-shrink-0" style={{ background: 'var(--fs-primary)' }}>
        <div className="px-5 pt-6 pb-4">
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent)',
              marginBottom: 6,
            }}
          >
            תכנון מראש
          </p>
          <h1
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 34,
              color: 'var(--color-ink-on-dark)',
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
            }}
          >
            תכנן את האימון
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {pluralizeHe(draft.length, HE_NOUNS.exercise)} · {pluralizeHe(totalSets, HE_NOUNS.set)}{' '}
            — קבע סטים, משקל וחזרות מראש (אופציונלי)
          </p>
        </div>
      </div>

      {/* ── BONE BODY (scroll) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
        {draft.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ minHeight: 240 }}
          >
            <DumbbellIcon
              style={{ width: 40, height: 40, color: 'var(--fs-muted)', opacity: 0.5 }}
            />
            <p
              className="mt-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--fs-heading)',
              }}
            >
              עדיין אין תרגילים בתוכנית
            </p>
            <p
              className="mt-1"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
            >
              הוסף תרגיל כדי להתחיל לתכנן
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {draft.map((ex, exIdx) => {
              const sets = ex.sets ?? [];
              const prevSets = ex.name ? previousByName.get(ex.name) : undefined;
              const hasPrevious = !!prevSets?.length;

              return (
                <div
                  key={ex.id}
                  style={{
                    background: 'var(--fs-surface)',
                    border: '2px solid var(--fs-primary)',
                    borderRadius: 'var(--radius-asymmetric, 14px)',
                    padding: '12px 12px 10px',
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between" style={{ gap: 8 }}>
                    <div className="min-w-0 flex items-start" style={{ gap: 10 }}>
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 26,
                          height: 26,
                          background: 'var(--fs-accent)',
                          color: 'var(--fs-primary)',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 13,
                          borderRadius: 6,
                        }}
                        aria-hidden="true"
                      >
                        {exIdx + 1}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 16,
                            color: 'var(--fs-heading)',
                            lineHeight: 1.1,
                          }}
                        >
                          {ex.name}
                        </p>
                        {ex.muscleGroup && (
                          <p
                            className="truncate mt-0.5"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              letterSpacing: '-0.01em',
                              color: 'var(--fs-muted)',
                            }}
                          >
                            {translateMuscle(ex.muscleGroup)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeExercise(exIdx)}
                      aria-label={`הסר ${ex.name} מהתוכנית`}
                      className="flex items-center justify-center shrink-0 cursor-pointer focus-ring"
                      style={{ width: 32, height: 32, color: 'var(--fs-muted)' }}
                    >
                      <TrashIcon style={{ width: 16, height: 16 }} />
                    </button>
                  </div>

                  {/* Column labels */}
                  <div className="grid mt-2 mb-1" style={{ gridTemplateColumns: SET_GRID, gap: 8 }}>
                    <span />
                    <span
                      className="text-center"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      משקל (ק"ג)
                    </span>
                    <span
                      className="text-center"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '-0.01em',
                        color: 'var(--fs-muted)',
                      }}
                    >
                      חזרות
                    </span>
                    <span />
                  </div>

                  {sets.map((s, setIdx) => (
                    <PlanSetRow
                      key={s.id}
                      index={setIdx}
                      weight={s.weight}
                      reps={s.reps}
                      weightIncrement={weightIncrement}
                      ghostWeight={showGhostValues ? prevSets?.[setIdx]?.weight : undefined}
                      ghostReps={showGhostValues ? prevSets?.[setIdx]?.reps : undefined}
                      canRemove={sets.length > 1}
                      onChange={(field, value) => updateSet(exIdx, setIdx, field, value)}
                      onRemove={() => removeSet(exIdx, setIdx)}
                    />
                  ))}

                  {/* Per-card actions */}
                  <div className="flex items-center mt-2" style={{ gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => addSet(exIdx)}
                      className="flex items-center justify-center cursor-pointer focus-ring"
                      style={{
                        gap: 6,
                        flex: 1,
                        padding: '8px 12px',
                        background: 'var(--fs-surface-2)',
                        color: 'var(--fs-heading)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: '0.04em',
                        borderRadius: 8,
                      }}
                    >
                      <PlusIcon style={{ width: 14, height: 14 }} />
                      הוסף סט
                    </button>

                    {hasPrevious && (
                      <button
                        type="button"
                        onClick={() => fillFromPrevious(exIdx)}
                        className="flex items-center justify-center cursor-pointer focus-ring"
                        style={{
                          gap: 6,
                          padding: '8px 12px',
                          background: 'transparent',
                          color: 'var(--fs-accent-2, var(--fs-accent))',
                          border:
                            '1.5px solid color-mix(in srgb, var(--fs-accent) 50%, transparent)',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: '0.04em',
                          borderRadius: 8,
                        }}
                        aria-label={`מלא משקל וחזרות מהאימון הקודם עבור ${ex.name}`}
                      >
                        <WandIcon style={{ width: 14, height: 14 }} />
                        מלא מהקודם
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add exercise */}
        <button
          type="button"
          onClick={handleAddExercise}
          className="w-full flex items-center justify-center mt-3 cursor-pointer focus-ring"
          style={{
            gap: 8,
            padding: '14px',
            background: 'transparent',
            color: 'var(--fs-primary)',
            border: '2px dashed color-mix(in srgb, var(--fs-primary) 40%, transparent)',
            borderRadius: 'var(--radius-asymmetric, 14px)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.06em',
          }}
        >
          <PlusIcon style={{ width: 16, height: 16 }} />
          הוסף תרגיל
        </button>
      </div>

      {/* ── FOOTER CTA ── */}
      <div
        className="flex-shrink-0 px-5 pt-3 flex flex-col"
        style={{
          gap: 8,
          // The sheet body already supplies depth. A solid action footer avoids
          // stacking another backdrop sample above the persistent app chrome.
          background: 'var(--fs-surface)',
          borderTop: '0.5px solid var(--color-separator)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button
          type="button"
          onClick={handleStart}
          disabled={draft.length === 0}
          className="start-workout-btn focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="התחל את האימון עם התוכנית"
        >
          <DumbbellIcon style={{ width: 20, height: 20 }} />
          התחל אימון
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onCancel();
          }}
          className="cta-ghost w-full focus-ring"
          aria-label="חזרה לבחירת תרגילים"
        >
          <BackIcon style={{ width: 16, height: 16 }} />
          חזרה
        </button>
      </div>

      {/* Nested overlays — feed the local draft, no reducer coupling */}
      <AnimatePresence>
        {(selectorOpen || quickFormOpen) && (
          <Suspense fallback={null}>
            {selectorOpen && (
              <ExerciseSelector
                isOpen={true}
                goal={goal}
                confirmLabel="הוסף לתוכנית"
                onSelect={addToDraft}
                onClose={() => setSelectorOpen(false)}
                onCreateNew={() => {
                  setSelectorOpen(false);
                  setQuickFormOpen(true);
                }}
              />
            )}
            {quickFormOpen && (
              <QuickExerciseForm
                onAdd={(ex: Exercise) => {
                  addToDraft(ex);
                  setQuickFormOpen(false);
                }}
                onClose={() => setQuickFormOpen(false)}
              />
            )}
          </Suspense>
        )}
      </AnimatePresence>
    </m.div>
  );
};

WorkoutPlanScreen.displayName = 'WorkoutPlanScreen';

export default WorkoutPlanScreen;
