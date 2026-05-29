// ExerciseDisplay - Fresh Steel v2 Active Workout Layout
// Exercise card (pinned) → technique pills → input cards → previous badge → action group
// No dark hero panel, no internal SlideToComplete

import { Edit, FileText, Link2, RotateCcw, Star, Unlink } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import type { Exercise, SetTechnique, WorkoutSet } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import type { SupersetGroup } from '../core/workoutTypes';
import { usePreviousData } from '../hooks/usePreviousData';
import AlternativesSheet from './AlternativesSheet';
import NotesBottomSheet from './NotesBottomSheet';
import RPEPicker from './RPEPicker';
import SetEditBottomSheet from './SetEditBottomSheet';
import SetInputCard from './SetInputCard';
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
  onOpenNumpad: (target: 'weight' | 'reps') => void;
  onRenameExercise?: (name: string) => void;
  onEditSet?: (setIndex: number, updates: Partial<WorkoutSet>) => void;
  nameSuggestions?: string[];
  onUpdateNotes?: (notes: string) => void;
  onUpdateRPE?: (rpe: number | null) => void;
  onUndo?: () => void;
  showGhostValues?: boolean;
  enableQuickWeightButtons?: boolean;
  enableQuickRepsButtons?: boolean;
  showVolumePreview?: boolean;
  supersetGroups?: SupersetGroup[];
  onCreateSuperset?: (exerciseId: string) => void;
  onRemoveSuperset?: (exerciseId: string) => void;
  onToggleTechnique?: (technique: SetTechnique, value: boolean) => void;
  onOpenPlateCalc?: () => void;
}

// ============================================================
// ACTION CHIP (spec §5D)
// ============================================================

interface ActionChipProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  active?: boolean;
  ariaLabel: string;
  dot?: boolean;
}

const ActionChip = memo<ActionChipProps>(({ icon, label, onClick, active, ariaLabel, dot }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={ariaLabel}
    className="transition-all active:scale-95"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: label ? '7px 12px' : '7px 10px',
      background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
      border: '1px solid var(--fs-steel)',
      borderRadius: '12px 8px 12px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 700,
      color: active ? 'var(--fs-primary)' : 'var(--fs-ink)',
      cursor: 'pointer',
      minHeight: 38,
      whiteSpace: 'nowrap',
      position: 'relative',
    }}
  >
    <span style={{ display: 'inline-flex', width: 14, height: 14, flexShrink: 0 }}>{icon}</span>
    {label && <span>{label}</span>}
    {dot && (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 4,
          insetInlineEnd: 4,
          width: 6,
          height: 6,
          background: 'var(--fs-accent)',
          borderRadius: '50%',
        }}
      />
    )}
  </button>
));

ActionChip.displayName = 'ActionChip';

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
    onOpenNumpad,
    onEditSet,
    onUpdateNotes,
    onUpdateRPE,
    onUndo,
    showGhostValues = true,
    enableQuickWeightButtons = true,
    enableQuickRepsButtons = true,
    supersetGroups = [],
    onCreateSuperset,
    onRemoveSuperset,
    onToggleTechnique,
    onOpenPlateCalc,
  }) => {
    const [showSetEditor, setShowSetEditor] = useState(false);
    const [showRPEPicker, setShowRPEPicker] = useState(false);
    const [showNotesSheet, setShowNotesSheet] = useState(false);
    const [showAlternatives, setShowAlternatives] = useState(false);

    const { previousSets } = usePreviousData(exercise.name);
    const previousSet = previousSets?.[displaySetIndex];

    const showGhostWeight = showGhostValues && !currentSet.weight && !!previousSet?.weight;
    const showGhostReps = showGhostValues && !currentSet.reps && !!previousSet?.reps;

    const completedSetsCount = useMemo(
      () => exercise.sets?.filter((s) => s.completedAt).length || 0,
      [exercise.sets]
    );

    const totalSets = useMemo(() => exercise.sets?.length || 0, [exercise.sets]);

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
      () => onUpdateSet('weight', (currentSet.weight || 0) + 2.5),
      [currentSet.weight, onUpdateSet]
    );
    const handleDecrementWeight = useCallback(
      () => onUpdateSet('weight', Math.max(0, (currentSet.weight || 0) - 2.5)),
      [currentSet.weight, onUpdateSet]
    );

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
              borderRadius: '22px 16px 22px 16px',
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

            {/* Row 2: Set dots + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 5, direction: 'ltr' }}>
                {Array.from({ length: totalSets }, (_, i) => {
                  const isCompleted = i < completedSetsCount;
                  const isCurrent = i === completedSetsCount && i < totalSets;
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional set-status dots derived from a count, never reordered
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: isCompleted
                          ? 'var(--fs-accent)'
                          : isCurrent
                            ? 'var(--fs-accent-2)'
                            : 'var(--fs-surface-2)',
                        border: isCompleted
                          ? '1.5px solid var(--fs-accent)'
                          : isCurrent
                            ? '1.5px solid var(--fs-accent-2)'
                            : '1.5px solid var(--fs-steel)',
                        boxShadow: isCurrent
                          ? '0 0 8px color-mix(in srgb, var(--fs-accent-2) 50%, transparent)'
                          : 'none',
                        transform: isCurrent ? 'scale(1.25)' : 'none',
                        transition: 'all 200ms ease',
                      }}
                    />
                  );
                })}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  direction: 'ltr',
                }}
              >
                SET {completedSetsCount + 1} / {totalSets}
              </span>
            </div>
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
          {/* 5A: Technique pills */}
          {onToggleTechnique && <SetTechniquePills set={currentSet} onToggle={onToggleTechnique} />}

          {/* Gap after pills */}
          <div style={{ height: 12, flexShrink: 0 }} />

          {/* 5B: Input cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SetInputCard
              label="משקל"
              value={currentSet.weight || 0}
              ghostValue={previousSet?.weight}
              showGhost={showGhostWeight}
              unit="kg"
              incrementAmount={2.5}
              onTap={handleWeightTap}
              onIncrement={handleIncrementWeight}
              onDecrement={handleDecrementWeight}
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
              showButtons={enableQuickRepsButtons}
            />
          </div>

          {/* Gap */}
          <div style={{ height: 8, flexShrink: 0 }} />

          {/* 5C: Previous set badge */}
          {previousSet && (previousSet.weight || previousSet.reps) && (
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
                  {previousSet.weight ? `${previousSet.weight}kg` : ''}
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

            {/* Row 1: Primary actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      KG
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
            {(completedSetsCount > 0 || onCreateSuperset) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {completedSetsCount > 0 && onEditSet && (
                  <ActionChip
                    icon={<Edit size={14} strokeWidth={2.5} />}
                    label="עריכת סטים"
                    onClick={() => setShowSetEditor(true)}
                    ariaLabel="עריכת סטים שהושלמו"
                  />
                )}
                {isInSuperset && onRemoveSuperset ? (
                  <ActionChip
                    icon={<Unlink size={14} strokeWidth={2.5} />}
                    label="בטל סופרסט"
                    onClick={() => {
                      triggerHaptic('medium');
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
                        triggerHaptic('medium');
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
            onClose={() => setShowAlternatives(false)}
          />
        )}
      </div>
    );
  }
);

ExerciseDisplay.displayName = 'ExerciseDisplay';

export default ExerciseDisplay;
