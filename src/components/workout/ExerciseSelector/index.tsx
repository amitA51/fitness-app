// ExerciseSelector - Fresh Steel / Obsidian
// Dark masthead · surface body · sharp corners · oversized display numerals.

import { AnimatePresence, type PanInfo, m, useDragControls } from 'framer-motion';
import {
  ClipboardList as ClipboardIcon,
  X as CloseIcon,
  Dumbbell as DumbbellIcon,
  Plus,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import * as dataService from '../../../services/dataService';
import {
  type Exercise,
  type PersonalExercise,
  type WorkoutGoal,
  type WorkoutTemplate,
  createWorkoutSet,
} from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';
import { EmbeddedTemplatePicker } from '../../templates/EmbeddedTemplatePicker';
import { ModalOverlay } from '../../ui/ModalOverlay';
import ExerciseLibraryTab from '../ExerciseLibraryTab';

const makeExerciseId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `ex-${crypto.randomUUID()}`
    : `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Map a picked library exercise into a fresh live-workout exercise, preserving
 * the catalog metadata the live screens consume: muscle map (target + secondary
 * muscles), the equipment badge, and the per-exercise tutorial steps. The prior
 * mapping copied only name/muscleGroup, so the muscle map showed primary-only
 * and the tutorial had no equipment or instructions to display. The session
 * builder reads a fixed subset of fields, so carrying these extras enriches the
 * live UI without changing the saved session shape.
 */
const fromLibraryExercise = (pe: PersonalExercise, sets: Exercise['sets']): Exercise => ({
  id: makeExerciseId(),
  name: pe.name,
  muscleGroup: pe.muscleGroup,
  targetMuscle: pe.targetMuscle,
  secondaryMuscles: pe.secondaryMuscles,
  equipment: pe.equipment,
  tutorialText: pe.tutorialText,
  instructions: pe.instructions,
  tempo: pe.tempo,
  // Classification, for the same reason as the fields above: without it the live
  // tutorial cannot say what the movement is, and the muscle map falls back to
  // the coarse group instead of the actual prime mover.
  primaryMuscle: pe.primaryMuscle,
  mechanic: pe.mechanic,
  force: pe.force,
  level: pe.level,
  targetRestTime: pe.defaultRestTime || 90,
  sets,
});

interface ExerciseSelectorProps {
  isOpen: boolean;
  onSelect: (exercise: Exercise) => void;
  /** Add a whole picked selection at once (keeps the runner on the FIRST pick).
   *  Falls back to repeated onSelect calls when not provided. */
  onSelectMany?: (exercises: Exercise[]) => void;
  onClose: () => void;
  onCreateNew: () => void;
  goal?: WorkoutGoal;
  /** Label for the primary confirm CTA (defaults to "התחל"). */
  confirmLabel?: string;
  /**
   * When provided, shows a secondary "plan ahead" CTA that hands the picked
   * exercises to the pre-workout planning table instead of starting immediately.
   */
  onPlanRequested?: (exercises: Exercise[]) => void;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  isOpen,
  onSelect,
  onSelectMany,
  onClose,
  onCreateNew,
  goal: _goal,
  confirmLabel = 'הוסיפו לאימון',
  onPlanRequested,
}) => {
  const [activeTab, setActiveTab] = useState<'exercises' | 'templates'>('exercises');
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [pendingExercises, setPendingExercises] = useState<PersonalExercise[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  const handleSelect = useCallback((personalExercise: PersonalExercise) => {
    if (!personalExercise.name?.trim()) return;
    triggerHaptic('light');

    setSelectedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(personalExercise.id)) {
        next.delete(personalExercise.id);
      } else {
        next.add(personalExercise.id);
      }
      return next;
    });

    setPendingExercises((prev) => {
      const exists = prev.find((e) => e.id === personalExercise.id);
      if (exists) return prev.filter((e) => e.id !== personalExercise.id);
      return [...prev, personalExercise];
    });
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (pendingExercises.length === 0) return;
    triggerHaptic('success');

    // Start every picked exercise with a single set; the trainee adds more
    // during the workout via "הוסף סט". The library no longer prescribes a
    // default set count.
    const exercises = pendingExercises.map((personalExercise) => {
      dataService.incrementExerciseUse(personalExercise.id).catch(() => {});
      return fromLibraryExercise(personalExercise, [createWorkoutSet({ reps: 0, weight: 0 })]);
    });
    if (onSelectMany) onSelectMany(exercises);
    else exercises.forEach(onSelect);

    setSelectedExercises(new Set());
    setPendingExercises([]);
    onClose();
  }, [pendingExercises, onSelect, onSelectMany, onClose]);

  // Hand the current selection to the pre-workout planning table. Sets are left
  // empty here on purpose — the planning screen seeds each exercise with the
  // user's defaultSets count.
  const handlePlanSelection = useCallback(() => {
    if (pendingExercises.length === 0 || !onPlanRequested) return;
    triggerHaptic('success');

    const exercises: Exercise[] = pendingExercises.map((personalExercise) =>
      fromLibraryExercise(personalExercise, [])
    );
    pendingExercises.forEach((personalExercise) => {
      dataService.incrementExerciseUse(personalExercise.id).catch(() => {});
    });

    setSelectedExercises(new Set());
    setPendingExercises([]);
    onPlanRequested(exercises);
  }, [pendingExercises, onPlanRequested]);

  const handleTemplateSelect = useCallback(
    (template: WorkoutTemplate) => {
      if (!template.exercises || template.exercises.length === 0) return;
      triggerHaptic('success');

      const exercises: Exercise[] = template.exercises.map((ex) => {
        const exercise: Exercise = {
          id: makeExerciseId(),
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetRestTime: ex.targetRestTime || 90,
          sets:
            ex.sets && ex.sets.length > 0
              ? ex.sets.map((s) => createWorkoutSet({ reps: s.reps || 0, weight: s.weight || 0 }))
              : Array(4)
                  .fill(null)
                  .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
        };
        return exercise;
      });
      if (onSelectMany) onSelectMany(exercises);
      else exercises.forEach(onSelect);

      setSelectedExercises(new Set());
      setPendingExercises([]);
      onClose();
    },
    [onSelect, onSelectMany, onClose]
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const projectedOffset = info.offset.y + info.velocity.y * 0.18;
    if (projectedOffset > 120) onClose();
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="none"
      zLevel="extreme"
      backdropOpacity={60}
      blur="none"
      trapFocus
      lockScroll={false}
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="בחירת תרגילים"
    >
      <m.div
        className="fixed bottom-0 left-0 right-0 flex flex-col"
        initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
        transition={
          shouldReduceMotion
            ? { duration: 0.15, ease: 'easeOut' }
            : { type: 'spring', bounce: 0, duration: 0.38 }
        }
        style={{
          maxHeight: '92dvh',
          overflow: 'hidden',
          borderRadius: '28px 28px 0 0',
          boxShadow: 'var(--elevation-3)',
        }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── NAVY MASTHEAD ── */}
        <div
          style={{
            background: 'color-mix(in srgb, var(--fs-primary) 96%, transparent)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          }}
        >
          {/* Drag Handle doubles as the compact masthead row: handle, title and
              close share one line so the list starts ~70px higher than the old
              stacked title/subtitle/tabs header. */}
          <div
            className="flex items-center justify-between pt-3 pb-1 px-4"
            onPointerDown={(event) => {
              // A pointer-down on a control inside this row is a TAP, not a grab.
              // Starting the drag here hands the pointer to Framer, which then
              // swallows the ensuing click — so tapping the X did nothing at all
              // and the sheet read as stuck open ("back doesn't go back").
              if ((event.target as HTMLElement).closest('button')) return;
              dragControls.start(event);
            }}
            style={{ touchAction: 'none', cursor: 'grab' }}
          >
            <div
              aria-hidden="true"
              className="w-10 h-1"
              style={{
                background: 'var(--color-ink-on-dark)',
                opacity: 0.3,
                borderRadius: 999,
              }}
            />

            <h1
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--color-ink-on-dark)',
                letterSpacing: 'normal',
                lineHeight: 1.2,
                direction: 'rtl',
                textAlign: 'center',
                flex: 1,
              }}
            >
              בחרו תרגילים
            </h1>

            {/* Spacer mirroring the handle keeps the title optically centered. */}
            <div aria-hidden="true" style={{ inlineSize: 40 }} />

            <div
              style={{
                position: 'absolute',
                insetInlineEnd: 12,
                top: 12,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  // Tint the BACKGROUND only — element-level opacity would ghost the icon too
                  background: 'rgba(var(--text-on-navy-rgb), 0.1)',
                  borderRadius: 999,
                }}
                aria-label="סגור"
              >
                <CloseIcon className="w-5 h-5" style={{ color: 'var(--color-ink-on-dark)' }} />
              </button>
            </div>
          </div>

          {/* Tabs — Apple Segmented */}
          <div
            className="mt-2 mx-4 mb-3 grid grid-cols-2 gap-1"
            role="group"
            aria-label="סוג בחירה"
            style={{
              background: 'rgba(var(--text-on-navy-rgb), 0.1)',
              borderRadius: 999,
              padding: 3,
            }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('exercises');
              }}
              aria-pressed={activeTab === 'exercises'}
              className="py-1.5 min-h-9 text-sm font-bold text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-signal)] focus-visible:outline-offset-[-2px]"
              style={{
                background: activeTab === 'exercises' ? 'var(--fs-accent)' : 'transparent',
                color:
                  activeTab === 'exercises'
                    ? 'var(--color-ink-on-accent)'
                    : 'rgba(var(--text-on-navy-rgb), 0.75)',
                fontFamily: 'var(--font-body)',
                letterSpacing: 'normal',
                borderRadius: 999,
              }}
            >
              תרגילים
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('templates');
              }}
              aria-pressed={activeTab === 'templates'}
              className="py-1.5 min-h-9 text-sm font-bold text-center transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-signal)] focus-visible:outline-offset-[-2px]"
              style={{
                background: activeTab === 'templates' ? 'var(--fs-accent)' : 'transparent',
                color:
                  activeTab === 'templates'
                    ? 'var(--color-ink-on-accent)'
                    : 'rgba(var(--text-on-navy-rgb), 0.75)',
                fontFamily: 'var(--font-body)',
                letterSpacing: 'normal',
                borderRadius: 999,
              }}
            >
              תבניות
            </button>
          </div>
        </div>

        {/* ── BONE BODY ── */}
        <div
          className="flex-1 relative flex flex-col overflow-hidden"
          style={{ background: 'var(--fs-surface)' }}
        >
          {activeTab === 'exercises' ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ExerciseLibraryTab
                isSelectionMode={true}
                onSelect={handleSelect}
                selectedIds={selectedExercises}
              />
            </div>
          ) : (
            <div className="pt-4 px-5 h-full overflow-y-auto">
              <EmbeddedTemplatePicker onSelectTemplate={handleTemplateSelect} />
            </div>
          )}
        </div>

        {/* ── FOOTER CTA ── */}
        <AnimatePresence>
          {pendingExercises.length > 0 ? (
            <m.div
              initial={shouldReduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              className="px-4 py-2.5 flex items-center gap-2"
              style={{
                background: 'color-mix(in srgb, var(--fs-surface) 92%, transparent)',
                borderTop: '1px solid var(--color-border)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              }}
            >
              {/* One row, not two stacked full-width pills. The stacked version
                  cost ~148px of a 844px screen — a third of the list — for two
                  taps that are each reachable in a 48px row. */}
              <button
                type="button"
                onClick={handleConfirmSelection}
                className="flex-1 flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  borderRadius: 999,
                  padding: '12px 16px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 'normal',
                  minInlineSize: 0,
                  minHeight: 48,
                }}
                aria-label={`${confirmLabel} עם ${pluralizeHe(pendingExercises.length, HE_NOUNS.exercise)}`}
              >
                <DumbbellIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>
                  {confirmLabel} ({pendingExercises.length})
                </span>
              </button>

              {onPlanRequested && (
                <button
                  type="button"
                  onClick={handlePlanSelection}
                  className="flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: 'var(--fs-ink)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    padding: '12px 14px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: 'normal',
                    flex: '0 0 auto',
                    minHeight: 48,
                  }}
                  aria-label={`תכננו מראש ${pluralizeHe(pendingExercises.length, HE_NOUNS.exercise)}. סטים, משקל וחזרות`}
                >
                  <ClipboardIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>תכננו מראש</span>
                </button>
              )}
            </m.div>
          ) : (
            <m.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-1.5 flex items-center justify-between"
              style={{
                background: 'var(--fs-surface)',
                borderTop: '1px solid var(--fs-surface-2)',
              }}
            >
              {/* Compact utility row instead of two stacked full-width buttons:
                  creating an exercise is the rare path, so it earns a quiet
                  inline link — not ~130px of permanent footer that pushes the
                  list up on every visit to this sheet. */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onCreateNew();
                }}
                className="flex items-center gap-1.5 cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'var(--fs-link)',
                  border: 'none',
                  padding: '8px 6px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: 'normal',
                  minHeight: 36,
                }}
              >
                <Plus style={{ width: 16, height: 16, flexShrink: 0 }} />
                תרגיל חדש
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'var(--fs-muted)',
                  border: 'none',
                  padding: '8px 6px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: 'normal',
                  minHeight: 36,
                }}
              >
                ביטול
              </button>
            </m.div>
          )}
        </AnimatePresence>

        {/* Safe area bottom */}
        <div
          style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--fs-surface)' }}
        />
      </m.div>
    </ModalOverlay>
  );
};

export default ExerciseSelector;
