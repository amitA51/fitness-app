// ExerciseDisplay - Sport Annual Editorial Layout
// Navy masthead + hero number, bone input tiles, chip actions, btn-row finish

import { Edit, FileText, GripVertical, Minus, Plus, RotateCcw, Star } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { Exercise, WorkoutSet } from '../../../types';
import type { SupersetGroup } from '../core/workoutTypes';
import { usePreviousData } from '../hooks/usePreviousData';
import AlternativesSheet from './AlternativesSheet';
import NotesBottomSheet from './NotesBottomSheet';
import RPEPicker from './RPEPicker';
import SetEditBottomSheet from './SetEditBottomSheet';

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
}

// ============================================================
// CHIP BUTTON (48px square, sharp corners)
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
    onPointerDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    title={label}
    className="relative size-12 flex items-center justify-center transition-all active:scale-95"
    style={{
      background: active ? 'var(--mustard)' : 'var(--bone)',
      border: '2px solid var(--navy)',
      color: 'var(--navy)',
      borderRadius: 0,
    }}
  >
    {icon}
    {badge}
  </button>
));

ChipButton.displayName = 'ChipButton';

// ============================================================
// INPUT TILE (card-outlined style with eyebrow + number + +/- chips)
// ============================================================

interface InputTileProps {
  label: string;
  eyebrow: string;
  value: number;
  ghostValue?: number;
  showGhost?: boolean;
  unit?: string;
  onTap: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  showButtons: boolean;
}

const InputTile = memo<InputTileProps>(
  ({ label, eyebrow, value, ghostValue, showGhost, unit, onTap, onIncrement, onDecrement, showButtons }) => {
    const displayValue = value > 0 ? value : showGhost && ghostValue ? ghostValue : 0;
    const isGhost = !value && showGhost && !!ghostValue;

    return (
      <div
        className="card-outlined flex flex-col"
        style={{ padding: '14px 14px 12px', gap: 6 }}
      >
        {/* Eyebrow (mono mustard) */}
        <div className="flex items-center justify-between">
          <span
            className="eyebrow"
            style={{
              color: 'var(--mustard)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              fontWeight: 600,
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'var(--stone)',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>

        {/* Big number (tap-to-numpad) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTap();
          }}
          className="w-full text-center py-1 active:scale-[0.98] transition-transform tabular-nums"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 64,
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: isGhost ? 'var(--bone-deep)' : 'var(--navy)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontVariant: 'tabular-nums',
          }}
        >
          <span className="tabular-nums" style={{ fontVariant: 'tabular-nums' }}>
            {displayValue}
          </span>
          {unit && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                letterSpacing: '0.18em',
                color: 'var(--stone)',
                marginInlineStart: 6,
                verticalAlign: 'middle',
              }}
            >
              {unit.toUpperCase()}
            </span>
          )}
        </button>

        {/* +/- chip row */}
        {showButtons && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDecrement();
              }}
              className="flex items-center justify-center h-10 active:scale-95 transition-transform"
              style={{
                background: 'var(--bone-deep)',
                border: '2px solid var(--navy)',
                color: 'var(--navy)',
                borderRadius: 0,
              }}
              aria-label={`הורד ${label}`}
            >
              <Minus size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onIncrement();
              }}
              className="flex items-center justify-center h-10 active:scale-95 transition-transform"
              style={{
                background: 'var(--navy)',
                border: '2px solid var(--navy)',
                color: 'var(--mustard)',
                borderRadius: 0,
              }}
              aria-label={`הוסף ${label}`}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    );
  }
);

