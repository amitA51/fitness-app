// ExerciseDisplay - Fresh Steel Compact Active Workout Layout
// Exercise panel (nav + name + set progress) → Two stepper cards → RPE button → Slide to complete
// No hero masthead, no large numbers, no program meta ribbon

import { Edit, FileText, MoreHorizontal, Plus, RotateCcw, Star } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, SetTechnique, WorkoutSet } from '../../../types';
import type { SupersetGroup } from '../core/workoutTypes';
import { usePreviousData } from '../hooks/usePreviousData';
import AlternativesSheet from './AlternativesSheet';
import NotesBottomSheet from './NotesBottomSheet';
import RPEPicker from './RPEPicker';
import SetEditBottomSheet from './SetEditBottomSheet';
import SetInputCard from './SetInputCard';
import SetTechniquePills from './SetTechniquePills';
import SlideToComplete from './SlideToComplete';

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
  onToggleTechnique?: (technique: SetTechnique, value: boolean) => void;
  onOpenPlateCalc?: () => void;
  hideSlideButton?: boolean;
}

// ============================================================
// CHIP BUTTON (40px, Fresh Steel styling)
// ============================================================

interface ChipButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
  badge?: React.ReactNode;
}

const ChipButton = memo<ChipButtonProps>(({ icon, onClick, active, label, badge }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    title={label}
    className="relative flex items-center justify-center transition-all active:scale-95"
    style={{
      width: 44,
      height: 40,
      background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
      border: '1px solid var(--fs-steel)',
      borderRadius: '12px 8px 12px 8px',
      color: active ? 'var(--fs-primary)' : 'var(--fs-ink)',
    }}
  >
    {icon}
    {badge}
  </button>
));

ChipButton.displayName = 'ChipButton';

// ============================================================
// OVERFLOW CHIP MENU
// ============================================================

interface OverflowItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  dot?: boolean;
}

interface OverflowChipMenuProps {
  items: OverflowItem[];
}

