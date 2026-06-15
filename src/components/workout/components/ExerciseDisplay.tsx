// ExerciseDisplay - Fresh Steel v2 Active Workout Layout
// Exercise card (pinned) → technique pills → input cards → previous badge → action group
// No dark hero panel, no internal SlideToComplete

import {
  Check,
  ChevronLeft,
  Edit,
  FileText,
  Link2,
  Plus,
  RotateCcw,
  Star,
  Unlink,
} from 'lucide-react';
import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import type { Exercise, ProgramExtras, RpeTag, SetTechnique, WorkoutSet } from '../../../types';
import type { SupersetGroup } from '../core/workoutTypes';
import { usePreviousSetData } from '../hooks/usePreviousSetData';
import ActionChip from './ActionChip';
import AlternativesSheet from './AlternativesSheet';
import NotesBottomSheet from './NotesBottomSheet';
import RPEPicker from './RPEPicker';
import SetEditBottomSheet from './SetEditBottomSheet';
import SetInputCard from './SetInputCard';
import { SetProgress } from './SetProgress';
import SetTechniquePills from './SetTechniquePills';

// ============================================================
// TYPES
// ============================================================

interface ExerciseDisplayProps {
  exercise: Exercise;
  displaySetIndex: number;
  currentSet: WorkoutSet;
  prInfo: string;
  onUpdateSet: (field: 'weight' | 'reps', value: number) => void;
  onCompleteSet: () => void;
  onAddSet?: () => void;
  onNextExercise?: () => void;
  hasNextExercise?: boolean;
  onOpenNumpad: (target: 'weight' | 'reps') => void;
  onRenameExercise?: (name: string) => void;
  onEditSet?: (setIndex: number, updates: Partial<WorkoutSet>) => void;
  nameSuggestions?: string[];
  onUpdateNotes?: (notes: string) => void;
  onUpdateRPE?: (rpe: number | null) => void;
  onUpdateRpeTag?: (tag: RpeTag | null) => void;
  onUndo?: () => void;
  showGhostValues?: boolean;
  enableQuickWeightButtons?: boolean;
  enableQuickRepsButtons?: boolean;
  /** User-configured quick +/- weight step (kg). Same contract as WorkoutPlanScreen. */
  weightIncrement?: number;
  showVolumePreview?: boolean;
  supersetGroups?: SupersetGroup[];
  onCreateSuperset?: (exerciseId: string) => void;
  onRemoveSuperset?: (exerciseId: string) => void;
  onToggleTechnique?: (technique: SetTechnique, value: boolean) => void;
  onOpenPlateCalc?: () => void;
  /** Swap the live exercise's movement for a chosen alternative (bilingual label). */
  onSwapExercise?: (exerciseId: string, newName: string) => void;
}

// ============================================================
// PRESCRIPTION BLOCK
// Surfaces the program's full prescription under the exercise title so a program
// day reads like the PDF: rep range, RPE arrow, rest range, warmup count, the
// last-set intensity technique, and the freeform coaching cue. Pulls structured
// fields straight from programExtras (no string re-parsing). Reuses the prInfo
// mono-pill idiom (color-mix accent tints, var(--font-mono)); numerics/ranges
// are bidi-isolated (<bdi dir="ltr">) for correct RTL/Hebrew rendering. Collapses
// gracefully when fields are absent (regular, non-program templates).
// ============================================================

const coachPillBase: CSSProperties = {
  padding: '3px 9px',
  borderRadius: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  background: 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))',
  border: '1px solid color-mix(in srgb, var(--fs-accent) 25%, transparent)',
  color: 'var(--fs-accent-2)',
};

const coachPillStrong: CSSProperties = {
  ...coachPillBase,
  background: 'color-mix(in srgb, var(--fs-accent) 22%, var(--fs-surface))',
  border: '1px solid color-mix(in srgb, var(--fs-accent) 40%, transparent)',
};

// One mono prescription pill: an optional Hebrew micro-label plus a bidi-isolated
// value (numbers/ranges/arrows render LTR inside the RTL card).
function PrescPill({
  label,
  value,
  strong = false,
}: {
  label?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span style={strong ? coachPillStrong : coachPillBase}>
      {label ? `${label} ` : ''}
      <bdi dir="ltr">{value}</bdi>
    </span>
  );
}