InputTile.displayName = 'InputTile';

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
    showVolumePreview = false,
    supersetGroups = [],
    onCreateSuperset,
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

    // Hero display values (target if set, else ghost previous)
    const heroWeight =
      currentSet.weight && currentSet.weight > 0 ? currentSet.weight : previousSet?.weight || 0;
    const heroReps =
      currentSet.reps && currentSet.reps > 0 ? currentSet.reps : previousSet?.reps || 0;
    const heroIsGhost = !currentSet.weight;

    const handleRepsTap = () => onOpenNumpad('reps');
    const handleIncrementReps = () => onUpdateSet('reps', (currentSet.reps || 0) + 1);
    const handleDecrementReps = () => onUpdateSet('reps', Math.max(0, (currentSet.reps || 0) - 1));
    const handleWeightTap = () => onOpenNumpad('weight');
    const handleIncrementWeight = () => onUpdateSet('weight', (currentSet.weight || 0) + 2.5);
    const handleDecrementWeight = () =>
      onUpdateSet('weight', Math.max(0, (currentSet.weight || 0) - 2.5));

    // Exercise number label: §01 style from chapter number
    const chapterNum = useMemo(() => {
      const n = displaySetIndex + 1;
      return n < 10 ? `0${n}` : String(n);
    }, [displaySetIndex]);

    return (
      <div className="flex flex-col w-full max-w-lg mx-auto" style={{ gap: 0 }}>
        {/* ── AW MASTHEAD ── exercise + set counter */}
        <div className="aw-masthead">
          <div className="flex items-center gap-3 min-w-0">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                color: 'var(--mustard)',
              }}
            >
              §{chapterNum}
            </span>
            <span className="exercise truncate">
              {exercise.name || 'תרגיל ללא שם'}
            </span>
          </div>
          <div className="counter">
            סט {displaySetIndex + 1} / {totalSets}
          </div>
        </div>

        {/* ── AW HERO ── massive weight number */}
        <div className="aw-hero" style={{ overflow: 'hidden' }}>
          {/* RPE badge / TAP RPE button */}
          {onUpdateRPE && currentSet.rpe ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRPEPicker(true);
                }}
                className="rpe"
                style={{ border: 'none', cursor: 'pointer' }}
              >
                RPE {currentSet.rpe}
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowRPEPicker(true);
                }}
                className="rpe"
                style={{
                  background: 'transparent',
                  color: 'var(--mustard)',
                  border: '1.5px solid var(--mustard)',
                  cursor: 'pointer',
                }}
              >
                TAP RPE
              </button>
            )}

          <div
            className="num tabular-nums"
            style={{
              color: heroIsGhost ? 'rgba(245, 241, 235, 0.35)' : 'var(--bone)',
              fontVariant: 'tabular-nums',
            }}
          >
            {heroWeight || 0}
          </div>
          <div className="unit tabular-nums" style={{ fontVariant: 'tabular-nums' }}>
            {heroWeight || 0} KG · × {heroReps || 0} REPS
          </div>

          {/* Volume preview (inline with unit line) */}
          {showVolumePreview && (currentSet.weight || 0) > 0 && (currentSet.reps || 0) > 0 && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.22em',
                color: 'var(--mustard)',
                textTransform: 'uppercase',
                marginTop: 10,
              }}
            >
              VOL · {((currentSet.weight || 0) * (currentSet.reps || 0)).toLocaleString()} KG
            </div>
          )}
        </div>

        {/* ── PROGRAM META RIBBON ── */}
        {exercise.programExtras && (
          <div
            className="flex flex-wrap items-center gap-2 px-5 py-3"
            style={{
              background: 'var(--bone-deep)',
              borderBottom: '1px solid var(--navy)',
            }}
          >
            {currentSet.isWarmup && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                חימום
              </span>
            )}
            {exercise.programExtras.rpeTarget && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                RPE TARGET {exercise.programExtras.rpeTarget}
              </span>
            )}
            {exercise.programExtras.restTime && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                REST {exercise.programExtras.restTime}s
              </span>
            )}
            {exercise.programExtras.intensityTechnique && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                {exercise.programExtras.intensityTechnique}
              </span>
            )}
            {exercise.tempo && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                TEMPO {exercise.tempo}
              </span>
            )}
            {isInSuperset && supersetInfo && (
              <span className="chip" style={{ textTransform: 'uppercase' }}>
                SUPERSET {supersetInfo.position}/{supersetInfo.total}
              </span>
            )}
            {exercise.programExtras.alternatives &&
              exercise.programExtras.alternatives.length > 0 && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAlternatives(true);
                  }}
                  className="chip"
                  style={{ cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  <GripVertical size={10} />
                  חלופות ({exercise.programExtras.alternatives.length})
                </button>
              )}
          </div>
        )}

        {/* ── PROGRAM NOTES ── */}
        {exercise.programExtras?.notes && (
          <div
            className="px-5 py-3"
            style={{
              background: 'var(--bone)',
              borderBottom: '1px solid var(--bone-deep)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.55,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'var(--mustard)',
                textTransform: 'uppercase',
                marginInlineEnd: 8,
              }}
            >
              NOTE —
            </span>
            {exercise.programExtras.notes}
          </div>
        )}

        {/* ── INPUT TILES ── two card-outlined sharp tiles */}
        <div
          className="grid grid-cols-2 px-5 py-5"
          style={{ gap: 12, background: 'var(--bone)' }}
        >
          <InputTile
            label="REPS"
            eyebrow="חזרות"
            value={currentSet.reps || 0}
            ghostValue={previousSet?.reps}
            showGhost={showGhostReps}
            onTap={handleRepsTap}
            onIncrement={handleIncrementReps}
            onDecrement={handleDecrementReps}
            showButtons={enableQuickRepsButtons}
          />
          <InputTile
            label="KG"
            eyebrow="משקל"
            value={currentSet.weight || 0}
            ghostValue={previousSet?.weight}
            showGhost={showGhostWeight}
            unit="kg"
            onTap={handleWeightTap}
            onIncrement={handleIncrementWeight}
            onDecrement={handleDecrementWeight}
            showButtons={enableQuickWeightButtons}
          />
        </div>

        {/* ── QUICK ACTIONS ROW ── */}
        <div
          className="flex justify-between items-center px-5 pb-4"
          style={{ background: 'var(--bone)' }}
        >
          {/* Left: RPE / Notes chip buttons */}
          <div className="flex gap-2">
            {onUpdateRPE && (
              <ChipButton
                icon={<Star size={18} strokeWidth={2.25} />}
                onClick={() => setShowRPEPicker(true)}
                active={!!currentSet.rpe}
                label="RPE"
                badge={
                  currentSet.rpe ? (
                    <span
                      className="absolute flex items-center justify-center"
                      style={{
                        top: -6,
                        insetInlineEnd: -6,
                        width: 18,
                        height: 18,
                        background: 'var(--navy)',
                        color: 'var(--mustard)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {currentSet.rpe}
                    </span>
                  ) : undefined
                }
              />
            )}

            {onUpdateNotes && (
              <ChipButton
                icon={<FileText size={18} strokeWidth={2.25} />}
                onClick={() => setShowNotesSheet(true)}
                active={!!currentSet.notes}
                label="הערות"
                badge={
                  currentSet.notes ? (
                    <span
                      className="absolute"
                      style={{
                        top: -3,
                        insetInlineEnd: -3,
                        width: 8,
                        height: 8,
                        background: 'var(--mustard)',
                        border: '1.5px solid var(--navy)',
                      }}
                    />
                  ) : undefined
                }
              />
            )}

            {completedSetsCount > 0 && onEditSet && (
              <ChipButton
                icon={<Edit size={16} strokeWidth={2.25} />}
                onClick={() => setShowSetEditor(true)}
                label="עריכת סטים"
              />
            )}
          </div>

          {/* Right: superset / undo */}
          <div className="flex gap-2">
            {!isInSuperset && onCreateSuperset && (
              <ChipButton
                icon={<Plus size={18} strokeWidth={2.5} />}
                onClick={() => onCreateSuperset(exercise.id)}
                label="סופרסט"
              />
            )}

            {completedSetsCount > 0 && onUndo && (
              <ChipButton
                icon={<RotateCcw size={18} strokeWidth={2.25} />}
                onClick={onUndo}
                label="בטל סט אחרון"
              />
            )}
          </div>
        </div>

        {/* ── FINISH SET BUTTON ROW ── primary + secondary */}
        <div className="px-5 pb-5" style={{ background: 'var(--bone)' }}>
          <div className="btn-row">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCompleteSet();
              }}
              className="btn-primary"
            >
              סיים סט
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // "Skip" = complete without marking; for now call complete to advance
                onCompleteSet();
              }}
              className="btn-secondary"
            >
              דלג
            </button>
          </div>
        </div>

        {/* ── BOTTOM SHEETS ── unchanged */}
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
