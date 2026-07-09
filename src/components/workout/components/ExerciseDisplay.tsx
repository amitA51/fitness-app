// ExerciseDisplay - Fresh Steel v2 Active Workout Layout
// Exercise card (pinned) → technique pills → input cards → previous badge → action group
// No dark hero panel, no internal SlideToComplete

import {
  Check,
  ChevronLeft,
  Edit,
  FileText,
  Layers,
  Link2,
  Plus,
  RotateCcw,
  SkipForward,
  Star,
  Unlink,
  Wrench,
} from 'lucide-react';
import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import type {
  Exercise,
  ProgramExtras,
  RpeTag,
  SetSegment,
  SetTechnique,
  WorkoutSet,
} from '../../../types';
import type { SupersetGroup, SwapLibraryMeta } from '../core/workoutTypes';
import { usePreviousSetData } from '../hooks/usePreviousSetData';
import ActionChip from './ActionChip';
import AlternativesSheet from './AlternativesSheet';
import DropSetSheet from './DropSetSheet';
import ExerciseNoteBar from './ExerciseNoteBar';
import NotesBottomSheet from './NotesBottomSheet';
import RPEPicker from './RPEPicker';
import SetEditBottomSheet from './SetEditBottomSheet';
import SetInputCard from './SetInputCard';
import { SetProgress } from './SetProgress';
import SetTechniquePills from './SetTechniquePills';
import WorkoutToolsSheet, { type WorkoutTool } from './WorkoutToolsSheet';

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
  /** Skip the active set (warmup opt-out): no rest, no logged volume. */
  onSkipSet?: () => void;
  /** Replace the per-weight legs of a set (drop set / weight changed mid-set). */
  onUpdateSetSegments?: (setIndex: number, segments: SetSegment[]) => void;
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
  /** Swap the live exercise's movement for a chosen alternative (bilingual label).
      A library swap also passes the chosen movement's catalog metadata so the
      muscle map, equipment badge and tutorial follow the new movement. Preset
      swaps pass only the name and keep the original targeting. */
  onSwapExercise?: (exerciseId: string, newName: string, libraryMeta?: SwapLibraryMeta) => void;
  /** Open the AI coach / exercise guide (surfaced beside the note at the top). */
  onOpenAICoach?: () => void;
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
    warmupRange,
    workingSets,
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
  // Prefer the plan's verbatim warmup prescription (e.g. "2–3") over the flat
  // resolved count so the pill reads exactly like the program.
  const warmupValue = warmupRange && warmupRange.length > 0 ? warmupRange : `×${warmupSets}`;
  const hasWorkingSets = typeof workingSets === 'number' && workingSets > 0;
  // Prefer the freeform PDF cue (tempo/pause/setup). For non-program templates
  // (no rep range) fall back to the legacy composed note so coach-authored
  // templates keep their guidance; for program days `coachingNote` is the cue
  // and the structured pills already carry the rep/RPE/rest/warmup summary.
  const note = coachingNote || (repRange ? undefined : notes);

  const hasPills = Boolean(
    repRange || rpeText || restRange || hasWarmup || hasWorkingSets || intensityTechnique
  );
  if (!hasPills && !note) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
      {hasPills && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {repRange && <PrescPill label="חזרות" value={repRange} />}
          {rpeText && <PrescPill value={rpeText} />}
          {restRange && <PrescPill label="מנוחה" value={restRange} />}
          {hasWorkingSets && <PrescPill label="סטים" value={`×${workingSets}`} />}
          {hasWarmup && <PrescPill label="חימום" value={warmupValue} />}
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
    onSkipSet,
    onUpdateSetSegments,
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
    onOpenAICoach,
  }) => {
    const [showSetEditor, setShowSetEditor] = useState(false);
    const [showRPEPicker, setShowRPEPicker] = useState(false);
    const [showNotesSheet, setShowNotesSheet] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [showDropSetSheet, setShowDropSetSheet] = useState(false);
    const [showToolsSheet, setShowToolsSheet] = useState(false);
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

    // Occasional tools — pulled out of the always-on panel into the כלים sheet so
    // the live set surface keeps only the per-set actions inline. Each entry is
    // gated by the same condition that used to guard its chip; the sheet trigger
    // only renders when at least one applies, so it never opens empty.
    const tools: WorkoutTool[] = [];
    if (onOpenPlateCalc) {
      tools.push({
        id: 'plates',
        icon: (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800 }}>ק״ג</span>
        ),
        label: 'מחשבון פלטות',
        caption: 'איך להעמיס את המוט למשקל היעד',
        onSelect: onOpenPlateCalc,
      });
    }
    if (completedSetsCount > 0 && onEditSet) {
      tools.push({
        id: 'edit-sets',
        icon: <Edit size={18} strokeWidth={2.2} />,
        label: 'עריכת סטים',
        caption: 'תיקון משקל או חזרות בסטים שהושלמו',
        onSelect: () => setShowSetEditor(true),
      });
    }
    if (onUpdateSetSegments && currentSet.isDropSet) {
      tools.push({
        id: 'drop-segments',
        icon: <Layers size={18} strokeWidth={2.2} />,
        label: 'מקטעי דרופ-סט',
        caption: 'רישום כל ירידת משקל בתוך הסט',
        onSelect: () => setShowDropSetSheet(true),
        dot: !!(currentSet.segments && currentSet.segments.length > 0),
      });
    }
    if (workingCompleted === 0 && onSwapExercise) {
      const hasPresets = (exercise.programExtras?.alternatives?.length ?? 0) > 0;
      tools.push({
        id: 'alternatives',
        icon: <RotateCcw size={18} strokeWidth={2.2} />,
        label: 'תרגילים חלופיים',
        caption: hasPresets ? 'החלפה בתנועה דומה או בתרגיל מהספרייה' : 'החלפה בתרגיל מהספרייה',
        onSelect: () => setShowAlternatives(true),
      });
    }
    if (isInSuperset && onRemoveSuperset) {
      tools.push({
        id: 'superset-remove',
        icon: <Unlink size={18} strokeWidth={2.2} />,
        label: 'בטל סופרסט',
        caption: 'הפרדת התרגיל מהסופרסט',
        active: true,
        onSelect: () => {
          haptics.impact('medium');
          onRemoveSuperset(exercise.id);
        },
      });
    } else if (onCreateSuperset) {
      tools.push({
        id: 'superset-create',
        icon: <Link2 size={18} strokeWidth={2.2} />,
        label: 'צור סופרסט',
        caption: 'שילוב עם התרגיל הבא ללא מנוחה',
        onSelect: () => {
          haptics.impact('medium');
          onCreateSuperset(exercise.id);
        },
      });
    }

    // Inline per-set chips: RPE + add-set are meaningful only during an active
    // set; once the exercise is complete the done-panel already offers add-set,
    // and the only live actions are the כלים sheet (edit/superset/plates) + undo.
    const showRpeChip = !isExerciseComplete && !!onUpdateRPE;
    const showInlineAddSet = !isExerciseComplete && !!onAddSet;
    const showUndoChip = completedSetsCount > 0 && !!onUndo;
    const hasActionRow = showRpeChip || showInlineAddSet || tools.length > 0 || showUndoChip;

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

        {/* ── NOTE + AI STRIP (pinned, top) ── */}
        {onUpdateNotes && (
          <ExerciseNoteBar
            note={currentSet.notes || ''}
            onEdit={() => setShowNotesSheet(true)}
            onOpenAI={onOpenAICoach}
          />
        )}

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

              {/* Skip-warmup affordance — only while the active set is a warmup.
                  Warmups don't need to be logged rep-for-rep, so offer a one-tap
                  skip that advances without starting a rest timer. */}
              {activeIsWarmup && onSkipSet && (
                <>
                  <div style={{ height: 10, flexShrink: 0 }} />
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impact('light');
                      onSkipSet();
                    }}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      minHeight: 44,
                      borderRadius: 12,
                      background: 'color-mix(in srgb, var(--fs-accent) 10%, var(--fs-surface))',
                      border:
                        '1px dashed color-mix(in srgb, var(--fs-accent) 45%, var(--fs-steel))',
                      color: 'var(--fs-accent-2)',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 13,
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                    }}
                    aria-label="דלג על סט החימום"
                  >
                    <SkipForward size={15} strokeWidth={2.5} />
                    דלג על סט החימום
                  </button>
                </>
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

          {/* 5D: Per-set actions — RPE + add-set sit inline (used every set);
              the occasional tools (plates, edit, drop legs, alternatives,
              superset) live one tap away in the כלים sheet so the live surface
              stays uncluttered. Undo trails as a quick safety affordance. */}
          {hasActionRow && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                flexShrink: 0,
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {showRpeChip && (
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
              {showInlineAddSet && (
                <ActionChip
                  icon={<Plus size={14} strokeWidth={2.5} />}
                  label="הוסף סט"
                  onClick={() => {
                    haptics.impact('light');
                    onAddSet?.();
                  }}
                  ariaLabel="הוסף סט לתרגיל"
                />
              )}
              {tools.length > 0 && (
                <ActionChip
                  icon={<Wrench size={14} strokeWidth={2.5} />}
                  label="כלים"
                  onClick={() => setShowToolsSheet(true)}
                  ariaLabel="כלים נוספים לתרגיל"
                />
              )}
              <div style={{ flex: 1 }} />
              {showUndoChip && (
                <ActionChip
                  icon={<RotateCcw size={14} strokeWidth={2.5} />}
                  onClick={() => onUndo?.()}
                  ariaLabel="בטל סט אחרון"
                />
              )}
            </div>
          )}
        </div>

        {/* ── BOTTOM SHEETS (portals, not layout) ── */}
        <WorkoutToolsSheet
          isOpen={showToolsSheet}
          onClose={() => setShowToolsSheet(false)}
          exerciseName={exercise.name || ''}
          tools={tools}
        />

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

        {onUpdateSetSegments && (
          <DropSetSheet
            isOpen={showDropSetSheet}
            set={currentSet}
            setIndex={displaySetIndex}
            exerciseName={exercise.name || ''}
            weightIncrement={weightIncrement}
            onSave={(segments) => onUpdateSetSegments(displaySetIndex, segments)}
            onClose={() => setShowDropSetSheet(false)}
          />
        )}

        {onSwapExercise && (
          <AlternativesSheet
            isOpen={showAlternatives}
            alternatives={exercise.programExtras?.alternatives ?? []}
            exerciseName={exercise.name || ''}
            onSelect={(alt) => onSwapExercise(exercise.id, alt)}
            onSelectFromLibrary={(libEx) =>
              onSwapExercise(exercise.id, libEx.name ?? '', {
                muscleGroup: libEx.muscleGroup,
                targetMuscle: libEx.targetMuscle,
                secondaryMuscles: libEx.secondaryMuscles,
                equipment: libEx.equipment,
                tutorialText: libEx.tutorialText,
                instructions: libEx.instructions,
              })
            }
            onClose={() => setShowAlternatives(false)}
          />
        )}
      </div>
    );
  }
);

ExerciseDisplay.displayName = 'ExerciseDisplay';

export default ExerciseDisplay;