function PrescriptionBlock({ extras }: { extras: ProgramExtras }) {
  const {
    repRange,
    earlyRpe,
    lastRpe,
    rpeTarget,
    restRange,
    warmupSets,
    intensityTechnique,
    coachingNote,
    notes,
  } = extras;

  // RPE: prefer the PDF's early→last arrow; fall back to the numeric last-set
  // target. Matches the Program day-card language so the two surfaces agree.
  const rpeText =
    earlyRpe && lastRpe
      ? `RPE ${earlyRpe}→${lastRpe}`
      : typeof rpeTarget === 'number'
        ? `RPE ${rpeTarget}`
        : null;

  const hasWarmup = typeof warmupSets === 'number' && warmupSets > 0;
  // Prefer the freeform PDF cue (tempo/pause/setup). For non-program templates
  // (no rep range) fall back to the legacy composed note so coach-authored
  // templates keep their guidance; for program days `coachingNote` is the cue
  // and the structured pills already carry the rep/RPE/rest/warmup summary.
  const note = coachingNote || (repRange ? undefined : notes);

  const hasPills = Boolean(repRange || rpeText || restRange || hasWarmup || intensityTechnique);
  if (!hasPills && !note) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
      {hasPills && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {repRange && <PrescPill label="חזרות" value={repRange} />}
          {rpeText && <PrescPill value={rpeText} />}
          {restRange && <PrescPill label="מנוחה" value={restRange} />}
          {hasWarmup && <PrescPill label="חימום" value={`×${warmupSets}`} />}
          {intensityTechnique && (
            <span style={coachPillStrong}>סט אחרון · {intensityTechnique}</span>
          )}
        </div>
      )}
      {note && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
            color: 'var(--fs-muted)',
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          <FileText size={13} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {note}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const ExerciseDisplay = memo<ExerciseDisplayProps>(
  ({
    exercise,
    displaySetIndex,
    currentSet,
    prInfo,
    onUpdateSet,
    onAddSet,
    onNextExercise,
    hasNextExercise = false,
    onOpenNumpad,
    onEditSet,
    onUpdateNotes,
    onUpdateRPE,
    onUpdateRpeTag,
    onUndo,
    showGhostValues = true,
    enableQuickWeightButtons = true,
    enableQuickRepsButtons = true,
    weightIncrement = 2.5,
    supersetGroups = [],
    onCreateSuperset,
    onRemoveSuperset,
    onToggleTechnique,
    onOpenPlateCalc,
    onSwapExercise,
  }) => {
    const [showSetEditor, setShowSetEditor] = useState(false);
    const [showRPEPicker, setShowRPEPicker] = useState(false);
    const [showNotesSheet, setShowNotesSheet] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const haptics = useHapticFeedback();

    const { previousSet, showGhostWeight, showGhostReps } = usePreviousSetData(
      exercise.name,
      displaySetIndex,
      currentSet,
      showGhostValues
    );

    const completedSetsCount = useMemo(
      () => exercise.sets?.filter((s) => s.completedAt).length || 0,
      [exercise.sets]
    );

    const totalSets = useMemo(() => exercise.sets?.length || 0, [exercise.sets]);

    // Warmup set indices for the progress spine (muted accent tint).
    const warmupIndices = useMemo(() => {
      const set = new Set<number>();
      (exercise.sets || []).forEach((s, i) => {
        if (s.isWarmup) set.add(i);
      });
      return set;
    }, [exercise.sets]);

    // Working-set-aware tallies for the progress label and the done-panel count.
    // Warmups are a separate ramp-up phase, so they must not inflate the working
    // "סט X מתוך Y". Regular templates have no warmups, so these equal the totals.
    const { workingTotal, workingCompleted, warmupTotal, warmupCompleted } = useMemo(() => {
      const sets = exercise.sets || [];
      let wTotal = 0;
      let wDone = 0;
      let uTotal = 0;
      let uDone = 0;
      for (const s of sets) {
        if (s.isWarmup) {
          uTotal++;
          if (s.completedAt) uDone++;
        } else {
          wTotal++;
          if (s.completedAt) wDone++;
        }
      }
      return {
        workingTotal: wTotal,
        workingCompleted: wDone,
        warmupTotal: uTotal,
        warmupCompleted: uDone,
      };
    }, [exercise.sets]);

    const activeIsWarmup = exercise.sets?.[displaySetIndex]?.isWarmup ?? false;

    // Exercise is "done" when it has planned sets and every one is completed.
    // In this state there is no real active set (displaySetIndex points at the
    // virtual slot past the end), so we swap the input cards for a clear
    // "completed" panel instead of showing a confusing empty SET n+1/n.
    const isExerciseComplete = totalSets > 0 && completedSetsCount >= totalSets;

    const isInSuperset = useMemo(() => {
      if (!exercise?.id || supersetGroups.length === 0) return false;
      return supersetGroups.some((g) => g.exercises.includes(exercise.id));
    }, [exercise?.id, supersetGroups]);

    const handleRepsTap = useCallback(() => onOpenNumpad('reps'), [onOpenNumpad]);
    const handleIncrementReps = useCallback(
      () => onUpdateSet('reps', (currentSet.reps || 0) + 1),
      [currentSet.reps, onUpdateSet]
    );
    const handleDecrementReps = useCallback(
      () => onUpdateSet('reps', Math.max(0, (currentSet.reps || 0) - 1)),
      [currentSet.reps, onUpdateSet]
    );
    const handleWeightTap = useCallback(() => onOpenNumpad('weight'), [onOpenNumpad]);
    const handleIncrementWeight = useCallback(
      () => onUpdateSet('weight', (currentSet.weight || 0) + weightIncrement),
      [currentSet.weight, onUpdateSet, weightIncrement]
    );
    const handleDecrementWeight = useCallback(
      () => onUpdateSet('weight', Math.max(0, (currentSet.weight || 0) - weightIncrement)),
      [currentSet.weight, onUpdateSet, weightIncrement]
    );
    const handleCommitGhostWeight = useCallback(
      (v: number) => onUpdateSet('weight', v),
      [onUpdateSet]
    );
    const handleCommitGhostReps = useCallback((v: number) => onUpdateSet('reps', v), [onUpdateSet]);

    return (
      <div
        className="flex flex-col w-full"
        style={{ gap: 0, background: 'var(--fs-bg)', height: '100%', flex: 1, overflow: 'hidden' }}
      >
        {/* ── EXERCISE CARD (spec §4) — pinned, light bg, accent top line ── */}
        <div style={{ padding: '12px 14px 0', flexShrink: 0, background: 'var(--fs-bg)' }}>
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-steel)',
              borderRadius: 'var(--radius-asymmetric)',
              padding: '14px 16px 12px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Top accent gradient line */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
              }}
            />

            {/* Row 1: Exercise name + PR badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 21,
                  color: 'var(--fs-heading)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {exercise.name || 'תרגיל ללא שם'}
              </span>
              {prInfo && (
                <span
                  style={{
                    flexShrink: 0,
                    padding: '4px 10px',
                    background: 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))',
                    border: '1px solid color-mix(in srgb, var(--fs-accent) 25%, transparent)',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--fs-accent-2)',
                    letterSpacing: '0.04em',
                    direction: 'ltr',
                  }}
                >
                  {prInfo}
                </span>
              )}
            </div>

            {/* Program prescription — visible during the sets it applies to,
                not hidden behind a tap. Cleared once the exercise is done. */}
            {exercise.programExtras && !isExerciseComplete && (
              <PrescriptionBlock extras={exercise.programExtras} />
            )}

            {/* Row 2: Segmented set-progress spine + working-set "סט X מתוך Y"
                label (warmups shown as a distinct "חימום" phase). */}
            <SetProgress
              current={displaySetIndex}
              total={totalSets}
              completed={completedSetsCount}
              warmupIndices={warmupIndices}
              workingTotal={workingTotal}
              workingCompleted={workingCompleted}
              warmupTotal={warmupTotal}
              warmupCompleted={warmupCompleted}
              activeIsWarmup={activeIsWarmup}
            />
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT (spec §5) ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          {isExerciseComplete ? (
            /* Exercise-done panel — replaces the input cards once every set is
               completed. Makes the finished state explicit and offers the two
               natural next actions (train another set / move on). */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                padding: '22px 16px',
                background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
                border: '1px solid color-mix(in srgb, var(--fs-accent) 25%, var(--fs-steel))',
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--fs-accent)',
                  color: 'var(--color-ink-on-accent)',
                }}
              >
                <Check size={26} strokeWidth={3} />
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--fs-heading)',
                }}
              >
                התרגיל הושלם
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.04em',
                  direction: 'ltr',
                }}
              >
                {workingCompleted} / {workingTotal} סטים
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 2 }}>
                {onAddSet && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impact('light');
                      onAddSet();
                    }}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-95 transition-transform"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 48,
                      borderRadius: 12,
                      background: 'var(--fs-surface)',
                      border: '1px solid var(--fs-steel)',
                      color: 'var(--fs-ink)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    הוסף סט
                  </button>
                )}
                {hasNextExercise && onNextExercise && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impact('medium');
                      onNextExercise();
                    }}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-95 transition-transform"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 48,
                      borderRadius: 12,
                      background: 'var(--fs-accent)',
                      border: 'none',
                      color: 'var(--color-ink-on-accent)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    לתרגיל הבא
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 5A: Technique pills */}
              {onToggleTechnique && (
                <SetTechniquePills set={currentSet} onToggle={onToggleTechnique} />
              )}

              {/* Gap after pills */}
              <div style={{ height: 12, flexShrink: 0 }} />

              {/* 5B: Input cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <SetInputCard
                  label="משקל"
                  value={currentSet.weight || 0}
                  ghostValue={previousSet?.weight}
                  showGhost={showGhostWeight}
                  unit="ק״ג"
                  incrementAmount={weightIncrement}
                  onTap={handleWeightTap}
                  onIncrement={handleIncrementWeight}
                  onDecrement={handleDecrementWeight}
                  onCommitGhost={handleCommitGhostWeight}
                  showButtons={enableQuickWeightButtons}
                />
                <SetInputCard
                  label="חזרות"
                  value={currentSet.reps || 0}
                  ghostValue={previousSet?.reps}
                  showGhost={showGhostReps}
                  incrementAmount={1}
                  onTap={handleRepsTap}
                  onIncrement={handleIncrementReps}
                  onDecrement={handleDecrementReps}
                  onCommitGhost={handleCommitGhostReps}
                  showButtons={enableQuickRepsButtons}
                />
              </div>

              {/* Gap */}
              <div style={{ height: 8, flexShrink: 0 }} />
            </>
          )}

          {/* 5C: Previous set badge */}
          {!isExerciseComplete && previousSet && (previousSet.weight || previousSet.reps) && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
                  border: '1px solid color-mix(in srgb, var(--fs-accent) 20%, transparent)',
                  borderRadius: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--fs-accent)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  אימון קודם:
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--fs-ink)',
                    direction: 'ltr',
                  }}
                >
                  {previousSet.weight ? `${previousSet.weight} ק״ג` : ''}
                  {previousSet.weight && previousSet.reps ? ' × ' : ''}
                  {previousSet.reps ? `${previousSet.reps}` : ''}
                </span>
                {previousSet.rpe && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--fs-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    RPE {previousSet.rpe}
                  </span>
                )}
              </div>
              <div style={{ height: 12, flexShrink: 0 }} />
            </>
          )}

          {/* 5D: Action group (tools) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '10px 12px',
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-steel)',
              borderRadius: 16,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
                paddingBottom: 4,
                borderBottom: '1px solid var(--fs-surface-2)',
              }}
            >
              כלים
            </div>

            {/* Row 1: Primary actions — horizontal scroll so the full tool set
                stays reachable at 360–390px without clipping or orphan wraps. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {onAddSet && (
                <ActionChip
                  icon={<Plus size={14} strokeWidth={2.5} />}
                  label="הוסף סט"
                  onClick={() => {
                    haptics.impact('light');
                    onAddSet();
                  }}
                  ariaLabel="הוסף סט לתרגיל"
                />
              )}
              {onUpdateRPE && (
                <ActionChip
                  icon={
                    <Star
                      size={14}
                      strokeWidth={2.5}
                      fill={currentSet.rpe ? 'var(--fs-primary)' : 'none'}
                    />
                  }
                  label={`RPE ${currentSet.rpe || '—'}`}
                  onClick={() => setShowRPEPicker(true)}
                  active={!!currentSet.rpe}
                  ariaLabel="בחר RPE"
                />
              )}
              {onOpenPlateCalc && (
                <ActionChip
                  icon={
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        fontWeight: 800,
                      }}
                    >
                      ק״ג
                    </span>
                  }
                  label="פלטות"
                  onClick={onOpenPlateCalc}
                  ariaLabel="מחשבון פלטות"
                />
              )}
              {onUpdateNotes && (
                <ActionChip
                  icon={<FileText size={14} strokeWidth={2.5} />}
                  label="הערות"
                  onClick={() => setShowNotesSheet(true)}
                  ariaLabel="הערות לסט"
                  dot={!!currentSet.notes}
                />
              )}
              <div style={{ flex: 1 }} />
              {completedSetsCount > 0 && onUndo && (
                <ActionChip
                  icon={<RotateCcw size={14} strokeWidth={2.5} />}
                  onClick={onUndo}
                  ariaLabel="בטל סט אחרון"
                />
              )}
            </div>

            {/* Row 2: Secondary actions */}
            {(completedSetsCount > 0 ||
              onCreateSuperset ||
              (workingCompleted === 0 &&
                exercise.programExtras?.alternatives &&
                exercise.programExtras.alternatives.length > 0)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {completedSetsCount > 0 && onEditSet && (
                  <ActionChip
                    icon={<Edit size={14} strokeWidth={2.5} />}
                    label="עריכת סטים"
                    onClick={() => setShowSetEditor(true)}
                    ariaLabel="עריכת סטים שהושלמו"
                  />
                )}
                {/* Hidden once a working set is logged: swapping then would
                    re-attribute that set to a different movement (the reducer
                    refuses it too). Warmups don't block — swap is still offered
                    during the warmup phase. */}
                {workingCompleted === 0 &&
                  exercise.programExtras?.alternatives &&
                  exercise.programExtras.alternatives.length > 0 && (
                    <ActionChip
                      icon={<RotateCcw size={14} strokeWidth={2.5} />}
                      label="חלופות"
                      onClick={() => setShowAlternatives(true)}
                      ariaLabel="תרגילים חלופיים"
                    />
                  )}
                {isInSuperset && onRemoveSuperset ? (
                  <ActionChip
                    icon={<Unlink size={14} strokeWidth={2.5} />}
                    label="בטל סופרסט"
                    onClick={() => {
                      haptics.impact('medium');
                      onRemoveSuperset(exercise.id);
                    }}
                    active
                    ariaLabel="בטל סופרסט"
                  />
                ) : (
                  onCreateSuperset && (
                    <ActionChip
                      icon={<Link2 size={14} strokeWidth={2.5} />}
                      label="סופרסט"
                      onClick={() => {
                        haptics.impact('medium');
                        onCreateSuperset(exercise.id);
                      }}
                      ariaLabel="צור סופרסט"
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM SHEETS (portals, not layout) ── */}
        {onEditSet && (
          <SetEditBottomSheet
            isOpen={showSetEditor}
            sets={exercise.sets || []}
            exerciseName={exercise.name || ''}
            onClose={() => setShowSetEditor(false)}
            onUpdateSet={onEditSet}
          />
        )}

        {onUpdateRPE && (
          <RPEPicker
            isOpen={showRPEPicker}
            currentValue={currentSet.rpe}
            targetRPE={
              exercise.programExtras?.rpeTarget !== undefined
                ? String(exercise.programExtras.rpeTarget)
                : undefined
            }
            onSelect={onUpdateRPE}
            currentTag={currentSet.rpeTag}
            onSelectTag={onUpdateRpeTag}
            onClose={() => setShowRPEPicker(false)}
          />
        )}

        {onUpdateNotes && (
          <NotesBottomSheet
            isOpen={showNotesSheet}
            currentNotes={currentSet.notes || ''}
            exerciseName={exercise.name || ''}
            setIndex={displaySetIndex}
            onSave={onUpdateNotes}
            onClose={() => setShowNotesSheet(false)}
          />
        )}

        {exercise.programExtras?.alternatives && exercise.programExtras.alternatives.length > 0 && (
          <AlternativesSheet
            isOpen={showAlternatives}
            alternatives={exercise.programExtras.alternatives}
            exerciseName={exercise.name || ''}
            onSelect={onSwapExercise ? (alt) => onSwapExercise(exercise.id, alt) : undefined}
            onClose={() => setShowAlternatives(false)}
          />
        )}
      </div>
    );
  }
);

ExerciseDisplay.displayName = 'ExerciseDisplay';

export default ExerciseDisplay;