const OverflowChipMenu = memo<OverflowChipMenuProps>(({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <ChipButton
        icon={<MoreHorizontal size={16} strokeWidth={2.25} />}
        onClick={() => setOpen((o) => !o)}
        label="עוד"
        active={open}
      />
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: 'calc(100% + 6px)',
            insetInlineStart: 0,
            minWidth: 180,
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-steel)',
            borderRadius: '14px 10px 14px 10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          {items.map((it, idx) => (
            <button
              key={it.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                it.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--fs-surface-2)] transition-colors"
              style={{
                background: 'var(--fs-surface)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--fs-surface-2)',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ color: 'var(--fs-accent)', display: 'inline-flex' }}>{it.icon}</span>
              <span className="flex-1 text-start">{it.label}</span>
              {it.dot && (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    background: 'var(--fs-accent)',
                    borderRadius: '50%',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

OverflowChipMenu.displayName = 'OverflowChipMenu';

// ============================================================
// MAIN COMPONENT
// ============================================================

const ExerciseDisplay = memo<ExerciseDisplayProps>(
  ({
    exercise,
    displaySetIndex,
    currentSet,
    onUpdateSet,
    onCompleteSet,
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
    onToggleTechnique,
    onOpenPlateCalc,
    hideSlideButton = false,
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

    const supersetInfo = useMemo(() => {
      if (!exercise?.id || supersetGroups.length === 0) return null;
      const group = supersetGroups.find((g) => g.exercises.includes(exercise.id));
      if (!group) return null;
      return {
        position: group.exercises.indexOf(exercise.id) + 1,
        total: group.exercises.length,
      };
    }, [exercise?.id, supersetGroups]);

    const isInSuperset = supersetInfo !== null;

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

    // Stable memoized items array for OverflowChipMenu — prevents re-render
    // of the menu (and its children) on every parent state tick.
    const openNotesSheet = useCallback(() => setShowNotesSheet(true), []);
    const openSetEditor = useCallback(() => setShowSetEditor(true), []);

    const overflowItems = useMemo(() => {
      const items: OverflowItem[] = [];
      if (onUpdateNotes) {
        items.push({
          icon: <FileText size={14} strokeWidth={2.25} />,
          label: 'הערות',
          onClick: openNotesSheet,
          dot: !!currentSet.notes,
        });
      }
      if (completedSetsCount > 0 && onEditSet) {
        items.push({
          icon: <Edit size={14} strokeWidth={2.25} />,
          label: 'עריכת סטים',
          onClick: openSetEditor,
        });
      }
      if (!isInSuperset && onCreateSuperset) {
        items.push({
          icon: <Plus size={14} strokeWidth={2.5} />,
          label: 'סופרסט',
          onClick: () => onCreateSuperset(exercise.id),
        });
      }
      return items;
    }, [
      onUpdateNotes,
      currentSet.notes,
      completedSetsCount,
      onEditSet,
      isInSuperset,
      onCreateSuperset,
      exercise.id,
      openNotesSheet,
      openSetEditor,
    ]);

    return (
      <div
        className="flex flex-col w-full"
        style={{
          gap: 0,
          background: 'var(--fs-bg)',
          minHeight: '100%',
          flex: 1,
        }}
      >
        {/* ── EXERCISE HERO PANEL ── name + set cockpit (asymmetric radius) ── */}
        <div style={{ padding: '12px 14px 0', background: 'var(--fs-bg)' }}>
          <div
            className="premium-dark-surface ambient-mesh ambient-mesh-strong scrim-noise"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '22px 16px 22px 16px',
              padding: 16,
              color: '#fff',
            }}
          >
            {/* perforated strip */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 'auto 16px 12px 16px',
                height: 7,
                borderRadius: 999,
                background:
                  'repeating-linear-gradient(90deg, rgba(255,255,255,0.62) 0 1px, transparent 1px 13px), rgba(255,255,255,0.12)',
              }}
            />
            {/* clipped polygon side */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: '0 auto 0 0',
                width: 44,
                opacity: 0.72,
                clipPath: 'polygon(44% 0, 100% 0, 56% 100%, 0 100%)',
                background:
                  'repeating-linear-gradient(180deg, rgba(255,255,255,0.24) 0 1px, transparent 1px 11px), linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent)',
              }}
            />

            {/* Exercise name header */}
            <div className="fade-rise-in" style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(18px, 5.5vw, 24px)',
                  color: '#FFFFFF',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {exercise.name || 'תרגיל ללא שם'}
              </span>
            </div>

            {/* set-cockpit inside */}
            <div
              className="glass-surface"
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '14px 10px 14px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  className="accent-glow"
                  style={{
                    direction: 'ltr',
                    display: 'grid',
                    width: 44,
                    height: 44,
                    placeItems: 'center',
                    border: '6px solid var(--fs-steel)',
                    borderRadius: '50%',
                    background: 'var(--fs-rubber)',
                    color: 'var(--fs-accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {completedSetsCount + 1}/{totalSets}
                </div>
                <span
                  style={{
                    opacity: 0.72,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  סט נוכחי
                </span>
              </div>
              <div
                style={{
                  direction: 'ltr',
                  color: 'var(--fs-signal)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                NEXT{' '}
                <span className="kinetic-number">
                  {currentSet.weight || previousSet?.weight || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TECHNIQUE PILLS (warmup / drop / failure / rest-pause) ── */}
        {onToggleTechnique && <SetTechniquePills set={currentSet} onToggle={onToggleTechnique} />}

        {/* ── GRID OF TWO STEPPERS ──  ── */}
        <div
          className="grid grid-cols-2"
          style={{
            gap: 10,
            padding: '12px 14px',
            background: 'var(--fs-bg)',
          }}
        >
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

        {/* ── PREVIOUS SET COMPARISON ── inline "last time" badge ── */}
        {previousSet && (previousSet.weight || previousSet.reps) && (
          <div
            style={{
              padding: '0 14px 4px',
              background: 'var(--fs-bg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '6px 12px',
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
                  letterSpacing: '0.08em',
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
          </div>
        )}

        {/* ── QUICK ACTIONS ROW ── RPE button + overflow + undo ── */}
        <div
          className="flex justify-between items-center"
          style={{
            padding: '0 14px 8px',
            background: 'var(--fs-bg)',
          }}
        >
          {/* Left: RPE compact picker button + plate calc + overflow */}
          <div className="flex gap-2">
            {onOpenPlateCalc && (
              <ChipButton
                icon={
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                    }}
                  >
                    kg
                  </span>
                }
                onClick={onOpenPlateCalc}
                label="מחשבון פלטות"
              />
            )}
            {onUpdateRPE && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRPEPicker(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: currentSet.rpe ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border: '1px solid var(--fs-steel)',
                  borderRadius: '14px 10px 14px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: currentSet.rpe ? 'var(--fs-primary)' : 'var(--fs-ink)',
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease, color 120ms ease',
                  minHeight: 40,
                }}
              >
                <Star
                  size={14}
                  strokeWidth={2.25}
                  fill={currentSet.rpe ? 'var(--fs-primary)' : 'none'}
                />
                RPE {currentSet.rpe || '—'}
              </button>
            )}

            <OverflowChipMenu items={overflowItems} />
          </div>

          {/* Right: undo */}
          <div className="flex gap-2">
            {completedSetsCount > 0 && onUndo && (
              <ChipButton
                icon={<RotateCcw size={16} strokeWidth={2.25} />}
                onClick={onUndo}
                label="בטל סט אחרון"
              />
            )}
          </div>
        </div>

        {/* ── SLIDE TO COMPLETE (lifted out when hideSlideButton) ── */}
        {!hideSlideButton && (
          <div
            style={{
              padding: '0 14px 12px',
              background: 'var(--fs-bg)',
            }}
          >
            <SlideToComplete
              label="החלק לסימון סט כבוצע"
              onComplete={onCompleteSet}
              disabled={false}
            />
          </div>
        )}

        {/* ── BOTTOM SHEETS ── */}
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
